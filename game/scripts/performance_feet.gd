class_name PerformanceFeet
extends RefCounted

# Analytic two-bone correction of the imported skeleton. Solve in rig space and
# convert desired global orientations back through the actual parent basis.
var anchors: Dictionary={}
var contact_count: int=0
var max_correction: float=0

func reset() -> void: anchors.clear()

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
	for side in ["l","r"]:
		var ankle=rig.find_bone("foot_"+side); var ball=rig.find_bone("ball_"+side)
		var position=rig.to_global(rig.get_bone_global_pose(ball).origin)
		var query=PhysicsRayQueryParameters3D.create(position+Vector3.UP*.45,position-Vector3.UP*.55,1)
		query.exclude=[actor.get_rid()]
		var hit=actor.get_world_3d().direct_space_state.intersect_ray(query)
		if hit.is_empty(): anchors.erase(side); continue
		var ground: Vector3=hit.position+Vector3.UP*.025
		var height=position.y-ground.y
		if height>.13 or (anchors.has(side) and position.distance_to(anchors[side])>.30): anchors.erase(side)
		if height<.055 and not anchors.has(side):
			anchors[side]=ground
			if speed>.3: contact_count+=1
		var destination=ground
		var weight=1.0-smoothstep(.045,.14,height)
		if anchors.has(side): destination=anchors[side]
		var offset=(destination-position).limit_length(.22)
		max_correction=maxf(max_correction,offset.length()*weight)
		var ankle_world=rig.to_global(rig.get_bone_global_pose(ankle).origin)
		solve(rig,rig.find_bone("thigh_"+side),rig.find_bone("calf_"+side),ankle,rig.to_local(ankle_world+offset),weight)
