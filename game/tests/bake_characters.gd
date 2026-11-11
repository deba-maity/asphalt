extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func own_children(node: Node, owner_node: Node) -> void:
	for child in node.get_children():
		child.owner = owner_node
		own_children(child,owner_node)

func run() -> void:
	DirAccess.make_dir_recursive_absolute("res://assets/characters")
	var chapter = JSON.parse_string(FileAccess.get_file_as_string("res://content/chapter_01.json"))
	var combat = JSON.parse_string(FileAccess.get_file_as_string("res://content/combat.json"))
	var definitions = [{"id":"rayan","color":"4b6975","armed":true}]
	for npc in chapter.npcs:
		definitions.append({"id":npc.id.trim_prefix("npc_"),"color":npc.color,"armed":false})
	for id in combat.enemies:
		definitions.append({"id":id,"color":combat.enemies[id].color,"armed":true})
	for definition in definitions:
		var figure = Figure.new()
		figure.name = definition.id
		figure.role = definition.id
		figure.cloth = Color(definition.color)
		figure.armed = definition.armed
		root.add_child(figure)
		own_children(figure,figure)
		var scene = PackedScene.new()
		if scene.pack(figure) != OK or ResourceSaver.save(scene,"res://assets/characters/"+definition.id+".tscn") != OK:
			push_error("Bake failed: "+definition.id)
			quit(1)
			return
		figure.free()
		print("BAKED: "+definition.id)
	quit()
