extends SceneTree

# Export isolated native rigs + baked motion for a separate, offline WebGL asset
# reviewer. This never loads the game or captures desktop input.
func _initialize() -> void: call_deferred("run")

func run() -> void:
	var destination=ProjectSettings.globalize_path("res://../tools/cache/motion-review").simplify_path()
	DirAccess.make_dir_recursive_absolute(destination)
	for id in ["rayan","warden"]:
		var model=load("res://assets/performance/"+id+".glb").instantiate()
		root.add_child(model)
		var rig: Skeleton3D=model.find_children("*","Skeleton3D",true,false)[0]
		for part in model.find_children("*","MeshInstance3D",true,false):
			if not part.visible: part.free()
		var library: AnimationLibrary=load("res://assets/performance/"+id+"_motion.res").duplicate(true)
		var player=AnimationPlayer.new(); model.add_child(player)
		player.root_node=player.get_path_to(model)
		for name in library.get_animation_list():
			var clip=library.get_animation(name)
			for track in clip.get_track_count():
				var bone=clip.track_get_path(track).get_subname(0)
				clip.track_set_path(track,NodePath(str(model.get_path_to(rig))+":"+bone))
		player.add_animation_library("",library)
		var document=GLTFDocument.new(); var state=GLTFState.new()
		var result=document.append_from_scene(model,state)
		if result!=OK: push_error("Asset review export failed"); quit(1); return
		result=document.write_to_filesystem(state,destination+"/"+id+".glb")
		if result!=OK: push_error("Asset review write failed"); quit(1); return
		print("REVIEW EXPORT ",id," clips=",library.get_animation_list().size())
		model.free()
	quit()
