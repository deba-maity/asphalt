class_name SealFlight
extends MultiMeshInstance3D

var glow := ShaderMaterial.new()

func carry(source: Vector3, destination: Vector3, accent: Color) -> void:
	position = source
	var travel := destination - source
	var spark := SphereMesh.new()
	spark.radius = .033
	spark.height = .092
	spark.radial_segments = 6
	spark.rings = 2
	multimesh = MultiMesh.new()
	multimesh.transform_format = MultiMesh.TRANSFORM_3D
	multimesh.use_custom_data = true
	multimesh.mesh = spark
	multimesh.instance_count = 20
	for i in multimesh.instance_count:
		multimesh.set_instance_transform(i, Transform3D.IDENTITY)
		multimesh.set_instance_custom_data(i, Color(float(i) / multimesh.instance_count, fposmod(i * .618, 1.0), 0.0))
	glow.shader = preload("res://assets/court/seal_flight.gdshader")
	glow.set_shader_parameter("travel", travel)
	glow.set_shader_parameter("accent", accent)
	material_override = glow
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	custom_aabb = AABB(Vector3.ZERO, Vector3.ZERO).expand(travel).grow(2.4)

func show_progress(fraction: float) -> void:
	glow.set_shader_parameter("progress", clampf(fraction, 0.0, 1.0))
