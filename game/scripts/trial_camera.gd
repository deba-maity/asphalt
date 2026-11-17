class_name TrialCamera
extends Node

var actor: Fighter
var pivot: Vector3
var initialized: bool=false
var last_physics_position: Vector3=Vector3.INF
var manual_orbit: float=0
var clock: float=0

func _ready() -> void:
	actor=get_parent()
	actor.yaw.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	actor.camera.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF

func _process(delta: float) -> void:
	if not is_instance_valid(actor.world): return
	clock+=delta
	var transform=actor.get_global_transform_interpolated()
	var center=transform.origin+Vector3.UP*1.4
	var distance=0.0
	if is_instance_valid(actor.target) and actor.target.model.state!="dead":
		var other=actor.target.get_global_transform_interpolated().origin
		var separation=other-transform.origin
		distance=separation.length()
		center+=separation.limit_length(5)*.18
		var desired_yaw=atan2(-separation.x,-separation.z)
		actor.yaw.rotation.y=lerp_angle(actor.yaw.rotation.y,desired_yaw,1-exp(-delta*6.5))
	center+=actor.yaw.basis.x*.28
	if not initialized or transform.origin.distance_to(last_physics_position)>3:
		pivot=center; initialized=true
	else:
		pivot=pivot.lerp(center,1-exp(-delta*20))
	last_physics_position=transform.origin
	actor.yaw.global_position=pivot
	var desired_length=clampf(3.6+distance*.1,3.7,4.5)
	actor.pitch.spring_length=lerpf(actor.pitch.spring_length,desired_length,1-exp(-delta*3))
	var speed=Vector2(actor.velocity.x,actor.velocity.z).length()
	var desired_fov=56.0+smoothstep(3.8,6.0,speed)*5.0
	actor.camera.fov=lerpf(actor.camera.fov,desired_fov,1-exp(-delta*4))
	var amount=clampf(actor.shake_time/.12,0,1)
	actor.camera.h_offset=sin(clock*71)*.025*amount*amount if Preferences.camera_shake else 0
	actor.camera.v_offset=sin(clock*53)*.012*amount*amount if Preferences.camera_shake else 0
