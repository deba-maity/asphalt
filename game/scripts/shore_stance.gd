class_name ShoreStance
extends RefCounted

# Only the pose and equipment presentation live here. Combat owns every input,
# damage window and action transition, including actions that interrupt a gesture.
var peaceful := false
var gesture := ""
var time := 0.0
var rest_time := 0.0
var hold_ready := 0.0
var sword_on_back := false
var reach_then_draw := false
var demonstrating_guard := false

func arrive() -> void:
	demonstrating_guard = false
	peaceful = true
	gesture = ""
	rest_time = 0.0
	hold_ready = 0.0
	sword_on_back = true
	reach_then_draw = false

func ready_sword(reach: bool = false) -> void:
	peaceful = false
	reach_then_draw = reach
	time = 0.0
	gesture = "Interact" if reach else "Sword_Enter"
	sword_on_back = true

func rest_sword() -> void:
	peaceful = true
	reach_then_draw = false
	hold_ready = 0.0
	rest_time = 0.0
	time = 0.0
	gesture = "" if sword_on_back else "Sword_Exit"

func step(delta: float, state: String, speed: float, library: AnimationLibrary) -> void:
	if state != "idle":
		gesture = ""
		reach_then_draw = false
		sword_on_back = false
		hold_ready = 1.6
		return
	if hold_ready > 0:
		hold_ready = maxf(0, hold_ready - delta)
		if hold_ready == 0 and peaceful: rest_sword()
	if gesture.is_empty():
		if speed > .15: rest_time = 0.0
		else: rest_time += delta
		return
	time += delta
	match gesture:
		"Sword_Enter": sword_on_back = time < .65
		"Sword_Exit": sword_on_back = time >= .54
	if time >= library.get_animation(gesture).length:
		if reach_then_draw: ready_sword()
		else: gesture = ""

func resting_clip() -> String:
	if not gesture.is_empty(): return gesture
	if demonstrating_guard: return "Sword_Block"
	if not peaceful or not sword_on_back: return "Sword_Idle"
	if fposmod(rest_time, 13.0) >= 8.4: return "Idle_LookAround"
	return "Idle"

func sample_time(clock: float) -> float:
	if not gesture.is_empty(): return time
	if demonstrating_guard: return .20
	if resting_clip() == "Idle_LookAround": return fposmod(rest_time, 13.0) - 8.4
	return clock
