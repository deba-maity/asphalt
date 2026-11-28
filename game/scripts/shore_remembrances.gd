class_name ShoreRemembrances
extends Node3D

# A walkable view of the three echoes. All masonry is behind the existing
# western parapet. The pictures share an atlas and remember the gate's state.
var panels: Array[ShaderMaterial] = []
var transitions: Array[Tween] = []
var earned := -1

func _ready() -> void:
	var face := QuadMesh.new()
	face.size = Vector2(1.64, 2.46)
	var backing := CourtArt.material("castle_brick_07", .61)
	for i in 3:
		var angle := deg_to_rad(-64.0 + i * 11.5)
		var bay := Node3D.new()
		bay.position = Vector3(sin(angle) * 12.68, 0, -cos(angle) * 12.68)
		bay.rotation.y = -angle
		add_child(bay)
		for course in [
			[Vector3(2.08, .28, .72), Vector3(0, 1.36, 0)],
			[Vector3(1.84, 2.62, .48), Vector3(0, 2.76, -.08)],
			[Vector3(2.03, .15, .69), Vector3(0, 4.10, -.04)]
		]:
			var block := MeshInstance3D.new()
			block.mesh = CourtArt.beveled_box(course[0])
			block.position = course[1]
			block.material_override = backing
			bay.add_child(block)
		var relief := MeshInstance3D.new()
		relief.name = ["EmberBearer", "WatchBeacon", "DawnOffering"][i]
		relief.mesh = face
		relief.position = Vector3(0, 2.76, .176)
		var material := ShaderMaterial.new()
		material.shader = preload("res://assets/court/shore_relief.gdshader")
		material.set_shader_parameter("carvings", load("res://assets/court/shore_remembrances.webp"))
		material.set_shader_parameter("panel", i)
		relief.material_override = material
		panels.append(material)
		transitions.append(null)
		bay.add_child(relief)

func remember(count: int) -> void:
	count = clampi(count, 0, panels.size())
	if count == earned: return
	for i in panels.size():
		var target := 1.0 if i < count else 0.0
		if earned >= 0 and (i < earned) == (i < count): continue
		if transitions[i] != null: transitions[i].kill()
		if earned < 0 or Preferences.reduced_effects or count < earned:
			panels[i].set_shader_parameter("kindled", target)
		else:
			var tween := create_tween()
			transitions[i] = tween
			tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
			tween.tween_property(panels[i], "shader_parameter/kindled", target, .95)
	earned = count
