extends SceneTree

var failures: int=0
var checks: int=0
func check(ok: bool, label: String) -> void:
	checks+=1
	if not ok: failures+=1; push_error("FAIL: "+label)
	else: print("PASS: "+label)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var directory=DirAccess.open("res://assets/characters")
	for filename in directory.get_files():
		if not filename.ends_with(".tscn"): continue
		var figure=load("res://assets/characters/"+filename).instantiate()
		root.add_child(figure)
		var rig: Skeleton3D=figure.get_node("BodySkeleton")
		var body: MeshInstance3D=rig.get_node("DeformingBody")
		var valid=body.skin.get_bind_count()==rig.get_bone_count()
		var blended=0
		var count=0
		var max_error: float=0
		for surface in body.mesh.get_surface_count():
			var data=body.mesh.surface_get_arrays(surface)
			var vertices: PackedVector3Array=data[Mesh.ARRAY_VERTEX]
			var weights: PackedFloat32Array=data[Mesh.ARRAY_WEIGHTS]
			var bones: PackedInt32Array=data[Mesh.ARRAY_BONES]
			count+=vertices.size()
			for v in vertices.size():
				var sum: float=0
				for channel in 4:
					var index=v*4+channel
					sum+=weights[index]
					valid=valid and bones[index]>=0 and bones[index]<rig.get_bone_count() and weights[index]>=0
				max_error=maxf(max_error,absf(sum-1))
				valid=valid and absf(sum-1)<.0001 and vertices[v].is_finite()
				if weights[v*4]>.01 and weights[v*4+1]>.01 and bones[v*4]!=bones[v*4+1]: blended+=1
		print("SKIN: vertices=",count," blended=",blended," weight error=",max_error)
		check(valid and blended>64 and count<6000,filename+": normalized skin weights, blended joints and bounded vertex count")
		var state=CombatModel.new()
		state.start_attack("heavy")
		state.elapsed=.35
		figure.animate(1.0/60,state,0)
		figure.animate(.12,state,0)
		rig.force_update_all_bone_transforms()
		var elbow=rig.find_bone("elbow_r")
		var expected: Transform3D=figure.global_transform.affine_inverse()*figure.joints.elbow_r.global_transform
		check(rig.get_bone_global_pose(elbow).is_equal_approx(expected),filename+": skin and weapon joint hierarchy share the sampled pose")
		figure.free()
	for attack_id in ["light","heavy"]:
		var state=CombatModel.new(); state.start_attack(attack_id)
		state.elapsed=float(state.attack.windup)-.00001
		var before=AnimationPolicy.attack_blend(state)
		state.elapsed=float(state.attack.windup)+.00001
		var after=AnimationPolicy.attack_blend(state)
		check(before.distance_to(after)<.001,attack_id+": no pose discontinuity at damage onset")
	for direction in [Vector3.FORWARD,Vector3.BACK,Vector3.LEFT,Vector3.RIGHT]:
		var valid=true
		for frame in 120:
			var angles=AnimationPolicy.directional_leg(frame*TAU/120,false,direction)
			valid=valid and angles.is_finite() and angles.y<=0
		check(valid,"Directional leg solve remains finite through stance/swing: "+str(direction))
	print("RESULT: %d/%d skeletal/animation checks passed; rendered acceptance not performed" % [checks-failures,checks])
	quit(1 if failures else 0)
