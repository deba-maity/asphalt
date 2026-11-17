class_name TrialWorld
extends ChapterWorld

var warden: Fighter
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

func _ready() -> void:
	rng.seed=7251
	ui.trial_layout(true)
	build_court()
	CourtArt.dress(self)
	batch_scenery()
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
	warden=Fighter.new()
	warden.use_performance=true
	warden.kind="still_warden"
	warden.world=self
	warden.position=Vector3(0,.08,-3.5)
	warden.rotation.y=PI
	warden.ai_cooldown=1.4
	add_child(warden)
	warden.slain.connect(_enemy_died)
	enemies.append(warden)
	hero.target=warden
	duel=TrialDuel.new(self)
	coordinator=EncounterCoordinator.new()
	coordinator.world=self
	add_child(coordinator)
	boss_panel=ui.panel(ui.hud,Vector2(370,584),Vector2(540,80),Color(.045,.055,.06,.4))
	var column=ui.column(boss_panel,4)
	var title=ui.text(column,"THE CINDER WARDEN",17,ui.GOLD)
	title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
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

func _exit_tree() -> void:
	if is_instance_valid(boss_panel): boss_panel.queue_free()
	if is_instance_valid(ui): ui.trial_layout(false)

func build_court() -> void:
	var atmosphere=WorldEnvironment.new()
	atmosphere.environment=ArtDirection.environment("fortress")
	var panorama=PanoramaSkyMaterial.new()
	panorama.panorama=load("res://assets/court/sunset_forest.hdr")
	var sky=Sky.new(); sky.sky_material=panorama
	atmosphere.environment.sky=sky
	atmosphere.environment.background_energy_multiplier=.65
	atmosphere.environment.fog_density=.005
	atmosphere.environment.ambient_light_energy=.52
	add_child(atmosphere)
	sun=DirectionalLight3D.new()
	sun.rotation_degrees=Vector3(-24,-47,0)
	sun.light_color=Color("f3cf9f")
	sun.light_energy=1.8
	sun.shadow_enabled=Preferences.shadows
	sun.directional_shadow_max_distance=35
	add_child(sun)
	var fill=DirectionalLight3D.new()
	fill.rotation_degrees=Vector3(-40,130,0)
	fill.light_color=Color("95b4d3")
	fill.light_energy=.45
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
		for i in 14:
			var angle=PI*float(i)/13
			var block=Figure.box(self,Vector3(.53,.65,.9),Vector3(cos(angle)*2.2,3+sin(angle)*2.2,side*11),Color("858b81"))
			block.rotation.z=angle
		for x in [-2.2,2.2]: solid_box(Vector3(.75,3,.9),Vector3(x,1.5,side*11),Color("727a72"))

func _process(delta: float) -> void:
	if not Session.running or hero==null: return
	elapsed+=delta
	Sound.context("zone_copper_stair",not won,ui.mode!="play",true)
	if result_delay>=0:
		result_delay-=delta
		if result_delay<0 and ui.mode=="play": ui.show_trial_result(won)
	if ui.mode=="play":
		if warden.phase==1 and warden.model.health<warden.model.max_health*.5 and warden.model.can_begin():
			warden.phase=2
			for id in ["light","trial_second","trial_finish","heavy"]:
				var attack: Dictionary=warden.model.config.attacks[id]
				attack.rate*=1.12
				for part in ["windup","active","recovery"]: attack[part]/=1.12
			ui.announce("THE LAST EMBER")
			ui.toast("The Warden quickens. Keep enough stamina to escape.",4)
			duel.phase_changed()
		ui.update_hud(hero,{})
		ui.chapter_label.text="ASHEN TRIAL"
		ui.objective_text.text="Defeat the Cinder Warden.\nWatch the shoulders; punish recovery."
		ui.tutorial.text=Preferences.prompt("{light} Chain strikes · {heavy} Heavy · {guard} Guard / parry · {dodge} Roll · {lock_on} Lock")
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
		ui.tutorial.modulate.a=clampf((12-elapsed)/2,0,1)
		ui.tutorial.visible=elapsed<12
		warden.health_bar.visible=false
		warden.tell_ring.visible=false
	boss_panel.visible=ui.mode=="play"

func _physics_process(delta: float) -> void:
	if duel!=null: duel.tick(delta)

func can_play() -> bool:
	return super.can_play() and not won and result_delay<0

func learn(_action: String) -> void: pass
func interact() -> void: pass
func save_current() -> void: pass # A trial is a fresh duel; campaign persistence is untouched.

func _enemy_died(_enemy: Fighter) -> void:
	queue_outcome()

func _hero_died(_fighter: Fighter) -> void:
	hero.velocity=Vector3.ZERO
	queue_outcome()

func queue_outcome() -> void:
	if outcome_pending or result_delay>=0: return
	outcome_pending=true
	call_deferred("resolve_outcome")

func resolve_outcome() -> void:
	outcome_pending=false
	# Resolve both actors after the physics step, including a simultaneous fall.
	won=warden.model.health<=0 and hero.model.health>0
	duel.finished=true
	result_delay=2.6
	if won:
		ui.announce("VOW KEPT")
		Sound.play("reward")
