extends SceneTree
var failures: int = 0
var main: Node

func _initialize() -> void:
	call_deferred("run")

func capture(name: String) -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	for panel in main.ui.overlay.find_children("*","PanelContainer",true,false):
		var bounds = panel.get_global_rect()
		if bounds.end.x>1280 or bounds.end.y>720 or bounds.position.x<0 or bounds.position.y<0:
			failures += 1
			push_error("UI outside 720p viewport: "+name+" "+str(bounds))
	root.get_texture().get_image().save_png("res://../docs/evidence/"+name+".png")
	print("UI SCREENSHOT: "+name)

func run() -> void:
	var session = root.get_node("Session")
	session.loaded = SaveStore.fresh()
	main = load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await capture("00_title")
	main.ui.show_settings("menu")
	await capture("07_settings")
	session.store = SaveStore.new("user://validation_ui")
	session.validation = true
	main.start_game(true)
	main.ui.show_journal()
	await capture("08_journal")
	print("UI bounds checks: ","PASS" if failures==0 else "FAIL")
	main.finish(0 if failures==0 else 1)
