class_name ActionBuffer
extends RefCounted

var action: String=""
var remaining: float=0
var direction: Vector3=Vector3.ZERO
const WINDOW = .16
var window: float=WINDOW

func push(id: String, model: CombatModel, at: Vector3) -> bool:
	# One most-recent intent; never store through story, hit, death or an entire attack.
	if model.state in ["talk","transition","dead","hit"]: return false
	var opening=float(model.attack.get("windup",0))+float(model.attack.get("active",0))
	if window>WINDOW: opening=float(model.attack.get("windup",0))
	if model.state=="attack" and model.elapsed<opening: return false
	action=id
	direction=at
	remaining=window
	return true

func tick(delta: float) -> void:
	remaining=maxf(0,remaining-delta)
	if remaining<=0: clear()

func clear() -> void:
	action=""
	remaining=0
