class_name CombatEffects
extends Node3D

const CAPACITY=48
var actor: Fighter
var trail: MeshInstance3D
var ribbon=ImmediateMesh.new()
var sparks: MultiMeshInstance3D
var particles: Array[Dictionary]=[]
var samples: Array[Dictionary]=[]
var age: float=0
var emitted: int=0
var random=RandomNumberGenerator.new()

func _ready() -> void:
	actor=get_parent()
	top_level=true
	global_transform=Transform3D.IDENTITY
	physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	random.seed=1471
	trail=MeshInstance3D.new(); trail.mesh=ribbon
	var material=StandardMaterial3D.new()
	material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode=BaseMaterial3D.CULL_DISABLED
	material.vertex_color_use_as_albedo=true
	material.no_depth_test=false
	trail.material_override=material
	trail.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(trail)
	sparks=MultiMeshInstance3D.new()
	var mesh=BoxMesh.new(); mesh.size=Vector3(.018,.018,.018)
	sparks.multimesh=MultiMesh.new()
	sparks.multimesh.transform_format=MultiMesh.TRANSFORM_3D
	sparks.multimesh.use_colors=true
	sparks.multimesh.mesh=mesh
	sparks.multimesh.instance_count=CAPACITY
	sparks.multimesh.visible_instance_count=0
	sparks.material_override=material
	sparks.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(sparks)

func impact(at: Vector3, direction: Vector3, kind: String) -> void:
	if Preferences.reduced_effects: return
	var count=18 if kind=="parry" else (12 if kind=="guard" else 7)
	var color=Color("ffe2a1") if kind in ["parry","guard"] else Color("b9a99a")
	for i in mini(count,CAPACITY-particles.size()):
		var spread=Vector3(random.randf_range(-1,1),random.randf_range(.2,1.2),random.randf_range(-1,1))
		particles.append({"position":at,"velocity":(direction+spread)*random.randf_range(1,3),"born":age,"life":random.randf_range(.18,.4),"color":color})
		emitted+=1

func _process(delta: float) -> void:
	age+=delta
	if not is_instance_valid(actor.figure): return
	var figure: PerformanceFigure=actor.figure
	if Preferences.reduced_effects:
		samples.clear(); particles.clear()
	elif actor.model.active():
		var rig=figure.body_skeleton
		var transform=actor.get_global_transform_interpolated()*actor.global_transform.affine_inverse()*rig.global_transform*rig.get_bone_global_pose(figure.hand_index)*figure.weapon.transform
		var tip=transform*Vector3(0,-1,0)
		var base=transform*Vector3(0,-.2,0)
		if not samples.is_empty() and tip.distance_to(samples[-1].tip)>1.5: samples.clear()
		if samples.is_empty() or tip.distance_to(samples[-1].tip)>.015:
			samples.append({"tip":tip,"base":base,"born":age})
	while not samples.is_empty() and (age-float(samples[0].born)>.085 or samples.size()>12): samples.pop_front()
	ribbon.clear_surfaces()
	if samples.size()>1:
		ribbon.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		for sample in samples:
			var alpha=(1-(age-float(sample.born))/.085)*.3
			ribbon.surface_set_color(Color(.9,.8,.6,alpha*.35))
			ribbon.surface_add_vertex(sample.base)
			ribbon.surface_set_color(Color(1,.94,.8,alpha))
			ribbon.surface_add_vertex(sample.tip)
		ribbon.surface_end()
	for index in range(particles.size()-1,-1,-1):
		var p=particles[index]
		var life=(age-float(p.born))/float(p.life)
		if life>=1: particles.remove_at(index); continue
		p.velocity.y-=delta*9
		p.position+=p.velocity*delta
	for index in particles.size():
		var p=particles[index]
		var life=(age-float(p.born))/float(p.life)
		var size=Vector3(.7,1+minf(3,p.velocity.length()),.7)*(1-life*.7)
		sparks.multimesh.set_instance_transform(index,Transform3D(Basis.IDENTITY.scaled(size),p.position))
		var color: Color=p.color; color.a=1-life
		sparks.multimesh.set_instance_color(index,color)
	sparks.multimesh.visible_instance_count=particles.size()
