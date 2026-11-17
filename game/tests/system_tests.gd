extends Node

var main: Node
var checks: int = 0
var failures: int = 0
var report: Array[String] = []

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition: failures += 1
	var line = ("PASS: " if condition else "FAIL: ")+message
	report.append(line)
	print(line)

func wait(seconds: float = 0.1) -> void:
	await get_tree().create_timer(seconds,true).timeout

func key(code: Key, pressed: bool = true) -> void:
	var event = InputEventKey.new()
	event.physical_keycode = code
	event.keycode = code
	event.pressed = pressed
	Input.parse_input_event(event)

func mouse(button: MouseButton, pressed: bool = true) -> void:
	var event = InputEventMouseButton.new()
	event.button_index = button
	event.pressed = pressed
	Input.parse_input_event(event)

func run() -> void:
	main.start_game(true)
	await wait(0.3)
	var hero: Fighter = main.world.hero
	if DisplayServer.get_name()=="headless": print("SKIP: Desktop mouse capture requires a graphics window; none opened.")
	else: check(Input.mouse_mode == Input.MOUSE_MODE_CAPTURED,"Mouse captured during gameplay")
	var start = hero.position
	key(KEY_W)
	await wait(0.35)
	key(KEY_W,false)
	var walked = hero.position.distance_to(start)
	check(walked > 0.6,"Physical W key moves the character")
	start = hero.position
	key(KEY_SHIFT)
	key(KEY_W)
	await wait(0.35)
	key(KEY_W,false)
	key(KEY_SHIFT,false)
	check(hero.position.distance_to(start) > walked*1.2,"Shift + W sprints faster")
	var angle = hero.yaw.rotation.y
	var motion = InputEventMouseMotion.new()
	motion.relative = Vector2(100,0)
	motion.screen_relative = Vector2(100,0)
	Input.parse_input_event(motion)
	await wait()
	if DisplayServer.get_name()=="headless": print("SKIP: Captured-mouse orbit requires a graphics window; none opened.")
	else: check(absf(hero.yaw.rotation.y-angle)>0.1,"Mouse motion controls orbit camera")
	mouse(MOUSE_BUTTON_LEFT)
	await wait(0.05)
	check(hero.model.state == "attack" and hero.model.attack_id == "light","LMB starts a light attack")
	mouse(MOUSE_BUTTON_LEFT,false)
	key(KEY_SPACE)
	await wait(0.05)
	check(hero.model.state == "attack","Dodge cannot interrupt attack")
	key(KEY_SPACE,false)
	await wait(0.7)
	mouse(MOUSE_BUTTON_RIGHT)
	await wait(0.05)
	check(hero.model.attack_id == "heavy" and hero.model.state == "attack","RMB starts heavy attack")
	mouse(MOUSE_BUTTON_RIGHT,false)
	await wait(1.3)
	hero.model.stamina = 100
	key(KEY_CTRL)
	await wait(0.05)
	check(hero.model.state == "guard","Ctrl holds guard")
	key(KEY_CTRL,false)
	await wait(0.1)
	check(hero.model.state == "idle","Releasing Ctrl releases guard")
	key(KEY_SPACE)
	await wait(0.1)
	check(hero.model.state == "dodge" and hero.model.invulnerable(),"Space starts dodge and invulnerability window")
	key(KEY_SPACE,false)
	await wait(0.65)
	hero.model.health = 40
	key(KEY_R)
	await wait(0.1)
	key(KEY_R,false)
	check(hero.model.health == 88 and Session.data.heals == 2,"R heals and consumes a persistent draught")
	await wait(1)
	key(KEY_ESCAPE)
	await wait(0.1)
	key(KEY_ESCAPE,false)
	check(main.ui.mode == "pause" and get_tree().paused and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE,"Escape pauses and releases mouse")
	start = hero.position
	key(KEY_W)
	await wait(0.3)
	key(KEY_W,false)
	check(hero.position.distance_to(start)<0.001,"Movement is frozen during pause")
	key(KEY_ESCAPE)
	await wait(0.1)
	key(KEY_ESCAPE,false)
	check(main.ui.mode == "play" and not get_tree().paused,"Escape resumes play")
	key(KEY_TAB)
	await wait(0.1)
	key(KEY_TAB,false)
	check(main.ui.mode == "journal" and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE,"Tab opens journal with free cursor")
	key(KEY_TAB)
	await wait(0.1)
	key(KEY_TAB,false)
	# Isolated placement for camera/wall and hurtbox checks, separate from campaign traversal.
	hero.position = Vector3(0,0,-20)
	hero.yaw.rotation.y = 0
	hero.pitch.rotation.x = 0
	var wall = main.world.solid_box(Vector3(5,4,0.3),Vector3(0,2,-17),Color("555555"))
	await wait(0.3)
	check(hero.pitch.get_hit_length()<3.3,"Camera spring arm retracts at an actual wall")
	wall.queue_free()
	await wait(0.2)
	Session.data.flags["evt_contract"] = true
	var enemy: Fighter = main.world.enemies[0]
	enemy.ai_enabled = false
	enemy.position = Vector3(0,0,-21.7)
	for other in main.world.enemies:
		other.ai_enabled = false
	hero.face(enemy.position)
	hero.target = null
	key(KEY_Q)
	await wait(0.1)
	key(KEY_Q,false)
	check(hero.target == enemy,"Q locks onto a visible enemy")
	var before = enemy.model.health
	hero.model.stamina = 100
	mouse(MOUSE_BUTTON_LEFT)
	await wait(0.05)
	mouse(MOUSE_BUTTON_LEFT,false)
	await wait(0.65)
	check(enemy.model.health == before-22,"Actual active hit volume damages hurtbox exactly once per swing")
	# Safe interaction and fatal damage exclusions.
	hero.position = Vector3(-1.5,0,5.5)
	hero.target = null
	await wait(0.1)
	key(KEY_E)
	await wait(0.1)
	key(KEY_E,false)
	check(main.ui.mode == "dialogue" and hero.model.state == "talk" and Input.mouse_mode == Input.MOUSE_MODE_VISIBLE,"E begins family dialogue and releases cursor")
	var hp = hero.model.health
	hero.take_damage(500,enemy)
	check(hero.model.health == hp and hero.model.state == "talk","Dialogue excludes incoming damage")
	while main.ui.mode == "dialogue": main.ui.advance_dialogue()
	check(Session.flag("evt_family_morning"),"Finishing dialogue commits its story event")
	hero.model.receive(500)
	await wait(0.1)
	check(main.ui.mode == "dead","Fatal damage opens checkpoint restart screen")
	main.restart_checkpoint()
	await wait(0.1)
	check(main.world.hero.position.distance_to(Session.checkpoint_position())<0.2,"Death restores checkpoint position")
	var players = 0
	for node in main.world.get_children():
		if node is Fighter and node.player: players += 1
	check(players == 1 and Session.flag("evt_family_morning"),"Restart has one player and retains one-time family flag")
	report.append("RESULT: %d/%d checks passed" % [checks-failures,checks])
	print(report[-1])
	var file = FileAccess.open("user://validation_systems/results.txt",FileAccess.WRITE)
	file.store_string("\n".join(report)+"\n")
	main.finish(1 if failures else 0)
