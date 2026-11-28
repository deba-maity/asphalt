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
	var flags := SurfaceTool.new()
	flags.begin(Mesh.PRIMITIVE_TRIANGLES)
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
		var bedding := CourtArt.beveled_box(Vector3(3.14, .20, span + .065))
		stones.append_from(bedding, 0, deck * Transform3D(Basis.IDENTITY, Vector3.DOWN * .22))
		var widths := [.82, 1.36, .94] if i % 2 == 0 else [1.34, .88, .90]
		var edge := -1.56
		for width: float in widths:
			var local := Vector3(edge + width * .5, -.15, 0)
			var tile := CourtArt.beveled_box(Vector3(width - .012, .3, span - .016))
			flags.append_from(tile, 0, deck * Transform3D(Basis.IDENTITY, local))
			edge += width
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
	var bridge_mesh := stones.commit()
	flags.commit(bridge_mesh)
	surface.mesh = bridge_mesh
	surface.set_surface_override_material(0, CourtArt.material("castle_brick_07", .45))
	var flagstone := ShaderMaterial.new()
	flagstone.shader = preload("res://assets/court/causeway_flags.gdshader")
	flagstone.set_shader_parameter("grain", preload("res://assets/court/forest_ground_04/Diffuse.jpg"))
	surface.set_surface_override_material(1, flagstone)
	add_child(surface)

	make_landing()

func make_landing() -> void:
	var destination := centre(32.5)
	var top := SurfaceTool.new()
	var cliff := SurfaceTool.new()
	top.begin(Mesh.PRIMITIVE_TRIANGLES)
	cliff.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 48:
		var a := i * TAU / 48.0
		var b := (i + 1) * TAU / 48.0
		var left := island_edge(a, 0)
		var right := island_edge(b, 0)
		for point in [Vector3(.15,.65,-.45), left, right]:
			top.set_uv(Vector2(point.x, point.z) * .18)
			top.add_vertex(point)
		for row in 3:
			var lo := island_edge(a, row + 1)
			var hi := island_edge(b, row + 1)
			var quad := [left, lo, right, hi]
			for index in [0, 1, 2, 2, 1, 3]:
				var point: Vector3 = quad[index]
				var around: float = (a if index < 2 else b) * 1.4
				cliff.set_uv(Vector2(around, point.y))
				cliff.add_vertex(point)
			left = lo
			right = hi
	top.generate_normals()
	cliff.generate_normals()
	var mesh := top.commit()
	cliff.commit(mesh)
	var faces := ShaderMaterial.new()
	faces.shader = preload("res://assets/court/tidal_cliff.gdshader")
	faces.set_shader_parameter("grain", preload("res://assets/court/forest_ground_04/Diffuse.jpg"))
	var island := MeshInstance3D.new()
	island.name = "FarLanding"
	island.mesh = mesh
	island.set_surface_override_material(0, CourtArt.material("forest_ground_04", .40))
	island.set_surface_override_material(1, faces)
	island.position = Vector3(destination.x, 0, destination.z)
	add_child(island)
	add_tidal_rocks(island)
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

func add_tidal_rocks(island: MeshInstance3D) -> void:
	# Low spurs anchor the landing in the tide and leave the causeway mouth clear.
	var collection := preload("res://assets/court/rock_moss_set_01/rock_moss_set_01.gltf").instantiate()
	var source := collection.find_child("rock_moss_set_01_rock03", true, false) as MeshInstance3D
	var rocks := MultiMesh.new()
	rocks.transform_format = MultiMesh.TRANSFORM_3D
	rocks.mesh = source.mesh
	var shelves := [
		[Vector3(-5.7,-.72,2.2), Vector3(2.36,1.40,1.35), -.58],
		[Vector3(-7.1,-1.37,3.2), Vector3(1.47,.81,1.03), .44],
		[Vector3(5.3,-.85,3.6), Vector3(1.98,1.33,1.52), .80],
		[Vector3(7.6,-1.58,4.6), Vector3(1.08,.72,.91), .56],
		[Vector3(7.9,-1.34,-1.4), Vector3(1.82,1.08,1.30), -.23]
	]
	rocks.instance_count = shelves.size()
	for i in shelves.size():
		var item: Array = shelves[i]
		var basis := Basis(Vector3.UP, float(item[2])) * Basis.from_scale(item[1])
		rocks.set_instance_transform(i, Transform3D(basis, item[0]))
	var outcrops := MultiMeshInstance3D.new()
	outcrops.name = "TidalOutcrops"
	outcrops.multimesh = rocks
	outcrops.material_override = source.get_active_material(0)
	outcrops.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	island.add_child(outcrops)
	collection.free()

static func island_edge(angle: float, row: int) -> Vector3:
	var cut := .49 * sin(angle * 5.0) + .34 * cos(angle * 9.0)
	var radius: float = [0.0, .23, 1.42, 2.82][row]
	var tide: float = [.44, -.34, -1.48, -3.48][row]
	var x := cos(angle) * (6.08 + radius + cut)
	var z := sin(angle) * (4.70 + radius * 1.10 + cut)
	var y := tide + .13 * sin(angle * 3.0) + .11 * cos(angle * 8.0 + row * .42)
	return Vector3(x, y, z)
