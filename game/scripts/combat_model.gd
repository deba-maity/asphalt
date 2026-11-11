class_name CombatModel
extends RefCounted

var config: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://content/combat.json"))
var state: String = "idle"
var elapsed: float = 0.0
var health: float = 100.0
var max_health: float = 100.0
var stamina: float = 100.0
var regen_delay: float = 0.0
var attack: Dictionary = {}
var attack_id: String = ""
var swing_serial: int = 0
var victims: Dictionary = {}
var damage_events: int = 0
var parry_flash: float = 0

func can_begin() -> bool:
	return state == "idle" or state == "guard"

func spend(amount: float) -> bool:
	if stamina + 0.001 < amount:
		return false
	stamina = maxf(0, stamina - amount)
	regen_delay = float(config.stamina.delay)
	return true

func start_attack(id: String) -> bool:
	if not can_begin() or not config.attacks.has(id):
		return false
	var next: Dictionary = config.attacks[id]
	if not spend(float(next.cost)):
		return false
	attack = next
	attack_id = id
	swing_serial += 1
	victims.clear()
	state = "attack"
	elapsed = 0
	return true

func dodge() -> bool:
	if not can_begin() or not spend(float(config.stamina.dodge_cost)):
		return false
	state = "dodge"
	elapsed = 0
	return true

func guard(pressed: bool) -> void:
	if pressed and state == "idle":
		state = "guard"
		elapsed = 0
	elif not pressed and state == "guard":
		state = "idle"
		elapsed = 0

func heal() -> bool:
	if not can_begin() or health >= max_health:
		return false
	state = "heal"
	elapsed = 0
	health = minf(max_health, health + 48)
	return true

func freeze(next: String) -> bool:
	if state == "dead" or (next == "talk" and not can_begin()):
		return false
	state = next
	elapsed = 0
	return true

func active() -> bool:
	return state == "attack" and elapsed >= float(attack.windup) and elapsed < float(attack.windup) + float(attack.active)

func claim_hit(target_id: int) -> bool:
	if not active() or victims.has(target_id):
		return false
	victims[target_id] = true
	damage_events += 1
	return true

func invulnerable() -> bool:
	return state == "dodge" and elapsed >= float(config.dodge.invulnerable_start) and elapsed <= float(config.dodge.invulnerable_end)

func receive(amount: float, in_front: bool = true, armored: bool = false) -> String:
	if state in ["dead", "talk", "transition"] or invulnerable():
		return "ignored"
	if state == "guard" and in_front:
		if elapsed <= float(config.parry_window) and spend(5):
			parry_flash = 0.3
			return "parry"
		if spend(amount * 1.15):
			return "guard"
	health = maxf(0, health - amount)
	if health <= 0:
		state = "dead"
		elapsed = 0
		return "dead"
	if not armored:
		state = "hit"
		elapsed = 0
	return "hit"

func tick(delta: float) -> void:
	elapsed += delta
	parry_flash = maxf(0,parry_flash-delta)
	regen_delay = maxf(0, regen_delay - delta)
	if regen_delay <= 0 and state in ["idle", "guard"]:
		stamina = minf(100, stamina + float(config.stamina.regeneration) * delta * (0.35 if state == "guard" else 1.0))
	var done: bool = false
	if state == "attack":
		done = elapsed >= float(attack.windup) + float(attack.active) + float(attack.recovery)
	elif state == "dodge":
		done = elapsed >= float(config.dodge.duration)
	elif state == "hit":
		done = elapsed >= 0.38
	elif state == "heal":
		done = elapsed >= 0.85
	if done:
		state = "idle"
		elapsed = 0
