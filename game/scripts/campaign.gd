class_name Campaign
extends RefCounted
static var index: Dictionary={}

static func manifest() -> Dictionary:
	if index.is_empty(): index=JSON.parse_string(FileAccess.get_file_as_string("res://content/campaign.json"))
	return index

static func zone(id: String) -> Dictionary:
	return manifest().zones.get("zone_hearthmere" if id == "zone_alder_road" else id,{})

static func definition(id: String) -> Dictionary:
	var entry = zone(id)
	if entry.is_empty(): return {}
	return JSON.parse_string(FileAccess.get_file_as_string(entry.data))

static func chapter(id: String) -> Dictionary:
	for entry in manifest().chapters:
		if entry.id == id: return entry
	return {}

static func completion(id: String) -> String:
	return "ch%02d_complete" % int(chapter(id).get("number",1))

static func location_valid(d: Dictionary) -> bool:
	var entry = zone(d.zone)
	return not entry.is_empty() and entry.chapter == d.chapter and entry.checkpoints.has(d.checkpoint)

static func replay_state(chapter_id: String) -> Dictionary:
	var result = SaveStore.fresh()
	var entry = chapter(chapter_id)
	var number = int(entry.number)
	for c in manifest().chapters:
		if c.number < number:
			result.completed_chapters.append(c.id)
			result.flags[completion(c.id)] = true
	result.chapter = chapter_id
	result.zone = entry.entry
	result.checkpoint = zone(entry.entry).checkpoint
	result.currency = 50 if number > 1 else 0
	if number>1:
		for id in ["move","interact","light","heavy","guard","dodge","heal","lock"]: result.flags["learn_"+id]=true
	if number >= 4:
		result.story_deaths = 1
		result.resurrection = "between"
		result.flags["evt_story_death"] = true
		result.unlocks.append("tempered_edge")
	if number >= 5:
		result.resurrections = 1
		result.resurrection = "returned"
		result.unlocks.append("ashstep")
		result.flags["evt_resurrected"] = true
		result.flags["cost_isha_voice"] = true
	return result
