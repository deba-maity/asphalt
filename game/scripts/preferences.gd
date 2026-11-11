extends Node

const BINDINGS = {
	"move_forward":KEY_W,"move_back":KEY_S,"move_left":KEY_A,"move_right":KEY_D,
	"sprint":KEY_SHIFT,"dodge":KEY_SPACE,"guard":KEY_CTRL,"lock_on":KEY_Q,
	"interact":KEY_E,"heal":KEY_R,"journal":KEY_TAB,"pause":KEY_ESCAPE
}
const HELP = "WASD  Move   ·   Mouse  Orbit   ·   Shift  Sprint\nLMB  Light   ·   RMB  Heavy   ·   Ctrl  Guard / timed parry\nSpace  Dodge   ·   Q  Lock-on   ·   R  Heal\nE  Interact / advance   ·   Tab  Journal   ·   Esc  Pause\nArrows / D-pad navigate dialogue; Enter / A confirms.\nController: sticks move / orbit · X / Y light / heavy\nLB guard · B dodge · RB lock · A interact · D-pad up heal\nLeft stick click sprint · Back journal · Start pause"
var sensitivity: float = 0.003
var invert: bool = false
var volume: float = 0.65
var shadows: bool = true

func _ready() -> void:
	Engine.max_fps = 30
	for action in BINDINGS:
		add_action(action)
		var event = InputEventKey.new()
		event.physical_keycode = BINDINGS[action]
		InputMap.action_add_event(action, event)
	for action in ["light","heavy"]:
		add_action(action)
		var event = InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT if action == "light" else MOUSE_BUTTON_RIGHT
		InputMap.action_add_event(action, event)
	var buttons = {"light":JOY_BUTTON_X,"heavy":JOY_BUTTON_Y,"dodge":JOY_BUTTON_B,"guard":JOY_BUTTON_LEFT_SHOULDER,"lock_on":JOY_BUTTON_RIGHT_SHOULDER,"interact":JOY_BUTTON_A,"pause":JOY_BUTTON_START,"heal":JOY_BUTTON_DPAD_UP,"journal":JOY_BUTTON_BACK,"sprint":JOY_BUTTON_LEFT_STICK}
	for action in buttons:
		var event = InputEventJoypadButton.new()
		event.button_index = buttons[action]
		InputMap.action_add_event(action,event)
	var axes = {"move_left":[JOY_AXIS_LEFT_X,-1.0],"move_right":[JOY_AXIS_LEFT_X,1.0],"move_forward":[JOY_AXIS_LEFT_Y,-1.0],"move_back":[JOY_AXIS_LEFT_Y,1.0],"look_left":[JOY_AXIS_RIGHT_X,-1.0],"look_right":[JOY_AXIS_RIGHT_X,1.0],"look_up":[JOY_AXIS_RIGHT_Y,-1.0],"look_down":[JOY_AXIS_RIGHT_Y,1.0]}
	for action in axes:
		add_action(action)
		var event = InputEventJoypadMotion.new()
		event.axis = axes[action][0]
		event.axis_value = axes[action][1]
		InputMap.action_add_event(action,event)
	var c = ConfigFile.new()
	if c.load("user://settings.cfg") == OK:
		sensitivity = clampf(float(c.get_value("input","sensitivity",0.003)),0.001,0.009)
		invert = bool(c.get_value("input","invert",false))
		volume = clampf(float(c.get_value("audio","volume",0.65)),0,1)
		shadows = bool(c.get_value("video","shadows",true))
	Input.joy_connection_changed.connect(_joy_changed)

func add_action(action: String) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action,0.22)

func _joy_changed(_device: int, _connected: bool) -> void:
	for action in InputMap.get_actions():
		Input.action_release(action)

func save() -> void:
	var c = ConfigFile.new()
	c.set_value("input","sensitivity",sensitivity)
	c.set_value("input","invert",invert)
	c.set_value("audio","volume",volume)
	c.set_value("video","shadows",shadows)
	c.save("user://settings.cfg")
