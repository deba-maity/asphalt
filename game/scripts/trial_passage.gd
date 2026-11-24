class_name TrialPassage
extends RefCounted

# These are echoes on the Counting Shore, not three more living victims.
# Lessons suggest techniques but never require a precise parry to progress.
const WARDEN=3
const ENCOUNTERS=[
	{"name":"THE FIRST ECHO", "chapter":"01 / FIND YOUR FEET", "health":60.0, "damage":.25, "rate":.78, "speed":1.05, "rest":2.1,
	"title":"A road back from death",
	"story":"Avel betrayed you on the Copper Stair. Now you stand between life and ash.\n\nMira and Isha are gone. The register that can expose their killers is still in the living world. You have one reason to return: carry their names into the dawn.",
	"voice":"KEEPER: The gate will take the sound of Isha's voice. Her words remain. If you choose to return, first remember how to stand.",
	"lesson":"Three gentle echoes prepare you for the Cinder Warden.\nMove, find your reach, then strike. Health and draughts refill between encounters.",
	"after":"Your feet remember the road. The echo yields; no living soul has fallen."},
	{"name":"THE PATIENT ECHO", "chapter":"02 / KEEP YOUR BREATH", "health":90.0, "damage":.35, "rate":.84, "speed":1.2, "rest":1.7,
	"title":"A blade is not a shelter", "rest_hint":"The next echo raises its shoulder before an ordinary cut. Hold guard until the blade passes.",
	"story":"The second echo carries the patience you lost on the road to revenge. It gives you time to read the shoulders before the blade moves.",
	"voice":"KEEPER: You cannot carry their names if you spend every breath on anger.",
	"lesson":"Hold {guard} to guard a normal cut, or use {dodge} to roll clear.\nA raised cleave cannot be blocked. Roll away, then answer during recovery.\nA perfect parry is useful, but never required.",
	"after":"You leave room for another breath. The second echo lowers its blade."},
	{"name":"THE RESOLUTE ECHO", "chapter":"03 / CHOOSE YOUR OPENING", "health":125.0, "damage":.5, "rate":.92, "speed":1.35, "rest":1.2,
	"title":"Strength without haste", "rest_hint":"The next echo cuts twice. Let the second swing pass before answering with a heavy strike.",
	"story":"The last echo moves twice before it rests. You must decide when to press forward and when to let the storm pass.",
	"voice":"KEEPER: Do not return merely to become another name in his ledger.",
	"lesson":"Wait for the short combination to end. Use {heavy} in its recovery.\nHeavy hits and parries fill COMPOSURE; breaking it opens a close-range heavy riposte.\nUse {heal} while safe if you need a draught.",
	"after":"The last echo parts. Beyond it, the Warden waits without a teacher's restraint."},
	{"name":"THE CINDER WARDEN", "chapter":"04 / THE ASHEN VOW", "health":340.0, "damage":1.0, "rate":1.0, "speed":1.55, "rest":.75,
	"title":"The price of passage", "rest_hint":"The Warden quickens at half health. Keep one roll in reserve when you close in.",
	"story":"The echoes have shown you the way. The Warden now tests whether you can keep it under pressure. Defeat him and the gate will open.\n\nYou will remember Isha's words, but never again the sound of her voice. The names in the register will still be yours to carry.",
	"voice":"RAYAN: Not for revenge alone. Let them be remembered.",
	"lesson":"The Warden uses longer combinations and quickens below half health.\nRead his shoulders, keep stamina to escape, and punish the end of a pattern.",
	"after":"The gate opens. Isha's words remain, but the sound of her voice slips beyond reach. You step toward dawn with the names the Ledger tried to erase."}
]

var stage: int=WARDEN
var learned: Dictionary={}

func _init(index: int=WARDEN) -> void:
	stage=clampi(index,0,WARDEN)

func entry() -> Dictionary:
	return ENCOUNTERS[stage]

func training() -> bool:
	return stage<WARDEN

func configure(actor: Fighter) -> void:
	if not training(): return
	var data=entry()
	actor.model.max_health=data.health; actor.model.health=data.health
	actor.definition=actor.definition.duplicate(true)
	actor.definition.speed=data.speed
	actor.scale=Vector3.ONE*(1.0+stage*.025)
	actor.ai_cooldown=4.0 if stage==0 else 2.5
	for id in actor.model.config.attacks:
		var attack: Dictionary=actor.model.config.attacks[id]
		if not attack.has("clip"): continue
		attack.damage*=data.damage
		# One authored clock still drives the pose, root motion and damage.
		attack.rate*=data.rate
		for key in ["windup","active","recovery","tracking"]:
			if attack.has(key): attack[key]/=data.rate
		# hit_windows and lead_in are clip seconds; leave those unchanged.
	# Each knight's armor materials are private copies. Give the echoes a visible
	# spectral rim while preserving the Warden's own dark steel.
	var echo_color: Color = [Color("81baad"), Color("8ca4c1"), Color("c6ac87")][stage]
	for piece in actor.figure.model_root.find_children("Knight*", "MeshInstance3D", true, false):
		for surface in piece.mesh.get_surface_count():
			var armor = piece.get_surface_override_material(surface)
			if armor is StandardMaterial3D:
				armor.albedo_color = echo_color
				armor.rim_enabled = true
				armor.rim = .72
				armor.rim_tint = .85
				armor.emission_enabled = true
				armor.emission = echo_color
				armor.emission_energy_multiplier = .12
	var cape=actor.figure.cape.material_override
	cape.set_shader_parameter("cloth_color",[Color("716350"),Color("435d63"),Color("695044")][stage])

func patterns(phase: int) -> Array:
	match stage:
		0: return [["light"]]
		1: return [["light"],["heavy"]]
		2: return [["light","trial_second"],["heavy"]]
	return TrialDuel.FIRST_PATTERNS if phase==1 else TrialDuel.LAST_PATTERNS

func learn(action: String) -> void:
	learned[action]=true

func hint(world: TrialWorld) -> String:
	if not training(): return "Read the shoulders. Answer after the final cut; keep stamina to escape."
	if world.hero.model.health<55 and Session.data.heals>0: return "{heal} Drink a draught when safe. Being hit interrupts healing."
	if world.hero.model.stamina<28: return "Let stamina recover. Walking costs nothing; leave enough for one roll."
	if stage==0:
		if learned.has("rehearsal"):
			if world.duel.hits == 0: return "Read the echo's shoulder. Hold {guard} through its cut and use {light} as it recovers."
			return "A landed strike costs stamina. Walk between attacks and finish the echo at your own pace."
		if world.hero.total_distance<2: return "{move_forward}/{move_left}/{move_back}/{move_right} Move · Mouse / right stick: look around"
		if not learned.has("lock"): return "{lock_on} Lock onto the echo · Stay close enough for the blade to reach"
		if world.duel.hits<2: return "{light} Strike · Press again near the end of a swing to chain it"
		return "Good. Finish the echo at your own pace. Health refills for the next lesson."
	if stage==1:
		if not learned.has("guard") and not learned.has("dodge"): return "{guard} Guard a normal cut · {dodge} Roll clear of the raised cleave"
		return "Wait for the echo's blade to stop. Then answer with {light} or {heavy}."
	if world.duel.breaks>0: return "{heavy} Riposte while close to a staggered foe · {heal} Drink only when safe"
	return "{heavy} Press the opening after a combination · Heavy hits build COMPOSURE"
