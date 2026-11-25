class_name EchoRegalia
extends MeshInstance3D

static var crests: Dictionary = {}
var bronze := ShaderMaterial.new()

static func fit(figure: PerformanceFigure, oath: int) -> EchoRegalia:
	var rig := figure.body_skeleton
	var head := rig.find_bone("Head")
	var socket := BoneAttachment3D.new()
	socket.bone_name = "Head"
	rig.add_child(socket)
	var circlet := EchoRegalia.new()
	circlet.name = "CinderCrown" if oath == TrialPassage.WARDEN else "PilgrimCirclet"
	socket.add_child(circlet)
	# This is the helmet's measured brow in the unposed mesh. Convert it to
	# head space so hits, turns and falls carry the circlet with the armor.
	circlet.transform = rig.get_bone_global_rest(head).affine_inverse() * Transform3D(Basis.IDENTITY, Vector3(0, 1.758, -.004))
	if not crests.has(oath): crests[oath] = forge(oath)
	circlet.mesh = crests[oath]
	circlet.bronze.shader = preload("res://assets/performance/echo_bronze.gdshader")
	circlet.bronze.set_shader_parameter("metal_color", [Color("728f87"), Color("8eabab"), Color("bd9665"), Color("a37c4f")][oath])
	circlet.material_override = circlet.bronze
	figure.cape.material_override.set_shader_parameter("oath", oath)
	return circlet

static func ring_point(angle: float, y: float, scale: float) -> Vector3:
	return Vector3(sin(angle) * .112 * scale, y, cos(angle) * .136 * scale)

static func face(tool: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, gleam: float) -> void:
	tool.set_color(Color(gleam, gleam, gleam))
	for point in [a, b, c]: tool.add_vertex(point)

static func forge(oath: int) -> ArrayMesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	var thickness := .014 if oath < TrialPassage.WARDEN else .026
	for i in 36:
		var a := TAU * i / 36
		var b := TAU * (i + 1) / 36
		var low := ring_point(a, -.004, 1.0)
		var high := ring_point(a, thickness, .995)
		var next_low := ring_point(b, -.004, 1.0)
		var next_high := ring_point(b, thickness, .995)
		face(tool, low, high, next_low, .41)
		face(tool, next_low, high, next_high, .41)
		face(tool, high, ring_point(a, thickness + .003, .96), next_high, .85)
		face(tool, next_high, ring_point(a, thickness + .003, .96), ring_point(b, thickness + .003, .96), .85)
	var ray_count := 7 if oath == TrialPassage.WARDEN else oath + 1
	for i in ray_count:
		var angle := TAU * i / ray_count if oath == TrialPassage.WARDEN else (i - (ray_count - 1) * .5) * .52
		var height := (.14 + .067 * cos(angle * 3.0)) if oath == TrialPassage.WARDEN else (.037 + .011 * oath)
		var width := .20 if oath == TrialPassage.WARDEN else .16
		var left := ring_point(angle-width, thickness-.006, 1.0)
		var right := ring_point(angle+width, thickness-.006, 1.0)
		var top := ring_point(angle+.085, thickness+height, 1.05)
		var ridge := ring_point(angle, thickness+height*.32, 1.18)
		face(tool, left, top, ridge, .67)
		face(tool, right, ridge, top, .93)
		face(tool, left, ridge, right, .45)
	tool.generate_normals()
	return tool.commit()
