extends ChapterWorld

@export var zone_id: String = ""
@export var actor_resources: Array[PackedScene] = []
var definition: Dictionary
var spawned: Dictionary = {}
var wheel: Node3D
var ward: StaticBody3D
var echo_clock: float = 0
var echo_ring: MeshInstance3D

func _ready() -> void:
	definition = Session.chapter
	rng.seed = zone_id.hash()
	build_setting()
	build_landmarks()
	SceneryDetails.route(self,definition.theme,definition.length)
	if definition.theme in ["morning","cinders","memorial"]: SceneryDetails.village(self,definition.theme)
	interactables.clear()
	batch_scenery()
	prepare_hero()
	for npc in definition.npcs:
		var root = Node3D.new()
		root.position=vec(npc.position)
		add_child(root)
		var figure = actor_scene(npc.asset).instantiate()
		if npc.asset=="isha": figure.scale=Vector3.ONE*.64
		root.add_child(figure)
		npcs[npc.id]=figure
		label(npc.name,root.position+Vector3.UP*2.15,23)
	for point in definition.objects:
		interactables.append({"id":point.id,"name":point.name,"position":vec(point.position)})
		if point.id.begins_with("obj_"):
			Figure.cylinder(self,.26,.34,.55,vec(point.position)+Vector3.UP*.28,Color("b6a883"),6)
			SceneryDetails.object_prop(self,point.id,vec(point.position))
		elif point.id.begins_with("exit_"):
			for x in [-3,3]: solid_box(Vector3(.3,3,.3),vec(point.position)+Vector3(x,1.5,0),Color("7e7666"))
		label(point.name,vec(point.position)+Vector3.UP*2.1,21)
	var shrine_position=Vector3(-5,0,5)
	add_rest(definition.checkpoints[0].id,shrine_position)
	for checkpoint in definition.checkpoints.slice(1): add_rest(checkpoint.id,vec(checkpoint.position)+Vector3(-5,0,0))
	marker=Node3D.new()
	add_child(marker)
	Figure.cylinder(marker,0,.15,.34,Vector3.ZERO,Color("ead094"),4)
	Session.changed.connect(refresh_objective)
	refresh_objective()
	spawn_available()

func actor_scene(id: String) -> PackedScene:
	for scene in actor_resources:
		if scene.resource_path.get_file().get_basename()==id: return scene
	return load("res://assets/characters/"+id+".tscn")

func vec(p: Array) -> Vector3:
	return Vector3(p[0],p[1],p[2])

func add_rest(id: String, at: Vector3) -> void:
	solid_box(Vector3(.8,.7,.6),at+Vector3.UP*.35,Color("a2a392"))
	Figure.cylinder(self,.25,0,.6,at+Vector3.UP*1.1,Color("d4bd8d"),5)
	label("REST · E",at+Vector3.UP*1.9,20)
	interactables.append({"id":id,"name":"Rest & save","position":at})

func build_setting() -> void:
	var theme: String = definition.theme
	art_theme=theme
	var realm = theme=="ashes"
	var night = theme=="cinders"
	var environment=WorldEnvironment.new()
	var env=ArtDirection.environment(theme)
	environment.environment=env
	add_child(environment)
	sun=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-35,-28,0)
	sun.light_color=Color("a8d3e5") if realm else (Color("c8d7e4") if theme in ["mill","fortress","returned"] else Color("ffe0ae"))
	sun.light_energy=.65 if night else 1.1
	sun.shadow_enabled=Preferences.shadows and not realm
	sun.directional_shadow_max_distance=38
	add_child(sun)
	var length: float=definition.length
	ArtDirection.ground(solid_box(Vector3(36,.5,length+30),Vector3(0,-.25,(-length+14)/2),Color.WHITE),theme)
	for x in [-18,18]: solid_box(Vector3(.5,8,length+30),Vector3(x,3,(-length+14)/2),Color.BLACK,false)
	for z in [15,-length-4]: solid_box(Vector3(36,8,.5),Vector3(0,3,z),Color.BLACK,false)
	if realm:
		for i in 18:
			var at=Vector3((-1 if i%2 else 1)*rng.randf_range(6,15),rng.randf_range(1,6),-i*4)
			var memory=Figure.box(self,Vector3(1.5,.4,2),at,Color("748c9b"))
			memory.rotation_degrees=Vector3(i*7,0,i*11)
	else:
		for i in 23:
			var at=Vector3((1 if i%2 else -1)*rng.randf_range(12,17),0,rng.randf_range(-length,12))
			tree(at,rng.randf_range(.65,1.15))
	for i in (0 if realm else 100):
		var grass=MeshInstance3D.new()
		grass.mesh=SceneryGeometry.grass()
		grass.material_override=SceneryGeometry.leaves_material(theme)
		grass.position=Vector3((1 if i%2 else -1)*rng.randf_range(3.8,16),0,rng.randf_range(-length,12))
		add_child(grass)
	for i in 9:
		rock(Vector3((1 if i%2 else -1)*14,0,-i*9),Vector3(3,2,3))

func build_landmarks() -> void:
	var theme: String=definition.theme
	if theme in ["morning","cinders","memorial"]:
		build_village()
		# The village's static geometry is reused; the people and context belong to this zone.
		if theme=="morning": house(Vector3(8,0,-28),4,3)
		if theme=="cinders":
			for mesh in find_children("*","MeshInstance3D",true,false):
				if mesh.material_override is StandardMaterial3D:
					var m=mesh.material_override.duplicate()
					m.albedo_color=m.albedo_color.darkened(.38)
					mesh.material_override=m
			for x in [-8,-5]: Figure.box(self,Vector3(1.2,.08,1.1),Vector3(x,.07,6),Color("b0aaa0"))
			for i in 6:
				var timber=Figure.box(self,Vector3(.18,2.2,.18),Vector3(-7+i*.5,1,-2),Color("353838"))
				timber.rotation.z=i*.21
		if theme=="memorial":
			for x in [-1,1]:
				solid_box(Vector3(.8,.9,.3),Vector3(x,.45,-16),Color("aeb1a2"))
			label("MIRA   ·   ISHA",Vector3(0,2.1,-16),28)
	elif theme in ["mill","returned"]:
		Figure.box(self,Vector3(9,.06,71),Vector3(-11,.04,-29),Color("506f7b") if theme=="mill" else Color("5d6255"))
		house(Vector3(-10,0,-29),5,8)
		wheel=Node3D.new()
		wheel.set_meta("dynamic_scenery",true)
		wheel.position=Vector3(-6.8,2,-26)
		add_child(wheel)
		for i in 8:
			var spoke=Figure.box(wheel,Vector3(.16,4,.2),Vector3.ZERO,Color("6c5541"))
			spoke.rotation.x=i*PI/4
		Figure.box(self,Vector3(8,.1,3),Vector3(-7,.1,-16),Color("88745a"))
		for z in [-12,-42,-69]:
			for x in [-4.5,4.5]: Figure.box(self,Vector3(.2,1.1,.2),Vector3(x,.55,z),Color("80755f"))
		label("SERE MILL" if theme=="mill" else "THE CHANNEL IS DRY",Vector3(-6,4,-28),25)
	elif theme in ["fortress","dawn"]:
		for x in [-10,10]:
			solid_box(Vector3(3,4,definition.length-4),Vector3(x,2,-definition.length/2+3),Color("6c7779"))
			for z in range(-5,-int(definition.length),-8):
				Figure.box(self,Vector3(3,1,2),Vector3(x,4.5,z),Color("7c8582"))
			Figure.cylinder(self,2.4,2.4,7,Vector3(x,3.5,-definition.length+14),Color("7e8680"),8)
		for z in [-14,-31,-49]: Figure.box(self,Vector3(13,.08,3),Vector3(0,.08,z),Color("9a9d8b"))
		label("THE COPPER STAIR" if theme=="fortress" else "THE LAST BRIDGE",Vector3(0,5,-15),31)
	elif theme=="court":
		Figure.cylinder(self,13,13,.16,Vector3(0,.07,-35),Color("aaa38e"),24)
		for i in 10:
			var a=i*TAU/10
			Figure.cylinder(self,.45,.35,5,Vector3(sin(a)*13,2.5,-35+cos(a)*13),Color("c2b994"),7)
		Figure.box(self,Vector3(3,1.2,1),Vector3(0,.6,-55),Color("61534a"))
		label("THE DAWN COURT",Vector3(0,5,-19),31)
	elif theme=="ashes":
		Figure.cylinder(self,4,3,.4,Vector3(0,.1,-40),Color("8a9eaa"),12)
		Figure.cylinder(self,3,0,.3,Vector3(0,7,-75),Color("d7e1dd"),10)
		label("BETWEEN ASHES",Vector3(0,4,-28),32,Color("bcdde1"))
		echo_ring=MeshInstance3D.new()
		var ring=TorusMesh.new()
		ring.inner_radius=2.7
		ring.outer_radius=2.8
		ring.rings=24
		ring.ring_segments=5
		echo_ring.mesh=ring
		echo_ring.material_override=Figure.material(Color("b7dcdf"))
		echo_ring.position=Vector3(0,.15,-40)
		echo_ring.visible=false
		add_child(echo_ring)
	if definition.has("ward_z"):
		var z: float=definition.ward_z
		for x in [-11.5,11.5]: solid_box(Vector3(13,3,1.2),Vector3(x,1.5,z),Color("73838a"))
		ward=solid_box(Vector3(10,3,.3),Vector3(0,1.5,z),Color("82b4bb"))
		ward.collision_layer=32
		label("{ashstep} / LT · ASHSTEP THROUGH THE VEIL",Vector3(0,3.4,z),22)

func requirements_met(requirements: Array) -> bool:
	for flag in requirements:
		if not Session.flag(flag): return false
	return true

func spawn_available() -> void:
	for enc in definition.encounters:
		if spawned.has(enc.id) or Session.flag(enc.flag) or not requirements_met(enc.requires): continue
		spawned[enc.id]=true
		for entry in enc.enemies:
			var enemy=Fighter.new()
			enemy.kind=entry.kind
			enemy.enemy_id=entry.id
			enemy.encounter_id=enc.id
			enemy.world=self
			enemy.position=vec(entry.position)
			add_child(enemy)
			enemy.rotation.y=PI
			enemy.slain.connect(_enemy_died)
			enemies.append(enemy)
			if enemy.definition.get("boss",false): label(enemy.definition.name,enemy.position+Vector3.UP*3,27)

func _process(delta: float) -> void:
	if is_queued_for_deletion() or (hero!=null and hero.world!=self): return
	if not Session.running or hero==null or marker==null: return
	Sound.context(Session.data.zone,not coordinator.active.is_empty(),ui.mode in ["menu","loading","cinematic"] or definition.theme=="cinders" or (definition.theme=="memorial" and ui.mode=="dialogue"))
	elapsed+=delta
	marker.position.y=2.8+sin(elapsed*2)*.18
	marker.rotation.y+=delta
	if wheel!=null and definition.theme=="mill": wheel.rotation.x+=delta*.2
	for id in npcs: npcs[id].animate(delta,npc_model,0,Vector3.ZERO,ui.mode=="dialogue")
	if not can_play(): return
	if definition.theme=="ashes" and Session.flag("evt_trial_warden_clear") and not Session.flag("evt_ashstep_evade"):
		# A nonlethal remnant keeps the mandatory defensive lesson available if the boss fell first.
		if echo_clock==0: ui.toast("The Warden's remnant offers another blow. Ashstep as its ring closes.",6)
		if hero.model.resolve<1 and echo_clock<.1 and hero.position.distance_to(Vector3(0,0,-40))<4:
			hero.model.resolve=1
			ui.toast("The remnant lends one practice charge. Step as the ring closes.",4)
		echo_clock+=delta
		echo_ring.visible=true
		echo_ring.scale=Vector3.ONE*maxf(.2,1-echo_clock/2.2)
		if echo_clock>=2.2:
			echo_clock=.001
			if hero.position.distance_to(Vector3(0,0,-40))<4:
				var result=hero.model.receive(minf(8,maxf(0,hero.model.health-1)),true,false,{"blockable":false,"parryable":false})
				if result=="ash_evade": on_ash_evade()
	elif echo_ring!=null: echo_ring.visible=false
	spawn_available()
	ui.update_hud(hero,nearest_interaction())
	if definition.has("ward_z") and hero.position.z<definition.ward_z-1.0 and not Session.flag(definition.ward_flag):
		Session.mark(definition.ward_flag)
		ui.toast("The veil parts for your ashstep.")
	var objective=Session.objective()
	var target=vec(objective.target)
	if not definition.next.is_empty() and hero.position.distance_to(target)<14 and objective.id in [definition.quests[-1].id]:
		ui.main.transitions.prefetch(definition.next)
	for enemy in enemies.duplicate():
		if is_instance_valid(enemy) and enemy.model.state=="dead" and enemy.model.elapsed>3.5:
			enemies.erase(enemy)
			enemy.queue_free()

func interact() -> void:
	if not can_play() or not hero.model.can_begin(): return
	var point=nearest_interaction()
	if point.is_empty(): return
	if danger(): ui.toast("Clear the nearby threat before stopping."); return
	if point.id.begins_with("cp_"):
		Session.checkpoint(point.id)
		hero.model.health=hero.model.max_health
		hero.model.resolve=3
		ui.toast("Checkpoint saved · health, draughts and Resolve restored")
		Sound.play("heal")
		return
	for object in definition.objects:
		if object.id!=point.id: continue
		if not requirements_met(object.requires): ui.toast("Finish your current objective first."); return
		if not object.flag.is_empty() and Session.flag(object.flag):
			ui.toast("Already recorded in your journal.")
			if object.effect=="ending": ui.show_credits()
			return
		if object.effect=="deep_flask" and Session.data.currency<20: ui.toast("The repair kit costs 20 crowns."); return
		begin_story(object)
		return

func begin_story(object: Dictionary) -> void:
	if not hero.model.freeze("talk"): return
	hero.clear_intent()
	hero.velocity=Vector3.ZERO
	var old_yaw=hero.yaw.rotation.y
	var old_pitch=hero.pitch.rotation.x
	hero.face(vec(object.position))
	hero.yaw.rotation.y=hero.rotation.y+.4
	hero.pitch.rotation.x=-.22
	hero.camera_focus=(vec(object.position)-hero.position)*.35
	ui.show_dialogue(object.dialogue,object.id,func(accepted: bool):
		hero.model.state="idle"
		hero.model.elapsed=0
		hero.yaw.rotation.y=old_yaw
		hero.pitch.rotation.x=old_pitch
		hero.camera_focus=Vector3.ZERO
		if accepted: commit_story(object),object.choice)

func commit_story(object: Dictionary) -> void:
	if not object.flag.is_empty() and Session.flag(object.flag): return
	match object.effect:
		"lend_ashstep":
			if "ashstep" not in Session.data.unlocks: Session.data.unlocks.append("ashstep")
			hero.model.ash_unlocked=true
			ui.toast("Ashstep lent · {ashstep} / left trigger. Evade a Warden blow, then heavy-counter.",8)
		"tempered_edge":
			if "tempered_edge" not in Session.data.unlocks: Session.data.unlocks.append("tempered_edge")
			ui.toast("Tempered edge learned · Heavy attacks break patient guards.",7)
		"deep_flask":
			if not Session.purchase("purchase_deep_flask",20): return
			Session.data.max_heals=4
			Session.data.heals=4
		"ending":
			Session.data.ending=true
			Session.data.flags["campaign_complete"]=true
			Session.complete_chapter(Session.data.chapter)
			Session.save()
			ui.show_credits()
			return
	if not object.flag.is_empty(): Session.data.flags[object.flag]=true
	Session.save()
	Session.changed.emit()
	if object.effect=="story_death": ui.main.begin_story_death(); return
	if not object.transition.is_empty(): ui.main.travel(object.transition,object.effect)

func _enemy_died(enemy: Fighter) -> void:
	for enc in definition.encounters:
		if enc.id!=enemy.encounter_id or Session.flag(enc.flag): continue
		for other in enemies:
			if is_instance_valid(other) and other.encounter_id==enc.id and other.model.state!="dead": return
		if not enc.boss.is_empty() and enc.boss not in Session.data.bosses: Session.data.bosses.append(enc.boss)
		var reward_id="reward_"+enc.id
		if reward_id not in Session.data.rewards:
			Session.data.rewards.append(reward_id)
			Session.data.currency+=enc.reward
		Session.data.flags[enc.flag]=true
		Session.save()
		Session.changed.emit()
		hero.model.resolve=minf(3,hero.model.resolve+.75)
		ui.toast(("Confrontation won" if not enc.boss.is_empty() else "The route is clear")+(" · +%d crowns" % enc.reward if enc.reward else ""))
		Sound.play("reward")
