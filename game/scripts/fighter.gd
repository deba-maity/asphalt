class_name Fighter
extends CharacterBody3D

signal slain(fighter: Fighter)
signal feedback(text: String)
var model: CombatModel = CombatModel.new()
var figure: Figure
var player: bool = false
var use_performance: bool = false
var combo_index: int = 0
var impact_pause: float = 0
var reaction_clip: String = "Hit_Chest"
var reaction_serial: int=0
var effects: CombatEffects
var swing_cue: String=""
var enemy_id: String = ""
var kind: String = "road_bandit"
var encounter_id: String = ""
var actor_color: Color = Color("4b6975")
var definition: Dictionary = {}
var world: Node3D
var yaw: Node3D
var pitch: SpringArm3D
var camera: Camera3D
var target: Fighter
var dodge_vector: Vector3 = Vector3.ZERO
var ai_cooldown: float = 0.7
var sequence: int = 0
var hitbox: Area3D
var hurtbox: Area3D
var health_bar: MeshInstance3D
var tell_ring: MeshInstance3D
var ai_enabled: bool = true
var test_direction: Vector3 = Vector3.ZERO
var use_test_direction: bool = false
var total_distance: float = 0
var last_state: String = "idle"
var camera_focus: Vector3 = Vector3.ZERO
var wait_age: float = 0
var fired_serial: int = -1
var phase: int = 1
var phase_time: float = 0
var repeated_lights: int = 0
var light_memory: float = 0
var ash_trail: MeshInstance3D
var intent: ActionBuffer=ActionBuffer.new()
var next_step_distance: float=0
var shake_time: float=0
var smooth_camera_distance: float=5.6
var previous_camera_distance: float=5.6
var camera_obstruction: bool=false
var impact_ring: MeshInstance3D
var impact_time: float=0
var hit_query: PhysicsShapeQueryParameters3D
var hit_sphere: SphereShape3D
var turning=PerformanceTurn.new()
var weapon_sweep=WeaponSweep.new()
var trial_camera: TrialCamera
var target_lost_time: float=0
var denial_cooldown: float=0
var guard_press_remaining: float=0

func _ready() -> void:
	floor_snap_length=.35
	floor_max_angle=deg_to_rad(46)
	wall_min_slide_angle=deg_to_rad(10)
	collision_layer = 2 if player else 4
	collision_mask = (1 | 4 | 32) if player else (1 | 2)
	var capsule = CapsuleShape3D.new()
	capsule.radius = 0.30
	capsule.height = 1.8
	var collider = CollisionShape3D.new()
	collider.shape = capsule
	collider.position.y = 0.9
	add_child(collider)
	if use_performance:
		PerformanceMotion.configure(model,not player)
		figure=PerformanceFigure.new()
		figure.role="rayan" if player else "warden"
		intent.window=.45
	else:
		figure = load("res://assets/characters/"+("rayan" if player else kind)+".tscn").instantiate()
	add_child(figure)
	if use_performance:
		effects=CombatEffects.new()
		add_child(effects)
	hurtbox = Area3D.new()
	hurtbox.collision_layer = 8 if player else 16
	hurtbox.collision_mask = 0
	hurtbox.set_meta("fighter",self)
	var hurtshape = CollisionShape3D.new()
	hurtshape.shape = capsule
	hurtshape.position.y = 0.9
	hurtbox.add_child(hurtshape)
	add_child(hurtbox)
	hitbox = Area3D.new()
	hitbox.name = "WeaponActiveVolume"
	hitbox.collision_layer = 0
	hitbox.collision_mask = 16 if player else 8
	hitbox.monitoring = false
	var hitshape = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 1.1
	hitshape.shape = sphere
	hitbox.add_child(hitshape)
	hitbox.position = Vector3(0,0.9,-1.1)
	add_child(hitbox)
	hit_query=PhysicsShapeQueryParameters3D.new()
	hit_sphere=SphereShape3D.new()
	hit_query.shape=hit_sphere
	hit_query.collision_mask=16 if player else 8
	hit_query.collide_with_areas=true
	hit_query.collide_with_bodies=false
	if player:
		yaw = Node3D.new()
		yaw.top_level = true
		add_child(yaw)
		pitch = SpringArm3D.new()
		pitch.rotation.x = -0.31
		pitch.spring_length = 4.25
		pitch.margin = 0.24
		var camera_shape = SphereShape3D.new()
		camera_shape.radius = 0.2
		pitch.shape = camera_shape
		pitch.collision_mask = 1
		pitch.add_excluded_object(get_rid())
		yaw.add_child(pitch)
		camera = Camera3D.new()
		camera.fov = 59
		camera.near = 0.1
		if use_performance:
			# SpringArm owns its direct child's position. A mount lets the camera
			# retain an inward offset while easing back out after obstruction.
			var mount=Node3D.new(); mount.name="CollisionMount"
			pitch.add_child(mount); mount.add_child(camera)
		else: pitch.add_child(camera)
		camera.current = true
		Preferences.input_reset.connect(clear_intent)
		if use_performance:
			trial_camera=TrialCamera.new()
			add_child(trial_camera)
	else:
		definition = model.config.enemies[kind]
		model.max_health = definition.health
		model.health = definition.health
		scale = Vector3.ONE * float(definition.scale)
		health_bar = Figure.box(self,Vector3(0.85,0.055,0.04),Vector3(0,2.15,0),Color("d68b64"))
		health_bar.visible = false
	var ring = TorusMesh.new()
	ring.inner_radius = 0.44
	ring.outer_radius = 0.50
	ring.rings = 20
	ring.ring_segments = 6
	tell_ring = MeshInstance3D.new()
	tell_ring.mesh = ring
	tell_ring.material_override = Figure.material(Color("e9b567"))
	tell_ring.position.y = 0.04
	tell_ring.visible = false
	add_child(tell_ring)
	impact_ring=MeshInstance3D.new()
	impact_ring.mesh=ring
	impact_ring.material_override=Figure.material(Color("edc58e"))
	impact_ring.position.y=1.0
	impact_ring.visible=false
	add_child(impact_ring)
	if player:
		ash_trail = Figure.cylinder(self,.52,.34,.10,Vector3(0,.18,0),Color("9dd8df"),12)
		ash_trail.visible = false

func _unhandled_input(event: InputEvent) -> void:
	if not player or world == null or not world.can_play():
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		apply_mouse_motion(event)
	if not Preferences.gameplay_input_ready(): return
	if event.is_action_pressed("guard") and not event.is_echo():
		guard_press_remaining=.12
		intent.clear()
	elif event.is_action_released("guard"):
		guard_press_remaining=0
	if event.is_action_pressed("lock_on"):
		toggle_target()
	for action in ["light","heavy","dodge","heal","ashstep"]:
		if event.is_action_pressed(action) and not event.is_echo():
			queue_intent(action)
			get_viewport().set_input_as_handled()
			break

func clear_intent() -> void:
	intent.clear()
	guard_press_remaining=0
	model.guard(false)
	if trial_camera!=null: trial_camera.release_orbit()
	velocity.x=0
	velocity.z=0

func apply_mouse_motion(event: InputEventMouseMotion) -> void:
	# Screen-relative motion keeps sensitivity independent of viewport stretching.
	var movement=event.screen_relative*Preferences.sensitivity
	if not movement.is_finite(): return
	if trial_camera!=null:
		trial_camera.orbit(-movement.x,-movement.y*(-1 if Preferences.invert else 1))
	else:
		yaw.rotation.y-=movement.x
		pitch.rotation.x=clampf(pitch.rotation.x-movement.y*(-1 if Preferences.invert else 1),-.85,.28)

func cue_sound(id: String) -> void:
	if use_performance and world is TrialWorld: world.foley.event(id,global_position+Vector3.UP)
	else: Sound.play(id)

func deny_action(message: String) -> void:
	if player and denial_cooldown<=0:
		feedback.emit(message)
		denial_cooldown=.8

func queue_intent(action: String) -> void:
	intent.push(action,model,desired_direction())
	consume_intent()

func consume_intent() -> void:
	if intent.action.is_empty(): return
	if use_performance and model.state=="attack":
		var cancel_at=PerformanceMotion.cancel_time(model,intent.action)
		if model.elapsed>=cancel_at and intent.action in ["light","dodge"]:
			var next_id=["light","trial_second","trial_finish"][next_combo_index()]
			var cost=float(model.config.stamina.dodge_cost) if intent.action=="dodge" else float(model.config.attacks[next_id].cost)
			if model.stamina>=cost: model.state="idle"
	if not model.can_begin(): return
	var action=intent.action
	var direction=intent.direction
	intent.clear()
	match action:
		"light","heavy": try_attack(action)
		"dodge":
			if try_dodge() and direction.length()>.1:
				dodge_vector=direction.normalized()
				select_evade_clip()
		"ashstep":
			if try_ashstep() and direction.length()>.1: dodge_vector=direction.normalized()
		"heal": try_heal()

func next_combo_index() -> int:
	return (combo_index+1)%3 if light_memory>0 and combo_index>=0 else 0

func try_attack(id: String) -> bool:
	if use_performance and player and id=="heavy" and world is TrialWorld and world.duel.can_riposte(): id="trial_riposte"
	if use_performance and player and id=="heavy" and Input.is_action_pressed("sprint"):
		if desired_direction().dot(-global_basis.z)>.6: id="trial_dash"
	if player and id == "heavy" and model.ash_unlocked and model.counter_window>0: id="opening_counter"
	var proposed_combo=combo_index
	if use_performance and player and id=="light":
		proposed_combo=next_combo_index()
		id=["light","trial_second","trial_finish"][proposed_combo]
	var ok = model.start_attack(id)
	if ok:
		if use_performance and world is TrialWorld: world.duel.attack_started(self,id)
		if use_performance and player: combo_index=proposed_combo if id in ["light","trial_second","trial_finish"] else -1
		if is_instance_valid(target):
			face(target.global_position)
		if not use_performance: Sound.play(str(model.attack.get("cue","swing")))
		if player:
			world.learn(id)
			repeated_lights = repeated_lights+1 if id == "light" else 0
			light_memory = 2.5 if not use_performance else 2.0
			if id == "opening_counter":
				model.counter_window=0
				feedback.emit("Opening counter · commit, then recover.")
	elif player and model.can_begin():
		deny_action("Not enough stamina - let it recover.")
	return ok

func try_ashstep() -> bool:
	if not model.ashstep():
		if model.ash_unlocked: deny_action("Ashstep needs one Resolve. Land strikes or parry to recover it.")
		elif use_performance: deny_action("Ashstep belongs to the story campaign. Use {dodge} to evade here.")
		return false
	dodge_vector = desired_direction().normalized()
	if dodge_vector.length()<.1: dodge_vector = -global_basis.z
	cue_sound("heal")
	world.learn("ashstep")
	return true

func try_dodge() -> bool:
	if not model.dodge():
		if model.can_begin(): deny_action("Not enough stamina to evade.")
		return false
	dodge_vector = desired_direction().normalized()
	if dodge_vector.length() < 0.1:
		dodge_vector = -global_basis.z
	select_evade_clip()
	if player:
		world.learn("dodge")
	cue_sound("dodge" if use_performance else "swing")
	return true

func select_evade_clip() -> void:
	if not use_performance: return
	var local=global_basis.inverse()*dodge_vector
	model.config["dodge_clip"]=("Dodge_Left" if local.x<0 else "Dodge_Right") if absf(local.x)>.7 else "Roll"

func try_heal() -> bool:
	if not model.can_begin(): return false
	if Session.data.heals<=0:
		deny_action("No draughts remain.")
		return false
	if model.health>=model.max_health:
		deny_action("Health is already full.")
		return false
	if Session.data.heals > 0 and model.heal():
		Session.data.heals -= 1
		Session.data.health = model.health
		Session.save()
		if not use_performance: cue_sound("heal")
		world.learn("heal")
		feedback.emit("Drinking - stay clear of incoming strikes." if use_performance else "Healing draught · +48 health")
		return true
	return false

func toggle_target() -> void:
	target_lost_time=0
	if is_instance_valid(target):
		target = null
		return
	var best_score = -1000.0
	for enemy in world.enemies:
		if not is_instance_valid(enemy) or enemy.model.state == "dead":
			continue
		var distance = global_position.distance_to(enemy.global_position)
		var to_enemy = (enemy.global_position-global_position).normalized()
		var score=(-camera.global_basis.z).dot(to_enemy)*3.0-distance*.3
		if distance < 13 and score>best_score and clear_sight(enemy):
			best_score = score
			target = enemy
	world.learn("lock")

func clear_sight(other: Fighter) -> bool:
	var ray = PhysicsRayQueryParameters3D.create(global_position+Vector3.UP,other.global_position+Vector3.UP,1)
	return get_world_3d().direct_space_state.intersect_ray(ray).is_empty()

func face(point: Vector3) -> void:
	var diff = point-global_position
	if Vector2(diff.x,diff.z).length() > 0.05:
		if use_performance: turning.desired=atan2(-diff.x,-diff.z)
		else: rotation.y = atan2(-diff.x,-diff.z)

func desired_direction() -> Vector3:
	if use_test_direction:
		return test_direction
	var axis = Input.get_vector("move_left","move_right","move_forward","move_back")
	var direction=yaw.basis*Vector3(axis.x,0,axis.y)
	return direction if use_performance else direction.normalized()

func _physics_process(delta: float) -> void:
	if world == null:
		return
	denial_cooldown=maxf(0,denial_cooldown-delta)
	if player and world.can_play() and Preferences.gameplay_input_ready() and Input.is_action_just_pressed("guard"):
		guard_press_remaining=.12
	if use_performance and impact_pause>0:
		impact_pause=maxf(0,impact_pause-delta)
		figure.interpolator.freeze()
		figure.interpolator.display(figure.body_skeleton,1)
		figure.cape.step(delta)
		if player: update_camera_collision(delta)
		return
	if player:
		intent.tick(delta)
		guard_press_remaining=maxf(0,guard_press_remaining-delta)
		model.parry_multiplier=1.4 if Preferences.difficulty=="story" else 1.0
		if not world.can_play(): intent.clear()
	var previous_health=model.health
	model.tick(delta)
	if use_performance and player and model.state=="heal" and model.health>previous_health:
		cue_sound("heal")
		feedback.emit("Draught restored health.")
	light_memory = maxf(0,light_memory-delta)
	if light_memory<=0: repeated_lights=0
	if player:
		if world.can_play() and Preferences.gameplay_input_ready(): consume_intent()
		if Session.running: Session.data.resolve=model.resolve
		collision_mask = 1|4|(0 if model.state=="ashstep" and model.invulnerable() else 32)
		ash_trail.visible = model.state=="ashstep" or model.counter_window>0
		update_player(delta)
	else:
		update_enemy(delta)
	if use_performance:
		if model.state=="attack" and model.elapsed>=float(model.attack.get("tracking",.12)): turning.desired=rotation.y
		turning.step(self,model.state,delta)
	if use_performance and world.can_play() and model.state in ["attack","dodge"]:
		var root_delta=PerformanceMotion.displacement(model,delta)
		root_delta*=figure.motion_scale
		if model.state=="dodge": root_delta=dodge_vector*(-root_delta.z)
		else: root_delta=global_basis*root_delta
		velocity.x=root_delta.x/maxf(delta,.001)
		velocity.z=root_delta.z/maxf(delta,.001)
	if model.active() and world.can_play():
		if use_performance:
			var cue=str(model.swing_serial)+":"+str(model.active_window())
			if cue!=swing_cue:
				swing_cue=cue
				cue_sound("swing")
		if model.attack.get("projectile",false):
			if fired_serial != model.swing_serial:
				fired_serial=model.swing_serial
				world.spawn_projectile(self)
		elif not use_performance: apply_hits()
	if not is_on_floor():
		velocity.y -= 22*delta
	else:
		velocity.y = -0.5
	var before = position
	move_and_slide()
	total_distance += Vector2(position.x-before.x,position.z-before.z).length()
	var displacement=position-before
	figure.animate(delta,model,Vector2(displacement.x,displacement.z).length()/maxf(.001,delta),global_basis.inverse()*displacement)
	var visual_speed=Vector2(displacement.x,displacement.z).length()/maxf(.001,delta)
	var contacts_before=figure.foot_placement.contact_count
	figure.plant_feet(self,model.state,visual_speed)
	if use_performance:
		weapon_sweep.sample(figure)
		if world.can_play() and model.state=="attack": weapon_sweep.strike(self)
	if figure.foot_placement.contact_count>contacts_before and visual_speed>.3 and model.state in ["idle","guard"]:
		if use_performance: world.foley.event("step",global_position,lerpf(.6,1.1,clampf(visual_speed/5.7,0,1)))
		elif player: Sound.footstep(Session.data.zone)
	if player:
		update_camera_collision(delta)
	impact_time=maxf(0,impact_time-delta)
	impact_ring.visible=impact_time>0 and not Preferences.reduced_effects and not use_performance
	impact_ring.scale=Vector3.ONE*(.25+(.16-impact_time)*2)
	if not player:
		health_bar.visible = model.health < model.max_health and model.state != "dead"
		health_bar.scale.x = maxf(0.01,model.health/model.max_health)
		tell_ring.visible = model.state == "attack" and model.elapsed < float(model.attack.windup)
		tell_ring.scale = Vector3.ONE*(1.0+model.elapsed*0.7)
		var unblockable=model.state=="attack" and not model.attack.get("blockable",true)
		tell_ring.material_override=Figure.material(Color("df9d72") if unblockable else Color("e9c48c"))
	if last_state != model.state:
		if model.state == "dead":
			collision_layer = 0
			hurtbox.set_deferred("collision_layer",0)
			slain.emit(self)
		last_state = model.state

func update_player(delta: float) -> void:
	if not use_performance: yaw.global_position = global_position+Vector3(0,1.45,0)+camera_focus
	if is_instance_valid(target):
		if target.model.state=="dead" or global_position.distance_to(target.global_position)>17:
			target=null
		elif not clear_sight(target):
			target_lost_time+=delta
			if target_lost_time>=(.35 if use_performance else 0.0): target=null
		else: target_lost_time=0
	else: target_lost_time=0
	if is_instance_valid(target):
		var diff = target.global_position-global_position
		if not use_performance: yaw.rotation.y = lerp_angle(yaw.rotation.y,atan2(-diff.x,-diff.z),1-exp(-delta*7))
		if model.can_begin() or (use_performance and model.state=="attack" and model.elapsed<float(model.attack.get("tracking",.12))):
			face(target.global_position)
	if not world.can_play():
		velocity.x = 0
		velocity.z = 0
		return
	if not use_performance:
		yaw.rotation.y -= Input.get_axis("look_left","look_right")*delta*2.4
		pitch.rotation.x = clampf(pitch.rotation.x-Input.get_axis("look_up","look_down")*delta*1.7*(-1 if Preferences.invert else 1),-0.85,0.28)
	var holding_guard=Input.is_action_pressed("guard") and Preferences.gameplay_input_ready()
	model.guard(holding_guard,not use_performance or guard_press_remaining>0)
	if not holding_guard or model.state=="guard": guard_press_remaining=0
	if model.state == "guard":
		world.learn("guard")
	var direction = desired_direction()
	var speed = 3.4
	var forward_amount=direction.normalized().dot(-global_basis.z)
	if use_performance and is_instance_valid(target):
		speed=lerpf(2.8,3.4,maxf(0,forward_amount)) if forward_amount>=0 else lerpf(2.8,2.4,-forward_amount)
	var sprint_allowed=not use_performance or not is_instance_valid(target) or forward_amount>.65
	if sprint_allowed and Input.is_action_pressed("sprint") and direction.length() > 0.1 and model.state == "idle" and model.spend(12*delta):
		speed = 5.7
	if model.state == "guard":
		speed = 1.45
	elif model.state == "dodge":
		direction = dodge_vector
		speed = float(model.config.dodge.speed)*(1-model.elapsed/float(model.config.dodge.duration)*0.55)
	elif model.state == "ashstep":
		direction = dodge_vector
		speed = 11.5
	elif model.state != "idle":
		speed = 0
	if not Preferences.gameplay_input_ready() and not use_test_direction: direction=Vector3.ZERO
	if direction.length() > 0.1 and speed > 0 and model.state not in ["dodge","ashstep"] and not is_instance_valid(target):
		if use_performance: turning.desired=atan2(-direction.x,-direction.z)
		else: rotation.y = lerp_angle(rotation.y,atan2(-direction.x,-direction.z),1-exp(-delta*14))
	var acceleration=20.0 if direction.length()>.1 else 28.0
	velocity.x = move_toward(velocity.x,direction.x*speed,delta*acceleration) if use_performance and model.state=="idle" else direction.x*speed
	velocity.z = move_toward(velocity.z,direction.z*speed,delta*acceleration) if use_performance and model.state=="idle" else direction.z*speed
	if total_distance > 5:
		world.learn("move")

func update_enemy(delta: float) -> void:
	velocity.x = 0
	velocity.z = 0
	if use_performance and world is TrialWorld and world.duel!=null:
		world.duel.drive_warden(self,delta)
		return
	if model.state in ["dead","talk"] or not ai_enabled or not world.can_play():
		return
	if model.state == "transition":
		phase_time -= delta
		if phase_time<=0: model.state="idle"
		return
	var hero: Fighter = world.hero
	if hero.model.state == "dead" or (Session.data.chapter == "ch01_bread_steel" and not Session.flag("evt_contract")):
		return
	if world.coordinator != null and self not in world.coordinator.active: return
	var behavior: String = definition.get("behavior","aggressive")
	if behavior == "halvek" and phase == 1 and model.health <= model.max_health*.58:
		phase=2
		model.state="transition"
		model.elapsed=0
		phase_time=1.8
		world.ui.announce("HALVEK · THE SEAL BREAKS")
		world.ui.toast("His shield stance is gone. The overhead seal cannot be guarded; evade or Ashstep.",5)
		return
	var diff = hero.global_position-global_position
	var distance = diff.length()
	if distance > float(definition.notice) or not clear_sight(hero):
		return
	if model.state != "attack" or model.elapsed < float(model.attack.get("tracking",0.12)):
		face(hero.global_position)
	if model.state=="attack" and model.attack_id=="elite_catch" and model.elapsed<float(model.attack.tracking):
		velocity.x=-global_basis.z.x*3.3
		velocity.z=-global_basis.z.z*3.3
	ai_cooldown -= delta
	if model.can_begin():
		if behavior=="elite" and hero.model.state in ["dodge","ashstep"] and distance<4.5 and world.coordinator.may_attack(self):
			try_attack("elite_catch")
			ai_cooldown=.4
			return
		var ranged = behavior=="ranged" or (behavior=="serit" and sequence%3==1)
		var preferred = 8.5 if ranged else (2.35 if behavior in ["heavy","warden","halvek","serit"] or kind=="foreman" else 1.7)
		if ranged and distance<4.0:
			model.guard(false)
			velocity.x=-diff.normalized().x*float(definition.speed)*.6
			velocity.z=-diff.normalized().z*float(definition.speed)*.6
		elif distance > preferred:
			model.guard(false)
			var direction = diff.normalized()
			velocity.x = direction.x*float(definition.speed)
			velocity.z = direction.z*float(definition.speed)
		elif ai_cooldown <= 0 and world.coordinator.may_attack(self):
			var patterns: Array = definition.phase2 if behavior=="halvek" and phase==2 else definition.attacks
			var attack_name: String = patterns[sequence % patterns.size()]
			if behavior=="elite" and hero.model.state in ["dodge","ashstep"]: attack_name="elite_catch"
			if behavior=="kesran" and hero.model.state=="attack": attack_name="kesran_return"
			sequence += 1
			try_attack(attack_name)
			ai_cooldown = .5 if behavior in ["guard","kesran"] else .30
		else:
			var patient = behavior in ["guard","kesran"] or (behavior=="elite" and hero.repeated_lights>=2) or (behavior=="halvek" and phase==1)
			model.guard(patient)
			if not patient and distance<4 and world.coordinator.lease != self:
				var tangent = Vector3(-diff.z,0,diff.x).normalized()
				velocity.x=tangent.x*.65
				velocity.z=tangent.z*.65

func apply_hits() -> void:
	hit_sphere.radius = float(model.attack.reach)*0.57
	hit_query.transform = global_transform.translated_local(Vector3(0,0.9,-float(model.attack.reach)*0.52))
	for result in get_world_3d().direct_space_state.intersect_shape(hit_query,8):
		var other: Fighter = result.collider.get_meta("fighter",null)
		if other == null or other == self or other.player == player or other.model.state == "dead":
			continue
		var to_other = other.global_position-global_position
		to_other.y = 0
		if to_other.length() > float(model.attack.reach) or (-global_basis.z).dot(to_other.normalized()) < float(model.attack.arc) or not clear_sight(other):
			continue
		if model.claim_hit(other.get_instance_id()):
			other.take_damage(float(model.attack.damage),self)

func take_damage(amount: float, attacker: Fighter, attack_rules: Dictionary={}, contact: Vector3=Vector3.INF) -> String:
	if not is_instance_valid(attacker): return "ignored"
	var health_before=model.health
	var in_front = (-global_basis.z).dot((attacker.global_position-global_position).normalized()) > 0.0
	var rules: Dictionary = attack_rules if not attack_rules.is_empty() else attacker.model.attack
	var heavy_hit = rules.get("pose","")=="heavy" and attacker.player
	var armor = not player and (kind == "foreman" or definition.get("behavior","") in ["heavy","warden","serit","halvek"]) and model.state == "attack" and not heavy_hit
	if not player and model.state=="guard" and heavy_hit and ("tempered_edge" in Session.data.unlocks or attacker.model.attack_id=="opening_counter"):
		model.state="hit"
		model.elapsed=-.45
		world.ui.toast("Guard broken · tempered edge")
	if player and Preferences.difficulty=="story": amount*=.6
	var result = model.receive(amount,in_front,armor,rules)
	if model.state in ["hit","dead"]:
		intent.clear()
		guard_press_remaining=0
	if player and use_performance and model.last_guard_broken:
		feedback.emit("Guard broken - release guard and recover stamina.")
	if result == "ash_evade":
		world.on_ash_evade()
		cue_sound("parry")
	if result == "parry":
		if attack_rules.is_empty() and attacker.model.state!="dead":
			attacker.model.state = "hit"
			attacker.model.elapsed = -0.65
			attacker.reaction_serial+=1
			attacker.reaction_clip="Hit_Chest"
		cue_sound("parry")
		if player:
			world.learn("parry")
		feedback.emit("Parry! Their guard is open.")
	elif result == "guard":
		cue_sound("guard")
	elif result in ["hit","dead"]:
		cue_sound("hit")
		if attacker.player and attacker.use_performance and attacker.trial_camera!=null:
			var impact_side=attacker.global_basis.inverse()*(global_position-attacker.global_position)
			attacker.trial_camera.impact(clampf(impact_side.x,-1,1),rules.get("pose","")=="heavy")
		if player:
			Session.data.health = model.health
		elif attacker.player:
			attacker.model.resolve = minf(3,attacker.model.resolve+.25)
			Session.data.resolve=attacker.model.resolve
	if player: Session.data.resolve=model.resolve
	if use_performance and result in ["guard","parry"]: figure.recoil(result=="parry")
	if result in ["hit","dead","guard","parry","ash_evade"]:
		impact_time=.16
		if effects!=null: effects.impact(contact if contact.is_finite() else global_position+Vector3.UP*.95,(global_position-attacker.global_position).normalized(),result)
		if player and Preferences.camera_shake: shake_time=.12
		if use_performance and result in ["hit","guard","parry"]:
			impact_pause=.05 if result=="parry" else .035
			if attacker.use_performance: attacker.impact_pause=impact_pause
			var direction=global_basis.inverse()*(attacker.global_position-global_position).normalized()
			reaction_clip="Hit_Shoulder_L" if direction.x<-.35 else ("Hit_Shoulder_R" if direction.x>.35 else "Hit_Chest")
			model.config["hit_duration"]=maxf(.38,figure.library.get_animation(reaction_clip).length)
			if result=="hit" and model.state=="hit": combo_index=-1; reaction_serial+=1
	if use_performance and world is TrialWorld and world.duel!=null:
		world.duel.contact(attacker,self,result,rules,maxf(0,health_before-model.health))
	return result

func update_camera_collision(delta: float) -> void:
	# SpringArm provides the safe distance. Pull inward immediately; release
	# outward slowly without ever exceeding the collision-constrained length.
	var safe=pitch.get_hit_length()
	if safe<=0: safe=.18
	camera_obstruction=safe<pitch.spring_length-.15
	previous_camera_distance=smooth_camera_distance
	smooth_camera_distance=minf(safe,move_toward(smooth_camera_distance,safe,delta*5))
	camera.position.z=minf(0,smooth_camera_distance-safe)
	shake_time=maxf(0,shake_time-delta)
	camera.h_offset=sin(shake_time*180)*.025 if shake_time>0 and Preferences.camera_shake else 0
	figure.visible=safe>.65
