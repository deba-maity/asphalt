extends Node

var main: Node
var checks: int=0
var failures: int=0

func _ready() -> void: call_deferred("run")
func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)
func seconds(value: float) -> void:
	for i in int(ceil(value*Engine.physics_ticks_per_second)): await get_tree().physics_frame

func run() -> void:
	if "--presentation-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	main.start_trial(TrialPassage.WARDEN,false)
	var hero: Fighter=main.player; var boss: Fighter=main.world.warden
	hero.use_test_direction=true; boss.ai_enabled=false
	await seconds(.3)
	for actor in [hero,boss]:
		var parts=actor.figure.model_root.find_children("Knight*","MeshInstance3D",true,false)
		var triangles=0; var vertices=0; var finite=true; var weights_valid=true
		var pbr=true
		for part in parts:
			for surface in part.mesh.get_surface_count():
				var arrays=part.mesh.surface_get_arrays(surface)
				triangles+=arrays[Mesh.ARRAY_INDEX].size()/3
				vertices+=arrays[Mesh.ARRAY_VERTEX].size()
				for point in arrays[Mesh.ARRAY_VERTEX]: finite=finite and point.is_finite() and point.length()<3
				for normal in arrays[Mesh.ARRAY_NORMAL]: finite=finite and normal.is_finite() and normal.length()>.98
				var weights: PackedFloat32Array=arrays[Mesh.ARRAY_WEIGHTS]
				var bones: PackedInt32Array=arrays[Mesh.ARRAY_BONES]
				for vertex in arrays[Mesh.ARRAY_VERTEX].size():
					var total=0.0
					for influence in 4:
						var index=vertex*4+influence
						total+=weights[index]
						weights_valid=weights_valid and is_finite(weights[index]) and weights[index]>=0 and bones[index]>=0 and bones[index]<65
					weights_valid=weights_valid and absf(total-1)<.002
				var material=part.get_active_material(surface)
				pbr=pbr and material is StandardMaterial3D and material.albedo_texture!=null and material.normal_enabled and material.normal_texture!=null and material.roughness_texture!=null and material.metallic_texture!=null
		check(parts.size()==1 and triangles>15000 and triangles<18000 and vertices<15000,"Artist armor stays within the imported geometry budget: "+actor.figure.role)
		check(finite and weights_valid and actor.figure.body_skeleton.get_bone_count()==65,"Imported armor has finite geometry and normalized anatomical weights: "+actor.figure.role)
		check(pbr,"Armor retains color, normal, metallic and roughness maps: "+actor.figure.role)
		actor.figure.interpolator.display(actor.figure.body_skeleton,.5)
		var follows=true
		for attachment in actor.figure.body_skeleton.get_children():
			if not attachment is BoneAttachment3D: continue
			var expected=actor.figure.body_skeleton.global_transform*actor.figure.body_skeleton.get_bone_global_pose(attachment.get_bone_idx())
			follows=follows and attachment.global_transform.origin.distance_to(expected.origin)<.0001
		check(follows,"Explicit pose sampling updates hand props in the same pass: "+actor.figure.role)
		check(actor.figure.cape.material_override is ShaderMaterial,"Mantle has woven trim and an original vow seal: "+actor.figure.role)
	check(hero.figure.cape.triangles.size()>boss.figure.cape.triangles.size(),"Warden's mantle has an open split hem")
	check(hero.figure.cape.rest[-1].y>boss.figure.cape.rest[-1].y,"Mantles have distinct silhouettes")
	var architecture=main.world.get_node("RuinedCloister")
	var outside=true
	for part in architecture.find_children("*","MeshInstance3D",true,false):
		outside=outside and Vector2(part.global_position.x,part.global_position.z).length()>10
	check(outside,"New cloister masonry leaves the fighting space clear")
	var arch_arrays=CourtArchitecture.arch_mesh(2.2,.48,.95).surface_get_arrays(0)
	var arch_valid=true
	for point in arch_arrays[Mesh.ARRAY_VERTEX]: arch_valid=arch_valid and point.is_finite() and point.length()<3
	for normal in arch_arrays[Mesh.ARRAY_NORMAL]: arch_valid=arch_valid and normal.is_finite() and normal.length()>.99
	check(arch_valid,"Radial stone arches have finite geometry and unit normals")
	var rules=CombatModel.new(); PerformanceMotion.configure(rules,true)
	rules.start_attack("trial_finish")
	rules.elapsed=.2
	check(PerformanceMotion.attack_time(rules)>.01 and PerformanceMotion.attack_time(rules)<.14 and not rules.active() and not rules.claim_hit(1),"Anticipation shows the preparation pose without early damage")
	var lead=float(rules.attack.lead_in); var rate=float(rules.attack.rate)
	rules.elapsed=(lead+.2)/rate
	check(rules.active() and rules.claim_hit(1) and not rules.claim_hit(1),"First finisher cut stays synchronized after anticipation")
	rules.elapsed=(lead+.4)/rate
	check(not rules.active() and not rules.claim_hit(2),"Finisher gap stays harmless after anticipation")
	rules.elapsed=(lead+.65)/rate
	check(rules.active() and rules.claim_hit(1),"Second finisher cut remains independently synchronized")
	rules.elapsed=.1
	var windup=float(rules.attack.windup)
	check(absf(PerformanceMotion.clip_time(rules.attack,windup+.00001)-PerformanceMotion.clip_time(rules.attack,windup-.00001))<.0001,"Preparation clock joins the strike without a pose jump")
	var expected_root=PerformanceMotion.attack_root(rules,PerformanceMotion.clip_time(rules.attack,.1))-PerformanceMotion.attack_root(rules,PerformanceMotion.clip_time(rules.attack,.1-1.0/30))
	check(PerformanceMotion.displacement(rules,1.0/30).is_equal_approx(expected_root),"Preparation footsteps and body motion use the same stretched clock")
	for item in [["trial_dash",true,3.0],["trial_dash",false,3.0],["trial_finish",false,1.55],["heavy",false,1.55],["heavy",false,1.55,true]]:
		var id: String=item[0]
		var source=hero if item[1] else boss
		var victim=boss if source==hero else hero
		hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO; hero.target=null
		boss.position=Vector3(0,.05,-float(item[2])); boss.rotation.y=PI; boss.velocity=Vector3.ZERO
		for actor in [hero,boss]:
			actor.model.state="idle"; actor.model.stamina=100; actor.model.health=actor.model.max_health
			actor.impact_pause=0; actor.intent.clear()
		if item.size()>3: boss.model.health=160
		await seconds(.3)
		var health=victim.model.health; var contacts=source.weapon_sweep.contacts
		source.model.start_attack(id)
		await seconds(3.1)
		var expected=2 if id=="trial_finish" else 1
		print("PRESENTATION CUT ",id," contacts=",source.weapon_sweep.contacts-contacts," damage=",health-victim.model.health)
		check(source.weapon_sweep.contacts-contacts==expected,"Visible blade connects once per authored cut: "+id)
		check(absf(health-victim.model.health-float(source.model.config.attacks[id].damage)*expected)<.01,"New timing and actual damage agree: "+id)
	# Root travel is measured in open space, separately from a target collision.
	hero.position=Vector3(4,.05,4); hero.rotation.y=0; hero.velocity=Vector3.ZERO
	boss.position=Vector3(-6,.05,-6)
	hero.model.state="idle"; hero.model.stamina=100; hero.impact_pause=0
	hero.test_direction=Vector3.FORWARD
	Input.action_press("sprint")
	check(hero.try_attack("heavy") and hero.model.attack_id=="trial_dash","Forward sprint plus heavy selects the authored advancing cut")
	Input.action_release("sprint"); hero.test_direction=Vector3.ZERO
	var start=hero.position
	await seconds(2)
	var distance=start.distance_to(hero.position)
	check(distance>2.0 and distance<2.8,"Advancing cut has bounded authored root travel")
	# Turning the target during commitment cannot redirect a travelling cut.
	hero.model.state="idle"; hero.model.stamina=100; hero.rotation.y=0
	hero.model.start_attack("trial_dash")
	await seconds(.23)
	var yaw=hero.rotation.y
	hero.target=boss; boss.position=hero.position+Vector3.RIGHT*3
	await seconds(.4)
	check(absf(wrapf(hero.rotation.y-yaw,-PI,PI))<.001,"Committed advancing cut does not home toward a moving target")
	await seconds(1.5)
	main.start_trial(TrialPassage.WARDEN,false); hero=main.player; boss=main.world.warden
	hero.use_test_direction=true; hero.position=Vector3(0,.05,0); boss.position=Vector3(0,.05,-3.2)
	boss.rotation.y=PI; boss.phase=2; boss.ai_cooldown=0
	main.world.duel.advance_cooldown=0
	await seconds(.1)
	check(boss.model.state=="attack" and boss.model.attack_id=="trial_dash","Second-phase Warden selects its new cut from real encounter spacing")
	var previous_clock=main.world.duel.advance_cooldown
	await seconds(.1)
	check(main.world.duel.advance_cooldown>7 and main.world.duel.advance_cooldown<previous_clock,"Advancing attacks have a visible recovery and bounded frequency")
	check(absf(hero.figure.balance.gaze_pitch)<=.22 and absf(boss.figure.balance.gaze_pitch)<=.22,"Target-height gaze stays anatomically bounded")
	print("RESULT: %d/%d presentation checks passed; %d physics ticks" % [checks-failures,checks,Engine.physics_ticks_per_second])
	main.finish(1 if failures else 0)
