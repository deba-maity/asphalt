class_name PoseInterpolator
extends RefCounted

var previous_rot: Array[Quaternion]=[]
var current_rot: Array[Quaternion]=[]
var previous_pos: Array[Vector3]=[]
var current_pos: Array[Vector3]=[]
var ready: bool=false

func freeze() -> void:
	previous_rot=current_rot.duplicate()
	previous_pos=current_pos.duplicate()

func capture(rig: Skeleton3D, reset: bool=false) -> void:
	previous_rot=current_rot.duplicate(); previous_pos=current_pos.duplicate()
	current_rot.clear(); current_pos.clear()
	for bone in rig.get_bone_count():
		current_rot.append(rig.get_bone_pose_rotation(bone))
		current_pos.append(rig.get_bone_pose_position(bone))
	if reset or not ready:
		previous_rot=current_rot.duplicate(); previous_pos=current_pos.duplicate()
	ready=true

func display(rig: Skeleton3D, fraction: float) -> void:
	if not ready: return
	var weight=clampf(fraction,0,1)
	for bone in current_rot.size():
		rig.set_bone_pose_rotation(bone,previous_rot[bone].slerp(current_rot[bone],weight))
		rig.set_bone_pose_position(bone,previous_pos[bone].lerp(current_pos[bone],weight))
	rig.force_update_all_bone_transforms()
