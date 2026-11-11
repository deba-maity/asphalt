class_name EncounterCoordinator
extends Node

var world: ChapterWorld
var active: Array[Fighter] = []
var lease: Fighter
var gap: float = 0
const MAX_ACTIVE = 3

func _physics_process(delta: float) -> void:
	gap = maxf(0,gap-delta)
	if not world.can_play(): return
	var candidates: Array[Fighter] = []
	for enemy in world.enemies:
		if not is_instance_valid(enemy) or enemy.model.state == "dead": continue
		if enemy.position.distance_to(world.hero.position)<float(enemy.definition.notice) and enemy.clear_sight(world.hero): candidates.append(enemy)
	candidates.sort_custom(func(a,b): return a.position.distance_squared_to(world.hero.position)<b.position.distance_squared_to(world.hero.position))
	active.clear()
	for i in mini(candidates.size(),MAX_ACTIVE): active.append(candidates[i])
	if is_instance_valid(lease) and lease.model.state != "attack":
		lease = null
		gap = .20
	for enemy in active: enemy.wait_age += delta

func may_attack(enemy: Fighter) -> bool:
	if enemy not in active or gap>0: return false
	if is_instance_valid(lease): return lease == enemy
	var oldest: Fighter = enemy
	for other in active:
		var reach: float = 15 if other.definition.behavior == "ranged" else 3.2
		if other.model.can_begin() and other.position.distance_to(world.hero.position)<reach and other.wait_age>oldest.wait_age+.4: oldest=other
	if oldest != enemy: return false
	lease = enemy
	enemy.wait_age = 0
	return true
