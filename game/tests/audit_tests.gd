extends Node

var main: Node
var checks=0
var failures=0
const DIRECTORY="user://audit_validation/"

func _ready() -> void: call_deferred("run")
func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)
func seconds(value: float) -> void:
	for i in int(ceil(value*Engine.physics_ticks_per_second)): await get_tree().physics_frame
func write_text(name: String, value: String) -> void:
	var file=FileAccess.open(DIRECTORY+name,FileAccess.WRITE); file.store_string(value); file.close()

func run() -> void:
	if "--audit-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	DirAccess.make_dir_recursive_absolute(DIRECTORY)
	var model=CombatModel.new()
	model.health=60; model.stamina=50
	for amount in [-10.0,NAN,INF,-INF]:
		check(not model.spend(amount) and model.stamina==50,"Invalid stamina cost cannot grant energy: "+str(amount))
		check(model.receive(amount)=="ignored" and model.health==60 and model.state=="idle","Invalid damage cannot heal, poison or stagger: "+str(amount))
	check(model.receive(0)=="ignored" and model.health==60,"Zero damage does not create a free parry or stagger")
	model.guard(true); var energy=model.stamina; var resolve=model.resolve
	check(model.receive(0)=="ignored" and model.stamina==energy and model.resolve==resolve,"Zero-damage guarding has no resource side effects")
	model.guard(false); model.start_attack("light")
	var elapsed=model.elapsed
	for delta in [-.1,NAN,INF]: model.tick(delta)
	check(model.elapsed==elapsed and model.state=="attack","Invalid deltas cannot rewind or corrupt an action")
	check(not model.claim_swept_hit(1,NAN) and not model.claim_swept_hit(1,INF) and not model.claim_swept_hit(1,-.2),"Non-finite and negative swept contact times are rejected")
	check(not model.claim_swept_hit(1,.17),"A future swept contact cannot damage before the combat clock")
	model.tick(.2)
	check(model.claim_swept_hit(1,.17),"A real contact within the elapsed physics interval is retained")
	# ConfigFile may contain many Variant types. Loading preferences must never
	# cast arbitrary arrays/vectors or turn NaN into a render/audio parameter.
	Preferences.save(DIRECTORY+"settings-before.cfg")
	var config=ConfigFile.new()
	config.set_value("input","sensitivity",NAN)
	config.set_value("input","invert","false")
	config.set_value("audio","volume",Vector3.ONE)
	config.set_value("audio","music_volume",INF)
	config.set_value("audio","effects_volume",-2)
	config.set_value("audio","ambient_volume",4)
	config.set_value("video","fps_cap",60.5)
	config.set_value("video","render_height",[])
	config.set_value("video","fullscreen","true")
	config.set_value("access","difficulty",{"story":true})
	config.set_value("bindings","light",2147483647)
	config.save(DIRECTORY+"settings-bad.cfg")
	check(Preferences.load_settings(DIRECTORY+"settings-bad.cfg"),"Typed malformed preference values load with safe fallbacks")
	check(is_equal_approx(Preferences.sensitivity,.003) and not Preferences.invert,"Mouse settings reject NaN and string booleans")
	check(is_equal_approx(Preferences.volume,.55) and is_equal_approx(Preferences.music_volume,.45) and Preferences.effects_volume==0 and Preferences.ambient_volume==1,"Audio settings reject invalid types and clamp finite ranges")
	check(Preferences.fps_cap==60 and Preferences.render_height==720 and not Preferences.fullscreen and Preferences.difficulty=="standard","Display and difficulty settings require supported values")
	check(Preferences.bindings==Preferences.BINDINGS,"Out-of-range saved bindings restore the complete default map")
	write_text("settings-big.cfg","#".repeat(Preferences.MAX_SETTINGS_BYTES+1))
	var old_sensitivity=Preferences.sensitivity
	check(not Preferences.load_settings(DIRECTORY+"settings-big.cfg") and Preferences.sensitivity==old_sensitivity,"Oversized settings are refused without changing active preferences")
	write_text("settings-objects.cfg","[audio]\nvolume=Object(RefCounted,)\n[input]\nsensitivity=Resource(\"user://audit_validation/never-load-this.tres\")\n")
	check(Preferences.load_settings(DIRECTORY+"settings-objects.cfg") and is_equal_approx(Preferences.volume,.55) and is_equal_approx(Preferences.sensitivity,.003),"Object and Resource literals never reach an object-capable settings parser")
	write_text("settings-malformed.cfg","[video\nfps_cap=120\n")
	check(not Preferences.load_settings(DIRECTORY+"settings-malformed.cfg") and Preferences.fps_cap==60,"Malformed settings sections leave the current values intact")
	Preferences.load_settings(DIRECTORY+"settings-before.cfg"); Preferences.install_input(); Preferences.apply()
	# Invalid data must be rejected before replacing any saved progress.
	var data=SaveStore.fresh()
	for field in ["schema","currency","max_health","heals","max_heals","story_deaths","resurrections"]:
		var bad=data.duplicate(true); bad[field]=.5
		check(not SaveStore.valid(bad),"Whole-number save field rejects fractions: "+field)
	var bad=data.duplicate(true); bad.heals=4
	check(not SaveStore.valid(bad),"Draught count cannot exceed the saved capacity")
	bad=data.duplicate(true); bad.unlocks.append("sword_basics")
	check(not SaveStore.valid(bad),"Duplicate progression identifiers cannot inflate state")
	bad=data.duplicate(true); bad.flags["x".repeat(129)]=true
	check(not SaveStore.valid(bad),"Oversized progression identifiers are refused")
	var store=SaveStore.new(DIRECTORY+"saves")
	# Reset only this fixture's named files; repeated runs remain deterministic.
	for name in ["progress.json","progress.backup.json","progress.tmp"]:
		DirAccess.remove_absolute(store.directory+name)
	check(store.write(data),"Audit save fixture writes valid progress")
	var original=FileAccess.get_file_as_string(store.directory+"progress.json")
	bad=data.duplicate(true); bad["unused"]="x".repeat(SaveStore.MAX_SAVE_BYTES)
	check(not store.write(bad) and FileAccess.get_file_as_string(store.directory+"progress.json")==original,"Oversized serialization cannot replace valid progress")
	data.currency=10; store.write(data)
	var future=data.duplicate(true); future.schema=SaveStore.SCHEMA+1
	var file=FileAccess.open(store.directory+"progress.json",FileAccess.WRITE); file.store_string(JSON.stringify(future)); file.close()
	var future_text=FileAccess.get_file_as_string(store.directory+"progress.json")
	check(store.load_game().is_empty() and FileAccess.get_file_as_string(store.directory+"progress.json")==future_text,"A future schema is preserved even when an older valid backup exists")
	file=FileAccess.open(store.directory+"progress.json",FileAccess.WRITE); file.store_string("x".repeat(SaveStore.MAX_SAVE_BYTES+1)); file.close()
	check(store.load_game().currency==0,"Oversized primary save recovers the prior valid backup")
	# Actual physics-space ground disappearance/reacquisition catches the
	# stale planted=true + missing anchor dictionary failure at ledges.
	main.start_trial(TrialPassage.WARDEN,false)
	var hero: Fighter=main.player; var boss: Fighter=main.world.warden
	boss.ai_enabled=false; hero.use_test_direction=true; hero.target=null
	await seconds(.5)
	var solver=hero.figure.contact_solver
	var ray=PhysicsRayQueryParameters3D.create(hero.position+Vector3.UP*.4,hero.position-Vector3.UP*.5,1)
	var ground=hero.get_world_3d().direct_space_state.intersect_ray(ray)
	check(hero.is_on_floor() and not ground.is_empty(),"Foot reacquisition fixture starts on actual solid ground")
	if not ground.is_empty():
		var collider=ground.collider; var layer=collider.collision_layer
		for side in ["l","r"]:
			solver.anchors[side]=hero.position; solver.planted[side]=true; solver.weights[side]=1.0
		collider.collision_layer=0
		solver.apply(hero.figure.body_skeleton,hero,"idle",0)
		check(solver.anchors.is_empty() and solver.planted.is_empty() and solver.weights.is_empty(),"Losing ground clears every dependent foot-contact state")
		collider.collision_layer=layer
		solver.apply(hero.figure.body_skeleton,hero,"idle",0)
		await seconds(.3)
		check(hero.figure.body_skeleton.get_bone_global_pose(hero.figure.body_skeleton.find_bone("foot_l")).origin.is_finite() and solver.max_correction<=.221,"Ground reacquisition remains finite and bounded")
	# Analytic camera impulse should be independent of render sampling rate.
	var shake=Preferences.camera_shake; Preferences.camera_shake=true
	var first=TrialCamera.new(); var second=TrialCamera.new()
	first.impact(-1,true); second.impact(-1,true)
	for i in 6: first.step_impact(1.0/30)
	for i in 24: second.step_impact(1.0/120)
	check(first.impact_offset.distance_to(second.impact_offset)<.000001 and first.impact_velocity.distance_to(second.impact_velocity)<.000001,"Camera impact response agrees at 30 and 120 render samples")
	first.step_impact(1)
	check(first.impact_offset.length()<.00001 and first.impact_velocity.length()<.00001,"Camera impulse settles without residual drift")
	second.step_impact(NAN); second.step_impact(-1)
	check(second.impact_offset.is_finite() and second.impact_velocity.is_finite(),"Invalid camera delta cannot poison its spring")
	Preferences.camera_shake=false; second.step_impact(.01)
	check(second.impact_offset==Vector2.ZERO and second.impact_velocity==Vector2.ZERO,"Disabling shake clears pending camera impulse")
	first.free(); second.free(); Preferences.camera_shake=shake
	var saved=Session.data.duplicate(true)
	check(not Session.reward("audit_bad_reward",-5) and not Session.purchase("audit_bad_purchase",-5) and Session.data==saved,"Negative economy amounts cannot change progress")
	print("RESULT: %d/%d audit checks passed; %d physics ticks" % [checks-failures,checks,Engine.physics_ticks_per_second])
	main.finish(1 if failures else 0)
