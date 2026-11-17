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

func run() -> void:
	if "--passage-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	var original_store=Session.store
	var before_path=Session.store.directory+"progress.json"
	campaign_before=FileAccess.get_file_as_string(before_path) if FileAccess.file_exists(before_path) else ""
	var base=CombatModel.definitions().duplicate(true)
	var attack_before=CombatModel.new(); PerformanceMotion.configure(attack_before,true)
	main.start_trial()
	await frames(4)
	check(main.trial_stage==0 and main.world.passage.training(),"Main Play starts with the first easy echo")
	check(main.ui.mode=="trial_briefing" and get_tree().paused,"Story is readable before any combat runs")
	check(button_named("Accept the cost")!=null,"The return's cost has an explicit acceptance button")
	check_layout("Opening story buttons fit the viewport")
	var frozen_clock=main.player.figure.cape.clock
	await frames(8)
	check(main.player.figure.cape.clock==frozen_clock,"Briefing suspends cloth and character simulation")
	button_named("Accept the cost").pressed.emit()
	await frames(5)
	check(main.ui.mode=="play" and not get_tree().paused and main.world.can_play(),"Accepting the story returns control to the player")
	check(main.world.hero.target==null and main.world.warden.ai_cooldown>0,"First echo allows an approach before attacking")
	for stage in 4:
		if stage>0:
			check(main.trial_stage==stage and main.ui.mode=="trial_briefing","Continue leads to the next encounter in order: "+str(stage))
			button_named("Step into").pressed.emit()
			await frames(4)
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
		world.result_delay=.001
		await frames(4)
		check(main.ui.mode=="trial_result","Victory presents an actionable result: "+str(stage))
		check_layout("Result buttons fit at stage "+str(stage))
		if stage<3: button_named("Continue").pressed.emit(); await frames(4)
	check(button_named("Replay the passage")!=null,"Final victory offers a complete narrative replay")
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
	print("PASSAGE: ",checks," checks, ",failures," failures")
	main.finish(0 if failures==0 else 1)
