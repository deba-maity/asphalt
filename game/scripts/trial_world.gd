class_name TrialWorld
extends ChapterWorld

var torch_fire := ShaderMaterial.new()
var weather_time := 0.0
var shore_air: Environment
var shore_fill: DirectionalLight3D
var daylight := 0.0
var daylight_target := 0.0
var causeway: ShoreCauseway
var coast: CourtCoast
var standards: CourtStandards
var remembrances: ShoreRemembrances
var arrival: TrialArrival
var title_ember: ShoreEmber
var court_camera: Camera3D
var shot_start := Vector3.ZERO
var shot_target := Vector3.ZERO
var shot_time := 0.0
var warden: Fighter
var boss_title: Label
var waystone: ShoreEmber
var north_gate: ShoreGate
var crossing := false
var won: bool=false
var result_delay: float=-1
var boss_bar: ProgressBar
var boss_panel: Control
var foley: TrialAudio
var boss_echo: ProgressBar
var echo_delay: float=0
var score: TrialScore
var duel: TrialDuel
var composure_bar: ProgressBar
var composure_label: Label
var outcome_pending: bool=false
var seal_flight: SealFlight
const ECHO_COLORS := [Color("79d6c4"), Color("94bede"), Color("e7bd7f"), Color("e6a065")]
var passage: TrialPassage=TrialPassage.new()
var hud_text_time: float=0

func _ready() -> void:
	rng.seed=7251
	ui.trial_layout(true)
	build_court()
	CourtArt.dress(self)
	CourtArchitecture.dress(self)
	remembrances = ShoreRemembrances.new()
	add_child(remembrances)
	batch_scenery()
	causeway = ShoreCauseway.new()
	add_child(causeway)
	coast = CourtCoast.new()
	add_child(coast)
	set_daylight(daylight_target)
	standards = CourtStandards.new()
	add_child(standards)
	north_gate = ShoreGate.new()
	north_gate.position = Vector3(0, 0, -11.3)
	add_child(north_gate)
	north_gate.marked.connect(remembrances.remember)
	north_gate.marked.connect(coast.watch.remember)
	north_gate.mark(passage.stage if ui.main.journey else 0)
	foley=TrialAudio.new(); add_child(foley)
	score=TrialScore.new(); add_child(score)
	hero=Fighter.new()
	hero.player=true
	hero.use_performance=true
	hero.world=self
	hero.position=Vector3(0,.08,4)
	add_child(hero)
	hero.feedback.connect(ui.toast)
	hero.slain.connect(_hero_died)
	ui.main.player=hero
	hero.pitch.spring_length=3.7
	hero.pitch.rotation.x=-.24
	hero.camera.fov=56
	hero.smooth_camera_distance=3.7
	hero.previous_camera_distance=3.7
	hero.camera_focus=Vector3(.25,-.05,0)
	spawn_opponent(Vector3(0, .08, -3.5))
	hero.target=warden if not passage.training() else null
	duel=TrialDuel.new(self)
	coordinator=EncounterCoordinator.new()
	coordinator.world=self
	add_child(coordinator)
	boss_panel=ui.panel(ui.hud,Vector2(370,584),Vector2(540,80),Color(.045,.055,.06,.4))
	var column=ui.column(boss_panel,4)
	boss_title=ui.text(column,passage.entry().name,17,ui.GOLD)
	boss_title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	var strip=Control.new(); strip.custom_minimum_size=Vector2(500,7); column.add_child(strip)
	boss_echo=ProgressBar.new(); strip.add_child(boss_echo)
	boss_echo.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	boss_echo.show_percentage=false; boss_echo.value=100
	boss_echo.add_theme_stylebox_override("fill",ui.bar_style(Color("795b45")))
	boss_echo.add_theme_stylebox_override("background",ui.bar_style(Color("303333")))
	boss_bar=ProgressBar.new()
	strip.add_child(boss_bar); boss_bar.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	boss_bar.show_percentage=false
	boss_bar.add_theme_stylebox_override("fill",ui.bar_style(Color("a88062")))
	boss_bar.add_theme_stylebox_override("background",ui.bar_style(Color.TRANSPARENT))
	boss_bar.value=100
	composure_label=ui.text(column,"COMPOSURE",11,Color("a8a89a"))
	composure_label.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	composure_bar=ProgressBar.new(); composure_bar.show_percentage=false
	composure_bar.custom_minimum_size=Vector2(500,4)
	composure_bar.add_theme_stylebox_override("fill",ui.bar_style(Color("d2b57b")))
	composure_bar.add_theme_stylebox_override("background",ui.bar_style(Color("303333")))
	column.add_child(composure_bar)
	ui.help_caption.text=ui.play_prompt("{journal} Trial guide · {pause} Pause")

func spawn_opponent(at: Vector3) -> void:
	warden=Fighter.new()
	warden.use_performance=true
	warden.kind="still_warden"
	warden.world=self
	warden.position=at
	warden.rotation.y=atan2(at.x - hero.position.x, at.z - hero.position.z)
	warden.ai_cooldown=1.4
	add_child(warden)
	passage.configure(warden)
	warden.slain.connect(_enemy_died)
	enemies.append(warden)

func enter_encounter(stage: int, trained: bool) -> void:
	if arrival != null:
		arrival.free()
		arrival = null
	if waystone != null:
		waystone.free()
		waystone = null
	hero.target = null
	coordinator.lease = null
	coordinator.active.clear()
	coordinator.gap = 0
	enemies.clear()
	warden.free()
	passage = TrialPassage.new(stage)
	daylight_target = stage / 4.0
	duel = TrialDuel.new(self)
	crossing = false
	won = false
	result_delay = -1
	outcome_pending = false
	hero.clear_intent()
	hero.model.state = "idle"
	hero.model.elapsed = 0
	hero.model.heal_pending = false
	hero.model.health = hero.model.max_health
	hero.model.stamina = 100
	hero.model.posture = 0
	hero.model.regen_delay = 0
	hero.model.counter_window = 0
	hero.model.victims.clear()
	hero.combo_index = 0
	hero.impact_pause = 0
	hero.velocity = Vector3.ZERO
	Session.data.heals = Session.data.max_heals
	var direction := -hero.camera.global_basis.z
	direction.y = 0
	var at := hero.position + direction.normalized() * 6.0
	if Vector2(at.x, at.z).length() > 9.5:
		direction = Vector3(-hero.position.x, 0, -hero.position.z)
		at = hero.position + direction.normalized() * 6.0
	at.y = .08
	spawn_opponent(at)
	(hero.figure as PerformanceFigure).shore_stance.ready_sword()
	introduce_echo()
	if stage == 0 and trained: passage.learn("rehearsal")
	if trained or stage > 0: hero.target = warden
	boss_title.text = passage.entry().name
	boss_bar.value = 100
	boss_echo.value = 100
	composure_bar.value = 0
	hud_text_time = 0
	ui.interact_text.text = ""
	ui.threat_text.text = ""

func introduce_echo() -> void:
	var figure := warden.figure as PerformanceFigure
	figure.shore_stance.ready_sword()
	figure.echo_appearance.begin(figure, ECHO_COLORS[passage.stage])

func begin_arrival() -> void:
	ui.clear_court_messages()
	arrival = TrialArrival.new()
	arrival.world = self
	add_child(arrival)
	boss_panel.hide()

func present_traveler(at: Vector3, facing: Vector3) -> void:
	hero.target = null
	hero.clear_intent()
	hero.model.state = "idle"
	hero.model.elapsed = 0.0
	hero.velocity = Vector3.ZERO
	hero.position = at
	hero.rotation.y = atan2(at.x - facing.x, at.z - facing.z)
	hero.reset_physics_interpolation()
	(hero.figure as PerformanceFigure).settle_on_shore()

func show_title_view() -> void:
	warden.hide()
	warden.process_mode = Node.PROCESS_MODE_DISABLED
	if waystone != null: waystone.hide()
	if arrival != null: arrival.memorial.hide()
	if title_ember == null:
		title_ember = ShoreEmber.new()
		title_ember.position = Vector3(1.05, 0, 0)
		add_child(title_ember)
	title_ember.show()
	present_traveler(Vector3(0, .04, 3.6), title_ember.position)
	frame_court()

func frame_court() -> void:
	frame_view(Vector3(5.8, 2.55, 6.9), Vector3(-3.25, 1.10, 2.49), 53)

func frame_dawn() -> void:
	if title_ember != null: title_ember.hide()
	if waystone != null: waystone.hide()
	if arrival != null: arrival.memorial.hide()
	warden.hide()
	warden.process_mode = Node.PROCESS_MODE_DISABLED
	north_gate.unseal(true)
	daylight_target = 1.0
	set_daylight(1.0)
	present_traveler(ShoreCauseway.centre(8.6) + Vector3.UP * .04, ShoreCauseway.centre(19))
	frame_view(Vector3(-1.28, 2.11, -15.9), Vector3(-1.05, 1.28, -30.2), 53)

func frame_view(at: Vector3, subject: Vector3, fov: float) -> void:
	if court_camera == null:
		court_camera = Camera3D.new()
		add_child(court_camera)
	shot_start = at
	shot_target = subject
	shot_time = 0.0
	court_camera.fov = fov
	court_camera.position = at
	court_camera.look_at(subject)
	court_camera.make_current()

func _exit_tree() -> void:
	if is_instance_valid(boss_panel): boss_panel.queue_free()
	if is_instance_valid(ui): ui.trial_layout(false)

func build_court() -> void:
	var atmosphere=WorldEnvironment.new()
	var panorama=PanoramaSkyMaterial.new()
	panorama.panorama=load("res://assets/court/counting_shore.webp")
	var sky=Sky.new(); sky.sky_material=panorama
	atmosphere.environment=ArtDirection.environment("fortress", sky)
	shore_air = atmosphere.environment
	atmosphere.environment.fog_sky_affect=.06
	atmosphere.environment.fog_light_color=Color("9da8af")
	add_child(atmosphere)
	sun=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-24,-47,0)
	sun.shadow_enabled=Preferences.shadows
	sun.directional_shadow_max_distance=35
	add_child(sun)
	shore_fill = DirectionalLight3D.new()
	shore_fill.rotation_degrees = Vector3(-40, 130, 0)
	shore_fill.light_color = Color("95b4d3")
	add_child(shore_fill)
	daylight_target = passage.stage / 4.0
	# One continuous paved surface lets the stone joints in the material meet
	# exactly and keeps the shallow mosaic above the same collision plane.
	solid_box(Vector3(30, .5, 30), Vector3(0, -.25, 0), Color("777975"))
	for i in 40:
		if i == 20: continue # The openable north gate occupies this section.
		var angle=TAU*i/40
		var point=Vector3(sin(angle)*12,0,cos(angle)*12)
		var wall=solid_box(Vector3(1.95,1.2,.65),point+Vector3.UP*.6,Color("686b69"))
		wall.rotation.y=angle
		var cap=Figure.box(self,Vector3(2.0,.16,.83),point+Vector3.UP*1.25,Color("95958a"))
		cap.rotation.y=angle
	torch_fire.shader = preload("res://assets/court/ember_flame.gdshader")
	for i in 8:
		var angle=TAU*i/8
		# Keep the colonnade outside the fighting ring. Decorative columns must
		# neither intersect the fighters nor create unplanned AI cover pockets.
		var base=Vector3(sin(angle)*13.4,0,cos(angle)*13.4)
		if i == 4: base = Vector3(3.3, 0, -14.8) # North gate's outer pier leaves the doorway clear.
		var pillar=Node3D.new(); pillar.position=base; add_child(pillar)
		var collision=StaticBody3D.new(); collision.name="PillarCollision"
		collision.collision_layer=1; collision.collision_mask=0
		var shape=CollisionShape3D.new(); var box=BoxShape3D.new()
		box.size=Vector3(1.1,3.85,1.1); shape.shape=box; shape.position.y=1.925
		collision.add_child(shape); pillar.add_child(collision)
		Figure.box(pillar,Vector3(1.1,.3,1.1),Vector3.UP*.15,Color("888b81"))
		for row in 6:
			var block=Figure.box(pillar,Vector3(.70,.48,.7),Vector3.UP*(.55+row*.5),Color("757a73"))
			SurfaceLibrary.apply(block,"stone",Color("757a73"),1)
		Figure.box(pillar,Vector3(.95,.22,.95),Vector3.UP*3.45,Color("9b9b8e"))
		if i%2==0:
			var lamp := OmniLight3D.new()
			lamp.position = base + Vector3.UP * 3.97
			lamp.light_color = Color("ffb56b")
			lamp.light_energy = .95
			lamp.omni_range = 4.5
			add_child(lamp)
			var bowl := Figure.cylinder(pillar, .16, .29, .19, Vector3.UP * 3.65, Color("3e3631"), 20)
			bowl.material_override = SurfaceLibrary.material("steel", Color("695648"), 2.5)
			var torch := MeshInstance3D.new()
			torch.name = "WatchFire"
			torch.mesh = ShoreEmber.flame_mesh()
			torch.position.y = 3.75
			torch.scale = Vector3(.86, 1.12, .86)
			torch.material_override = torch_fire
			torch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			pillar.add_child(torch)
	for side in [-1,1]:
		for x in [-2.2,2.2]: solid_box(Vector3(.75,3,.9),Vector3(x,1.5,side*11),Color("727a72"))

# Returning to a saved encounter restores its hour immediately. In a continuous
# journey the light changes over several seconds as each echo yields.
func set_daylight(progress: float) -> void:
	daylight = clampf(progress, 0, 1)
	coast.water.set_shader_parameter("dawn", daylight)
	sun.light_color = Color("e0d7c9").lerp(Color("ffcf94"), daylight)
	sun.light_energy = lerpf(.88, 1.39, daylight)
	shore_fill.light_energy = lerpf(.22, .30, daylight)
	shore_air.ambient_light_energy = lerpf(.41, .46, daylight)
	shore_air.ambient_light_color = Color("97b9d0").lerp(Color("b4c6d0"), daylight)
	shore_air.background_energy_multiplier = lerpf(.86, 1.13, daylight)
	shore_air.fog_density = lerpf(.0095, .006, daylight)
	shore_air.tonemap_exposure = lerpf(1.01, 1.08, daylight)

func advance_weather(delta: float) -> void:
	weather_time += delta
	standards.set_wind(weather_time)
	coast.set_tide(weather_time)
	causeway.needles.set_shader_parameter("wind_time", weather_time)
	torch_fire.set_shader_parameter("fire_time", weather_time)

func animate_story_backdrop(delta: float) -> void:
	if court_camera == null or not court_camera.current or Preferences.reduced_effects: return
	if is_instance_valid(ui.main.budget) and not ui.main.budget.focused: return
	advance_weather(delta)
	shot_time += delta
	# A short dolly settles into a fixed composition while the player reads.
	var ease_in := smoothstep(0.0, 6.0, shot_time)
	var direction := shot_target.direction_to(shot_start)
	court_camera.position = shot_start - direction * (.38 * ease_in)
	var ember := title_ember
	if arrival != null and arrival.memorial.visible: ember = arrival.memorial
	if is_instance_valid(ember) and ember.visible and not ember.can_process():
		ember.advance_fire(delta)

func _process(delta: float) -> void:
	if not Session.running or hero==null: return
	elapsed+=delta
	if ui.mode == "play":
		if not Preferences.reduced_effects:
			advance_weather(delta)
		if not is_equal_approx(daylight, daylight_target):
			set_daylight(daylight_target if Preferences.reduced_effects else move_toward(daylight, daylight_target, delta * .13))
	Sound.context("zone_copper_stair",arrival == null and not won,ui.mode!="play",true)
	if waystone != null and ui.mode == "play":
		if near_waystone(): ui.destination_label.hide()
		else: ui.track_destination(hero.camera, passage_target() + Vector3.UP * 1.15, "EMBER" if passage.training() else "NORTH GATE")
		if north_gate.open and not crossing and hero.position.z < -12.7 and absf(hero.position.x) < 1.1:
			crossing = true
			call_deferred("cross_waystone")
		hud_text_time -= delta
		if hud_text_time <= 0:
			hud_text_time = .10
			refresh_waystone()
		return
	if arrival != null and ui.mode == "play":
		if arrival.step == TrialArrival.Step.EMBER and not arrival.near_ember():
			ui.track_destination(hero.camera, arrival.memorial.global_position + Vector3.UP * 1.15, "EMBER")
		elif arrival.step in [TrialArrival.Step.LOCK, TrialArrival.Step.STRIKE] and hero.target == null:
			ui.track_destination(hero.camera, warden.global_position + Vector3.UP * 1.6, "ECHO", true)
		else: ui.destination_label.hide()
		ui.update_hud(hero, {})
		if arrival.sparring != null:
			ui.threat_text.text = ""
			ui.show_practice_cue(arrival.sparring.cue())
		else: ui.practice_cue.hide()
		hud_text_time -= delta
		if hud_text_time <= 0:
			hud_text_time = .12
			arrival.refresh_hud()
		return
	ui.destination_label.hide()
	ui.practice_cue.hide()
	if result_delay >= 0 and ui.mode == "play":
		result_delay -= delta
		if won and result_delay <= .98 and not ui.main.duel_replay and (passage.training() or ui.main.journey):
			update_seal_flight(clampf(1.0 - result_delay / .98, 0.0, 1.0))
		if result_delay < 0:
			if won and not ui.main.duel_replay and (passage.training() or ui.main.journey): light_waystone()
			else: ui.show_trial_result(won)
			return
	if ui.mode=="play":
		if not passage.training() and warden.phase==1 and warden.model.health<warden.model.max_health*.5 and warden.model.can_begin():
			warden.phase=2
			for id in ["light","trial_second","trial_finish","heavy"]:
				var attack: Dictionary=warden.model.config.attacks[id]
				attack.rate*=1.12
				for part in ["windup","active","recovery"]: attack[part]/=1.12
			kindle_crown()
			ui.announce("THE LAST EMBER")
			ui.toast("The Warden quickens. Keep enough stamina to escape.",4)
			duel.phase_changed()
		ui.update_hud(hero,{})
		hud_text_time-=delta
		if hud_text_time<=0:
			hud_text_time=.1
			ui.chapter_label.text=passage.entry().chapter
			ui.objective_text.text="Defeat the echo to continue.\nHealth refills after this encounter." if passage.training() else "Defeat the Cinder Warden.\nEarn passage back to the living."
			if ui.main.duel_replay: ui.objective_text.text = "Win this practice duel.\nYour journey is saved at dawn."
			ui.tutorial.text=ui.play_prompt(passage.hint(self))
			if ui.touch_preferred: ui.help_caption.text = "Menu · Trial guide and settings"
			ui.status.text="%d HP · %d draughts" % [hero.model.health,Session.data.heals]
			if hero.model.posture>=30: ui.status.text+="\nGuard strain %d%%" % hero.model.posture
		composure_bar.value=duel.composure
		composure_label.text="OPEN - RIPOSTE" if duel.riposte_window>0 else "COMPOSURE"
		if passage.stage == 1 and warden.model.state == "guard": ui.threat_text.text = "GUARD RAISED · FLANK OR WAIT"
		if duel.riposte_window>0:
			ui.threat_text.text=ui.play_prompt("{heavy} RIPOSTE" if duel.can_riposte() else "COMPOSURE BROKEN - close the distance")
		var next_health=warden.model.health/warden.model.max_health*100
		if next_health<boss_bar.value: echo_delay=.45
		boss_bar.value=next_health
		echo_delay=maxf(0,echo_delay-delta)
		if echo_delay<=0: boss_echo.value=move_toward(boss_echo.value,next_health,delta*70)
		ui.tutorial.modulate.a=1
		ui.tutorial.visible=true
		warden.health_bar.visible=false
		warden.tell_ring.visible=false
	boss_panel.visible=ui.mode=="play"

func _physics_process(delta: float) -> void:
	if duel!=null and arrival == null: duel.tick(delta)

func can_play() -> bool:
	return super.can_play() and result_delay < 0 and (not won or waystone != null)

func learn(action: String) -> void:
	passage.learn(action)
	if arrival != null: arrival.learn(action)

func interact() -> void:
	if arrival != null: arrival.interact()
	elif waystone != null and not crossing and near_waystone():
		crossing = true
		call_deferred("cross_waystone")

func near_waystone() -> bool:
	return waystone != null and hero.position.distance_to(waystone.position) < (2.35 if passage.training() else 1.35)

func resume_open_gate() -> void:
	won = true
	duel.finished = true
	warden.model.health = 0
	warden.model.state = "dead"
	light_waystone()
	ui.announce("THE ROAD TO DAWN")

func kindle_crown() -> void:
	var figure := warden.figure as PerformanceFigure
	var materials := [figure.regalia.bronze, figure.cape.material_override]
	for material in materials:
		if Preferences.reduced_effects: material.set_shader_parameter("heat", 1.0)
		else: create_tween().tween_method(func(value: float): material.set_shader_parameter("heat", value), 0.0, 1.0, .72)

func update_seal_flight(fraction: float) -> void:
	if Preferences.reduced_effects:
		if is_instance_valid(seal_flight): seal_flight.hide()
		return
	var figure := warden.figure as PerformanceFigure
	if seal_flight == null:
		seal_flight = SealFlight.new()
		add_child(seal_flight)
		var target := north_gate.seals[mini(passage.stage, 2)].global_position
		if not passage.training(): target = north_gate.seals[1].global_position
		var source := warden.global_position + Vector3.UP * .38
		seal_flight.carry(to_local(source), to_local(target), ECHO_COLORS[passage.stage])
		figure.echo_appearance.begin(figure, ECHO_COLORS[passage.stage], true)
	seal_flight.show()
	seal_flight.show_progress(fraction)
	figure.echo_appearance.release(fraction, warden.scale.y)

func light_waystone() -> void:
	if is_instance_valid(seal_flight):
		seal_flight.queue_free()
		seal_flight = null
	daylight_target = (passage.stage + 1) / 4.0
	(hero.figure as PerformanceFigure).shore_stance.rest_sword()
	hero.target = null
	warden.hide()
	warden.process_mode = Node.PROCESS_MODE_DISABLED
	(warden.figure as PerformanceFigure).clear_dropped_weapon()
	warden.collision_layer = 0
	warden.hurtbox.collision_layer = 0
	warden.ai_enabled = false
	enemies.clear()
	boss_panel.hide()
	waystone = ShoreEmber.new()
	if passage.training(): north_gate.mark(passage.stage + 1)
	else: north_gate.unseal()
	waystone.position = Vector3(1.05, 0, 0) if passage.training() else Vector3(0, 0, -12.8)
	add_child(waystone)
	foley.event("heal", waystone.position)
	ui.toast(passage.entry().after if passage.training() else "The north gate is open. Carry their names through.", 6)
	refresh_waystone()

func passage_target() -> Vector3:
	if north_gate.open: return north_gate.route_target(hero.global_position, waystone.global_position)
	return waystone.global_position

func refresh_waystone() -> void:
	ui.update_hud(hero, {})
	boss_panel.hide()
	ui.threat_text.text = ""
	var final_gate := not passage.training()
	var next_name := "the gate" if final_gate else str(TrialPassage.ENCOUNTERS[passage.stage + 1].name).capitalize()
	ui.chapter_label.text = "THE ROAD TO DAWN" if final_gate else "A MOMENT AT THE EMBER"
	ui.objective_panel.show()
	var target := passage_target()
	var instruction := "Return to the ember for " + next_name + "."
	if final_gate:
		instruction = "Walk through the north gate." if target.is_equal_approx(waystone.global_position) else "Follow the gold marks to the gate."
	ui.objective_text.text = instruction + "\n" + ShoreEmber.bearing(hero, target)
	ui.tutorial.text = ("Keeper: Speak their names when you reach the light." if final_gate else TrialPassage.ENCOUNTERS[passage.stage + 1].rest_hint)
	ui.tutorial.show()
	ui.tutorial.modulate.a = 1
	var action := "Step into dawn" if final_gate else "Call " + next_name
	ui.interact_text.text = ("Tap " + ("Cross" if final_gate else "Call") if ui.touch_preferred else ui.play_prompt("{interact} · " + action)) if near_waystone() else ""
	ui.status.text = "Passage remembered" if final_gate else ("Next encounter saved" if ui.main.journey else "Practice court")
	if ui.main.journey and not Session.shore.last_error.is_empty(): ui.status.text = Session.shore.last_error

func cross_waystone() -> void:
	if not is_instance_valid(waystone) or ui.mode != "play" or not Session.running:
		crossing = false
		return
	if passage.training(): ui.main.enter_next_echo(passage.stage + 1)
	else:
		if ui.main.journey: Session.shore.remember(ShoreProgress.DAWN, ui.main.trained_on_shore)
		ui.show_dawn()

func save_current() -> void:
	# Shore checkpoints are recorded when a lesson or encounter is completed.
	pass

func _enemy_died(_enemy: Fighter) -> void:
	queue_outcome()

func _hero_died(_fighter: Fighter) -> void:
	hero.velocity=Vector3.ZERO
	queue_outcome()

func queue_outcome() -> void:
	if outcome_pending or duel.finished: return
	outcome_pending=true
	call_deferred("resolve_outcome")

func resolve_outcome() -> void:
	outcome_pending=false
	# Resolve both actors after the physics step, including a simultaneous fall.
	won=warden.model.health<=0 and hero.model.health>0
	duel.finished=true
	result_delay = 1.65 if won and passage.training() else 2.6
	if won:
		ui.main.remember_victory(passage.stage)
		ui.announce("ECHO OVERCOME" if passage.training() else "VOW KEPT")
		Sound.play("reward")
