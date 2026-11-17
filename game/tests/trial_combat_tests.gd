extends Node

var main: Node
var checks: int=0
var failures: int=0
var tracing: bool=false

func _ready() -> void: call_deferred("run")
func check(value: bool, label: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+label)
func seconds(value: float) -> void:
	for i in int(ceil(value*Engine.physics_ticks_per_second)): await get_tree().physics_frame

func _process(_delta: float) -> void:
	if not tracing or not "--combat-trace" in OS.get_cmdline_user_args(): return
	var hero: Fighter=main.player
	if hero.model.state=="attack" and hero.model.attack_id=="trial_second" and hero.model.elapsed<.5:
		print("BLADE ",JSON.stringify({"time":hero.model.elapsed,"hero":str(hero.position),"target":str(main.world.warden.position),"base":str(hero.weapon_sweep.base),"tip":str(hero.weapon_sweep.tip),"middle":str(hero.weapon_sweep.blade_transform(.5)*Vector3(0,-1,0)),"contacts":hero.weapon_sweep.contacts}))

func run() -> void:
	if "--combat-hz=30" in OS.get_cmdline_user_args(): Engine.physics_ticks_per_second=30
	main.start_trial()
	var hero: Fighter=main.player
	var boss: Fighter=main.world.warden
	hero.use_test_direction=true
	# Let the real encounter AI approach and attack a stationary stress target.
	hero.model.max_health=1000; hero.model.health=1000
	await seconds(.1 if "--combat-cuts-only" in OS.get_cmdline_user_args() else 20)
	print("AI TELEMETRY swings=",boss.model.swing_serial," contacts=",boss.weapon_sweep.contacts," health_lost=",1000-hero.model.health)
	if not "--combat-cuts-only" in OS.get_cmdline_user_args():
		check(boss.model.swing_serial>=3,"Warden approaches and executes its live attack sequence")
		check(hero.model.health<970 and boss.weapon_sweep.contacts>=2,"Warden's visible blade can reach the player from its chosen spacing")
	main.start_trial(); hero=main.player; boss=main.world.warden
	tracing=true
	hero.use_test_direction=true; boss.ai_enabled=false
	var rules=CombatModel.new(); PerformanceMotion.configure(rules)
	rules.start_attack("trial_finish")
	check(not rules.claim_swept_hit(1,.1) and not rules.claim_swept_hit(1,.4),"Swept contacts cannot damage during windup or between finisher cuts")
	rules.elapsed=.7
	check(rules.claim_swept_hit(1,.2) and not rules.claim_swept_hit(1,.21) and rules.claim_swept_hit(1,.65),"Swept contacts retain separate once-only finisher windows")
	rules.state="hit"
	check(not rules.claim_swept_hit(2,.2),"An interrupted attacker cannot claim a swept hit")
	for id in ["light","trial_second","trial_finish","heavy"]:
		hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO
		boss.position=Vector3(0,.05,-1.55); boss.rotation.y=PI
		hero.model.state="idle"; hero.model.stamina=100; hero.impact_pause=0
		boss.model.state="idle"; boss.model.health=340; boss.impact_pause=0
		await seconds(.3)
		var reconstructed=hero.weapon_sweep.blade_transform(1)*Vector3(0,-1,0)
		check(reconstructed.distance_to(hero.weapon_sweep.tip)<.0001,"Sweep joint chain matches the rendered hand: "+id)
		var before=hero.weapon_sweep.contacts
		hero.model.start_attack(id)
		await seconds(2.7)
		var expected=2 if id=="trial_finish" else 1
		var hits=hero.weapon_sweep.contacts-before
		print("CUT ",id," contacts=",hits," damage=",340-boss.model.health)
		check(hits==expected,"Physical blade contacts each authored cut exactly once: "+id)
		check(absf(340-boss.model.health-float(hero.model.config.attacks[id].damage)*expected)<.01,"Visible contact and damage agree: "+id)
	hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO
	boss.position=Vector3(0,.05,-3.8); boss.model.health=340; boss.model.state="idle"
	hero.model.state="idle"; hero.model.stamina=100
	await seconds(.3)
	hero.model.start_attack("light")
	await seconds(1.7)
	check(boss.model.health==340,"An out-of-reach blade does not damage a distant target")
	print("RESULT: %d/%d physical combat checks passed; %d physics ticks" % [checks-failures,checks,Engine.physics_ticks_per_second])
	main.finish(1 if failures else 0)
