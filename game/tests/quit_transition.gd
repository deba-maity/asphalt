extends Node

var main: Node

func _ready() -> void:
	call_deferred("run")

func run() -> void:
	if "--test-quit-transition" in OS.get_cmdline_user_args():
		main.start_game(true)
		if not main.travel("zone_cinder_errand"): main.finish(1); return
		await get_tree().process_frame
		print("PASS: requesting application close while a real local transition is in flight")
		main._notification(NOTIFICATION_WM_CLOSE_REQUEST)
	else:
		main.start_game(false)
		var valid=SaveStore.valid(Session.data) and main.world!=null and main.player!=null
		print(("PASS: " if valid else "FAIL: ")+"relaunch after transition quit restores a valid checkpoint: "+Session.data.zone)
		main.finish(0 if valid else 1)
