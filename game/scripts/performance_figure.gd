class_name PerformanceFigure
extends Figure

# Authored poses are sampled independently of physics rate. Locomotion shares a
# distance-driven phase; action clips use the combat clock and its damage windows.
var library: AnimationLibrary
var model_root: Node3D
var rotations: Array[Quaternion]=[]
var positions: Array[Vector3]=[]
var from_rotations: Array[Quaternion]=[]
var from_positions: Array[Vector3]=[]
var blend_age: float=1
var blend_duration: float=.16
var pose_key: String=""
var locomotion_phase: float=0
var locomotion_weight: float=0
var smooth_speed: float=0
var contact_solver=PerformanceFeet.new()
var current_clip: String="Sword_Idle"
var current_time: float=0
var death_time: float=0
var roll_yaw: float=0
var hand_index: int
var motion_scale: float=1
var transition=PoseTransition.new()
var interpolator=PoseInterpolator.new()
var angular_velocity: Array[Vector3]=[]
var linear_velocity: Array[Vector3]=[]
var physics_delta: float=1.0/60
var last_actor_position=Vector3.ZERO
var teleport: bool=true
var phase_offsets: Dictionary={}
var flask: Node3D
var dropped_weapon: bool=false
var dropped_body: RigidBody3D
var grip_bones: Array[int]=[]
var balance=PerformanceBalance.new()
var recoil_age: float=1
var recoil_strength: float=0
var reaction_time: float=0
var reaction_duration: float=.38
var cape: PerformanceCape

func _ready() -> void:
	var character="rayan" if role=="rayan" else "warden"
	model_root=load("res://assets/performance/"+character+".glb").instantiate()
	model_root.rotation.y=PI
	add_child(model_root)
	apply_materials()
	body_skeleton=model_root.find_children("*","Skeleton3D",true,false)[0]
	# Parent movement is interpolated by Godot. Bone poses and their attachments
	# are interpolated below, so disable a second transform interpolation here.
	body_skeleton.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	library=load("res://assets/performance/"+character+"_motion.res")
	motion_scale=float(library.get_meta("root_scale",1.0))
	phase_offsets=JSON.parse_string(FileAccess.get_file_as_string("res://assets/performance/gait_phases.json"))[character].phases
	for i in body_skeleton.get_bone_count():
		rotations.append(body_skeleton.get_bone_pose_rotation(i))
		positions.append(body_skeleton.get_bone_pose_position(i))
		angular_velocity.append(Vector3.ZERO)
		linear_velocity.append(Vector3.ZERO)
	from_rotations=rotations.duplicate(); from_positions=positions.duplicate()
	hand_index=body_skeleton.find_bone("hand_r")
	var grip=BoneAttachment3D.new()
	grip.bone_name="hand_r"
	body_skeleton.add_child(grip)
	weapon=Node3D.new()
	grip.add_child(weapon)
	# Local Y follows the fingers; X is the palm normal. The blade extends
	# along +Z, from the little-finger side toward the index knuckle.
	weapon.position=Vector3(0,.055,.025)
	weapon.rotation.x=-PI/2
	Figure.cylinder(weapon,.024,.024,.21,Vector3(0,-.025,0),Color("40302a"),12)
	var guard_mesh=MeshInstance3D.new(); guard_mesh.mesh=WeaponGeometry.guard()
	guard_mesh.material_override=SurfaceLibrary.material("steel",Color("82765b"),4,false)
	weapon.add_child(guard_mesh)
	var grip_wrap=MeshInstance3D.new(); grip_wrap.mesh=WeaponGeometry.wrapping()
	grip_wrap.material_override=SurfaceLibrary.material("cloth",Color("4d3027"),3,false)
	weapon.add_child(grip_wrap)
	blade=MeshInstance3D.new()
	blade.mesh=WeaponGeometry.blade()
	blade.position=Vector3(0,-.53,0)
	blade.material_override=SurfaceLibrary.material("steel",Color("a5b1b0"),3,false)
	weapon.add_child(blade)
	Figure.cylinder(weapon,.033,.026,.045,Vector3(0,.09,0),Color("998773"),12)
	flask=Node3D.new(); grip.add_child(flask)
	flask.position=Vector3(0,.075,.025); flask.rotation.x=PI/2
	Figure.cylinder(flask,.038,.044,.14,Vector3.ZERO,Color("34524a"),16)
	Figure.cylinder(flask,.025,.018,.055,Vector3(0,.095,0),Color("8b7960"),16)
	Figure.cylinder(flask,.014,.014,.002,Vector3(0,.124,0),Color("151b18"),16)
	flask.visible=false
	for bone in body_skeleton.get_bone_count():
		var bone_name=body_skeleton.get_bone_name(bone)
		if bone_name.ends_with("_r") and bone_name.split("_")[0] in ["thumb","index","middle","ring","pinky"]: grip_bones.append(bone)
	sample_pose("Sword_Idle",0,rotations,positions)
	apply_pose()
	cape=PerformanceCape.new(); cape.figure=self; add_child(cape)

func apply_materials() -> void:
	for instance in model_root.find_children("*","MeshInstance3D",true,false):
		for surface in instance.mesh.get_surface_count():
			var original=instance.get_active_material(surface)
			if not original is StandardMaterial3D or original.albedo_texture==null: continue
			if String(instance.name).begins_with("Knight"):
				var steel=original.duplicate() as StandardMaterial3D
				steel.albedo_color=Color("a99a88") if role=="rayan" else Color("6d7a80")
				steel.normal_scale=.8
				instance.set_surface_override_material(surface,steel)
				continue
			var material=ShaderMaterial.new()
			material.shader=preload("res://assets/performance/cloth.gdshader")
			material.set_shader_parameter("albedo_map",original.albedo_texture)
			material.set_shader_parameter("albedo_factor",original.albedo_color)
			material.set_shader_parameter("cloth_color",Color("70413a") if role=="rayan" else Color("353e3c"))
			material.set_shader_parameter("leather_shade",.55 if "Feet" in String(instance.name) else (.70 if "Belt" in String(instance.name) else 1.0))
			material.set_shader_parameter("has_normal",original.normal_enabled and original.normal_texture!=null)
			material.set_shader_parameter("normal_map",original.normal_texture)
			material.set_shader_parameter("normal_strength",original.normal_scale)
			material.set_shader_parameter("metallic_factor",original.metallic)
			material.set_shader_parameter("roughness_factor",original.roughness)
			material.set_shader_parameter("has_orm",original.roughness_texture!=null)
			material.set_shader_parameter("orm_map",original.roughness_texture)
			instance.set_surface_override_material(surface,material)

func sample_pose(clip: String, time: float, out_rot: Array[Quaternion], out_pos: Array[Vector3]) -> void:
	var animation=library.get_animation(clip)
	if animation==null: return
	time=fposmod(time,animation.length) if animation.loop_mode!=Animation.LOOP_NONE else clampf(time,0,animation.length)
	for bone in body_skeleton.get_bone_count():
		out_rot[bone]=animation.rotation_track_interpolate(bone*2,time)
		out_pos[bone]=animation.position_track_interpolate(bone*2+1,time)

func mix_pose(clip: String, time: float, weight: float, upper_only: bool=false) -> void:
	if weight<=.001: return
	var animation=library.get_animation(clip)
	if animation==null: return
	time=fposmod(time,animation.length) if animation.loop_mode!=Animation.LOOP_NONE else clampf(time,0,animation.length)
	for bone in body_skeleton.get_bone_count():
		if upper_only:
			var name=body_skeleton.get_bone_name(bone)
			if name in ["root","pelvis"] or name.begins_with("thigh") or name.begins_with("calf") or name.begins_with("foot") or name.begins_with("ball"): continue
		rotations[bone]=rotations[bone].slerp(animation.rotation_track_interpolate(bone*2,time),weight)
		positions[bone]=positions[bone].lerp(animation.position_track_interpolate(bone*2+1,time),weight)

func animate(delta: float, model: CombatModel, speed: float, travel: Vector3=Vector3.ZERO, _speaking: bool=false) -> void:
	physics_delta=delta
	visual_clock+=delta
	recoil_age+=delta
	var old_rot=rotations.duplicate(); var old_pos=positions.duplicate()
	var changed=false
	var key=model.state+str(model.swing_serial if model.state=="attack" else 0)
	if model.state=="hit": key+=str(get_parent().reaction_serial)
	var turn: PerformanceTurn=get_parent().turning
	if turn.active: key+="_"+turn.clip
	if key!=pose_key:
		changed=true
		from_rotations=rotations.duplicate(); from_positions=positions.duplicate()
		blend_age=0
		blend_duration=.08 if model.state in ["attack","hit"] else .18
		pose_key=key
		if model.state in ["dodge","dead"]: contact_solver.reset()
		if model.state=="dodge":
			var actor=get_parent()
			var direction: Vector3=actor.global_basis.inverse()*actor.dodge_vector
			roll_yaw=atan2(-direction.x,-direction.z) if model.config.get("dodge_clip","Roll")=="Roll" else 0.0
		if model.state=="dead": death_time=0
		if model.state=="hit":
			reaction_time=0
			reaction_duration=float(model.config.get("hit_duration",.38))-minf(0,model.elapsed)
	blend_age+=delta
	model_root.rotation.y=lerp_angle(model_root.rotation.y,PI+(roll_yaw if model.state=="dodge" else 0.0),1-exp(-delta*30))
	smooth_speed=lerpf(smooth_speed,speed,1-exp(-delta*12))
	current_time=model.elapsed
	flask.visible=model.state=="heal"
	if model.state=="dead" and not dropped_weapon: drop_weapon()
	weapon.visible=model.state!="heal" and not dropped_weapon
	match model.state:
		"attack":
			current_clip=model.attack.get("clip","Sword_Regular_A")
			current_time=PerformanceMotion.attack_time(model)
			var end: float=model.attack.get("clip_length",.433333)
			if current_time>end and not str(model.attack.get("recovery_clip","")).is_empty():
				current_clip=model.attack.recovery_clip
				current_time-=end
		"dodge":
			current_clip=model.config.get("dodge_clip","Roll")
			current_time=model.elapsed*library.get_animation(current_clip).length/float(model.config.dodge.duration)
		"dead": death_time+=delta; current_clip="Death01"; current_time=death_time
		"hit":
			reaction_time+=delta
			current_clip=get_parent().reaction_clip
			var length=library.get_animation(current_clip).length
			current_time=minf(reaction_time,.12)+maxf(0,reaction_time-.12)*(length-.12)/maxf(.01,reaction_duration-.12)
		"heal": current_clip="Drink"; current_time=model.elapsed*3.0/float(model.config.get("heal_duration",2.3))
		"guard": current_clip="Sword_Block"; current_time=minf(model.elapsed,.2)
		_: current_clip="Sword_Idle"; current_time=visual_clock
	if turn.active: current_clip=turn.clip; current_time=turn.time
	sample_pose(current_clip,current_time,rotations,positions)
	if turn.active:
		mix_pose("Sword_Block" if model.state=="guard" else "Sword_Idle",.2 if model.state=="guard" else visual_clock,.88,true)
	elif model.state in ["idle","guard"]:
		locomotion_weight=move_toward(locomotion_weight,clampf(speed/.65,0,1),delta*7)
		if travel.length()>.001: stride_direction=stride_direction.lerp(travel.normalized(),1-exp(-delta*16)).normalized()
		var sprint=clampf((smooth_speed-4.8)/1.2,0,1)
		sprint*=smoothstep(.7,.95,-stride_direction.z)
		var idle_rot=rotations.duplicate(); var idle_pos=positions.duplicate()
		var names=["Fwd","Fwd_R","Right","Bwd_R","Bwd","Bwd_L","Left","Fwd_L"]
		var angle=fposmod(atan2(stride_direction.x,-stride_direction.z),TAU)/(PI/4)
		var first=int(angle)%8; var second=(first+1)%8; var fraction=angle-floorf(angle)
		var walk_names=["Fwd","Fwd_R","R","Bwd_R","Bwd","Bwd_L","L","Fwd_L"]
		var walk_a="Walk_"+walk_names[first]; var walk_b="Walk_"+walk_names[second]
		var jog_a="Jog_"+names[first]; var jog_b="Jog_"+names[second]
		var walk_stride=lerpf(PerformanceMotion.stride(walk_a),PerformanceMotion.stride(walk_b),fraction)
		var jog_stride=lerpf(PerformanceMotion.stride(jog_a),PerformanceMotion.stride(jog_b),fraction)
		var walk_speed=walk_stride*motion_scale/library.get_animation(walk_a).length
		var jog_speed=jog_stride*motion_scale/library.get_animation(jog_a).length
		var gait=clampf((smooth_speed-walk_speed)/maxf(.1,jog_speed-walk_speed),0,1)
		# Lateral/backward jogging has a low, quick return step. Blending it
		# halfway with the long-contact walk flattens that step into a shuffle.
		var directional_gait=smoothstep(.8,2.0,smooth_speed)
		gait=lerpf(directional_gait,gait,smoothstep(.25,.85,-stride_direction.z))
		var stride=lerpf(lerpf(walk_stride,jog_stride,gait),PerformanceMotion.stride("Sprint"),sprint)*motion_scale
		locomotion_phase=fposmod(locomotion_phase+Vector2(travel.x,travel.z).length()/stride,1)
		sample_pose(walk_a,gait_time(walk_a),rotations,positions)
		mix_pose(walk_b,gait_time(walk_b),fraction)
		var walk_rot=rotations.duplicate(); var walk_pos=positions.duplicate()
		sample_pose(jog_a,gait_time(jog_a),rotations,positions)
		mix_pose(jog_b,gait_time(jog_b),fraction)
		for bone in rotations.size():
			rotations[bone]=walk_rot[bone].slerp(rotations[bone],gait)
			positions[bone]=walk_pos[bone].lerp(positions[bone],gait)
		mix_pose("Sprint",gait_time("Sprint"),sprint)
		mix_pose("Sword_Block" if model.state=="guard" else "Sword_Idle",.2 if model.state=="guard" else visual_clock,.82 if sprint<.1 else .3,true)
		for bone in rotations.size():
			rotations[bone]=idle_rot[bone].slerp(rotations[bone],locomotion_weight)
			positions[bone]=idle_pos[bone].lerp(positions[bone],locomotion_weight)
	if model.state in ["idle","dodge"]:
		var grip_pose=library.get_animation("Sword_Idle")
		for bone in grip_bones: rotations[bone]=grip_pose.rotation_track_interpolate(bone*2,0)
	if model.state=="guard" and recoil_age<.45:
		var recoil_weight=sin(clampf(recoil_age/.45,0,1)*PI)*recoil_strength
		mix_pose("Hit_Chest",minf(recoil_age,.333),recoil_weight,true)
	balance.apply(self,get_parent(),delta)
	if changed:
		var incoming_rot=rotations.duplicate(); var incoming_pos=positions.duplicate()
		var incoming_angular: Array[Vector3]=[]; var incoming_linear: Array[Vector3]=[]
		if model.state not in ["idle","guard"]:
			var rate=PerformanceMotion.sample_rate(model) if model.state=="attack" else 1.0
			if model.state=="heal": rate=3.0/float(model.config.get("heal_duration",2.3))
			if model.state=="dodge": rate=library.get_animation(current_clip).length/float(model.config.dodge.duration)
			sample_pose(current_clip,current_time+.001*rate,incoming_rot,incoming_pos)
			if model.state=="dodge":
				for bone in grip_bones: incoming_rot[bone]=rotations[bone]
		for bone in rotations.size():
			incoming_angular.append(PoseTransition.logarithm(incoming_rot[bone]*rotations[bone].inverse())/.001)
			incoming_linear.append((incoming_pos[bone]-positions[bone])/.001)
		transition.begin(old_rot,old_pos,rotations,positions,angular_velocity,linear_velocity,incoming_angular,incoming_linear,blend_duration)
	transition.apply(delta,rotations,positions)
	for bone in rotations.size():
		angular_velocity[bone]=PoseTransition.logarithm(rotations[bone]*old_rot[bone].inverse())/maxf(.001,delta)
		linear_velocity[bone]=(positions[bone]-old_pos[bone])/maxf(.001,delta)
	apply_pose()

func recoil(parried: bool) -> void:
	recoil_age=0
	recoil_strength=.42 if parried else .28

func apply_pose() -> void:
	for bone in rotations.size():
		body_skeleton.set_bone_pose_rotation(bone,rotations[bone])
		body_skeleton.set_bone_pose_position(bone,positions[bone])
	body_skeleton.force_update_all_bone_transforms()

func plant_feet(actor: CharacterBody3D, state: String, speed: float) -> void:
	contact_solver.apply(body_skeleton,actor,state,speed)
	foot_placement.contact_count=contact_solver.contact_count
	teleport=actor.global_position.distance_to(last_actor_position)>2
	last_actor_position=actor.global_position
	cape.step(physics_delta,teleport)
	interpolator.capture(body_skeleton,teleport)
	if teleport: actor.reset_physics_interpolation()

func _process(_delta: float) -> void:
	if get_tree().is_physics_interpolation_enabled():
		interpolator.display(body_skeleton,Engine.get_physics_interpolation_fraction())

func gait_time(clip: String) -> float:
	return fposmod(locomotion_phase+float(phase_offsets.get(clip,0)),1)*library.get_animation(clip).length

func clear_dropped_weapon() -> void:
	if is_instance_valid(dropped_body) and not dropped_body.is_queued_for_deletion():
		dropped_body.queue_free()
	dropped_body = null

func _exit_tree() -> void:
	clear_dropped_weapon()

func drop_weapon() -> void:
	if dropped_weapon: return
	dropped_weapon=true
	var body=RigidBody3D.new()
	dropped_body = body
	body.name="DroppedSword"
	body.collision_layer=0; body.collision_mask=1
	body.mass=1.4; body.continuous_cd=true
	for part in [[Vector3(.14,.9,.07),-.57],[Vector3(.27,.09,.09),-.14],[Vector3(.11,.29,.11),0.0]]:
		var shape=CollisionShape3D.new(); var box=BoxShape3D.new()
		box.size=part[0]; shape.shape=box; shape.position.y=part[1]
		body.add_child(shape)
	var surface=PhysicsMaterial.new(); surface.friction=.7; surface.bounce=.08
	body.physics_material_override=surface
	body.contact_monitor=true; body.max_contacts_reported=1
	var visual=weapon.duplicate() as Node3D
	visual.transform=Transform3D.IDENTITY; visual.visible=true
	body.add_child(visual)
	get_parent().world.add_child(body)
	body.global_transform=weapon.global_transform
	body.reset_physics_interpolation()
	body.linear_velocity=get_parent().velocity*.35+Vector3(.3,.25,0)
	body.angular_velocity=Vector3(1.2,.3,.7)
	body.body_entered.connect(func(_other):
		if is_instance_valid(get_parent().world): get_parent().world.foley.event("guard",body.global_position,.45)
	,CONNECT_ONE_SHOT)
