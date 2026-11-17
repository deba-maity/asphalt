extends Node

signal changed
var data: Dictionary = SaveStore.fresh()
var store: SaveStore
var loaded: Dictionary = {}
var save_warning: String = ""
var running: bool = false
var validation: bool = false
var chapter: Dictionary = {}
var replay: bool = false
var original_store: SaveStore

func _ready() -> void:
	validation = "--validate-play" in OS.get_cmdline_user_args() or "--validate-continue" in OS.get_cmdline_user_args() or "--validate-systems" in OS.get_cmdline_user_args()
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--campaign-") or arg.begins_with("--test-"): validation = true
	var path = "user://validation" if validation else "user://"
	if "--validate-systems" in OS.get_cmdline_user_args(): path = "user://validation_systems"
	if "--campaign-play" in OS.get_cmdline_user_args() or "--campaign-continue" in OS.get_cmdline_user_args(): path = "user://campaign_validation"
	if "--test-transitions" in OS.get_cmdline_user_args(): path = "user://transition_validation"
	if "--test-quit-transition" in OS.get_cmdline_user_args() or "--test-resume-transition" in OS.get_cmdline_user_args(): path="user://quit_transition_validation"
	if "--test-endurance" in OS.get_cmdline_user_args(): path="user://endurance_validation"
	store = SaveStore.new(path)
	chapter = Campaign.definition(data.zone)
	loaded = store.load_game()
	save_warning = store.last_error
	process_mode = Node.PROCESS_MODE_PAUSABLE

func _process(delta: float) -> void:
	if running:
		data.playtime += delta

func begin(fresh: bool) -> void:
	data = SaveStore.fresh() if fresh else loaded.duplicate(true)
	if data.is_empty():
		data = SaveStore.fresh()
	chapter = Campaign.definition(data.zone)
	running = true
	if fresh:
		save()

func flag(id: String) -> bool:
	return data.flags.get(id, false)

func mark(id: String) -> void:
	data.flags[id] = true
	changed.emit()
	save()

func reward(id: String, amount: int) -> bool:
	if id.is_empty() or amount<0 or id in data.rewards:
		return false
	data.rewards.append(id)
	data.currency += amount
	changed.emit()
	save()
	return true

func purchase(id: String, cost: int) -> bool:
	if id.is_empty() or cost<0 or id in data.purchases or data.currency < cost:
		return false
	data.currency -= cost
	data.purchases.append(id)
	data.flags[id] = true
	changed.emit()
	save()
	return true

func checkpoint(id: String) -> void:
	data.checkpoint = id
	data.health = data.max_health
	data.heals = data.max_heals
	data.resolve = 3.0
	changed.emit()
	save()

func objective() -> Dictionary:
	for quest in chapter.quests:
		if flag(quest.until):
			continue
		var ready = true
		for condition in quest.requires:
			if not flag(condition):
				ready = false
		if ready:
			return quest
	if data.chapter == "ch01_bread_steel": return {"id":"quest_next_day","text":"Speak to Mira to begin the next day.","target":[-3,0,5]}
	return {"id":"quest_complete","text":"The road remains open. Your journey is complete.","target":[0,0,-15]}

func checkpoint_position() -> Vector3:
	var entry = Campaign.zone(data.zone)
	if entry.checkpoints.has(data.checkpoint):
		var p = entry.checkpoints[data.checkpoint]
		return Vector3(p[0],p[1],p[2])
	for point in chapter.checkpoints:
		if point.id == data.checkpoint:
			return Vector3(point.position[0],point.position[1],point.position[2])
	return Vector3(0,0,7)

func save() -> bool:
	data.objective = objective().id
	var ok = store.write(data)
	if ok:
		loaded = data.duplicate(true)
	else:
		save_warning = store.last_error
		push_error(save_warning)
	return ok

func complete_chapter(id: String) -> void:
	if id not in data.completed_chapters: data.completed_chapters.append(id)
	data.flags[Campaign.completion(id)] = true

func apply_arrival(zone_id: String, effect: String) -> void:
	var previous: String = data.chapter
	var entry = Campaign.zone(zone_id)
	if effect in ["complete_chapter","story_death","resurrection"] and previous!=entry.chapter: complete_chapter(previous)
	if effect == "story_death" and data.story_deaths == 0:
		data.story_deaths = 1
		data.resurrection = "between"
		data.flags["evt_story_death"] = true
	if effect == "resurrection" and data.resurrections == 0:
		data.resurrections = 1
		data.resurrection = "returned"
		data.flags["evt_resurrected"] = true
		data.flags["cost_isha_voice"] = true
		if "ashstep" not in data.unlocks: data.unlocks.append("ashstep")
	data.chapter = entry.chapter
	data.zone = zone_id
	data.checkpoint = entry.checkpoint
	data.health = data.max_health
	data.heals = data.max_heals
	data.resolve = 3.0
	for pair in [["zone_cinder_home","evt_home_arrival"],["zone_copper_stair","evt_stair_arrival"],["zone_dawn_court","evt_court_arrival"],["zone_memorial","evt_memorial_arrival"]]:
		if zone_id == pair[0]: data.flags[pair[1]] = true
	chapter = Campaign.definition(zone_id)

func begin_replay(id: String) -> void:
	if not replay: original_store = store
	replay = true
	store = SaveStore.new("user://chapter_replay")
	data = Campaign.replay_state(id)
	chapter = Campaign.definition(data.zone)
	running = true
	save()

func return_to_main_save() -> void:
	if not replay: return
	store = original_store
	replay = false
	loaded = store.load_game()
	data = loaded.duplicate(true) if not loaded.is_empty() else SaveStore.fresh()
	chapter = Campaign.definition(data.zone)

func recorded_entries() -> Array[Dictionary]:
	var entries: Array[Dictionary]=[]
	var opening=Campaign.definition("zone_hearthmere")
	for pair in [["evt_family_morning","morning"],["evt_family_supper","supper"]]:
		if flag(pair[0]): entries.append({"name":"Hearthmere · "+pair[1],"lines":opening.dialogue[pair[1]]})
	for id in Campaign.manifest().zones:
		if id=="zone_hearthmere": continue
		var zone=Campaign.definition(id)
		for object in zone.objects:
			if not object.flag.is_empty() and flag(object.flag): entries.append({"name":object.name,"lines":object.dialogue})
	return entries

func begin_trial() -> void:
	if not replay: original_store=store
	replay=true
	store=SaveStore.new("user://endurance_trial" if "--test-endurance" in OS.get_cmdline_user_args() else ("user://trial_validation" if validation else "user://ashen_trial"))
	data=Campaign.replay_state("ch04_between_ashes")
	data.heals=3
	data.health=100
	data.max_health=100
	chapter=Campaign.definition(data.zone)
	running=true
