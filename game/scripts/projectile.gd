class_name LedgerProjectile
extends Node3D

var source: Fighter
var world: ChapterWorld
var direction: Vector3
var damage: float = 16
var age: float = 0

func _ready() -> void:
	add_to_group("projectiles")
	var shaft = Figure.box(self,Vector3(.055,.055,.8),Vector3.ZERO,Color("f1cd87"))
	shaft.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	look_at(position+direction,Vector3.UP)

func _physics_process(delta: float) -> void:
	if not is_instance_valid(world) or not world.can_play(): return
	age += delta
	if age>3.5 or not is_instance_valid(source) or source.model.state == "dead": queue_free(); return
	var next = global_position+direction*12*delta
	var ray = PhysicsRayQueryParameters3D.create(global_position,next,1|8)
	ray.collide_with_areas = true
	ray.collide_with_bodies = true
	var hit = get_world_3d().direct_space_state.intersect_ray(ray)
	if not hit.is_empty():
		if hit.collider.has_meta("fighter"):
			var hero: Fighter = hit.collider.get_meta("fighter")
			hero.take_damage(damage,source)
		queue_free()
	else: global_position = next
