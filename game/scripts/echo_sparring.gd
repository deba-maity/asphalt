extends RefCounted

enum Phase { GUARD, EVADE, ANSWER, COMPLETE }

const OBJECTIVES := [
	"Face the echo and guard its ordinary cut.",
	"Roll through or clear of the raised cleave.",
	"Let the cleave pass, then land a light strike.",
	"You have guarded, evaded and answered a cut."
]
const HINTS := [
	"Hold {guard} before the sword reaches you.",
	"Use {dodge} as the high blade starts down.",
	"Step into reach and use {light} as the blade lowers.",
	"Begin the encounter whenever you are ready."
]

var world: TrialWorld
var phase: Phase = Phase.GUARD
var swinging := false
var guarded := false
var timely_roll := false
var struck := false
var opening := false
var rest := 1.0

func _init(court: TrialWorld) -> void:
	world = court

func active_end(mentor: Fighter) -> float:
	return float(mentor.model.attack.windup) + float(mentor.model.attack.active)

func learn(action: String) -> void:
	if phase != Phase.EVADE or action != "dodge" or not swinging: return
	if TrialDuel.near_incoming_cut(world.hero, world.warden): timely_roll = true

func contact(defender: Fighter, attacker: Fighter) -> void:
	if defender == world.hero and swinging:
		var in_front := (-defender.global_basis.z).dot((attacker.global_position - defender.global_position).normalized()) > 0
		if phase == Phase.GUARD and defender.model.state == "guard" and in_front:
			guarded = true
			world.foley.event("guard", defender.global_position)
			defender.figure.recoil(false)
		elif phase in [Phase.EVADE, Phase.ANSWER] and defender.model.invulnerable():
			timely_roll = true
		else:
			struck = true
			opening = false
			if phase == Phase.GUARD: world.ui.toast("Face the echo and hold guard through the cut.", 2)
			elif phase == Phase.EVADE: world.ui.toast("That cleave reached you. Watch the high blade drop, then roll.", 2)
			else: world.ui.toast("Stay clear of the cleave before stepping in to strike.", 2)
		return
	if defender != world.warden or attacker != world.hero or phase != Phase.ANSWER: return
	if not opening:
		world.ui.toast("Wait for the blade to pass. Strike as the echo recovers.", 2)
		return
	if attacker.model.attack_id not in ["light", "trial_second", "trial_finish"]: return
	world.foley.event("hit", defender.global_position)
	phase = Phase.COMPLETE
	opening = false
	world.ui.toast("Keeper: Now you know when to answer.", 3)

func drive(mentor: Fighter, delta: float) -> void:
	if phase == Phase.COMPLETE or not world.can_play(): return
	var hero := world.hero
	if mentor.model.state == "attack":
		if mentor.model.elapsed < float(mentor.model.attack.get("tracking", .12)): mentor.face(hero.global_position)
		if phase == Phase.ANSWER and not struck and mentor.model.elapsed > active_end(mentor): opening = true
		return
	if swinging:
		swinging = false
		rest = 1.0
		if phase == Phase.GUARD and guarded:
			phase = Phase.EVADE
			world.ui.toast("You held the cut. Read the raised blade next.", 3)
		elif phase == Phase.EVADE and timely_roll and not struck:
			phase = Phase.ANSWER
			world.ui.toast("Clear of the cleave. Land a light strike after the next one.", 3)
		elif phase == Phase.ANSWER: opening = not struck
	rest = maxf(0, rest - delta)
	if not mentor.model.can_begin(): return
	var offset := hero.global_position - mentor.global_position
	offset.y = 0
	if offset.length() > .05: mentor.face(hero.global_position)
	if rest > 0: return
	if offset.length() > 1.6 or not mentor.clear_sight(hero):
		world.duel.move_tactically(mentor, offset.normalized(), 1.6)
		return
	if mentor.try_attack("light" if phase == Phase.GUARD else "heavy"):
		swinging = true
		guarded = false
		timely_roll = false
		struck = false
		opening = false

func cue() -> String:
	if phase == Phase.COMPLETE: return "PRACTICE COMPLETE"
	if opening: return "OPENING · STRIKE"
	var swing := world.warden.model
	if swing.state != "attack": return ""
	if phase == Phase.GUARD:
		if guarded: return "BLOCKED"
		return "HOLD GUARD"
	if struck: return "CLEAVE LANDED · TRY AGAIN"
	if swing.elapsed < float(swing.attack.windup) - .30: return "BLADE RISING · WAIT"
	if swing.elapsed <= active_end(world.warden): return "ROLL NOW"
	return "BLADE PASSED"
