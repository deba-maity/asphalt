extends "res://tests/playthrough.gd"

var campaign_started: bool = false
var seen_zones: Dictionary = {}
var rests: Dictionary = {}
var campaign_elapsed: float = 0
var last_objective: String = ""
var objective_time: float = 0
var dialogue_clock: float = 0
var pending_finish: bool = false
var screenshot_queue: Dictionary = {}
var player_identity: int = 0
var wall_started: int = 0

func _ready() -> void:
	wall_started=Time.get_ticks_msec()
	DirAccess.make_dir_recursive_absolute(evidence_dir())
	if "--campaign-continue" in OS.get_cmdline_user_args():
		main.start_game(false)
		if not Session.data.ending or not Session.data.credits or Session.data.story_deaths!=1 or Session.data.resurrections!=1 or Session.data.zone!="zone_memorial":
			fail("Campaign Continue did not restore completed memorial state")
		else:
			record("Relaunch Continue restored ending, credits, memorial and exactly one canonical death/resurrection.")
			finished=true
			write_report()
			main.finish()
		return
	super._ready()
	player_identity=main.player.get_instance_id()
	record("Campaign traversal starts at New Game. No debug jumps, teleports, health grants or encounter flag edits.")

func evidence_dir() -> String:
	return "user://campaign_validation/evidence/"

func complete() -> void:
	if not campaign_started:
		campaign_started=true
		finished=false
		stage_time=0
		record("Chapter one complete; take the next-day chapter-card action.")
		main.travel("zone_cinder_errand")
		return
	finished=true
	record("PASS: all six chapters, canonical death/resurrection, five later named confrontations, memorial and credits.")
	record("Observed scripted traversal %.1fs, including fast dialogue and loading. Not a human playtime estimate." % campaign_elapsed)
	record("Wall-clock %.2fs; display backend %s. Accelerated fixed-FPS runs report simulation time separately; no graphics performance inferred." % [(Time.get_ticks_msec()-wall_started)/1000.0,DisplayServer.get_name()])
	write_report()
	main.finish()

func _process(delta: float) -> void:
	if main.closing: return
	campaign_elapsed+=delta
	if not campaign_started:
		if not finished: super._process(delta)
		return
	if finished or pending_finish: return
	if campaign_elapsed>900: fail("Campaign exceeded 900 seconds"); return
	if main.ui.mode=="loading": return
	if main.ui.mode=="load_failure": fail("Transition failed: "+main.transitions.failure); return
	if not is_instance_valid(main.world): return
	var hero: Fighter=main.world.hero
	hero.use_test_direction=true
	if hero.get_instance_id()!=player_identity: fail("Player node was recreated during a transition"); return
	if hero.model.state=="dead": fail("Combat death at "+Session.data.zone+" / "+Session.objective().id); return
	if main.ui.mode=="pause": main.ui.play()
	if main.ui.mode=="credits":
		capture("credits")
		main.ui.finish_credits()
		if Session.data.completed_chapters.size()!=6 or Session.data.bosses.size()<5 or Session.data.story_deaths!=1 or Session.data.resurrections!=1:
			fail("Campaign ending state incomplete: "+JSON.stringify(Session.data)); return
		pending_finish=true
		finish_after_capture()
		return
	if main.ui.mode=="dialogue":
		dialogue_clock+=delta
		if dialogue_clock>.18:
			dialogue_clock=0
			# Alternate ordinary advancing with the same skip-to-last/accept behavior as the UI.
			if main.ui.dialogue_index==0 and main.ui.dialogue_lines.size()>3:
				main.ui.dialogue_index=main.ui.dialogue_lines.size()-1
				main.ui.refresh_dialogue()
			main.ui.advance_dialogue()
		return
	if main.ui.mode!="play": return
	if not seen_zones.has(Session.data.zone):
		seen_zones[Session.data.zone]=true
		record("Entered "+Session.data.zone+" / "+Session.data.resurrection)
		var loaded=Session.store.load_game()
		if loaded.get("zone","")!=Session.data.zone or loaded.get("resurrection","")!=Session.data.resurrection:
			fail("Boundary save/load mismatch at "+Session.data.zone); return
		capture(Session.data.zone)
	var objective=Session.objective()
	var attacking=0
	for enemy in main.world.enemies:
		if is_instance_valid(enemy) and enemy.model.state=="attack": attacking+=1
	if attacking>1 or main.world.coordinator.active.size()>3: fail("Encounter attack/activation budget exceeded"); return
	if objective.id!=last_objective:
		record("Objective: "+objective.id)
		last_objective=objective.id
		objective_time=0
	else: objective_time+=delta
	if objective_time>95:
		fail("Objective timeout: "+objective.id+" hero="+str(hero.position)+" health="+str(hero.model.health)); return
	if main.world is ChapterWorld and Session.data.zone!="zone_hearthmere":
		for point in main.world.interactables:
			if point.id.begins_with("cp_before_") and not rests.has(point.id) and hero.position.distance_to(point.position)<8 and not main.world.danger():
				if walk_to(point.position,1.5):
					main.world.interact()
					rests[point.id]=true
				return
	var closest: Fighter
	var distance=14.0
	for enemy in main.world.enemies:
		if not is_instance_valid(enemy) or enemy.model.state=="dead": continue
		var d=hero.position.distance_to(enemy.position)
		if d<distance:
			distance=d
			closest=enemy
	if closest!=null:
		fight_campaign(closest,distance,objective)
		return
	Input.action_release("guard")
	hero.model.guard(false)
	hero.target=null
	var point=Vector3(objective.target[0],0,objective.target[2])
	if objective.id in ["q_shore_gate","q_return_veil"]:
		if hero.position.z>point.z+1.65:
			walk_to(Vector3(0,0,point.z+1.35),.2)
		elif hero.model.can_begin():
			hero.test_direction=Vector3(0,0,-1)
			hero.face(hero.position+Vector3(0,0,-2))
			hero.try_ashstep()
		return
	if walk_to(point,1.6): main.world.interact()

func fight_campaign(enemy: Fighter, distance: float, objective: Dictionary) -> void:
	var hero: Fighter=main.world.hero
	hero.target=enemy
	hero.face(enemy.position)
	if enemy.definition.get("boss",false) and enemy.model.state=="attack": capture("boss_"+enemy.kind)
	if hero.model.health<58 and Session.data.heals>0 and hero.model.can_begin():
		Input.action_release("guard")
		hero.try_heal()
		return
	var threatening: Fighter
	for other in main.world.enemies:
		if is_instance_valid(other) and other.model.state=="attack" and hero.position.distance_to(other.position)<float(other.model.attack.reach)+.3:
			threatening=other
			break
	if threatening!=null:
		var strike=threatening.model.attack
		var remaining=float(strike.windup)-threatening.model.elapsed
		if remaining<.14 and remaining>-.12 and hero.model.can_begin():
			hero.face(threatening.position)
			hero.test_direction=Vector3.ZERO
			if not strike.blockable and hero.model.ash_unlocked and hero.model.resolve>=1:
				Input.action_release("guard")
				hero.try_ashstep()
			elif not strike.blockable:
				Input.action_release("guard")
				hero.test_direction=(hero.position-threatening.position).normalized()
				hero.try_dodge()
			else:
				Input.action_press("guard")
				hero.model.guard(true)
			return
	Input.action_release("guard")
	hero.model.guard(false)
	if distance>1.65:
		walk_to(enemy.position,1.6)
	else:
		hero.test_direction=Vector3.ZERO
		if objective.id=="q_ash_tutorial" and not Session.flag("evt_ashstep_evade"): return
		if hero.model.can_begin() and hero.model.stamina>32:
			hero.try_attack("heavy" if "tempered_edge" in Session.data.unlocks or enemy.definition.get("boss",false) else "light")

func finish_after_capture() -> void:
	await get_tree().create_timer(.5,true).timeout
	complete()

func capture(id: String) -> void:
	if screenshot_queue.has(id) or DisplayServer.get_name()=="headless": return
	screenshot_queue[id]=true
	save_capture(id)

func save_capture(id: String) -> void:
	await get_tree().create_timer(.12,true).timeout
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(evidence_dir()+id+".png")

func write_report() -> void:
	var file=FileAccess.open(evidence_dir()+("continue.txt" if "--campaign-continue" in OS.get_cmdline_user_args() else "campaign.txt"),FileAccess.WRITE)
	file.store_string("\n".join(report)+"\n")
	if not main.transitions.history.is_empty():
		var metrics=FileAccess.open(evidence_dir()+"transitions.json",FileAccess.WRITE)
		metrics.store_string(JSON.stringify(main.transitions.history,"  "))
