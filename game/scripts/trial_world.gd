class_name TrialWorld
extends ChapterWorld

var arrival: TrialArrival
var court_camera: Camera3D
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
var passage: TrialPassage=TrialPassage.new()
var hud_text_time: float=0

func _ready() -> void:
	rng.seed=7251
	ui.trial_layout(true)
	build_court()
	CourtArt.dress(self)
	CourtArchitecture.dress(self)
	batch_scenery()
	north_gate = ShoreGate.new()
	north_gate.position = Vector3(0, 0, -11.3)
	add_child(north_gate)
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
	ui.help_caption.text=Preferences.prompt("{journal} Trial guide · {pause} Pause")

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
	if stage == 0 and trained: passage.learn("rehearsal")
	if trained or stage > 0: hero.target = warden
	boss_title.text = passage.entry().name
	boss_bar.value = 100
	boss_echo.value = 100
	composure_bar.value = 0
	hud_text_time = 0
	ui.interact_text.text = ""
	ui.threat_text.text = ""

func begin_arrival() -> void:
	arrival = TrialArrival.new()
	arrival.world = self
	add_child(arrival)
	boss_panel.hide()

func frame_court() -> void:
	if court_camera == null:
		court_camera = Camera3D.new()
		court_camera.fov = 56
		add_child(court_camera)
	court_camera.position = Vector3(6.4, 3.5, 8.4)
	court_camera.look_at(Vector3(-2.8, 1.15, 2.5))
	court_camera.make_current()

func _exit_tree() -> void:
	if is_instance_valid(boss_panel): boss_panel.queue_free()
	if is_instance_valid(ui): ui.trial_layout(false)

func build_court() -> void:
	var atmosphere=WorldEnvironment.new()
	var panorama=PanoramaSkyMaterial.new()
	panorama.panorama=load("res://assets/court/sunset_forest.hdr")
	var sky=Sky.new(); sky.sky_material=panorama
	atmosphere.environment=ArtDirection.environment("fortress", sky)
	atmosphere.environment.background_energy_multiplier=.55
	atmosphere.environment.fog_density=.006
	atmosphere.environment.fog_sky_affect=.26
	atmosphere.environment.fog_light_color=Color("8c9c9c")
	atmosphere.environment.ambient_light_energy=.38
	add_child(atmosphere)
	sun=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-24,-47,0)
	sun.light_color=Color("f3cf9f")
	sun.light_energy=1.55
	sun.shadow_enabled=Preferences.shadows
	sun.directional_shadow_max_distance=35
	add_child(sun)
	var fill=DirectionalLight3D.new()
	fill.rotation_degrees=Vector3(-40,130,0)
	fill.light_color=Color("95b4d3")
	fill.light_energy=.32
	add_child(fill)
	var floor=solid_box(Vector3(30,.5,30),Vector3(0,-.26,0),Color("777975"))
	for mesh in floor.get_children():
		if mesh is MeshInstance3D: SurfaceLibrary.apply(mesh,"stone",Color("777975"),.65)
	# Closely fitted stone slabs, with a level collision surface for readable feet.
	for x in range(-5,6):
		for z in range(-5,6):
			var tile=Figure.box(self,Vector3(1.97,.025,1.97),Vector3(x*2,.002,z*2),Color("85867d").darkened(rng.randf_range(0,.14)))
			SurfaceLibrary.apply(tile,"stone",tile.material_override.albedo_color,.8)
	for i in 40:
		if i == 20: continue # The openable north gate occupies this section.
		var angle=TAU*i/40
		var point=Vector3(sin(angle)*12,0,cos(angle)*12)
		var wall=solid_box(Vector3(1.95,1.2,.65),point+Vector3.UP*.6,Color("686b69"))
		wall.rotation.y=angle
		var cap=Figure.box(self,Vector3(2.0,.16,.83),point+Vector3.UP*1.25,Color("95958a"))
		cap.rotation.y=angle
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
			var lamp=OmniLight3D.new(); lamp.position=base+Vector3.UP*2.8
			lamp.light_color=Color("ffb56b"); lamp.light_energy=1.2; lamp.omni_range=5; add_child(lamp)
			var bowl=Figure.cylinder(pillar,.16,.27,.18,Vector3.UP*3.65,Color("393f3e"),20)
			var fire=StandardMaterial3D.new(); fire.albedo_color=Color("efba79"); fire.emission_enabled=true; fire.emission=Color("ef9a51"); fire.emission_energy_multiplier=1.4
			bowl.material_override=fire
	for side in [-1,1]:
		for x in [-2.2,2.2]: solid_box(Vector3(.75,3,.9),Vector3(x,1.5,side*11),Color("727a72"))

func _process(delta: float) -> void:
	if not Session.running or hero==null: return
	elapsed+=delta
	Sound.context("zone_copper_stair",arrival == null and not won,ui.mode!="play",true)
	if waystone != null and ui.mode == "play":
		if north_gate.open and not crossing and hero.position.z < -12.7 and absf(hero.position.x) < 1.1:
			crossing = true
			call_deferred("cross_waystone")
		hud_text_time -= delta
		if hud_text_time <= 0:
			hud_text_time = .10
			refresh_waystone()
		return
	if arrival != null and ui.mode == "play":
		ui.update_hud(hero, {})
		hud_text_time -= delta
		if hud_text_time <= 0:
			hud_text_time = .12
			arrival.refresh_hud()
		return
	if result_delay >= 0 and ui.mode == "play":
		result_delay -= delta
		if result_delay < 0:
			if won and (passage.training() or ui.main.journey): light_waystone()
			else: ui.show_trial_result(won)
			return
	if ui.mode=="play":
		if not passage.training() and warden.phase==1 and warden.model.health<warden.model.max_health*.5 and warden.model.can_begin():
			warden.phase=2
			for id in ["light","trial_second","trial_finish","heavy"]:
				var attack: Dictionary=warden.model.config.attacks[id]
				attack.rate*=1.12
				for part in ["windup","active","recovery"]: attack[part]/=1.12
			ui.announce("THE LAST EMBER")
			ui.toast("The Warden quickens. Keep enough stamina to escape.",4)
			duel.phase_changed()
		ui.update_hud(hero,{})
		hud_text_time-=delta
		if hud_text_time<=0:
			hud_text_time=.1
			ui.chapter_label.text=passage.entry().chapter
			ui.objective_text.text="Defeat the echo to continue.\nHealth refills after this encounter." if passage.training() else "Defeat the Cinder Warden.\nEarn passage back to the living."
			ui.tutorial.text=ui.play_prompt(passage.hint(self))
			if ui.touch_preferred: ui.help_caption.text = "Menu · Trial guide and settings"
			ui.status.text="%d HP · %d draughts" % [hero.model.health,Session.data.heals]
			if hero.model.posture>=30: ui.status.text+="\nGuard strain %d%%" % hero.model.posture
		composure_bar.value=duel.composure
		composure_label.text="OPEN - RIPOSTE" if duel.riposte_window>0 else "COMPOSURE"
		if duel.riposte_window>0:
			ui.threat_text.text=Preferences.prompt("{heavy} RIPOSTE" if duel.can_riposte() else "COMPOSURE BROKEN - close the distance")
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

func light_waystone() -> void:
	hero.target = null
	warden.hide()
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

func refresh_waystone() -> void:
	ui.update_hud(hero, {})
	boss_panel.hide()
	ui.threat_text.text = ""
	var final_gate := not passage.training()
	var next_name := "the gate" if final_gate else str(TrialPassage.ENCOUNTERS[passage.stage + 1].name).capitalize()
	ui.chapter_label.text = "THE ROAD TO DAWN" if final_gate else "A MOMENT AT THE EMBER"
	ui.objective_panel.show()
	ui.objective_text.text = ("Walk through the north gate." if final_gate else "Return to the ember for " + next_name + ".") + "\n" + ShoreEmber.bearing(hero, waystone.global_position)
	ui.tutorial.text = ("Keeper: Speak their names when you reach the light." if final_gate else TrialPassage.ENCOUNTERS[passage.stage + 1].rest_hint)
	ui.tutorial.show()
	ui.tutorial.modulate.a = 1
	var action := "Step into dawn" if final_gate else "Call " + next_name
	ui.interact_text.text = ("Tap " + ("Cross" if final_gate else "Call") if ui.touch_preferred else Preferences.prompt("{interact} / A · " + action)) if near_waystone() else ""
	ui.status.text = "Passage remembered" if final_gate else ("Next encounter saved" if ui.main.journey else "Practice court")
	if ui.main.journey and not Session.shore.last_error.is_empty(): ui.status.text = Session.shore.last_error

func cross_waystone() -> void:
	if not is_instance_valid(waystone) or ui.mode != "play" or not Session.running:
		crossing = false
		return
	if passage.training(): ui.main.enter_next_echo(passage.stage + 1)
	else: ui.show_dawn()

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
