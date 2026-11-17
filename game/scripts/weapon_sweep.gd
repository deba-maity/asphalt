class_name WeaponSweep
extends RefCounted

# Sweep the real held blade between post-animation physics poses. A small
# capsule radius gives readable contact without a detached spherical hit area.
var base: Vector3
var tip: Vector3
var previous_base: Vector3
var previous_tip: Vector3
var ready: bool=false
var query=PhysicsShapeQueryParameters3D.new()
var capsule=CapsuleShape3D.new()
var queries: int=0
var contacts: int=0
var sample_time: float=0
var previous_time: float=0
var serial: int=-1
var figure: PerformanceFigure
var hand_chain: Array[int]=[]
var rig_transform=Transform3D.IDENTITY
var previous_rig_transform=Transform3D.IDENTITY

func _init() -> void:
	capsule.radius=.12
	query.shape=capsule
	query.collide_with_areas=true
	query.collide_with_bodies=false

func sample(source: PerformanceFigure) -> void:
	figure=source
	previous_base=base; previous_tip=tip
	var model: CombatModel=figure.get_parent().model
	previous_time=sample_time
	sample_time=PerformanceMotion.attack_time(model)
	if serial!=model.swing_serial:
		previous_time=0
		serial=model.swing_serial
	var rig=figure.body_skeleton
	if hand_chain.is_empty():
		var bone=figure.hand_index
		while bone>=0:
			hand_chain.push_front(bone)
			bone=rig.get_bone_parent(bone)
	previous_rig_transform=rig_transform
	rig_transform=rig.global_transform
	var transform=rig.global_transform*rig.get_bone_global_pose(figure.hand_index)*figure.weapon.transform
	base=transform*Vector3(0,-.18,0)
	tip=transform*Vector3(0,-1,0)
	if not ready or figure.teleport:
		previous_base=base; previous_tip=tip
		previous_rig_transform=rig_transform
		previous_time=sample_time
	ready=true

func blade_transform(weight: float) -> Transform3D:
	# Interpolate the same local joints used by the renderer. Interpolating
	# only world-space endpoints cuts across the elbow/wrist arc and can miss
	# a fast visible cut at 30 Hz even when it connects at 60 Hz.
	var result=previous_rig_transform.interpolate_with(rig_transform,weight)
	var poses=figure.interpolator
	for bone in hand_chain:
		var rotation=poses.previous_rot[bone].slerp(poses.current_rot[bone],weight)
		var position=poses.previous_pos[bone].lerp(poses.current_pos[bone],weight)
		result*=Transform3D(Basis(rotation).scaled(figure.body_skeleton.get_bone_pose_scale(bone)),position)
	return result*figure.weapon.transform

func strike(actor: Fighter) -> void:
	if not ready or actor.model.state!="attack" or sample_time<=previous_time: return
	query.collision_mask=16 if actor.player else 8
	var rate=float(actor.model.attack.get("rate",1.0))
	var lead=float(actor.model.attack.get("lead_in",0))
	var windows: Array=actor.model.attack.get("hit_windows",[[float(actor.model.attack.windup)*rate-lead,(float(actor.model.attack.windup)+float(actor.model.attack.active))*rate-lead]])
	for window in windows:
		var start=maxf(previous_time,float(window[0]))
		var end=minf(sample_time,float(window[1]))
		if end<=start: continue
		var fraction_start=(start-previous_time)/(sample_time-previous_time)
		var fraction_end=(end-previous_time)/(sample_time-previous_time)
		sweep_interval(actor,fraction_start,fraction_end,((start+end)*.5+lead)/rate)
		if actor.model.state!="attack": break # A parry can interrupt the attacker.

func sweep_interval(actor: Fighter, fraction_start: float, fraction_end: float, contact_time: float) -> void:
	var count=clampi(int(ceil(maxf(tip.distance_to(previous_tip),base.distance_to(previous_base))/.12)),1,8)
	for index in range(count+1):
		var weight=lerpf(fraction_start,fraction_end,float(index)/count)
		var transform=blade_transform(weight)
		var a=transform*Vector3(0,-.18,0); var b=transform*Vector3(0,-1,0)
		var direction=b-a
		if direction.length()<.001: continue
		capsule.height=direction.length()+capsule.radius*2
		query.transform=Transform3D(Basis(Quaternion(Vector3.UP,direction.normalized())),(a+b)*.5)
		queries+=1
		for result in actor.get_world_3d().direct_space_state.intersect_shape(query,8):
			var other: Fighter=result.collider.get_meta("fighter",null)
			if other==null or other==actor or other.player==actor.player or other.model.state=="dead": continue
			var to_other=other.global_position-actor.global_position
			to_other.y=0
			if to_other.length()>float(actor.model.attack.reach) or not actor.clear_sight(other): continue
			if not actor.model.claim_swept_hit(other.get_instance_id(),contact_time): continue
			var center=other.global_position+Vector3.UP
			var point=a+direction*clampf((center-a).dot(direction)/direction.length_squared(),0,1)
			contacts+=1
			other.take_damage(float(actor.model.attack.damage),actor,{},point)
