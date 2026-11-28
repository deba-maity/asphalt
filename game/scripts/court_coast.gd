class_name CourtCoast
extends Node3D

var water := ShaderMaterial.new()
var watch := ShoreWatch.new()

func _ready() -> void:
	var bank := MeshInstance3D.new()
	bank.name = "RockyShore"
	bank.mesh = headland()
	bank.set_surface_override_material(0, CourtArt.material("forest_ground_04", .35))
	bank.set_surface_override_material(1, CourtArt.material("castle_brick_07", .28))
	add_child(bank)
	var sea := MeshInstance3D.new()
	sea.name = "TidalWater"
	var plane := PlaneMesh.new()
	plane.size = Vector2(340, 340)
	plane.subdivide_width = 55
	plane.subdivide_depth = 55
	sea.mesh = plane
	sea.position.y = -1.7
	water.shader = preload("res://assets/court/shore_water.gdshader")
	sea.material_override = water
	sea.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(sea)
	sea_stacks()
	watch.position = Vector3(-25.5, 0, -46)
	add_child(watch)

static func coastline(angle: float) -> float:
	return 21.7 + 1.5 * sin(3.0 * angle + .2) + 1.1 * cos(5.0 * angle) + .52 * sin(9.0 * angle)

static func ledge(angle: float, row: int) -> Vector3:
	var radius := coastline(angle)
	var extension: float = [0.0, .40, 1.9, 3.3][row]
	var height: float = [-.09, -.54, -1.91, -3.0][row]
	var cut := sin(angle * 13.0 + row * .6)
	var point := Vector3(cos(angle), 0, sin(angle)) * (radius + extension + .34 * cut)
	point.y = height + .11 * cut if row > 0 else height
	return point

static func headland() -> ArrayMesh:
	var top := SurfaceTool.new()
	var face := SurfaceTool.new()
	top.begin(Mesh.PRIMITIVE_TRIANGLES)
	face.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 96:
		var a := TAU * i / 96.0
		var b := TAU * (i + 1) / 96.0
		for point in [Vector3.DOWN * .09, ledge(a, 0), ledge(b, 0)]:
			top.set_normal(Vector3.UP)
			top.set_uv(Vector2(point.x, point.z) * .20)
			top.add_vertex(point)
		for row in 3:
			var upper_left := ledge(a, row)
			var lower_left := ledge(a, row + 1)
			var upper_right := ledge(b, row)
			var lower_right := ledge(b, row + 1)
			for point in [upper_left, lower_left, upper_right, upper_right, lower_left, lower_right]:
				face.set_uv(Vector2(point.x + point.z, point.y) * .28)
				face.add_vertex(point)
	face.generate_normals()
	var mesh := top.commit()
	face.commit(mesh)
	return mesh

func sea_stacks() -> void:
	var rocks: Node3D = load("res://assets/court/rock_moss_set_01/rock_moss_set_01.gltf").instantiate()
	var shapes := rocks.find_children("*", "MeshInstance3D", true, false)
	var slate := (shapes[0] as MeshInstance3D).get_active_material(0).duplicate() as StandardMaterial3D
	slate.albedo_color = Color("657779")
	slate.roughness = .91
	slate.metallic = 0
	var shelves := [
		[Vector3(-29, -2.15, -38), Vector3(6.1, 7.6, 4.2)],
		[Vector3(-23, -2.25, -36), Vector3(2.3, 4.1, 2.3)],
		[Vector3(31, -2.57, -54), Vector3(3.8, 8.1, 4.8)],
		[Vector3(38, -2.77, -51), Vector3(3.0, 4.4, 4.0)],
		[Vector3(53, -2.4, 19), Vector3(5.8, 4.1, 3.4)],
		[Vector3(-42, -2.3, 22), Vector3(6.5, 3.9, 4.8)],
		[Vector3(-35, -2.1, 25), Vector3(2.1, 2.4, 1.9)]
	]
	for i in shelves.size():
		var stack := shapes[i % shapes.size()].duplicate() as MeshInstance3D
		stack.name = "OffshoreRock%d" % (i + 1)
		stack.material_override = slate
		stack.position = shelves[i][0]
		stack.scale = shelves[i][1]
		stack.rotation.y = i * 1.17 + .4
		add_child(stack)
	rocks.free()

func set_tide(time: float) -> void:
	water.set_shader_parameter("tide_time", time)
	watch.set_wind(time)
