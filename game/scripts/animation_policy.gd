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

static func attack_blend(model: CombatModel) -> Vector3:
	var w: float=model.attack.windup
	var a: float=model.attack.active
	var r: float=model.attack.recovery
	if model.elapsed<w:
		var wind=smoothstep(0,1,model.elapsed/maxf(.01,w))
		return Vector3(1-wind,wind,0) # idle, anticipation, strike
	if model.elapsed<w+a:
		# At damage onset the blade has visibly left anticipation. Damage
		# and sampling use the same physics-owned elapsed clock.
		var strike=lerpf(.22,1,smoothstep(0,1,(model.elapsed-w)/maxf(.01,a)))
		return Vector3(0,1-strike,strike)
	var recover=smoothstep(0,1,(model.elapsed-w-a)/maxf(.01,r))
	return Vector3(recover,0,1-recover)
