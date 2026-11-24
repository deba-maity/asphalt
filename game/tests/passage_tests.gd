extends Node

var main: Node
var checks=0
var failures=0
var campaign_before: String

func _ready() -> void: call_deferred("run")
func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)
func frames(count: int) -> void:
	for i in count: await get_tree().process_frame
func seconds(value: float) -> void:
	for i in int(ceil(value*Engine.physics_ticks_per_second)): await get_tree().physics_frame
func button_named(fragment: String) -> Button:
	for item in main.ui.overlay.find_children("*","Button",true,false):
		if fragment in item.text: return item
	return null
func check_layout(label: String) -> void:
	var valid=true
	for item in main.ui.overlay.find_children("*","Button",true,false):
		var rect: Rect2=item.get_global_rect()
		valid=valid and rect.position.x>=0 and rect.position.y>=0 and rect.end.x<=1281 and rect.end.y<=721
	check(valid,label)

func touch(index: int, point: Vector2, pressed: bool) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = point
	event.pressed = pressed
	get_viewport().push_input(event, true)

func begin_again() -> void:
	if button_named("Begin journey again") != null:
		button_named("Begin journey again").pressed.emit()
		button_named("Revisit the opening").pressed.emit()
	else: button_named("Begin journey").pressed.emit()

func tap_at(point: Vector2) -> void:
	touch(4, point, true)
	touch(4, point, false)

func test_prompt_switching() -> void:
	var pad := InputEventJoypadMotion.new()
	pad.axis = JOY_AXIS_LEFT_X
	pad.axis_value = .14
	get_viewport().push_input(pad, true)
	check(main.ui.touch_preferred, "Small controller drift keeps the active touch controls")
	pad.axis_value = .8
	get_viewport().push_input(pad, true)
	check(main.ui.controller_preferred and not main.ui.touch_controls.visible and main.ui.play_prompt("{guard} / {dodge}") == "LB / B", "Using the controller shows its guard and dodge buttons")
	var key := InputEventKey.new()
	key.physical_keycode = KEY_T
	key.pressed = true
	get_viewport().push_input(key, true)
	check(not main.ui.controller_preferred and main.ui.play_prompt("{guard}") == Preferences.label_for("guard"), "A physical key restores the player's rebound keyboard prompts")
	tap_at(Vector2(630, 315))
	check(main.ui.touch_preferred and main.ui.play_prompt("{guard} / {dodge}") == "Guard / Roll", "A real tap restores touch prompts and controls")

func test_touch_sparring() -> void:
	var court: TrialWorld = main.world
	var hero := court.hero
	var mentor := court.warden
	var saved := Session.shore.milestone
	tap_at(TrialTouch.BUTTONS.spar[0])
	var drill := court.arrival.sparring
	check(drill != null and hero.target == mentor, "Spar opens a safe drill with a locked, moving opponent")
	if drill == null: return
	await seconds(4.5)
	check(mentor.model.swing_serial > 0 and drill.phase == drill.Phase.GUARD and hero.model.health == hero.model.max_health, "Taking a real practice cut unharmed does not earn a guard")
	touch(3, TrialTouch.BUTTONS.guard[0], true)
	for frame in range(Engine.physics_ticks_per_second * 9):
		await get_tree().physics_frame
		if drill.phase != drill.Phase.GUARD: break
	touch(3, TrialTouch.BUTTONS.guard[0], false)
	check(drill.phase == drill.Phase.EVADE, "Holding the touch guard through a frontal blade contact earns the guard")
	var attempted := false
	for frame in range(Engine.physics_ticks_per_second * 15):
		await get_tree().physics_frame
		if not drill.swinging: attempted = false
		if drill.phase != drill.Phase.EVADE: break
		if not attempted and drill.swinging and mentor.model.state == "attack" and mentor.model.elapsed >= float(mentor.model.attack.windup) - .18:
			attempted = true
			tap_at(TrialTouch.BUTTONS.dodge[0])
	check(drill.phase == drill.Phase.ANSWER, "A timed touch roll clears the actual raised blade")
	main.ui.show_trial_guide()
	check(button_named("Return to sparring") != null and get_tree().paused, "The guide pauses sparring and offers the same encounter")
	button_named("Return to sparring").pressed.emit()
	hero.use_test_direction = true
	for frame in range(Engine.physics_ticks_per_second * 22):
		await get_tree().physics_frame
		if drill.phase != drill.Phase.ANSWER: break
		var toward := mentor.position - hero.position
		toward.y = 0
		hero.test_direction = toward.normalized() if toward.length() > 1.4 else Vector3.ZERO
		if drill.cue() == "ROLL NOW" and hero.model.can_begin():
			hero.test_direction = Vector3(-toward.z, 0, toward.x).normalized()
			tap_at(TrialTouch.BUTTONS.dodge[0])
		if drill.opening and toward.length() < 1.8 and hero.model.can_begin():
			tap_at(TrialTouch.BUTTONS.light[0])
	hero.use_test_direction = false
	check(drill.phase == drill.Phase.COMPLETE and mentor.model.health == mentor.model.max_health, "A real counterstrike during recovery completes the drill without hurting the echo")
	check(Session.shore.milestone == saved and court.duel.attacks_started == 0, "Practice keeps the saved lesson and battle statistics intact")
	check(main.ui.touch_controls.actions() == ["begin", "pause"], "Touch offers an exit after the timing drill")
	test_prompt_switching()

func test_touch_lesson() -> void:
	main.ui.show_menu()
	touch(0, Vector2(1100, 300), true)
	touch(0, Vector2(1100, 300), false)
	begin_again()
	await frames(4)
	button_named("Accept the cost").pressed.emit()
	await seconds(.35)
	var controls: TrialTouch = main.ui.touch_controls
	check(not main.ui.help_caption.visible, "Touch removes the duplicate footer menu hint")
	check(main.ui.touch_preferred and controls.is_visible_in_tree(), "Touch input enables the trial pad")
	var forward := TrialTouch.PAD + Vector2.UP * 63
	touch(1, forward, true)
	await seconds(1.0)
	touch(1, forward, false)
	await seconds(.3)
	check(main.world.arrival.near_ember(), "The touch pad walks to the memorial")
	var use: Vector2 = TrialTouch.BUTTONS.interact[0]
	touch(2, use, true)
	touch(2, use, false)
	check(main.world.warden.visible, "Touch Listen reveals the echo")
	var lock: Vector2 = TrialTouch.BUTTONS.lock_on[0]
	touch(2, lock, true)
	touch(2, lock, false)
	check(main.player.target == main.world.warden, "Touch Lock acquires the echo")
	touch(1, forward, true)
	await seconds(.65)
	touch(1, forward, false)
	await seconds(.2)
	var strike: Vector2 = TrialTouch.BUTTONS.light[0]
	touch(2, strike, true)
	touch(2, strike, false)
	await seconds(1.4)
	check(main.world.arrival.step == TrialArrival.Step.GUARD, "Touch Strike lands a real practice hit")
	var guard: Vector2 = TrialTouch.BUTTONS.guard[0]
	touch(1, TrialTouch.PAD + Vector2.RIGHT * 32, true)
	touch(2, guard, true)
	await seconds(.58)
	check(main.world.arrival.step == TrialArrival.Step.DODGE, "Guard and movement work with two fingers")
	touch(2, guard, false)
	touch(1, forward, false)
	check(not Input.is_action_pressed("guard") and controls.stick == Vector2.ZERO, "Touch releases clear guard and movement")
	var roll: Vector2 = TrialTouch.BUTTONS.dodge[0]
	touch(3, roll, true)
	touch(3, roll, false)
	await seconds(.8)
	check(main.world.arrival.step == TrialArrival.Step.READY, "Touch Roll completes practice")
	await test_touch_sparring()
	tap_at(TrialTouch.BUTTONS.begin[0])
	await frames(6)
	check(main.world.arrival == null and main.world.passage.learned.has("rehearsal"), "Touch Begin starts a fresh fight and remembers the rehearsal")
	await seconds(.3)
	touch(1, forward, true)
	check(controls.stick.length() > .9 and not Input.is_action_pressed("sprint"), "Touch movement inside the rim walks")
	touch(1, forward, false)
	touch(1, TrialTouch.PAD + Vector2.UP * 93, true)
	check(Input.is_action_pressed("sprint"), "Reaching past the movement rim sprints with the same thumb")
	touch(3, TrialTouch.BUTTONS.pause[0], true)
	await frames(2)
	check(main.ui.mode == "pause" and controls.fingers.is_empty() and controls.stick == Vector2.ZERO and not Input.is_action_pressed("sprint"), "Pausing clears the held movement, sprint and every finger")
	main.ui.show_menu()
	begin_again()
	await frames(4)
	button_named("Accept the cost").pressed.emit()
	await frames(4)
	main.ui.show_trial_guide()
	button_named("Skip practice").pressed.emit()
	await frames(6)
	check(main.trial_stage == 0 and main.world.arrival == null and not main.world.passage.learned.has("rehearsal"), "The guide can skip rehearsal and keeps first-time fight hints")

func run() -> void:
	if "--passage-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	Session.shore = ShoreProgress.new("user://passage_validation/counting_shore")
	main.ui.show_menu()
	var original_store=Session.store
	var before_path=Session.store.directory+"progress.json"
	campaign_before=FileAccess.get_file_as_string(before_path) if FileAccess.file_exists(before_path) else ""
	var base=CombatModel.definitions().duplicate(true)
	var attack_before=CombatModel.new(); PerformanceMotion.configure(attack_before,true)
	check(not main.world.warden.visible and main.world.court_camera.current, "Title frames the quiet court")
	begin_again()
	await frames(4)
	check(main.trial_stage==0 and main.world.passage.training(),"Begin journey opens the Counting Shore")
	check(main.ui.mode=="trial_briefing" and get_tree().paused,"Story is readable before any combat runs")
	check(button_named("Accept the cost")!=null,"The return's cost has an explicit acceptance button")
	check_layout("Opening story buttons fit the viewport")
	var frozen_clock=main.player.figure.cape.clock
	await frames(8)
	check(main.player.figure.cape.clock==frozen_clock,"Briefing suspends cloth and character simulation")
	button_named("Accept the cost").pressed.emit()
	await frames(5)
	check(main.ui.objective_panel.is_visible_in_tree() and main.ui.objective_panel.is_ancestor_of(main.ui.tutorial), "Practice controls are readable within the objective panel")
	check(not main.ui.toast_label.get_global_rect().intersects(main.ui.objective_panel.get_global_rect()), "Keeper dialogue leaves the current lesson uncovered")
	check(main.ui.mode=="play" and not get_tree().paused and main.world.can_play(),"Accepting the story returns control to the player")
	check(Session.shore.milestone == ShoreProgress.SHORE, "The journey begins saving after accepting the offer")
	var arrival: TrialArrival = main.world.arrival
	var trainee: Fighter = main.player
	var echo: Fighter = main.world.warden
	check(not echo.visible and not echo.ai_enabled and main.world.enemies.is_empty(), "Arrival has no visible or targetable enemy")
	check(trainee.camera.current and not main.world.boss_panel.visible, "Entering the shore restores the player camera and hides the boss bar")
	main.world.interact()
	check(arrival.step==TrialArrival.Step.EMBER, "The ember must be approached")
	trainee.use_test_direction=true
	trainee.test_direction=Vector3.FORWARD
	await seconds(1.1)
	trainee.test_direction=Vector3.ZERO
	await seconds(.3)
	check(arrival.near_ember(), "Normal walking reaches the ember from spawn")
	main.world.interact()
	check(echo.visible and not echo.ai_enabled and arrival.step==TrialArrival.Step.LOCK, "Listening manifests a peaceful echo")
	var waiting_at = echo.position
	await seconds(6)
	check(trainee.model.health==100 and echo.position.distance_to(waiting_at)<.1 and echo.model.swing_serial==0, "Waiting past the old attack timer never starts combat")
	main.ui.show_pause()
	main.ui.play()
	await seconds(.3)
	trainee.toggle_target()
	check(trainee.target==echo and arrival.step==TrialArrival.Step.STRIKE, "Lock lesson accepts an acquired target")
	trainee.try_attack("light")
	await seconds(1.4)
	check(arrival.step==TrialArrival.Step.STRIKE, "Swinging out of reach does not complete the lesson")
	trainee.test_direction=Vector3.FORWARD
	await seconds(.54)
	trainee.test_direction=Vector3.ZERO
	await seconds(.35)
	trainee.try_attack("light")
	await seconds(1.8)
	check(arrival.step==TrialArrival.Step.GUARD and echo.model.health==echo.model.max_health, "A real blade contact advances practice without harming the echo")
	Input.action_press("guard")
	await seconds(.55)
	Input.action_release("guard")
	await seconds(.2)
	check(arrival.step==TrialArrival.Step.DODGE, "Holding guard earns the next instruction")
	trainee.try_dodge()
	await seconds(1.2)
	check(arrival.step==TrialArrival.Step.READY and not echo.ai_enabled, "Rolling completes the lesson and combat still waits")
	main.world.interact()
	await frames(5)
	check(main.world.arrival==null and main.world.warden.ai_enabled and main.trial_stage==0, "Explicit challenge begins the first echo")
	check(main.player.model.stamina==100 and main.player.model.health==100, "Practice hands off with full health and stamina")
	var court_id: int = main.world.get_instance_id()
	var traveler_id: int = main.player.get_instance_id()
	for stage in 4:
		check(main.trial_stage == stage and main.ui.mode == "play", "The next opponent appears directly in play: " + str(stage))
		check(main.world.get_instance_id() == court_id and main.player.get_instance_id() == traveler_id, "The court and player stay installed across an encounter: " + str(stage))
		var world: TrialWorld=main.world
		var boss: Fighter=world.warden
		boss.ai_enabled=false
		check(world.passage.stage==stage and boss.model.max_health==TrialPassage.ENCOUNTERS[stage].health,"Authored health ramp: "+str(stage))
		check(world.hero.model.health==100 and Session.data.heals==3,"Health and draughts refill at encounter start: "+str(stage))
		check(world.passage.patterns(1).size()>0,"Every encounter has a usable attack pattern: "+str(stage))
		var attack: Dictionary=boss.model.config.attacks.heavy
		var original: Dictionary=attack_before.config.attacks.heavy
		check(is_equal_approx(attack.damage,original.damage*TrialPassage.ENCOUNTERS[stage].damage),"Lesson damage follows the intended gentle ramp: "+str(stage))
		check(is_equal_approx(PerformanceMotion.clip_time(attack,attack.windup),PerformanceMotion.clip_time(original,original.windup)),"Slower lessons preserve authored blade-contact time: "+str(stage))
		check(boss.model.config.attacks.trial_finish.hit_windows==attack_before.config.attacks.trial_finish.hit_windows,"Multi-cut clip windows are not double-scaled: "+str(stage))
		if stage==1:
			var advice := world.passage.hint(world)
			var was_touch: bool = main.ui.touch_preferred
			main.ui.touch_preferred = true
			check(main.ui.play_prompt(advice) == "Hold Guard for a normal cut. Use Roll for a raised cleave.", "Touch advice names each defensive button once and explains when to use it")
			main.ui.touch_preferred = false
			var keyboard_advice := "Hold %s for a normal cut. Use %s for a raised cleave." % [Preferences.label_for("guard"), Preferences.label_for("dodge")]
			check(main.ui.play_prompt(advice) == keyboard_advice, "Keyboard advice displays the current guard and dodge bindings")
			main.ui.touch_preferred = was_touch
			world.learn("dodge")
			check("Wait for" in world.passage.hint(world),"A defensive action advances the contextual lesson")
			world.hero.model.health=40
			check("draught" in world.passage.hint(world),"Low health surfaces the heal lesson")
			world.hero.model.health=100
		if stage<3:
			boss.model.health=boss.model.max_health*.4
			await frames(4)
			check(boss.phase==1,"Easy echoes never acquire the boss's second phase: "+str(stage))
		# Exercise the same deferred outcome callback used by a physical hit.
		boss.model.health=0; boss.model.state="dead"; boss.slain.emit(boss)
		await frames(3)
		check(world.won and world.duel.finished,"A defeated encounter resolves exactly once: "+str(stage))
		var fallen := boss.figure as PerformanceFigure
		fallen.drop_weapon()
		var released_sword: WeakRef = weakref(fallen.dropped_body)
		world.result_delay=.001
		await frames(4)
		check(released_sword.get_ref() == null, "A defeated echo takes its dropped weapon out of the persistent court")
		check(main.ui.mode == "play" and world.can_play() and world.waystone != null, "Victory opens a walkable safe court: " + str(stage))
		check(Session.shore.milestone == ShoreProgress.FIRST_ECHO + stage + 1, "The next checkpoint is saved immediately: " + str(stage))
		check(world.north_gate.open == (stage == TrialPassage.WARDEN) and (world.north_gate.closed_barrier.collision_layer == 0) == world.north_gate.open, "Only the final victory opens a walkable north gate")
		check(world.north_gate.seals[mini(stage,2)].material_override == world.north_gate.lit, "The gate records a defeated echo with a lit seal")
		check(world.hero.target == null and world.enemies.is_empty() and not world.boss_panel.visible, "The defeated opponent leaves the HUD and target list")
		world.hero.position = Vector3(-6, .08, 4)
		world.interact()
		await frames(2)
		check(world.waystone != null and not world.crossing, "Using the waystone from across the court cannot advance")
		if stage == TrialPassage.WARDEN:
			Session.shore.restore()
			check(Session.shore.milestone == ShoreProgress.OPEN_GATE, "The untraveled exit gets its own checkpoint")
			main.ui.show_menu()
			button_named("Continue").pressed.emit()
			await frames(4)
			world = main.world
			check(main.ui.mode == "play" and world.north_gate.open and world.won and not world.warden.visible and world.enemies.is_empty(), "Continue reopens the cleared court with the path to dawn still playable")
			world.hero.position = Vector3(-8.83, .08, -5.1)
			world.hero.use_test_direction = true
			check(world.passage_target().z > world.north_gate.position.z, "The bearing leads a player on the flank to the inner side of the gate")
			for frame in 8 * Engine.physics_ticks_per_second:
				await get_tree().physics_frame
				if main.ui.mode == "dawn": break
				var direction: Vector3 = world.passage_target() - world.hero.global_position
				direction.y = 0
				world.hero.test_direction = direction.normalized()
			if world.hero.position.z >= -12.7:
				print("Gate approach stopped at ", world.hero.position, " state=", world.hero.model.state, " playing=", world.can_play())
				for i in world.hero.get_slide_collision_count():
					var contact: KinematicCollision3D = world.hero.get_slide_collision(i)
					print("Gate approach collider ", contact.get_collider().get_path(), " at ", contact.get_position())
			check(world.hero.position.z < -12.7, "The player can physically walk through the opened north gate")
		else:
			world.hero.position = world.waystone.position + Vector3(.4,.08,.4)
			world.interact()
			world.interact()
		await frames(4)
	check(main.ui.mode == "dawn" and button_named("Return to title") != null, "Walking through the north gate reaches the ending")
	check_layout("Epilogue buttons fit within the viewport")
	var persisted := ShoreProgress.new(Session.shore.directory)
	persisted.restore()
	check(persisted.milestone == ShoreProgress.DAWN and persisted.rehearsed, "A new save reader restores the finished journey and rehearsal")
	main.ui.show_menu()
	button_named("Revisit the ending").pressed.emit()
	check(main.ui.mode == "dawn", "The ending remains available from the title")
	check(CombatModel.definitions()==base,"Tutorial tuning leaves campaign combat definitions untouched")
	# The opening tests above exercise progression. These use the actual animated
	# sword sweep, so a slow lesson cannot silently lose or duplicate its damage.
	for stage in 3:
		main.start_trial(stage,false); await frames(4)
		var hero: Fighter=main.player
		var boss: Fighter=main.world.warden
		hero.use_test_direction=true; boss.ai_enabled=false
		for attack_id in ["light","heavy"]:
			hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO
			boss.position=Vector3(0,.05,-1.55); boss.rotation.y=PI; boss.velocity=Vector3.ZERO
			hero.model.state="idle"; hero.model.health=100; hero.impact_pause=0
			boss.model.state="idle"; boss.model.stamina=100; boss.impact_pause=0
			await seconds(.3)
			var contacts=boss.weapon_sweep.contacts
			boss.model.start_attack(attack_id)
			await seconds(3.8)
			var damage=100-hero.model.health
			print("LESSON CONTACT stage=",stage," attack=",attack_id," damage=",damage)
			check(boss.weapon_sweep.contacts-contacts==1,"Slowed lesson blade contacts once: "+str(stage)+" / "+attack_id)
			check(absf(damage-float(boss.model.config.attacks[attack_id].damage))<.01,"Slowed lesson damage matches its visible contact: "+str(stage)+" / "+attack_id)
	main.start_trial(1,false); await frames(4)
	main.world.warden.ai_enabled=false
	main.player.model.health=0; main.player.model.state="dead"; main.player.slain.emit(main.player)
	await frames(3); main.world.result_delay=.001; await frames(4)
	button_named("Retry this encounter").pressed.emit(); await frames(4)
	check(main.trial_stage==1 and main.world.can_play() and main.player.model.health==100,"A loss retries the current lesson without replaying earlier fights")
	main.world.warden.ai_enabled=false
	var tick_rate=Engine.physics_ticks_per_second
	Preferences.display_preset("cool"); Preferences.apply()
	main.budget.update_policy()
	check(Engine.max_fps==30 and Preferences.render_height==540 and not Preferences.shadows and Preferences.antialiasing==0,"Lower-power preset bounds rendering cost")
	check(Engine.physics_ticks_per_second==tick_rate,"Display presets do not change combat simulation frequency")
	Preferences.display_preset("balanced"); Preferences.apply()
	main.ui.show_pause(); main.budget.update_policy()
	check(main.budget.idle and Engine.max_fps==30 and main.world.process_mode==Node.PROCESS_MODE_DISABLED,"Pause suspends scene work and caps menu updates")
	frozen_clock=main.player.figure.cape.clock; await frames(10)
	check(main.player.figure.cape.clock==frozen_clock,"Paused cloth does not continue spending simulation time")
	main.budget.focused=false; main.budget.update_policy()
	check(Engine.max_fps==10 and OS.low_processor_usage_mode,"Unfocused window uses a ten-FPS idle budget")
	main.budget.focused=true; main.ui.play(); main.budget.update_policy()
	check(Engine.max_fps==60 and not OS.low_processor_usage_mode and main.world.process_mode==Node.PROCESS_MODE_INHERIT,"Resume restores the selected render cap and scene processing")
	await frames(10)
	check(main.player.figure.cape.clock>frozen_clock,"Cloth simulation resumes without a stuck world")
	main.ui.show_menu(); await frames(4); check_layout("Title menu includes both entry routes within the viewport")
	check(Session.store==original_store,"Leaving the passage restores the campaign save store")
	check((FileAccess.get_file_as_string(before_path) if FileAccess.file_exists(before_path) else "")==campaign_before,"The complete passage and retries never overwrite campaign progress")
	button_named("skip lessons").pressed.emit(); await frames(4)
	check(main.trial_stage==3 and main.ui.mode=="play" and main.world.warden.model.max_health==340,"Direct Warden practice remains available")
	check(Session.shore.milestone == ShoreProgress.DAWN and not main.journey, "Direct Warden practice preserves the completed journey")
	await test_touch_lesson()
	await test_checkpoint_resume()
	print("PASSAGE: ",checks," checks, ",failures," failures")
	main.finish(0 if failures==0 else 1)

func test_checkpoint_resume() -> void:
	main.ui.show_menu()
	begin_again()
	button_named("Accept the cost").pressed.emit()
	await frames(4)
	main.player.position = main.world.arrival.memorial.position
	main.world.interact()
	main.player.toggle_target()
	await frames(3)
	var saved := ShoreProgress.new(Session.shore.directory)
	saved.restore()
	check(saved.milestone == ShoreProgress.SHORE + TrialArrival.Step.STRIKE, "Remember the next uncompleted practice action")
	Session.shore = saved
	main.ui.show_menu()
	button_named("skip lessons").pressed.emit()
	await frames(4)
	main.world.warden.model.health = 0
	main.world._enemy_died(main.world.warden)
	await frames(4)
	check(Session.shore.milestone == saved.milestone and Session.shore.milestone == 3, "A direct Warden win cannot advance an unfinished lesson")
	main.ui.show_menu()
	button_named("Continue").pressed.emit()
	await frames(4)
	check(main.world.arrival.step == TrialArrival.Step.STRIKE and main.player.target == main.world.warden and main.world.warden.visible and not main.world.warden.ai_enabled, "Continue restores the safe echo in reach at the correct lesson")
	main.ui.show_trial_guide()
	button_named("Skip practice").pressed.emit()
	await frames(4)
	check(Session.shore.milestone == ShoreProgress.FIRST_ECHO and not Session.shore.rehearsed, "Skipping practice records the fight without granting rehearsal")
	main.world.warden.model.health = 0
	main.world._enemy_died(main.world.warden)
	await frames(4)
	main.ui.show_menu()
	button_named("Continue").pressed.emit()
	await frames(4)
	check(main.ui.objective_panel.is_visible_in_tree() and main.ui.objective_panel.is_ancestor_of(main.ui.tutorial), "Resuming an encounter restores its objective and controls")
	check(main.trial_stage == 1 and main.journey and main.world.arrival == null, "Leaving immediately after victory resumes at the next echo")
	main.player.model.health = 0
	main.player.model.state = "dead"
	main.world._hero_died(main.player)
	await frames(3)
	main.world.result_delay = .001
	main.ui.show_trial_guide()
	await frames(5)
	main.ui.play()
	await frames(5)
	check(main.ui.mode == "trial_result", "Reading the guide during defeat cannot consume the retry screen")
	check(button_named("Retry") != null, "A direct retry stays available after defeat")
	button_named("Practice guard and dodge").pressed.emit()
	await frames(4)
	check(main.world.arrival.from_retry and main.world.arrival.sparring != null and Session.shore.milestone == ShoreProgress.FIRST_ECHO + 1, "Defeat practice stays on the current echo without overwriting the checkpoint")
	main.ui.show_trial_guide()
	button_named("Begin encounter").pressed.emit()
	await frames(5)
	check(main.world.arrival == null and main.world.hero.target == main.world.warden and main.world.hero.model.health == main.world.hero.model.max_health, "Leaving defeat practice restores the same opponent and full health")
	check(main.trial_stage == 1 and main.journey and Session.shore.milestone == ShoreProgress.FIRST_ECHO + 1, "Retry replaces only the current encounter")
	main.ui.show_menu()
	button_named("Begin journey again").pressed.emit()
	button_named("Keep my checkpoint").pressed.emit()
	check(button_named("Continue") != null and Session.shore.milestone == ShoreProgress.FIRST_ECHO + 1, "Cancelling a replay keeps the existing checkpoint")
	var bad := FileAccess.open(Session.shore.directory + "progress.json", FileAccess.WRITE)
	bad.store_string("{invalid")
	bad.close()
	var restored := ShoreProgress.new(Session.shore.directory)
	restored.restore()
	check(restored.milestone == ShoreProgress.FIRST_ECHO and not restored.last_error.is_empty(), "A damaged checkpoint recovers the previous verified backup")
	restored.write({"schema": 1, "milestone": ShoreProgress.OPEN_GATE, "rehearsed": true})
	restored.restore()
	check(restored.milestone == ShoreProgress.DAWN and restored.rehearsed, "An existing completed journey still opens its epilogue")
	restored.write({"schema": 1, "milestone": ShoreProgress.FIRST_ECHO + 1, "rehearsed": false})
	restored.restore()
	check(restored.milestone == ShoreProgress.FIRST_ECHO + 1 and not restored.rehearsed, "Existing unfinished journeys retain their exact encounter")
	check(not restored.accepts({"schema":1, "milestone":2.5, "rehearsed":false}) and not restored.accepts({"schema":1,"milestone":100,"rehearsed":true}), "Invalid checkpoint indices cannot index the lesson list")
