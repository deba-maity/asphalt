extends Node

# Real-time headless soak: bounded animation/FX allocations and repeated rematch
# teardown. Health refills are explicit stress fixtures, not a balance playtest.
var main: Node
var started: int
var last_report: int=0
var last_match: float=0
var next_action: float=0
var duration: float=10800
var matches: int=0
var actions: int=0
var baseline_nodes: int=0
var baseline_memory: int=0
var peak_memory: int=0
var failures: int=0
var records: Array=[]
var rng=RandomNumberGenerator.new()
var next_invariant: float=0
var pose_samples: int=0
var phase_two_samples: int=0
var advancing_swings: int=0
var last_serials: Dictionary={}
var failure_reasons: Array[String]=[]
var next_pause: float=45
var idle_until: float=0
var idle_clocks: Vector2
var idle_checks: int=0
var training_samples: int=0
var passage_calls := 0
var dawn_crossings := 0
var checkpoint_resumes := 0
var between_since := -1.0
var previous_stage := 0

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	rng.seed=85171
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--endurance-seconds="): duration=float(arg.split("=")[1])
	started=Time.get_ticks_msec()
	start_journey()
	print("ENDURANCE START duration=",duration," seconds; headless real-time stress fixture")

func _process(delta: float) -> void:
	var elapsed=(Time.get_ticks_msec()-started)/1000.0
	var hero: Fighter=main.player
	var boss: Fighter=main.world.warden
	if idle_until>0:
		if not is_equal_approx(hero.figure.cape.clock,idle_clocks.x) or not is_equal_approx(boss.figure.cape.clock,idle_clocks.y):
			failures+=1; failure_reasons.append("Scene animated during an idle budget")
		if elapsed<idle_until: return
		idle_until=0; idle_checks+=1; main.budget.focused=true
		main.ui.play(); main.budget.update_policy()
	if elapsed >= next_pause and main.ui.mode == "play" and not main.world.duel.finished and between_since < 0:
		next_pause=elapsed+45; idle_until=elapsed+2
		main.ui.show_pause(); main.budget.focused=matches%2==0; main.budget.update_policy()
		idle_clocks=Vector2(hero.figure.cape.clock,boss.figure.cape.clock)
		return
	if main.ui.mode == "dawn" or main.ui.mode == "trial_result" or main.world.duel.finished or between_since >= 0:
		progress_passage(elapsed)
		return
	if elapsed - last_match > 120:
		# Script the final blow after two minutes of live combat, then reach the
		# next encounter with ordinary walking and interaction.
		boss.model.health = 0
		boss.model.state = "dead"
		boss.slain.emit(boss)
		between_since = elapsed
		return
	hero.model.health=maxf(hero.model.health,70)
	boss.model.health=maxf(boss.model.health,boss.model.max_health*.3)
	hero.model.stamina=maxf(hero.model.stamina,50)
	var diff=boss.position-hero.position; diff.y=0
	hero.test_direction=diff.normalized() if diff.length()>2.3 else Vector3(-diff.z,0,diff.x).normalized()*.7
	if hero.position.length()>9: hero.test_direction=-hero.position.normalized()
	next_action-=delta
	if next_action<=0:
		next_action=rng.randf_range(.2,.6)
		Input.action_release("guard")
		Input.action_release("sprint")
		var choice=rng.randi_range(0,7)
		if choice<3: hero.queue_intent("light")
		elif choice==3: hero.queue_intent("heavy")
		elif choice==4: hero.queue_intent("dodge")
		elif choice==5: Input.action_press("guard")
		elif choice==6:
			hero.model.health=50; Session.data.heals=3; hero.queue_intent("heal")
		else:
			hero.test_direction=diff.normalized()
			Input.action_press("sprint"); hero.queue_intent("heavy")
		actions+=1
	next_invariant-=delta
	if next_invariant<=0:
		next_invariant=.25
		inspect_actor(hero); inspect_actor(boss)
		if boss.phase==2: phase_two_samples+=1
		if main.world.passage.training(): training_samples+=1
		if failures>0:
			Input.action_release("guard"); Input.action_release("sprint")
			write_report(elapsed,false); set_process(false); main.finish(1); return
	if int(elapsed)/60>last_report:
		last_report=int(elapsed)/60
		var nodes=int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
		var memory=int(Performance.get_monitor(Performance.MEMORY_STATIC))
		peak_memory=maxi(peak_memory,memory)
		if baseline_nodes==0 and elapsed>=180:
			baseline_nodes=nodes; baseline_memory=memory
		if baseline_nodes>0 and (nodes>baseline_nodes+12 or memory>baseline_memory+64*1024*1024):
			failures += 1
			failure_reasons.append("Court resources grew from %d nodes / %d bytes to %d nodes / %d bytes" % [baseline_nodes, baseline_memory, nodes, memory])
		var record={"seconds":elapsed,"matches":matches,"actions":actions,"nodes":nodes,"memory":memory,"failures":failures,"pose_samples":pose_samples,"phase_two_samples":phase_two_samples,"advancing_swings":advancing_swings,"idle_checks":idle_checks,"training_samples":training_samples,"passage_calls":passage_calls,"dawn_crossings":dawn_crossings,"checkpoint_resumes":checkpoint_resumes}
		records.append(record)
		print("ENDURANCE ",JSON.stringify(record))
		write_report(elapsed,false)
	if elapsed>=duration:
		Input.action_release("guard")
		Input.action_release("sprint")
		write_report(elapsed,true)
		print("RESULT: endurance complete seconds=",elapsed," matches=",matches," actions=",actions," failures=",failures)
		set_process(false)
		main.finish(1 if failures else 0)

func start_journey() -> void:
	Session.shore.remember(ShoreProgress.FIRST_ECHO, false, true)
	main.start_trial(0, false, true)
	main.player.use_test_direction = true

func progress_passage(elapsed: float) -> void:
	Input.action_release("guard")
	Input.action_release("sprint")
	if between_since < 0: between_since = elapsed
	if main.ui.mode == "dawn":
		dawn_crossings += 1
		start_journey()
	elif main.ui.mode == "trial_result":
		main.restart_checkpoint()
	elif main.trial_stage != previous_stage:
		passage_calls += 1
		if passage_calls % 4 == 2:
			# A fresh reader exercises a real saved file between fights.
			Session.shore.restore()
			main.ui.show_menu()
			main.continue_shore()
			checkpoint_resumes += 1
	elif elapsed - between_since > 22:
		failures += 1
		if failure_reasons.size() < 8:
			var court: TrialWorld = main.world
			var destination := str(court.passage_target()) if court.waystone != null else "waiting for passage"
			failure_reasons.append("Stage %d: player %s, target %s, mode %s" % [main.trial_stage, court.hero.position, destination, main.ui.mode])
		start_journey()
	else:
		var court: TrialWorld = main.world
		if court.waystone != null:
			var travel := court.passage_target() - court.hero.global_position
			travel.y = 0
			court.hero.test_direction = travel.normalized()
			if court.near_waystone(): court.interact()
		return
	main.player.use_test_direction = true
	main.player.test_direction = Vector3.ZERO
	previous_stage = main.trial_stage
	between_since = -1.0
	last_match = elapsed
	matches += 1
	last_serials.clear()

func inspect_actor(actor: Fighter) -> void:
	pose_samples+=1
	var valid=actor.position.is_finite() and actor.velocity.is_finite()
	valid=valid and is_finite(actor.model.health) and is_finite(actor.model.stamina) and is_finite(actor.model.elapsed)
	valid=valid and actor.model.stamina>=0 and actor.model.stamina<=100.001 and actor.model.health<=actor.model.max_health
	var rig=actor.figure.body_skeleton
	for bone in rig.get_bone_count():
		var pose=rig.get_bone_global_pose(bone)
		valid=valid and pose.origin.is_finite() and pose.origin.length()<4 and pose.basis.is_finite() and absf(pose.basis.determinant()-1)<.01
	for point in actor.figure.cape.current:
		valid=valid and point.is_finite() and point.distance_to(actor.position)<4
	valid=valid and actor.figure.cape.current.size()==PerformanceCape.COUNT and actor.effects.particles.size()<=CombatEffects.CAPACITY
	if not valid:
		failures+=1
		if failure_reasons.size()<8: failure_reasons.append("Invalid pose, resource, cloth or effect bound: "+actor.figure.role)
	var id=actor.get_instance_id()
	if actor.model.state=="attack" and actor.model.swing_serial!=last_serials.get(id,-1):
		if actor.model.attack_id=="trial_dash": advancing_swings+=1
		last_serials[id]=actor.model.swing_serial

func write_report(elapsed: float, complete: bool) -> void:
	var file=FileAccess.open("user://endurance-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"complete":complete,"seconds":elapsed,"requested_seconds":duration,"matches":matches,"actions":actions,"failures":failures,"failure_reasons":failure_reasons,"peak_memory":peak_memory,"pose_samples":pose_samples,"phase_two_samples":phase_two_samples,"advancing_swings":advancing_swings,"idle_checks":idle_checks,"training_samples":training_samples,"passage_calls":passage_calls,"dawn_crossings":dawn_crossings,"checkpoint_resumes":checkpoint_resumes,"samples":records},"  "))
