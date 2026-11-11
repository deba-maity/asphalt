extends Node

var main: Node
var checks: int=0
var failures: int=0
var report: Array[String]=[]

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks+=1
	if not value: failures+=1
	var line=("PASS: " if value else "FAIL: ")+message
	report.append(line)
	print(line)

func wait_idle() -> void:
	var started=Time.get_ticks_msec()
	while main.transitions.state not in ["idle","recovering"] and Time.get_ticks_msec()-started<15000:
		await get_tree().process_frame
	check(Time.get_ticks_msec()-started<15000,"Transition settles without a blocking wait")

func run() -> void:
	main.start_game(true)
	var player_id=main.player.get_instance_id()
	var old_world=weakref(main.world)
	check(main.travel("zone_cinder_errand"),"Local transition request accepted")
	check(not main.travel("zone_cinder_errand"),"Duplicate committed request refused")
	await wait_idle()
	check(Session.data.zone=="zone_cinder_errand" and main.player.get_instance_id()==player_id,"New zone preserves the one player node")
	check(old_world.get_ref()==null,"Previous zone actually freed rather than hidden")
	check(main.transitions.resource==null and main.transitions.zone_id.is_empty(),"Coordinator releases PackedScene reference after commit")
	var saved=Session.data.duplicate(true)
	check(not main.transitions.prefetch("zone_cinder_home","res://scenes/zones/missing-test-resource.tscn"),"Missing packaged resource detected before unload")
	check(not main.travel("zone_cinder_home") and main.ui.mode=="load_failure","Failed request presents recoverable loading UI")
	check(Session.data.zone==saved.zone and main.world!=null,"Failed transition retains previous zone/checkpoint")
	main.transitions.recover()
	check(main.ui.mode=="play" and main.player.get_instance_id()==player_id,"Recovery restarts a valid checkpoint with one player")
	main.transitions.prefetch("zone_cinder_home")
	main.transitions.cancel()
	await wait_idle()
	check(Session.data.zone==saved.zone and main.transitions.resource==null,"Logical cancellation discards stale result without committing it")
	main.transitions.speculative_budget_mb=0
	check(not main.transitions.prefetch("zone_cinder_home"),"Configured speculative budget refuses oversized preload")
	main.transitions.speculative_budget_mb=24
	var invalid_root=Node3D.new()
	var broken_scene=PackedScene.new()
	broken_scene.pack(invalid_root)
	invalid_root.free()
	main.transitions.resource=broken_scene
	main.transitions.zone_id="zone_cinder_home"
	main.transitions.committed=true
	main.transitions.state="ready"
	await wait_idle()
	check(main.ui.mode=="load_failure" and Session.data.zone==saved.zone,"Failed scene construction rolls progress back after releasing the old zone")
	main.transitions.recover()
	check(is_instance_valid(main.world) and main.player.get_instance_id()==player_id,"Construction failure recovers the checkpoint with the same player")
	var baseline=0
	for i in 8:
		var id="zone_cinder_home" if i%2==0 else "zone_cinder_errand"
		main.transitions.low_memory=i%2==0
		var weak=weakref(main.world)
		check(main.travel(id),"Repeated zone request "+str(i))
		await wait_idle()
		check(weak.get_ref()==null and main.player.get_instance_id()==player_id,"Unload/reload releases old nodes and retains player "+str(i))
		var count=0
		for child in main.get_children():
			if child is ChapterWorld: count+=1
		check(count==1,"Exactly one active zone after transition "+str(i))
		if i==1: baseline=get_tree().get_node_count()
		if i==7: check(get_tree().get_node_count()<=baseline+3,"Repeated equal-zone loads do not accumulate scene nodes")
	# Ordinary deaths before and after the single canonical resurrection.
	for chapter in ["ch02_night_cinders","ch05_returned"]:
		Session.data=Campaign.replay_state(chapter)
		Session.chapter=Campaign.definition(Session.data.zone)
		main.load_world()
		main.ui.play()
		var resurrection_count=Session.data.resurrections
		main.player.model.receive(500)
		await get_tree().physics_frame
		await get_tree().process_frame
		check(main.ui.mode=="dead","Ordinary death screen: "+chapter)
		main.restart_checkpoint()
		check(Session.data.resurrections==resurrection_count and main.player.model.ash_unlocked==(chapter=="ch05_returned"),"Ordinary restart preserves correct body/abilities: "+chapter)
	# Skip a story, replay its completion callback, then check camera and input release.
	Session.data=Campaign.replay_state("ch02_night_cinders")
	Session.chapter=Campaign.definition(Session.data.zone)
	main.load_world(); main.ui.play()
	var zone=main.world
	var object=Session.chapter.objects[0]
	var angle=main.player.yaw.rotation.y
	zone.begin_story(object)
	main.ui.close_dialogue(true)
	check(Session.flag("evt_errand_started") and main.player.model.state=="idle" and is_equal_approx(main.player.yaw.rotation.y,angle),"Skipping story commits objective and restores camera/input")
	var currency=Session.data.currency
	zone.commit_story(object)
	check(Session.data.currency==currency,"One-time story callback is idempotent")
	var unfinished=Session.chapter.objects[1]
	zone.begin_story(unfinished)
	var escape=InputEventKey.new()
	escape.physical_keycode=KEY_ESCAPE
	escape.keycode=KEY_ESCAPE
	escape.pressed=true
	main.ui._input(escape)
	check(main.ui.story_paused and get_tree().paused,"Story pause retains subtitle/callback state")
	zone.save_current()
	main.ui.close_dialogue(false)
	main.restart_checkpoint()
	check(not Session.flag("evt_willow") and Session.flag("evt_errand_started"),"Saving/quitting an unfinished story retains required progress without committing it")
	Session.data=Campaign.replay_state("ch03_road_revenge")
	Session.data.flags["evt_neri_rescued"]=true
	Session.chapter=Campaign.definition(Session.data.zone)
	main.load_world(); main.ui.play()
	for entry in Session.chapter.objects:
		if entry.effect=="deep_flask":
			main.world.begin_story(entry)
			main.ui.close_dialogue(true)
	check(Session.data.currency==30 and Session.data.max_heals==4 and Session.store.load_game().max_heals==4,"Optional affordable flask upgrade persists without grinding")
	Session.data=Campaign.replay_state("ch04_between_ashes")
	Session.data.unlocks.append("ashstep")
	Session.data.flags["evt_trial_choice"]=true
	Session.data.flags["evt_trial_warden_clear"]=true
	Session.chapter=Campaign.definition(Session.data.zone)
	main.load_world(); main.ui.play()
	main.player.position=Vector3(0,0,-40)
	main.world._process(2.1)
	main.player.model.ashstep()
	main.player.model.tick(.1)
	main.world._process(.11)
	check(Session.flag("evt_ashstep_evade") and Session.flag("evt_trial_warden_clear"),"Defeating Warden before its lesson leaves a nonlethal remnant tutorial, avoiding a soft lock")
	Session.data=Campaign.replay_state("ch03_road_revenge")
	Session.chapter=Campaign.definition(Session.data.zone)
	main.load_world(); main.ui.play()
	main.begin_story_death()
	check(main.ui.mode=="cinematic" and main.player.model.state=="transition" and main.player.model.health>0,"Authored betrayal uses a separate input-locked fall, not ordinary defeat")
	var token=main.story_token
	main.finish_story_death(token)
	main.finish_story_death(token)
	await wait_idle()
	check(Session.data.story_deaths==1 and Session.data.zone=="zone_counting_shore" and not main.story_active,"Skipping betrayal twice commits exactly one canonical death")
	var actual_store=Session.store
	var actual_loaded=Session.loaded.duplicate(true)
	main.replay_chapter("ch01_bread_steel")
	main.ui.show_menu()
	check(Session.store==actual_store and JSON.parse_string(JSON.stringify(Session.loaded))==JSON.parse_string(JSON.stringify(actual_loaded)) and not Session.replay,"Chapter replay leaves campaign Continue save unchanged")
	report.append("RESULT: %d/%d transition/system checks passed" % [checks-failures,checks])
	print(report[-1])
	var file=FileAccess.open("user://transition_validation/results.txt",FileAccess.WRITE)
	file.store_string("\n".join(report)+"\n")
	var metrics=FileAccess.open("user://transition_validation/metrics.json",FileAccess.WRITE)
	metrics.store_string(JSON.stringify(main.transitions.history,"  "))
	main.finish(1 if failures else 0)
