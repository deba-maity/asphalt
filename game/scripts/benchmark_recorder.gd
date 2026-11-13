class_name BenchmarkRecorder
extends Node

var main: Node
var recording: bool=false
var frames: Array[float]=[]
var samples: Array[Dictionary]=[]
var previous: int=0
var started: int=0
var sample_clock: float=0
var screenshot_count: int=0
var spikes: Array[Dictionary]=[]
var output_directory: String=""
var environment_form: Dictionary={}
const MAX_FRAMES=216000
const MAX_SAMPLES=7200

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_ALWAYS
	if "--benchmark" in OS.get_cmdline_user_args(): begin()

func begin() -> void:
	frames.clear(); samples.clear(); spikes.clear()
	previous=Time.get_ticks_usec(); started=previous; sample_clock=0
	output_directory="user://benchmarks/"+Time.get_datetime_string_from_system().replace(":","-")+"-"+str(started)
	DirAccess.make_dir_recursive_absolute(output_directory)
	var form_path="res://../benchmark-environment.json"
	if FileAccess.file_exists("user://benchmark-environment.json"): form_path="user://benchmark-environment.json"
	var parser=JSON.new()
	if FileAccess.file_exists(form_path) and parser.parse(FileAccess.get_file_as_string(form_path))==OK and parser.data is Dictionary: environment_form=parser.data
	recording=true
	if main.ui!=null: main.ui.toast("Benchmark recording · F8 stops and saves. F9 captures a viewport image.",6)

func _process(delta: float) -> void:
	if not recording: return
	var now=Time.get_ticks_usec()
	var interval=(now-previous)/1000.0
	if frames.size()<MAX_FRAMES: frames.append(interval)
	if interval>50 and spikes.size()<1000: spikes.append({"frame_ms":interval,"zone":Session.data.zone,"ui":main.ui.mode,"wall_seconds":(now-started)/1000000.0})
	previous=now
	sample_clock+=delta
	if sample_clock<1 or samples.size()>=MAX_SAMPLES: return
	sample_clock=0
	var graphics=DisplayServer.get_name()!="headless"
	var debug=OS.is_debug_build()
	var world=main.world
	var active=world.coordinator.active.size() if is_instance_valid(world) and is_instance_valid(world.coordinator) else 0
	var row={"elapsed_seconds":(now-started)/1000000.0,"zone":Session.data.zone,"ui":main.ui.mode,"nodes":get_tree().get_node_count(),"active_enemies":active,"resources":Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT),"physics_objects":Performance.get_monitor(Performance.PHYSICS_3D_ACTIVE_OBJECTS),"process_ms":Performance.get_monitor(Performance.TIME_PROCESS)*1000,"physics_ms":Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)*1000,"engine_static_bytes":OS.get_static_memory_usage() if debug else null,"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME) if graphics else null,"visible_primitives":Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) if graphics else null,"render_video_memory_bytes":Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) if graphics and debug else null,"material_cache":Figure.materials.size(),"mesh_cache":Figure.meshes.size(),"transitions":main.transitions.state}
	samples.append(row)

static func distribution(values: Array[float]) -> Dictionary:
	if values.is_empty(): return {}
	var ordered=values.duplicate()
	ordered.sort()
	var sum: float=0
	for v in ordered: sum+=v
	return {"samples":values.size(),"mean_ms":sum/values.size(),"p50_ms":ordered[int((ordered.size()-1)*.5)],"p95_ms":ordered[int((ordered.size()-1)*.95)],"p99_ms":ordered[int((ordered.size()-1)*.99)],"max_ms":ordered[-1]}

func stop() -> String:
	if not recording: return ""
	recording=false
	var graphics=DisplayServer.get_name()!="headless"
	var report={"schema":1,"engine":Engine.get_version_info().string,"os":OS.get_name()+" "+OS.get_version(),"cpu":OS.get_processor_name(),"logical_processors":OS.get_processor_count(),"display_backend":DisplayServer.get_name(),"renderer_config":"gl_compatibility","classification":"rendered local machine; user must identify whether target laptop" if graphics else "HEADLESS DEVELOPMENT CHECK; not rendered or target-hardware evidence","environment_form":environment_form,"settings":{"difficulty":Preferences.difficulty,"fps_cap":Preferences.fps_cap,"render_height":Preferences.render_height,"shadows":Preferences.shadows,"window":str(get_tree().root.size),"fullscreen":Preferences.fullscreen},"frame_intervals":distribution(frames),"wall_seconds":(Time.get_ticks_usec()-started)/1000000.0,"sample_limit_reached":frames.size()>=MAX_FRAMES,"samples":samples,"transitions":main.transitions.history,"unavailable":["GPU execution timing","driver-level VRAM allocation/shared-memory usage","thermal and power telemetry","process working set (see wrapper process-memory.csv)"]}
	if graphics: report["adapter"]=RenderingServer.get_video_adapter_name()
	else: report["adapter"]=null
	report["spikes_over_50ms"]=spikes
	var f=FileAccess.open(output_directory+"/report.json",FileAccess.WRITE)
	if f!=null: f.store_string(JSON.stringify(report,"  ")); f.close()
	print("BENCHMARK_REPORT ",ProjectSettings.globalize_path(output_directory+"/report.json"))
	if main.ui!=null: main.ui.toast("Benchmark saved under user data / benchmarks.",5)
	return output_directory+"/report.json"

func capture() -> void:
	if DisplayServer.get_name()=="headless": return
	if not recording: begin()
	await RenderingServer.frame_post_draw
	var path=output_directory+"/capture-%02d.png" % screenshot_count
	get_viewport().get_texture().get_image().save_png(path)
	var info={"zone":Session.data.zone,"cpu":OS.get_processor_name(),"adapter":RenderingServer.get_video_adapter_name(),"cap":Preferences.fps_cap,"render_height":Preferences.render_height,"shadows":Preferences.shadows,"environment":environment_form}
	var f=FileAccess.open(path+".json",FileAccess.WRITE)
	f.store_string(JSON.stringify(info,"  "))
	screenshot_count+=1
	main.ui.toast("Viewport screenshot saved with machine/preset metadata.")

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	if main.ui.mode=="settings" and not main.ui.rebinding.is_empty(): return
	if event.keycode==KEY_F8:
		if recording: stop()
		else: begin()
		get_viewport().set_input_as_handled()
	elif event.keycode==KEY_F9:
		capture()
		get_viewport().set_input_as_handled()
