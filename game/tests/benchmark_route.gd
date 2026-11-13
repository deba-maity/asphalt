extends "res://tests/campaign_playthrough.gd"

var sustained_started: int=0
var requested_seconds: float=900
var loops: int=0

func _ready() -> void:
	sustained_started=Time.get_ticks_msec()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--benchmark-seconds="): requested_seconds=clampf(float(arg.get_slice("=",1)),30,3600)
	super._ready()

func complete() -> void:
	if not campaign_started: super.complete(); return
	loops+=1
	if (Time.get_ticks_msec()-sustained_started)/1000.0>=requested_seconds:
		record("Sustained route completed %d whole campaigns. No real-user duration inferred." % loops)
		main.benchmark.stop()
		super.complete()
		return
	main.start_game(true)
	main.world.hero.use_test_direction=true
	campaign_started=false; pending_finish=false; finished=false
	stage=0; elapsed=0; stage_time=0; campaign_elapsed=0
	last_objective=""; objective_time=0
	seen_zones.clear(); rests.clear(); screenshot_queue.clear()
	player_identity=main.player.get_instance_id()
