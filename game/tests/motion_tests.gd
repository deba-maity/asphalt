extends SceneTree

var checks=0
var failures=0

func check(ok: bool, description: String) -> void:
	checks+=1
	if ok: print("PASS: "+description)
	else: failures+=1; push_error("FAIL: "+description)

func _initialize() -> void: call_deferred("run")

func run() -> void:
	for attack in ["light","heavy"]:
		var model=CombatModel.new(); model.start_attack(attack)
		var continuous=true
		for boundary in [float(model.attack.windup),float(model.attack.windup+model.attack.active)]:
			model.elapsed=boundary-.000001
			var before=CombatMotion.sample(model)
			model.elapsed=boundary+.000001
			var after=CombatMotion.sample(model)
			for bone in before:
				for axis in 3: continuous=continuous and absf(before[bone][axis]-after[bone][axis])<.01
		check(continuous,attack+": all authored joints remain continuous across damage and recovery boundaries")
	for speed in [1.45,3.4,5.7]:
		check(AnimationPolicy.cadence(speed)<=2.1 and speed/AnimationPolicy.cadence(speed)*AnimationPolicy.stance_fraction(speed)<=.61,"Gait cadence and contact reach bounded at "+str(speed)+" m/s")
	var floor_body=StaticBody3D.new()
	var floor_shape=CollisionShape3D.new(); var box=BoxShape3D.new(); box.size=Vector3(80,.2,80)
	floor_shape.shape=box; floor_shape.position.y=-.1; floor_body.add_child(floor_shape); root.add_child(floor_body)
	var actor=CharacterBody3D.new()
	actor.collision_layer=2; actor.collision_mask=1; actor.floor_snap_length=.4
	var collider=CollisionShape3D.new(); var capsule=CapsuleShape3D.new(); capsule.radius=.3; capsule.height=1.8
	collider.shape=capsule; collider.position.y=.9; actor.add_child(collider); root.add_child(actor)
	var figure=load("res://assets/characters/rayan.tscn").instantiate(); actor.add_child(figure)
	var model=CombatModel.new()
	for attack in ["light","heavy"]:
		for serial in [1,2]:
			var strike=CombatModel.new(); strike.start_attack(attack); strike.swing_serial=serial
			strike.elapsed=strike.attack.windup+strike.attack.active*.5
			figure.animate(.2,strike,0)
			var tip: Vector3=figure.to_local(figure.weapon.to_global(Vector3(0,-1,0)))
			print("BLADE: ",attack," serial=",serial," contact=",tip)
			check(tip.z<-.4,attack+" cut "+str(serial)+": blade crosses the forward damage region")
	for slope in [0.0,8.0]:
		floor_body.rotation.z=deg_to_rad(slope)
		for speed in [1.45,3.4,5.7]:
			for direction in [Vector3.FORWARD,Vector3.RIGHT,Vector3.BACK,Vector3.LEFT]:
				actor.position=Vector3(0,.05,0); figure.foot_placement.clear()
				for frame in 12:
					await physics_frame
					actor.velocity=Vector3(0,-2,0); actor.move_and_slide()
				var maximum_error=0.0; var samples=0; var finite=true
				var start_contacts: int=figure.foot_placement.contact_count
				for frame in 120:
					await physics_frame
					var before=actor.position
					actor.velocity=direction*speed+Vector3.DOWN*.5; actor.move_and_slide()
					figure.animate(1.0/60,model,speed,actor.position-before)
					figure.foot_placement.apply(figure,actor,"idle",speed)
					for suffix in figure.foot_placement.anchors:
						var ankle: Node3D=figure.joints["ankle_"+suffix]
						var error=ankle.global_position.distance_to(figure.foot_placement.anchors[suffix])
						if frame>15: maximum_error=maxf(maximum_error,error); samples+=1
						finite=finite and ankle.global_transform.is_finite()
				var contacts: int=figure.foot_placement.contact_count-start_contacts
				print("FOOT: slope=",slope," speed=",speed," direction=",direction," error=",maximum_error," contacts=",contacts," samples=",samples)
				check(finite and samples>20 and maximum_error<.005 and contacts<20,"Grounded foot contacts: slope %s speed %s direction %s" % [slope,speed,direction])
	floor_body.rotation=Vector3.ZERO
	for body_scale in [.85,1.3]:
		actor.scale=Vector3.ONE*body_scale; actor.position=Vector3(0,.05,0); figure.foot_placement.clear()
		var maximum_error=0.0; var samples=0
		for frame in 150:
			await physics_frame
			var before=actor.position
			actor.velocity=Vector3(0,-1,-3.4); actor.move_and_slide()
			figure.animate(1.0/60,model,3.4,actor.global_basis.inverse()*(actor.position-before))
			figure.foot_placement.apply(figure,actor,"idle",3.4)
			if frame>20:
				for suffix in figure.foot_placement.anchors:
					maximum_error=maxf(maximum_error,figure.joints["ankle_"+suffix].global_position.distance_to(figure.foot_placement.anchors[suffix])); samples+=1
		check(samples>20 and maximum_error<.005,"Scaled enemy foot reach and ankle transforms: "+str(body_scale))
	# Teleports and airborne/dodge transitions must drop stale world anchors.
	actor.position+=Vector3(20,0,0)
	figure.foot_placement.apply(figure,actor,"dodge",0)
	check(figure.foot_placement.anchors.is_empty(),"Dodge clears old foot locks after teleport")
	figure.foot_placement.anchors["l"]=Vector3.ZERO
	figure.dead_blend=.5
	figure.foot_placement.apply(figure,actor,"talk",0)
	check(figure.foot_placement.anchors.is_empty(),"Scripted story fall cannot be overridden by grounded foot locks")
	for variant in 3:
		var mesh=SceneryGeometry.rock(variant)
		var arrays=mesh.surface_get_arrays(0)
		var outward=0; var total=0
		for i in arrays[Mesh.ARRAY_VERTEX].size():
			var p: Vector3=arrays[Mesh.ARRAY_VERTEX][i]
			if p.y>.05:
				total+=1
				if p.dot(arrays[Mesh.ARRAY_NORMAL][i])>0: outward+=1
		check(outward>total*.9,"Rock "+str(variant)+": outward normals and front-face winding")
	actor.free(); floor_body.free()
	print("RESULT: %d/%d motion/geometry checks passed" % [checks-failures,checks])
	quit(1 if failures else 0)
