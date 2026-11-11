class_name Fighter
extends CharacterBody3D

signal slain(fighter: Fighter)
signal feedback(text: String)
var model: CombatModel = CombatModel.new()
var figure: Figure
var player: bool = false
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

func _ready() -> void:
	collision_layer = 2 if player else 4
	collision_mask = 1 | (4 if player else 2)
	var capsule = CapsuleShape3D.new()
	capsule.radius = 0.30
	capsule.height = 1.8
	var collider = CollisionShape3D.new()
	collider.shape = capsule
	collider.position.y = 0.9
	add_child(collider)
	figure = load("res://assets/characters/"+("rayan" if player else kind)+".tscn").instantiate()
	add_child(figure)
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
	if player:
		yaw = Node3D.new()
		yaw.top_level = true
		add_child(yaw)
		pitch = SpringArm3D.new()
		pitch.rotation.x = -0.31
		pitch.spring_length = 5.6
		pitch.margin = 0.24
		var camera_shape = SphereShape3D.new()
		camera_shape.radius = 0.2
		pitch.shape = camera_shape
		pitch.collision_mask = 1
		pitch.add_excluded_object(get_rid())
		yaw.add_child(pitch)
		camera = Camera3D.new()
		camera.fov = 64
		camera.near = 0.1
		pitch.add_child(camera)
		camera.current = true
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

func _unhandled_input(event: InputEvent) -> void:
	if not player or world == null or not world.can_play():
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw.rotation.y -= event.relative.x * Preferences.sensitivity
		pitch.rotation.x = clampf(pitch.rotation.x-event.relative.y*Preferences.sensitivity*(-1 if Preferences.invert else 1),-0.85,0.28)
	if event.is_action_pressed("lock_on"):
		toggle_target()
	if event.is_action_pressed("light"):
		try_attack("light")
	if event.is_action_pressed("heavy"):
		try_attack("heavy")
	if event.is_action_pressed("dodge"):
		try_dodge()
	if event.is_action_pressed("heal"):
		try_heal()

func try_attack(id: String) -> bool:
	var ok = model.start_attack(id)
	if ok:
		if is_instance_valid(target):
			face(target.global_position)
		Sound.play("swing")
		if player:
			world.learn(id)
	elif player and model.can_begin():
		feedback.emit("Not enough stamina — let it recover.")
	return ok

func try_dodge() -> bool:
	if not model.dodge():
		return false
	dodge_vector = desired_direction()
	if dodge_vector.length() < 0.1:
		dodge_vector = -global_basis.z
	if player:
		world.learn("dodge")
	Sound.play("swing")
	return true

func try_heal() -> bool:
	if Session.data.heals > 0 and model.heal():
		Session.data.heals -= 1
		Session.data.health = model.health
		Session.save()
		Sound.play("heal")
		world.learn("heal")
		feedback.emit("Healing draught · +48 health")
		return true
	return false

func toggle_target() -> void:
	if is_instance_valid(target):
		target = null
		return
	var closest = 13.0
	for enemy in world.enemies:
		if not is_instance_valid(enemy) or enemy.model.state == "dead":
			continue
		var distance = global_position.distance_to(enemy.global_position)
		var to_enemy = (enemy.global_position-global_position).normalized()
		if distance < closest and (-camera.global_basis.z).dot(to_enemy) > 0.1 and clear_sight(enemy):
			closest = distance
			target = enemy
	world.learn("lock")

func clear_sight(other: Fighter) -> bool:
	var ray = PhysicsRayQueryParameters3D.create(global_position+Vector3.UP,other.global_position+Vector3.UP,1)
	return get_world_3d().direct_space_state.intersect_ray(ray).is_empty()

func face(point: Vector3) -> void:
	var diff = point-global_position
	if Vector2(diff.x,diff.z).length() > 0.05:
		rotation.y = atan2(-diff.x,-diff.z)

func desired_direction() -> Vector3:
	if use_test_direction:
		return test_direction
	var axis = Input.get_vector("move_left","move_right","move_forward","move_back")
	return (yaw.basis*Vector3(axis.x,0,axis.y)).normalized()

func _physics_process(delta: float) -> void:
	if world == null:
		return
	model.tick(delta)
	if player:
		update_player(delta)
	else:
		update_enemy(delta)
	if model.active() and world.can_play():
		apply_hits()
	if not is_on_floor():
		velocity.y -= 22*delta
	else:
		velocity.y = -0.5
	var before = position
	move_and_slide()
	total_distance += Vector2(position.x-before.x,position.z-before.z).length()
	figure.animate(delta,model,Vector2(velocity.x,velocity.z).length())
	if not player:
		health_bar.visible = model.health < model.max_health and model.state != "dead"
		health_bar.scale.x = maxf(0.01,model.health/model.max_health)
		tell_ring.visible = model.state == "attack" and model.elapsed < float(model.attack.windup)
		tell_ring.scale = Vector3.ONE*(1.0+model.elapsed*0.7)
	if last_state != model.state:
		if model.state == "dead":
			collision_layer = 0
			hurtbox.set_deferred("collision_layer",0)
			slain.emit(self)
		last_state = model.state

func update_player(delta: float) -> void:
	yaw.global_position = global_position+Vector3(0,1.45,0)+camera_focus
	if is_instance_valid(target) and (target.model.state == "dead" or global_position.distance_to(target.global_position) > 17 or not clear_sight(target)):
		target = null
	if is_instance_valid(target):
		var diff = target.global_position-global_position
		yaw.rotation.y = lerp_angle(yaw.rotation.y,atan2(-diff.x,-diff.z),1-exp(-delta*7))
		if model.can_begin():
			face(target.global_position)
	if not world.can_play():
		velocity.x = 0
		velocity.z = 0
		return
	yaw.rotation.y -= Input.get_axis("look_left","look_right")*delta*2.4
	pitch.rotation.x = clampf(pitch.rotation.x-Input.get_axis("look_up","look_down")*delta*1.7*(-1 if Preferences.invert else 1),-0.85,0.28)
	model.guard(Input.is_action_pressed("guard"))
	if model.state == "guard":
		world.learn("guard")
	var direction = desired_direction()
	var speed = 3.4
	if Input.is_action_pressed("sprint") and direction.length() > 0.1 and model.state == "idle" and model.spend(12*delta):
		speed = 5.7
	if model.state == "guard":
		speed = 1.45
	elif model.state == "dodge":
		direction = dodge_vector
		speed = float(model.config.dodge.speed)*(1-model.elapsed/float(model.config.dodge.duration)*0.55)
	elif model.state != "idle":
		speed = 0
	if direction.length() > 0.1 and speed > 0 and model.state != "dodge" and not is_instance_valid(target):
		rotation.y = lerp_angle(rotation.y,atan2(-direction.x,-direction.z),1-exp(-delta*14))
	velocity.x = direction.x*speed
	velocity.z = direction.z*speed
	if total_distance > 5:
		world.learn("move")

func update_enemy(delta: float) -> void:
	velocity.x = 0
	velocity.z = 0
	if model.state in ["dead","talk","transition"] or not ai_enabled or not world.can_play():
		return
	var hero: Fighter = world.hero
	if hero.model.state == "dead" or not Session.flag("evt_contract"):
		return
	var diff = hero.global_position-global_position
	var distance = diff.length()
	if distance > float(definition.notice) or not clear_sight(hero):
		return
	if model.state != "attack":
		face(hero.global_position)
	ai_cooldown -= delta
	if model.state == "idle":
		if distance > (2.35 if kind == "foreman" else 1.7):
			var direction = diff.normalized()
			velocity.x = direction.x*float(definition.speed)
			velocity.z = direction.z*float(definition.speed)
		elif ai_cooldown <= 0:
			var attack_name: String = definition.attacks[sequence % definition.attacks.size()]
			sequence += 1
			try_attack(attack_name)
			ai_cooldown = 0.45

func apply_hits() -> void:
	var query = PhysicsShapeQueryParameters3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = float(model.attack.reach)*0.57
	query.shape = sphere
	query.transform = global_transform.translated_local(Vector3(0,0.9,-float(model.attack.reach)*0.52))
	query.collision_mask = 16 if player else 8
	query.collide_with_areas = true
	query.collide_with_bodies = false
	for result in get_world_3d().direct_space_state.intersect_shape(query,8):
		var other: Fighter = result.collider.get_meta("fighter",null)
		if other == null or other == self or other.player == player or other.model.state == "dead":
			continue
		var to_other = other.global_position-global_position
		to_other.y = 0
		if to_other.length() > float(model.attack.reach) or (-global_basis.z).dot(to_other.normalized()) < float(model.attack.arc) or not clear_sight(other):
			continue
		if model.claim_hit(other.get_instance_id()):
			other.take_damage(float(model.attack.damage),self)

func take_damage(amount: float, attacker: Fighter) -> String:
	var in_front = (-global_basis.z).dot((attacker.global_position-global_position).normalized()) > 0.0
	var armor = not player and kind == "foreman" and model.state == "attack" and attacker.model.attack_id != "heavy"
	var result = model.receive(amount,in_front,armor)
	if result == "parry":
		attacker.model.state = "hit"
		attacker.model.elapsed = -0.65
		Sound.play("parry")
		if player:
			world.learn("parry")
		feedback.emit("Parry! Their guard is open.")
	elif result == "guard":
		Sound.play("guard")
	elif result in ["hit","dead"]:
		Sound.play("hit")
		if player:
			Session.data.health = model.health
	return result
