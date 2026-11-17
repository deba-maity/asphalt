class_name PerformanceBalance
extends RefCounted

# Small additive responses on top of authored motion. Rotations are applied in
# rig space and converted through each bone's actual parent, never guessed axes.
var previous_velocity: Vector3=Vector3.ZERO
var lean: Vector3=Vector3.ZERO
var gaze: float=0
var gaze_pitch: float=0
var global_rotations: Array[Quaternion]=[]

func apply(figure: PerformanceFigure, actor: Fighter, delta: float) -> void:
	var acceleration=(actor.velocity-previous_velocity)/maxf(.001,delta)
	previous_velocity=actor.velocity
	var allowed=actor.model.state in ["idle","guard"]
	var local=actor.global_basis.inverse()*acceleration
	var desired_lean=Vector3(-local.z,0,local.x).limit_length(18)*.006 if allowed else Vector3.ZERO
	lean=lean.lerp(desired_lean,1-exp(-delta*10))
	var desired_gaze=0.0
	if allowed and not is_nan(actor.turning.desired): desired_gaze=clampf(wrapf(actor.turning.desired-actor.rotation.y,-PI,PI),-.65,.65)
	gaze=lerpf(gaze,desired_gaze,1-exp(-delta*12))
	var target: Fighter=actor.target if actor.player else (actor.world.hero if actor.world is TrialWorld else null)
	var desired_pitch=0.0
	if allowed and is_instance_valid(target) and target.model.state!="dead":
		var offset=target.global_position+Vector3.UP*1.40-(actor.global_position+Vector3.UP*1.60)
		desired_pitch=clampf(-atan2(offset.y,maxf(.6,Vector2(offset.x,offset.z).length())),-.22,.22)
	gaze_pitch=lerpf(gaze_pitch,desired_pitch,1-exp(-delta*9))
	if not allowed: return
	global_rotations.resize(figure.rotations.size())
	for bone in figure.rotations.size():
		var parent=figure.body_skeleton.get_bone_parent(bone)
		var parent_rotation=global_rotations[parent] if parent>=0 else Quaternion.IDENTITY
		var global_rotation=parent_rotation*figure.rotations[bone]
		var offset=Vector3.ZERO
		match figure.body_skeleton.get_bone_name(bone):
			"spine_01": offset=lean*.45+Vector3.UP*gaze*.08
			"spine_02": offset=lean*.55+Vector3.UP*gaze*.12
			"neck_01": offset=-lean*.25+Vector3.UP*gaze*.35+Vector3.RIGHT*gaze_pitch*.35
			"Head": offset=-lean*.25+Vector3.UP*gaze*.45+Vector3.RIGHT*gaze_pitch*.65
		if offset.length_squared()>.0000001:
			global_rotation=PoseTransition.exponential(offset)*global_rotation
			figure.rotations[bone]=(parent_rotation.inverse()*global_rotation).normalized()
		global_rotations[bone]=global_rotation
