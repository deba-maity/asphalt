class_name SaveStore
extends RefCounted

const SCHEMA = 1
var directory: String
var last_error: String = ""

func _init(path: String = "user://") -> void:
	directory = path.trim_suffix("/") + "/"
	DirAccess.make_dir_recursive_absolute(directory)

static func fresh() -> Dictionary:
	return {"schema":SCHEMA,"chapter":"ch01_bread_steel","zone":"zone_hearthmere","checkpoint":"cp_home","flags":{},"currency":0,"purchases":[],"max_health":100,"heals":3,"unlocks":["sword_basics"],"rewards":[],"playtime":0.0,"health":100}

static func valid(d: Variant) -> bool:
	if not d is Dictionary:
		return false
	for key in fresh():
		if not d.has(key):
			return false
	if d.schema != SCHEMA or d.chapter != "ch01_bread_steel":
		return false
	if not d.zone in ["zone_hearthmere", "zone_alder_road"] or not d.checkpoint in ["cp_home", "cp_road_shrine"]:
		return false
	if not d.flags is Dictionary or not d.purchases is Array or not d.unlocks is Array or not d.rewards is Array:
		return false
	for key in ["currency","max_health","heals","playtime","health"]:
		if not (d[key] is int or d[key] is float) or not is_finite(float(d[key])):
			return false
	if d.currency < 0 or d.currency > 1000000 or d.max_health < 1 or d.max_health > 500 or d.health < 0 or d.health > d.max_health or d.heals < 0 or d.heals > 20 or d.playtime < 0:
		return false
	for key in d.flags:
		if not (key is String or key is StringName) or not d.flags[key] is bool:
			return false
	for list in [d.purchases,d.unlocks,d.rewards]:
		for id in list:
			if not id is String:
				return false
	return true

func read_file(path: String) -> Variant:
	if not FileAccess.file_exists(path):
		return null
	var file = FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 1024 * 1024:
		return null
	var parser = JSON.new()
	if parser.parse(file.get_as_text()) != OK:
		return null
	var result = parser.data
	return result if valid(result) else null

func load_game() -> Dictionary:
	last_error = ""
	var data = read_file(directory + "progress.json")
	if data != null:
		return data
	var backup = read_file(directory + "progress.backup.json")
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
