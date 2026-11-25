class_name TrialArrival
extends Node3D

const Sparring = preload("res://scripts/echo_sparring.gd")

enum Step { EMBER, LOCK, STRIKE, GUARD, DODGE, READY, LEAVING }

const LESSONS = [
	["The Counting Shore", "Walk to the ember in the stone ring.", "{move} to walk. {look} to look around."],
	["Find your footing", "Focus on the waiting echo.", "{lock_on} to lock on. Stay within sight of the echo."],
	["Find your reach", "Step onto the chalk arc and land a light strike.", "{light} to strike. If your blade misses, take another step."],
	["Raise your guard", "Match the echo’s guard and hold it.", "Hold {guard}. Release to recover stamina."],
	["Make room", "Roll clear of the echo.", "Use {dodge}. Hold a movement direction to choose where to roll."],
	["The first echo", "The echo waits for your answer.", "Use {heavy} for a timing lesson, or begin the encounter when ready."]
]

const TOUCH_HINTS := [
	"Drag the left pad to walk. Swipe the court to look around.",
	"Tap Lock while the echo is in sight.",
	"Move within sword's reach, then tap Strike.",
	"Hold Guard. Release between blows to recover stamina.",
	"Tap Roll. Hold the left pad to roll in that direction.",
	"Tap Spar for a timing lesson, or Begin to face the first echo."
]

var world: TrialWorld
var step: Step = Step.EMBER
var sparring: Sparring
var from_retry := false
var nameplate: Label3D
var memorial: ShoreEmber
var guard_time: float = 0
var reach_arc: MeshInstance3D
var chalk := ShaderMaterial.new()
var practice_swing := -1

func _ready() -> void:
	(world.hero.figure as PerformanceFigure).settle_on_shore()
	var echo := world.warden
	echo.ai_enabled = false
	echo.process_mode = Node.PROCESS_MODE_DISABLED
	echo.hide()
	echo.collision_layer = 0
	echo.hurtbox.collision_layer = 0
	world.enemies.erase(echo)
	memorial = ShoreEmber.new()
	memorial.position = Vector3(1.05, 0, 0)
	add_child(memorial)

func near_ember() -> bool:
	return world.hero.global_position.distance_to(memorial.global_position) < 2.1

func interact() -> void:
	if step == Step.READY:
		begin_encounter()
	elif step == Step.EMBER and near_ember():
		reveal_echo(true)
		step = Step.LOCK
		world.foley.event("heal", world.warden.global_position)
		world.ui.announce("THE FIRST ECHO")
		world.ui.toast("Keeper: Its blade will stay lowered until you give the word.", 4)
		checkpoint()

func reveal_echo(reach: bool = false) -> void:
	(world.hero.figure as PerformanceFigure).shore_stance.ready_sword(reach)
	world.warden.process_mode = Node.PROCESS_MODE_INHERIT
	world.introduce_echo()
	world.warden.show()
	world.warden.collision_layer = 4
	world.warden.hurtbox.collision_layer = 16
	world.enemies.append(world.warden)
	nameplate = Label3D.new()
	nameplate.text = "PRACTICE ECHO"
	nameplate.font_size = 38
	nameplate.pixel_size = .003
	nameplate.outline_size = 7
	nameplate.modulate = Color("c0e5d6")
	nameplate.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	nameplate.position = Vector3.UP * 2.45
	world.warden.add_child(nameplate)
	memorial.hide()
	create_reach_arc()

func create_reach_arc() -> void:
	reach_arc = MeshInstance3D.new()
	reach_arc.name = "PracticeReach"
	var floor_mark := PlaneMesh.new()
	floor_mark.size = Vector2(3.6, 3.6)
	reach_arc.mesh = floor_mark
	reach_arc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	chalk.shader = preload("res://assets/court/practice_reach.gdshader")
	reach_arc.material_override = chalk
	reach_arc.hide()
	add_child(reach_arc)

func update_demonstration() -> void:
	if reach_arc == null: return
	reach_arc.visible = step == Step.STRIKE
	(world.warden.figure as PerformanceFigure).shore_stance.demonstrating_guard = step == Step.GUARD
	if not reach_arc.visible: return
	var foe := world.warden.position
	reach_arc.position = Vector3(foe.x, .038, foe.z)
	var approach := Vector2(world.hero.position.x - foe.x, world.hero.position.z - foe.z)
	if approach.length_squared() > .002: chalk.set_shader_parameter("approach", approach.normalized())
	chalk.set_shader_parameter("ready", 1.0 if approach.length() <= 1.76 else 0.0)

func resume_lesson(saved_step: int) -> void:
	step = clampi(saved_step, Step.EMBER, Step.READY) as Step
	if step > Step.EMBER:
		reveal_echo()
		world.hero.position = Vector3(0, .08, -1.8)
		if step > Step.LOCK: world.hero.target = world.warden
	refresh_hud()

func begin_sparring() -> void:
	if step != Step.READY or sparring != null: return
	sparring = Sparring.new(world)
	world.hero.clear_intent()
	world.hero.target = world.warden
	world.hero.model.stamina = 100
	nameplate.text = "SPARRING ECHO"
	world.ui.clear_court_messages()
	refresh_hud()

func checkpoint() -> void:
	world.ui.main.remember_lesson(step)
	refresh_hud()

func learn(action: String) -> void:
	if sparring != null:
		sparring.learn(action)
		return
	if step == Step.STRIKE and action in ["light", "trial_second", "trial_finish"]:
		practice_swing = world.hero.model.swing_serial
	if step == Step.LOCK and action == "lock" and world.hero.target == world.warden:
		step = Step.STRIKE
	elif step == Step.DODGE and action == "dodge":
		step = Step.READY
		world.ui.toast("You are ready. The echo will wait.", 3)
	else: return
	checkpoint()

func contact(defender: Fighter, attacker: Fighter) -> void:
	if sparring != null:
		sparring.contact(defender, attacker)
		return
	if defender != world.warden or attacker != world.hero or not defender.visible: return
	world.foley.event("hit", defender.global_position, .6)
	defender.model.state = "hit"
	defender.model.elapsed = 0
	defender.reaction_serial += 1
	defender.reaction_clip = "Hit_Chest"
	if step == Step.STRIKE and attacker.model.attack_id in ["light", "trial_second", "trial_finish"]:
		practice_swing = -1
		step = Step.GUARD
		checkpoint()

func _physics_process(delta: float) -> void:
	if not world.can_play(): return
	if step == Step.STRIKE and practice_swing >= 0:
		var swing := world.hero.model
		if swing.swing_serial != practice_swing or swing.state != "attack" or swing.elapsed > float(swing.attack.windup) + float(swing.attack.active) + .12:
			practice_swing = -1
			if world.hero.position.distance_to(world.warden.position) > 1.80:
				world.ui.toast("Your blade fell short. Step onto the chalk arc.", 2.3)
			else: world.ui.toast("Face the echo for the next cut.", 2.0)
	if step == Step.GUARD:
		guard_time = guard_time + delta if world.hero.model.state == "guard" else 0.0
		if guard_time >= .35:
			step = Step.DODGE
			checkpoint()

func refresh_hud() -> void:
	if step == Step.LEAVING: return
	update_demonstration()
	var ui := world.ui
	var lesson: Array = LESSONS[step]
	ui.objective_panel.show()
	ui.chapter_label.text = lesson[0].to_upper()
	ui.objective_text.text = lesson[1]
	if step == Step.STRIKE and world.hero.position.distance_to(world.warden.position) <= 1.76:
		ui.objective_text.text = "You are in reach. Face the echo and strike."
	if step == Step.EMBER and not near_ember():
		ui.objective_text.text += "\n" + ShoreEmber.bearing(world.hero, memorial.global_position)
	elif step in [Step.LOCK, Step.STRIKE]:
		ui.objective_text.text += "\n" + ShoreEmber.bearing(world.hero, world.warden.global_position)
	ui.tutorial.text = TOUCH_HINTS[step] if ui.touch_preferred else ui.play_prompt(lesson[2])
	ui.tutorial.show()
	ui.tutorial.modulate.a = 1
	ui.help_caption.text = "Menu · Trial guide and settings" if ui.touch_preferred else ui.play_prompt("{journal} Trial guide · {pause} Pause")
	ui.status.text = "%d HP · %d draughts" % [world.hero.model.health, Session.data.heals]
	ui.interact_text.text = ""
	if step == Step.EMBER and near_ember():
		ui.interact_text.text = "Tap Listen at the ember" if ui.touch_preferred else ui.play_prompt("{interact} · Listen to the ember")
	elif sparring != null:
		ui.status.text = "Safe practice · No damage"
		ui.chapter_label.text = "READ THE BLADE"
		ui.objective_text.text = sparring.OBJECTIVES[sparring.phase]
		ui.tutorial.text = ui.play_prompt(sparring.hint())
		ui.interact_text.text = "" if ui.touch_preferred else ui.play_prompt("{interact} · Begin encounter")
	elif step == Step.READY:
		ui.interact_text.text = "Tap Begin to challenge the echo" if ui.touch_preferred else ui.play_prompt("{interact} · Challenge the first echo")

func begin_encounter() -> void:
	if step == Step.LEAVING: return
	var trained := step == Step.READY
	step = Step.LEAVING
	world.ui.interact_text.text = ""
	if from_retry: world.ui.main.call_deferred("finish_retry_practice", world.get_instance_id())
	else: world.ui.main.call_deferred("start_first_echo", world.get_instance_id(), trained)
