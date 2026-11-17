extends Node

var main: Node
var checks: int=0
var failures: int=0

func _ready() -> void: call_deferred("run")
func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)
func frames(count: int) -> void:
	for i in count: await get_tree().physics_frame

func run() -> void:
	if "--motion-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	main.start_trial()
	var hero: Fighter=main.player
	main.world.warden.ai_enabled=false
	hero.use_test_direction=true
	await frames(10)
	var rig=hero.figure.body_skeleton
	check(get_tree().is_physics_interpolation_enabled(),"Physics transform interpolation enabled")
	check(rig.physics_interpolation_mode==Node.PHYSICS_INTERPOLATION_MODE_OFF,"Skeleton attachments avoid double interpolation")
	var skeleton=Skeleton3D.new(); add_child(skeleton); skeleton.add_bone("probe")
	var interp=PoseInterpolator.new()
	skeleton.set_bone_pose_position(0,Vector3.ZERO); interp.capture(skeleton)
	skeleton.set_bone_pose_position(0,Vector3(2,0,0)); skeleton.set_bone_pose_rotation(0,Quaternion(Vector3.UP,PI/2)); interp.capture(skeleton)
	interp.display(skeleton,.5)
	check(skeleton.get_bone_pose_position(0).is_equal_approx(Vector3(1,0,0)),"Render pose interpolates between physics ticks")
	check(skeleton.get_bone_pose_rotation(0).angle_to(Quaternion(Vector3.UP,PI/4))<.001,"Render rotation uses spherical interpolation")
	check(interp.current_pos[0]==Vector3(2,0,0),"Displaying a pose does not alter simulation snapshots")
	interp.freeze(); interp.display(skeleton,.1)
	check(skeleton.get_bone_pose_position(0)==Vector3(2,0,0),"Hit stop freezes both pose snapshots without interpolation jitter")
	interp.capture(skeleton,true); interp.display(skeleton,0)
	check(skeleton.get_bone_pose_position(0)==interp.current_pos[0],"Teleport resets pose interpolation history")
	skeleton.queue_free()
	var q=Quaternion(Vector3(1,2,3).normalized(),2.9)
	check(PoseTransition.exponential(PoseTransition.logarithm(q)).angle_to(q)<.001,"Quaternion log/exp preserves large rotations")
	check(PoseTransition.logarithm(-q).distance_to(PoseTransition.logarithm(q))<.001,"Quaternion sign changes take the same short path")
	var spring=PoseTransition.new()
	var old_rot: Array[Quaternion]=[Quaternion(Vector3.UP,.7)]
	var new_rot: Array[Quaternion]=[Quaternion.IDENTITY]
	var old_pos: Array[Vector3]=[Vector3(.1,.2,0)]
	var new_pos: Array[Vector3]=[Vector3.ZERO]
	var angular: Array[Vector3]=[Vector3(0,1.5,0)]
	var linear: Array[Vector3]=[Vector3(.3,0,0)]
	var zero: Array[Vector3]=[Vector3.ZERO]
	spring.begin(old_rot,old_pos,new_rot,new_pos,angular,linear,zero,zero,.18)
	spring.apply(.0001,new_rot,new_pos)
	check(new_rot[0].angle_to(old_rot[0])<.001 and new_pos[0].distance_to(old_pos[0])<.00001,"Action transition begins at the outgoing pose")
	new_rot[0]=Quaternion.IDENTITY; new_pos[0]=Vector3.ZERO
	spring.apply(.0001,new_rot,new_pos)
	var velocity=(new_pos[0]-old_pos[0])/.0001
	check(velocity.distance_to(linear[0])<.02,"Transition preserves outgoing linear velocity")
	var angular_test=PoseTransition.new()
	var outgoing: Array[Quaternion]=[Quaternion(Vector3(1,2,0).normalized(),1.8)]
	var incoming: Array[Quaternion]=[Quaternion(Vector3.FORWARD,.4)]
	var old_w: Array[Vector3]=[Vector3(.3,1.2,-.7)]
	var new_w: Array[Vector3]=[Vector3(.7,-.4,.5)]
	var blank: Array[Vector3]=[Vector3.ZERO]
	angular_test.begin(outgoing,blank,incoming,blank,old_w,zero,new_w,zero,.18)
	angular_test.apply(.0001,incoming,blank)
	incoming[0]=PoseTransition.exponential(new_w[0]*.0001)*Quaternion(Vector3.FORWARD,.4)
	angular_test.apply(.0001,incoming,blank)
	var measured_w=PoseTransition.logarithm(incoming[0]*outgoing[0].inverse())/.0001
	check(measured_w.distance_to(old_w[0])<.15,"Large non-collinear transitions preserve angular velocity")
	for i in 100:
		new_rot[0]=Quaternion.IDENTITY; new_pos[0]=Vector3.ZERO
		spring.apply(.01,new_rot,new_pos)
	check(new_rot[0].angle_to(Quaternion.IDENTITY)<.001 and new_pos[0].length()<.0001,"Inertial offset converges to authored motion")
	var box=CourtArt.beveled_box(Vector3(2,1,3))
	check(box.get_aabb().size.is_equal_approx(Vector3(2,1,3)),"Bevels preserve collision dimensions")
	var arrays=box.surface_get_arrays(0)
	var valid=true
	for normal in arrays[Mesh.ARRAY_NORMAL]: valid=valid and normal.is_finite() and absf(normal.length()-1)<.001
	check(valid,"Architectural bevel normals are finite and normalized")
	var effect: CombatEffects=hero.effects
	for i in 100: effect.impact(hero.position+Vector3.UP,Vector3.FORWARD,"parry")
	check(effect.particles.size()<=CombatEffects.CAPACITY,"Impact particle pool has a hard capacity")
	await frames(40)
	check(effect.particles.is_empty(),"Impact particles expire without retained allocations")
	Preferences.reduced_effects=true
	effect.impact(hero.position,Vector3.UP,"hit")
	check(effect.particles.is_empty(),"Reduced effects suppress particles")
	Preferences.reduced_effects=false
	hero.position=Vector3(3,.04,3); hero.reset_physics_interpolation()
	await frames(40)
	check(hero.yaw.global_position.distance_to(hero.position)<4,"Camera settles around the interpolated encounter")
	check(hero.camera.fov>=55 and hero.camera.fov<=62,"Camera field of view stays within the comfort range")
	check(hero.pitch.spring_length>=3.6 and hero.pitch.spring_length<=4.6,"Encounter framing has bounded camera distance")
	check(hero.figure.interpolator.ready,"Runtime captures post-IK poses for rendering")
	check(PerformanceMotion.stride("Jog_Right")<PerformanceMotion.stride("Jog_Fwd"),"Directional gait uses its own authored stride")
	check(hero.figure.phase_offsets.Jog_Left!=hero.figure.phase_offsets.Jog_Fwd,"Lateral gait has a measured contact phase")
	var heal=CombatModel.new(); PerformanceMotion.configure(heal); heal.health=20
	heal.heal(); heal.tick(.5)
	check(heal.health==20,"Healing waits until the bottle reaches the mouth")
	heal.tick(.4)
	check(heal.health==68 and not heal.heal_pending,"Drink contact grants one heal")
	heal.tick(.4)
	check(heal.health==68,"Holding the drinking pose does not repeat healing")
	heal.state="idle"; heal.health=20; heal.heal(); heal.tick(.2); heal.receive(5); heal.tick(1)
	check(heal.health==15 and not heal.heal_pending,"An interrupted drink does not grant a delayed heal")
	hero.model.state="idle"; hero.model.health=20; hero.try_heal()
	await frames(3)
	check(hero.figure.flask.visible and not hero.figure.weapon.visible,"Drinking shows the flask and hides the blade")
	hero.model.state="idle"
	await frames(3)
	check(not hero.figure.flask.visible and hero.figure.weapon.visible,"Returning to combat restores the weapon")
	var turn=PerformanceTurn.new()
	var probe=CharacterBody3D.new(); add_child(probe)
	turn.step(probe,"idle",.01); turn.desired=PI/2
	turn.step(probe,"idle",.01)
	check(turn.active and turn.clip=="Turn90_L" and probe.rotation.y<.1,"Stationary turn begins with authored footwork, without snapping")
	for i in 90: turn.step(probe,"idle",1.0/60)
	check(absf(probe.rotation.y-PI/2)<.002 and not turn.active,"Authored turn reaches its requested heading")
	turn.desired=-PI/2; turn.step(probe,"dodge",.1)
	check(absf(probe.rotation.y-PI/2)<.002,"Evasion does not inherit a pending stationary turn")
	probe.queue_free()
	check(hero.figure.balance.lean.length()<=.109 and absf(hero.figure.balance.gaze)<=.651,"Additive balance and gaze remain anatomically bounded")
	var foley: TrialAudio=main.world.foley
	var voice_count=foley.voices.size()
	for i in 100: foley.event("guard",hero.position)
	check(voice_count==16 and foley.voices.size()==voice_count,"Spatial foley reuses a bounded voice pool")
	check(foley.streams.size()==17,"All licensed trial foley variants load")
	check(AudioServer.get_bus_effect_count(AudioServer.get_bus_index("TrialCourt"))==1,"Rematches do not accumulate reverb effects")
	var score: TrialScore=main.world.score
	var base=score.synchronized.get_sync_stream(0) as AudioStreamWAV
	var tension=score.synchronized.get_sync_stream(1) as AudioStreamWAV
	check(base!=null and tension!=null and is_equal_approx(base.get_length(),48) and is_equal_approx(tension.get_length(),48),"Orchestral stems have identical 48-second sample lengths")
	check(base.loop_mode==AudioStreamWAV.LOOP_FORWARD and tension.loop_mode==AudioStreamWAV.LOOP_FORWARD and base.loop_end==tension.loop_end,"Both score layers loop at the same sample boundary")
	var starting_gain=score.synchronized.get_sync_stream_volume(1)
	main.world.warden.phase=2
	for i in 120: score._process(1.0/60)
	check(score.synchronized.get_sync_stream_volume(1)>starting_gain and score.starts==1,"Second phase raises the synchronized score layer without restarting it")
	main.world.warden.phase=1
	main.world.won=true
	for i in 120: score._process(1.0/60)
	check(score.presence==0,"Victory fades the trial score")
	main.world.won=false
	var cape: PerformanceCape=hero.figure.cape
	var cloth_finite=true
	for point in cape.current: cloth_finite=cloth_finite and point.is_finite() and point.distance_to(hero.position)<2
	check(cape.current.size()==70 and cloth_finite,"Cloth stays finite with a fixed 70-particle budget")
	hero.position+=Vector3(4,0,0); hero.reset_physics_interpolation()
	await frames(4)
	var cloth_reset=true
	for point in cape.current: cloth_reset=cloth_reset and point.distance_to(hero.position)<2
	check(cloth_reset,"Teleport resets cloth history without a stretched trail")
	check(main.ui.toast_label.position.y+main.ui.toast_label.size.y<main.world.boss_panel.position.y,"Trial toast and boss bar do not overlap")
	check(not main.ui.objective_panel.visible,"Trial uses the compact encounter HUD")
	var body_count=main.world.find_children("DroppedSword*","RigidBody3D",true,false).size()
	hero.figure.drop_weapon(); hero.figure.drop_weapon(); hero.figure.animate(1.0/60,hero.model,0)
	check(main.world.find_children("DroppedSword*","RigidBody3D",true,false).size()==body_count+1,"Defeat creates a physical dropped weapon")
	check(not hero.figure.weapon.visible,"Released weapon is not also shown in the hand")
	print("RESULT: %d/%d motion quality checks passed; %d physics ticks" % [checks-failures,checks,Engine.physics_ticks_per_second])
	main.finish(1 if failures else 0)
