extends SceneTree

var main: Node
var checks: int=0
var failures: int=0

func _initialize() -> void: call_deferred("run")

func bounds(name: String) -> void:
	await process_frame
	await process_frame
	for panel in main.ui.overlay.find_children("*","PanelContainer",true,false):
		checks+=1
		var rect=panel.get_global_rect()
		var valid=rect.end.x<=1280 and rect.end.y<=720 and rect.position.x>=0 and rect.position.y>=0
		if not valid: failures+=1
		print(("PASS: " if valid else "FAIL: ")+name+" "+str(rect))

func run() -> void:
	var session=root.get_node("Session")
	session.loaded=Campaign.replay_state("ch06_last_dawn")
	session.loaded.completed_chapters.append("ch06_last_dawn")
	session.validation=true
	main=load("res://scenes/main.tscn").instantiate()
	root.add_child(main)
	await bounds("Title with Continue")
	main.ui.show_chapter_select(); await bounds("Chapter select")
	main.ui.show_settings("menu"); await bounds("Settings and controls")
	session.store=SaveStore.new("user://layout_validation")
	main.start_game(true)
	main.ui.show_journal(); await bounds("Journal")
	main.ui.show_records(); await bounds("Remembered conversations")
	main.ui.play()
	main.world.talk("morning","npc_mira")
	await bounds("Story subtitles")
	main.ui.close_dialogue(true)
	main.ui.show_ending(); await bounds("Opening chapter card")
	main.ui.show_credits(); await bounds("Ending and credits")
	main.ui.show_transition_failure("A packaged scene could not be loaded. Your progress is safe."); await bounds("Recovery UI")
	print("RESULT: %d/%d headless layout bounds checks passed; no visual inspection claimed" % [checks-failures,checks])
	main.finish(1 if failures else 0)
