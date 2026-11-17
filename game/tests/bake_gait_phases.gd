extends SceneTree

const SAMPLES=120
func _initialize() -> void: call_deferred("run")

func run() -> void:
	var result={}
	for id in ["rayan","warden"]:
		var model=load("res://assets/performance/"+id+".glb").instantiate()
		root.add_child(model)
		var rig: Skeleton3D=model.find_children("*","Skeleton3D",true,false)[0]
		var library: AnimationLibrary=load("res://assets/performance/"+id+"_motion.res")
		var signals={}
		for name in library.get_animation_list():
			if not (name.begins_with("Walk_") or name.begins_with("Jog_") or name=="Sprint"): continue
			var clip=library.get_animation(name)
			var contacts=[]
			for sample in SAMPLES:
				var time=clip.length*sample/SAMPLES
				for bone in rig.get_bone_count():
					rig.set_bone_pose_rotation(bone,clip.rotation_track_interpolate(bone*2,time))
					rig.set_bone_pose_position(bone,clip.position_track_interpolate(bone*2+1,time))
				rig.force_update_all_bone_transforms()
				var feet=[]
				for side in ["l","r"]:
					var toe=rig.get_bone_global_pose(rig.find_bone("ball_"+side)).origin.y
					feet.append(clampf((.12-toe)/.1,0,1))
				contacts.append(feet)
			signals[name]=contacts
		var phases={}; var reference: Array=signals.Walk_Fwd
		for name in signals:
			var best=INF; var original=0.0; var shift=0
			for candidate in SAMPLES:
				var error=0.0
				for sample in SAMPLES:
					for foot in 2: error+=pow(float(reference[sample][foot])-float(signals[name][(sample+candidate)%SAMPLES][foot]),2)
				if candidate==0: original=error
				if error<best: best=error; shift=candidate
			phases[name]=float(shift)/SAMPLES if best<original*.95 else 0.0
			print(id," ",name," phase=",phases[name]," contact error ",original," -> ",best)
		result[id]={"phases":phases,"contact_samples":signals}
		model.free()
	var file=FileAccess.open("res://assets/performance/gait_phases.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(result));file.close()
	quit()
