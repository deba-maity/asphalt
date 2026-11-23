class_name ArtDirection
extends RefCounted

static func environment(theme: String, sky: Sky = null) -> Environment:
	var env=Environment.new()
	var dark=theme in ["ashes","cinders"]
	var cold=theme in ["mill","fortress","returned","ashes"]
	var horizon := Color("44515a") if dark else (Color("9daaa8") if cold else Color("b9b09b"))
	if sky == null:
		var sky_material := ProceduralSkyMaterial.new()
		sky_material.sky_top_color = Color("182832") if dark else Color("435d70")
		sky_material.sky_horizon_color = horizon
		sky_material.ground_bottom_color = Color("202628")
		sky_material.ground_horizon_color = horizon
		sky_material.sky_curve = .18
		sky = Sky.new()
		sky.sky_material = sky_material
	env.sky=sky
	env.background_mode=Environment.BG_SKY
	env.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color=Color("a4b9ca")
	env.ambient_light_energy=.36 if dark else .38
	env.reflected_light_source=Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode=Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure=1.12
	env.fog_enabled=true
	env.fog_light_color=horizon
	env.fog_density=.012 if dark else .0045
	return env

static func ground(node: Node, theme: String) -> void:
	var m=ShaderMaterial.new()
	m.shader=preload("res://assets/surfaces/ground.gdshader")
	m.set_shader_parameter("earth_map",preload("res://assets/surfaces/earth.png"))
	m.set_shader_parameter("normal_map",preload("res://assets/surfaces/earth_normal.png"))
	if theme in ["ashes","cinders"]:
		m.set_shader_parameter("ground_tint",Color("3c4447"))
		m.set_shader_parameter("path_tint",Color("686762"))
	for child in node.get_children():
		if child is MeshInstance3D: child.material_override=m
