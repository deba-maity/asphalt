class_name CharacterSkin
extends RefCounted

# Original offline skin authoring. Continuous rings cross elbows and knees;
# weights blend the parent/child bones instead of exposing rigid joint gaps.
var rig: Skeleton3D
var figure: Node3D
var mesh: ArrayMesh
var bone_ids: Dictionary = {}
var surface_groups: Dictionary = {}

func clear_body(node: Node) -> void:
	for child in node.get_children():
		if child.name == "weapon": continue
		if child is MeshInstance3D: child.free()
		else: clear_body(child)

func origin(id: String) -> Vector3:
	return figure.to_local(figure.joints[id].global_position)

func build(target: Node3D) -> void:
	figure=target
	clear_body(figure)
	rig=Skeleton3D.new(); rig.name="BodySkeleton"
	figure.add_child(rig)
	for id in figure.joints:
		var index=rig.add_bone(id)
		bone_ids[id]=index
		var joint: Node3D=figure.joints[id]
		var parent_id=String(joint.get_parent().name)
		if bone_ids.has(parent_id): rig.set_bone_parent(index,bone_ids[parent_id])
		rig.set_bone_rest(index,joint.transform)
	rig.reset_bone_poses()
	mesh=ArrayMesh.new()
	var cloth: Color=figure.cloth.darkened(.30)
	var skin=Color("aa8169")
	# Waist, rib cage, shoulders and collar: shaped rather than cylindrical.
	tube([Vector3(0,.78,0),Vector3(0,.9,0),Vector3(0,1.06,0),Vector3(0,1.24,0),Vector3(0,1.43,0),Vector3(0,1.55,0),Vector3(0,1.58,0)],
		[Vector2(.19,.13),Vector2(.22,.15),Vector2(.18,.12),Vector2(.23,.14),Vector2(.28,.15),Vector2(.22,.12),Vector2(.09,.08)],"hips","torso",1.10,.15,cloth)
	for suffix in ["l","r"]:
		var shoulder=origin("arm_"+suffix)
		var elbow=origin("elbow_"+suffix)
		var hand=origin("hand_"+suffix)
		tube([hand+Vector3(0,.015,0),hand.lerp(elbow,.35),elbow-Vector3(0,.07,0),elbow,elbow+Vector3(0,.07,0),elbow.lerp(shoulder,.65),shoulder+Vector3(0,.025,0)],
			[Vector2(.053,.055),Vector2(.067,.068),Vector2(.076,.073),Vector2(.075,.075),Vector2(.085,.08),Vector2(.105,.10),Vector2(.09,.09)],"elbow_"+suffix,"arm_"+suffix,elbow.y,.10,cloth)
		ellipsoid(hand+Vector3(0,-.025,-.005),Vector3(.051,.06,.038),"hand_"+suffix,Color("57493c"),"leather")
		for finger in 4:
			ellipsoid(hand+Vector3(-.036+finger*.023,-.075,-.018),Vector3(.012,.035,.019),"hand_"+suffix,skin,"skin")
		ellipsoid(hand+Vector3((-.055 if suffix=="l" else .055),-.015,-.01),Vector3(.018,.038,.02),"hand_"+suffix,skin,"skin")
		tube([hand+Vector3(0,.05,0),hand+Vector3(0,.12,0),elbow-Vector3(0,.06,0)],[Vector2(.068,.07),Vector2(.078,.08),Vector2(.083,.083)],"elbow_"+suffix,"elbow_"+suffix,0,.1,Color("51483d"),"leather")
		if figure.armed:
			ellipsoid(shoulder+Vector3(0,.015,0),Vector3(.128,.084,.13),"arm_"+suffix,Color("66665d") if suffix=="l" else Color("51483d"),"steel" if suffix=="l" else "leather")
		var hip=origin("leg_"+suffix)
		var knee=origin("knee_"+suffix)
		var ankle=knee-Vector3(0,.29,0)
		tube([ankle,ankle.lerp(knee,.45),knee-Vector3(0,.07,0),knee,knee+Vector3(0,.08,0),knee.lerp(hip,.65),hip+Vector3(0,.035,0)],
			[Vector2(.065,.07),Vector2(.083,.09),Vector2(.079,.08),Vector2(.084,.085),Vector2(.096,.10),Vector2(.12,.12),Vector2(.11,.12)],"knee_"+suffix,"leg_"+suffix,knee.y,.10,Color("353b3b"))
		ellipsoid(origin("ankle_"+suffix)+Vector3(0,.05,-.055),Vector3(.086,.075,.17),"ankle_"+suffix,Color("3c3933"),"leather")
		tube([ankle,ankle+Vector3(0,.17,0),knee-Vector3(0,.05,0)],[Vector2(.078,.085),Vector2(.09,.10),Vector2(.092,.10)],"knee_"+suffix,"knee_"+suffix,0,.1,Color("454037"),"leather")
	var head=origin("head")
	tube([head+Vector3(0,-.19,0),head+Vector3(0,-.07,0)],[Vector2(.065,.065),Vector2(.067,.067)],"head","head",head.y,.1,skin,"skin")
	ellipsoid(head,Vector3(.115,.145,.108),"head",skin,"skin")
	ellipsoid(head+Vector3(0,.084,.025),Vector3(.122,.086,.10),"head",Color("242728"),"skin")
	ellipsoid(head+Vector3(0,-.015,-.107),Vector3(.025,.04,.034),"head",skin.darkened(.06),"skin")
	if figure.armed: ellipsoid(head+Vector3(0,-.087,-.033),Vector3(.091,.064,.078),"head",Color("37302b"),"skin")
	for side in [-1,1]:
		ellipsoid(head+Vector3(side*.047,.028,-.096),Vector3(.024,.009,.012),"head",Color("252321"),"skin")
		ellipsoid(head+Vector3(side*.113,-.005,.005),Vector3(.018,.033,.02),"head",skin,"skin")
	# Layered travel armour, belt, split coat and scarf are part of the skin.
	if figure.armed:
		tube([Vector3(0,1.06,0),Vector3(0,1.24,0),Vector3(0,1.43,0),Vector3(0,1.55,0)],
			[Vector2(.200,.140),Vector2(.250,.160),Vector2(.300,.170),Vector2(.240,.140)],"hips","torso",1.1,.15,Color("514c41"),"leather")
		for side in [-1,1]:
			for row in 4:
				ellipsoid(Vector3(side*(.16+row*.022),1.17+row*.065,-.15),Vector3(.012,.012,.012),"torso",Color("93866a"),"steel")
			ellipsoid(Vector3(side*.215,.89,.005),Vector3(.075,.11,.095),"hips",Color("63523f"),"leather")
			panel("coat_l" if side<0 else "coat_r","hips",.27,.46,cloth)
		panel("scarf_tail","torso",.18,.64,Color("70524a"))
		tube([Vector3(0,.91,0),Vector3(0,.98,0)],[Vector2(.23,.165),Vector2(.214,.158)],"hips","hips",0,.1,Color("352f29"),"leather")
		ellipsoid(Vector3(0,.947,-.168),Vector3(.049,.035,.014),"hips",Color("aa9872"),"steel")
	merge_surfaces()
	var body=MeshInstance3D.new(); body.name="DeformingBody"; body.mesh=mesh
	rig.add_child(body); body.skeleton=NodePath("..")
	body.skin=rig.create_skin_from_rest_transforms()
	# Explicit animated bounds: prevents a swung limb disappearing at frustum edges.
	body.custom_aabb=AABB(Vector3(-1.6,-.4,-1.6),Vector3(3.2,3,3.2))

func ellipsoid(center: Vector3, radius: Vector3, bone: String, color: Color, kind: String="cloth") -> void:
	var points=[]; var widths=[]
	var rows=6 if radius.length()<.07 else 12
	for row in range(rows+1):
		var angle=PI*float(row)/rows
		points.append(center+Vector3(0,-cos(angle)*radius.y,0))
		widths.append(Vector2(radius.x,radius.z)*maxf(.001,sin(angle)))
	tube(points,widths,bone,bone,center.y,.1,color,kind,8 if rows==6 else 16)

func tube(points: Array, widths: Array, low: String, high: String, split: float, blend: float, color: Color, kind: String="cloth", segments: int=16) -> void:
	var vertices=PackedVector3Array(); var normals=PackedVector3Array()
	var bones=PackedInt32Array(); var weights=PackedFloat32Array(); var indices=PackedInt32Array()
	var uv=PackedVector2Array(); var tangents=PackedFloat32Array()
	for row in points.size():
		var center: Vector3=points[row]; var radius: Vector2=widths[row]
		var high_weight=smoothstep(split-blend,split+blend,center.y)
		for col in range(segments+1):
			var angle=TAU*float(col)/segments
			vertices.append(center+Vector3(cos(angle)*radius.x,0,sin(angle)*radius.y))
			uv.append(Vector2(float(col)/segments,float(row)/maxi(1,points.size()-1)))
			tangents.append_array(PackedFloat32Array([-sin(angle),0,cos(angle),1]))
			var previous=maxi(0,row-1); var next=mini(points.size()-1,row+1)
			var dy: float=points[next].y-points[previous].y
			var slope: float=(widths[next].x-widths[previous].x)/maxf(.001,dy)
			normals.append(Vector3(cos(angle)/maxf(.001,radius.x),-slope/maxf(.001,radius.x),sin(angle)/maxf(.001,radius.y)).normalized())
			bones.append_array(PackedInt32Array([bone_ids[low],bone_ids[high],0,0]))
			weights.append_array(PackedFloat32Array([1-high_weight,high_weight,0,0]))
			if row<points.size()-1 and col<segments:
				var a=row*(segments+1)+col; var b=a+1
				indices.append_array(PackedInt32Array([a,b,a+segments+1,b,b+segments+1,a+segments+1]))
	var arrays=[]; arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX]=vertices; arrays[Mesh.ARRAY_NORMAL]=normals
	arrays[Mesh.ARRAY_TEX_UV]=uv; arrays[Mesh.ARRAY_TANGENT]=tangents
	arrays[Mesh.ARRAY_BONES]=bones; arrays[Mesh.ARRAY_WEIGHTS]=weights; arrays[Mesh.ARRAY_INDEX]=indices
	add_surface(arrays,color,kind)

func add_surface(arrays: Array, color: Color, kind: String) -> void:
	var key=kind+color.to_html()
	if not surface_groups.has(key): surface_groups[key]={"arrays":[],"color":color,"kind":kind}
	surface_groups[key].arrays.append(arrays)

func merge_surfaces() -> void:
	for group in surface_groups.values():
		var output: Array=group.arrays[0].duplicate(true)
		for arrays in group.arrays.slice(1):
			var offset=output[Mesh.ARRAY_VERTEX].size()
			for channel in [Mesh.ARRAY_VERTEX,Mesh.ARRAY_NORMAL,Mesh.ARRAY_TEX_UV,Mesh.ARRAY_TANGENT,Mesh.ARRAY_BONES,Mesh.ARRAY_WEIGHTS]: output[channel].append_array(arrays[channel])
			for index in arrays[Mesh.ARRAY_INDEX]: output[Mesh.ARRAY_INDEX].append(index+offset)
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,output)
		var material: StandardMaterial3D
		if group.kind=="skin":
			material=StandardMaterial3D.new(); material.albedo_color=group.color; material.roughness=.75
		else: material=SurfaceLibrary.material(group.kind,group.color,1.0,false)
		mesh.surface_set_material(mesh.get_surface_count()-1,material)

func panel(bone: String, parent: String, width: float, length: float, color: Color) -> void:
	var vertices=PackedVector3Array(); var normals=PackedVector3Array(); var uv=PackedVector2Array()
	var tangents=PackedFloat32Array(); var bones=PackedInt32Array(); var weights=PackedFloat32Array(); var indices=PackedInt32Array()
	var start=origin(bone)
	for row in 9:
		var t=row/8.0
		for col in 7:
			var u=col/6.0
			vertices.append(start+Vector3((u-.5)*width*(1+t*.35),-t*length,.025+sin(u*PI*4)*.014+t*.07))
			normals.append(Vector3(0,.1,1).normalized()); uv.append(Vector2(u,t))
			tangents.append_array(PackedFloat32Array([1,0,0,1]))
			bones.append_array(PackedInt32Array([bone_ids[parent],bone_ids[bone],0,0]))
			var weight=smoothstep(0,.35,t)
			weights.append_array(PackedFloat32Array([1-weight,weight,0,0]))
			if row<8 and col<6:
				var a=row*7+col
				indices.append_array(PackedInt32Array([a,a+1,a+7,a+1,a+8,a+7,a,a+7,a+1,a+1,a+7,a+8]))
	var arrays=[]; arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX]=vertices; arrays[Mesh.ARRAY_NORMAL]=normals; arrays[Mesh.ARRAY_TEX_UV]=uv; arrays[Mesh.ARRAY_TANGENT]=tangents
	arrays[Mesh.ARRAY_BONES]=bones; arrays[Mesh.ARRAY_WEIGHTS]=weights; arrays[Mesh.ARRAY_INDEX]=indices
	add_surface(arrays,color,"cloth")
