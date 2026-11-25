extends Node

var main: Node
var checks: int=0
var failures: int=0

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)

func seconds(value: float) -> void:
	for i in int(ceil(value*Engine.physics_ticks_per_second)): await get_tree().physics_frame

func test_defensive_counts() -> void:
	main.start_trial(TrialPassage.WARDEN, false)
	var world: TrialWorld = main.world
	var hero := world.hero
	var boss := world.warden
	boss.ai_enabled = false
	hero.use_test_direction = true
	hero.position = Vector3(0, .05, 0)
	boss.position = Vector3(0, .05, -1.55)
	boss.face(hero.position)
	await seconds(.5)
	Input.action_press("guard")
	await seconds(.5)
	boss.try_attack("light")
	await seconds(2)
	Input.action_release("guard")
	check(world.duel.guards == 1 and world.duel.parries == 0 and hero.model.health == hero.model.max_health, "An ordinary held guard records the actual blocked blade")
	hero.position = Vector3(0, .05, 0)
	boss.position = Vector3(0, .05, -1.55)
	boss.face(hero.position)
	await seconds(.5)
	boss.try_attack("heavy")
	while boss.model.state == "attack" and boss.model.elapsed < float(boss.model.attack.windup) - .18:
		await get_tree().physics_frame
	hero.test_direction = Vector3.RIGHT
	hero.try_dodge()
	hero.test_direction = Vector3.ZERO
	await seconds(2.2)
	check(world.duel.evades == 1 and hero.model.health == hero.model.max_health, "Clearing a raised blade with a side roll earns one evade")
	hero.try_dodge()
	await seconds(1)
	check(world.duel.evades == 1, "Rolling with no incoming cut earns no extra evades")

func run() -> void:
	if "--duel-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	var campaign=Session.loaded.duplicate(true)
	await test_defensive_counts()
	main.start_trial(TrialPassage.WARDEN,false)
	var world: TrialWorld=main.world
	var hero: Fighter=world.hero
	var boss: Fighter=world.warden
	hero.use_test_direction=true
	boss.ai_enabled=false
	hero.position=Vector3(0,.05,0); hero.rotation.y=0
	boss.position=Vector3(0,.05,-1.55); boss.rotation.y=PI
	await seconds(.3)
	var denials={"count":0,"last":""}
	var on_denial=func(message: String): denials.count+=1; denials.last=message
	hero.feedback.connect(on_denial)
	hero.model.stamina=0
	check(not hero.try_dodge() and not hero.try_dodge() and denials.count==1,"Unavailable dodges explain stamina without flooding feedback")
	hero.denial_cooldown=0; Session.data.heals=0
	check(not hero.try_heal() and "draughts" in denials.last,"Empty healing stock has an explicit reason")
	hero.denial_cooldown=0; Session.data.heals=3
	check(not hero.try_heal() and Session.data.heals==3 and "full" in denials.last,"Full-health drinking does not spend a draught")
	hero.denial_cooldown=0
	check(not hero.try_ashstep() and "story campaign" in denials.last,"Trial controls explain why the campaign ability is unavailable")
	check(not "Ashstep" in Preferences.trial_help_text(),"Trial guide advertises only the duel's available actions")
	hero.feedback.disconnect(on_denial); hero.denial_cooldown=0; hero.model.stamina=100
	check(boss.model.config.attacks.heavy.blockable==false and boss.model.config.attacks.heavy.parryable,"Cleave has explicit evade/parry counterplay")
	check(hero.model.config.attacks.heavy.blockable and CombatModel.definitions().attacks.heavy.blockable,"Warden rules do not mutate player or campaign rules")
	var defense=CombatModel.new(); PerformanceMotion.configure(defense)
	defense.guard(true)
	check(defense.receive(10)=="parry","A fresh guard press can parry")
	defense.guard(false); defense.tick(.06); defense.guard(true)
	check(defense.receive(10)=="guard","Rapid guard tapping cannot continually restart the parry window")
	defense.guard(false); defense.tick(.4); defense.guard(true)
	check(defense.receive(10)=="parry","A deliberate new guard press rearms after recovery")
	defense.tick(.3); defense.stamina=0; defense.posture=90
	check(defense.receive(10)=="hit" and defense.last_guard_broken and defense.elapsed<0,"Exhausted blocking produces an explicit guard-break recovery")
	check(defense.posture<=45,"A broken guard does not retain permanent full strain")
	defense.state="guard"; defense.elapsed=1
	defense.receive(10,true,false,{"blockable":false})
	check(not defense.last_guard_broken,"An unblockable attack is distinct from an exhausted guard")
	hero.model.state="hit"; hero.model.elapsed=-.4
	Input.action_press("guard")
	await seconds(.2)
	hero.model.state="idle"; hero.model.elapsed=0
	await seconds(.05)
	check(hero.model.state=="guard" and not hero.model.parry_armed,"Holding guard through a stagger blocks without granting a fresh parry")
	Input.action_release("guard")
	await seconds(.4)
	hero.model.state="hit"; hero.model.elapsed=float(hero.model.config.get("hit_duration",.38))-.08
	Input.action_press("guard")
	await seconds(.12)
	check(hero.model.state=="guard" and hero.model.parry_armed,"A recent guard press buffers across the last instant of recovery")
	Input.action_release("guard")
	await seconds(.4)
	hero.impact_pause=.07
	Input.action_press("guard")
	await seconds(.16)
	check(hero.model.state=="guard" and hero.model.parry_armed,"Hit stop preserves a newly pressed defensive input")
	Input.action_release("guard")
	await seconds(.4)
	for actor in [hero,boss]:
		var attack: Dictionary=actor.model.config.attacks.trial_riposte
		check(absf(float(attack.rate)*(attack.windup+attack.active+attack.recovery)-1.733333)<.001,"Riposte pose/damage clocks agree: "+("hero" if actor.player else "boss"))
	for i in 3:
		hero.model.guard(true)
		boss.model.state="attack"; boss.model.attack=boss.model.config.attacks.light
		check(hero.take_damage(14,boss)=="parry","Successful defensive timing builds pressure")
		await seconds(.55) # Includes the parry's frozen hit-stop ticks.
	check(world.duel.parries==3 and world.duel.breaks==1,"Three parries produce one composure break")
	check(boss.model.state=="hit" and world.duel.can_riposte(),"Break creates a nearby punish window")
	check(boss.model.health==340,"Composure pressure does not secretly damage health")
	var breaks_before=world.duel.breaks
	world.duel.pressure(100)
	check(world.duel.breaks==breaks_before,"Break cooldown prevents immediate repeat staggering")
	hero.model.stamina=0
	check(not hero.try_attack("heavy") and world.duel.riposte_window>0,"An unaffordable riposte does not consume the opening")
	hero.model.stamina=100
	check(hero.try_attack("heavy") and hero.model.attack_id=="trial_riposte","Heavy input uses the earned riposte")
	check(world.duel.riposte_window==0 and world.duel.ripostes==1,"Accepted riposte consumes the opening once")
	check(boss.model.health==340,"Starting the riposte is not automatic damage")
	await seconds(1.05)
	check(absf(boss.model.health-274)<.01,"Riposte damage requires a real blade contact")
	check(world.duel.hits==1,"Round statistics count landed blade contacts")
	await seconds(1)
	hero.intent.action="light"; hero.intent.remaining=.45
	hero.model.state="idle"
	hero.take_damage(1,boss)
	check(hero.intent.action.is_empty(),"A stagger clears previously queued attacks")
	hero.model.state="idle"
	hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO
	boss.position=Vector3(0,.05,-1.55); boss.model.state="idle"; boss.model.health=340
	hero.model.stamina=100; hero.impact_pause=0; boss.impact_pause=0
	await seconds(.3)
	hero.model.start_attack("trial_finish")
	await seconds(.6)
	hero.test_direction=Vector3.LEFT; hero.queue_intent("dodge")
	await seconds(.15)
	check(hero.model.state=="attack","A queued escape cannot cancel the finisher's second cut")
	await seconds(.45)
	check(hero.model.state=="dodge","Dodge can leave the finisher's long recovery after both cuts")
	check(absf(boss.model.health-292)<.01,"Recovery escape preserves both actual finisher contacts")
	hero.test_direction=Vector3.ZERO
	await seconds(1)
	world.duel.break_cooldown=0
	world.duel.pressure(100)
	hero.position=Vector3(0,.05,6)
	check(not world.duel.can_riposte(),"An opening never teleports a distant attacker into range")
	world.duel.tick(2)
	check(world.duel.riposte_window==0,"Unused openings expire")
	world.duel.composure=50; world.duel.composure_delay=1
	world.duel.tick(.5)
	check(world.duel.composure==50,"Pressure persists briefly between deliberate attacks")
	world.duel.tick(1)
	check(world.duel.composure<50 and world.duel.composure>=0,"Composure recovers after disengaging")
	main.ui.show_pause()
	var paused_time=world.duel.elapsed
	await seconds(.4)
	check(world.duel.elapsed==paused_time,"Pause freezes duel timing and openings")
	main.ui.play()
	await seconds(.1)
	check(world.duel.elapsed>paused_time,"Duel timing resumes after pause")
	check(not world.boss_panel.get_global_rect().intersects(main.ui.tutorial.get_global_rect()),"Composure HUD leaves the controls unobstructed")
	main.ui.show_trial_guide()
	await seconds(.1)
	var within=true
	for panel in main.ui.overlay.find_children("*","PanelContainer",true,false): within=within and panel.get_global_rect().end.y<=720
	check(within,"Trial guide fits the reference viewport")
	main.ui.play()
	await seconds(.4)
	hero.model.state="idle"; hero.target=null
	hero.position=Vector3(0,.05,0); boss.position=Vector3(0,.05,-1.55)
	boss.model.state="idle"
	var mouse=InputEventMouseMotion.new()
	mouse.relative=Vector2(3,0); mouse.screen_relative=Vector2(12,0)
	hero.yaw.rotation.y=0; hero.apply_mouse_motion(mouse)
	var first_yaw=hero.yaw.rotation.y
	mouse.relative=Vector2(80,0)
	hero.yaw.rotation.y=0; hero.apply_mouse_motion(mouse)
	check(absf(first_yaw-hero.yaw.rotation.y)<.00001 and absf(first_yaw+12*Preferences.sensitivity)<.00001,"Mouse look uses physical motion independently of viewport scaling")
	hero.yaw.rotation.y=0
	Input.action_press("look_right")
	for i in 120: hero.trial_camera._process(1.0/120)
	var fine_yaw=hero.yaw.rotation.y
	hero.yaw.rotation.y=0
	for i in 30: hero.trial_camera._process(1.0/30)
	Input.action_release("look_right")
	check(absf(fine_yaw-hero.yaw.rotation.y)<.0001 and absf(fine_yaw+2.4)<.001,"Controller orbit integrates consistently at 30 and 120 render steps")
	hero.target=boss
	hero.trial_camera.orbit(100,100)
	check(absf(hero.trial_camera.manual_offset)<=.381 and hero.pitch.rotation.x<=.281,"Manual locked orbit and camera elevation remain bounded")
	await seconds(2.6)
	check(absf(hero.trial_camera.manual_offset)<.01,"Lock framing returns smoothly after manual orbit ends")
	hero.pitch.rotation.x=-.24
	await seconds(.18)
	var hero_screen: Vector2 = hero.camera.unproject_position(hero.global_position + Vector3.UP * 1.3)
	var boss_screen: Vector2 = hero.camera.unproject_position(boss.global_position + Vector3.UP * 1.3)
	var viewport_width := get_viewport().get_visible_rect().size.x
	check(absf(boss_screen.x-hero_screen.x) > viewport_width*.03 and hero.pitch.rotation.y > .4, "Lock-on shows both torsos separately at sword range")
	var walk_forward: Vector3 = -hero.yaw.global_basis.z
	check(walk_forward.dot(hero.global_position.direction_to(boss.global_position)) > .97, "Over-shoulder framing preserves forward movement toward the opponent")
	var screen=world.solid_box(Vector3(4,3,.2),Vector3(0,1,-.75),Color.BLACK,false)
	await seconds(.2)
	check(hero.target==boss,"Brief occlusion does not drop an established lock")
	screen.free()
	await seconds(.15)
	screen=world.solid_box(Vector3(4,3,.2),Vector3(0,1,-.75),Color.BLACK,false)
	await seconds(.45)
	check(not is_instance_valid(hero.target),"Sustained occlusion releases lock ownership")
	screen.free()
	hero.trial_camera.set_process(false)
	hero.yaw.rotation.y=0; hero.target=boss
	boss.global_position=hero.camera.global_position+hero.camera.global_basis.z*4-Vector3.UP*1.25
	boss.reset_physics_interpolation()
	await seconds(.05)
	main.ui.update_hud(hero,{})
	check(not main.ui.lock_marker.visible,"Targets behind the camera do not project a false on-screen lock marker")
	hero.trial_camera.set_process(true)
	boss.position=Vector3(0,.05,-1.55); boss.reset_physics_interpolation()
	main.start_trial(TrialPassage.WARDEN,false)
	world=main.world; hero=world.hero; boss=world.warden
	hero.use_test_direction=true; hero.model.max_health=5000; hero.model.health=5000
	hero.position=Vector3(0,.05,2); boss.position=Vector3(0,.05,-2)
	world.solid_box(Vector3(3,3,.25),Vector3(0,1,0),Color.BLACK,false)
	var widest=0.0
	for i in int(10*Engine.physics_ticks_per_second):
		await get_tree().physics_frame
		widest=maxf(widest,absf(boss.position.x))
		if "--duel-nav-trace" in OS.get_cmdline_user_args() and i%int(Engine.physics_ticks_per_second)==0:
			print("NAV ",i," position=",boss.position," velocity=",boss.velocity)
	print("NAV RESULT widest=",widest," boss=",boss.position," damage=",5000-hero.model.health)
	check(widest>1.65,"Warden steers its body around a blocking wall")
	check(hero.model.health<5000 and boss.weapon_sweep.contacts>0,"Warden can re-engage after losing direct line of sight")
	# A mutual fall is resolved once after both death notifications.
	var damage_before=world.duel.damage_taken
	hero.model.health=1; hero.model.state="idle"
	hero.take_damage(10,boss)
	check(absf(world.duel.damage_taken-damage_before-1)<.001,"Round statistics include lethal damage capped to the remaining health")
	boss.model.health=0; boss.model.state="dead"
	world.queue_outcome(); world.queue_outcome()
	await seconds(3)
	check(not world.won and main.ui.mode=="trial_result","A simultaneous fall cannot award a surviving-player victory")
	var final_time=world.duel.elapsed
	await seconds(.2)
	check(world.duel.elapsed==final_time,"Results freeze round statistics")
	main.restart_checkpoint()
	await seconds(.1)
	check(main.world.duel.hits==0 and main.world.duel.parries==0 and main.world.duel.breaks==0,"A rematch resets all duel progress")
	main.ui.show_menu()
	check(Session.loaded==campaign,"Duel outcomes preserve campaign Continue")
	print("RESULT: %d/%d duel behavior checks passed; %d physics ticks" % [checks-failures,checks,Engine.physics_ticks_per_second])
	main.finish(1 if failures else 0)
