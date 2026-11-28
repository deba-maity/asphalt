class_name ShoreGate
extends Node3D

# The central section of the north wall opens onto the path after the duel.
signal marked(earned: int)

var leaves: Array[Node3D] = []
var seals: Array[MeshInstance3D] = []
var closed_barrier: StaticBody3D
var lit: StandardMaterial3D
var unlit: StandardMaterial3D
var inlay := ShaderMaterial.new()
var open := false

func _ready() -> void:
	var portal := preload("res://assets/court/large_castle_door/large_castle_door.gltf").instantiate() as Node3D
	portal.scale = Vector3.ONE * 1.6
	add_child(portal)
	inlay.shader = preload("res://assets/court/gate_bronze.gdshader")
	for side in ["left", "right"]:
		var leaf := portal.find_child("large_castle_door_" + side, true, false) as Node3D
		leaves.append(leaf)
		GateInlay.mount(leaf, -1.0 if side == "left" else 1.0, inlay)
	var bronze := SurfaceLibrary.material("steel", Color("9a7852"), 1.4)
	unlit = SurfaceLibrary.material("stone", Color("443d38"), 1.2)
	lit = StandardMaterial3D.new()
	lit.albedo_color = Color("ffcf83")
	lit.emission_enabled = true
	lit.emission = Color("ff9949")
	lit.emission_energy_multiplier = 1.3
	var lintel := Figure.box(self,Vector3(1.72,.095,.075),Vector3(-.07,3.70,.19),Color.WHITE)
	lintel.material_override = bronze
	for i in 3:
		var seal := Figure.box(self,Vector3(.14,.14,.07),Vector3((i - 1)*.46 - .07,3.70,.25),Color.WHITE)
		seal.rotation.z = PI / 4
		seal.material_override = unlit
		seals.append(seal)
	closed_barrier = StaticBody3D.new()
	closed_barrier.collision_layer = 1
	closed_barrier.collision_mask = 0
	var boundary := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(3.1,4.2,.25)
	boundary.position.y = 2.1
	boundary.shape = box
	closed_barrier.add_child(boundary)
	add_child(closed_barrier)

func mark(earned: int) -> void:
	inlay.set_shader_parameter("remembered", float(clampi(earned, 0, seals.size())))
	marked.emit(clampi(earned, 0, seals.size()))
	for i in seals.size():
		seals[i].material_override = lit if i < earned else unlit

# A bearing straight to the exit from either flank runs into a stone jamb.
# Lead walkers to the middle of the doorway before directing them through it.
const APPROACH_DISTANCE := 3.15

func route_target(walker: Vector3, exit: Vector3) -> Vector3:
	if absf(walker.x - global_position.x) < .75: return exit
	return to_global(Vector3(0, 0, APPROACH_DISTANCE))

func unseal(immediate: bool = false) -> void:
	if open:
		if immediate:
			for i in leaves.size(): leaves[i].rotation.y = deg_to_rad(88 if i == 0 else -88)
		return
	open = true
	closed_barrier.collision_layer = 0
	mark(seals.size())
	for z in [APPROACH_DISTANCE, 2.05, .95]:
		for side in [-1, 1]:
			var guide_mark := Figure.box(self, Vector3(.10, .024, .52), Vector3(side * .15, .045, z), Color.WHITE)
			guide_mark.rotation.y = side * .57
			guide_mark.material_override = lit
	for i in leaves.size():
		var angle := deg_to_rad(88 if i == 0 else -88)
		if immediate or Preferences.reduced_effects: leaves[i].rotation.y = angle
		else: create_tween().set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT).tween_property(leaves[i], "rotation:y", angle, 1.1)
