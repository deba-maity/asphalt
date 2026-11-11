class_name ChapterWorld
extends Node3D

var hero: Fighter
var enemies: Array[Fighter] = []
var npcs: Dictionary = {}
var interactables: Array[Dictionary] = []
var ui: CanvasLayer
var sun: DirectionalLight3D
var marker: Node3D
var zone_label: String = ""
var checkpoint_hint: bool = false
var elapsed: float = 0
var npc_model: CombatModel = CombatModel.new()
var rng = RandomNumberGenerator.new()
var coordinator: EncounterCoordinator

func _ready() -> void:
	rng.seed = 85171
	build_environment()
	build_village()
	build_road()
	batch_scenery()
	spawn_actors()
	marker = Node3D.new()
	add_child(marker)
	var diamond = Figure.cylinder(marker,0,0.15,0.34,Vector3.ZERO,Color("ead094"),4)
	diamond.rotation.z = PI
	Session.changed.connect(refresh_objective)
	refresh_objective()

func can_play() -> bool:
	return ui != null and ui.mode == "play" and hero != null and hero.model.state != "dead"

func prepare_hero() -> void:
	if is_instance_valid(ui.main.player):
		hero = ui.main.player
		hero.reparent(self)
		hero.model = CombatModel.new()
		hero.collision_layer = 2
		hero.hurtbox.collision_layer = 8
		hero.last_state = "idle"
	else:
		hero = Fighter.new()
		hero.player = true
		hero.world = self
		add_child(hero)
		hero.feedback.connect(ui.toast)
		ui.main.player = hero
	hero.visible = true
	hero.set_physics_process(true)
	hero.world = self
	hero.position = Session.checkpoint_position()
	hero.velocity = Vector3.ZERO
	hero.camera_focus = Vector3.ZERO
	hero.yaw.rotation.y = 0
	hero.pitch.rotation.x = -0.31
	hero.pitch.spring_length = 5.6
	hero.model.max_health = Session.data.max_health
	hero.model.health = maxf(1,Session.data.health)
	hero.model.resolve = Session.data.resolve
	hero.model.ash_unlocked = "ashstep" in Session.data.unlocks
	hero.slain.connect(_hero_died)
	coordinator = EncounterCoordinator.new()
	coordinator.world = self
	add_child(coordinator)

func solid_box(size: Vector3, at: Vector3, color: Color, visible_mesh: bool = true) -> StaticBody3D:
	var body = StaticBody3D.new()
	body.position = at
	body.collision_layer = 1
	body.collision_mask = 0
	var shape = BoxShape3D.new()
	shape.size = size
	var collider = CollisionShape3D.new()
	collider.shape = shape
	body.add_child(collider)
	if visible_mesh:
		Figure.box(body,size,Vector3.ZERO,color)
	add_child(body)
	return body

func batch_scenery() -> void:
	var batches: Dictionary = {}
	for node in find_children("*","MeshInstance3D",true,false):
		if node.mesh == null or node.material_override == null:
			continue
		var key = str(node.mesh.get_instance_id())+"_"+str(node.material_override.get_instance_id())
		if not batches.has(key): batches[key] = []
		batches[key].append(node)
	for key in batches:
		var entries: Array = batches[key]
		if entries.size()<2: continue
		var multi = MultiMesh.new()
		multi.transform_format = MultiMesh.TRANSFORM_3D
		multi.mesh = entries[0].mesh
		multi.instance_count = entries.size()
		for i in entries.size():
			multi.set_instance_transform(i,entries[i].global_transform)
		var instance = MultiMeshInstance3D.new()
		instance.multimesh = multi
		instance.material_override = entries[0].material_override
		add_child(instance)
		for entry in entries:
			entry.queue_free()

func label(text: String, at: Vector3, size: int = 30, color: Color = Color("efe0bc")) -> Label3D:
	var l = Label3D.new()
	l.text = text
	l.position = at
	l.font_size = size
	l.pixel_size = 0.007
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.modulate = color
	l.outline_size = 5
	l.visibility_range_end = 18
	add_child(l)
	return l

func build_environment() -> void:
	var environment = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("7d949a")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("a4b3bd")
	env.ambient_light_energy = 0.28
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.fog_enabled = true
	env.fog_light_color = Color("a1a18b")
	env.fog_density = 0.008
	environment.environment = env
	add_child(environment)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-37,-32,0)
	sun.light_color = Color("ffe1b2")
	sun.light_energy = 0.8
	sun.shadow_enabled = Preferences.shadows
	sun.directional_shadow_max_distance = 45
	add_child(sun)
	solid_box(Vector3(38,0.5,108),Vector3(0,-0.25,-28),Color("646c4c"))
	for x in [-18.5,18.5]:
		solid_box(Vector3(1,8,110),Vector3(x,3,-28),Color.BLACK,false)
	for z in [25,-81]:
		solid_box(Vector3(38,8,1),Vector3(0,3,z),Color.BLACK,false)
	for i in 27:
		var z = 21-i*3.8
		Figure.box(self,Vector3(7+rng.randf_range(-0.3,0.3),0.045,3.9),Vector3(0,0.008,z),Color("a19370").darkened(rng.randf_range(0,0.07)))
	for i in 75:
		var x = rng.randf_range(6,18)*(1 if i%2 == 0 else -1)
		var z = rng.randf_range(-79,23)
		if z > -13 and absf(x) < 13:
			continue
		tree(Vector3(x,0,z),rng.randf_range(0.8,1.6))
	for i in 30:
		var x = rng.randf_range(9,19)*(1 if i%2 == 0 else -1)
		rock(Vector3(x,0,rng.randf_range(-80,22)),Vector3(rng.randf_range(1,3),rng.randf_range(1,3),rng.randf_range(1,3)))
	for i in 130:
		var x = rng.randf_range(4.2,13)*(1 if i%2 == 0 else -1)
		var z = rng.randf_range(-78,-15)
		for stem in 3:
			var grass = Figure.cylinder(self,0.085,0,0.5,Vector3(x+stem*0.12,0.22,z),Color("7a8054"),3)
			grass.rotation.z = (stem-1)*0.3
	for i in 13:
		var mountain = Figure.cylinder(self,15,0,24+rng.randf()*15,Vector3(-75+i*12,7,-108-rng.randf()*15),Color("657579"),5)
		mountain.rotation.y = rng.randf()*PI

func tree(at: Vector3, factor: float) -> void:
	var root = Node3D.new()
	root.position = at
	root.scale = Vector3.ONE*factor
	add_child(root)
	Figure.cylinder(root,0.22,0.12,3.6,Vector3(0,1.8,0),Color("625342"))
	for i in 3:
		Figure.cylinder(root,1.6-i*0.32,0,2.7,Vector3(0,3.4+i*1.15,0),Color("344d46").lightened(i*0.035),6)
	var body = StaticBody3D.new()
	body.position = at+Vector3(0,1.5,0)
	var shape = CollisionShape3D.new()
	var cylinder = CylinderShape3D.new()
	cylinder.radius = 0.24*factor
	cylinder.height = 3
	shape.shape = cylinder
	body.add_child(shape)
	add_child(body)

func rock(at: Vector3, dimensions: Vector3) -> void:
	var rock_mesh = MeshInstance3D.new()
	var mesh = SphereMesh.new()
	mesh.radial_segments = 5
	mesh.rings = 2
	mesh.height = 1
	mesh.radius = 0.5
	rock_mesh.mesh = mesh
	rock_mesh.material_override = Figure.material(Color("777c72"))
	rock_mesh.position = at
	rock_mesh.scale = dimensions
	rock_mesh.rotation.y = rng.randf()*PI
	add_child(rock_mesh)

func roof(at: Vector3, width: float, depth: float) -> void:
	var st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var a=Vector3(-width/2,0,-depth/2)
	var b=Vector3(width/2,0,-depth/2)
	var c=Vector3(0,1.65,-depth/2)
	var d=Vector3(-width/2,0,depth/2)
	var e=Vector3(width/2,0,depth/2)
	var f=Vector3(0,1.65,depth/2)
	for vertex in [a,b,c,e,d,f,a,c,f,a,f,d,c,b,e,c,e,f]:
		st.add_vertex(vertex)
	st.generate_normals()
	var mesh = MeshInstance3D.new()
	mesh.mesh = st.commit()
	var m = Figure.material(Color("795b4c"))
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh.material_override = m
	mesh.position = at
	add_child(mesh)

func house(at: Vector3, width: float, depth: float, home: bool = false) -> void:
	solid_box(Vector3(width,2.8,depth),at+Vector3(0,1.4,0),Color("c0ad87") if home else Color("a59a7c"))
	roof(at+Vector3(0,2.8,0),width+0.6,depth+0.6)
	for x in [-width/2+0.15,width/2-0.15]:
		Figure.box(self,Vector3(0.13,2.9,0.15),at+Vector3(x,1.45,depth/2+0.03),Color("5a4d3f"))
	Figure.box(self,Vector3(width,0.12,0.15),at+Vector3(0,2.3,depth/2+0.04),Color("5a4d3f"))
	Figure.box(self,Vector3(0.9,1.95,0.10),at+Vector3(0,0.98,depth/2+0.06),Color("605545"))
	for x in [-width*0.30,width*0.30]:
		Figure.box(self,Vector3(0.65,0.75,0.14),at+Vector3(x,1.65,depth/2+0.06),Color("e7bd77"))
		Figure.box(self,Vector3(0.05,0.77,0.18),at+Vector3(x,1.65,depth/2+0.1),Color("554f43"))
		Figure.box(self,Vector3(0.67,0.06,0.18),at+Vector3(x,1.65,depth/2+0.1),Color("554f43"))
	Figure.cylinder(self,0.28,0.22,2,at+Vector3(width*0.27,3.5,-0.5),Color("6d7067"),6)
	if home:
		label("RAYAN'S HOME",at+Vector3(0,3.4,depth/2),24)
		var light = OmniLight3D.new()
		light.position = at+Vector3(0,2,depth/2+1)
		light.light_color = Color("ffc67a")
		light.light_energy = 0.7
		light.omni_range = 7
		add_child(light)

func build_village() -> void:
	house(Vector3(-8,0,3),6.5,4,true)
	house(Vector3(9,0,9),5,5)
	house(Vector3(-11,0,-5),5,4)
	house(Vector3(10,0,-5),5,4)
	label("H E A R T H M E R E",Vector3(0,5,-12),40)
	for side in [-1,1]:
		solid_box(Vector3(0.5,3.4,0.5),Vector3(side*4.4,1.7,-12),Color("6c5b45"))
		Figure.box(self,Vector3(1.2,2,0.05),Vector3(side*4.4,2,-11.7),Color("8a644e"))
	Figure.box(self,Vector3(9.7,0.45,0.5),Vector3(0,3.5,-12),Color("6c5b45"))
	for i in 12:
		var x = -15+i*2.6
		if absf(x)<5:
			continue
		solid_box(Vector3(0.12,1.2,0.16),Vector3(x,0.6,-12),Color("81735a"))
		Figure.box(self,Vector3(2.6,0.12,0.1),Vector3(x+1.3,0.8,-12),Color("81735a"))
	Figure.box(self,Vector3(2.4,0.15,1.3),Vector3(-6,0.88,-2.3),Color("7d6446"))
	for i in 7:
		Figure.cylinder(self,0.16,0.12,0.17,Vector3(-6.8+i*0.27,1.04,-2.3),Color("c09a58"),8)
	label("TOVA'S OVEN  ·  HONEYBREAD",Vector3(-6,2.8,-2.6),22)
	Figure.cylinder(self,0.9,0.9,0.8,Vector3(7,0.4,-1),Color("858b7c"),10)
	Figure.cylinder(self,0.65,0.65,0.83,Vector3(7,0.4,-1),Color("3c4e52"),10)
	interactables.append({"id":"obj_well","name":"Village well","position":Vector3(7,0,-1)})
	for i in 4:
		Figure.cylinder(self,0.24,0.34,0.7,Vector3(7+i*0.45,0.35,3.3),Color("9c7055"),8)
	for x in [-5.5,-9]:
		Figure.box(self,Vector3(1.8,0.12,0.4),Vector3(x,0.4,7),Color("806a4e"))

func build_road() -> void:
	for z in [-20,-36,-52,-69]:
		var side = -1 if int(z)%3 == 0 else 1
		Figure.cylinder(self,0.12,0.10,2.2,Vector3(side*4,1.1,z),Color("786649"))
		Figure.box(self,Vector3(1.7,0.45,0.12),Vector3(side*4,1.9,z),Color("7a674e"))
	label("ALDER ROAD   /   OLD KILN ↑",Vector3(4,2.25,-20),23)
	var cart = Node3D.new()
	cart.position = Vector3(-4,0,-25)
	cart.rotation.z = -0.18
	add_child(cart)
	Figure.box(cart,Vector3(1.7,0.2,2.5),Vector3(0,0.7,0),Color("6a5740"))
	for side in [-1,1]:
		Figure.box(cart,Vector3(0.1,0.7,2.5),Vector3(side*0.8,1.1,0),Color("806b4b"))
		var wheel = Figure.cylinder(cart,0.55,0.55,0.12,Vector3(side,0.5,0.45),Color("4b4539"),10)
		wheel.rotation.z = PI/2
	for i in 3:
		Figure.cylinder(cart,0.25,0.32,0.5,Vector3(-0.5+i*0.5,1.1,0),Color("b6a17b"),6)
	interactables.append({"id":"obj_cart","name":"Abandoned wagon","position":Vector3(-4,0,-25)})
	solid_box(Vector3(1.2,1.6,0.7),Vector3(-4.5,0.8,-34),Color("8a8c7e"))
	Figure.cylinder(self,0.3,0,0.8,Vector3(-4.5,2,-34),Color("b6b399"),5)
	Figure.box(self,Vector3(0.8,0.06,0.6),Vector3(-4.5,0.35,-33.2),Color("c3ad74"))
	label("WAYFARER'S REST\nE · Rest & save",Vector3(-4.5,2.9,-34),24)
	interactables.append({"id":"cp_road_shrine","name":"Rest at the shrine","position":Vector3(-4.5,0,-33)})
	for i in 6:
		var log = Figure.cylinder(self,0.22,0.22,3,Vector3(-6,0.25+i*0.3,-47),Color("6c5944"),7)
		log.rotation.x = PI/2
	solid_box(Vector3(5,1.8,2),Vector3(6,0.9,-67),Color("72776d"))
	Figure.cylinder(self,1.8,1.4,4,Vector3(6,2,-69),Color("686b64"),8)
	label("THE OLD KILN",Vector3(0,4,-69),32)
	for i in 4:
		Figure.box(self,Vector3(0.75,0.75,0.75),Vector3(-5+i*0.8,0.38,-65),Color("7e6c4e"))
	var fire = Figure.cylinder(self,0.4,0,0.6,Vector3(3,0.3,-61),Color("d5a263"),5)
	fire.rotation.y = 0.7
	Figure.cylinder(self,0.65,0.65,0.12,Vector3(3,0.06,-61),Color("444c47"),8)

func spawn_actors() -> void:
	prepare_hero()
	for npc in Session.chapter.npcs:
		var root = Node3D.new()
		root.position = Vector3(npc.position[0],0,npc.position[2])
		root.rotation.y = -0.5 if root.position.x < 0 else 0.5
		var figure = load("res://assets/characters/"+npc.id.trim_prefix("npc_")+".tscn").instantiate()
		figure.scale = Vector3.ONE*float(npc.get("scale",1.0))
		root.add_child(figure)
		add_child(root)
		npcs[npc.id] = figure
		label(npc.name,root.position+Vector3(0,2.3*float(npc.get("scale",1.0)),0),23)
		interactables.append({"id":npc.id,"name":npc.name,"position":root.position})
	for encounter in Session.chapter.encounters:
		if Session.flag(encounter.flag):
			continue
		for entry in encounter.enemies:
			var enemy = Fighter.new()
			enemy.kind = entry.kind
			enemy.enemy_id = entry.id
			enemy.encounter_id = encounter.id
			enemy.actor_color = Color(hero.model.config.enemies[entry.kind].color)
			enemy.world = self
			enemy.position = Vector3(entry.position[0],0,entry.position[2])
			add_child(enemy)
			enemy.rotation.y = PI
			enemy.slain.connect(_enemy_died)
			enemies.append(enemy)

func refresh_objective() -> void:
	if marker == null:
		return
	var p = Session.objective().target
	marker.position = Vector3(p[0],2.9,p[2])

func _process(delta: float) -> void:
	if is_queued_for_deletion() or (hero!=null and hero.world!=self): return
	elapsed += delta
	if hero == null or ui == null:
		return
	if not Session.running: return
	marker.position.y = 2.8+sin(elapsed*2)*0.18
	marker.rotation.y += delta
	for id in npcs:
		npcs[id].animate(delta,npc_model,0,ui.mode == "dialogue" and id == ui.speaker_id)
	var zone = "zone_alder_road" if hero.position.z < -14 else "zone_hearthmere"
	if zone != zone_label:
		zone_label = zone
		Session.data.zone = zone
		if can_play():
			ui.announce("THE ALDER ROAD" if zone == "zone_alder_road" else "HEARTHMERE")
	if can_play():
		for enemy in enemies.duplicate():
			if is_instance_valid(enemy) and enemy.model.state=="dead" and enemy.model.elapsed>4:
				enemies.erase(enemy)
				enemy.queue_free()
		ui.update_hud(hero,nearest_interaction())
		if hero.position.z < -30 and not Session.flag("learn_checkpoint"):
			ui.toast("The roadside shrine restores health and draughts. E to rest and save.")
			learn("checkpoint")
		if hero.position.z < -55 and not Session.flag("learn_foreman"):
			ui.toast("Foreman: two broad sweeps, then a slow overhead blow. Dodge, then punish the recovery.",7)
			learn("foreman")

func learn(id: String) -> void:
	var key = "learn_"+id
	if not Session.flag(key):
		Session.data.flags[key] = true
		ui.refresh_tutorial()

func nearest_interaction() -> Dictionary:
	var result: Dictionary = {}
	var distance = 2.8
	for point in interactables:
		var d = hero.global_position.distance_to(point.position)
		if d < distance:
			distance = d
			result = point
	return result

func danger() -> bool:
	for enemy in enemies:
		if is_instance_valid(enemy) and enemy.model.state != "dead" and hero.position.distance_to(enemy.position) < 10:
			return true
	return false

func interact() -> void:
	if not can_play() or not hero.model.can_begin():
		return
	var point = nearest_interaction()
	if point.is_empty():
		return
	if danger():
		ui.toast("The road must be quiet before you can stop.")
		return
	learn("interact")
	var id: String = point.id
	if id == "npc_mira":
		if Session.flag("ch01_complete"):
			ui.show_ending()
		elif not Session.flag("evt_family_morning"):
			talk("morning",id,func(): Session.mark("evt_family_morning"))
		elif Session.flag("purchase_honeybread") and not Session.flag("ch01_complete"):
			talk("supper",id,finish_chapter)
		else:
			talk("mira_repeat",id)
	elif id == "npc_saren":
		if not Session.flag("evt_family_morning"):
			ui.toast("Say goodbye to Mira before taking the road.")
		elif not Session.flag("evt_contract"):
			talk("contract",id,func(): Session.mark("evt_contract"),true)
		elif Session.flag("evt_foreman_clear") and not Session.flag("evt_paid"):
			talk("payment",id,func():
				Session.reward(Session.chapter.reward.id,Session.chapter.reward.crowns)
				Session.mark("evt_paid")
				ui.toast("+30 crowns · A day's work, a warm table.")
				Sound.play("reward"))
		else:
			talk("saren_repeat",id)
	elif id == "npc_tova":
		if Session.flag("evt_paid") and not Session.flag("purchase_honeybread"):
			talk("bread",id,func():
				if Session.purchase("purchase_honeybread",8):
					ui.toast("Honeybread purchased · 8 crowns")
					Sound.play("reward"),true)
		else:
			talk("tova_repeat",id)
	elif id == "npc_isha":
		talk("isha",id)
	elif id == "npc_oren":
		talk("oren",id)
	elif id == "cp_road_shrine":
		Session.checkpoint(id)
		hero.model.health = hero.model.max_health
		Sound.play("heal")
		talk("shrine",id)
	elif id == "obj_well":
		talk("well",id)
	elif id == "obj_cart":
		talk("cart",id)

func talk(key: String, id: String, completion: Callable = Callable(), choice: bool = false) -> void:
	if not hero.model.freeze("talk"):
		return
	hero.velocity = Vector3.ZERO
	var saved_yaw = hero.yaw.rotation.y
	var saved_pitch = hero.pitch.rotation.x
	for point in interactables:
		if point.id == id:
			hero.face(point.position)
			hero.yaw.rotation.y = hero.rotation.y
			hero.camera_focus = (point.position-hero.position)*0.4
			if id == "npc_mira": hero.yaw.rotation.y = 1.1
			hero.pitch.rotation.x = -0.18
			hero.pitch.spring_length = 4.6
			break
	ui.show_dialogue(Session.chapter.dialogue[key],id,func(accepted: bool):
		hero.model.state = "idle"
		hero.model.elapsed = 0
		hero.pitch.spring_length = 5.6
		hero.camera_focus = Vector3.ZERO
		hero.yaw.rotation.y = saved_yaw
		hero.pitch.rotation.x = saved_pitch
		if accepted and completion.is_valid():
			completion.call(),choice)

func finish_chapter() -> void:
	Session.data.checkpoint = "cp_home"
	Session.data.zone = "zone_hearthmere"
	Session.data.health = hero.model.health
	Session.data.flags["evt_family_supper"] = true
	Session.complete_chapter("ch01_bread_steel")
	Session.mark("ch01_complete")
	ui.show_ending()

func _enemy_died(enemy: Fighter) -> void:
	for encounter in Session.chapter.encounters:
		if encounter.id != enemy.encounter_id:
			continue
		for other in enemies:
			if other.encounter_id == encounter.id and other.model.state != "dead":
				return
		Session.mark(encounter.flag)
		ui.toast("The foreman's levy is ended. Return to Saren." if encounter.id == "enc_foreman" else "The road is clear here. Keep north.",5)
		Sound.play("reward")

func _hero_died(_fighter: Fighter) -> void:
	hero.velocity = Vector3.ZERO
	ui.show_death()

func save_current() -> void:
	if hero.model.state=="dead":
		Session.data.health=Session.data.max_health
		Session.data.heals=Session.data.max_heals
		Session.data.resolve=3.0
	else:
		Session.data.health = maxf(1,hero.model.health)
		Session.data.resolve = hero.model.resolve
	Session.save()

func spawn_projectile(owner_actor: Fighter) -> void:
	if get_tree().get_nodes_in_group("projectiles").size() >= 6: return
	var bolt = LedgerProjectile.new()
	bolt.source = owner_actor
	bolt.world = self
	bolt.position = owner_actor.position+Vector3(0,1.0,0)
	bolt.direction = (hero.position+Vector3.UP-bolt.position).normalized()
	bolt.damage = owner_actor.model.attack.damage
	add_child(bolt)

func on_ash_evade() -> void:
	if not Session.flag("evt_ashstep_evade"): Session.mark("evt_ashstep_evade")
	ui.toast("Perfect Ashstep · Heavy attack now becomes an opening counter.")
