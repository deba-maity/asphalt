class_name CombatMotion
extends RefCounted

# Original authored poses. Clip time is mapped to the combat model's actual
# windup / active / recovery intervals, so animation never owns damage timing.
# Distinct anticipation, release, contact, overshoot, recoil and settling keys.
static var clips: Dictionary={}
const TIMES=[0.0,.16,.32,.38,.48,.60,.76,1.0]

static func build(heavy: bool, reverse: bool) -> Array:
	var keys=[]
	var rest={"torso":[0,0,0],"head":[0,0,0],"hips":[0,0,0],"arm_l":[8,0,-12],"arm_r":[18,0,12],"elbow_l":[18,0,0],"elbow_r":[28,0,0],"hand_r":[0,0,0],"leg_l":[8,0,-4],"leg_r":[8,0,4],"knee_l":[-16,0,0],"knee_r":[-16,0,0]}
	if heavy:
		keys=[rest,
			{"torso":[12,-18,-4],"hips":[0,-8,0],"arm_r":[65,-20,35],"elbow_r":[95,0,0],"arm_l":[40,0,-25],"knee_l":[-35,0,0],"knee_r":[-40,0,0]},
			{"torso":[-14,-22,-5],"hips":[-8,-14,0],"arm_r":[168,-12,18],"elbow_r":[75,0,0],"hand_r":[-18,0,8],"arm_l":[140,0,-15],"elbow_l":[85,0,0],"leg_r":[28,0,5],"knee_r":[-46,0,0]},
			{"torso":[-3,-12,0],"hips":[10,4,0],"arm_r":[148,0,12],"elbow_r":[45,0,0],"hand_r":[-10,0,0],"arm_l":[130,0,-12],"elbow_l":[60,0,0]},
			{"torso":[28,14,4],"hips":[12,12,0],"arm_r":[72,8,-8],"elbow_r":[12,0,0],"hand_r":[18,0,-6],"arm_l":[-12,0,-35],"elbow_l":[35,0,0],"leg_l":[28,0,-7],"knee_l":[-36,0,0],"leg_r":[-12,0,5]},
			{"torso":[40,24,7],"hips":[16,18,0],"arm_r":[32,15,-15],"elbow_r":[18,0,0],"hand_r":[28,0,-8],"arm_l":[5,0,-35],"leg_l":[34,0,-7],"knee_l":[-42,0,0],"leg_r":[-14,0,6]},
			{"torso":[18,12,2],"hips":[4,8,0],"arm_r":[52,5,14],"elbow_r":[56,0,0],"hand_r":[-8,0,0],"arm_l":[20,0,-15]},rest]
	else:
		keys=[rest,
			{"torso":[2,-24,-5],"hips":[0,-12,-3],"arm_r":[65,-20,40],"elbow_r":[75,0,0],"arm_l":[20,0,-26]},
			{"torso":[-4,-55,-8],"hips":[0,-23,-3],"arm_r":[122,-32,58],"elbow_r":[55,0,0],"hand_r":[-14,0,20],"arm_l":[42,0,-35],"leg_r":[26,0,8],"knee_r":[-40,0,0]},
			{"torso":[4,-24,-2],"hips":[4,5,0],"arm_r":[112,-20,35],"elbow_r":[32,0,0],"hand_r":[-4,0,10],"arm_l":[20,0,-36]},
			{"torso":[12,15,5],"hips":[5,10,2],"arm_r":[78,-15,-28],"elbow_r":[10,0,0],"hand_r":[-5,0,-10],"arm_l":[-15,0,-40],"leg_l":[25,0,-7],"knee_l":[-35,0,0],"leg_r":[-8,0,6]},
			{"torso":[18,42,9],"hips":[8,20,4],"arm_r":[38,-10,-50],"elbow_r":[25,0,0],"hand_r":[20,0,-35],"arm_l":[-28,0,-28],"leg_l":[28,0,-6],"knee_l":[-38,0,0],"leg_r":[-12,0,6]},
			{"torso":[5,20,2],"hips":[0,8,0],"arm_r":[42,5,-15],"elbow_r":[65,0,0],"hand_r":[-8,0,-10],"arm_l":[12,0,-15]},rest]
	var complete=[]
	for key in keys:
		var pose=rest.duplicate(true); pose.merge(key,true)
		if reverse and not heavy:
			pose.torso[1]*=-.8; pose.torso[2]*=-1
			pose.hips[1]*=-.8
			pose.arm_r[2]=-float(pose.arm_r[2])*.72
			pose.arm_r[0]=float(pose.arm_r[0])*.85
			pose.hand_r[2]*=-1
		pose.head=[-float(pose.torso[0])*.35,-float(pose.torso[1])*.4,0]
		complete.append(pose)
	return complete

static func sample(model: CombatModel) -> Dictionary:
	var heavy=model.attack.get("pose","")=="heavy" or model.attack_id in ["heavy","foreman_slam"]
	var reverse=model.swing_serial%2==0
	var key=str(heavy)+str(reverse)
	if not clips.has(key): clips[key]=build(heavy,reverse)
	var w: float=model.attack.windup; var a: float=model.attack.active; var r: float=model.attack.recovery
	var t: float
	if model.elapsed<w: t=.38*model.elapsed/maxf(.001,w)
	elif model.elapsed<w+a: t=.38+.22*(model.elapsed-w)/maxf(.001,a)
	else: t=.60+.40*(model.elapsed-w-a)/maxf(.001,r)
	t=clampf(t,0,1)
	var index=0
	while index<6 and t>TIMES[index+1]: index+=1
	var blend=smoothstep(TIMES[index],TIMES[index+1],t)
	var first: Dictionary=clips[key][index]; var second: Dictionary=clips[key][index+1]
	var result={}
	for joint in first:
		var from: Array=first[joint]; var to: Array=second[joint]
		result[joint]=[lerpf(from[0],to[0],blend),lerpf(from[1],to[1],blend),lerpf(from[2],to[2],blend)]
	return result
