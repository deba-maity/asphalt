class_name CharacterSkin
extends RefCounted

# Original offline skin authoring. Continuous rings cross elbows and knees;
# weights blend the parent/child bones instead of exposing rigid joint gaps.
var rig: Skeleton3D
var figure: Node3D
var mesh: ArrayMesh
var bone_ids: Dictionary = {}

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
	var cloth: Color=figure.cloth.darkened(.18)
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
		ellipsoid(hand+Vector3(0,-.035,-.005),Vector3(.058,.09,.045),"hand_"+suffix,skin)
		var hip=origin("leg_"+suffix)
		var knee=origin("knee_"+suffix)
		var ankle=knee-Vector3(0,.29,0)
		tube([ankle,ankle.lerp(knee,.45),knee-Vector3(0,.07,0),knee,knee+Vector3(0,.08,0),knee.lerp(hip,.65),hip+Vector3(0,.035,0)],
			[Vector2(.065,.07),Vector2(.083,.09),Vector2(.079,.08),Vector2(.084,.085),Vector2(.096,.10),Vector2(.12,.12),Vector2(.11,.12)],"knee_"+suffix,"leg_"+suffix,knee.y,.10,Color("353b3b"))
		ellipsoid(ankle+Vector3(0,-.025,-.055),Vector3(.086,.075,.17),"knee_"+suffix,Color("292a29"))
	var head=origin("head")
	tube([head+Vector3(0,-.19,0),head+Vector3(0,-.07,0)],[Vector2(.065,.065),Vector2(.067,.067)],"head","head",head.y,.1,skin)
	ellipsoid(head,Vector3(.115,.145,.108),"head",skin)
	ellipsoid(head+Vector3(0,.084,.025),Vector3(.122,.086,.10),"head",Color("242728"))
	ellipsoid(head+Vector3(0,-.015,-.107),Vector3(.025,.04,.034),"head",skin.darkened(.06))
	if figure.armed: ellipsoid(head+Vector3(0,-.087,-.033),Vector3(.091,.064,.078),"head",Color("37302b"))
	for side in [-1,1]:
		ellipsoid(head+Vector3(side*.047,.028,-.096),Vector3(.024,.009,.012),"head",Color("252321"))
		ellipsoid(head+Vector3(side*.113,-.005,.005),Vector3(.018,.033,.02),"head",skin)
	var body=MeshInstance3D.new(); body.name="DeformingBody"; body.mesh=mesh
	rig.add_child(body); body.skeleton=NodePath("..")
	body.skin=rig.create_skin_from_rest_transforms()
	# Explicit animated bounds: prevents a swung limb disappearing at frustum edges.
	body.custom_aabb=AABB(Vector3(-1.6,-.4,-1.6),Vector3(3.2,3,3.2))

func ellipsoid(center: Vector3, radius: Vector3, bone: String, color: Color) -> void:
	var points=[]; var widths=[]
	for row in 13:
		var angle=PI*float(row)/12
		points.append(center+Vector3(0,-cos(angle)*radius.y,0))
		widths.append(Vector2(radius.x,radius.z)*maxf(.001,sin(angle)))
	tube(points,widths,bone,bone,center.y,.1,color)

func tube(points: Array, widths: Array, low: String, high: String, split: float, blend: float, color: Color) -> void:
	var vertices=PackedVector3Array(); var normals=PackedVector3Array()
	var bones=PackedInt32Array(); var weights=PackedFloat32Array(); var indices=PackedInt32Array()
	var segments=16
	for row in points.size():
		var center: Vector3=points[row]; var radius: Vector2=widths[row]
		var high_weight=smoothstep(split-blend,split+blend,center.y)
		for col in segments:
			var angle=TAU*float(col)/segments
			vertices.append(center+Vector3(cos(angle)*radius.x,0,sin(angle)*radius.y))
			var previous=maxi(0,row-1); var next=mini(points.size()-1,row+1)
			var dy: float=points[next].y-points[previous].y
			var slope: float=(widths[next].x-widths[previous].x)/maxf(.001,dy)
			normals.append(Vector3(cos(angle)/maxf(.001,radius.x),-slope/maxf(.001,radius.x),sin(angle)/maxf(.001,radius.y)).normalized())
			bones.append_array(PackedInt32Array([bone_ids[low],bone_ids[high],0,0]))
			weights.append_array(PackedFloat32Array([1-high_weight,high_weight,0,0]))
			if row<points.size()-1:
				var a=row*segments+col; var b=row*segments+(col+1)%segments
				indices.append_array(PackedInt32Array([a,b,a+segments,b,b+segments,a+segments]))
	var arrays=[]; arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX]=vertices; arrays[Mesh.ARRAY_NORMAL]=normals
	arrays[Mesh.ARRAY_BONES]=bones; arrays[Mesh.ARRAY_WEIGHTS]=weights; arrays[Mesh.ARRAY_INDEX]=indices
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	var material=StandardMaterial3D.new(); material.albedo_color=color; material.roughness=.82
	mesh.surface_set_material(mesh.get_surface_count()-1,material)
