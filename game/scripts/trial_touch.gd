class_name TrialTouch
extends Node2D

# Positions use the same 1280 x 720 canvas as the trial HUD.
const PAD := Vector2(148, 545)
const PAD_LIMIT := 64.0
const BUTTONS := {
	"light": [Vector2(1187, 499), 48.0, "Strike"],
	"dodge": [Vector2(1103, 592), 47.0, "Roll"],
	"guard": [Vector2(1002, 521), 45.0, "Guard"],
	"heavy": [Vector2(1100, 426), 40.0, "Heavy"],
	"lock_on": [Vector2(1190, 379), 39.0, "Lock"],
	"heal": [Vector2(993, 413), 36.0, "Heal"],
	"interact": [Vector2(1103, 508), 54.0, "Use"],
	"pause": [Vector2(640, 48), 35.0, "Menu"]
}
const FIGHT_BUTTONS := ["light", "dodge", "guard", "heavy", "lock_on", "heal", "pause"]
const LESSON_BUTTONS := [
	["interact", "pause"], ["lock_on", "pause"], ["light", "lock_on", "pause"],
	["guard", "pause"], ["dodge", "pause"], ["interact", "pause"]
]

var ui: GameInterface
var fingers: Dictionary = {}
var stick := Vector2.ZERO
var last_step: int = -2

func _ready() -> void:
	Preferences.input_reset.connect(release_all)
	visibility_changed.connect(_visibility_changed)

func _visibility_changed() -> void:
	if not is_visible_in_tree(): release_all()

func lesson() -> int:
	if ui.world is TrialWorld and ui.world.arrival != null: return ui.world.arrival.step
	return -1

func actions() -> Array:
	var index := lesson()
	return LESSON_BUTTONS[index] if index >= 0 and index < LESSON_BUTTONS.size() else FIGHT_BUTTONS

func _process(_delta: float) -> void:
	if not is_visible_in_tree(): return
	var index := lesson()
	if index != last_step:
		last_step = index
		queue_redraw()

func clear_stick() -> void:
	stick = Vector2.ZERO
	for id in ["move_left", "move_right", "move_forward", "move_back"]: Input.action_release(id)

func release_all() -> void:
	if "move" in fingers.values(): clear_stick()
	if "guard" in fingers.values(): Input.action_release("guard")
	fingers.clear()
	queue_redraw()

func move_pad(point: Vector2) -> void:
	stick = ((point - PAD) / PAD_LIMIT).limit_length(1)
	for pair in [["move_left", -stick.x], ["move_right", stick.x], ["move_forward", -stick.y], ["move_back", stick.y]]:
		if pair[1] > .1: Input.action_press(pair[0], pair[1])
		else: Input.action_release(pair[0])

func press(action: String) -> void:
	match action:
		"pause": ui.show_pause()
		"interact": ui.world.interact()
		"lock_on": ui.world.hero.toggle_target()
		"guard":
			Input.action_press("guard")
			ui.world.hero.guard_press_remaining = .12
			ui.world.hero.intent.clear()
		_: ui.world.hero.queue_intent(action)

func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or ui.mode != "play" or not ui.world is TrialWorld: return
	if event is InputEventMouse and event.device == InputEvent.DEVICE_ID_EMULATION:
		get_viewport().set_input_as_handled()
		return
	if not (event is InputEventScreenTouch or event is InputEventScreenDrag): return
	var local = make_input_local(event)
	var finger: int = local.index
	var point: Vector2 = local.position
	if event is InputEventScreenTouch:
		if local.pressed and not local.canceled:
			var slot := "look"
			for id: String in actions():
				if point.distance_to(BUTTONS[id][0]) <= BUTTONS[id][1] + 6:
					slot = id
					break
			if slot != "pause" and not Preferences.gameplay_input_ready(): return
			if slot == "look" and point.distance_to(PAD) < 110: slot = "move"
			if slot in fingers.values(): slot = "unused"
			fingers[finger] = slot
			if slot == "move": move_pad(point)
			elif BUTTONS.has(slot): press(slot)
		else:
			var slot: String = fingers.get(finger, "")
			fingers.erase(finger)
			if slot == "guard": Input.action_release("guard")
			elif slot == "move": clear_stick()
	elif fingers.get(finger) == "move":
		move_pad(point)
	elif fingers.get(finger) == "look":
		var drag: Vector2 = local.relative * Preferences.sensitivity * 1.6
		ui.world.hero.trial_camera.orbit(-drag.x, -drag.y * (-1 if Preferences.invert else 1))
	queue_redraw()
	get_viewport().set_input_as_handled()

func _draw() -> void:
	if ui == null: return
	var ink := Color(.95, .88, .70, .94)
	var base := Color(.045, .06, .07, .75)
	draw_circle(PAD, 82, base)
	draw_arc(PAD, 82, 0, TAU, 48, ink, 2, true)
	draw_circle(PAD + stick * PAD_LIMIT, 26, Color(.78, .65, .44, .9))
	for id: String in actions():
		var spec: Array = BUTTONS[id]
		var center: Vector2 = spec[0]
		var radius: float = spec[1]
		var label: String = spec[2]
		if id == "interact": label = "Listen" if lesson() == TrialArrival.Step.EMBER else "Begin"
		draw_circle(center, radius, Color(.4,.31,.17,.9) if id in fingers.values() else base)
		draw_arc(center, radius, 0, TAU, 48, ink, 2, true)
		draw_string(ThemeDB.fallback_font, center + Vector2(-radius, 7), label, HORIZONTAL_ALIGNMENT_CENTER, radius * 2, 19, ink)
