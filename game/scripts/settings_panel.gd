class_name SettingsPanel
extends RefCounted

var ui: GameInterface
var c: VBoxContainer
var back: String
var tab: String

func draw(owner_ui: GameInterface, previous: String, section: String="Play") -> void:
	ui=owner_ui; back=previous; tab=section
	ui.mode="settings"
	ui.clear_overlay(); ui.shade()
	var root=ui.column(ui.panel(ui.overlay,Vector2(230,38),Vector2(820,644)),12)
	ui.text(root,"Make yourself at home",30,ui.GOLD)
	var row=HBoxContainer.new()
	root.add_child(row)
	for title in ["Play","Display","Audio","Controls"]:
		var id=title
		var b=ui.button(row,title,func(): ui.show_settings(back,id))
		b.custom_minimum_size.x=180
	var scroll=ScrollContainer.new()
	scroll.custom_minimum_size=Vector2(780,430)
	root.add_child(scroll)
	c=ui.column(scroll,13)
	c.custom_minimum_size.x=750
	match tab:
		"Play":
			choice("Difficulty",["Standard · intended timings","Story · 40% less incoming damage, wider parry"],0 if Preferences.difficulty=="standard" else 1,func(i): Preferences.difficulty="standard" if i==0 else "story")
			ui.text(c,"Every chapter, reward and ending is available on either setting.",17)
			choice("Subtitle size",["Standard (23)","Large (27)","Extra large (31)"],[23,27,31].find(Preferences.subtitle_size),func(i): Preferences.subtitle_size=[23,27,31][i])
			toggle("Camera impact shake (off by default)","camera_shake")
			toggle("Reduced effects · keep static attack cues","reduced_effects")
			slider("Camera sensitivity",.001,.009,.0002,"sensitivity")
			toggle("Invert vertical camera","invert")
		"Display":
			choice("Frame cap",["30 FPS · low target","60 FPS · optional, measure on your hardware"],0 if Preferences.fps_cap==30 else 1,func(i): Preferences.fps_cap=[30,60][i])
			choice("3D render resolution (HUD stays at 720p)",["960 × 540 · 75%","1280 × 720 · low baseline","1600 × 900 · 125%"],[540,720,900].find(Preferences.render_height),func(i): Preferences.render_height=[540,720,900][i])
			choice("Window size",["1280 × 720","1600 × 900","1920 × 1080"],[720,900,1080].find(Preferences.window_height),func(i): Preferences.window_height=[720,900,1080][i])
			toggle("Fullscreen (keeps chosen render scale)","fullscreen")
			toggle("Sun shadows · modest 38m distance","shadows")
			toggle("Low-memory transitions · release old zone first","low_memory")
			ui.text(c,"60 FPS is a selectable cap, not a performance guarantee.\nNo driver, power-profile or operating-system settings are changed.",17)
		"Audio":
			for entry in [["Master","volume"],["Music","music_volume"],["Effects","effects_volume"],["Ambient","ambient_volume"]]: slider(entry[0],0,1,.05,entry[1])
			ui.text(c,"All story information is readable in subtitles and the journal.\nCalm/combat stems blend without restarting at small boundaries.",17)
		"Controls":
			ui.text(c,"Select an action, then a keyboard key or left/right mouse.\nEscape cancels and remains reserved for pause. Controller map is fixed.",17)
			for action in Preferences.BINDINGS:
				if action=="pause": continue
				var id: String=action
				ui.button(c,id.replace("_"," ").capitalize()+"   ["+Preferences.label_for(id)+"]",func(): ui.begin_rebind(id,back))
			ui.button(c,"Restore default bindings",func(): Preferences.reset_bindings(); ui.show_settings(back,"Controls"))
			ui.text(c,Preferences.help_text(),16)
	ui.button(root,"Save settings & return",func():
		Preferences.apply()
		Preferences.save()
		if is_instance_valid(ui.world): ui.world.sun.shadow_enabled=Preferences.shadows
		ui.main.transitions.low_memory=Preferences.low_memory
		if back=="menu": ui.show_menu()
		else: ui.show_pause()).grab_focus()

func choice(title: String, labels: Array, selected: int, callback: Callable) -> void:
	ui.text(c,title,19,ui.GOLD)
	var item=OptionButton.new()
	for value in labels: item.add_item(value)
	item.select(maxi(0,selected))
	item.custom_minimum_size.y=40
	item.item_selected.connect(callback)
	c.add_child(item)

func toggle(title: String, property: String) -> void:
	var item=CheckButton.new()
	item.text=title
	item.button_pressed=Preferences.get(property)
	item.toggled.connect(func(value): Preferences.set(property,value))
	c.add_child(item)

func slider(title: String, minimum: float, maximum: float, increment: float, property: String) -> void:
	ui.text(c,title,19,ui.GOLD)
	var item=HSlider.new()
	item.min_value=minimum; item.max_value=maximum; item.step=increment
	item.value=Preferences.get(property)
	item.custom_minimum_size.y=28
	item.value_changed.connect(func(value): Preferences.set(property,value))
	c.add_child(item)
