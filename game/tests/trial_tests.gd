extends Node

var main: Node
var checks: int=0
var failures: int=0

func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)

func _ready() -> void: call_deferred("run")

func frames(count: int) -> void:
	for i in maxi(1,int(ceil(count*Engine.physics_ticks_per_second/60.0))): await get_tree().physics_frame

func run() -> void:
	if "--trial-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	var original_store=Session.store
	var original_loaded=Session.loaded.duplicate(true)
	var legacy_attack=CombatModel.definitions().attacks.light.duplicate(true)
	main.start_trial()
	var world: TrialWorld=main.world
	var hero: Fighter=world.hero
	world.warden.ai_enabled=false
	hero.use_test_direction=true
	await frames(20)
	check(world is TrialWorld and hero.figure is PerformanceFigure,"Trial loads authored characters")
	check(Session.store!=original_store and Session.replay,"Trial uses isolated persistence")
	check(CombatModel.definitions().attacks.light==legacy_attack,"Trial timing leaves campaign combat definitions intact")
	check(hero.figure.motion_scale>.9 and hero.figure.motion_scale<1.2,"Root curves scale to target skeleton proportions")
	# Check the actual held blade, rather than only the combat clock. An axis
	# error in the socket can pass damage tests while every cut points backwards.
	for id in ["light","trial_second","trial_finish","heavy"]:
		var attack: Dictionary=hero.model.config.attacks[id]
		var windows: Array=attack.get("hit_windows",[[attack.windup,attack.windup+attack.active]])
		var aligned=true
		for window in windows:
			var crossing=false
			for step in 20:
				var time=lerpf(window[0],window[1],step/20.0)
				var figure: PerformanceFigure=hero.figure
				figure.sample_pose(attack.clip,time,figure.rotations,figure.positions)
				figure.apply_pose()
				var hand=figure.body_skeleton.get_bone_global_pose(figure.hand_index)
				var tip=hero.to_local(figure.body_skeleton.to_global(hand*(figure.weapon.transform*Vector3(0,-1,0))))
				crossing=crossing or (tip.z<-.65 and absf(tip.x)<.75 and tip.y>.25 and tip.y<1.85)
			aligned=aligned and crossing
		check(aligned,"Blade crosses the target during every damage window: "+id)
	var finisher=CombatModel.new()
	PerformanceMotion.configure(finisher)
	finisher.start_attack("trial_finish")
	finisher.elapsed=.2
	check(finisher.claim_hit(1) and not finisher.claim_hit(1),"Finisher first cut hits once")
	finisher.elapsed=.4
	var gap_safe=not finisher.active() and not finisher.claim_hit(1)
	finisher.elapsed=.67
	check(gap_safe and finisher.claim_hit(1) and not finisher.claim_hit(1),"Finisher second cut re-arms after an inactive gap")
	hero.combo_index=1; hero.light_memory=1; hero.model.stamina=0
	check(not hero.try_attack("light") and hero.combo_index==1,"Rejected attack does not skip a combo stage")
	hero.combo_index=0; hero.light_memory=0; hero.model.stamina=100
	for actor in [hero,world.warden]:
		var figure: PerformanceFigure=actor.figure
		check(figure.body_skeleton.get_bone_count()==65,"65-bone retarget: "+figure.role)
		check(figure.library.get_animation_list().size()==45,"45 authored clips: "+figure.role)
		check(figure.library.get_animation("Jog_Fwd").loop_mode==Animation.LOOP_LINEAR,"Locomotion loops: "+figure.role)
		check(figure.library.get_animation("Sword_Idle").loop_mode==Animation.LOOP_LINEAR,"Ready stance breathes continuously: "+figure.role)
		var finite=true
		for clip in figure.library.get_animation_list():
			var animation=figure.library.get_animation(clip)
			figure.sample_pose(clip,animation.length*.53,figure.rotations,figure.positions)
			figure.apply_pose()
			for bone in figure.body_skeleton.get_bone_count():
				var pose=figure.body_skeleton.get_bone_global_pose(bone)
				finite=finite and pose.origin.is_finite() and pose.basis.is_finite() and absf(pose.basis.determinant()-1)<.01
		check(finite,"All retargeted clips produce finite orthonormal bones: "+figure.role)
	hero.target=null
	hero.test_direction=Vector3.RIGHT
	var before=hero.position
	await frames(50)
	check(hero.position.distance_to(before)>1,"Authored locomotion moves through physics")
	check(hero.figure.locomotion_phase>0 and hero.figure.locomotion_weight>.8,"Distance-driven gait is active")
	check(hero.figure.contact_solver.contact_count>0,"Imported feet generate floor contacts")
	check(hero.figure.contact_solver.max_correction<=.221,"Foot correction remains bounded")
	hero.test_direction=Vector3.ZERO
	await frames(30)
	check(Vector2(hero.velocity.x,hero.velocity.z).length()<.01,"Movement decelerates to rest")
	hero.position=Vector3(0,.05,0)
	world.warden.position=Vector3(0,.05,-1.6)
	hero.rotation.y=0
	hero.model.stamina=100
	check(hero.try_attack("light"),"Authored first sword attack begins")
	await frames(19)
	check(world.warden.model.health<world.warden.model.max_health,"Sword strike deals damage during active window")
	check(hero.model.damage_events==1,"One damage event per swing")
	hero.queue_intent("light")
	await frames(15)
	check(hero.model.attack_id=="trial_second","Recovery input chains into authored second strike")
	check(hero.figure.current_clip=="Sword_Regular_B","Combo uses distinct authored motion")
	await frames(150)
	hero.model.state="idle"; hero.model.stamina=100
	hero.position=Vector3(0,.05,0)
	world.warden.position=Vector3(0,.05,-7)
	hero.test_direction=Vector3.LEFT
	check(hero.try_dodge(),"Directional roll begins")
	check(hero.model.config.dodge_clip=="Dodge_Left","Lateral evasion selects its authored sidestep")
	var roll_start=hero.position
	await frames(60)
	hero.test_direction=Vector3.ZERO
	check(hero.position.x<roll_start.x-1.5,"Authored root curve drives directional roll")
	check(hero.model.state=="idle","Roll returns to locomotion")
	hero.model.stamina=100
	hero.test_direction=-hero.global_basis.z
	hero.try_dodge()
	check(hero.model.config.dodge_clip=="Roll","Forward evasion selects authored roll")
	hero.test_direction=Vector3.ZERO
	await frames(60)
	# Test collision-constrained attack motion against an actual wall.
	hero.model.state="idle"; hero.model.stamina=100
	hero.position=Vector3(0,.05,0); hero.rotation.y=0
	world.solid_box(Vector3(4,3,.2),Vector3(0,1,-.6),Color.BLACK,false)
	hero.try_attack("heavy")
	await frames(80)
	check(hero.position.z>-.36,"Authored root movement respects walls")
	hero.model.state="idle"; hero.model.health=40
	check(hero.try_heal(),"Draught begins")
	await frames(60)
	check(hero.model.state=="heal" and hero.figure.current_clip=="Drink","Healing exposes the full authored drinking action")
	await frames(90)
	check(hero.model.state=="idle","Drink recovery completes")
	world.warden.model.state="idle"
	world.warden.model.health=160
	await frames(5)
	check(world.warden.phase==2,"Warden enters second phase")
	var fast_attack: Dictionary=world.warden.model.config.attacks.heavy
	check(absf(float(fast_attack.rate)*(float(fast_attack.windup)+float(fast_attack.active)+float(fast_attack.recovery))-1.733333)<.001,"Phase tempo keeps pose and damage clocks synchronized")
	world.warden.model.health=1
	hero.model.attack={"damage":20}
	world.warden.take_damage(20,hero)
	await frames(180)
	check(world.won and main.ui.mode=="trial_result","Defeat plays death animation then victory flow")
	main.restart_checkpoint()
	await frames(10)
	check(main.world!=world and main.world.warden.model.health==340,"Retry rebuilds a fresh duel")
	main.world.warden.ai_enabled=false
	main.world.hero.model.health=1
	main.world.warden.model.attack={"damage":200}
	main.world.hero.take_damage(200,main.world.warden)
	await frames(180)
	check(main.ui.mode=="trial_result" and not main.world.won,"Player defeat reaches retry flow")
	main.ui.show_menu()
	await frames(3)
	check(Session.store==original_store and not Session.replay,"Return restores campaign save store")
	check(Session.loaded==original_loaded,"Trial leaves campaign Continue unchanged")
	main.start_game(true)
	await frames(3)
	check(not main.trial_active and not main.player.use_performance,"Campaign restores its own actor pipeline")
	print("RESULT: %d/%d trial checks passed; headless, no rendered quality claim" % [checks-failures,checks])
	main.finish(1 if failures else 0)
