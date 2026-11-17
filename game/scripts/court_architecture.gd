class_name CourtArchitecture
extends RefCounted

# A ruined cloister frames the fighting space. All new masonry is beyond the
# existing boundary, so visual composition does not introduce invisible cover.
static var arches: Dictionary={}

static func arch_mesh(radius: float, thickness: float, depth: float, broken: bool=false) -> ArrayMesh:
	var key=str(Vector3(radius,thickness,depth))+str(broken)
	if arches.has(key): return arches[key]
	var st=SurfaceTool.new(); st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for stone in 19:
		if broken and stone in [7,8,9,10,11]: continue
		var a=PI*stone/19+.008; var b=PI*(stone+1)/19-.008
		var points: Array[Vector3]=[]
		for z in [-depth*.5,depth*.5]:
			for pair in [Vector2(radius,a),Vector2(radius+thickness,a),Vector2(radius+thickness,b),Vector2(radius,b)]:
				points.append(Vector3(cos(pair.y)*pair.x,sin(pair.y)*pair.x,z))
		CourtArt.polygon(st,[points[0],points[1],points[2],points[3]],Vector3.BACK*-1)
		CourtArt.polygon(st,[points[4],points[5],points[6],points[7]],Vector3.BACK)
		var radial=Vector3(cos((a+b)*.5),sin((a+b)*.5),0)
		CourtArt.polygon(st,[points[0],points[3],points[7],points[4]],-radial)
		CourtArt.polygon(st,[points[1],points[2],points[6],points[5]],radial)
		CourtArt.polygon(st,[points[0],points[1],points[5],points[4]],Vector3(sin(a),-cos(a),0))
		CourtArt.polygon(st,[points[3],points[2],points[6],points[7]],Vector3(-sin(b),cos(b),0))
	st.generate_tangents()
	var mesh=st.commit(); st.clear(); arches[key]=mesh
	return mesh

static func stone(parent: Node3D, size: Vector3, at: Vector3, pale: bool=false) -> MeshInstance3D:
	var part=MeshInstance3D.new(); part.mesh=CourtArt.beveled_box(size)
	part.position=at
	part.material_override=CourtArt.material("castle_brick_07",.42 if pale else .5)
	parent.add_child(part)
	return part

static func dress(world: Node3D) -> void:
	var cloister=Node3D.new(); cloister.name="RuinedCloister"; world.add_child(cloister)
	for index in 5:
		var angle=deg_to_rad(-72+index*36)
		var bay=Node3D.new(); cloister.add_child(bay)
		bay.position=Vector3(sin(angle)*14.8,0,-cos(angle)*14.8)
		bay.rotation.y=-angle
		var height=3.15+(.35 if index%2==0 else 0)
		var arch=MeshInstance3D.new(); arch.mesh=arch_mesh(1.8,.42,.85,index in [0,4])
		arch.position.y=height; arch.material_override=CourtArt.material("castle_brick_07",.5); bay.add_child(arch)
		for side in [-1,1]:
			stone(bay,Vector3(.94,.25,1.15),Vector3(side*2.02,.125,0),true)
			for row in 6:
				stone(bay,Vector3(.60,height/6-.018,.70),Vector3(side*2.02,(row+.5)*height/6,0))
			stone(bay,Vector3(.94,.20,1.04),Vector3(side*2.02,height-.02,0),true)
			# A broader rear buttress gives the columns architectural weight.
			stone(bay,Vector3(.90,2.3,.72),Vector3(side*2.02,1.15,-.65))
			stone(bay,Vector3(.66,1.1,.55),Vector3(side*2.02,2.85,-.65))
	# Two gate flanks rise above the smaller colonnade. Deliberately uneven
	# courses preserve a broken skyline without scattering obstacles in combat.
	for side in [-1,1]:
		for row in 10:
			var count=3 if row<7 else (2 if row<9 else 1)
			for column in count:
				var block=stone(cloister,Vector3(1.22,.58,1.25),Vector3(side*(3.75+column*1.25),.30+row*.60,-13.4))
				block.position.x+=side*.08*(row%2)
		stone(cloister,Vector3(1.0,4.6,1.65),Vector3(side*3.0,2.3,-13.4))
		stone(cloister,Vector3(1.3,.22,1.9),Vector3(side*3.0,4.7,-13.4),true)
	# Replace the two stepped-box arches with fitted radial masonry.
	for z in [-11.0,11.0]:
		var crown=MeshInstance3D.new(); crown.name="GateVoussoirs"
		crown.mesh=arch_mesh(2.2,.48,.95,z>0)
		crown.position=Vector3(0,3,z); crown.material_override=CourtArt.material("castle_brick_07",.5)
		cloister.add_child(crown)
