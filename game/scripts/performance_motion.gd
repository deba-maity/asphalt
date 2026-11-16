class_name PerformanceMotion
extends RefCounted

static var curves: Dictionary={}

static func curve(clip: String, time: float) -> Vector3:
	if curves.is_empty(): curves=JSON.parse_string(FileAccess.get_file_as_string("res://assets/performance/root_motion.json"))
	if not curves.has(clip): return Vector3.ZERO
	var keys: Array=curves[clip].keys
	var low=0; var high=keys.size()-1
	while low<high:
		var middle=(low+high+1)/2
		if float(keys[middle][0])<=time: low=middle
		else: high=middle-1
	var index=low
	var next=mini(index+1,keys.size()-1)
	var a: Array=keys[index]; var b: Array=keys[next]
	var weight=clampf((time-float(a[0]))/maxf(.00001,float(b[0])-float(a[0])),0,1)
	return Vector3(a[1],a[2],a[3]).lerp(Vector3(b[1],b[2],b[3]),weight)

static func configure(model: CombatModel, enemy: bool=false) -> void:
	model.config=model.config.duplicate(true)
	var base: Dictionary=model.config.attacks.light.duplicate(true)
	var attacks=[
		["light","Sword_Regular_A","Sword_Regular_A_Rec",.433333,.966667,.235,.08,18,20],
		["trial_second","Sword_Regular_B","Sword_Regular_B_Rec",.533333,1.033333,.24,.08,18,23],
		["trial_finish","Sword_Regular_C","",2.0,0.0,.14,.13,24,24],
		["heavy","Sword_Heavy_A","Sword_Heavy_A_Rec",.733333,1.0,.44,.09,32,44]]
	for item in attacks:
		var data=base.duplicate(true)
		var rate=.85 if enemy else 1.0
		data.merge({"clip":item[1],"recovery_clip":item[2],"clip_length":item[3],"rate":rate,
			"windup":float(item[5])/rate,"active":float(item[6])/rate,
			"recovery":(float(item[3])+float(item[4])-float(item[5])-float(item[6]))/rate,
			"cost":item[7],"damage":float(item[8])*(.7 if enemy else 1.0),"reach":2.15,
			"arc":.12,"tracking":.12,"pose":"heavy" if item[0]=="heavy" else "light"},true)
		model.config.attacks[item[0]]=data
	# The authored finisher has two separate cuts, not one long damage volume.
	# Windows are clip seconds; rate converts the simulation clock in active().
	model.config.attacks.trial_finish["hit_windows"]=[[.14,.27],[.62,.73]]
	model.config.dodge.duration=.92
	model.config.dodge.invulnerable_start=.14
	model.config.dodge.invulnerable_end=.44
	model.config["heal_duration"]=2.3
	model.config.stamina.regeneration=30
	model.config.stamina.delay=.35
	if enemy:
		var definition: Dictionary=model.config.enemies.still_warden.duplicate(true)
		definition.merge({"health":340,"scale":1.04,"speed":1.55,"notice":30,
			"behavior":"warden","attacks":["light","trial_second","heavy","trial_finish"]},true)
		model.config.enemies.still_warden=definition

static func attack_time(model: CombatModel) -> float:
	return model.elapsed*float(model.attack.get("rate",1.0))

static func attack_root(model: CombatModel, time: float) -> Vector3:
	var clip: String=model.attack.get("clip","")
	var end: float=model.attack.get("clip_length",1.0)
	if time<=end: return curve(clip,time)
	return curve(clip,end)+curve(model.attack.get("recovery_clip",""),time-end)

static func displacement(model: CombatModel, delta: float) -> Vector3:
	if model.state=="attack":
		var time=attack_time(model)
		return attack_root(model,time)-attack_root(model,maxf(0,time-delta*float(model.attack.get("rate",1.0))))
	if model.state=="dodge":
		var clip: String=model.config.get("dodge_clip","Roll")
		var rate=(1.466667 if clip=="Roll" else 1.3)/float(model.config.dodge.duration)
		var movement=curve(clip,model.elapsed*rate)-curve(clip,maxf(0,model.elapsed-delta)*rate)
		if clip!="Roll": return Vector3(0,0,-movement.x*(-1 if clip=="Dodge_Left" else 1))
		# Preserve the curve's acceleration but shorten the authored five-metre roll.
		return movement*.54
	return Vector3.ZERO
