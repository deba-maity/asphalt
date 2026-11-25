class_name EchoAppearance
extends RefCounted

var age := 0.0
var departing := false
var parts: Array[MeshInstance3D] = []
var originals: Array[Material] = []
var veils: Array[ShaderMaterial] = []

func begin(figure: PerformanceFigure, accent: Color, departure: bool = false) -> void:
	clear()
	departing = departure
	if Preferences.reduced_effects: return
	var ash := ShaderMaterial.new()
	ash.shader = preload("res://assets/court/echo_arrival.gdshader")
	ash.set_shader_parameter("ash", accent)
	ash.set_shader_parameter("ground_y", figure.global_position.y)
	ash.set_shader_parameter("tint", Color("666c65"))
	veils.append(ash)
	for part in figure.find_children("*", "MeshInstance3D", true, false):
		var instance := part as MeshInstance3D
		if instance.mesh == null: continue
		var veil := ash
		if instance.name.begins_with("Knight"):
			var armor := instance.get_active_material(0) as StandardMaterial3D
			if armor != null:
				veil = ash.duplicate()
				veil.set_shader_parameter("tint", armor.albedo_color)
				veil.set_shader_parameter("color_map", armor.albedo_texture)
				veil.set_shader_parameter("normal_map", armor.normal_texture)
				veil.set_shader_parameter("metal", armor.metallic)
				veils.append(veil)
		parts.append(instance)
		originals.append(instance.material_override)
		instance.material_override = veil
	if departing: release(0.0, figure.get_parent().scale.y)
	age = 0.0

func advance(delta: float, state: String, actor_scale: float) -> void:
	if parts.is_empty(): return
	if Preferences.reduced_effects:
		clear()
		return
	if departing: return
	age += delta
	if age >= .82 or state not in ["idle", "guard"]:
		clear()
		return
	var front := lerpf(-.11, 2.75 * actor_scale, smoothstep(0.0, .82, age))
	for material in veils: material.set_shader_parameter("height", front)

# The actor has already played its fall. The low sweep travels across its
# settled armor while sparks carry the seal back to the gate.
func release(fraction: float, actor_scale: float) -> void:
	if not departing: return
	var front := lerpf(1.68 * actor_scale, -.36, smoothstep(0.0, .80, fraction))
	for material in veils: material.set_shader_parameter("height", front)

func clear() -> void:
	departing = false
	for i in parts.size():
		if is_instance_valid(parts[i]): parts[i].material_override = originals[i]
	parts.clear()
	originals.clear()
	veils.clear()
