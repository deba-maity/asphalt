class_name AnimationPolicy
extends RefCounted

static func leg(phase: float, running: bool) -> Vector2:
	# A constant-speed stance sweep with a lifted return. Two-link analytic
	# knee solution, same lengths as the authored hard-jointed leg.
	var t=fposmod(phase,TAU)/TAU
	var half_stride=.24 if running else .17
	var z=lerpf(-half_stride,half_stride,t/.60) if t<.60 else lerpf(half_stride,-half_stride,(t-.60)/.40)
	var lift=0.0 if t<.60 else sin((t-.60)/.40*PI)*(.12 if running else .075)
	var y=.66-lift
	var upper=.37
	var lower=.36
	var distance=clampf(Vector2(y,z).length(),.15,upper+lower-.002)
	var knee=-acos(clampf((distance*distance-upper*upper-lower*lower)/(2*upper*lower),-1,1))
	var hip=atan2(-z,y)-atan2(lower*sin(knee),upper+lower*cos(knee))
	return Vector2(hip,knee)

static func directional_leg(phase: float, running: bool, direction: Vector3) -> Vector3:
	var t=fposmod(phase,TAU)/TAU
	var stance=.60
	var half_stride=.30 if running else .22
	var travel=lerpf(-half_stride,half_stride,t/stance) if t<stance else lerpf(half_stride,-half_stride,smoothstep(0,1,(t-stance)/(1-stance)))
	var lift=0.0 if t<stance else sin((t-stance)/(1-stance)*PI)*(.14 if running else .085)
	var target=Vector3(-direction.x*travel,-(.66-lift),-direction.z*travel)
	var d=clampf(target.length(),.15,.728)
	var knee=-acos(clampf((d*d-.37*.37-.36*.36)/(2*.37*.36),-1,1))
	var pitch=atan2(-target.z,-target.y)-atan2(.36*sin(knee),.37+.36*cos(knee))
	return Vector3(pitch,knee,atan2(target.x,-target.y))

static func attack_blend(model: CombatModel) -> Vector3:
	var w: float=model.attack.windup
	var a: float=model.attack.active
	var r: float=model.attack.recovery
	if model.elapsed<w:
		var progress=model.elapsed/maxf(.01,w)
		var wind=smoothstep(0,1,progress/.72)
		var release=.22*smoothstep(.72,1,progress)
		return Vector3(1-wind,wind*(1-release),wind*release) # idle, anticipation, strike
	if model.elapsed<w+a:
		# At damage onset the blade has visibly left anticipation. Damage
		# and sampling use the same physics-owned elapsed clock.
		var strike=lerpf(.22,1,smoothstep(0,1,(model.elapsed-w)/maxf(.01,a)))
		return Vector3(0,1-strike,strike)
	var recover=smoothstep(0,1,(model.elapsed-w-a)/maxf(.01,r))
	return Vector3(recover,0,1-recover)
