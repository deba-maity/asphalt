class_name TrialDuel
extends RefCounted

# Encounter decisions use distance, line of sight and the Warden's own state.
# They never inspect a queued player input or change a committed damage window.
const FIRST_PATTERNS = [["light","trial_second"],["heavy"],["light","trial_finish"]]
const LAST_PATTERNS = [["light","trial_second","trial_finish"],["heavy","light"],["trial_second","heavy"]]
var world: Node
var elapsed: float=0
var finished: bool=false
var composure: float=0
var composure_delay: float=0
var break_cooldown: float=0
var riposte_window: float=0
var pattern_index: int=0
var cut_index: int=0
var recovery: float=0
var was_attacking: bool=false
var pattern_finished: bool=false
var hits: int=0
var parries: int=0
var evades: int=0
var breaks: int=0
var ripostes: int=0
var damage_taken: float=0
var attacks_started: int=0
var advance_cooldown: float=2.5

func _init(owner_world: Node) -> void:
	world=owner_world

func tick(delta: float) -> void:
	if finished or not world.can_play(): return
	elapsed+=delta
	riposte_window=maxf(0,riposte_window-delta)
	break_cooldown=maxf(0,break_cooldown-delta)
	composure_delay=maxf(0,composure_delay-delta)
	if composure_delay<=0 and riposte_window<=0:
		composure=maxf(0,composure-delta*9)

func can_riposte() -> bool:
	return not finished and riposte_window>0 and world.warden.model.state=="hit" and world.hero.global_position.distance_to(world.warden.global_position)<=2.5

func attack_started(actor: Fighter, id: String) -> void:
	if finished or not actor.player: return
	attacks_started+=1
	if id=="trial_riposte":
		riposte_window=0
		ripostes+=1

func contact(attacker: Fighter, defender: Fighter, result: String, rules: Dictionary, health_lost: float) -> void:
	# A lethal hit has already changed the hero's state before this callback.
	# Count that last contact even though can_play() now correctly returns false.
	if finished or world.ui.mode!="play": return
	if defender.player:
		if result=="parry":
			parries+=1
			pressure(38)
		elif result=="ignored" and defender.model.invulnerable() and rules.get("dodgeable",true):
			evades+=1
		if health_lost>0:
			damage_taken+=health_lost
			riposte_window=0
	elif attacker.player and health_lost>0:
		hits+=1
		if result!="dead": pressure(28 if rules.get("pose","")=="heavy" else 11)

func pressure(amount: float) -> void:
	if finished or break_cooldown>0 or world.warden.model.state=="dead": return
	composure=minf(100,composure+amount)
	composure_delay=3.8
	if composure<100: return
	composure=0
	break_cooldown=5.0
	riposte_window=1.8
	breaks+=1
	var boss: Fighter=world.warden
	boss.model.state="hit"
	boss.model.config["hit_duration"]=boss.figure.library.get_animation("Hit_Chest").length
	boss.model.elapsed=float(boss.model.config.hit_duration)-1.85
	boss.reaction_serial+=1
	boss.reaction_clip="Hit_Chest"
	boss.intent.clear()
	world.ui.toast("Composure broken - close in and use {heavy} for a riposte.",2.5)

func phase_changed() -> void:
	# Finish the current cut before selecting a different pattern family.
	pattern_index=0
	cut_index=0
	pattern_finished=false
	recovery=.65

func drive_warden(actor: Fighter, delta: float) -> void:
	actor.velocity.x=0; actor.velocity.z=0
	if finished or not actor.ai_enabled or not world.can_play() or actor.model.state in ["dead","talk","transition"]: return
	var hero: Fighter=world.hero
	if hero.model.state=="dead": return
	actor.ai_cooldown=maxf(0,actor.ai_cooldown-delta)
	recovery=maxf(0,recovery-delta)
	advance_cooldown=maxf(0,advance_cooldown-delta)
	if was_attacking and actor.model.state!="attack":
		var rest: float=world.passage.entry().rest if world.passage.training() else (.75 if actor.phase==1 else .5)
		recovery=maxf(recovery,rest if pattern_finished else .16)
		was_attacking=false
	if actor.model.state=="attack":
		was_attacking=true
		if actor.model.elapsed<float(actor.model.attack.get("tracking",.12)): actor.face(hero.global_position)
		return
	if not actor.model.can_begin(): return
	var diff: Vector3=hero.global_position-actor.global_position
	diff.y=0
	var distance: float=diff.length()
	if distance>.05: actor.face(hero.global_position)
	if distance>float(actor.definition.notice): return
	var forward: Vector3=diff.normalized()
	if not actor.clear_sight(hero):
		move_tactically(actor,forward,float(actor.definition.speed))
		return
	if distance>1.85:
		# A committed, authored advancing cut. Only range, current state and
		# clear space select it; the player's buttons are never inspected.
		if actor.phase==2 and distance>=2.8 and distance<=4.0 and advance_cooldown<=0 and recovery<=0 and actor.ai_cooldown<=0:
			var space=actor.get_world_3d().direct_space_state
			if corridor_clear(space,actor.global_position+Vector3.UP*.85,forward,2.7) and world.coordinator.may_attack(actor):
				if actor.try_attack("trial_dash"):
					advance_cooldown=7.5; was_attacking=true; pattern_finished=true
					return
		move_tactically(actor,forward,float(actor.definition.speed))
		return
	var patterns: Array=world.passage.patterns(actor.phase)
	var pattern: Array=patterns[pattern_index%patterns.size()]
	var id: String=pattern[mini(cut_index,pattern.size()-1)]
	var cost: float=actor.model.config.attacks[id].cost
	if recovery<=0 and actor.ai_cooldown<=0 and actor.model.stamina>=cost and world.coordinator.may_attack(actor):
		if actor.try_attack(id):
			cut_index+=1
			pattern_finished=cut_index>=pattern.size()
			if pattern_finished:
				pattern_index+=1
				cut_index=0
			actor.sequence+=1
			was_attacking=true
		return
	# A visible breathing beat restores stamina between committed patterns.
	var tangent: Vector3=Vector3(-forward.z,0,forward.x)*(1 if pattern_index%2==0 else -1)
	var spacing: Vector3=-forward if distance<1.25 else tangent
	if actor.position.length()>9.3: spacing=(spacing-actor.position.normalized()).normalized()
	move_tactically(actor,spacing,.65)

func move_tactically(actor: Fighter, direction: Vector3, speed: float) -> void:
	var origin: Vector3=actor.global_position+Vector3.UP*.85
	var chosen: Vector3=direction.normalized()
	var space=actor.get_world_3d().direct_space_state
	if not corridor_clear(space,origin,chosen):
		var sign_value=1 if pattern_index%2==0 else -1
		var best=Vector3.ZERO
		# Keep a consistent side around an obstacle. Alternating left/right
		# candidates can oscillate forever against the middle of a wide wall.
		for fraction in [1.0/6,1.0/3,.5,2.0/3,5.0/6,1.0,-.5]:
			var angle=PI*fraction*sign_value
			var candidate: Vector3=chosen.rotated(Vector3.UP,angle)
			if corridor_clear(space,origin,candidate):
				best=candidate
				break
		chosen=best
	actor.velocity.x=chosen.x*speed
	actor.velocity.z=chosen.z*speed

func corridor_clear(space: PhysicsDirectSpaceState3D, origin: Vector3, direction: Vector3, distance: float=.9) -> bool:
	var side=Vector3(-direction.z,0,direction.x)*.34
	for offset in [Vector3.ZERO,side,-side]:
		var ray=PhysicsRayQueryParameters3D.create(origin+offset,origin+offset+direction*distance,1)
		ray.hit_from_inside=true
		if not space.intersect_ray(ray).is_empty(): return false
	return true

func summary() -> String:
	var seconds=int(elapsed)
	return "%d:%02d  |  Blade hits %d  |  Parries %d\nSafe evades %d  |  Composure breaks %d  |  Damage taken %d" % [seconds/60,seconds%60,hits,parries,evades,breaks,roundi(damage_taken)]
