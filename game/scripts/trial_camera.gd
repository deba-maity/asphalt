class_name TrialCamera
extends Node

var actor: Fighter
var pivot: Vector3
var initialized: bool=false
var last_physics_position: Vector3=Vector3.INF
var manual_orbit: float=0
var manual_offset: float=0
var target_id: int=0
var clock: float=0
var impact_offset=Vector2.ZERO
var impact_velocity=Vector2.ZERO

func _ready() -> void:
	actor=get_parent()
	actor.yaw.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	actor.camera.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF

func _process(delta: float) -> void:
	if not is_instance_valid(actor.world): return
	sync_target()
	if actor.world.can_play() and Preferences.gameplay_input_ready():
		orbit(-Input.get_axis("look_left","look_right")*delta*2.4,-Input.get_axis("look_up","look_down")*delta*1.7*(-1 if Preferences.invert else 1))
	manual_orbit=maxf(0,manual_orbit-delta)
	if manual_orbit<=0: manual_offset=lerpf(manual_offset,0,1-exp(-delta*3.5))
	clock+=delta
	step_impact(delta)
	var transform=actor.get_global_transform_interpolated()
	var center=transform.origin+Vector3.UP*1.4
	var distance=0.0
	var shoulder_angle := 0.0
	if is_instance_valid(actor.target) and actor.target.model.state!="dead":
		var other=actor.target.get_global_transform_interpolated().origin
		var separation=other-transform.origin
		distance=separation.length()
		shoulder_angle = lerpf(.54, .18, smoothstep(2.4, 7.8, distance))
		center+=separation.limit_length(5)*.28
		var desired_yaw=atan2(-separation.x,-separation.z)+manual_offset
		actor.yaw.rotation.y=lerp_angle(actor.yaw.rotation.y,desired_yaw,1-exp(-delta*6.5))
	# Rotate the collision arm independently of the movement yaw. The blade
	# stays beside the player's silhouette while forward still closes the gap.
	actor.pitch.rotation.y = lerp_angle(actor.pitch.rotation.y, shoulder_angle, 1-exp(-delta*6.5))
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
	var safe=actor.pitch.get_hit_length()
	var fraction=Engine.get_physics_interpolation_fraction() if get_tree().is_physics_interpolation_enabled() else 1.0
	var eased_distance=lerpf(actor.previous_camera_distance,actor.smooth_camera_distance,fraction)
	# Inward correction is immediate. Outward movement follows the interpolated
	# distance, while the spring arm positions the separate collision mount.
	actor.camera.position.z=minf(0,eased_distance-safe)
	var amount=clampf(actor.shake_time/.12,0,1)
	actor.camera.h_offset=clampf(sin(clock*71)*.025*amount*amount+impact_offset.x,-.035,.035) if Preferences.camera_shake else 0
	actor.camera.v_offset=clampf(sin(clock*53)*.012*amount*amount+impact_offset.y,-.025,.025) if Preferences.camera_shake else 0

func impact(direction: float, heavy: bool=false) -> void:
	if not Preferences.camera_shake or not is_finite(direction): return
	var strength=1.6 if heavy else .85
	impact_velocity=(impact_velocity+Vector2(clampf(direction,-1,1)*.65,.55)*strength).limit_length(2)

func step_impact(delta: float) -> void:
	if not is_finite(delta) or delta<0: return
	if not Preferences.camera_shake:
		impact_offset=Vector2.ZERO; impact_velocity=Vector2.ZERO
		return
	# Analytic critically damped response: the settling motion has the same
	# duration at 30 and 120 render frames without changing the aiming angles.
	var rate=26.0
	var impulse=(impact_velocity+impact_offset*rate)*delta
	var decay=exp(-rate*delta)
	impact_offset=(impact_offset+impulse)*decay
	impact_velocity=(impact_velocity-impulse*rate)*decay

func sync_target() -> void:
	var current=actor.target.get_instance_id() if is_instance_valid(actor.target) else 0
	if current!=target_id:
		target_id=current
		release_orbit()

func release_orbit() -> void:
	manual_orbit=0
	manual_offset=0

func orbit(horizontal: float, vertical: float) -> void:
	if not is_finite(horizontal) or not is_finite(vertical): return
	if absf(horizontal)+absf(vertical)<.000001: return
	sync_target()
	if is_instance_valid(actor.target):
		manual_offset=clampf(manual_offset+horizontal,-.38,.38)
		manual_orbit=1.2
	else:
		actor.yaw.rotation.y+=horizontal
	actor.pitch.rotation.x=clampf(actor.pitch.rotation.x+vertical,-.85,.28)
