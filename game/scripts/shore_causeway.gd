class_name ShoreCauseway
extends Node3D

var needles := ShaderMaterial.new()

# The road past the north gate remains visible from the court. Its parapet
# falls away as the old bridge reaches the tidal rocks.
static func centre(distance: float) -> Vector3:
	return Vector3(.0065 * distance * distance, .035 + maxf(0, distance - 7.0) * .025, -11.1 - distance)

func _ready() -> void:
	var stones := SurfaceTool.new()
	stones.begin(Mesh.PRIMITIVE_TRIANGLES)
	var walking := StaticBody3D.new()
	walking.name = "CausewayDeck"
	walking.collision_layer = 1
	walking.collision_mask = 0
	add_child(walking)
	for i in 18:
		var a := centre(i * 1.65)
		var b := centre((i + 1) * 1.65)
		var middle := (a + b) * .5
		var basis := Basis.looking_at(b - a, Vector3.UP)
		var span := a.distance_to(b)
		var deck := Transform3D(basis, middle)
		for lane in 3:
			var local := Vector3((lane - 1) * 1.04, -.15, 0)
			var tile := CourtArt.beveled_box(Vector3(1.03, .3, span - .016))
			stones.append_from(tile, 0, deck * Transform3D(Basis.IDENTITY, local))
		var support := CollisionShape3D.new()
		var plinth := BoxShape3D.new()
		plinth.size = Vector3(3.14, .34, span + .025)
		support.shape = plinth
		support.transform = deck * Transform3D(Basis.IDENTITY, Vector3.DOWN * .165)
		walking.add_child(support)
		for side in [-1, 1]:
			# The jamb and gate leaves occupy the first two metres.
			if i == 0: continue
			var broken := (i + (1 if side < 0 else 5)) % 9 == 0
			var height := .19 if broken else (.52 if i < 10 else .34)
			var curb := CourtArt.beveled_box(Vector3(.32, height, span - .055))
			stones.append_from(curb, 0, deck * Transform3D(Basis.IDENTITY, Vector3(side * 1.55, height * .44, 0)))
			if i % 4 == 2 and not broken:
				var pier := CourtArt.beveled_box(Vector3(.48, .85, .55))
				stones.append_from(pier, 0, deck * Transform3D(Basis.IDENTITY, Vector3(side * 1.57, .375, -.62)))
		if i >= 5 and i % 3 == 2:
			var footing := CourtArt.beveled_box(Vector3(3.5, 3.15, .86))
			stones.append_from(footing, 0, deck * Transform3D(Basis.IDENTITY, Vector3.DOWN * 1.64))
	var surface := MeshInstance3D.new()
	surface.name = "WeatheredCauseway"
	surface.mesh = stones.commit()
	surface.material_override = CourtArt.material("castle_brick_07", .45)
	add_child(surface)

	make_landing()

func make_landing() -> void:
	var destination := centre(32.5)
	var stone := SurfaceTool.new()
	stone.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 36:
		var a := i * TAU / 36.0
		var b := (i + 1) * TAU / 36.0
		var left := island_edge(a, 0)
		var right := island_edge(b, 0)
		for point in [Vector3.UP * .55, left, right]:
			stone.set_uv(Vector2(point.x, point.z) * .15)
			stone.add_vertex(point)
		for depth in 2:
			var lo := island_edge(a, depth + 1)
			var hi := island_edge(b, depth + 1)
			for point in [left, lo, right, right, lo, hi]:
				stone.set_uv(Vector2(point.x + point.z, point.y) * .2)
				stone.add_vertex(point)
			left = lo
			right = hi
	stone.generate_normals()
	var island := MeshInstance3D.new()
	island.name = "FarLanding"
	island.mesh = stone.commit()
	island.material_override = CourtArt.material("forest_ground_04", .40)
	island.position = Vector3(destination.x, 0, destination.z)
	add_child(island)
	var tree := MeshInstance3D.new()
	var crown := QuadMesh.new()
	crown.size = Vector2(10.3, 6.86)
	# Root flare is a quarter of the way across the photograph.
	crown.center_offset = Vector3(2.57, 3.27, 0)
	crown.subdivide_width = 5
	crown.subdivide_depth = 5
	tree.mesh = crown
	tree.position = island.position + Vector3(.4, .48, -1.5)
	tree.rotation.y = -.14
	needles.shader = preload("res://assets/court/headland_pine.gdshader")
	needles.set_shader_parameter("boughs", load("res://assets/court/headland_pine.webp"))
	tree.material_override = needles
	add_child(tree)

static func island_edge(angle: float, row: int) -> Vector3:
	var cut := .36 * sin(angle * 5.0) + .24 * cos(angle * 9.0)
	var x := cos(angle) * (6.1 + row * 1.42 + cut)
	var z := sin(angle) * (4.8 + row * 1.64 + cut)
	var drop: float = [0.0, .93, 3.65][row]
	var y := .5 + .11 * sin(angle * 3.0) - drop
	return Vector3(x, y, z)
