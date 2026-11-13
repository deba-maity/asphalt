class_name ActionBuffer
extends RefCounted

var action: String=""
var remaining: float=0
var direction: Vector3=Vector3.ZERO
const WINDOW = .16

func push(id: String, model: CombatModel, at: Vector3) -> bool:
	# One most-recent intent; never store through story, hit, death or an entire attack.
	if model.state in ["talk","transition","dead","hit"]: return false
	if model.state=="attack" and model.elapsed<float(model.attack.windup)+float(model.attack.active): return false
	action=id
	direction=at
	remaining=WINDOW
	return true

func tick(delta: float) -> void:
	remaining=maxf(0,remaining-delta)
	if remaining<=0: clear()

func clear() -> void:
	action=""
	remaining=0
