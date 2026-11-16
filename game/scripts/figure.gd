class_name Figure
extends Node3D

var joints: Dictionary = {}
var poses: Dictionary
var phase: float = 0
var hips: Node3D
var blade: MeshInstance3D
var weapon: Node3D
@export var cloth: Color = Color("4b6975")
@export var armed: bool = true
@export var role: String = "rayan"
var child: bool = false
var dead_blend: float = 0
var gait_weight: float=0
var visual_clock: float=0
var stride_direction: Vector3=Vector3(0,0,-1)
var pose_cache: Dictionary={}
var body_skeleton: Skeleton3D
var previous_speed: float=0
var acceleration_lean: float=0
var transition_age: float=1
var last_state: String=""
var last_swing: int=-1
var entry_rotations: Dictionary={}
var bone_nodes: Array[Node3D]=[]
var foot_placement=FootPlacement.new()
var secondary_angles=Vector3.ZERO
var secondary_velocity=Vector3.ZERO
static var shared_poses: Dictionary={}
static var materials: Dictionary = {}
static var meshes: Dictionary = {}

static func material(color: Color, metallic: float = 0) -> StandardMaterial3D:
	var key = color.to_html()+str(metallic)
	if materials.has(key):
		return materials[key]
	var m = StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.88
	m.metallic = metallic
	materials[key] = m
	return m

static func box(parent: Node3D, size: Vector3, at: Vector3, color: Color) -> MeshInstance3D:
	var mesh = MeshInstance3D.new()
	var key = "box"+str(size)
	if not meshes.has(key):
		var shape = BoxMesh.new()
		shape.size = size
		meshes[key] = shape
	var shape = meshes[key]
	mesh.mesh = shape
	mesh.material_override = material(color)
	mesh.position = at
	parent.add_child(mesh)
	return mesh

static func cylinder(parent: Node3D, bottom: float, top: float, height: float, at: Vector3, color: Color, sides: int = 7) -> MeshInstance3D:
	var mesh = MeshInstance3D.new()
	var key = "cyl_%s_%s_%s_%s" % [bottom,top,height,sides]
	if not meshes.has(key):
		var shape = CylinderMesh.new()
		shape.bottom_radius = bottom
		shape.top_radius = top
		shape.height = height
		shape.radial_segments = sides
		meshes[key] = shape
	var shape = meshes[key]
	mesh.mesh = shape
	mesh.material_override = material(color)
	mesh.position = at
	parent.add_child(mesh)
	return mesh

func pivot(id: String, parent: Node3D, at: Vector3) -> Node3D:
	var p = Node3D.new()
	p.name = id
	p.position = at
	parent.add_child(p)
	joints[id] = p
	return p

func _ready() -> void:
	if shared_poses.is_empty(): shared_poses=JSON.parse_string(FileAccess.get_file_as_string("res://content/poses.json"))
	poses=shared_poses
	if get_child_count()>0:
		for id in ["hips","torso","head","arm_l","arm_r","elbow_l","elbow_r","hand_l","hand_r","leg_l","leg_r","knee_l","knee_r","ankle_l","ankle_r","coat_l","coat_r","scarf_tail","weapon"]:
			joints[id] = find_child(id,true,false)
		hips = joints.hips
		weapon = joints.weapon
		blade = weapon.get_node("Blade")
		bind_skin()
		return
	var skin = Color("c39774")
	var boots = Color("373535")
	hips = pivot("hips",self,Vector3(0,0.91,0))
	cylinder(hips,0.24,0.22,0.32,Vector3(0,0.03,0),cloth.darkened(0.1))
	box(hips,Vector3(0.49,0.08,0.3),Vector3(0,0.13,0),Color("57463c"))
	box(hips,Vector3(0.09,0.08,0.04),Vector3(0,0.13,-0.17),Color("b89a61"))
	var torso = pivot("torso",hips,Vector3(0,0.19,0))
	cylinder(torso,0.23,0.3,0.48,Vector3(0,0.22,0),cloth)
	box(torso,Vector3(0.09,0.5,0.34),Vector3(-0.14,0.24,0),Color("65503c"))
	var head = pivot("head",torso,Vector3(0,0.59,0))
	cylinder(head,0.085,0.085,0.12,Vector3(0,-0.07,0),skin)
	cylinder(head,0.145,0.155,0.29,Vector3.ZERO,skin,8)
	cylinder(head,0.165,0.145,0.13,Vector3(0,0.13,0.018),Color("332f31"),8)
	box(head,Vector3(0.25,0.1,0.10),Vector3(0,-0.105,-0.075),Color("514039") if armed else skin)
	box(head,Vector3(0.065,0.06,0.08),Vector3(0,0,-0.15),skin.lightened(0.08))
	for side in [-1,1]:
		box(head,Vector3(0.035,0.022,0.015),Vector3(0.065*side,0.035,-0.144),Color("262b30"))
		var suffix = "l" if side < 0 else "r"
		var arm = pivot("arm_"+suffix,torso,Vector3(0.31*side,0.43,0))
		cylinder(arm,0.092,0.12,0.34,Vector3(0,-0.17,0),cloth)
		var elbow = pivot("elbow_"+suffix,arm,Vector3(0,-0.34,0))
		cylinder(elbow,0.062,0.082,0.31,Vector3(0,-0.155,0),skin)
		box(elbow,Vector3(0.15,0.14,0.16),Vector3(0,-0.14,0),Color("5d5043"))
		var hand = pivot("hand_"+suffix,elbow,Vector3(0,-0.33,0))
		box(hand,Vector3(0.115,0.13,0.12),Vector3.ZERO,skin)
		var leg = pivot("leg_"+suffix,hips,Vector3(0.135*side,-0.1,0))
		cylinder(leg,0.10,0.125,0.37,Vector3(0,-0.185,0),Color("4e514f"))
		var knee = pivot("knee_"+suffix,leg,Vector3(0,-0.37,0))
		cylinder(knee,0.085,0.10,0.34,Vector3(0,-0.17,0),boots)
		box(knee,Vector3(0.19,0.14,0.3),Vector3(0,-0.31,-0.045),boots)
		pivot("ankle_"+suffix,knee,Vector3(0,-.36,0))
		if side == 1:
			weapon = pivot("weapon",hand,Vector3(0,-0.05,0))
			cylinder(weapon,0.035,0.035,0.20,Vector3(0,-0.06,0),Color("4a3431"))
			box(weapon,Vector3(0.29,0.045,0.07),Vector3(0,-0.18,0),Color("bba36d"))
			blade = box(weapon,Vector3(0.095,0.73,0.027),Vector3(0,-0.57,0),Color("c0cacf"))
			blade.name = "Blade"
			blade.mesh=WeaponGeometry.blade()
			blade.material_override=SurfaceLibrary.material("steel",Color("aeb8bd"),5.0)
			cylinder(weapon,.048,.04,.075,Vector3(0,.075,0),Color("9d8d6d"),12)

	pivot("coat_l",hips,Vector3(-.12,-.015,.12))
	pivot("coat_r",hips,Vector3(.12,-.015,.12))
	pivot("scarf_tail",torso,Vector3(-.13,.46,.12))
	CharacterSkin.new().build(self)
	bind_skin()
	weapon.visible = armed
	if armed:
		var scarf = cylinder(torso,.145,.115,.105,Vector3(0,.46,.01),Color("70524a"),16)
		scarf.rotation.z = -0.08

	if role in ["ledger_guard","lieutenant_kesran","halvek"]:
		var shield=cylinder(joints.hand_l,.32,.32,.09,Vector3(0,.12,-.13),Color("6e7f82"),8)
		shield.rotation.x=PI/2
	if role=="ledger_archer":
		var bow=Node3D.new()
		joints.hand_l.add_child(bow)
		for side in [-1,1]:
			var limb=box(bow,Vector3(.055,.46,.06),Vector3(0,side*.22,0),Color("90704e"))
			limb.rotation.z=side*.25
		box(bow,Vector3(.018,.90,.018),Vector3(.07,0,0),Color("ddd0b0"))
		box(torso,Vector3(.2,.7,.25),Vector3(.15,.2,.25),Color("504d40"))
	if role in ["ledger_brute","marshal_serit"]: blade.scale.x=2.3
	if role in ["ledger_elite","still_warden"]:
		cylinder(head,.18,.17,.2,Vector3(0,.09,.015),Color("454b5b"),8)
	if armed and role!="rayan":
		for i in 3:
			var cord=MeshInstance3D.new()
			var ring=TorusMesh.new()
			ring.inner_radius=.025
			ring.outer_radius=.042
			ring.rings=8
			ring.ring_segments=4
			cord.mesh=ring
			cord.material_override=material(Color("262b30"))
			cord.rotation.x=PI/2
			cord.position=Vector3(-.07+i*.07,.34,-.26)
			torso.add_child(cord)

func bind_skin() -> void:
	body_skeleton=get_node_or_null("BodySkeleton")
	bone_nodes.clear()
	if body_skeleton:
		for i in body_skeleton.get_bone_count(): bone_nodes.append(joints[String(body_skeleton.get_bone_name(i))])

func sync_skin() -> void:
	if not body_skeleton: return
	for i in bone_nodes.size():
		body_skeleton.set_bone_pose_position(i,bone_nodes[i].position)
		body_skeleton.set_bone_pose_rotation(i,bone_nodes[i].quaternion)

func pose_values(id: String) -> Dictionary:
	if pose_cache.has(id): return pose_cache[id].duplicate(true)
	var result = poses.idle.duplicate(true)
	if poses.has(id):
		result.merge(poses[id],true)
	pose_cache[id]=result.duplicate(true)
	return result

func animate(delta: float, model: CombatModel, speed: float, displacement: Vector3=Vector3.ZERO, interaction: bool = false) -> void:
	visual_clock+=delta
	if model.state!=last_state or (model.state=="attack" and model.swing_serial!=last_swing):
		transition_age=0
		for key in joints: entry_rotations[key]=joints[key].quaternion
		last_state=model.state; last_swing=model.swing_serial
	transition_age+=delta
	var acceleration=clampf((speed-previous_speed)/maxf(delta,.001),-15,15)
	acceleration_lean=lerpf(acceleration_lean,acceleration,1-exp(-delta*8))
	previous_speed=speed
	weapon.visible = armed and model.state != "talk" and role!="ledger_archer"
	var distance=Vector2(displacement.x,displacement.z).length()
	# NPCs have no locomotion; old callers may pass speed alone in fixtures.
	if distance>0.00001: stride_direction=displacement.normalized()
	# Stance travel / stance fraction matches distance covered per cycle.
	phase+=distance*TAU*AnimationPolicy.cadence(speed)/maxf(.1,speed)
	gait_weight=move_toward(gait_weight,1.0 if speed>.1 and model.state in ["idle","guard","dodge","ashstep"] else 0.0,delta*9)
	var pose = pose_values("idle")
	if gait_weight>.01 and model.state in ["idle","guard","dodge","ashstep"]:
		if model.state in ["guard","dodge","ashstep"]: pose=pose_values("guard" if model.state=="guard" else "dodge")
		var left=AnimationPolicy.directional_leg(phase,speed>4.5,stride_direction,speed)
		var right=AnimationPolicy.directional_leg(phase+PI,speed>4.5,stride_direction,speed)
		pose.leg_l=[rad_to_deg(left.x)*gait_weight,0,rad_to_deg(left.z)*gait_weight]
		pose.leg_r=[rad_to_deg(right.x)*gait_weight,0,rad_to_deg(right.z)*gait_weight]
		pose.knee_l=[rad_to_deg(left.y)*gait_weight,0,0]
		pose.knee_r=[rad_to_deg(right.y)*gait_weight,0,0]
		if model.state=="idle":
			var run=clampf((speed-2)/4,0,1)
			pose.arm_l=[-sin(phase)*lerpf(18,36,run)+8,0,-9]
			pose.arm_r=[sin(phase)*lerpf(12,25,run)+18,0,12]
			pose.elbow_l=[25+run*35,0,0]; pose.elbow_r=[35+run*30,0,0]
			pose.torso=[4+run*9+acceleration_lean*.3,sin(phase)*5,-stride_direction.x*run*5]
			pose.head=[-run*5,-sin(phase)*3,0]
	elif model.state == "attack":
		pose=CombatMotion.sample(model)
		if model.attack.get("pose","")=="bow":
			pose=pose_values("guard")
			pose.arm_l=[95,0,-35]
			pose.arm_r=[85,0,45]
	elif model.state in ["guard","dodge","hit","heal","dead","talk"]:
		pose = pose_values(model.state)
	elif model.state=="ashstep":
		pose=pose_values("dodge")
	elif interaction:
		pose = pose_values("talk")
	if model.parry_flash > 0 and model.state not in ["attack","dead","hit"]:
		pose = pose_values("parry")
	if model.story_fall: pose=pose_values("dead")
	if model.state=="idle" and gait_weight<.1:
		pose.torso=[sin(visual_clock*1.7)*.65,sin(visual_clock*.47)*1.2,0]
		pose.head=[sin(visual_clock*.8)*.8,sin(visual_clock*.31)*2.5,0]
	if model.state=="hit":
		var recoil=exp(-model.elapsed*8)
		pose.torso=[-26*recoil,12*recoil,-9*recoil]
		pose.head=[14*recoil,-8*recoil,4*recoil]
		pose.knee_l=[-22,0,0]; pose.knee_r=[-28,0,0]
	if model.state=="guard":
		pose.torso[0]+=sin(visual_clock*2)*1.2
	for side in 2:
		var suffix="l" if side==0 else "r"
		var t=fposmod(phase+side*PI,TAU)/TAU
		var leg_angles=pose.get("leg_"+suffix,[0,0,0])
		var knee_angles=pose.get("knee_"+suffix,[0,0,0])
		# Counter-rotate the ankle; add toe clearance only during swing.
		pose["ankle_"+suffix]=[-float(leg_angles[0])-float(knee_angles[0])+sin(t*TAU)*12*gait_weight,0,-float(leg_angles[2])]
	# Upper-body pivots point upward, unlike the hanging arm/leg chains.
	# Positive X bends a torso backward; authored forward lean must be negative.
	if pose.has("torso"): pose.torso[0]=-float(pose.torso[0])
	if pose.has("hips"): pose.hips[0]=-float(pose.hips[0])
	if model.state in ["idle","attack"] and pose.has("head"): pose.head[0]=-float(pose.head[0])
	var entry=smoothstep(0,1,transition_age/(.065 if model.state=="hit" else .12))
	for key in joints:
		if key=="weapon" or key.begins_with("coat") or key=="scarf_tail": continue
		var angles=pose.get(key,[0,0,0])
		var target=Quaternion.from_euler(Vector3(deg_to_rad(angles[0]),deg_to_rad(angles[1]),deg_to_rad(angles[2])))
		# Quaternion transitions avoid Euler wrap and preserve the interrupted pose.
		joints[key].quaternion=entry_rotations.get(key,Quaternion.IDENTITY).slerp(target,entry)
	dead_blend=move_toward(dead_blend,1.0 if model.state=="dead" or model.story_fall else 0.0,delta*2)
	rotation.z=dead_blend*1.47
	position.y=-dead_blend*.68
	var bounce=(cos(phase*2)*.012)*gait_weight
	hips.position.y=.84-.07*gait_weight+bounce+sin(visual_clock*2)*.004*(1-gait_weight)
	hips.position.x=sin(phase)*.018*gait_weight
	if model.state in ["dodge","ashstep"] and not model.story_fall:
		var duration=float(model.config.dodge.duration) if model.state=="dodge" else .5
		var crouch=sin(clampf(model.elapsed/duration,0,1)*PI)
		hips.position.y-=.12*crouch
		hips.rotation.z=-stride_direction.x*.14*crouch
	if model.state=="attack": hips.position.y-=.035*sin(clampf(model.elapsed/(model.attack.windup+model.attack.active+model.attack.recovery),0,1)*PI)
	# Damped secondary motion, bounded at long frames and interrupted actions.
	var step=minf(delta,1.0/30)
	var target=Vector3(clampf(speed*.035+acceleration_lean*.012,-.14,.42),sin(visual_clock*3)*.025, -stride_direction.x*gait_weight*.12)
	secondary_velocity+=(target-secondary_angles)*85*step-secondary_velocity*15*step
	secondary_angles+=secondary_velocity*step
	for side in [-1,1]:
		var coat: Node3D=joints.coat_l if side<0 else joints.coat_r
		coat.rotation=Vector3(-.10-secondary_angles.x-absf(sin(phase+side*.7))*.10*gait_weight,side*.12,side*.07+secondary_angles.z)
	joints.scarf_tail.rotation=Vector3(-.12-secondary_angles.x*1.5,secondary_angles.y*2,secondary_angles.z*.7)
	sync_skin()

func plant_feet(actor: CharacterBody3D, state: String, speed: float) -> void:
	foot_placement.apply(self,actor,state,speed)
