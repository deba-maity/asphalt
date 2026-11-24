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
var practice_cue: Label
var practice_cue_style: StyleBoxFlat
var destination_label: Label
var destination_diamond: Line2D
var destination_arrow: Line2D
var lock_marker: Line2D
var tutorial_timer: float = 0
var theme: Theme
var chapter_label: Label
var loading_progress: ProgressBar
var story_paused: bool = false
var rebinding: String=""
var rebind_back: String=""
var rebind_status: Label
var threat_text: Label
var help_caption: Label
var player_panel: PanelContainer
var objective_panel: PanelContainer
var objective_details: VBoxContainer
var touch_controls: TrialTouch
var touch_preferred: bool = false
var controller_preferred := false

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

func play_prompt(value: String) -> String:
	if not is_instance_valid(main) or not main.trial_active: return Preferences.prompt(value)
	var keys := "{move_forward}/{move_left}/{move_back}/{move_right}"
	value = value.replace(keys, "{move}")
	if touch_preferred:
		value = value.replace("{move}", "Left pad").replace("{look}", "Swipe")
		value = value.replace("{sprint}", "Push past the pad rim").replace("{journal}", "Menu")
		for action: String in TrialTouch.BUTTONS:
			value = value.replace("{" + action + "}", TrialTouch.BUTTONS[action][2])
	elif controller_preferred:
		value = value.replace("{move}", "Left stick").replace("{look}", "Right stick")
		for action: String in Preferences.PAD_LABELS:
			value = value.replace("{" + action + "}", Preferences.PAD_LABELS[action])
	else: value = value.replace("{move}", keys).replace("{look}", "Mouse")
	return Preferences.prompt(value)

func update_input_source(event: InputEvent) -> void:
	if not is_instance_valid(main) or event.device == InputEvent.DEVICE_ID_EMULATION: return
	var touch: bool = event is InputEventScreenTouch and event.pressed
	var pad: bool = (event is InputEventJoypadButton and event.pressed) or (event is InputEventJoypadMotion and absf(event.axis_value) > .4)
	var keyboard: bool = (event is InputEventKey and event.pressed and not event.echo) or (event is InputEventMouseButton and event.pressed)
	if not touch and not pad and not keyboard: return
	if touch_preferred == touch and controller_preferred == pad: return
	touch_preferred = touch
	controller_preferred = pad
	if not main.trial_active: return
	touch_controls.visible = touch
	help_caption.visible = not touch
	help_caption.text = play_prompt("{journal} Trial guide · {pause} Pause")
	if mode == "play":
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if touch else Input.MOUSE_MODE_CAPTURED
		if world is TrialWorld and world.arrival != null: world.arrival.refresh_hud()
	for item in overlay.find_children("*", "Control", true, false):
		if item.has_meta("prompt_template"): item.text = play_prompt(item.get_meta("prompt_template"))

func text(parent: Node, value: String, size: int = 20, color: Color = INK) -> Label:
	var l = Label.new()
	l.text = play_prompt(value)
	if "{" in value: l.set_meta("prompt_template", value)
	l.add_theme_font_size_override("font_size",size)
	l.add_theme_color_override("font_color",color)
	l.theme = theme
	parent.add_child(l)
	return l

func button(parent: Node, value: String, callback: Callable) -> Button:
	var b = Button.new()
	b.text = play_prompt(value)
	if "{" in value: b.set_meta("prompt_template", value)
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
	Preferences.release_input()
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
	player_panel=panel(hud,Vector2(28,26),Vector2(295,143))
	var left = column(player_panel)
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
	objective_panel=panel(hud,Vector2(883,26),Vector2(369,145))
	var right = column(objective_panel)
	objective_details = right
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
	help_caption=text(hud,"{journal} Journal · {pause} Pause",16,GOLD)
	help_caption.position=Vector2(980,677)
	toast_label = text(hud,"",20)
	toast_label.position = Vector2(265,594)
	toast_label.size = Vector2(750,58)
	toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	announce_label = text(hud,"",32,GOLD)
	announce_label.position = Vector2(350,185)
	announce_label.size = Vector2(580,60)
	announce_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	threat_text=text(hud,"",18,GOLD)
	threat_text.position=Vector2(360,225)
	threat_text.size=Vector2(560,65)
	threat_text.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	practice_cue = text(hud, "", 25, Color("fff9e7"))
	practice_cue.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	practice_cue.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	practice_cue.mouse_filter = Control.MOUSE_FILTER_IGNORE
	practice_cue_style = StyleBoxFlat.new()
	practice_cue_style.bg_color = Color("17201ef2")
	practice_cue_style.set_border_width_all(2)
	practice_cue_style.set_corner_radius_all(5)
	practice_cue.add_theme_stylebox_override("normal", practice_cue_style)
	practice_cue.hide()
	destination_label = text(hud, "", 21, GOLD)
	destination_label.size = Vector2(170, 29)
	destination_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	destination_label.add_theme_constant_override("outline_size", 5)
	destination_label.add_theme_color_override("font_outline_color", Color("201913"))
	destination_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	destination_label.hide()
	var diamond := PackedVector2Array([Vector2(0,-9), Vector2(8,0), Vector2(0,9), Vector2(-8,0), Vector2(0,-9)])
	destination_diamond = marker_line(destination_label, diamond)
	destination_diamond.scale = Vector2.ONE * .75
	destination_diamond.position = Vector2(destination_label.size.x * .5, destination_label.size.y + 4)
	destination_arrow = marker_line(destination_label, PackedVector2Array([Vector2(-5,-7), Vector2(3,0), Vector2(-5,7)]))
	destination_arrow.hide()
	lock_marker = marker_line(hud, diamond)
	lock_marker.hide()
	touch_controls = TrialTouch.new()
	touch_controls.ui = self
	touch_controls.hide()
	hud.add_child(touch_controls)
	hud.visible = false

func marker_line(parent: CanvasItem, points: PackedVector2Array) -> Line2D:
	# A font-independent outline stays legible against steel, pale stone and sky.
	var outline := Line2D.new()
	outline.points = points
	outline.width = 6
	outline.default_color = Color("251b13")
	outline.joint_mode = Line2D.LINE_JOINT_ROUND
	outline.antialiased = true
	parent.add_child(outline)
	var ink := Line2D.new()
	ink.points = points
	ink.width = 2.5
	ink.default_color = Color("ffe4a0")
	ink.joint_mode = Line2D.LINE_JOINT_ROUND
	ink.antialiased = true
	outline.add_child(ink)
	return outline

func trial_layout(enabled: bool) -> void:
	practice_cue.hide()
	destination_label.hide()
	touch_controls.visible = enabled and touch_preferred
	interact_text.text = ""
	objective_panel.show()
	threat_text.position = Vector2(360,254) if enabled else Vector2(360,225)
	var trial_ink := style(Color(.035,.045,.05,.78), Color.TRANSPARENT)
	var archive_ink := style(Color(.055,.08,.10,.94),Color(.75,.64,.42,.35))
	player_panel.add_theme_stylebox_override("panel", trial_ink if enabled else archive_ink)
	toast_label.position = Vector2(333,94) if enabled else Vector2(265,594)
	toast_label.size = Vector2(535,82) if enabled else Vector2(750,58)
	tutorial.show()
	tutorial.modulate.a = 1
	if enabled:
		if tutorial.get_parent() != objective_details: tutorial.reparent(objective_details, false)
		tutorial.custom_minimum_size = Vector2(325,0)
		tutorial.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		tutorial.add_theme_font_size_override("font_size",19)
		tutorial.add_theme_color_override("font_color",Color("d9caa7"))
	else:
		if tutorial.get_parent() != hud: tutorial.reparent(hud, false)
		tutorial.custom_minimum_size = Vector2.ZERO
		tutorial.position = Vector2(32,643)
		tutorial.size = Vector2(980,60)
		tutorial.autowrap_mode = TextServer.AUTOWRAP_OFF
		tutorial.add_theme_font_size_override("font_size",17)
		tutorial.add_theme_color_override("font_color",INK)
	# Text placed over the 3D court needs to stay legible in sunlight and fog.
	for caption in [toast_label, interact_text, threat_text, announce_label, help_caption]:
		caption.add_theme_constant_override("outline_size", 4 if enabled else 0)
		caption.add_theme_color_override("font_outline_color",Color("171c1b"))
	help_caption.visible = not enabled or not touch_preferred
	help_caption.text = play_prompt("{journal} Trial guide · {pause} Pause" if enabled else "{journal} Journal · {pause} Pause")

func show_menu() -> void:
	Session.running=false
	if world is TrialWorld:
		world.warden.hide()
		world.hero.target = null
		world.frame_court()
	Sound.context(Session.data.zone,false,true)
	Session.return_to_main_save()
	mode = "menu"
	hud.visible = false
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(0.50)
	var c = column(panel(overlay,Vector2(68,32),Vector2(520,650)),6)
	text(c,"A  W A Y F A R E R ' S  S T O R Y",17,GOLD)
	var title = text(c,"ASHEN\nVOW",48)
	var serif = SystemFont.new()
	serif.font_names = PackedStringArray(["Georgia","Liberation Serif"])
	title.add_theme_font_override("font",serif)
	text(c,"THE ASHEN TRIAL",21,GOLD)
	text(c,"Cross the Counting Shore and carry their names home.",18)
	var shore_label := "Begin journey · The Counting Shore"
	if Session.shore.milestone == ShoreProgress.DAWN: shore_label = "Revisit the ending · Passage to dawn"
	elif Session.shore.milestone: shore_label = "Continue · " + Session.shore.label()
	var trial_button = button(c, shore_label, main.continue_shore)
	button(c,"Warden duel · skip lessons",func(): main.start_trial(TrialPassage.WARDEN,false))
	button(c,"Earlier campaign · prototype archive",show_archive)
	button(c,"Controls & settings",func(): show_settings("menu"))
	button(c,"Credits & licenses",show_asset_credits)
	if Session.shore.milestone: button(c,"Begin journey again",confirm_shore)
	button(c,"Quit",func(): main.finish())
	text(c,str(ProjectSettings.get_setting("application/config/version","development"))+" · Offline single-player",14,Color("b7b5a9"))
	trial_button.grab_focus()
	var save_note := Session.shore.last_error if not Session.shore.last_error.is_empty() else Session.save_warning
	if not save_note.is_empty():
		var warning = text(overlay,save_note,17,GOLD)
		warning.position = Vector2(620,560)
		warning.size = Vector2(580,110)
		warning.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART

func confirm_shore() -> void:
	mode = "shore_confirm"
	clear_overlay()
	shade()
	var c = column(panel(overlay, Vector2(330, 175), Vector2(620, 325)), 13)
	text(c, "Walk the shore again?", 30, GOLD)
	var words = text(c, "Your checkpoint is " + Session.shore.label() + ". Accepting the keeper’s offer again starts a new journey at the ember.", 19)
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button(c, "Keep my checkpoint", show_menu).grab_focus()
	button(c, "Revisit the opening", func(): main.start_trial())

func show_asset_credits() -> void:
	mode="credits_info"
	clear_overlay(); shade()
	var c=column(panel(overlay,Vector2(260,65),Vector2(760,590)),11)
	text(c,"Credits & licenses",30,GOLD)
	text(c,"Knight armor: piacenti · CC BY 3.0",20)
	text(c,"Modified rig, bind pose, texture packing and armor palettes.\nopengameart.org/content/knight-2\ncreativecommons.org/licenses/by/3.0/",16)
	text(c,"Motion and original rig: Quaternius / Gonzalo Furnier · CC0\nCourtyard scans: Poly Haven artists · CC0\nFoley: Kenney · CC0\nInstrument recordings: VSCO 2 CE contributors · CC0",17)
	text(c,"Original game, story, score and cloth: ASHEN VOW contributors\nCreated with Codex assistance · Original code: MIT\nGodot Engine contributors · MIT",17)
	text(c,"Full artist credits and license notices accompany the game.",16,GOLD)
	button(c,"Back",show_menu).grab_focus()

func show_archive() -> void:
	mode="archive"
	clear_overlay(); shade()
	var c=column(panel(overlay,Vector2(320,105),Vector2(640,510)),12)
	text(c,"The earlier campaign",30,GOLD)
	var description=text(c,"Six story chapters from the original prototype.\nThis archive retains the earlier character art and environments.\nYour campaign saves and chapter replays remain available here.",18)
	description.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	if not Session.loaded.is_empty():
		button(c,"Continue · "+Campaign.chapter(Session.loaded.chapter).title,func(): main.start_game(false))
		button(c,"Chapter select · separate replay saves",show_chapter_select)
	button(c,"Start the prototype campaign",func():
		if Session.loaded.is_empty() and not FileAccess.file_exists(Session.store.directory+"progress.json"):
			main.start_game(true)
		else: confirm_new())
	button(c,"Back to the Ashen Trial",show_menu).grab_focus()

func confirm_new() -> void:
	clear_overlay()
	shade()
	var c = column(panel(overlay,Vector2(360,220),Vector2(560,240)))
	text(c,"Begin again?",28,GOLD)
	text(c,"Current progress will become the previous-save backup.",17)
	button(c,"Keep my journey",show_archive).grab_focus()
	button(c,"Start a new journey",func(): main.start_game(true))

func play() -> void:
	Preferences.quarantine()
	mode = "play"
	get_tree().paused = false
	hud.visible = true
	clear_overlay()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if touch_preferred and world is TrialWorld else Input.MOUSE_MODE_CAPTURED
	if world is TrialWorld:
		world.hero.camera.make_current()
		help_caption.text=play_prompt("{journal} Trial guide · {pause} Pause")
		if world.arrival != null: world.arrival.refresh_hud()
	else: refresh_tutorial()

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
	text(c,"THE ASHEN TRIAL" if main.trial_active else Campaign.chapter(Session.data.chapter).title.to_upper(),17)
	button(c,"Resume journey" if main.trial_active else "Return to the road",play).grab_focus()
	button(c,"Trial guide" if main.trial_active else "Journal & controls",show_journal)
	button(c,"Settings",func(): show_settings("pause"))
	button(c,"Return to title" if main.trial_active else "Save & return to title",func(): world.save_current(); Session.running = false; show_menu())
	button(c,"Quit" if main.trial_active else "Save & quit",func(): world.save_current(); main.finish())

func show_settings(back: String, tab: String="Play") -> void:
	var settings=SettingsPanel.new()
	settings.draw(self,back,tab)

func begin_rebind(action: String, back: String) -> void:
	rebinding=action
	rebind_back=back
	clear_overlay(); shade()
	var c=column(panel(overlay,Vector2(330,235),Vector2(620,230)),15)
	text(c,"Bind "+action.replace("_"," "),28,GOLD)
	rebind_status=text(c,"Press a key or mouse button. Escape cancels.",18)
	button(c,"Cancel",func(): rebinding=""; show_settings(back,"Controls")).grab_focus()

func show_journal() -> void:
	if main.trial_active:
		show_trial_guide()
		return
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
	var notes="Rest restores health, draughts and Resolve; unfinished fights reset.\nHeavy attacks break guards after Neri's whetstone lesson.\nAshstep: {ashstep} / left trigger. Three Resolve charges; land hits or parry to refill.\nA precise Ashstep evasion opens a heavy counter. Elites punish careless steps."
	if Session.data.chapter=="ch01_bread_steel": notes="A day's pay: 30 crowns. Honeybread: 8 crowns.\nThe foreman follows two sweeps with an overhead blow.\nGuard as a blow lands to parry; dodge through a blow's active window.\nRest restores health and draughts. Unfinished fights reset."
	text(c,notes,17)
	text(c,Preferences.help_text(),16)
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
	var c = column(panel(overlay,Vector2(110,405),Vector2(1060,280)),11)
	dialogue_name = text(c,"",21,GOLD)
	dialogue_text = text(c,"",Preferences.subtitle_size)
	dialogue_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	dialogue_text.custom_minimum_size = Vector2(1000,118)
	var row = HBoxContainer.new()
	row.add_theme_constant_override("separation",12)
	c.add_child(row)
	dialogue_next = button(row,"Continue  [{interact} / Enter]",advance_dialogue)
	dialogue_next.custom_minimum_size.x = 380
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
	dialogue_text.text = Preferences.prompt(dialogue_lines[dialogue_index][1])
	var last = dialogue_index == dialogue_lines.size()-1
	dialogue_cancel.visible = dialogue_choice and last
	var agreement="Accept"
	match speaker_id:
		"npc_saren": agreement="Accept contract"
		"npc_tova": agreement="Buy · 8 crowns"
		"npc_keeper": agreement="Accept the trial"
		"exit_return": agreement="Return · accept the cost"
		"obj_mill_bench": agreement="Buy flask · 20 crowns"
	dialogue_next.text = ((agreement+"  [{interact} / Enter]") if dialogue_choice else "Finish  [{interact} / Enter]") if last else "Continue  [{interact} / Enter]"
	dialogue_next.text=Preferences.prompt(dialogue_next.text)

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
	toast_label.text = play_prompt(value)
	toast_timer = seconds

func bar_style(color: Color) -> StyleBoxFlat:
	var s = StyleBoxFlat.new()
	s.bg_color = color
	s.set_content_margin_all(0)
	return s

func clear_court_messages() -> void:
	announce_label.text = ""
	announce_timer = 0
	toast_label.hide()
	toast_timer = 0
	threat_text.text = ""
	interact_text.text = ""

func show_practice_cue(value: String) -> void:
	if value.is_empty():
		practice_cue.hide()
		return
	if practice_cue.text != value:
		practice_cue.text = value
		var ink := Color("a5e1bb") if value in ["BLOCKED", "OPENING · STRIKE", "PRACTICE COMPLETE"] else Color("efbf78")
		practice_cue_style.border_color = ink
		var font := practice_cue.get_theme_font("font")
		var width := font.get_string_size(value, HORIZONTAL_ALIGNMENT_LEFT, -1, practice_cue.get_theme_font_size("font_size")).x
		practice_cue.size = Vector2(maxf(176, width + 36), 42)
	practice_cue.position = Vector2((get_viewport().get_visible_rect().size.x - practice_cue.size.x) * .5, 246)
	practice_cue.show()

func track_destination(camera: Camera3D, point: Vector3, title: String) -> void:
	var viewport_size := get_viewport().get_visible_rect().size
	var safe := Rect2(Vector2(100, viewport_size.y * .27), Vector2(viewport_size.x - 200, viewport_size.y * .46))
	var center := safe.get_center()
	var behind := camera.is_position_behind(point)
	var at := center
	if not behind: at = camera.unproject_position(point)
	var on_screen := not behind and safe.has_point(at)
	destination_label.text = title
	destination_diamond.visible = on_screen
	destination_arrow.visible = not on_screen
	if not on_screen:
		var right := camera.to_local(point).x >= 0
		if behind or at.x < safe.position.x or at.x > safe.end.x:
			at = Vector2(safe.end.x if right else safe.position.x, center.y)
			destination_arrow.rotation = 0.0 if right else PI
			destination_arrow.position = Vector2(destination_label.size.x - 6 if right else 6.0, destination_label.size.y * .5)
		else:
			var above := at.y < safe.position.y
			at.y = safe.position.y if above else safe.end.y
			destination_arrow.rotation = -PI * .5 if above else PI * .5
			destination_arrow.position = Vector2(destination_label.size.x * .5, -5.0 if above else destination_label.size.y + 5)
	destination_label.position = at - destination_label.size * .5
	destination_label.show()

func announce(value: String) -> void:
	announce_label.text = Preferences.prompt(value)
	announce_timer = 3.5

func refresh_tutorial() -> void:
	var tips = [["move","{move_forward}/{move_left}/{move_back}/{move_right} to walk · Mouse to look · {sprint} to sprint. Speak to Mira: {interact}."],["interact","Approach a named person or object and press {interact}."],["light","{light}: quick slash · {heavy}: heavy blow. Attacks spend stamina."],["heavy","{heavy}: heavy blow · Recover stamina between attacks."],["guard","Hold {guard} to guard. Press just before impact for a parry."],["dodge","{dodge}: dodge through a blow. The middle of the step is invulnerable."],["heal","{heal}: drink a healing draught. Rest at the shrine to refill."],["lock","{lock_on}: lock onto a visible enemy. {lock_on} again releases the camera."]]
	tutorial.text = "Tutorial learned · {journal} opens all controls and combat notes."
	for tip in tips:
		if not Session.flag("learn_"+tip[0]):
			tutorial.text = tip[1]
			break
	tutorial.text=Preferences.prompt(tutorial.text)
	help_caption.text=play_prompt("{journal} Trial guide · {pause} Pause" if world is TrialWorld else "{journal} Journal · {pause} Pause")

func update_hud(actor: Fighter, nearby: Dictionary) -> void:
	threat_text.text=""
	for enemy in world.enemies:
		if not is_instance_valid(enemy) or enemy.model.state=="dead" or enemy.position.distance_to(actor.position)>10: continue
		if enemy.model.state=="attack" and enemy.model.elapsed<float(enemy.model.attack.windup):
			var attack=enemy.model.attack
			threat_text.text=attack.get("telegraph","EVADE · cannot guard" if not attack.get("blockable",true) else "Incoming · guard / parry / dodge")
			break
	if actor.model.counter_window>0: threat_text.text=play_prompt("OPENING COUNTER · {heavy}")
	health.value = actor.model.health/actor.model.max_health*100
	stamina.value = actor.model.stamina
	if not main.trial_active:
		var current=Campaign.chapter(Session.data.chapter)
		chapter_label.text="%02d / %s" % [int(current.number),current.title.to_upper()]
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
		interact_text.text = Preferences.label_for("interact")+" · "+nearby.name if not nearby.is_empty() else ""
	lock_marker.visible = is_instance_valid(actor.target)
	if lock_marker.visible:
		var point = actor.target.get_global_transform_interpolated().origin + Vector3(0,1.25,0)
		lock_marker.visible = not actor.camera.is_position_behind(point)
		if lock_marker.visible:
			var projected = actor.camera.unproject_position(point)
			lock_marker.visible = get_viewport().get_visible_rect().grow(-20).has_point(projected)
			lock_marker.position = projected

func _process(delta: float) -> void:
	toast_timer = maxf(0,toast_timer-delta)
	toast_label.visible = toast_timer>0
	announce_timer = maxf(0,announce_timer-delta)
	announce_label.modulate.a = minf(1,announce_timer)

func _input(event: InputEvent) -> void:
	update_input_source(event)
	if not rebinding.is_empty():
		if event is InputEventKey and event.pressed and not event.echo:
			if event.keycode==KEY_ESCAPE: rebinding=""; show_settings(rebind_back,"Controls")
			else: accept_rebind(event.physical_keycode)
		elif event is InputEventMouseButton and event.pressed: accept_rebind(-event.button_index)
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("pause") and not event.is_echo():
		if mode == "play": show_pause()
		elif mode in ["pause","journal"]: play()
		elif mode == "duel_replays": show_dawn()
		elif mode in ["archive","credits_info","shore_confirm","dawn"]: show_menu()
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
	elif mode == "play" and event.is_action_pressed("heavy") and not event.is_echo() and world is TrialWorld and world.arrival != null and world.arrival.step == TrialArrival.Step.READY and world.arrival.sparring == null:
		if Preferences.gameplay_input_ready(): world.arrival.begin_sparring()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("interact"):
		if mode=="play" and not Preferences.gameplay_input_ready(): get_viewport().set_input_as_handled(); return
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
	button(c,"Let the road fade · {interact} / A",func(): main.finish_story_death(main.story_token)).grab_focus()

func show_loading(title: String) -> void:
	Sound.context(Session.data.zone,false,true)
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
	button(c,"Back",show_archive).grab_focus()

func show_credits() -> void:
	mode="credits"
	hud.visible=false
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	clear_overlay()
	shade(.7)
	var c=column(panel(overlay,Vector2(260,52),Vector2(760,620)),12)
	text(c,"ASHEN VOW",38,GOLD)
	text(c,"The road remains open",24)
	text(c,"For Mira and Isha, remembered in the small things.\n\nOriginal game, story and audio: ASHEN VOW contributors\nCreated with Codex assistance · Original work: MIT\n\nGodot Engine contributors · Godot 4.7.2\nTrial armor: Knight by piacenti (CC BY 3.0)\nTrial animation: Quaternius / Gonzalo Furnier (CC0)\nEngine and asset notices accompany this game.\nThank you for walking this road.",18)
	button(c,"Continue at the memorial",func(): finish_credits(); play()).grab_focus()
	button(c,"Return to title",func(): finish_credits(); show_menu())
	button(c,"Skip credits",func(): finish_credits(); show_menu())

func finish_credits() -> void:
	if not Session.data.ending: return
	Session.data.credits=true
	Session.save()

func accept_rebind(code: int) -> void:
	var reason=Preferences.rebind(rebinding,code)
	if reason.is_empty():
		rebinding=""
		show_settings(rebind_back,"Controls")
	else: rebind_status.text=reason

func show_trial_result(won: bool) -> void:
	mode = "trial_result"
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	hud.hide()
	clear_overlay()
	shade(.55)
	var c = column(panel(overlay, Vector2(300,105), Vector2(680,510)), 13)
	var victory_title := "ECHO OVERCOME" if world.passage.training() else "WARDEN OVERCOME"
	text(c, victory_title if won else "RISE THROUGH THE ASH", 30, GOLD)
	text(c, world.passage.entry().name, 18, GOLD)
	var victory_text: String = world.passage.entry().after if world.passage.training() else "The Warden lowers his blade."
	var words = text(c, victory_text if won else world.duel.retry_tip(), 20)
	words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	text(c, world.duel.summary(), 17)
	if main.journey: text(c, "Your next attempt starts here with full health and draughts.", 16)
	button(c, "Fight this duel again" if won else "Retry this encounter", main.restart_checkpoint).grab_focus()
	if not won: button(c, "Practice guard and dodge", main.practice_after_defeat)
	if main.duel_replay: button(c, "Choose another duel", show_duel_replays)
	button(c, "Return to title", show_menu)

func show_dawn() -> void:
	mode = "dawn"
	get_tree().paused = false
	Session.running = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	hud.hide()
	clear_overlay()
	if world is TrialWorld:
		world.hero.target = null
		world.warden.hide()
		world.frame_court()
	shade(.27)
	var c = column(panel(overlay, Vector2(58, 105), Vector2(545, 490)), 18)
	text(c, "BEYOND THE COUNTING SHORE", 16, GOLD)
	text(c, "Vow kept", 37)
	var story = text(c, "Rayan opens his hand. The register is still there. He reads two names into the morning light: Mira. Isha.", 22)
	story.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var price = text(c, "He remembers what Isha said on the stair. When he tries to hear her say it, there is only the wind from the road.", 19)
	price.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	button(c, "Return to title", show_menu).grab_focus()
	button(c, "Revisit a duel", show_duel_replays)

func show_duel_replays() -> void:
	if Session.shore.milestone != ShoreProgress.DAWN: return
	mode = "duel_replays"
	Session.running = false
	hud.hide()
	clear_overlay()
	shade(.55)
	var c = column(panel(overlay, Vector2(295, 92), Vector2(690, 535)), 13)
	text(c, "THE COUNTING SHORE", 16, GOLD)
	text(c, "Revisit a duel", 32)
	var note = text(c, "Choose an opponent. Each duel begins with full health and draughts. Your journey is saved at dawn.", 19)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var skills := ["Find your reach", "Guard and dodge", "Read the two-cut chain", "Face both phases"]
	for stage in TrialPassage.ENCOUNTERS.size():
		var name_text: String = TrialPassage.ENCOUNTERS[stage].name.capitalize()
		var choice = button(c, name_text + " · " + skills[stage], main.start_duel_replay.bind(stage))
		if stage == 0: choice.grab_focus()
	button(c, "Return to dawn", show_dawn)

func show_trial_briefing() -> void:
	mode="trial_briefing"
	get_tree().paused=true
	Input.mouse_mode=Input.MOUSE_MODE_VISIBLE
	hud.visible=false
	clear_overlay()
	if world.arrival != null:
		world.frame_court()
		shade(.17)
		var story = column(panel(overlay,Vector2(54,86),Vector2(458,525)),15)
		text(story,"THE COUNTING SHORE",16,GOLD)
		text(story,"The last ember",34)
		for line in ["The last thing Rayan remembers is Avel's blade on the Copper Stair. He wakes in an empty court. An ember burns where the road should be.", "The register that names Mira and Isha's killers is still among the living. Rayan has come to carry their names home.", "KEEPER   You may take her words back with you. The sound of Isha's voice stays here."]:
			var words = text(story,line,18)
			words.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button(story,"Accept the cost · approach the ember",main.accept_shore).grab_focus()
		button(story,"Return to title",show_menu)
		return
	shade(.78)
	var entry: Dictionary=world.passage.entry()
	var c=column(panel(overlay,Vector2(210,40),Vector2(860,640)),12)
	text(c,entry.chapter,16,GOLD)
	text(c,entry.title,32)
	var scroll=ScrollContainer.new(); scroll.custom_minimum_size=Vector2(810,400); c.add_child(scroll)
	var words=column(scroll,18); words.custom_minimum_size.x=790
	for pair in [[entry.story,21,INK],[entry.voice,20,GOLD],[entry.lesson,19,INK]]:
		var line=text(words,pair[0],pair[1],pair[2])
		line.custom_minimum_size.x=780; line.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	button(c,"Accept the cost · begin" if main.trial_stage==0 else "Step into the court",func(): play(); announce(entry.chapter)).grab_focus()
	button(c,"Return to title",show_menu)

func show_trial_guide() -> void:
	mode="journal"
	get_tree().paused=true
	clear_overlay()
	shade()
	var c=column(panel(overlay,Vector2(230,90),Vector2(820,530)),16)
	if world.arrival != null:
		if world.arrival.sparring != null:
			var drill = world.arrival.sparring
			text(c, "Read the blade", 30, GOLD)
			for i in range(drill.OBJECTIVES.size() - 1):
				text(c, ("✓  " if i < drill.phase else "") + str(drill.OBJECTIVES[i]), 19, GOLD if i == drill.phase else INK)
			text(c, "The echo pulls its blows. Health and draughts refill for the encounter.", 18)
			button(c, "Return to sparring", play).grab_focus()
			button(c, "Begin encounter", world.arrival.begin_encounter)
			return
		text(c,"Practice on the Counting Shore",30,GOLD)
		for i in range(TrialArrival.LESSONS.size()):
			var active = i == world.arrival.step
			var mark = "✓  " if i < world.arrival.step else ("›  " if active else "    ")
			text(c,mark + str(TrialArrival.LESSONS[i][1]),18,GOLD if active else INK)
		button(c,"Return to practice",play).grab_focus()
		button(c,"Skip practice and face the first echo",world.arrival.begin_encounter)
		return
	if world.waystone != null:
		text(c, "The north gate" if not world.passage.training() else "A moment at the ember", 30, GOLD)
		var directions = text(c, "The north gate has opened. Follow the distance and bearing on your screen to cross into dawn." if not world.passage.training() else "Approach the lit stone ring in the court. Call the next echo when you are ready. Health and draughts refill for the encounter.", 20)
		directions.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button(c, "Return to the court", play).grab_focus()
		return
	text(c,world.passage.entry().chapter,30,GOLD)
	text(c,"Return to expose Avel's betrayal and carry Mira and Isha's names into dawn.\nThree echoes prepare you. The Warden guards the road back.",19)
	text(c,"Chain light attacks as each swing finishes; the finisher cuts twice.\nParries and heavy hits break the Warden's composure.\nClose in and use {heavy} during the break for a riposte.\nHis raised cleave cannot be blocked: evade or parry.\nPatterns end in a breathing beat. Use it to recover stamina.\nA draught heals when you drink; taking a hit interrupts it.",18)
	text(c, Preferences.TRIAL_CONTROLS, 16)
	button(c,"Return to the duel",play).grab_focus()
