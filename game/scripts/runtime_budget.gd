class_name RuntimeBudget
extends Node

# Rendering limits do not alter physics ticks or combat timing. Idle scenes
# stop animating; focus loss pauses play and lowers the presentation budget.
var main: Node
var focused: bool=true
var held_world: Node
var previous_mode: ProcessMode=Node.PROCESS_MODE_INHERIT
var effective_cap: int=60
var idle: bool=false
const IDLE_MODES=["menu","archive","credits_info","settings","pause","journal","trial_briefing","trial_result"]

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT: focused=false
	elif what==NOTIFICATION_APPLICATION_FOCUS_IN: focused=true

func _process(_delta: float) -> void:
	update_policy()

func update_policy() -> void:
	if main==null or main.ui==null or main.closing: return
	idle=main.ui.mode in IDLE_MODES or not focused
	var world=main.world
	if is_instance_valid(held_world) and (held_world!=world or not idle):
		if held_world.process_mode==Node.PROCESS_MODE_DISABLED: held_world.process_mode=previous_mode
		held_world=null
	if idle and is_instance_valid(world) and held_world!=world:
		held_world=world; previous_mode=world.process_mode
		world.process_mode=Node.PROCESS_MODE_DISABLED
	effective_cap=mini(Preferences.fps_cap,10 if not focused else (30 if idle else Preferences.fps_cap))
	Engine.max_fps=effective_cap
	OS.low_processor_usage_mode=idle
	OS.low_processor_usage_mode_sleep_usec=50000 if not focused else 16000
