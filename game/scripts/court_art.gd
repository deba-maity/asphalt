class_name CourtArt
extends RefCounted

static var materials: Dictionary={}
static var bevels: Dictionary={}

static func material(id: String, scale: float) -> StandardMaterial3D:
	var key=id+str(scale)
	if materials.has(key): return materials[key]
	var m=StandardMaterial3D.new()
	m.albedo_color=Color("a5adb2") if id=="castle_brick_07" else (Color("838c8e") if id=="cobblestone_floor_08" else Color("b6b9ac"))
	m.albedo_texture=load("res://assets/court/"+id+"/Diffuse.jpg")
	m.normal_enabled=true
	m.normal_texture=load("res://assets/court/"+id+"/nor_gl.jpg")
	m.roughness_texture=load("res://assets/court/"+id+"/arm.jpg")
	m.roughness_texture_channel=BaseMaterial3D.TEXTURE_CHANNEL_GREEN
	m.ao_enabled=true; m.ao_texture=m.roughness_texture
	m.ao_texture_channel=BaseMaterial3D.TEXTURE_CHANNEL_RED
	m.roughness=1
	m.uv1_triplanar=true; m.uv1_world_triplanar=true
	m.uv1_scale=Vector3.ONE*scale
	m.texture_filter=BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	materials[key]=m
	return m

static func polygon(st: SurfaceTool, points: Array[Vector3], normal: Vector3) -> void:
	var tangent=normal.cross(Vector3.UP if absf(normal.y)<.9 else Vector3.FORWARD).normalized()
	var bitangent=normal.cross(tangent).normalized()
	for index in range(1,points.size()-1):
		var tri=[points[0],points[index],points[index+1]]
		if (tri[1]-tri[0]).cross(tri[2]-tri[0]).dot(normal)>0: tri.reverse()
		for point in tri:
			st.set_normal(normal)
			st.set_uv(Vector2(point.dot(tangent),point.dot(bitangent)))
			st.add_vertex(point)

static func beveled_box(size: Vector3) -> ArrayMesh:
	var key=str(size)
	if bevels.has(key): return bevels[key]
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half=size*.5
	var bevel=minf(.055,minf(size.x,minf(size.y,size.z))*.13)
	var inner=half-Vector3.ONE*bevel
	for axis in 3:
		var u=(axis+1)%3; var v=(axis+2)%3
		for sign in [-1,1]:
			var points: Array[Vector3]=[]
			for corner in [Vector2(-1,-1),Vector2(1,-1),Vector2(1,1),Vector2(-1,1)]:
				var point=Vector3.ZERO; point[axis]=half[axis]*sign
				point[u]=inner[u]*corner.x; point[v]=inner[v]*corner.y
				points.append(point)
			var normal=Vector3.ZERO; normal[axis]=sign
			polygon(st,points,normal)
		for su in [-1,1]:
			for sv in [-1,1]:
				var points: Array[Vector3]=[]
				for corner in [Vector2(-1,0),Vector2(1,0),Vector2(1,1),Vector2(-1,1)]:
					var point=Vector3.ZERO; point[axis]=inner[axis]*corner.x
					point[u]=(half[u] if corner.y==0 else inner[u])*su
					point[v]=(inner[v] if corner.y==0 else half[v])*sv
					points.append(point)
				var normal=Vector3.ZERO; normal[u]=su; normal[v]=sv
				polygon(st,points,normal.normalized())
	for x in [-1,1]:
		for y in [-1,1]:
			for z in [-1,1]:
				var signs=Vector3(x,y,z); var points: Array[Vector3]=[]
				for axis in 3:
					var point=inner*signs; point[axis]=half[axis]*signs[axis]; points.append(point)
				polygon(st,points,signs.normalized())
	st.generate_tangents()
	var mesh=st.commit(); bevels[key]=mesh
	return mesh

static func dress(world: Node3D) -> void:
	for instance in world.find_children("*","MeshInstance3D",true,false):
		if instance.mesh is BoxMesh:
			var size: Vector3=instance.mesh.size
			instance.material_override=material("cobblestone_floor_08" if size.y<.1 or size.x>20 else "castle_brick_07",.5)
			if size.x<10 and size.y>.1: instance.mesh=beveled_box(size)
	var moss=load("res://assets/court/rock_moss_set_01/rock_moss_set_01.gltf") as PackedScene
	var source=moss.instantiate()
	var variants=source.find_children("*","MeshInstance3D",true,false)
	for i in 24:
		var rocks=variants[i%variants.size()].duplicate() as MeshInstance3D
		var angle=i*TAU/24
		rocks.position=Vector3(sin(angle)*16,-.1,cos(angle)*16)
		rocks.rotation.y=angle+.4
		rocks.scale=Vector3.ONE*(.8+(i%3)*.3)
		world.add_child(rocks)
	source.free()
	var ground=MeshInstance3D.new()
	var plane=PlaneMesh.new(); plane.size=Vector2(90,90)
	ground.mesh=plane; ground.position.y=-.08
	ground.material_override=material("forest_ground_04",.35)
	world.add_child(ground)
