class_name SaveStore
extends RefCounted

const SCHEMA = 2
var directory: String
var last_error: String = ""

func _init(path: String = "user://") -> void:
	directory = path.trim_suffix("/") + "/"
	DirAccess.make_dir_recursive_absolute(directory)

static func fresh() -> Dictionary:
	return {"schema":SCHEMA,"chapter":"ch01_bread_steel","zone":"zone_hearthmere","checkpoint":"cp_home","flags":{},"currency":0,"purchases":[],"max_health":100,"heals":3,"unlocks":["sword_basics"],"rewards":[],"playtime":0.0,"health":100,"objective":"quest_home","bosses":[],"completed_chapters":[],"resurrection":"mortal","story_deaths":0,"resurrections":0,"ending":false,"credits":false,"resolve":3.0,"max_heals":3}

static func valid(d: Variant) -> bool:
	if not d is Dictionary:
		return false
	for key in fresh():
		if not d.has(key):
			return false
	if not d.chapter is String or not d.zone is String or not d.checkpoint is String or not d.flags is Dictionary or not d.unlocks is Array: return false
	if d.schema != SCHEMA or not Campaign.location_valid(d):
		return false
	if not d.bosses is Array or not d.completed_chapters is Array or not d.objective is String or not d.ending is bool or not d.credits is bool:
		return false
	if d.resurrection not in ["mortal","between","returned"] or (d.story_deaths != 0 and d.story_deaths != 1) or (d.resurrections != 0 and d.resurrections != 1):
		return false
	if (d.resurrection == "mortal" and (d.story_deaths != 0 or d.resurrections != 0 or "ashstep" in d.unlocks)) or (d.resurrection == "between" and (d.story_deaths != 1 or d.resurrections != 0)) or (d.resurrection == "returned" and (d.story_deaths != 1 or d.resurrections != 1 or "ashstep" not in d.unlocks)):
		return false
	var number = int(Campaign.chapter(d.chapter).number)
	if (number < 4 and d.resurrection != "mortal") or (number == 4 and d.resurrection != "between") or (number > 4 and d.resurrection != "returned"):
		return false
	if d.flags.get("evt_story_death",false) != (d.story_deaths==1) or d.flags.get("evt_resurrected",false) != (d.resurrections==1): return false
	if not d.flags is Dictionary or not d.purchases is Array or not d.unlocks is Array or not d.rewards is Array:
		return false
	for key in ["currency","max_health","heals","playtime","health","resolve","max_heals"]:
		if not (d[key] is int or d[key] is float) or not is_finite(float(d[key])):
			return false
	if d.currency < 0 or d.currency > 1000000 or d.max_health < 1 or d.max_health > 500 or d.health < 0 or d.health > d.max_health or d.heals < 0 or d.heals > 20 or d.playtime < 0:
		return false
	if d.resolve < 0 or d.resolve > 3 or (d.max_heals != 3 and d.max_heals != 4) or (d.ending and (number != 6 or not d.flags.get("campaign_complete",false))) or (d.credits and not d.ending): return false
	for key in d.flags:
		if not (key is String or key is StringName) or not d.flags[key] is bool:
			return false
	for list in [d.purchases,d.unlocks,d.rewards,d.bosses,d.completed_chapters]:
		for id in list:
			if not id is String:
				return false
	for id in d.completed_chapters:
		if Campaign.chapter(id).is_empty(): return false
	return true

func read_file(path: String) -> Variant:
	var result = raw_file(path)
	return result if valid(result) else null

func raw_file(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var file = FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 1024 * 1024:
		return null
	var parser = JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return null
	var result = parser.data
	return result

static func migrate(d: Variant) -> Dictionary:
	if not d is Dictionary or d.get("schema",0) != 1 or d.get("chapter","") != "ch01_bread_steel": return {}
	var result = fresh()
	for key in ["chapter","zone","checkpoint","flags","currency","purchases","max_health","heals","unlocks","rewards","playtime","health"]:
		if not d.has(key): return {}
		result[key] = d[key]
	if result.flags is Dictionary and result.flags.get("ch01_complete",false): result.completed_chapters.append("ch01_bread_steel")
	return result if valid(result) else {}

func load_game() -> Dictionary:
	last_error = ""
	var raw = raw_file(directory+"progress.json")
	if raw is Dictionary and (raw.get("schema",0) is int or raw.get("schema",0) is float) and raw.get("schema",0)>SCHEMA:
		last_error = "This save uses a newer schema. Use a newer ASHEN VOW build. Your files were left untouched."
		return {}
	if raw is Dictionary and raw.get("schema",0) == 1:
		var migrated = migrate(raw)
		if not migrated.is_empty():
			var preserved = directory+"progress.schema1.backup.json"
			if not FileAccess.file_exists(preserved) and DirAccess.copy_absolute(directory+"progress.json",preserved) != OK:
				last_error = "Could not preserve the schema-one save. Migration was not applied."
				return {}
			if not write(migrated): return {}
			last_error = "Opening-chapter progress upgraded to campaign schema two. A schema-one backup was preserved."
			return migrated
	var data = read_file(directory + "progress.json")
	if data != null:
		return data
	var backup = read_file(directory + "progress.backup.json")
	if backup == null:
		var old_backup = migrate(raw_file(directory+"progress.backup.json"))
		if not old_backup.is_empty(): backup = old_backup
	if backup != null:
		last_error = "The main save was unavailable. Recovered the previous valid backup."
		return backup
	if FileAccess.file_exists(directory + "progress.json") or FileAccess.file_exists(directory + "progress.backup.json"):
		last_error = "Save data could not be read. The damaged files have been preserved. Start a new journey to create a separate valid save."
	return {}

func write(data: Dictionary) -> bool:
	if not valid(data):
		last_error = "Refused invalid progress data."
		return false
	var primary = directory + "progress.json"
	var backup = directory + "progress.backup.json"
	var temporary = directory + "progress.tmp"
	var file = FileAccess.open(temporary, FileAccess.WRITE)
	if file == null:
		last_error = "Could not open save temporary file."
		return false
	file.store_string(JSON.stringify(data, "\t"))
	file.flush()
	file.close()
	if read_file(temporary) == null:
		last_error = "Temporary save did not validate."
		return false
	if FileAccess.file_exists(primary):
		if read_file(primary) != null:
			if FileAccess.file_exists(backup):
				DirAccess.remove_absolute(backup)
			if DirAccess.rename_absolute(primary, backup) != OK:
				last_error = "Could not retain previous save."
				return false
		else:
			var damaged = primary + ".damaged-" + str(Time.get_unix_time_from_system())
			if DirAccess.rename_absolute(primary, damaged) != OK:
				last_error = "Could not preserve damaged save."
				return false
	if DirAccess.rename_absolute(temporary, primary) != OK:
		last_error = "Could not replace save. Previous progress is in the backup."
		return false
	last_error = ""
	return true
