class_name CombatEffects
extends Node3D

const CAPACITY = 48
var actor: Fighter
var trail: MeshInstance3D
var ribbon := ImmediateMesh.new()
var sparks: MultiMeshInstance3D
var particles: Array[Dictionary] = []
var samples: Array[Dictionary] = []
var age := 0.0
var emitted := 0
var last_footfall := -1.0
var random := RandomNumberGenerator.new()
var last_swing := -1

func _ready() -> void:
	actor = get_parent()
	top_level = true
	global_transform = Transform3D.IDENTITY
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	random.seed = 1471
	trail = MeshInstance3D.new()
	trail.mesh = ribbon
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	material.vertex_color_use_as_albedo = true
	trail.material_override = material
	trail.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(trail)
	sparks = MultiMeshInstance3D.new()
	var spark := PrismMesh.new()
	spark.size = Vector3(.016, .021, .016)
	sparks.multimesh = MultiMesh.new()
	sparks.multimesh.transform_format = MultiMesh.TRANSFORM_3D
	sparks.multimesh.use_colors = true
	sparks.multimesh.mesh = spark
	sparks.multimesh.instance_count = CAPACITY
	sparks.multimesh.visible_instance_count = 0
	sparks.material_override = material
	sparks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(sparks)

func speck(at: Vector3, velocity: Vector3, life: float, color: Color, grit: bool = false) -> void:
	particles.append({"position": at, "velocity": velocity, "born": age, "life": life, "color": color, "grit": grit})
	emitted += 1

func impact(at: Vector3, direction: Vector3, kind: String) -> void:
	if Preferences.reduced_effects: return
	var deflected := kind == "guard" or kind == "parry"
	var count := 18 if kind == "parry" else (12 if deflected else 7)
	var cold := Color("c0e6eb")
	var gold := Color("ffd190")
	var iron := Color("c0aaa1")
	var color := cold if kind == "parry" else (gold if deflected else iron)
	for i in mini(count, CAPACITY - particles.size()):
		var spread := Vector3(random.randf_range(-.7, .7), random.randf_range(.12, 1.1), random.randf_range(-.7, .7))
		var speed := random.randf_range(2.2, 4.8) if deflected else random.randf_range(1.3, 3.1)
		var launch := (direction * .85 + spread).normalized() * speed
		var hot := color.lerp(Color.WHITE, random.randf_range(0, .57))
		speck(at, launch, random.randf_range(.16, .38), hot)

func footfall(foot: Vector3, movement: Vector3, speed: float) -> void:
	if Preferences.reduced_effects or speed < 3.4 or age - last_footfall < .12: return
	# Grit stays on the stone and leaves room in the pool for blade contacts.
	if particles.size() > CAPACITY - 20: return
	last_footfall = age
	var back := -Vector3(movement.x, 0, movement.z).normalized()
	for i in 3:
		var drift := back * random.randf_range(.3, .78)
		drift += Vector3(random.randf_range(-.29, .29), random.randf_range(.35, .81), random.randf_range(-.29, .29))
		speck(foot, drift, random.randf_range(.13, .23), Color("9d9585"), true)

func capture_blade(figure: PerformanceFigure, duration: float) -> void:
	if actor.model.active():
		var rig := figure.body_skeleton
		var hand := rig.global_transform * rig.get_bone_global_pose(figure.hand_index) * figure.weapon.transform
		var transform := actor.get_global_transform_interpolated() * actor.global_transform.affine_inverse() * hand
		var tip := transform * Vector3(0, -1, 0)
		var base := transform * Vector3(0, -.32, 0)
		if last_swing != actor.model.swing_serial or (not samples.is_empty() and tip.distance_to(samples[-1].tip) > 1.5):
			samples.clear()
		last_swing = actor.model.swing_serial
		if samples.is_empty() or tip.distance_to(samples[-1].tip) > .015:
			samples.append({"tip": tip, "base": base, "born": age})
	while not samples.is_empty() and (age - float(samples[0].born) > duration or samples.size() > 12):
		samples.pop_front()

func _process(delta: float) -> void:
	age += delta
	if not is_instance_valid(actor.figure): return
	var figure := actor.figure as PerformanceFigure
	var heavy: bool = actor.model.attack.get("pose", "") == "heavy"
	var duration := .105 if heavy else .077
	if Preferences.reduced_effects:
		samples.clear()
		particles.clear()
	else:
		capture_blade(figure, duration)
	if ribbon.get_surface_count() > 0: ribbon.clear_surfaces()
	if samples.size() > 1:
		var edge := Color("ffe2a9") if heavy else Color("e8f3f4")
		ribbon.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
		for sample in samples:
			var opacity := clampf(1.0 - (age - float(sample.born)) / duration, 0, 1)
			var base_ink := edge
			base_ink.a = opacity * opacity * .035
			ribbon.surface_set_color(base_ink)
			ribbon.surface_add_vertex(sample.base)
			edge.a = opacity * (.40 if heavy else .30)
			ribbon.surface_set_color(edge)
			ribbon.surface_add_vertex(sample.tip)
		ribbon.surface_end()
	for index in range(particles.size() - 1, -1, -1):
		var p := particles[index]
		if age - float(p.born) >= float(p.life):
			particles.remove_at(index)
			continue
		p.velocity.y -= delta * (6.0 if p.grit else 8.5)
		p.position += p.velocity * delta
	for index in particles.size():
		var p := particles[index]
		var life := (age - float(p.born)) / float(p.life)
		var velocity: Vector3 = p.velocity
		var basis := Basis(Quaternion(Vector3.UP, velocity.normalized())) if velocity.length_squared() > .0001 else Basis.IDENTITY
		var size := Vector3(1.15, 1.4, 1.15) if p.grit else Vector3(.72, 1.1 + velocity.length() * 1.24, .72)
		var transform := Transform3D(basis * Basis.from_scale(size * (1.0 - life * .55)), p.position)
		sparks.multimesh.set_instance_transform(index, transform)
		var color: Color = p.color
		color.a = (1.0 - life * life) * (.60 if p.grit else 1.0)
		sparks.multimesh.set_instance_color(index, color)
	sparks.multimesh.visible_instance_count = particles.size()
