class_name TrialArrival
extends Node3D

enum Step { EMBER, LOCK, STRIKE, GUARD, DODGE, READY, LEAVING }

const LESSONS = [
	["The Counting Shore", "Walk to the ember in the stone ring.", "{move_forward}/{move_left}/{move_back}/{move_right} or left stick to walk. Mouse or right stick to look."],
	["Find your footing", "Focus on the waiting echo.", "{lock_on} or RB to lock on. Stay within sight of the echo."],
	["Find your reach", "Step close and land a light strike.", "{light} or X to strike. If your blade misses, take another step."],
	["Raise your guard", "Hold guard until your stance settles.", "Hold {guard} or LB. Release to recover stamina."],
	["Make room", "Roll clear of the echo.", "Use {dodge} or B. Hold a movement direction to choose where to roll."],
	["The first echo", "The echo waits for your answer.", "You can keep practicing. Begin the encounter when you are ready."]
]

const TOUCH_HINTS := [
	"Drag the left pad to walk. Swipe the court to look around.",
	"Tap Lock while the echo is in sight.",
	"Move within sword's reach, then tap Strike.",
	"Hold Guard until your stance settles.",
	"Tap Roll. Hold the left pad to roll in that direction.",
	"Tap Begin when you are ready for the first encounter."
]

var world: TrialWorld
var step: Step = Step.EMBER
var memorial: Node3D
var flame: MeshInstance3D
var guard_time: float = 0
var ember_time: float = 0

func _ready() -> void:
	var echo := world.warden
	echo.ai_enabled = false
	echo.hide()
	echo.collision_layer = 0
	echo.hurtbox.collision_layer = 0
	world.enemies.erase(echo)
	memorial = Node3D.new()
	memorial.position = Vector3(1.05, 0, 0)
	add_child(memorial)
	var plinth := Figure.cylinder(memorial, .68, .58, .24, Vector3.UP * .14, Color.WHITE, 12)
	plinth.material_override = CourtArt.material("castle_brick_07", 1.4)
	var basin := Figure.cylinder(memorial, .28, .43, .19, Vector3.UP * .36, Color.WHITE, 24)
	basin.material_override = SurfaceLibrary.material("steel", Color("67523b"), 1.1)
	var coals := Figure.cylinder(memorial, .36, .36, .025, Vector3.UP * .47, Color("442820"), 24)
	coals.material_override = SurfaceLibrary.material("stone", Color("442820"), 2.0)
	var ember := StandardMaterial3D.new()
	ember.albedo_color = Color("ffdc91")
	ember.emission_enabled = true
	ember.emission = Color("ffac53")
	ember.emission_energy_multiplier = 1.7
	flame = MeshInstance3D.new()
	var gem := SphereMesh.new()
	gem.radial_segments = 5
	gem.rings = 2
	gem.radius = .105
	gem.height = .24
	flame.mesh = gem
	flame.material_override = ember
	flame.position.y = .71
	memorial.add_child(flame)
	var ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = .91
	torus.outer_radius = .95
	torus.rings = 32
	torus.ring_segments = 6
	ring.mesh = torus
	var ring_ink := StandardMaterial3D.new()
	ring_ink.albedo_color = Color("bf995b")
	ring_ink.metallic = .5
	ring.material_override = ring_ink
	ring.position.y = .05
	memorial.add_child(ring)
	var glow := OmniLight3D.new()
	glow.light_color = Color("ffbb68")
	glow.light_energy = 1.7
	glow.omni_range = 4
	glow.position.y = .85
	memorial.add_child(glow)

func near_ember() -> bool:
	return world.hero.global_position.distance_to(memorial.global_position) < 2.1

func interact() -> void:
	if step == Step.READY:
		begin_encounter()
	elif step == Step.EMBER and near_ember():
		world.warden.show()
		world.warden.collision_layer = 4
		world.warden.hurtbox.collision_layer = 16
		world.enemies.append(world.warden)
		var nameplate := Label3D.new()
		nameplate.text = "PRACTICE ECHO"
		nameplate.font_size = 30
		nameplate.pixel_size = .003
		nameplate.outline_size = 7
		nameplate.modulate = Color("c0e5d6")
		nameplate.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		nameplate.position = world.warden.position + Vector3.UP * 2.45
		add_child(nameplate)
		memorial.hide()
		step = Step.LOCK
		world.foley.event("heal", world.warden.global_position)
		world.ui.announce("THE FIRST ECHO")
		world.ui.toast("Keeper: Its blade will stay lowered until you give the word.", 4)
		refresh_hud()

func learn(action: String) -> void:
	if step == Step.LOCK and action == "lock" and world.hero.target == world.warden:
		step = Step.STRIKE
	elif step == Step.DODGE and action == "dodge":
		step = Step.READY
		world.ui.toast("You are ready. The echo will wait.", 3)
	else: return
	refresh_hud()

func contact(defender: Fighter, attacker: Fighter) -> void:
	if defender != world.warden or attacker != world.hero or not defender.visible: return
	world.foley.event("hit", defender.global_position, .6)
	defender.model.state = "hit"
	defender.model.elapsed = 0
	defender.reaction_serial += 1
	defender.reaction_clip = "Hit_Chest"
	if step == Step.STRIKE and attacker.model.attack_id in ["light", "trial_second", "trial_finish"]:
		step = Step.GUARD
		refresh_hud()

func _physics_process(delta: float) -> void:
	if not world.can_play(): return
	if step == Step.EMBER and not Preferences.reduced_effects:
		ember_time += delta
		flame.rotation.y = ember_time * .65
		flame.position.y = .71 + sin(ember_time * 2.3) * .045
	elif step == Step.GUARD:
		guard_time = guard_time + delta if world.hero.model.state == "guard" else 0.0
		if guard_time >= .35:
			step = Step.DODGE
			refresh_hud()

func bearing_to(point: Vector3) -> String:
	var offset := point - world.hero.global_position
	offset.y = 0
	var forward := -world.hero.camera.global_basis.z
	forward.y = 0
	var angle := forward.signed_angle_to(offset, Vector3.UP)
	var bearing := "ahead" if absf(angle) < .5 else ("behind" if absf(angle) > 2.6 else ("left" if angle > 0 else "right"))
	return "%d m %s" % [ceili(offset.length()), bearing]

func refresh_hud() -> void:
	if step == Step.LEAVING: return
	var ui := world.ui
	var lesson: Array = LESSONS[step]
	ui.objective_panel.show()
	ui.chapter_label.text = lesson[0].to_upper()
	ui.objective_text.text = lesson[1]
	if step == Step.EMBER and not near_ember():
		ui.objective_text.text += "\n" + bearing_to(memorial.global_position)
	elif step in [Step.LOCK, Step.STRIKE]:
		ui.objective_text.text += "\n" + bearing_to(world.warden.global_position)
	ui.tutorial.text = TOUCH_HINTS[step] if ui.touch_preferred else Preferences.prompt(lesson[2])
	ui.tutorial.show()
	ui.tutorial.modulate.a = 1
	ui.help_caption.text = "Menu · Trial guide and settings" if ui.touch_preferred else Preferences.prompt("{journal} Trial guide · {pause} Pause")
	ui.status.text = "%d HP · %d draughts" % [world.hero.model.health, Session.data.heals]
	ui.interact_text.text = ""
	if step == Step.EMBER and near_ember():
		ui.interact_text.text = "Tap Listen at the ember" if ui.touch_preferred else Preferences.prompt("{interact} / A · Listen to the ember")
	elif step == Step.READY:
		ui.interact_text.text = "Tap Begin to challenge the echo" if ui.touch_preferred else Preferences.prompt("{interact} / A · Challenge the first echo")

func begin_encounter() -> void:
	if step == Step.LEAVING: return
	var trained := step == Step.READY
	step = Step.LEAVING
	world.ui.interact_text.text = ""
	world.ui.main.call_deferred("start_first_echo", world.get_instance_id(), trained)
