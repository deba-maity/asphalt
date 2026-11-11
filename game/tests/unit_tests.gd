extends SceneTree

var failures: int = 0
var checks: int = 0

func check(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		push_error("FAIL: "+message)
	else:
		print("PASS: "+message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var model = CombatModel.new()
	check(model.start_attack("light"),"Light attack starts")
	check(not model.claim_hit(10),"Windup cannot apply damage")
	model.tick(0.17)
	check(model.claim_hit(10),"First hit during active window")
	check(not model.claim_hit(10),"Duplicate physics/event hit refused")
	check(model.claim_hit(11),"One swing can hit a different target")
	check(not model.dodge() and not model.heal() and not model.freeze("talk"),"Attack excludes dodge, heal and dialogue")
	model.tick(1)
	check(model.start_attack("light"),"Recovery returns to idle")
	model.tick(0.17)
	check(model.claim_hit(10),"New swing can hit previous target")
	var stamina = CombatModel.new()
	stamina.stamina = 20
	check(not stamina.start_attack("heavy") and stamina.stamina == 20,"Insufficient stamina cannot start heavy")
	check(stamina.start_attack("light") and stamina.stamina == 4,"Exact stamina cost")
	stamina.tick(0.5)
	check(stamina.stamina == 4,"Stamina does not regenerate during attack")
	stamina.tick(0.2)
	stamina.tick(1)
	check(stamina.stamina > 4 and stamina.stamina <= 100,"Stamina regenerates after recovery")
	var guard = CombatModel.new()
	guard.guard(true)
	check(guard.receive(20) == "parry" and guard.health == 100,"Timed parry blocks health damage")
	guard.tick(0.3)
	check(guard.receive(20) == "guard" and guard.health == 100,"Held guard consumes stamina")
	guard.guard(false)
	guard.dodge()
	guard.tick(0.1)
	check(guard.receive(80) == "ignored","Dodge middle has invulnerability")
	guard.tick(0.3)
	check(guard.receive(20) == "hit","Dodge recovery is vulnerable")
	guard.receive(500)
	check(guard.state == "dead" and not guard.start_attack("light") and not guard.freeze("talk"),"Death excludes attacks and dialogue")
	var store = SaveStore.new("user://unit_tests")
	var data = SaveStore.fresh()
	data.currency = 30
	data.flags.ch01_complete = true
	check(store.write(data),"Safe save write")
	check(store.load_game() == JSON.parse_string(JSON.stringify(data)),"Save/load round trip includes chapter completion")
	data.currency = 22
	check(store.write(data),"Second save retains backup")
	var corrupt = FileAccess.open("user://unit_tests/progress.json",FileAccess.WRITE)
	corrupt.store_string("{broken JSON")
	corrupt.close()
	var recovered = store.load_game()
	check(recovered.currency == 30 and not store.last_error.is_empty(),"Invalid primary recovers valid previous backup")
	var invalid = data.duplicate(true)
	invalid.heals = -1
	check(not store.write(invalid),"Invalid progress is refused")
	invalid = data.duplicate(true)
	invalid.flags = {"x":"executable"}
	check(not SaveStore.valid(invalid),"Invalid flag value is refused")
	invalid = data.duplicate(true)
	invalid.schema = 800
	check(not SaveStore.valid(invalid),"Unknown schema is refused")
	var broken_store = SaveStore.new("user://unit_tests/broken")
	var broken_file = FileAccess.open(broken_store.directory+"progress.json",FileAccess.WRITE)
	broken_file.store_string("not json")
	broken_file.close()
	check(broken_store.load_game().is_empty() and not broken_store.last_error.is_empty(),"Missing valid backup reports damaged save")
	check(broken_store.write(SaveStore.fresh()),"New valid save preserves damaged file")
	var session = root.get_node("Session")
	var old_store = session.store
	session.store = SaveStore.new("user://unit_tests/session")
	session.data = SaveStore.fresh()
	check(session.reward("reward_saren_road",30),"First reward granted")
	check(not session.reward("reward_saren_road",30) and session.data.currency == 30,"Reward is idempotent")
	check(session.purchase("purchase_honeybread",8),"Purchase deducts currency")
	check(not session.purchase("purchase_honeybread",8) and session.data.currency == 22,"Purchase is idempotent")
	session.mark("ch01_complete")
	check(session.store.load_game().flags.ch01_complete,"Chapter completion persists")
	session.store = old_store
	print("RESULT: %d/%d checks passed" % [checks-failures,checks])
	quit(1 if failures else 0)
