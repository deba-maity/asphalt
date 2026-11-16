extends SceneTree

# Headless data export for an offline mesh contact sheet. No game scene,
# viewport rendering, controller/mouse capture, or desktop window is involved.
func _initialize() -> void: call_deferred("run")

func run() -> void:
	var samples=[]
	for pose in ["idle","run","cut","heavy"]:
		var figure=load("res://assets/characters/rayan.tscn").instantiate()
		root.add_child(figure)
		var model=CombatModel.new()
		if pose in ["cut","heavy"]:
			model.start_attack("heavy" if pose=="heavy" else "light")
			model.elapsed=model.attack.windup+model.attack.active*.5
		for frame in 24: figure.animate(1.0/60,model,5.7 if pose=="run" else 0.0,Vector3.FORWARD*5.7/60 if pose=="run" else Vector3.ZERO)
		print("POSE ",pose," hand=",figure.joints.hand_r.global_position," tip=",figure.weapon.to_global(Vector3(0,-1,0))," shoulder=",figure.joints.arm_r.rotation_degrees)
		var rig: Skeleton3D=figure.body_skeleton
		rig.force_update_all_bone_transforms()
		var parts=[]
		for instance in figure.find_children("*","MeshInstance3D",true,false):
			if not instance.is_visible_in_tree(): continue
			var mesh: Mesh=instance.mesh
			for surface in mesh.get_surface_count():
				var arrays=mesh.surface_get_arrays(surface)
				var vertices: PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
				var points=[]
				for v in vertices.size():
					var point=vertices[v]
					if instance.skin:
						point=Vector3.ZERO
						for channel in 4:
							var bone=arrays[Mesh.ARRAY_BONES][v*4+channel]
							point+=(rig.get_bone_global_pose(bone)*rig.get_bone_global_rest(bone).affine_inverse()*vertices[v])*arrays[Mesh.ARRAY_WEIGHTS][v*4+channel]
					else: point=figure.to_local(instance.to_global(point))
					points.append([point.x,point.y,point.z])
				var material=instance.material_override if instance.material_override else mesh.surface_get_material(surface)
				var color: Color=material.albedo_color if material is StandardMaterial3D else Color.WHITE
				var indices=Array(arrays[Mesh.ARRAY_INDEX]) if arrays[Mesh.ARRAY_INDEX]!=null else []
				parts.append({"vertices":points,"indices":indices,"color":[color.r,color.g,color.b]})
		samples.append({"pose":pose,"parts":parts})
		figure.free()
	var out=FileAccess.open("res://../tools/logs/asset-geometry.json",FileAccess.WRITE)
	out.store_string(JSON.stringify(samples)); out.close()
	print("Exported isolated posed asset geometry for offline inspection")
	quit()
