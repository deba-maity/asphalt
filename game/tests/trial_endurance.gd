extends Node

# Real-time headless soak: bounded animation/FX allocations and repeated rematch
# teardown. Health refills are explicit stress fixtures, not a balance playtest.
var main: Node
var started: int
var last_report: int=0
var last_match: float=0
var next_action: float=0
var duration: float=10800
var matches: int=0
var actions: int=0
var baseline_nodes: int=0
var baseline_memory: int=0
var peak_memory: int=0
var failures: int=0
var records: Array=[]
var rng=RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed=85171
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--endurance-seconds="): duration=float(arg.split("=")[1])
	started=Time.get_ticks_msec()
	main.start_trial()
	main.player.use_test_direction=true
	print("ENDURANCE START duration=",duration," seconds; headless real-time stress fixture")

func _process(delta: float) -> void:
	var elapsed=(Time.get_ticks_msec()-started)/1000.0
	var hero: Fighter=main.player
	var boss: Fighter=main.world.warden
	if elapsed-last_match>120 or hero.model.state=="dead" or boss.model.state=="dead":
		Input.action_release("guard")
		main.start_trial()
		main.player.use_test_direction=true
		last_match=elapsed; matches+=1
		return
	hero.model.health=maxf(hero.model.health,70)
	boss.model.health=maxf(boss.model.health,100)
	hero.model.stamina=maxf(hero.model.stamina,50)
	var diff=boss.position-hero.position; diff.y=0
	hero.test_direction=diff.normalized() if diff.length()>2.3 else Vector3(-diff.z,0,diff.x).normalized()*.7
	if hero.position.length()>9: hero.test_direction=-hero.position.normalized()
	next_action-=delta
	if next_action<=0:
		next_action=rng.randf_range(.2,.6)
		Input.action_release("guard")
		var choice=rng.randi_range(0,6)
		if choice<3: hero.queue_intent("light")
		elif choice==3: hero.queue_intent("heavy")
		elif choice==4: hero.queue_intent("dodge")
		elif choice==5: Input.action_press("guard")
		else:
			hero.model.health=50; Session.data.heals=3; hero.queue_intent("heal")
		actions+=1
	if int(elapsed)/60>last_report:
		last_report=int(elapsed)/60
		var nodes=int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
		var memory=int(Performance.get_monitor(Performance.MEMORY_STATIC))
		peak_memory=maxi(peak_memory,memory)
		if baseline_nodes==0 and elapsed>=180:
			baseline_nodes=nodes; baseline_memory=memory
		if baseline_nodes>0 and (nodes>baseline_nodes+12 or memory>baseline_memory+64*1024*1024): failures+=1
		var record={"seconds":elapsed,"matches":matches,"actions":actions,"nodes":nodes,"memory":memory,"failures":failures}
		records.append(record)
		print("ENDURANCE ",JSON.stringify(record))
		write_report(elapsed,false)
	if elapsed>=duration:
		Input.action_release("guard")
		write_report(elapsed,true)
		print("RESULT: endurance complete seconds=",elapsed," matches=",matches," actions=",actions," failures=",failures)
		set_process(false)
		main.finish(1 if failures else 0)

func write_report(elapsed: float, complete: bool) -> void:
	var file=FileAccess.open("user://endurance-report.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"complete":complete,"seconds":elapsed,"requested_seconds":duration,"matches":matches,"actions":actions,"failures":failures,"peak_memory":peak_memory,"samples":records},"  "))
