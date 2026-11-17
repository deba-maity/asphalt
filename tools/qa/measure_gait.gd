extends SceneTree

# Shared telemetry fixture for the previous commit and the current project.
# It restores current post-IK snapshots before measuring so render interpolation
# does not contaminate the physics-space comparison.
var report: Array=[]
var hz: int=60
var output: String="user://gait-telemetry.json"
var main: Node
var hero: Node3D
var interpolated: bool=false
var trace: bool=false

func _initialize() -> void: call_deferred("run")

func frame() -> void:
	await physics_frame
	await process_frame
	main.world.warden.position=hero.position+Vector3(0,0,-4)
	hero.target=main.world.warden

func feet() -> Array[Vector3]:
	var figure=hero.figure
	var rig: Skeleton3D=figure.body_skeleton
	if interpolated and figure.interpolator.ready:
		for i in rig.get_bone_count():
			rig.set_bone_pose_rotation(i,figure.interpolator.current_rot[i])
			rig.set_bone_pose_position(i,figure.interpolator.current_pos[i])
		rig.force_update_all_bone_transforms()
	return [rig.to_global(rig.get_bone_global_pose(rig.find_bone("ball_l")).origin),rig.to_global(rig.get_bone_global_pose(rig.find_bone("ball_r")).origin)]

func percentile(values: Array, fraction: float) -> float:
	if values.is_empty(): return 0
	var sorted=values.duplicate(); sorted.sort()
	return sorted[mini(sorted.size()-1,int(sorted.size()*fraction))]

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--telemetry-hz="): hz=int(arg.split("=")[1])
		if arg.begins_with("--telemetry-out="): output=arg.trim_prefix("--telemetry-out=")
		if arg=="--telemetry-trace": trace=true
	Engine.physics_ticks_per_second=hz
	main=load("res://scenes/main.tscn").instantiate(); root.add_child(main)
	main.start_trial(TrialPassage.WARDEN,false); hero=main.player
	main.world.warden.ai_enabled=false; hero.use_test_direction=true
	for property in hero.figure.get_property_list():
		if property.name=="interpolator": interpolated=true
	for scenario in [["walk_forward",Vector3.FORWARD*.35,false],["jog_forward",Vector3.FORWARD,false],["jog_left",Vector3.LEFT,false],["jog_backward",Vector3.BACK,false],["sprint",Vector3.FORWARD,true]]:
		hero.position=Vector3(0,.05,0); hero.rotation.y=0; hero.velocity=Vector3.ZERO
		hero.model.state="idle"; hero.test_direction=Vector3.ZERO
		Input.action_release("sprint")
		for i in hz/2: await frame()
		hero.test_direction=scenario[1]
		if scenario[2]: Input.action_press("sprint")
		for i in hz/3: await frame()
		var previous_feet=feet(); var previous_position=hero.position
		var samples: Array=[]; var speeds: Array=[]
		var detail: Array=[]
		var distance=0.0; var minimum_height=10.0; var maximum_height=-10.0
		for i in int(hz*1.5):
			await frame()
			var current_feet=feet()
			if trace:
				hero.figure.apply_pose()
				var rig: Skeleton3D=hero.figure.body_skeleton
				var raw: Array=[]
				for side in ["l","r"]:
					var p=rig.to_global(rig.get_bone_global_pose(rig.find_bone("ball_"+side)).origin)
					raw.append([p.x,p.y,p.z])
				detail.append({"raw":raw,"feet":[[current_feet[0].x,current_feet[0].y,current_feet[0].z],[current_feet[1].x,current_feet[1].y,current_feet[1].z]],"weights":hero.figure.contact_solver.weights.duplicate(),"phase":hero.figure.locomotion_phase})
				feet()
			var velocity=(hero.position-previous_position)*hz
			distance+=Vector2(velocity.x,velocity.z).length()/hz
			speeds.append(Vector2(velocity.x,velocity.z).length())
			for side in 2:
				minimum_height=minf(minimum_height,current_feet[side].y); maximum_height=maxf(maximum_height,current_feet[side].y)
				if current_feet[side].y<.07 and previous_feet[side].y<.07:
					var drift=(current_feet[side]-previous_feet[side])*hz
					samples.append(Vector2(drift.x,drift.z).length())
			previous_feet=current_feet; previous_position=hero.position
		var mean=0.0
		for value in samples: mean+=value/maxi(1,samples.size())
		var row={"scenario":scenario[0],"physics_hz":hz,"near_ground_samples":samples.size(),"mean_near_ground_toe_speed_mps":mean,
			"median_near_ground_toe_speed_mps":percentile(samples,.5),"p95_near_ground_toe_speed_mps":percentile(samples,.95),"median_travel_mps":percentile(speeds,.5),
			"distance_m":distance,"minimum_toe_y":minimum_height,"maximum_toe_y":maximum_height}
		report.append(row); print(JSON.stringify(row))
		if trace: row["trace"]=detail
	Input.action_release("sprint")
	var file=FileAccess.open(output,FileAccess.WRITE); file.store_string(JSON.stringify(report,"  "))
	main.finish(0)
