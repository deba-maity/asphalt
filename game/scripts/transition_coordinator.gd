class_name TransitionCoordinator
extends Node

signal settled(success: bool)
var main: Node
var state: String = "idle"
var zone_id: String = ""
var path: String = ""
var resource: PackedScene
var committed: bool = false
var effect: String = ""
var cancelled: bool = false
var requested_at: int = 0
var load_ms: float = 0
var low_memory: bool = true
var speculative_budget_mb: int = 24
var history: Array[Dictionary] = []
var failure: String = ""

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	low_memory=Preferences.low_memory
	speculative_budget_mb=Preferences.speculative_mb

func prefetch(id: String, test_resource_override: String = "") -> bool:
	if state != "idle": return id == zone_id and not cancelled
	var entry = Campaign.zone(id)
	if entry.is_empty() or entry.estimate_mb > speculative_budget_mb: return false
	zone_id = id
	path = entry.scene
	if not test_resource_override.is_empty() and Session.validation: path=test_resource_override
	state = "requested"
	cancelled = false
	resource = null
	requested_at = Time.get_ticks_usec()
	if not ResourceLoader.exists(path,"PackedScene"):
		fail("The installed zone resource is missing: "+path)
		return false
	var error = ResourceLoader.load_threaded_request(path,"PackedScene",false,ResourceLoader.CACHE_MODE_REUSE)
	if error != OK:
		fail("Could not request local zone: "+error_string(error))
		return false
	state = "loading"
	return true

func request(id: String, arrival_effect: String = "") -> bool:
	if state=="recovering": main.ui.show_transition_failure(failure); return false
	if committed or state=="transitioning": return false
	if state != "idle" and zone_id != id: return false
	committed = true
	effect = arrival_effect
	if state == "idle" and not prefetch(id):
		committed = false
		fail(failure if not failure.is_empty() else "Unknown or over-budget zone.")
		main.ui.show_transition_failure(failure)
		return false
	if state == "recovering":
		committed = false
		main.ui.show_transition_failure(failure)
		return false
	if is_instance_valid(main.world): main.world.save_current()
	main.player.model.freeze("transition")
	Input.action_release("guard")
	main.ui.show_loading(Campaign.definition(id).get("title","The next road"))
	return true

func _process(_delta: float) -> void:
	if state == "loading":
		var progress: Array = []
		var status = ResourceLoader.load_threaded_get_status(path,progress)
		if committed and not progress.is_empty(): main.ui.loading_progress.value = float(progress[0])*100
		if status == ResourceLoader.THREAD_LOAD_LOADED:
			resource = ResourceLoader.load_threaded_get(path) as PackedScene
			load_ms = (Time.get_ticks_usec()-requested_at)/1000.0
			if cancelled:
				reset()
				settled.emit(false)
				return
			if resource == null: fail("Local zone did not contain a PackedScene.")
			else: state = "ready"
		elif status in [ResourceLoader.THREAD_LOAD_FAILED,ResourceLoader.THREAD_LOAD_INVALID_RESOURCE]:
			if cancelled: reset()
			else: fail("Local resource load failed. Your previous checkpoint remains available.")
	if state == "ready" and committed:
		state = "transitioning"
		perform()

func perform() -> void:
	var destination = zone_id
	var scene = resource
	var before = Session.data.duplicate(true)
	# Retrieval is complete. Instantiation and scene-tree changes stay on the main thread.
	var started = Time.get_ticks_usec()
	var ok: bool = await main.install_zone(scene,destination,effect,low_memory)
	var construction_ms = (Time.get_ticks_usec()-started)/1000.0
	var measure = {"zone":destination,"background_ms":load_ms,"main_thread_swap_ms":construction_ms,"nodes":main.get_tree().get_node_count(),"static_memory_bytes":OS.get_static_memory_usage(),"low_memory":low_memory}
	measure.merge(main.last_install_metrics)
	measure["graphics_stage"]="unmeasured; headless" if DisplayServer.get_name()=="headless" else "included in frame pacing; GPU profiling still required"
	history.append(measure)
	if history.size()>32: history.pop_front()
	print("TRANSITION ",JSON.stringify(measure))
	scene = null
	resource = null
	if not ok:
		Session.data = before
		Session.chapter = Campaign.definition(before.zone)
		fail("Zone construction failed. Return to your saved checkpoint.")
		return
	reset()
	main.ui.play()
	main.ui.announce(Session.chapter.title.to_upper())
	settled.emit(true)

func fail(message: String) -> void:
	failure = message
	state = "recovering"
	resource = null
	if committed: main.ui.show_transition_failure(message)
	settled.emit(false)

func cancel() -> void:
	# There is no underlying task-cancellation API. Poll to completion, retrieve once, discard.
	if state == "transitioning": return
	cancelled = true
	committed = false
	if state != "loading": reset()
	if is_instance_valid(main.player): main.player.model.state = "idle"
	if is_instance_valid(main.world): main.ui.play()

func reset() -> void:
	state = "idle"
	zone_id = ""
	path = ""
	resource = null
	committed = false
	effect = ""
	cancelled = false
	failure = ""

func recover() -> void:
	if state == "loading": cancel(); return
	reset()
	main.restart_checkpoint()
