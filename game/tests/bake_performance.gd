extends SceneTree

# Offline retargeting: preserve each target's proportions and rest orientation.
# World-space rotation deltas transfer motion, rather than copying incompatible
# local bone angles. Root/hips translations are scaled by rest hip height.
func _initialize() -> void: call_deferred("run")

func run() -> void:
	for character in ["rayan","warden"]:
		var target=load("res://assets/performance/"+character+".glb").instantiate()
		root.add_child(target)
		var rig: Skeleton3D=target.find_children("*","Skeleton3D",true,false)[0]
		var library=AnimationLibrary.new()
		var target_rest=[]
		for bone in rig.get_bone_count(): target_rest.append(rig.get_bone_global_rest(bone))
		for number in [1,2]:
			var source=load("res://assets/performance/motion_source_"+str(number)+".glb").instantiate()
			root.add_child(source)
			var source_rig: Skeleton3D=source.find_children("*","Skeleton3D",true,false)[0]
			var player: AnimationPlayer=source.find_children("*","AnimationPlayer",true,false)[0]
			player.callback_mode_process=AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
			var mapping=[]; var source_rest=[]
			for bone in rig.get_bone_count():
				var index=source_rig.find_bone(rig.get_bone_name(bone))
				if index<0: push_error("Missing source bone: "+rig.get_bone_name(bone)); quit(1); return
				mapping.append(index); source_rest.append(source_rig.get_bone_global_rest(index))
			var pelvis=rig.find_bone("pelvis")
			var height_ratio: float=target_rest[pelvis].origin.y/source_rest[pelvis].origin.y
			library.set_meta("root_scale",height_ratio)
			for clip_name in player.get_animation_list():
				if clip_name=="RESET": continue
				var original=player.get_animation(clip_name)
				var clip=Animation.new(); clip.length=original.length
				clip.loop_mode=original.loop_mode
				if clip_name=="Sword_Idle": clip.loop_mode=Animation.LOOP_LINEAR
				var rotation_tracks=[]; var position_tracks=[]
				for bone in rig.get_bone_count():
					var track=clip.add_track(Animation.TYPE_ROTATION_3D)
					clip.track_set_path(track,NodePath("Skeleton3D:"+rig.get_bone_name(bone)))
					rotation_tracks.append(track)
					track=clip.add_track(Animation.TYPE_POSITION_3D)
					clip.track_set_path(track,NodePath("Skeleton3D:"+rig.get_bone_name(bone)))
					position_tracks.append(track)
				player.play(clip_name)
				var frames=int(ceil(clip.length*30))
				for frame in range(frames+1):
					var time=minf(frame/30.0,clip.length)
					player.seek(time,true)
					source_rig.force_update_all_bone_transforms()
					var global_rotations=[]
					for bone in rig.get_bone_count():
						var source_pose=source_rig.get_bone_global_pose(mapping[bone])
						var rotation: Quaternion=source_pose.basis.orthonormalized().get_rotation_quaternion()*source_rest[bone].basis.orthonormalized().get_rotation_quaternion().inverse()*target_rest[bone].basis.orthonormalized().get_rotation_quaternion()
						global_rotations.append(rotation.normalized())
					for bone in rig.get_bone_count():
						var parent=rig.get_bone_parent(bone)
						var rotation: Quaternion=global_rotations[bone] if parent<0 else global_rotations[parent].inverse()*global_rotations[bone]
						var position=rig.get_bone_rest(bone).origin
						if bone==pelvis:
							# Retain authored vertical weight shifts. In-place variants
							# have no travelling root; controller owns world movement.
							var delta=source_rig.get_bone_pose_position(mapping[bone])-source_rig.get_bone_rest(mapping[bone]).origin
							position+=delta*height_ratio
						clip.rotation_track_insert_key(rotation_tracks[bone],time,rotation.normalized())
						clip.position_track_insert_key(position_tracks[bone],time,position)
				library.add_animation(clip_name,clip)
				print("RETARGET ",character," / ",clip_name," / ",clip.length,"s")
			source.free()
		var result=ResourceSaver.save(library,"res://assets/performance/"+character+"_motion.res",ResourceSaver.FLAG_COMPRESS)
		if result!=OK: push_error("Motion resource save failed"); quit(1); return
		print("BAKED ",character," bones=",rig.get_bone_count()," clips=",library.get_animation_list().size())
		target.free()
	quit()
