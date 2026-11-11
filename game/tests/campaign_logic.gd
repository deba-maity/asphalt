extends SceneTree

var checks: int=0
var failures: int=0

func _initialize() -> void: call_deferred("run")
func check(value: bool, message: String) -> void:
	checks+=1
	if not value: failures+=1
	print(("PASS: " if value else "FAIL: ")+message)

func run() -> void:
	var legacy=SaveStore.fresh()
	legacy.schema=1
	for key in ["objective","bosses","completed_chapters","resurrection","story_deaths","resurrections","ending","credits","resolve","max_heals"]: legacy.erase(key)
	legacy.flags["ch01_complete"]=true
	legacy.flags["evt_family_supper"]=true
	legacy.currency=22
	legacy.purchases=["purchase_honeybread"]
	legacy.rewards=["reward_saren_road"]
	var migrated=SaveStore.migrate(legacy)
	check(SaveStore.valid(migrated) and migrated.currency==22 and migrated.flags.evt_family_supper,"Schema-one migration preserves money and family story")
	check(migrated.completed_chapters==["ch01_bread_steel"] and migrated.purchases==legacy.purchases and migrated.rewards==legacy.rewards,"Migration preserves unique rewards and chapter completion")
	var store=SaveStore.new("user://campaign_logic/migration")
	var file=FileAccess.open(store.directory+"progress.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(legacy)); file.close()
	check(store.load_game().schema==2 and FileAccess.file_exists(store.directory+"progress.schema1.backup.json"),"On-disk migration preserves a schema-one backup before replacement")
	check(store.raw_file(store.directory+"progress.schema1.backup.json").schema==1,"Preserved migration backup remains schema one")
	var future=SaveStore.fresh()
	future.schema=500
	file=FileAccess.open(store.directory+"progress.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(future)); file.close()
	check(store.load_game().is_empty() and store.last_error.contains("newer schema") and store.raw_file(store.directory+"progress.json").schema==500,"Future schema refuses rollback to older backup and leaves files intact")
	for chapter in Campaign.manifest().chapters:
		var state=Campaign.replay_state(chapter.id)
		check(SaveStore.valid(state),"Replay start has compatible canonical state: "+chapter.id)
	var model=CombatModel.new()
	check(not model.ashstep(),"Mortal swordsman cannot Ashstep")
	model.ash_unlocked=true
	check(model.ashstep() and model.resolve==2,"Ashstep spends exactly one Resolve")
	model.tick(.12)
	check(model.receive(30)=="ash_evade" and model.health==100 and model.counter_window>0,"Ashstep evasion protects health and opens a counter")
	model.tick(.5)
	model.resolve=.9
	check(not model.ashstep(),"Resolve shortage blocks repeated Ashstep")
	model.guard(true)
	model.tick(.3)
	check(model.receive(25,true,false,{"blockable":false})=="hit","Unblockable attacks defeat held guard")
	var precise=CombatModel.new()
	precise.guard(true)
	check(precise.receive(20,true,false,{"blockable":false,"parryable":true})=="parry","Parry permission is independent of held-block permission")
	var posture=CombatModel.new()
	posture.guard(true); posture.tick(.3)
	posture.receive(1,true,false,{"posture":60})
	check(posture.receive(1,true,false,{"posture":60})=="hit","Accumulated posture breaks a held guard")
	var session=root.get_node("Session")
	session.store=SaveStore.new("user://campaign_logic/state")
	session.data=Campaign.replay_state("ch03_road_revenge")
	session.apply_arrival("zone_counting_shore","story_death")
	check(session.data.story_deaths==1 and session.data.resurrection=="between" and SaveStore.valid(session.data),"Authored death commits chapter-four checkpoint with canonical state")
	session.apply_arrival("zone_counting_shore","story_death")
	check(session.data.story_deaths==1,"Repeated authored-death commit is idempotent")
	session.data.unlocks.append("ashstep")
	session.apply_arrival("zone_mill_return","resurrection")
	session.apply_arrival("zone_mill_return","resurrection")
	check(session.data.resurrections==1 and session.data.flags.cost_isha_voice and session.data.resurrection=="returned","Canonical resurrection occurs once and preserves its cost")
	check(session.save() and session.store.load_game().zone=="zone_mill_return","Chapter-boundary save/load round trip")
	var body=session.data.duplicate(true)
	body.chapter="ch02_night_cinders"; body.zone="zone_cinder_home"; body.checkpoint="cp_cinder_home"
	check(not SaveStore.valid(body),"Pre-resurrection body cannot retain returned powers")
	session.data=Campaign.replay_state("ch06_last_dawn")
	session.chapter=Campaign.definition(session.data.zone)
	check(session.reward("reward_boss_halvek",30) and not session.reward("reward_boss_halvek",30),"Later boss reward is idempotent")
	for id in Campaign.manifest().zones:
		var zone=Campaign.definition(id)
		check(ResourceLoader.exists(Campaign.zone(id).scene,"PackedScene") and zone.quests.size()>0,"Zone has packaged scene and actual quests: "+id)
	print("RESULT: %d/%d campaign logic checks passed" % [checks-failures,checks])
	quit(1 if failures else 0)
