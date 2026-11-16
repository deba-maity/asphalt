extends SceneTree

# Asset-only CPU inspection. Does not instantiate main, capture input or render
# a game viewport. Exports deformed vertices plus the original albedo textures.
func _initialize() -> void: call_deferred("run")

func run() -> void:
	var samples=[]
	var texture_paths={}
	for entry in [["rayan","Sword_Idle",.3],["rayan","Sword_Regular_A",.267],["rayan","Sword_Heavy_A",.49],["warden","Sword_Idle",.3]]:
		var figure=PerformanceFigure.new()
		figure.role=entry[0]
		root.add_child(figure)
		figure.sample_pose(entry[1],entry[2],figure.rotations,figure.positions)
		figure.apply_pose()
		await process_frame
		var rig: Skeleton3D=figure.body_skeleton
		var parts=[]
		for instance in figure.find_children("*","MeshInstance3D",true,false):
			var mesh: Mesh=instance.mesh
			for surface in mesh.get_surface_count():
				var arrays=mesh.surface_get_arrays(surface)
				var vertices: PackedVector3Array=arrays[Mesh.ARRAY_VERTEX]
				var points=[]; var normals=[]; var uv=[]
				for v in vertices.size():
					var point=vertices[v]
					var normal: Vector3=arrays[Mesh.ARRAY_NORMAL][v]
					if instance.skin:
						point=Vector3.ZERO; normal=Vector3.ZERO
						for channel in 4:
							var bind=arrays[Mesh.ARRAY_BONES][v*4+channel]
							var bone=rig.find_bone(instance.skin.get_bind_name(bind))
							if bone<0: bone=instance.skin.get_bind_bone(bind)
							var transform=rig.get_bone_global_pose(bone)*instance.skin.get_bind_pose(bind)
							var weight=arrays[Mesh.ARRAY_WEIGHTS][v*4+channel]
							point+=(transform*vertices[v])*weight
							normal+=(transform.basis*arrays[Mesh.ARRAY_NORMAL][v])*weight
						point=rig.to_global(point); normal=rig.global_basis*normal
					else:
						point=instance.to_global(point); normal=instance.global_basis*normal
					points.append([point.x,point.y,point.z])
					normal=normal.normalized(); normals.append([normal.x,normal.y,normal.z])
					var at: Vector2=arrays[Mesh.ARRAY_TEX_UV][v] if arrays[Mesh.ARRAY_TEX_UV]!=null else Vector2.ZERO
					uv.append([at.x,at.y])
				var material=instance.get_active_material(surface)
				var color=Color.WHITE
				var texture=""
				var palette=[]
				if material is ShaderMaterial and material.shader==load("res://assets/performance/cloth.gdshader"):
					var replacement=StandardMaterial3D.new()
					replacement.albedo_color=material.get_shader_parameter("albedo_factor")
					replacement.albedo_texture=material.get_shader_parameter("albedo_map")
					var tint: Color=material.get_shader_parameter("cloth_color")
					palette=[tint.r,tint.g,tint.b]
					material=replacement
				if material is StandardMaterial3D:
					color=material.albedo_color
					if material.albedo_texture:
						var id=material.albedo_texture.get_instance_id()
						if not texture_paths.has(id):
							texture_paths[id]="performance-texture-"+str(texture_paths.size())+".png"
							var pixels=material.albedo_texture.get_image()
							pixels.decompress()
							pixels.save_png("res://../tools/logs/"+texture_paths[id])
						texture=texture_paths[id]
				var indices=Array(arrays[Mesh.ARRAY_INDEX]) if arrays[Mesh.ARRAY_INDEX]!=null else []
				parts.append({"vertices":points,"normals":normals,"uv":uv,"indices":indices,"color":[color.r,color.g,color.b],"texture":texture,"palette":palette})
		samples.append({"pose":entry[0]+" / "+entry[1],"parts":parts})
		figure.free()
	var out=FileAccess.open("res://../tools/logs/performance-geometry.json",FileAccess.WRITE)
	out.store_string(JSON.stringify(samples)); out.close()
	print("Exported isolated textured posed geometry")
	quit()
