class_name ShoreEmber
extends Node3D

static var shared_flame: ArrayMesh
var fire := ShaderMaterial.new()
var cinders := ShaderMaterial.new()
var glow := OmniLight3D.new()
var clock := 0.0

func _ready() -> void:
	var plinth := Figure.cylinder(self, .68, .58, .24, Vector3.UP * .14, Color.WHITE, 12)
	plinth.material_override = CourtArt.material("castle_brick_07", 1.4)
	var basin := Figure.cylinder(self, .28, .43, .19, Vector3.UP * .36, Color.WHITE, 24)
	basin.material_override = SurfaceLibrary.material("steel", Color("67523b"), 1.1)
	var coals := Figure.cylinder(self, .36, .36, .025, Vector3.UP * .47, Color("442820"), 24)
	coals.material_override = SurfaceLibrary.material("stone", Color("442820"), 2.0)
	var ember_bed := StandardMaterial3D.new()
	ember_bed.albedo_color = Color("482820")
	ember_bed.emission_enabled = true
	ember_bed.emission = Color("d45a30")
	ember_bed.emission_energy_multiplier = .42
	for index in 9:
		var angle := index * TAU / 9
		var coal := Figure.cylinder(self, .072, .086, .057, Vector3(cos(angle) * .235, .497, sin(angle) * .235), Color.WHITE, 5)
		coal.rotation.y = angle * 3.2
		coal.material_override = ember_bed
	var flame := MeshInstance3D.new()
	flame.mesh = flame_mesh()
	fire.shader = preload("res://assets/court/ember_flame.gdshader")
	flame.material_override = fire
	flame.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	flame.position.y = .5
	flame.extra_cull_margin = .1
	add_child(flame)
	cinders.shader = preload("res://assets/court/ember_cinder.gdshader")
	var sparks := MultiMeshInstance3D.new()
	var mote := PrismMesh.new()
	mote.size = Vector3(.013, .032, .013)
	sparks.multimesh = MultiMesh.new()
	sparks.multimesh.transform_format = MultiMesh.TRANSFORM_3D
	sparks.multimesh.use_custom_data = true
	sparks.multimesh.mesh = mote
	sparks.multimesh.instance_count = 11
	for index in sparks.multimesh.instance_count:
		sparks.multimesh.set_instance_transform(index, Transform3D.IDENTITY)
		sparks.multimesh.set_instance_custom_data(index, Color(float(index) / 11, 0, 0))
	sparks.custom_aabb = AABB(Vector3(-.35, 0, -.35), Vector3(.8, 1, .7))
	sparks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sparks.material_override = cinders
	sparks.position.y = .68
	add_child(sparks)
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = .91
	torus.outer_radius = .95
	torus.rings = 32
	torus.ring_segments = 6
	ring.mesh = torus
	var ring_ink := StandardMaterial3D.new()
	ring_ink.albedo_color = Color("bf995b")
	ring_ink.metallic = .5
	ring.material_override = ring_ink
	ring.position.y = .05
	add_child(ring)
	glow.light_color = Color("ffbb68")
	glow.light_energy = 1.7
	glow.omni_range = 4
	glow.position.y = .85
	add_child(glow)

# Five tapered tongues are one opaque mesh. Their independent motion leaves
# real gaps between the outer flames, visible from either side of the altar.
static func flame_mesh() -> ArrayMesh:
	if shared_flame != null: return shared_flame
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var radii := [0.61, 1.0, .76, .49, .27, .09, .017]
	for tongue in 5:
		var angle := tongue * TAU / 4.0
		var spread := .13 if tongue < 4 else 0.0
		var width := .092 if tongue < 4 else .132
		var height := [.35, .43, .31, .39, .54][tongue] as float
		var base := Vector3(cos(angle), 0, sin(angle)) * spread
		for row in 6:
			for side in 8:
				for corner in [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]]:
					var r: int = row + corner[0]
					var u: float = (side + corner[1]) / 8.0
					var v := r / 6.0
					var phi := u * TAU
					var wave := Vector3(cos(phi), 0, sin(phi)) * float(radii[r]) * width
					var blade_tip := Vector3(.07 * sin(angle + v * 3.6), 0, .06 * cos(angle + v * 4.2)) * v
					tool.set_uv(Vector2(u, v))
					tool.set_color(Color(tongue / 5.0, 1.0 if tongue == 4 else 0.0, 0))
					tool.add_vertex(base + wave + blade_tip + Vector3.UP * height * v)
	tool.generate_normals()
	shared_flame = tool.commit()
	return shared_flame

func _physics_process(delta: float) -> void:
	if not is_visible_in_tree() or Preferences.reduced_effects or get_tree().paused: return
	advance_fire(delta)

func advance_fire(delta: float) -> void:
	clock += delta
	fire.set_shader_parameter("fire_time", clock)
	cinders.set_shader_parameter("fire_time", clock)
	glow.light_energy = 1.68 + sin(clock * 3.7) * .11 + sin(clock * 5.9 + .7) * .065

static func bearing(hero: Fighter, point: Vector3) -> String:
	var offset := point - hero.global_position
	offset.y = 0
	var forward := -hero.camera.global_basis.z
	forward.y = 0
	var angle := forward.signed_angle_to(offset, Vector3.UP)
	var bearing := "ahead" if absf(angle) < .5 else ("behind" if absf(angle) > 2.6 else ("left" if angle > 0 else "right"))
	return "%d m %s" % [ceili(offset.length()), bearing]
