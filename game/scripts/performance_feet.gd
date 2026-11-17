class_name PerformanceFeet
extends RefCounted

# Analytic two-bone correction of the imported skeleton. Solve in rig space and
# convert desired global orientations back through the actual parent basis.
var anchors: Dictionary={}
var contact_count: int=0
var max_correction: float=0
var weights: Dictionary={}
var cooldowns: Dictionary={}
var indices: Dictionary={}
var last_position: Vector3=Vector3.INF
var planted: Dictionary={}
var previous_heights: Dictionary={}
var previous_positions: Dictionary={}

func reset() -> void:
	anchors.clear()
	weights.clear()
	planted.clear()
	previous_heights.clear()
	previous_positions.clear()
	cooldowns.clear()

func lose_contact(side: String) -> void:
	anchors.erase(side)
	planted.erase(side)
	weights.erase(side)
	previous_heights.erase(side)
	previous_positions.erase(side)
	cooldowns[side]=.10

func rotate_bone_toward(rig: Skeleton3D, bone: int, from: Vector3, to: Vector3) -> void:
	if from.length()<.0001 or to.length()<.0001: return
	var pose=rig.get_bone_global_pose(bone)
	var turn=Quaternion(from.normalized(),to.normalized())
	var global_rotation=turn*pose.basis.get_rotation_quaternion()
	var parent=rig.get_bone_parent(bone)
	var parent_rotation=rig.get_bone_global_pose(parent).basis.get_rotation_quaternion() if parent>=0 else Quaternion.IDENTITY
	rig.set_bone_pose_rotation(bone,parent_rotation.inverse()*global_rotation)
	rig.force_update_all_bone_transforms()

func solve(rig: Skeleton3D, hip: int, knee: int, ankle: int, target: Vector3, weight: float) -> void:
	var a=rig.get_bone_global_pose(hip).origin
	var b=rig.get_bone_global_pose(knee).origin
	var c=rig.get_bone_global_pose(ankle).origin
	target=c.lerp(target,weight)
	var upper=a.distance_to(b); var lower=b.distance_to(c)
	var reach=target-a
	var distance=clampf(reach.length(),absf(upper-lower)+.002,(upper+lower)*.995)
	var direction=reach.normalized()
	var pole=(b-a)-direction*(b-a).dot(direction)
	if pole.length()<.001: pole=Vector3.FORWARD-direction*Vector3.FORWARD.dot(direction)
	pole=pole.normalized()
	var along=(upper*upper+distance*distance-lower*lower)/(2*distance)
	var desired_knee=a+direction*along+pole*sqrt(maxf(0,upper*upper-along*along))
	var foot_rotation=rig.get_bone_global_pose(ankle).basis.get_rotation_quaternion()
	rotate_bone_toward(rig,hip,b-a,desired_knee-a)
	b=rig.get_bone_global_pose(knee).origin; c=rig.get_bone_global_pose(ankle).origin
	rotate_bone_toward(rig,knee,c-b,target-b)
	var parent=rig.get_bone_parent(ankle)
	rig.set_bone_pose_rotation(ankle,rig.get_bone_global_pose(parent).basis.get_rotation_quaternion().inverse()*foot_rotation)
	rig.force_update_all_bone_transforms()

func apply(rig: Skeleton3D, actor: CharacterBody3D, state: String, speed: float) -> void:
	if state in ["dead","dodge","ashstep"] or not actor.is_on_floor(): reset(); return
	var delta=actor.get_physics_process_delta_time()
	if actor.global_position.distance_to(last_position)>2: reset()
	last_position=actor.global_position
	for side in ["l","r"]:
		if not indices.has(side): indices[side]=[rig.find_bone("thigh_"+side),rig.find_bone("calf_"+side),rig.find_bone("foot_"+side),rig.find_bone("ball_"+side)]
		cooldowns[side]=maxf(0,float(cooldowns.get(side,0))-delta)
		var ankle: int=indices[side][2]; var ball: int=indices[side][3]
		var position=rig.to_global(rig.get_bone_global_pose(ball).origin)
		var query=PhysicsRayQueryParameters3D.create(position+Vector3.UP*.45,position-Vector3.UP*.55,1)
		query.exclude=[actor.get_rid()]
		var hit=actor.get_world_3d().direct_space_state.intersect_ray(query)
		if hit.is_empty(): lose_contact(side); continue
		var ground: Vector3=hit.position+Vector3.UP*.025
		var height=position.y-ground.y
		var rising=(height-float(previous_heights.get(side,height)))/maxf(.001,delta)
		previous_heights[side]=height
		var movement=(position-Vector3(previous_positions.get(side,position)))/maxf(.001,delta)
		var foot_speed=Vector2(movement.x,movement.z).length()
		previous_positions[side]=position
		if planted.get(side,false) and (height>.065 or position.distance_to(anchors[side])>.28 or (foot_speed>maxf(1.4,speed*1.25) and rising>.05)):
			planted[side]=false
			cooldowns[side]=.12
		# Keep the old anchor while its influence fades. Replacing it in the
		# same tick as an overextended release causes a visible 20-30 cm snap.
		if height<.04 and rising<.2 and foot_speed<maxf(.8,speed*.55) and not planted.get(side,false) and float(weights.get(side,0))<.05 and float(cooldowns[side])<=0:
			anchors[side]=ground
			planted[side]=true
			cooldowns[side]=.16
			if speed>.3: contact_count+=1
		var desired_weight=1.0 if planted.get(side,false) else 0.0
		var weight=move_toward(float(weights.get(side,0)),desired_weight,delta*(20 if desired_weight>0 else 12))
		weights[side]=weight
		var offset=(Vector3(anchors[side])-position).limit_length(.22)*weight if anchors.has(side) else Vector3.ZERO
		offset.y=maxf(offset.y,ground.y-position.y)
		offset=offset.limit_length(.22)
		max_correction=maxf(max_correction,offset.length())
		var ankle_world=rig.to_global(rig.get_bone_global_pose(ankle).origin)
		solve(rig,indices[side][0],indices[side][1],ankle,rig.to_local(ankle_world+offset),1)
