extends SceneTree

# Static scene geometry only, exported headlessly for an independent asset
# viewer. This does not capture the desktop or validate native Godot rendering.
func _initialize() -> void: call_deferred("run")

func run() -> void:
	var main=load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	var holder=Node3D.new(); root.add_child(holder)
	var world=main.world
	for node in world.find_children("*","GeometryInstance3D",true,false):
		var ancestor=node.get_parent(); var dynamic=false
		while ancestor!=world and ancestor!=null:
			if ancestor==world.hero or ancestor==world.warden: dynamic=true; break
			ancestor=ancestor.get_parent()
		if dynamic: continue
		if node is MeshInstance3D:
			var part=MeshInstance3D.new(); part.mesh=node.mesh; part.material_override=node.material_override
			holder.add_child(part); part.global_transform=node.global_transform
		# Capture before the first frame: batch_scenery's original mesh nodes
		# are still queued for deletion and retain every transform. The dummy
		# headless RenderingServer cannot read back MultiMesh GPU transforms.
	var document=GLTFDocument.new(); var state=GLTFState.new()
	var result=document.append_from_scene(holder,state)
	if result==OK: result=document.write_to_filesystem(state,ProjectSettings.globalize_path("res://../tools/cache/motion-review/court.glb").simplify_path())
	print("COURT STATIC EXPORT ",result," meshes=",holder.get_child_count())
	holder.free(); main.free()
	quit(0 if result==OK else 1)
