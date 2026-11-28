class_name GateInlay
extends RefCounted

# Raised bronze wire on the two actual door leaves. The inner edges meet
# at the seam when closed and follow their respective hinges into the passage.
static func mount(leaf: Node3D, side: float, material: ShaderMaterial) -> MeshInstance3D:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	# The leaf-local seam offsets are measured from the hinges of the portal model.
	var seam := .923 if side < 0 else -.950
	var paths: Array[PackedVector2Array] = []
	var groups: Array[int] = []
	var widths: Array[float] = []
	for radius in [.48, .452, .257]:
		var arc := PackedVector2Array()
		var end_angle := PI / 2 if radius < .3 else PI
		for i in 33:
			var angle := -PI / 2 + end_angle * i / 32.0 if radius > .3 else PI / 2 * i / 32.0
			arc.append(Vector2(cos(angle) * radius, sin(angle) * radius))
		paths.append(arc)
		groups.append(3 if radius > .46 else 1)
		widths.append(.010 if radius > .46 else .006)
	for i in 5:
		var angle := deg_to_rad(9.0 + 18.0 * i)
		var direction := Vector2.from_angle(angle)
		var ray := PackedVector2Array([direction * .287, direction * (.414 if i % 2 == 0 else .376)])
		paths.append(ray)
		groups.append(2)
		widths.append(.009)
	for row in 3:
		var wave := PackedVector2Array()
		var y := -.051 - row * .085
		var reach := sqrt(.419 * .419 - y * y)
		for i in 17:
			var x := reach * i / 16.0
			wave.append(Vector2(x, y + .012 * sin(x * TAU * 3.9 + row * .65)))
		paths.append(wave)
		groups.append(row + 1)
		widths.append(.008)
	for i in paths.size():
		var path := paths[i]
		var previous := PackedVector3Array()
		for j in path.size():
			var centre := path[j]
			var tangent := path[mini(j + 1, path.size() - 1)] - path[maxi(j - 1, 0)]
			var normal := tangent.normalized().orthogonal() * widths[i]
			var ring := PackedVector3Array()
			for offset in [-1, 0, 1]:
				var p: Vector2 = centre + normal * offset
				ring.append(Vector3(seam + side * p.x, .25 + p.y, .044 if offset == 0 else .036))
			if j > 0:
				for strip in 2:
					var corners := [previous[strip], ring[strip], ring[strip + 1], previous[strip + 1]]
					if (corners[1] - corners[0]).cross(corners[2] - corners[0]).z > 0: corners.reverse()
					for k in [0, 1, 2, 0, 2, 3]:
						tool.set_color(Color(groups[i] / 3.0, 0.0, 0.0))
						tool.add_vertex(corners[k])
			previous = ring
	tool.generate_normals()
	var wire := MeshInstance3D.new()
	wire.name = "DawnInlay"
	wire.mesh = tool.commit()
	wire.material_override = material
	wire.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	leaf.add_child(wire)
	return wire
