class_name PerformanceCape
extends MeshInstance3D

# A short, original shoulder mantle. Fixed-size XPBD cloth, four constraint
# passes, body capsule collisions and render interpolation. No loose scene nodes
# per particle; two fighters use 140 particles in total.
const COLUMNS=7
const ROWS=10
const COUNT=COLUMNS*ROWS
var figure: PerformanceFigure
var points=PackedVector3Array()
var history=PackedVector3Array()
var previous=PackedVector3Array()
var current=PackedVector3Array()
var rest=PackedVector3Array()
var links=PackedInt32Array()
var lengths=PackedFloat32Array()
var compliance=PackedFloat32Array()
var triangles=PackedInt32Array()
var clock: float=0
var initialized: bool=false
var previous_anchor=Vector3.INF
var surface=ImmediateMesh.new()
var torso: int
var pelvis: int
var neck: int
var legs: Array=[]
var arms: Array=[]

func _ready() -> void:
	top_level=true; global_transform=Transform3D.IDENTITY
	physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	mesh=surface
	var material=ShaderMaterial.new()
	material.shader=preload("res://assets/performance/mantle.gdshader")
	material.set_shader_parameter("cloth_color",Color("56342c") if figure.role=="rayan" else Color("303d3b"))
	material.set_shader_parameter("trim_color",Color("9b8053") if figure.role=="rayan" else Color("a09a80"))
	material.set_shader_parameter("cloth_map",load("res://assets/surfaces/cloth.png"))
	material.set_shader_parameter("cloth_normal",load("res://assets/surfaces/cloth_normal.png"))
	material.set_shader_parameter("warden",figure.role!="rayan")
	material_override=material
	var rig=figure.body_skeleton
	torso=rig.find_bone("spine_03"); pelvis=rig.find_bone("pelvis"); neck=rig.find_bone("neck_01")
	for side in ["l","r"]:
		legs.append([rig.find_bone("thigh_"+side),rig.find_bone("calf_"+side)])
		arms.append([rig.find_bone("upperarm_"+side),rig.find_bone("lowerarm_"+side),.145 if side=="l" or figure.role!="rayan" else .10])
	for row in ROWS:
		for column in COLUMNS:
			var u=float(column)/(COLUMNS-1); var v=float(row)/(ROWS-1)
			var hem=(.025*sin(column*2.7)+.07*pow(1-absf(u-.5)*2,4))*pow(v,6)
			var pleat=.024*cos(u*PI*6)*(1-.4*v)
			var length=.88 if figure.role!="rayan" else .76-.18*u
			var width=lerpf(.60,.76 if figure.role!="rayan" else .68,v)
			rest.append(Vector3((u-.5)*width+.035*v,.18-v*length+hem,-.245-v*.08+pleat))
	for row in ROWS:
		for column in COLUMNS:
			var i=row*COLUMNS+column
			var split=figure.role!="rayan" and row>=7
			if column<COLUMNS-1 and not (split and column==2): link(i,i+1,.000002)
			if row<ROWS-1: link(i,i+COLUMNS,.000002)
			if column<COLUMNS-1 and row<ROWS-1:
				if not (split and column==2):
					link(i,i+COLUMNS+1,.00002); link(i+1,i+COLUMNS,.00002)
				# Open the lower center seam without adding particles or tearing
				# constraints at runtime. Both tails remain physically bounded.
				if not (figure.role!="rayan" and column==2 and row>=7):
					triangles.append_array(PackedInt32Array([i,i+COLUMNS+1,i+1,i,i+COLUMNS,i+COLUMNS+1]))
			if column<COLUMNS-2 and not (split and column in [1,2]): link(i,i+2,.001)
			if row<ROWS-2: link(i,i+COLUMNS*2,.001)

func link(a: int, b: int, softness: float) -> void:
	links.append(a); links.append(b)
	lengths.append(rest[a].distance_to(rest[b])); compliance.append(softness)

func anchor_transform() -> Transform3D:
	var rig=figure.body_skeleton
	return rig.global_transform*rig.get_bone_global_pose(torso)

func reset_cloth(anchor: Transform3D) -> void:
	points.resize(COUNT)
	for i in COUNT: points[i]=anchor*rest[i]
	history=points.duplicate(); previous=points.duplicate(); current=points.duplicate()
	initialized=true

func step(delta: float, teleport: bool=false) -> void:
	var anchor=anchor_transform()
	if not initialized or teleport or anchor.origin.distance_to(previous_anchor)>2: reset_cloth(anchor)
	previous_anchor=anchor.origin
	previous=current.duplicate(); clock+=delta
	var wind=Vector3(.25*sin(clock*.8),.08,.18*cos(clock*.65)) if not Preferences.reduced_effects else Vector3.ZERO
	var acceleration=Vector3(0,-14,0)+wind
	for i in COUNT:
		if i<COLUMNS: points[i]=anchor*rest[i]; history[i]=points[i]; continue
		var position=points[i]
		points[i]+=(points[i]-history[i])*exp(-delta*2.4)+acceleration*delta*delta
		history[i]=position
	var multipliers=PackedFloat32Array(); multipliers.resize(lengths.size())
	var rig=figure.body_skeleton
	var capsules: Array=[]
	capsules.append([rig.to_global(rig.get_bone_global_pose(pelvis).origin),rig.to_global(rig.get_bone_global_pose(neck).origin),.235])
	for pair in legs: capsules.append([rig.to_global(rig.get_bone_global_pose(pair[0]).origin),rig.to_global(rig.get_bone_global_pose(pair[1]).origin),.16])
	for pair in arms: capsules.append([rig.to_global(rig.get_bone_global_pose(pair[0]).origin),rig.to_global(rig.get_bone_global_pose(pair[1]).origin),pair[2]])
	for iteration in 4:
		for constraint in lengths.size():
			var a=links[constraint*2]; var b=links[constraint*2+1]
			var inverse_a=0.0 if a<COLUMNS else 1.0
			var inverse_b=0.0 if b<COLUMNS else 1.0
			if inverse_a+inverse_b==0: continue
			var difference=points[a]-points[b]
			var distance=difference.length()
			if distance<.00001: continue
			var alpha=compliance[constraint]/(delta*delta)
			var multiplier=(-(distance-lengths[constraint])-alpha*multipliers[constraint])/(inverse_a+inverse_b+alpha)
			multipliers[constraint]+=multiplier
			var correction=difference*(multiplier/distance)
			points[a]+=correction*inverse_a; points[b]-=correction*inverse_b
		for i in range(COLUMNS,COUNT):
			for capsule in capsules:
				var a: Vector3=capsule[0]; var segment: Vector3=capsule[1]-a
				var nearest=a+segment*clampf((points[i]-a).dot(segment)/maxf(.0001,segment.length_squared()),0,1)
				var offset=points[i]-nearest
				var radius: float=capsule[2]
				# Let cloth lie between the body and floor during a roll/fall;
				# contradictory floor/capsule corrections otherwise crumple it.
				if points[i].y<nearest.y: radius=minf(radius,maxf(.01,nearest.y-.035))
				if offset.length()<radius: points[i]=nearest+(offset.normalized() if offset.length()>.0001 else anchor.basis*Vector3.FORWARD)*radius
			points[i].y=maxf(.035,points[i].y)
	current=points.duplicate()

func _process(_delta: float) -> void:
	if not initialized: return
	var fraction=Engine.get_physics_interpolation_fraction() if get_tree().is_physics_interpolation_enabled() else 1.0
	var vertices=PackedVector3Array(); vertices.resize(COUNT)
	var normals=PackedVector3Array(); normals.resize(COUNT)
	for i in COUNT: vertices[i]=previous[i].lerp(current[i],fraction)
	for i in range(0,triangles.size(),3):
		var a=triangles[i]; var b=triangles[i+1]; var c=triangles[i+2]
		var normal=-(vertices[b]-vertices[a]).cross(vertices[c]-vertices[a])
		normals[a]+=normal; normals[b]+=normal; normals[c]+=normal
	surface.clear_surfaces(); surface.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in triangles:
		var column=i%COLUMNS; var row=i/COLUMNS
		var tangent=(vertices[row*COLUMNS+mini(COLUMNS-1,column+1)]-vertices[row*COLUMNS+maxi(0,column-1)]).normalized()
		surface.surface_set_normal(normals[i].normalized())
		surface.surface_set_tangent(Plane(tangent.x,tangent.y,tangent.z,1))
		surface.surface_set_uv(Vector2(float(column)/(COLUMNS-1),float(row)/(ROWS-1)))
		surface.surface_add_vertex(vertices[i])
	surface.surface_end()
