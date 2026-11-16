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

static func directional_leg(phase: float, running: bool, direction: Vector3, speed: float=0) -> Vector3:
	if speed<=0: speed=5.7 if running else 3.4
	var t=fposmod(phase,TAU)/TAU
	var stance=stance_fraction(speed)
	var half_stride=speed/cadence(speed)*stance*.5
	var travel=lerpf(-half_stride,half_stride,t/stance) if t<stance else lerpf(half_stride,-half_stride,smoothstep(0,1,(t-stance)/(1-stance)))
	var lift=0.0 if t<stance else sin((t-stance)/(1-stance)*PI)*(.24 if running else .12)
	var target=Vector3(-direction.x*travel,-(.62-lift),-direction.z*travel)
	var d=clampf(target.length(),.15,.728)
	var knee=-acos(clampf((d*d-.37*.37-.36*.36)/(2*.37*.36),-1,1))
	var pitch=atan2(-target.z,-target.y)-atan2(.36*sin(knee),.37+.36*cos(knee))
	return Vector3(pitch,knee,atan2(target.x,-target.y))

static func cadence(speed: float) -> float:
	# Full left-to-left cycles/second; distance-driven phase stops at walls.
	return lerpf(.8,2.05,clampf(speed/5.7,0,1))

static func stance_fraction(speed: float) -> float:
	# Contact length must fit the .73m leg chain. At a sprint this leaves
	# flight time between feet rather than dragging a plant out of reach.
	return clampf(.60*cadence(speed)/maxf(.1,speed),.215,.60)

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
