extends Node

signal changed
signal input_reset
const BINDINGS={"move_forward":KEY_W,"move_back":KEY_S,"move_left":KEY_A,"move_right":KEY_D,"sprint":KEY_SHIFT,"dodge":KEY_SPACE,"guard":KEY_CTRL,"lock_on":KEY_Q,"interact":KEY_E,"heal":KEY_R,"journal":KEY_TAB,"pause":KEY_ESCAPE,"ashstep":KEY_F,"light":-MOUSE_BUTTON_LEFT,"heavy":-MOUSE_BUTTON_RIGHT}
const BUTTONS={"light":JOY_BUTTON_X,"heavy":JOY_BUTTON_Y,"dodge":JOY_BUTTON_B,"guard":JOY_BUTTON_LEFT_SHOULDER,"lock_on":JOY_BUTTON_RIGHT_SHOULDER,"interact":JOY_BUTTON_A,"pause":JOY_BUTTON_START,"heal":JOY_BUTTON_DPAD_UP,"journal":JOY_BUTTON_BACK,"sprint":JOY_BUTTON_LEFT_STICK}
var sensitivity: float=.003
var invert: bool=false
var volume: float=.55
var music_volume: float=.45
var effects_volume: float=.75
var ambient_volume: float=.6
var shadows: bool=true
var low_memory: bool=true
var speculative_mb: int=24
var difficulty: String="standard"
var subtitle_size: int=23
var camera_shake: bool=false
var reduced_effects: bool=false
var fps_cap: int=60
var render_height: int=720
var antialiasing: int=2
var fullscreen: bool=false
var window_height: int=720
var bindings: Dictionary={}
var input_quarantine: float=0
var waiting_release: bool=false
var settings_path: String="user://settings.cfg"
var device_connected: bool=true

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	bindings=BINDINGS.duplicate()
	# Validation must be independent of the player's saved difficulty/bindings.
	var testing=false
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--campaign-") or arg.begins_with("--validate-") or arg.begins_with("--test-"): testing=true
	for arg in OS.get_cmdline_args():
		if arg.begins_with("res://tests/"): testing=true
	if testing: settings_path="user://test_settings.cfg"
	else: load_settings()
	install_input()
	apply()
	get_tree().root.size_changed.connect(update_render_scale)
	Input.joy_connection_changed.connect(_joy_changed)

func install_input() -> void:
	for action in BINDINGS:
		if not InputMap.has_action(action): InputMap.add_action(action,.24)
		InputMap.action_erase_events(action)
		var code: int=bindings.get(action,BINDINGS[action])
		var event: InputEvent
		if code<0:
			event=InputEventMouseButton.new()
			event.button_index=-code
		else:
			event=InputEventKey.new()
			event.physical_keycode=code
		InputMap.action_add_event(action,event)
	for action in BUTTONS:
		var event=InputEventJoypadButton.new()
		event.button_index=BUTTONS[action]
		InputMap.action_add_event(action,event)
	var axes={"move_left":[JOY_AXIS_LEFT_X,-1.0],"move_right":[JOY_AXIS_LEFT_X,1.0],"move_forward":[JOY_AXIS_LEFT_Y,-1.0],"move_back":[JOY_AXIS_LEFT_Y,1.0],"look_left":[JOY_AXIS_RIGHT_X,-1.0],"look_right":[JOY_AXIS_RIGHT_X,1.0],"look_up":[JOY_AXIS_RIGHT_Y,-1.0],"look_down":[JOY_AXIS_RIGHT_Y,1.0],"ashstep":[JOY_AXIS_TRIGGER_LEFT,1.0]}
	for action in axes:
		if not InputMap.has_action(action): InputMap.add_action(action,.24)
		var event=InputEventJoypadMotion.new()
		event.axis=axes[action][0]
		event.axis_value=axes[action][1]
		# Existing movement keyboard bindings stay; look axes are installed just once.
		if action.begins_with("look_"): InputMap.action_erase_events(action)
		InputMap.action_add_event(action,event)

func rebind(action: String, code: int) -> String:
	if action not in BINDINGS or code==0 or code in [KEY_ESCAPE,KEY_F8,KEY_F9] or code>KEY_SPECIAL+10000 or code < -MOUSE_BUTTON_RIGHT: return "Choose a key or left/right mouse. Escape, F8 and F9 are reserved."
	for other in bindings:
		if other!=action and int(bindings[other])==code: return "Already assigned to "+other.replace("_"," ")+"."
	bindings[action]=code
	install_input()
	release_input()
	changed.emit()
	return ""

func reset_bindings() -> void:
	bindings=BINDINGS.duplicate()
	install_input()
	release_input()
	changed.emit()

func label_for(action: String) -> String:
	var code: int=bindings.get(action,0)
	if code<0: return "LMB" if code==-1 else "RMB"
	return OS.get_keycode_string(code)

func prompt(value: String) -> String:
	# Markers are authored data, never a display-name persistence key.
	for action in BINDINGS: value=value.replace("{"+action+"}",label_for(action))
	return value

func help_text() -> String:
	return prompt("{move_forward}/{move_left}/{move_back}/{move_right} Move · Mouse orbit · {sprint} Sprint\n{light} Light · {heavy} Heavy / opening counter · {guard} Guard / parry\n{dodge} Dodge · {lock_on} Lock · {heal} Heal · {ashstep} Ashstep (after trial)\n{interact} Interact/advance · {journal} Journal · {pause} Pause\nArrows/Enter navigate and confirm · Controller sticks move/orbit\nX/Y attacks · LB guard · B dodge · RB lock · A interact\nD-pad up heal · LT Ashstep · Stick click sprint · Back journal · Start pause")

func release_input() -> void:
	for action in InputMap.get_actions(): Input.action_release(action)
	input_reset.emit()

func trial_help_text() -> String:
	return prompt("{move_forward}/{move_left}/{move_back}/{move_right} Move | Mouse orbit | {sprint} Sprint\n{light} Light | {heavy} Heavy / riposte | {guard} Guard / parry\n{dodge} Evade | {lock_on} Lock | {heal} Draught | {journal} Guide | {pause} Pause\nController: sticks move/orbit | X/Y attacks | LB guard | B evade\nRB lock | D-pad up draught | Stick click sprint | Back guide | Start pause")

func quarantine() -> void:
	release_input()
	input_quarantine=.15
	waiting_release=true

func _process(delta: float) -> void:
	input_quarantine=maxf(0,input_quarantine-delta)
	if waiting_release:
		var held=false
		for action in ["light","heavy","dodge","ashstep","heal","guard","interact"]:
			if Input.is_action_pressed(action): held=true
		if not held and input_quarantine<=0: waiting_release=false

func gameplay_input_ready() -> bool:
	return input_quarantine<=0 and not waiting_release

func _joy_changed(_device: int, connected: bool) -> void:
	device_connected=connected
	release_input()
	# Removed device events are also cleared by Godot. A disconnected device is
	# ignored for direct-axis fallbacks; keyboard/mouse remain available.

func load_settings(path: String="") -> bool:
	if path.is_empty(): path=settings_path
	var c=ConfigFile.new()
	if c.load(path)!=OK: return false
	sensitivity=clampf(float(c.get_value("input","sensitivity",.003)),.001,.009)
	invert=bool(c.get_value("input","invert",false))
	for key in ["volume","music_volume","effects_volume","ambient_volume"]: set(key,clampf(float(c.get_value("audio",key,get(key))),0,1))
	shadows=bool(c.get_value("video","shadows",true))
	low_memory=bool(c.get_value("streaming","low_memory",true))
	speculative_mb=clampi(int(c.get_value("streaming","speculative_mb",24)),4,128)
	difficulty=str(c.get_value("access","difficulty","standard"))
	if difficulty not in ["story","standard"]: difficulty="standard"
	subtitle_size=int(c.get_value("access","subtitle_size",23))
	if subtitle_size not in [23,27,31]: subtitle_size=23
	camera_shake=bool(c.get_value("access","camera_shake",false))
	reduced_effects=bool(c.get_value("access","reduced_effects",false))
	fps_cap=int(c.get_value("video","fps_cap",60))
	if fps_cap not in [30,60,90,120]: fps_cap=60
	render_height=int(c.get_value("video","render_height",720))
	if render_height not in [540,720,900,1080]: render_height=720
	antialiasing=int(c.get_value("video","antialiasing",2))
	if antialiasing not in [0,2,4]: antialiasing=2
	window_height=int(c.get_value("video","window_height",720))
	if window_height not in [720,900,1080]: window_height=720
	fullscreen=bool(c.get_value("video","fullscreen",false))
	bindings=BINDINGS.duplicate()
	for action in BINDINGS:
		if action=="pause": continue
		var code=int(c.get_value("bindings",action,BINDINGS[action]))
		# Validate the complete map before applying, then fall back on collisions.
		bindings[action]=code
	var unique={}
	for action in bindings:
		var code: int=bindings[action]
		if unique.has(code) or code==0 or code < -2 or code in [KEY_F8,KEY_F9] or (code==KEY_ESCAPE and action!="pause"):
			bindings=BINDINGS.duplicate(); break
		unique[code]=true
	return true

func apply() -> void:
	Engine.max_fps=fps_cap
	var root=get_tree().root
	root.msaa_3d={0:Viewport.MSAA_DISABLED,2:Viewport.MSAA_2X,4:Viewport.MSAA_4X}[antialiasing]
	root.content_scale_mode=Window.CONTENT_SCALE_MODE_CANVAS_ITEMS
	root.content_scale_size=Vector2i(1280,720)
	root.content_scale_aspect=Window.CONTENT_SCALE_ASPECT_KEEP
	if DisplayServer.get_name()!="headless":
		root.mode=Window.MODE_FULLSCREEN if fullscreen else Window.MODE_WINDOWED
		if not fullscreen: root.size=Vector2i(roundi(window_height*16.0/9),window_height)
	update_render_scale()
	changed.emit()

func update_render_scale() -> void:
	var root=get_tree().root
	# The fixed-aspect game area may be letterboxed. Maintain the requested
	# internal 3D height when the window/display is larger than the HUD base.
	var area_height=minf(root.size.y,root.size.x*9.0/16)
	root.scaling_3d_scale=clampf(render_height/maxf(1,area_height),.25,2)

func save(path: String="") -> bool:
	if path.is_empty(): path=settings_path
	var c=ConfigFile.new()
	for key in ["sensitivity","invert"]: c.set_value("input",key,get(key))
	for key in ["volume","music_volume","effects_volume","ambient_volume"]: c.set_value("audio",key,get(key))
	for key in ["shadows","fps_cap","render_height","window_height","fullscreen","antialiasing"]: c.set_value("video",key,get(key))
	for key in ["difficulty","subtitle_size","camera_shake","reduced_effects"]: c.set_value("access",key,get(key))
	for key in ["low_memory","speculative_mb"]: c.set_value("streaming",key,get(key))
	for key in bindings: c.set_value("bindings",key,bindings[key])
	return c.save(path)==OK
