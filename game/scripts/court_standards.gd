class_name CourtStandards
extends Node3D

var fabric := ShaderMaterial.new()

func _ready() -> void:
	fabric.shader = preload("res://assets/court/shore_standard.gdshader")
	fabric.set_shader_parameter("embroidery", load("res://assets/court/shore_standard.webp"))
	var cloth := cut_standard()
	for side in [-1, 1]:
		hang(cloth, Vector3(side * 3.76, 4.5, -12.62), 0.0, 1.0)
		var angle := deg_to_rad(side * 36.0)
		var bay := Vector3(sin(angle) * 14.8, 0, -cos(angle) * 14.8)
		var pier := Vector3(side * 2.02, 3.08, .55).rotated(Vector3.UP, -angle)
		hang(cloth, bay + pier, -angle, .72)

func hang(cloth: ArrayMesh, at: Vector3, yaw: float, size: float) -> void:
	var mount := Node3D.new()
	add_child(mount)
	mount.position = at
	mount.rotation.y = yaw
	mount.scale = Vector3.ONE * size
	var bronze := Color("93784b")
	for x in [-.36, .36]:
		var shoe := Figure.box(mount, Vector3(.15, .20, .15), Vector3(x, .04, -.13), bronze)
		shoe.rotation.z = PI * .25
		Figure.box(mount, Vector3(.074, .074, .32), Vector3(x, .035, -.055), bronze)
	var rod := Figure.cylinder(mount, .036, .036, 1.76, Vector3.UP * .035, bronze, 10)
	rod.rotation.z = PI * .5
	for x in [-.9, .9]:
		var finial := Figure.box(mount, Vector3(.11, .11, .11), Vector3(x, .035, 0), bronze)
		finial.rotation.z = PI * .25
	var banner := MeshInstance3D.new()
	banner.name = "EmbroideredStandard"
	banner.mesh = cloth
	banner.material_override = fabric
	banner.extra_cull_margin = .35
	mount.add_child(banner)

# The selvedge falls into a shallow point at the centre. The crossbar holds
# the whole top edge. Normals on the pleats follow the wind in the shader.
static func cut_standard() -> ArrayMesh:
	var vertices := PackedVector3Array()
	var uvs := PackedVector2Array()
	var normals := PackedVector3Array()
	var indices := PackedInt32Array()
	var columns := 18
	var rows := 16
	for row in rows + 1:
		for column in columns + 1:
			var uv := Vector2(float(column) / columns, float(row) / rows)
			var hem := 2.24 + .22 * (1.0 - absf(uv.x * 2.0 - 1.0))
			vertices.append(Vector3((uv.x - .5) * 1.5, -uv.y * hem, 0))
			uvs.append(uv)
			normals.append(Vector3.BACK)
			if column < columns and row < rows:
				var left := row * (columns + 1) + column
				indices.append_array([left, left + 1, left + columns + 1, left + 1, left + columns + 2, left + columns + 1])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_TEX_UV] = uvs
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return mesh

func set_wind(time: float) -> void:
	fabric.set_shader_parameter("wind_time", time)
