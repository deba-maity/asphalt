class_name ShoreEmber
extends Node3D

var flame: MeshInstance3D
var clock := 0.0

func _ready() -> void:
	var plinth := Figure.cylinder(self, .68, .58, .24, Vector3.UP * .14, Color.WHITE, 12)
	plinth.material_override = CourtArt.material("castle_brick_07", 1.4)
	var basin := Figure.cylinder(self, .28, .43, .19, Vector3.UP * .36, Color.WHITE, 24)
	basin.material_override = SurfaceLibrary.material("steel", Color("67523b"), 1.1)
	var coals := Figure.cylinder(self, .36, .36, .025, Vector3.UP * .47, Color("442820"), 24)
	coals.material_override = SurfaceLibrary.material("stone", Color("442820"), 2.0)
	var ember := StandardMaterial3D.new()
	ember.albedo_color = Color("ffdc91")
	ember.emission_enabled = true
	ember.emission = Color("ffac53")
	ember.emission_energy_multiplier = 1.7
	flame = MeshInstance3D.new()
	var gem := SphereMesh.new()
	gem.radial_segments = 5
	gem.rings = 2
	gem.radius = .105
	gem.height = .24
	flame.mesh = gem
	flame.material_override = ember
	flame.position.y = .71
	add_child(flame)
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
	var glow := OmniLight3D.new()
	glow.light_color = Color("ffbb68")
	glow.light_energy = 1.7
	glow.omni_range = 4
	glow.position.y = .85
	add_child(glow)

func _physics_process(delta: float) -> void:
	if not is_visible_in_tree() or Preferences.reduced_effects: return
	clock += delta
	flame.rotation.y = clock * .65
	flame.position.y = .71 + sin(clock * 2.3) * .045

static func bearing(hero: Fighter, point: Vector3) -> String:
	var offset := point - hero.global_position
	offset.y = 0
	var forward := -hero.camera.global_basis.z
	forward.y = 0
	var angle := forward.signed_angle_to(offset, Vector3.UP)
	var bearing := "ahead" if absf(angle) < .5 else ("behind" if absf(angle) > 2.6 else ("left" if angle > 0 else "right"))
	return "%d m %s" % [ceili(offset.length()), bearing]
