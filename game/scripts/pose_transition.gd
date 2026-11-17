class_name PoseTransition
extends RefCounted

# Inertial offsets preserve the outgoing pose and angular/linear velocity while
# decaying toward the incoming authored motion. No accumulating Euler rotations.
var angles: Array[Vector3]=[]
var angular_velocities: Array[Vector3]=[]
var offsets: Array[Vector3]=[]
var velocities: Array[Vector3]=[]
var age: float=1
var decay: float=30
var active: bool=false

static func logarithm(value: Quaternion) -> Vector3:
	var q=value.normalized()
	if q.w<0: q=-q
	var sine=Vector3(q.x,q.y,q.z).length()
	if sine<.00001: return Vector3(q.x,q.y,q.z)*2
	return Vector3(q.x,q.y,q.z)*(2*atan2(sine,q.w)/sine)

static func exponential(value: Vector3) -> Quaternion:
	var angle=value.length()
	return Quaternion.IDENTITY if angle<.00001 else Quaternion(value/angle,angle)

static func offset_velocity(angle: Vector3, outgoing: Vector3, incoming: Vector3) -> Vector3:
	# q = exp(r) * incoming: its angular velocity is J_left(r)*r_dot
	# plus the incoming velocity rotated by exp(r). Invert that Jacobian so
	# non-collinear large rotations preserve velocity as well as small ones.
	var velocity=(outgoing-exponential(angle)*incoming).limit_length(24)
	var theta=angle.length()
	var coefficient=1.0/12.0+theta*theta/720.0 if theta<.01 else 1.0/(theta*theta)-1.0/(2.0*theta*tan(theta*.5))
	return velocity-.5*angle.cross(velocity)+coefficient*angle.cross(angle.cross(velocity))

func begin(old_rot: Array[Quaternion], old_pos: Array[Vector3], new_rot: Array[Quaternion], new_pos: Array[Vector3], old_angular: Array[Vector3], old_linear: Array[Vector3], incoming_angular: Array[Vector3], incoming_linear: Array[Vector3], duration: float) -> void:
	age=0; decay=6.0/maxf(.04,duration); active=true
	angles.clear(); offsets.clear(); angular_velocities.clear(); velocities.clear()
	for bone in old_rot.size():
		var angle=logarithm(old_rot[bone]*new_rot[bone].inverse())
		angles.append(angle)
		offsets.append(old_pos[bone]-new_pos[bone])
		angular_velocities.append(offset_velocity(angle,old_angular[bone],incoming_angular[bone]))
		velocities.append((old_linear[bone]-incoming_linear[bone]).limit_length(4))

func apply(delta: float, rotations: Array[Quaternion], positions: Array[Vector3]) -> void:
	if not active: return
	# The first displayed sample equals the outgoing pose. Subsequent samples
	# retain momentum, rather than slowing every joint to zero at a crossfade.
	var attenuation=exp(-decay*age)
	for bone in rotations.size():
		var angle=(angles[bone]+(angular_velocities[bone]+decay*angles[bone])*age)*attenuation
		rotations[bone]=(exponential(angle)*rotations[bone]).normalized()
		positions[bone]+=(offsets[bone]+(velocities[bone]+decay*offsets[bone])*age)*attenuation
	age+=delta
	if attenuation<.0001: active=false
