class_name CombatModel
extends RefCounted

static var shared_config: Dictionary={}
var config: Dictionary=definitions()

static func definitions() -> Dictionary:
	if shared_config.is_empty(): shared_config=JSON.parse_string(FileAccess.get_file_as_string("res://content/combat.json"))
	return shared_config
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
var resolve: float = 3.0
var ash_unlocked: bool = false
var counter_window: float = 0
var posture: float = 0
var story_fall: bool = false
var parry_multiplier: float=1.0
var heal_pending: bool=false
var parry_rearm: float=0
var parry_armed: bool=true
var last_guard_broken: bool=false

func can_begin() -> bool:
	return state == "idle" or state == "guard"

func spend(amount: float) -> bool:
	if not is_finite(amount) or amount<0 or not is_finite(stamina): return false
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

func ashstep() -> bool:
	if not ash_unlocked or not can_begin() or resolve < 1.0: return false
	resolve -= 1
	state = "ashstep"
	elapsed = 0
	return true

func dodge() -> bool:
	if not can_begin() or not spend(float(config.stamina.dodge_cost)):
		return false
	state = "dodge"
	elapsed = 0
	return true

func guard(pressed: bool, fresh_press: bool=true) -> void:
	if pressed and state == "idle":
		state = "guard"
		elapsed = 0
		parry_armed=fresh_press and parry_rearm<=0
		if fresh_press: parry_rearm=float(config.get("parry_rearm",0))
	elif not pressed and state == "guard":
		state = "idle"
		elapsed = 0

func heal() -> bool:
	if not can_begin() or health >= max_health:
		return false
	state = "heal"
	elapsed = 0
	heal_pending=float(config.get("heal_apply_at",0))>0
	if not heal_pending: health = minf(max_health, health + 48)
	return true

func freeze(next: String) -> bool:
	if state == "dead" or (next == "talk" and not can_begin()):
		return false
	state = next
	elapsed = 0
	return true

func active() -> bool:
	if state=="attack" and attack.has("hit_windows"): return active_window()>=0
	return state == "attack" and elapsed >= float(attack.windup) and elapsed < float(attack.windup) + float(attack.active)

func active_window() -> int:
	var time=elapsed*float(attack.get("rate",1.0))-float(attack.get("lead_in",0))
	var windows: Array=attack.get("hit_windows",[])
	for index in windows.size():
		if time>=float(windows[index][0]) and time<float(windows[index][1]): return index
	return -1

func claim_hit(target_id: int) -> bool:
	return claim_swept_hit(target_id,elapsed)

# Sweeps can cross the end of a damage window between physics ticks. Validate
# the actual contact time instead of dropping the final fraction of that cut.
func claim_swept_hit(target_id: int, contact_time: float) -> bool:
	if state!="attack" or not is_finite(contact_time) or contact_time<0 or contact_time>elapsed+.0001: return false
	var window=-1
	if attack.has("hit_windows"):
		var clip_time=contact_time*float(attack.get("rate",1.0))-float(attack.get("lead_in",0))
		for index in attack.hit_windows.size():
			if clip_time>=float(attack.hit_windows[index][0]) and clip_time<float(attack.hit_windows[index][1]): window=index
		if window<0: return false
	elif contact_time<float(attack.windup) or contact_time>=float(attack.windup)+float(attack.active): return false
	var key: Variant=str(target_id)+":"+str(window) if attack.has("hit_windows") else target_id
	if victims.has(key):
		return false
	victims[key] = true
	damage_events += 1
	return true

func invulnerable() -> bool:
	if state == "ashstep": return elapsed >= .04 and elapsed <= .36
	return state == "dodge" and elapsed >= float(config.dodge.invulnerable_start) and elapsed <= float(config.dodge.invulnerable_end)

func receive(amount: float, in_front: bool = true, armored: bool = false, rules: Dictionary = {}) -> String:
	last_guard_broken=false
	if not is_finite(amount) or amount<=0: return "ignored"
	if state in ["dead", "talk", "transition"]:
		return "ignored"
	if invulnerable() and rules.get("dodgeable",true):
		if state == "ashstep" and elapsed<=.22:
			counter_window = 2.5
			return "ash_evade"
		return "ignored"
	if state == "guard" and in_front:
		var window=float(config.parry_window)*parry_multiplier
		if parry_armed and elapsed <= window and rules.get("parryable",true) and spend(5):
			parry_flash = 0.3
			posture=maxf(0,posture-float(config.get("parry_posture_relief",0)))
			if ash_unlocked: counter_window = 2.5
			resolve = minf(3,resolve+0.75)
			return "parry"
		posture=minf(100,posture+float(rules.get("posture",10)))
		if rules.get("blockable",true) and posture<100 and spend(amount*1.15+float(rules.get("stamina_damage",0))): return "guard"
		last_guard_broken=rules.get("blockable",true)
	health = maxf(0, health - amount)
	if health <= 0:
		state = "dead"
		elapsed = 0
		return "dead"
	if not armored:
		state = "hit"
		elapsed = -float(config.get("guard_break_stagger",0)) if last_guard_broken else 0.0
		if last_guard_broken and config.has("guard_break_stagger"):
			posture=minf(posture,45)
			regen_delay=maxf(regen_delay,float(config.stamina.delay))
	return "hit"

func tick(delta: float) -> void:
	if not is_finite(delta) or delta<=0: return
	elapsed += delta
	parry_rearm=maxf(0,parry_rearm-delta)
	if state!="heal": heal_pending=false
	if state=="heal" and heal_pending and elapsed>=float(config.get("heal_apply_at",0)):
		health=minf(max_health,health+48)
		heal_pending=false
	parry_flash = maxf(0,parry_flash-delta)
	counter_window = maxf(0,counter_window-delta)
	regen_delay = maxf(0, regen_delay - delta)
	if regen_delay<=0 and state=="idle": posture=maxf(0,posture-18*delta)
	if regen_delay <= 0 and state in ["idle", "guard"]:
		stamina = minf(100, stamina + float(config.stamina.regeneration) * delta * (0.35 if state == "guard" else 1.0))
	var done: bool = false
	if state == "attack":
		done = elapsed >= float(attack.windup) + float(attack.active) + float(attack.recovery)
	elif state == "dodge":
		done = elapsed >= float(config.dodge.duration)
	elif state == "ashstep":
		done = elapsed >= .5
	elif state == "hit":
		done = elapsed >= float(config.get("hit_duration",.38))
	elif state == "heal":
		done = elapsed >= float(config.get("heal_duration",.85))
	if done:
		state = "idle"
		elapsed = 0
