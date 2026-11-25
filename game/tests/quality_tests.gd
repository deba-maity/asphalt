extends Node

var main: Node
var checks: int=0
var failures: int=0
var lines: Array[String]=[]

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	call_deferred("run")

func check(value: bool, message: String) -> void:
	checks+=1
	if not value: failures+=1
	var line=("PASS: " if value else "FAIL: ")+message
	lines.append(line); print(line)

func wait(time: float=.2) -> void:
	await get_tree().create_timer(time,true).timeout

func run() -> void:
	var data_dir="user://quality_validation/"
	DirAccess.make_dir_recursive_absolute(data_dir)
	Session.store=SaveStore.new(data_dir)
	main.start_game(true)
	await wait(.3)
	var hero: Fighter=main.player
	for enemy in main.world.enemies: enemy.ai_enabled=false
	# Bounded intent: recent recovery only, direction captured at input time.
	hero.try_attack("light")
	hero.queue_intent("dodge")
	check(hero.intent.action.is_empty() and hero.model.state=="attack","Active/windup cannot buffer a dodge or cancel an attack")
	hero.model.elapsed=.5
	hero.use_test_direction=true; hero.test_direction=Vector3.RIGHT
	hero.queue_intent("dodge")
	hero.test_direction=Vector3.LEFT
	await wait(.12)
	check(hero.model.state=="dodge" and hero.dodge_vector.x>.9,"Recent recovery dodge consumes once with the captured direction")
	hero.clear_intent(); await wait(.7)
	var buffer=ActionBuffer.new()
	var model=CombatModel.new()
	buffer.push("light",model,Vector3.ZERO); buffer.tick(.17)
	check(buffer.action.is_empty(),"Old input expires after the bounded 160ms window")
	hero.model.state="idle"; hero.model.elapsed=0
	main.ui.show_dialogue([["Mira","Sit. Tell us the small things first."]],"fixture",func(_accepted): hero.model.state="idle",false)
	main.ui.close_dialogue(true)
	var click=InputEventMouseButton.new()
	click.button_index=MOUSE_BUTTON_RIGHT; click.pressed=true
	hero._unhandled_input(click)
	check(hero.model.state=="idle" and hero.intent.action.is_empty(),"Closing dialogue click cannot become a heavy attack")
	await wait(.25)
	hero.queue_intent("light")
	check(hero.model.state=="attack","Fresh intent after menu release still starts an attack")
	hero.model.state="idle"
	Input.action_press("guard"); hero.model.guard(true)
	hero.intent.push("light",hero.model,Vector3.ZERO)
	Preferences._joy_changed(0,false)
	check(not Input.is_action_pressed("guard") and hero.model.state=="idle" and hero.intent.action.is_empty(),"Disconnect clears held guard and buffered intent")
	Input.action_press("move_left"); Preferences.release_input()
	check(not Input.is_action_pressed("move_left"),"Device/focus reset releases movement")
	Input.action_press("guard"); hero.model.guard(true)
	main._notification(NOTIFICATION_APPLICATION_FOCUS_OUT)
	check(hero.model.state=="idle" and not Input.is_action_pressed("guard"),"Focus loss clears guard even when automated validation suppresses the pause screen")
	# Difficulty affects incoming damage/timing, never story access or save schema.
	var enemy: Fighter=main.world.enemies[0]
	enemy.position=hero.position+Vector3(0,0,-1.7)
	hero.face(enemy.position)
	hero.model.health=100; hero.model.state="idle"
	Preferences.difficulty="standard"; hero.take_damage(20,enemy)
	var standard_loss=100-hero.model.health
	hero.model.health=100; hero.model.state="idle"
	Preferences.difficulty="story"; hero.take_damage(20,enemy)
	check(standard_loss==20 and hero.model.health==88,"Story reduces incoming damage to 60%, preserving physical encounters")
	Preferences.difficulty="standard"
	# Projectile snapshots must survive the shooter's next attack and parries must not revive a dead shooter.
	enemy.model.start_attack("bow_shot")
	main.world.spawn_projectile(enemy)
	var bolts=get_tree().get_nodes_in_group("projectiles")
	var bolt: LedgerProjectile=bolts[-1]
	enemy.model.attack=enemy.model.config.attacks.brute_crush
	check(bolt.rules.blockable and bolt.damage==16,"Projectile retains its own authored rules after shooter changes attack")
	bolt.queue_free()
	hero.model.health=100; hero.model.state="guard"; hero.model.elapsed=.05
	enemy.model.state="dead"; enemy.model.health=0
	hero.take_damage(16,enemy,{"blockable":true,"parryable":true})
	check(enemy.model.state=="dead","Parrying an in-flight shot cannot revive its dead shooter")
	# Actual hitbox ownership: interrupted attack must stop all subsequent damage.
	enemy.model.state="idle"; enemy.model.health=60
	hero.model.state="idle"; hero.model.stamina=100
	hero.face(enemy.position)
	hero.try_attack("light"); hero.model.receive(1)
	hero.model.tick(.2); hero.apply_hits()
	check(enemy.model.health==60,"Interrupted attack cannot claim a hurtbox hit")
	hero.model.state="dead"; hero.apply_hits()
	check(enemy.model.health==60,"Dead attacker cannot continue applying weapon damage")
	hero.model=CombatModel.new()
	hero.target=null; hero.yaw.rotation.y=0
	enemy.position=hero.position+Vector3(0,0,3)
	hero.toggle_target()
	check(hero.target==enemy,"Lock-on can acquire the closest visible opponent behind the player")
	enemy.model.state="dead"
	await wait(.05)
	check(not is_instance_valid(hero.target),"Dying target releases lock-on without stale camera ownership")
	hero.position=Vector3(0,0,-10); hero.yaw.rotation.y=0; hero.pitch.rotation.x=0
	var wall=main.world.solid_box(Vector3(5,4,.3),Vector3(0,2,-7),Color("555555"))
	await wait(.2)
	var obstructed=hero.pitch.get_hit_length()
	check(obstructed<3.3 and hero.smooth_camera_distance<=obstructed+.01,"Camera retracts at collision without smoothing through geometry")
	wall.queue_free()
	await wait(.05)
	check(hero.smooth_camera_distance<hero.pitch.spring_length-.2,"Camera releases outward gradually after obstruction clears")
	hero.use_test_direction=true; hero.position=Vector3(0,0,-10)
	var ramp=main.world.solid_box(Vector3(3,.3,5),Vector3(0,.1,-14),Color("555555"))
	ramp.rotation.x=deg_to_rad(9)
	hero.test_direction=Vector3(0,0,-1)
	await wait(.9)
	check(hero.position.z < -12 and hero.is_on_floor(),"Floor snap and character motion traverse a gentle ramp")
	hero.test_direction=Vector3.ZERO
	ramp.queue_free()
	# Settings round trip includes bindings and migration of old defaults.
	var original=Preferences.bindings.duplicate()
	check(Preferences.rebind("heal",KEY_T).is_empty() and Preferences.prompt("{heal} Heal")=="T Heal","Rebinding changes the live InputMap and prompts together")
	var sign=main.world.label("{heal} drink",Vector3(10,3,5))
	Preferences.rebind("heal",KEY_Y)
	check(sign.text=="Y drink","Existing world prompts update immediately after rebinding")
	Preferences.rebind("heal",KEY_T)
	check(not Preferences.rebind("heal",KEY_W).is_empty(),"Binding conflicts are refused")
	Preferences.subtitle_size=31; Preferences.difficulty="story"; Preferences.music_volume=.2
	Preferences.render_height=540; Preferences.fps_cap=60; Preferences.camera_shake=true
	check(Preferences.save(data_dir+"settings.cfg"),"Settings can be persisted separately from progress")
	Preferences.subtitle_size=23; Preferences.reset_bindings(); Preferences.render_height=720
	Preferences.load_settings(data_dir+"settings.cfg"); Preferences.install_input(); Preferences.apply()
	check(Preferences.subtitle_size==31 and Preferences.bindings.heal==KEY_T and Preferences.difficulty=="story" and is_equal_approx(Preferences.music_volume,.2),"Settings round trip restores access, audio and binding choices")
	check(Preferences.label_for("heal")=="T" and main.ui.text(main.ui.overlay,"{heal} drink").text=="T drink","Player-facing labels resolve the rebound key")
	var area=minf(get_tree().root.size.y,get_tree().root.size.x*9.0/16)
	check(is_equal_approx(get_tree().root.scaling_3d_scale,clampf(540.0/maxf(1,area),.25,2)) and Engine.max_fps==60,"3D scale and optional frame cap apply independently of HUD layout")
	var window=get_tree().root.size
	get_tree().root.size=Vector2i(1920,1080); Preferences.update_render_scale()
	check(is_equal_approx(get_tree().root.scaling_3d_scale,.5),"Resizing window preserves requested 540p 3D height")
	get_tree().root.size=window; Preferences.update_render_scale()
	# Audio resources/buses exist headlessly; no audible playback is performed.
	for bus in ["Music","Effects","Ambient"]: check(AudioServer.get_bus_index(bus)>=0,"Independent audio bus: "+bus)
	Sound.context("zone_hearthmere",false)
	var starts=Sound.music_starts
	Sound.context("zone_alder_road",true)
	check(Sound.music_starts==starts and Sound.voices.size()==8,"Small zone change retains music clock and bounded effects pool")
	Sound.context("zone_counting_shore",false,true)
	check(Sound.current_ambience=="amb_ashes" and Sound.silence,"Realm ambience and authored quiet context are explicit")
	Sound.context("zone_counting_shore",false,false,true)
	var tide: AudioStreamWAV = Sound.ambience.stream
	check(Sound.current_ambience == "amb_tide" and tide.loop_end == roundi(16 * tide.mix_rate), "Compressed shoreline ambience loops after every wave in the sixteen-second recording")
	var clips_valid=true
	for id in Sound.CLIPS:
		if not Sound.resources.has(id): clips_valid=false
	check(clips_valid,"All combat, footstep, music and ambient audio assets load")
	main.ui.show_menu()
	check(Sound.silence and not Sound.combat,"Returning to title cannot leave combat music active")
	Session.running=true; main.ui.play()
	# CPU-only animation sampling at both frame rates; no visual claim.
	for hz in [30,60]:
		var visual=load("res://assets/characters/rayan.tscn").instantiate()
		add_child(visual)
		var state=CombatModel.new(); state.start_attack("light")
		var weight_sum=true
		for i in hz:
			state.tick(1.0/hz)
			visual.animate(1.0/hz,state,0)
			if state.state=="attack":
				var weights=AnimationPolicy.attack_blend(state)
				if not is_equal_approx(weights.x+weights.y+weights.z,1): weight_sum=false
		check(weight_sum and state.state=="idle" and not state.active(),"Authored animation/damage clock recovers coherently at %d FPS" % hz)
		visual.free()
	for hz in [30,60]:
		var pose=AnimationPolicy.leg(PI,false)
		check(is_finite(pose.x) and pose.y<0,"Analytic leg solution has a bent knee at %d Hz" % hz)
	# Recorder reports unavailable graphics metrics honestly under dummy rendering.
	main.benchmark.begin()
	await wait(1.1)
	var path=main.benchmark.stop()
	var report=JSON.parse_string(FileAccess.get_file_as_string(path))
	check(report.classification.contains("HEADLESS") and report.adapter==null and not report.frame_intervals.is_empty(),"Benchmark report separates headless measurements from rendered telemetry")
	Preferences.bindings=original; Preferences.install_input()
	Preferences.subtitle_size=23; Preferences.difficulty="standard"; Preferences.music_volume=.45
	Preferences.render_height=720; Preferences.fps_cap=30; Preferences.camera_shake=false; Preferences.apply()
	main.ui.play()
	lines.append("RESULT: %d/%d pass-three behavior checks passed" % [checks-failures,checks])
	print(lines[-1])
	var f=FileAccess.open(data_dir+"results.txt",FileAccess.WRITE)
	f.store_string("\n".join(lines)+"\n")
	main.finish(1 if failures else 0)
