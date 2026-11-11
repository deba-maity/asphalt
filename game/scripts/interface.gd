class_name GameInterface
extends CanvasLayer

const INK = Color("eee5cf")
const GOLD = Color("d9b779")
var mode: String = "menu"
var main: Node
var world: ChapterWorld
var overlay: Control
var hud: Control
var health: ProgressBar
var stamina: ProgressBar
var status: Label
var objective_text: Label
var interact_text: Label
var tutorial: Label
var toast_label: Label
var toast_timer: float = 0
var announce_label: Label
var announce_timer: float = 0
var dialogue_lines: Array = []
var dialogue_index: int = 0
var dialogue_name: Label
var dialogue_text: Label
var dialogue_next: Button
var dialogue_cancel: Button
var dialogue_callback: Callable
var dialogue_choice: bool = false
var speaker_id: String = ""
var lock_label: Label
var tutorial_timer: float = 0
var theme: Theme
var chapter_label: Label
var loading_progress: ProgressBar
var story_paused: bool = false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	theme = Theme.new()
	theme.default_font_size = 19
	var normal = style(Color("243139"),GOLD.darkened(0.55))
	var hover = style(Color("3d4b4d"),GOLD)
	theme.set_stylebox("normal","Button",normal)
	theme.set_stylebox("hover","Button",hover)
	theme.set_stylebox("focus","Button",hover)
	theme.set_stylebox("pressed","Button",hover)
	theme.set_color("font_color","Button",INK)
	theme.set_color("font_color","Label",INK)
	theme.set_color("font_hover_color","Button",Color.WHITE)
	build_hud()

func style(color: Color, border: Color = Color.TRANSPARENT) -> StyleBoxFlat:
	var s = StyleBoxFlat.new()
	s.bg_color = color
	s.border_color = border
	s.set_border_width_all(1)
	s.content_margin_left = 18
	s.content_margin_right = 18
	s.content_margin_top = 12
	s.content_margin_bottom = 12
	return s

func text(parent: Node, value: String, size: int = 20, color: Color = INK) -> Label:
	var l = Label.new()
	l.text = value
	l.add_theme_font_size_override("font_size",size)
	l.add_theme_color_override("font_color",color)
	l.theme = theme
	parent.add_child(l)
	return l

func button(parent: Node, value: String, callback: Callable) -> Button:
	var b = Button.new()
	b.text = value
	b.theme = theme
	b.custom_minimum_size = Vector2(0,45)
	b.pressed.connect(callback)
	parent.add_child(b)
	return b

func panel(parent: Node, at: Vector2, dimensions: Vector2, color: Color = Color(0.055,0.08,0.10,0.94)) -> PanelContainer:
	var p = PanelContainer.new()
	p.position = at
	p.size = dimensions
	p.theme = theme
	p.add_theme_stylebox_override("panel",style(color,Color(0.75,0.64,0.42,0.35)))
	parent.add_child(p)
	return p

func column(parent: Node, spacing: int = 9) -> VBoxContainer:
	var c = VBoxContainer.new()
	c.add_theme_constant_override("separation",spacing)
	parent.add_child(c)
	return c

func clear_overlay() -> void:
	if is_instance_valid(overlay):
		overlay.queue_free()
		remove_child(overlay)
	overlay = Control.new()
	overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.theme = theme
	add_child(overlay)

func shade(alpha: float = 0.68) -> void:
	var color = ColorRect.new()
	color.color = Color(0.025,0.04,0.055,alpha)
	color.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(color)

func build_hud() -> void:
	hud = Control.new()
	hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud)
	var left = column(panel(hud,Vector2(28,26),Vector2(295,143)))
	text(left,"R A Y A N   /   WAYFARER",18,GOLD)
	health = ProgressBar.new()
	health.custom_minimum_size = Vector2(258,13)
	health.show_percentage = false
	health.add_theme_stylebox_override("fill",bar_style(Color("b96d56")))
	health.add_theme_stylebox_override("background",bar_style(Color("353b3a")))
	left.add_child(health)
	stamina = ProgressBar.new()
	stamina.custom_minimum_size = Vector2(258,9)
	stamina.show_percentage = false
	stamina.add_theme_stylebox_override("fill",bar_style(Color("b8b47e")))
	stamina.add_theme_stylebox_override("background",bar_style(Color("353b3a")))
	left.add_child(stamina)
	status = text(left,"",16)
	var right = column(panel(hud,Vector2(883,26),Vector2(369,145)))
	chapter_label = text(right,"01   /   BREAD AND STEEL",17,GOLD)
	objective_text = text(right,"",18)
	objective_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	objective_text.custom_minimum_size.x = 325
	interact_text = text(hud,"",22,GOLD)
	interact_text.position = Vector2(350,552)
	interact_text.size = Vector2(580,40)
	interact_text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tutorial = text(hud,"",17)
	tutorial.position = Vector2(32,643)
	tutorial.size = Vector2(980,60)
	text(hud,"Tab  Journal   ·   Esc  Pause",16,GOLD).position = Vector2(1004,677)
	toast_label = text(hud,"",20)
	toast_label.position = Vector2(265,594)
	toast_label.size = Vector2(750,58)
	toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	announce_label = text(hud,"",32,GOLD)
	announce_label.position = Vector2(350,185)
	announce_label.size = Vector2(580,60)
	announce_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lock_label = text(hud,"◇",34,GOLD)
	lock_label.visible = false
	hud.visible = false

func show_menu() -> void:
	Session.running=false
	Session.return_to_main_save()
	mode = "menu"
	hud.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(0.50)
	var c = column(panel(overlay,Vector2(68,32),Vector2(520,650)),8)
	text(c,"A  W A Y F A R E R ' S  S T O R Y",17,GOLD)
	var title = text(c,"ASHEN\nVOW",60)
	var serif = SystemFont.new()
	serif.font_names = PackedStringArray(["Georgia","Liberation Serif"])
	title.add_theme_font_override("font",serif)
	text(c,"A ROAD THROUGH ASHES",21,GOLD)
	text(c,"Six chapters · One costly road home",18)
	if not Session.loaded.is_empty():
		button(c,"Continue · "+Campaign.chapter(Session.loaded.chapter).title,func(): main.start_game(false)).grab_focus()
		button(c,"Chapter select · separate replay saves",show_chapter_select)
	button(c,"Begin a new journey",func():
		if Session.loaded.is_empty():
			main.start_game(true)
		else:
			confirm_new()).grab_focus()
	button(c,"Controls & settings",func(): show_settings("menu"))
	button(c,"Quit",func(): main.finish())
	text(c,"Original campaign · Offline single-player\nGodot 4.7.2 · Art and animation in development",14,Color("b7b5a9"))
	if not Session.save_warning.is_empty():
		var warning = text(overlay,Session.save_warning,17,GOLD)
		warning.position = Vector2(620,560)
		warning.size = Vector2(580,110)
		warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func confirm_new() -> void:
	clear_overlay()
	shade()
	var c = column(panel(overlay,Vector2(360,220),Vector2(560,240)))
	text(c,"Begin again?",28,GOLD)
	text(c,"Current progress will become the previous-save backup.",17)
	button(c,"Keep my journey",show_menu).grab_focus()
	button(c,"Start a new journey",func(): main.start_game(true))

func play() -> void:
	mode = "play"
	get_tree().paused = false
	hud.visible = true
	clear_overlay()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	refresh_tutorial()

func show_pause() -> void:
	if world == null:
		return
	mode = "pause"
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	Input.action_release("guard")
	clear_overlay()
	shade()
	var c = column(panel(overlay,Vector2(425,150),Vector2(430,420)),13)
	text(c,"A moment of quiet",32,GOLD)
	text(c,Campaign.chapter(Session.data.chapter).title.to_upper(),17)
	button(c,"Return to the road",play).grab_focus()
	button(c,"Journal & controls",show_journal)
	button(c,"Settings",func(): show_settings("pause"))
	button(c,"Save & return to title",func(): world.save_current(); Session.running = false; show_menu())
	button(c,"Save & quit",func(): world.save_current(); main.finish())

func show_settings(back: String) -> void:
	mode = "settings"
	clear_overlay()
	shade()
	var c = column(panel(overlay,Vector2(300,65),Vector2(680,590)),12)
	text(c,"Make yourself at home",30,GOLD)
	text(c,"Mouse sensitivity",18)
	var slider = HSlider.new()
	slider.min_value = 0.001
	slider.max_value = 0.009
	slider.step = 0.0002
	slider.value = Preferences.sensitivity
	slider.value_changed.connect(func(value): Preferences.sensitivity = value)
	c.add_child(slider)
	var invert = CheckButton.new()
	invert.text = "Invert vertical camera"
	invert.button_pressed = Preferences.invert
	invert.toggled.connect(func(value): Preferences.invert = value)
	c.add_child(invert)
	var shadows = CheckButton.new()
	shadows.text = "Sun shadows (disable for lower GPU load)"
	shadows.button_pressed = Preferences.shadows
	shadows.toggled.connect(func(value):
		Preferences.shadows = value
		if world != null:
			world.sun.shadow_enabled = value)
	c.add_child(shadows)
	text(c,"Sound volume",18)
	var volume = HSlider.new()
	volume.min_value = 0
	volume.max_value = 1
	volume.step = 0.05
	volume.value = Preferences.volume
	volume.value_changed.connect(func(value): Preferences.volume = value)
	c.add_child(volume)
	text(c,"1280 × 720 internal viewport  ·  30 FPS limit",17,GOLD)
	text(c,Preferences.HELP,16)
	button(c,"Save settings & return",func():
		Preferences.save()
		if back == "menu": show_menu()
		else: show_pause()).grab_focus()

func show_journal() -> void:
	mode = "journal"
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade()
	var c = column(panel(overlay,Vector2(230,65),Vector2(820,590)),9)
	text(c,"The wayfarer's journal",32,GOLD)
	text(c,Session.objective().text,21)
	var completed: Array[String] = []
	for e in Session.chapter.encounters:
		if Session.flag(e.flag): completed.append(e.id.trim_prefix("enc_").replace("_"," "))
	text(c,"%d crowns · %d/%d chapters complete" % [Session.data.currency,Session.data.completed_chapters.size(),6],17,GOLD)
	var notes="Rest restores health, draughts and Resolve; unfinished fights reset.\nHeavy attacks break guards after Neri's whetstone lesson.\nAshstep: F / left trigger. Three Resolve charges; land hits or parry to refill.\nA precise Ashstep evasion opens a heavy counter. Elites punish careless steps."
	if Session.data.chapter=="ch01_bread_steel": notes="A day's pay: 30 crowns. Honeybread: 8 crowns.\nThe foreman follows two sweeps with an overhead blow.\nGuard as a blow lands to parry; dodge through a blow's active window.\nRest restores health and draughts. Unfinished fights reset."
	text(c,notes,17)
	text(c,Preferences.HELP,16)
	button(c,"Read remembered conversations & discoveries",show_records)
	button(c,"Close journal",play).grab_focus()

func show_records() -> void:
	mode="journal"
	get_tree().paused=true
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade()
	var c=column(panel(overlay,Vector2(230,55),Vector2(820,620)),12)
	text(c,"What the road has kept",30,GOLD)
	var scroll=ScrollContainer.new()
	scroll.custom_minimum_size=Vector2(780,460)
	c.add_child(scroll)
	var records=column(scroll,16)
	var entries=Session.recorded_entries()
	if entries.is_empty(): text(records,"Conversations and discoveries will be recorded here.",18)
	for entry in entries:
		text(records,entry.name,21,GOLD)
		for line in entry.lines:
			var l=text(records,line[0]+": "+line[1],18)
			l.custom_minimum_size.x=740
			l.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	button(c,"Back to objectives",show_journal).grab_focus()

func show_dialogue(lines: Array, id: String, callback: Callable, choice: bool) -> void:
	story_paused=false
	mode = "dialogue"
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	dialogue_lines = lines
	dialogue_index = 0
	dialogue_callback = callback
	dialogue_choice = choice
	speaker_id = id
	clear_overlay()
	var c = column(panel(overlay,Vector2(150,443),Vector2(980,236)),11)
	dialogue_name = text(c,"",21,GOLD)
	dialogue_text = text(c,"",23)
	dialogue_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialogue_text.custom_minimum_size = Vector2(930,84)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation",12)
	c.add_child(row)
	dialogue_next = button(row,"Continue  [E / Enter]",advance_dialogue)
	dialogue_next.custom_minimum_size.x = 325
	dialogue_cancel = button(row,"Not now",func(): close_dialogue(false))
	button(row,"Skip conversation",func():
		if dialogue_choice:
			dialogue_index = dialogue_lines.size()-1
			refresh_dialogue()
		else: close_dialogue(true))
	refresh_dialogue()
	dialogue_next.grab_focus()
	hud.visible = false

func refresh_dialogue() -> void:
	dialogue_name.text = dialogue_lines[dialogue_index][0]
	dialogue_text.text = dialogue_lines[dialogue_index][1]
	var last = dialogue_index == dialogue_lines.size()-1
	dialogue_cancel.visible = dialogue_choice and last
	var agreement="Accept"
	match speaker_id:
		"npc_saren": agreement="Accept contract"
		"npc_tova": agreement="Buy · 8 crowns"
		"npc_keeper": agreement="Accept the trial"
		"exit_return": agreement="Return · accept the cost"
		"obj_mill_bench": agreement="Buy flask · 20 crowns"
	dialogue_next.text = ((agreement+"  [E / Enter]") if dialogue_choice else "Finish  [E / Enter]") if last else "Continue  [E / Enter]"

func advance_dialogue() -> void:
	if story_paused: return
	if dialogue_index < dialogue_lines.size()-1:
		dialogue_index += 1
		refresh_dialogue()
	else:
		close_dialogue(true)

func close_dialogue(accepted: bool) -> void:
	get_tree().paused=false
	story_paused=false
	var callback = dialogue_callback
	dialogue_callback=Callable()
	play()
	if callback.is_valid():
		callback.call(accepted)

func show_death() -> void:
	mode = "dead"
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(0.45)
	var c = column(panel(overlay,Vector2(400,240),Vector2(480,230)),16)
	text(c,"The road takes its due",30,GOLD)
	text(c,"Wake at your last checkpoint. Earned rewards remain.",17)
	button(c,"Return to checkpoint",func(): main.restart_checkpoint()).grab_focus()
	button(c,"Return to title",func(): Session.running = false; show_menu())

func show_ending() -> void:
	mode = "ending"
	hud.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(0.35)
	var c = column(panel(overlay,Vector2(330,155),Vector2(620,400)),18)
	text(c,"BREAD AND STEEL",34,GOLD)
	text(c,"Chapter one complete",27)
	text(c,"A warm loaf. Twenty-two crowns left.\nFor tonight, enough.\n\nYour homecoming has been saved.",21)
	button(c,"Begin the next day",func(): main.travel("zone_cinder_errand"))
	button(c,"Stay in Hearthmere",play).grab_focus()
	button(c,"Return to title",func(): Session.running = false; show_menu())
	Sound.play("reward")

func toast(value: String, seconds: float = 4) -> void:
	toast_label.text = value
	toast_timer = seconds

func bar_style(color: Color) -> StyleBoxFlat:
	var s = StyleBoxFlat.new()
	s.bg_color = color
	s.set_content_margin_all(0)
	return s

func announce(value: String) -> void:
	announce_label.text = value
	announce_timer = 3.5

func refresh_tutorial() -> void:
	var tips = [["move","WASD to walk · Mouse to look · Shift to sprint. Speak to Mira: E."],["interact","Approach a named person or object and press E."],["light","LMB: quick slash · RMB: heavy blow. Attacks spend stamina."],["heavy","RMB: heavy blow · Recover stamina between attacks."],["guard","Hold Ctrl to guard. Press just before impact for a parry."],["dodge","Space: dodge through a blow. The middle of the step is invulnerable."],["heal","R: drink a healing draught. Rest at the shrine to refill."],["lock","Q: lock onto a visible enemy. Q again releases the camera."]]
	tutorial.text = "Tutorial learned · Tab opens all controls and combat notes."
	for tip in tips:
		if not Session.flag("learn_"+tip[0]):
			tutorial.text = tip[1]
			break

func update_hud(actor: Fighter, nearby: Dictionary) -> void:
	var current=Campaign.chapter(Session.data.chapter)
	chapter_label.text="%02d / %s" % [int(current.number),current.title.to_upper()]
	health.value = actor.model.health/actor.model.max_health*100
	stamina.value = actor.model.stamina
	status.text = "%d health  ·  %d draughts  ·  %d crowns" % [actor.model.health,Session.data.heals,Session.data.currency]
	if actor.model.ash_unlocked: status.text="%d HP · %d flasks · Resolve %.1f/3" % [actor.model.health,Session.data.heals,actor.model.resolve]
	var objective = Session.objective()
	var target = Vector3(objective.target[0],0,objective.target[2])
	var distance = actor.position.distance_to(target)
	var direction = target-actor.position
	var forward = -actor.yaw.global_basis.z
	var angle = atan2(forward.cross(direction.normalized()).y,forward.dot(direction.normalized()))
	var arrow = "↑" if absf(angle) < 0.6 else ("←" if angle > 0 else "→")
	if absf(angle)>2.4: arrow="↓"
	objective_text.text = objective.text+"\n"+arrow+"  %dm" % distance
	interact_text.text = "E  ·  "+nearby.name if not nearby.is_empty() else ""
	lock_label.visible = is_instance_valid(actor.target)
	if lock_label.visible:
		var point = actor.target.global_position+Vector3(0,1.25,0)
		lock_label.position = actor.camera.unproject_position(point)-Vector2(15,24)

func _process(delta: float) -> void:
	toast_timer = maxf(0,toast_timer-delta)
	toast_label.visible = toast_timer>0
	announce_timer = maxf(0,announce_timer-delta)
	announce_label.modulate.a = minf(1,announce_timer)

func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		if mode == "play": show_pause()
		elif mode in ["pause","journal"]: play()
		elif mode == "settings":
			Preferences.save()
			if get_tree().paused: show_pause()
			else: show_menu()
		elif mode == "dialogue":
			story_paused=not story_paused
			get_tree().paused=story_paused
			dialogue_name.text="PAUSED · Esc / Start to resume" if story_paused else dialogue_lines[dialogue_index][0]
		elif mode=="cinematic":
			story_paused=not story_paused
			get_tree().paused=story_paused
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("journal") and mode in ["play","journal"]:
		if mode == "play": show_journal()
		else: play()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("interact"):
		if event is InputEventJoypadButton and mode != "play": return
		if mode == "play": world.interact()
		elif mode == "dialogue": advance_dialogue()
		elif mode=="cinematic": main.finish_story_death(main.story_token)
		get_viewport().set_input_as_handled()

func show_story_death() -> void:
	mode="cinematic"
	story_paused=false
	hud.visible=false
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(.25)
	var c=column(panel(overlay,Vector2(230,505),Vector2(820,170)),12)
	text(c,"The battle was won. The bowstrings answer behind him.",23,GOLD)
	text(c,"Avel's betrayal closes the living road behind him.",19)
	button(c,"Let the road fade · E / A",func(): main.finish_story_death(main.story_token)).grab_focus()

func show_loading(title: String) -> void:
	mode="loading"
	hud.visible=false
	get_tree().paused=false
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(.98)
	var c=column(panel(overlay,Vector2(340,250),Vector2(600,195)),16)
	text(c,title,29,GOLD)
	text(c,"Following the next road…",18)
	loading_progress=ProgressBar.new()
	loading_progress.custom_minimum_size=Vector2(550,14)
	loading_progress.show_percentage=false
	c.add_child(loading_progress)

func show_transition_failure(message: String) -> void:
	mode="load_failure"
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade()
	var c=column(panel(overlay,Vector2(290,200),Vector2(700,290)))
	text(c,"The next road could not be opened",27,GOLD)
	var l=text(c,message,18)
	l.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x=650
	button(c,"Return to the saved checkpoint",func(): main.transitions.recover()).grab_focus()
	button(c,"Save & quit",func(): main.finish())

func show_chapter_select() -> void:
	mode="chapter_select"
	clear_overlay()
	shade()
	var c=column(panel(overlay,Vector2(340,72),Vector2(600,580)),12)
	text(c,"Walk an earlier road",29,GOLD)
	text(c,"Replays use a separate save. Continue keeps your campaign.",16)
	var unlocked=1
	for id in Session.loaded.get("completed_chapters",[]): unlocked=maxi(unlocked,int(Campaign.chapter(id).number)+1)
	for entry in Campaign.manifest().chapters:
		if entry.number<=unlocked:
			var id: String=entry.id
			button(c,"%02d · %s" % [entry.number,entry.title],func(): main.replay_chapter(id))
	button(c,"Back",show_menu).grab_focus()

func show_credits() -> void:
	mode="credits"
	hud.visible=false
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(.7)
	var c=column(panel(overlay,Vector2(260,52),Vector2(760,620)),12)
	text(c,"ASHEN VOW",38,GOLD)
	text(c,"The road remains open",24)
	text(c,"For Mira and Isha, remembered in the small things.\n\nOriginal game, story, models and audio: ASHEN VOW contributors\nCreated with Codex assistance · Original work: MIT\n\nGodot Engine contributors · Godot 4.7.2\nEngine and component notices accompany this game.\nThank you for walking this road.",18)
	button(c,"Continue at the memorial",func(): finish_credits(); play()).grab_focus()
	button(c,"Return to title",func(): finish_credits(); show_menu())
	button(c,"Skip credits",func(): finish_credits(); show_menu())

func finish_credits() -> void:
	if not Session.data.ending: return
	Session.data.credits=true
	Session.save()
