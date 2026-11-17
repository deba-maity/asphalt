class_name PerformanceTurn
extends RefCounted

# A stationary facing change follows the authored turn's yaw curve, including
# its foot lift and settle. Moving and attacking remain responsive and bounded.
var desired: float=NAN
var active: bool=false
var clip: String="Turn90_L"
var time: float=0
var origin: float=0
var angle: float=0
var last_position: Vector3=Vector3.INF
var last_yaw: float=NAN
const RATE=1.65
const END=1.3

func step(actor: CharacterBody3D, state: String, delta: float) -> void:
	if is_nan(desired): desired=actor.rotation.y
	if actor.position.distance_to(last_position)>2 or (not is_nan(last_yaw) and absf(wrapf(actor.rotation.y-last_yaw,-PI,PI))>.001):
		active=false; desired=actor.rotation.y
	last_position=actor.position
	if state not in ["idle","guard","attack"]:
		active=false; desired=actor.rotation.y; last_yaw=actor.rotation.y; return
	var stationary=Vector2(actor.velocity.x,actor.velocity.z).length()<.22 and state in ["idle","guard"]
	var error=wrapf(desired-actor.rotation.y,-PI,PI)
	if not stationary: active=false
	if stationary and not active and absf(error)>deg_to_rad(24):
		origin=actor.rotation.y
		angle=clampf(error,-PI/2,PI/2)
		clip="Turn90_L" if angle>0 else "Turn90_R"
		time=0; active=true
	if active:
		time=minf(END,time+delta*RATE)
		actor.rotation.y=origin+angle*PerformanceMotion.turn_fraction(clip,time)
		if time>=END: active=false
	elif not stationary:
		actor.rotation.y=rotate_toward(actor.rotation.y,desired,delta*(10 if state=="attack" else 8))
	last_yaw=actor.rotation.y
