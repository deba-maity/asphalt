extends SceneTree

# Probe the pinned engine's inherited transform behavior without game rendering.
# An OFF child must retain its parent's interpolated translation. This checks
# transform inheritance; it does not test rendered bone/attachment latency.
var actor: Node3D
var child: MeshInstance3D
var started: int
var samples: int=0
var maximum_error: float=0
var reset_error: float=0
var reset_done: bool=false
var output: String="user://interpolation-probe.json"

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--interpolation-out="): output=arg.trim_prefix("--interpolation-out=")
	Engine.physics_ticks_per_second=10
	physics_interpolation=true
	actor=Node3D.new(); root.add_child(actor)
	actor.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_ON
	child=MeshInstance3D.new(); child.mesh=BoxMesh.new(); actor.add_child(child)
	child.position.x=1
	child.physics_interpolation_mode=Node.PHYSICS_INTERPOLATION_MODE_OFF
	started=Time.get_ticks_msec()
	physics_frame.connect(move_actor)
	process_frame.connect(measure)

func move_actor() -> void:
	actor.position.x+=.1
	if Time.get_ticks_msec()-started>1500 and not reset_done:
		actor.position.x+=5
		actor.reset_physics_interpolation()
		reset_error=actor.get_global_transform_interpolated().origin.distance_to(actor.global_position)
		reset_done=true

func measure() -> void:
	var elapsed=(Time.get_ticks_msec()-started)/1000.0
	var fraction=Engine.get_physics_interpolation_fraction()
	if elapsed>.5 and fraction>.25 and fraction<.75:
		var expected=actor.get_global_transform_interpolated()*child.transform
		var actual=child.get_global_transform_interpolated()
		maximum_error=maxf(maximum_error,actual.origin.distance_to(expected.origin))
		samples+=1
	if elapsed>=3:
		var passed=samples>5 and maximum_error<.00001 and reset_done and reset_error<.00001
		var report={"passed":passed,"engine":Engine.get_version_info().string,"physics_hz":10,"between_tick_samples":samples,"maximum_position_error_m":maximum_error,"teleport_reset_error_m":reset_error,"rendered":false}
		var file=FileAccess.open(output,FileAccess.WRITE); file.store_string(JSON.stringify(report,"  "))
		print("RESULT: ","PASS" if passed else "FAIL"," inherited parent translation and teleport reset")
		quit(0 if passed else 1)
