class_name ShoreWatch
extends Node3D

# The beacon carved on the second relief stands beyond the court on a sea rock.
var lantern := StandardMaterial3D.new()
var flock := ShaderMaterial.new()

func _ready() -> void:
	var masonry := SurfaceTool.new()
	var metal := SurfaceTool.new()
	masonry.begin(Mesh.PRIMITIVE_TRIANGLES)
	metal.begin(Mesh.PRIMITIVE_TRIANGLES)
	# radius at foot, radius at crown, height and height of the centre
	for course in [
		[4.05, 2.35, 3.8, -.25], [2.03,1.87,.44,1.76], [1.64,1.05,6.34,5.09],
		[1.75,1.68,.21,2.13], [1.44,1.40,.12,5.28], [1.10,1.38,.32,8.35]
	]:
		round_course(masonry, course[0], course[1], course[2], course[3], 18)
	round_course(metal, 1.45, 1.44, .14, 8.57, 12)
	round_course(metal, 1.32, 1.32, .13, 9.96, 8)
	round_course(metal, 1.50, .15, .95, 10.50, 8)
	round_course(metal, .095, .044, .52, 11.12, 8)
	var bar := BoxMesh.new()
	bar.size = Vector3(.105, 1.33, .105)
	for i in 8:
		var angle := TAU * i / 8.0
		metal.append_from(bar, 0, Transform3D(Basis(Vector3.UP,angle),Vector3(sin(angle),0,cos(angle)) * .99 + Vector3.UP*9.27))
	for surface in [masonry, metal]:
		var piece := MeshInstance3D.new()
		piece.mesh = surface.commit()
		piece.material_override = CourtArt.material("castle_brick_07", .59) if surface == masonry else SurfaceLibrary.material("steel", Color("655c4b"), .92)
		add_child(piece)
	var light_mesh := CylinderMesh.new()
	light_mesh.radial_segments = 8
	light_mesh.rings = 1
	light_mesh.bottom_radius = .89
	light_mesh.top_radius = .89
	light_mesh.height = 1.24
	var light_box := MeshInstance3D.new()
	light_box.name = "LanternRoom"
	light_box.mesh = light_mesh
	light_box.position.y = 9.27
	lantern.roughness = .31
	lantern.emission_enabled = true
	light_box.material_override = lantern
	add_child(light_box)
	remember(0)
	make_gulls()

static func round_course(tool: SurfaceTool, lower: float, upper: float, h: float, y: float, sides: int) -> void:
	var form := CylinderMesh.new()
	form.bottom_radius = lower
	form.top_radius = upper
	form.height = h
	form.rings = 1
	form.radial_segments = sides
	tool.append_from(form, 0, Transform3D(Basis.IDENTITY, Vector3.UP * y))

func remember(earned: int) -> void:
	var lit := earned >= 2
	lantern.albedo_color = Color("caa367") if lit else Color("526778")
	lantern.emission = Color("ffb85d") if lit else Color("61747e")
	lantern.emission_energy_multiplier = .99 if lit else .12

func make_gulls() -> void:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for side in [-1, 1]:
		var shoulder := Vector3(side * .08, 0, 0)
		var elbow := Vector3(side * .48, .14, -.025)
		var wrist := Vector3(side * .72, .14, .015)
		var tip := Vector3(side * 1.03, -.015, .08)
		var trailing := Vector3(side * .48, .09, .23)
		for p in [shoulder, elbow, trailing, elbow, wrist, trailing, wrist, tip, trailing,
				shoulder, trailing, Vector3(0,-.03,.20), Vector3(0,.015,-.24), shoulder, Vector3(0,-.03,.20)]:
			tool.add_vertex(p)
	tool.generate_normals()
	var birds := MultiMeshInstance3D.new()
	birds.name = "CirclingGulls"
	birds.multimesh = MultiMesh.new()
	birds.multimesh.transform_format = MultiMesh.TRANSFORM_3D
	birds.multimesh.use_custom_data = true
	birds.multimesh.mesh = tool.commit()
	birds.multimesh.instance_count = 4
	for i in birds.multimesh.instance_count:
		birds.multimesh.set_instance_transform(i, Transform3D.IDENTITY)
		birds.multimesh.set_instance_custom_data(i, Color(i / 4.0, (i % 3) * .42, 0, 1))
	birds.custom_aabb = AABB(Vector3(-23, 6, -13), Vector3(46, 16, 26))
	flock.shader = preload("res://assets/court/shore_gulls.gdshader")
	birds.material_override = flock
	birds.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(birds)

func set_wind(time: float) -> void:
	flock.set_shader_parameter("shore_time", time)
