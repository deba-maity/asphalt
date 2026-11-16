class_name FootPlacement
extends RefCounted

# Two bounded ground rays per visible actor. Anchors are world-space: a stance
# foot stays put while the body advances, then releases into the swing pose.
var anchors: Dictionary={}
var last_position=Vector3.INF
var previous_state=""
var contact_count: int=0

func clear() -> void:
	anchors.clear()
	last_position=Vector3.INF
	previous_state=""

func apply(figure: Node3D, actor: CharacterBody3D, state: String, speed: float) -> void:
	if not actor.is_on_floor() or figure.dead_blend>.001 or state in ["dead","dodge","ashstep"]:
		clear(); return
	if not last_position.is_finite() or last_position.distance_to(actor.global_position)>1.0 or state!=previous_state: anchors.clear()
	last_position=actor.global_position
	previous_state=state
	var body_scale: float=figure.global_basis.get_scale().y
	var walking=speed>.12 and state in ["idle","guard"]
	var targets={}
	var pelvis_drop=0.0
	for side in 2:
		var suffix="l" if side==0 else "r"
		var ankle: Node3D=figure.joints["ankle_"+suffix]
		var phase=fposmod(figure.phase+side*PI,TAU)/TAU
		var planted=not walking or phase<AnimationPolicy.stance_fraction(speed)
		if not planted:
			anchors.erase(suffix); continue
		var foot=ankle.global_position
		if anchors.has(suffix): foot=anchors[suffix]
		var query=PhysicsRayQueryParameters3D.create(foot+Vector3.UP*.65*body_scale,foot-Vector3.UP*.85*body_scale,1)
		var hit=actor.get_world_3d().direct_space_state.intersect_ray(query)
		if hit.is_empty(): anchors.erase(suffix); continue
		foot.y=hit.position.y+.025*body_scale
		var hip: Node3D=figure.joints["leg_"+suffix]
		# Release an unreachable plant instead of stretching the skeleton.
		if Vector2(foot.x-hip.global_position.x,foot.z-hip.global_position.z).length()>.43*body_scale:
			anchors.erase(suffix); continue
		if not anchors.has(suffix): contact_count+=1
		anchors[suffix]=foot
		targets[suffix]={"point":foot,"normal":hit.normal}
		var horizontal=Vector2(foot.x-hip.global_position.x,foot.z-hip.global_position.z).length()
		var vertical_reach=sqrt(maxf(.01,pow(.726*body_scale,2)-horizontal*horizontal))
		pelvis_drop=maxf(pelvis_drop,hip.global_position.y-foot.y-vertical_reach)
	# Lower the pelvis just enough to keep both contacts inside the fixed leg
	# reach. This also handles one foot lower on a slope without stretching.
	figure.hips.position.y-=clampf(pelvis_drop/body_scale,0,.12)
	for suffix in targets:
		var foot: Vector3=targets[suffix].point
		var hip: Node3D=figure.joints["leg_"+suffix]
		var ankle: Node3D=figure.joints["ankle_"+suffix]
		var target: Vector3=hip.get_parent().to_local(foot)-hip.position
		var roll=atan2(target.x,-target.y)
		var sagittal=Basis(Vector3.BACK,-roll)*target
		var distance=clampf(sagittal.length(),.15,.728)
		var knee=-acos(clampf((distance*distance-.37*.37-.36*.36)/(2*.37*.36),-1,1))
		var pitch=atan2(-sagittal.z,-sagittal.y)-atan2(.36*sin(knee),.37+.36*cos(knee))
		# Compose explicitly: Godot's default Euler order is not Z then X.
		hip.basis=Basis(Vector3.BACK,roll)*Basis(Vector3.RIGHT,pitch)
		figure.joints["knee_"+suffix].rotation=Vector3(knee,0,0)
		var ground_basis=Basis.looking_at(-actor.global_basis.z,targets[suffix].normal)
		ankle.basis=ankle.get_parent().global_basis.orthonormalized().inverse()*ground_basis
	figure.sync_skin()
