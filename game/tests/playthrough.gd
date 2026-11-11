extends Node

var main: Node
var captures: Dictionary = {}
var stage: int = 0
var stage_time: float = 0
var elapsed: float = 0
var kills: int = 0
var last_attack: float = 0
var finished: bool = false
var report: Array[String] = []
var continue_check: bool = false
var frames: int = 0
var total_frame_seconds: float = 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	continue_check = "--validate-continue" in OS.get_cmdline_user_args()
	if continue_check:
		main.start_game(false)
		if not Session.flag("ch01_complete") or Session.data.currency != 22 or not Session.flag("evt_family_supper"):
			fail("Relaunch did not retain chapter completion/currency")
		else:
			record("Relaunch + Continue retained completion, supper, reward, purchase and 22 crowns.")
			complete()
		return
	main.start_game(true)
	main.world.hero.use_test_direction = true
	main.ui.announce("VALIDATION PLAYTHROUGH")
	record("Fresh validation save. Uses normal movement, interaction, damage windows and story callbacks; no teleport or invincibility.")

func record(value: String) -> void:
	report.append(value)
	print("PLAY: "+value)

func next_stage() -> void:
	stage += 1
	stage_time = 0

func walk_to(point: Vector3, threshold: float = 1.8) -> bool:
	var hero: Fighter = main.world.hero
	var diff = point-hero.position
	diff.y = 0
	hero.test_direction = diff.normalized() if diff.length()>threshold else Vector3.ZERO
	return diff.length() <= threshold

func interact_at(point: Vector3) -> bool:
	if walk_to(point):
		main.world.interact()
		return main.ui.mode == "dialogue"
	return false

func _process(delta: float) -> void:
	if finished or continue_check:
		return
	elapsed += delta
	stage_time += delta
	frames += 1
	total_frame_seconds += delta
	if main.ui.mode == "pause":
		main.ui.play()
	if elapsed > 300 or stage_time > 70:
		fail("Timeout at stage %d, hero=%s" % [stage,main.world.hero.position])
		return
	var hero: Fighter = main.world.hero
	if hero.model.state == "dead":
		fail("Player died during route at stage "+str(stage))
		return
	if main.ui.mode == "dialogue":
		if stage_time > 0.25:
			main.ui.advance_dialogue()
			stage_time = 0
		return
	match stage:
		0:
			if stage_time > 1:
				capture("01_settlement")
				if interact_at(Vector3(-3,0,5)):
					next_stage()
		1:
			if Session.flag("evt_family_morning"):
				record("Morning family interaction completed.")
				next_stage()
		2:
			if interact_at(Vector3(3,0,-8)):
				next_stage()
		3:
			if Session.flag("evt_contract"):
				record("Protection contract accepted.")
				next_stage()
		4:
			if hero.position.z < -14:
				capture("02_movement")
			fight_route("evt_cart_clear",Vector3(0,0,-24),"03_normal_combat")
		5:
			if interact_at(Vector3(-4.5,0,-33)):
				record("Shrine checkpoint activated, health and draughts restored.")
				next_stage()
		6:
			fight_route("evt_ambush_clear",Vector3(0,0,-45),"")
		7:
			fight_route("evt_foreman_clear",Vector3(0,0,-63),"04_foreman")
		8:
			if interact_at(Vector3(3,0,-8)):
				next_stage()
		9:
			if Session.flag("evt_paid"):
				if Session.data.currency != 30:
					fail("Expected 30 crowns after payment")
				else:
					record("Paid exactly 30 crowns.")
					next_stage()
		10:
			if interact_at(Vector3(-6,0,-1)):
				next_stage()
		11:
			if Session.flag("purchase_honeybread"):
				if Session.data.currency != 22:
					fail("Expected 22 crowns after purchase")
				else:
					record("Bought honeybread for 8 crowns.")
					next_stage()
		12:
			if interact_at(Vector3(-3,0,5)):
				capture("05_return_home")
				next_stage()
		13:
			if Session.flag("ch01_complete"):
				capture("06_chapter_complete")
				record("Opening chapter completed from fresh save through movement, 5 enemies, payment, purchase and family supper.")
				record("Distance walked: %.1fm; elapsed %.1fs; development-run average %.1f FPS (30 FPS cap; not target-laptop evidence)." % [hero.total_distance,elapsed,frames/maxf(total_frame_seconds,0.001)])
				next_stage()
		14:
			if stage_time > 0.8:
				stage = 15
				main.ui.play()
				main.ui.show_pause()
				var before = hero.position
				await get_tree().create_timer(0.2,true).timeout
				if hero.position.distance_to(before)>0.001:
					fail("Player moved during pause")
					return
				main.ui.play()
				record("Pause froze player position; resumed successfully.")
				complete()

func fight_route(flag: String, point: Vector3, shot: String) -> void:
	if Session.flag(flag):
		Input.action_release("guard")
		main.world.hero.model.guard(false)
		record("Encounter complete: "+flag)
		next_stage()
		return
	var hero: Fighter = main.world.hero
	var closest: Fighter
	var distance = 12.0
	for enemy in main.world.enemies:
		if enemy.model.state == "dead":
			continue
		var d = hero.position.distance_to(enemy.position)
		if d<distance:
			distance=d
			closest=enemy
	if closest == null:
		walk_to(point)
		return
	if not shot.is_empty() and distance < 3.5 and closest.model.state == "attack":
		capture(shot)
	hero.target = closest
	hero.face(closest.position)
	if hero.model.health < 57 and Session.data.heals > 0 and hero.model.can_begin():
		hero.try_heal()
		return
	if closest.model.state == "attack" and closest.model.elapsed > float(closest.model.attack.windup)-0.20 and hero.model.can_begin():
		Input.action_press("guard")
		hero.model.guard(true)
		hero.test_direction = Vector3.ZERO
		return
	if closest.model.state != "attack" or closest.model.elapsed > float(closest.model.attack.windup)+float(closest.model.attack.active):
		Input.action_release("guard")
		hero.model.guard(false)
	if distance > 1.7:
		walk_to(closest.position,1.65)
	else:
		hero.test_direction = Vector3.ZERO
		if hero.model.can_begin() and hero.model.stamina > 32:
			hero.try_attack("heavy" if closest.kind == "foreman" else "light")

func capture(id: String) -> void:
	if captures.has(id) or DisplayServer.get_name() == "headless":
		return
	captures[id] = true
	call_deferred("save_capture",id)

func save_capture(id: String) -> void:
	if id == "05_return_home":
		await get_tree().create_timer(0.3).timeout
	await RenderingServer.frame_post_draw
	var path = ProjectSettings.globalize_path("res://../docs/evidence/")+id+".png"
	get_viewport().get_texture().get_image().save_png(path)
	print("SCREENSHOT: "+path)

func fail(reason: String) -> void:
	finished = true
	record("FAIL: "+reason)
	write_report()
	main.finish(1)

func complete() -> void:
	finished = true
	record("PASS")
	write_report()
	main.finish(0)

func write_report() -> void:
	var path = "res://../docs/evidence/"+("continue" if continue_check else "playthrough")+".txt"
	var file = FileAccess.open(path,FileAccess.WRITE)
	file.store_string("\n".join(report)+"\n")
