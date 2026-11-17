extends Node

# Records actual runtime joints/cloth under scripted headless input. The separate
# WebGL reviewer consumes this data; its lighting is not the game's renderer.
var main: Node
var records: Array=[]
var warden_records: Array=[]
var frame: int=0
var label: String=""
var hero: Fighter

func _ready() -> void: call_deferred("run")

func capture(count: int, action_label: String) -> void:
	label=action_label
	for i in count:
		await get_tree().physics_frame
		await get_tree().process_frame
		if frame%2==0:
			records.append(snapshot(hero))
			warden_records.append(snapshot(main.world.warden))
		frame+=1

func snapshot(actor: Fighter) -> Dictionary:
	var figure: PerformanceFigure=actor.figure
	var rig=figure.body_skeleton
	var poses: Array=[]
	for bone in rig.get_bone_count():
		var q: Quaternion=figure.interpolator.current_rot[bone]
		var p: Vector3=figure.interpolator.current_pos[bone]
		poses.append([p.x,p.y,p.z,q.x,q.y,q.z,q.w])
	var cloth: Array=[]
	for point in figure.cape.current: cloth.append([point.x,point.y,point.z])
	var transform=figure.model_root.global_transform
	var q=transform.basis.get_rotation_quaternion(); var p=transform.origin
	var drop: Array=[]
	var weapons=main.world.find_children("DroppedSword*","RigidBody3D",true,false)
	if figure.dropped_weapon and not weapons.is_empty():
		var t: Transform3D=weapons[0].global_transform
		var rotation=t.basis.get_rotation_quaternion()
		drop=[t.origin.x,t.origin.y,t.origin.z,rotation.x,rotation.y,rotation.z,rotation.w]
	return {"frame":frame,"label":label,"state":actor.model.state,"clip":figure.current_clip,"time":figure.current_time,
		"model":[p.x,p.y,p.z,q.x,q.y,q.z,q.w],"bones":poses,"cloth":cloth,"flask":figure.flask.visible,"sword":figure.weapon.visible,"drop":drop}

func run() -> void:
	Engine.physics_ticks_per_second=60
	main.start_trial(TrialPassage.WARDEN,false); hero=main.player
	main.world.warden.ai_enabled=false; main.world.warden.position=Vector3(0,.05,-9)
	for pair in [["weapon",hero.figure.weapon],["flask",hero.figure.flask]]:
		var prop: Node3D=pair[1].duplicate()
		prop.transform=Transform3D.IDENTITY; prop.visible=true
		var holder=Node3D.new(); holder.add_child(prop); add_child(holder)
		var document=GLTFDocument.new(); var state=GLTFState.new()
		document.append_from_scene(holder,state)
		document.write_to_filesystem(state,ProjectSettings.globalize_path("res://../tools/cache/motion-review/"+pair[0]+".glb").simplify_path())
		holder.free()
	hero.target=null; hero.use_test_direction=true; hero.position=Vector3(0,.05,0)
	await capture(90,"ready stance")
	hero.test_direction=Vector3.FORWARD
	await capture(120,"forward locomotion")
	hero.test_direction=Vector3.ZERO
	await capture(45,"deceleration")
	hero.turning.desired=PI/2
	await capture(100,"stationary turn")
	hero.model.stamina=100; hero.try_attack("light")
	await capture(25,"first cut")
	hero.queue_intent("light")
	await capture(36,"second cut")
	hero.queue_intent("light")
	await capture(150,"two-cut finisher and recovery")
	hero.model.stamina=100; hero.test_direction=-hero.global_basis.z
	Input.action_press("sprint"); hero.try_attack("heavy"); Input.action_release("sprint")
	hero.test_direction=Vector3.ZERO
	await capture(120,"advancing cut and recovery")
	main.world.warden.model.start_attack("heavy")
	await capture(160,"warden cleave preparation and recovery")
	main.world.warden.model.stamina=100; main.world.warden.model.start_attack("trial_dash")
	await capture(170,"warden advancing cut and recovery")
	hero.model.stamina=100; hero.test_direction=-hero.global_basis.x; hero.try_dodge()
	await capture(56,"left sidestep")
	hero.test_direction=Vector3.ZERO
	await capture(24,"settle")
	hero.model.stamina=100; hero.test_direction=-hero.global_basis.z; hero.try_dodge()
	await capture(56,"forward roll")
	hero.test_direction=Vector3.ZERO
	await capture(24,"settle")
	hero.model.health=30; Session.data.heals=3; hero.try_heal()
	await capture(150,"drinking")
	Input.action_press("guard")
	await capture(20,"guard")
	hero.figure.recoil(false)
	await capture(35,"guarded impact")
	Input.action_release("guard")
	await capture(25,"ready")
	hero.model.state="hit"; hero.model.elapsed=-.65; hero.reaction_serial+=1
	await capture(75,"stagger and recovery")
	hero.model.health=1; hero.take_damage(20,main.world.warden)
	await capture(150,"defeat")
	for actor in [hero,main.world.warden]:
		var names: Array=[]
		for bone in actor.figure.body_skeleton.get_bone_count(): names.append(actor.figure.body_skeleton.get_bone_name(bone))
		var filename="runtime.json" if actor==hero else "runtime-warden.json"
		var path=ProjectSettings.globalize_path("res://../tools/cache/motion-review/"+filename).simplify_path()
		var file=FileAccess.open(path,FileAccess.WRITE)
		file.store_string(JSON.stringify({"fps":30,"character":actor.figure.role,"names":names,"columns":PerformanceCape.COLUMNS,"rows":PerformanceCape.ROWS,"triangles":Array(actor.figure.cape.triangles),"frames":records if actor==hero else warden_records}))
	print("RECORDED ",records.size()," runtime pose/cloth frames; isolated review data, no game rendering")
	main.finish(0)
