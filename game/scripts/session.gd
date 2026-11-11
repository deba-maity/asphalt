extends Node

signal changed
var data: Dictionary = SaveStore.fresh()
var store: SaveStore
var loaded: Dictionary = {}
var save_warning: String = ""
var running: bool = false
var validation: bool = false
var chapter: Dictionary = {}

func _ready() -> void:
	validation = "--validate-play" in OS.get_cmdline_user_args() or "--validate-continue" in OS.get_cmdline_user_args() or "--validate-systems" in OS.get_cmdline_user_args()
	var path = "user://validation" if validation else "user://"
	if "--validate-systems" in OS.get_cmdline_user_args(): path = "user://validation_systems"
	store = SaveStore.new(path)
	chapter = JSON.parse_string(FileAccess.get_file_as_string("res://content/chapter_01.json"))
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
	if id in data.rewards:
		return false
	data.rewards.append(id)
	data.currency += amount
	changed.emit()
	save()
	return true

func purchase(id: String, cost: int) -> bool:
	if id in data.purchases or data.currency < cost:
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
	data.heals = 3
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
	return {"id":"quest_complete","text":"Bread and Steel complete. This evening is yours.","target":[-3,0,5]}

func checkpoint_position() -> Vector3:
	for point in chapter.checkpoints:
		if point.id == data.checkpoint:
			return Vector3(point.position[0],point.position[1],point.position[2])
	return Vector3(0,0,7)

func save() -> bool:
	var ok = store.write(data)
	if ok:
		loaded = data.duplicate(true)
	else:
		save_warning = store.last_error
		push_error(save_warning)
	return ok
