extends Node

var ui: GameInterface
var world: ChapterWorld
var closing: bool = false

func _ready() -> void:
	ui = GameInterface.new()
	ui.main = self
	add_child(ui)
	load_world()
	ui.show_menu()
	get_tree().auto_accept_quit = false
	if Session.validation:
		var script = "res://tests/system_tests.gd" if "--validate-systems" in OS.get_cmdline_user_args() else "res://tests/playthrough.gd"
		var validator = load(script).new()
		validator.main = self
		add_child(validator)

func load_world() -> void:
	if is_instance_valid(world):
		remove_child(world)
		world.queue_free()
	world = ChapterWorld.new()
	world.ui = ui
	ui.world = world
	add_child(world)

func start_game(fresh: bool) -> void:
	Session.begin(fresh)
	load_world()
	ui.play()
	ui.announce("BREAD AND STEEL")
	if not Session.save_warning.is_empty():
		ui.toast(Session.save_warning,8)

func restart_checkpoint() -> void:
	Session.data.health = Session.data.max_health
	Session.data.heals = 3
	Session.save()
	load_world()
	ui.play()
	ui.toast("Restored at "+Session.data.checkpoint.trim_prefix("cp_").replace("_"," "))

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		if Session.running and world != null:
			world.save_current()
		finish()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if ui != null and ui.mode == "play" and not Session.validation:
			ui.show_pause()

func finish(code: int = 0) -> void:
	if closing: return
	closing = true
	get_tree().paused = false
	Session.running = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	ui.world = null
	if is_instance_valid(world):
		world.queue_free()
	world = null
	await get_tree().process_frame
	await get_tree().process_frame
	get_tree().quit(code)
