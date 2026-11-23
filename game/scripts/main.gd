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

func restart_checkpoint() -> void:
	if trial_active:
		start_trial(trial_stage,false)
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

func start_first_echo(court_id: int, trained: bool) -> void:
	if not is_instance_valid(world) or world.get_instance_id() != court_id or ui.mode not in ["play", "journal"]: return
	start_trial(0, false)
	if trained:
		world.passage.learn("rehearsal")
		world.hero.target = world.warden
	ui.announce("THE FIRST ECHO")
	ui.toast("The echo lifts its blade. Let the first cut pass, then answer.", 4)

func start_trial(stage: int=0, briefing: bool=true) -> void:
	transitions.cancel()
	trial_active=true
	trial_stage=clampi(stage,0,TrialPassage.WARDEN)
	Session.begin_trial()
	load_world()
	if trial_stage == 0 and briefing: world.begin_arrival()
	ui.play()
	if briefing: ui.show_trial_briefing()
	else: ui.announce(world.passage.entry().chapter)
