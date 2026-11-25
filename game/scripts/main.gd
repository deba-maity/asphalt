extends Node

var ui: GameInterface
var world: ChapterWorld
var player: Fighter
var transitions: TransitionCoordinator
var closing: bool = false
var trial_active: bool = false
var last_install_metrics: Dictionary = {}
var story_token: int = 0
var story_active: bool = false
var benchmark: BenchmarkRecorder
var trial_stage: int=TrialPassage.WARDEN
var budget: RuntimeBudget
var journey := false
var duel_replay := false
var trained_on_shore := false

func _ready() -> void:
	ui = GameInterface.new()
	ui.main = self
	add_child(ui)
	transitions = TransitionCoordinator.new()
	transitions.main = self
	add_child(transitions)
	trial_active=true
	load_world()
	ui.show_menu()
	budget=RuntimeBudget.new(); budget.main=self; add_child(budget)
	benchmark=BenchmarkRecorder.new()
	benchmark.main=self
	add_child(benchmark)
	get_tree().auto_accept_quit = false
	var args = OS.get_cmdline_user_args()
	var script = ""
	if "--validate-systems" in args: script = "res://tests/system_tests.gd"
	elif "--validate-play" in args or "--validate-continue" in args: script = "res://tests/playthrough.gd"
	elif "--benchmark-route" in args: script="res://tests/benchmark_route.gd"
	elif "--campaign-play" in args or "--campaign-continue" in args: script = "res://tests/campaign_playthrough.gd"
	elif "--test-motion-quality" in args: script="res://tests/motion_quality_tests.gd"
	elif "--test-record-motion" in args: script="res://tests/record_motion_review.gd"
	elif "--test-trial-combat" in args: script="res://tests/trial_combat_tests.gd"
	elif "--test-trial-duel" in args: script="res://tests/trial_duel_tests.gd"
	elif "--test-trial-presentation" in args: script="res://tests/trial_presentation_tests.gd"
	elif "--test-audit" in args: script="res://tests/audit_tests.gd"
	elif "--test-passage" in args: script="res://tests/passage_tests.gd"
	elif "--test-endurance" in args: script="res://tests/trial_endurance.gd"
	elif "--test-trial" in args: script="res://tests/trial_tests.gd"
	elif "--test-quality" in args: script="res://tests/quality_tests.gd"
	elif "--test-quit-transition" in args or "--test-resume-transition" in args: script="res://tests/quit_transition.gd"
	elif "--test-transitions" in args: script = "res://tests/transition_tests.gd"
	if not script.is_empty():
		var validator = load(script).new()
		validator.main = self
		add_child(validator)

func detach_player() -> void:
	if not is_instance_valid(player): return
	if is_instance_valid(world): world.process_mode=Node.PROCESS_MODE_DISABLED
	if is_instance_valid(world) and player.slain.is_connected(world._hero_died): player.slain.disconnect(world._hero_died)
	player.reparent(self)
	player.world = null
	player.target = null
	player.clear_intent()
	player.set_physics_process(false)
	player.visible = false

func load_world() -> void:
	story_token+=1
	story_active=false
	detach_player()
	if is_instance_valid(player) and (trial_active or player.use_performance):
		player.free()
		player=null
	if is_instance_valid(world):
		remove_child(world)
		world.free()
	Figure.materials.clear()
	Figure.meshes.clear()
	Session.chapter = Campaign.definition(Session.data.zone)
	if trial_active:
		world=TrialWorld.new()
		world.passage=TrialPassage.new(trial_stage)
	else:
		var scene = ResourceLoader.load(Campaign.zone(Session.data.zone).scene,"PackedScene",ResourceLoader.CACHE_MODE_REUSE)
		world = scene.instantiate()
	world.ui = ui
	ui.world = world
	add_child(world)

func install_zone(scene: PackedScene, zone_id: String, effect: String, low_memory: bool) -> bool:
	if scene == null or Campaign.definition(zone_id).is_empty(): return false
	detach_player()
	var previous = world
	world = null
	ui.world = null
	if low_memory and is_instance_valid(previous):
		var release_start=Time.get_ticks_usec()
		var released=weakref(previous)
		previous.free()
		Figure.materials.clear()
		Figure.meshes.clear()
		await get_tree().process_frame
		if closing: return false
		previous = null
		last_install_metrics={"old_zone_release_frame_ms":(Time.get_ticks_usec()-release_start)/1000.0,"old_zone_freed_before_construct":released.get_ref()==null}
	else: last_install_metrics={"old_zone_release_frame_ms":0.0}
	Figure.materials.clear()
	Figure.meshes.clear()
	Session.apply_arrival(zone_id,effect)
	var instantiate_start=Time.get_ticks_usec()
	var instance=scene.instantiate()
	if not instance is ChapterWorld:
		instance.free()
		return false
	world=instance
	last_install_metrics["instantiate_ms"]=(Time.get_ticks_usec()-instantiate_start)/1000.0
	if world == null: return false
	world.ui = ui
	ui.world = world
	var activate_start=Time.get_ticks_usec()
	add_child(world)
	last_install_metrics["ready_geometry_and_scripts_ms"]=(Time.get_ticks_usec()-activate_start)/1000.0
	if is_instance_valid(previous): previous.queue_free()
	await get_tree().process_frame
	if closing: return false
	if not is_instance_valid(world.hero): return false
	Session.save()
	return true

func start_game(fresh: bool) -> void:
	trial_active=false
	Session.return_to_main_save()
	transitions.cancel()
	Session.begin(fresh)
	load_world()
	ui.play()
	ui.announce(Session.chapter.title.to_upper())
	if not Session.save_warning.is_empty(): ui.toast(Session.save_warning,8)

func replay_chapter(id: String) -> void:
	trial_active=false
	Session.begin_replay(id)
	load_world()
	ui.play()
	ui.toast("Chapter replay uses separate saves. Your campaign Continue is preserved.",6)

func travel(id: String, effect: String = "") -> bool:
	return transitions.request(id,effect)

func begin_story_death() -> void:
	story_active=true
	story_token+=1
	var token=story_token
	player.model.freeze("transition")
	player.model.story_fall=true
	player.yaw.rotation.y=2.2
	ui.show_story_death()
	get_tree().create_timer(1.1,false).timeout.connect(func(): finish_story_death(token),CONNECT_ONE_SHOT)

func finish_story_death(token: int) -> void:
	if token!=story_token or closing or not story_active: return
	story_active=false
	story_token+=1
	get_tree().paused=false
	travel("zone_counting_shore","story_death")

func practice_after_defeat() -> void:
	if not trial_active or ui.mode != "trial_result" or world.won: return
	start_trial(trial_stage, false, journey, duel_replay)
	world.begin_arrival()
	world.arrival.from_retry = true
	world.arrival.resume_lesson(TrialArrival.Step.READY)
	world.arrival.begin_sparring()

func finish_retry_practice(court_id: int) -> void:
	if not is_instance_valid(world) or world.get_instance_id() != court_id or ui.mode not in ["play", "journal"]: return
	restart_checkpoint()

func restart_checkpoint() -> void:
	if trial_active:
		if journey and Session.shore.milestone == ShoreProgress.OPEN_GATE: continue_shore()
		else: start_trial(trial_stage, false, journey, duel_replay)
		return
	if transitions.state == "loading": return
	transitions.reset()
	Session.data.health = Session.data.max_health
	Session.data.heals = Session.data.max_heals
	Session.data.resolve = 3.0
	Session.save()
	load_world()
	ui.play()
	ui.toast("Restored at "+Session.data.checkpoint.trim_prefix("cp_").replace("_"," "))

func _notification(what: int) -> void:
	if closing: return
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if Session.running and is_instance_valid(world): world.save_current()
		finish()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		Preferences.release_input()
		if ui != null and ui.mode == "play" and not Session.validation: ui.show_pause()

func finish(code: int = 0) -> void:
	if closing: return
	print("EXIT requested: ",code," mode=",ui.mode)
	if Session.validation: print_stack()
	closing = true
	Sound.stop_playback()
	if benchmark!=null and benchmark.recording: benchmark.stop()
	get_tree().paused = false
	Session.running = false
	Preferences.release_input()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	transitions.cancel()
	await transitions.drain_for_shutdown()
	ui.world = null
	if is_instance_valid(world): world.queue_free()
	if is_instance_valid(player) and player.get_parent() == self: player.queue_free()
	world = null
	await get_tree().process_frame
	await get_tree().process_frame
	if code == 0 and OS.has_feature("web"):
		var browser := JavaScriptBridge.get_interface("window")
		if browser != null:
			browser.dispatchEvent(JavaScriptBridge.create_object("Event", "ashen-vow-quit"))
	get_tree().quit(code)

func continue_shore() -> void:
	var mark := Session.shore.milestone
	if mark == ShoreProgress.DAWN:
		if not world is TrialWorld or world.passage.stage != TrialPassage.WARDEN:
			start_trial(TrialPassage.WARDEN, false, true)
		ui.show_dawn()
	elif mark == ShoreProgress.OPEN_GATE:
		trained_on_shore = Session.shore.rehearsed
		start_trial(TrialPassage.WARDEN, false, true)
		world.resume_open_gate()
	elif mark >= ShoreProgress.FIRST_ECHO:
		trained_on_shore = Session.shore.rehearsed
		start_trial(mark - ShoreProgress.FIRST_ECHO, false, true)
		ui.toast("Checkpoint · " + Session.shore.label() + ". Health and draughts restored.", 4)
	elif mark >= ShoreProgress.SHORE:
		start_trial(0, false, true)
		world.begin_arrival()
		world.arrival.resume_lesson(mark - ShoreProgress.SHORE)
		ui.play()
	else: start_trial()

func accept_shore() -> void:
	Session.shore.remember(ShoreProgress.SHORE, false, true)
	ui.play()
	if not Session.shore.last_error.is_empty(): ui.toast(Session.shore.last_error, 6)

func remember_lesson(step: int) -> void:
	if not journey: return
	Session.shore.remember(ShoreProgress.SHORE + step, step == TrialArrival.Step.READY)
	if not Session.shore.last_error.is_empty(): ui.toast(Session.shore.last_error, 6)

func remember_victory(stage: int) -> void:
	if journey:
		Session.shore.remember(ShoreProgress.FIRST_ECHO + stage + 1, trained_on_shore)

func start_first_echo(court_id: int, trained: bool) -> void:
	if not is_instance_valid(world) or world.get_instance_id() != court_id or ui.mode not in ["play", "journal"]: return
	trained_on_shore = trained
	if journey: Session.shore.remember(ShoreProgress.FIRST_ECHO, trained)
	enter_next_echo(0)

func enter_next_echo(stage: int) -> void:
	trial_stage = stage
	world.enter_encounter(stage, trained_on_shore)
	ui.play()
	ui.announce(world.passage.entry().name)
	if stage == 0: ui.toast("The echo lifts its blade. Let the first cut pass, then answer.", 4)
	else: ui.toast(world.passage.entry().voice, 5)

func start_duel_replay(stage: int) -> void:
	if Session.shore.milestone == ShoreProgress.DAWN and stage >= 0 and stage <= TrialPassage.WARDEN:
		start_trial(stage, false, false, true)

func start_trial(stage: int=0, briefing: bool=true, keep_journey: bool=false, replay: bool=false) -> void:
	transitions.cancel()
	duel_replay = replay
	trial_active=true
	trial_stage=clampi(stage,0,TrialPassage.WARDEN)
	journey = keep_journey or (trial_stage == 0 and briefing)
	if not keep_journey: trained_on_shore = false
	Session.begin_trial()
	load_world()
	if trial_stage == 0 and briefing: world.begin_arrival()
	elif trained_on_shore or trial_stage > 0 or duel_replay:
		if trial_stage == 0: world.passage.learn("rehearsal")
		world.hero.target = world.warden
	ui.play()
	if briefing: ui.show_trial_briefing()
	else: ui.announce(world.passage.entry().chapter)
