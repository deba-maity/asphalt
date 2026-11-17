class_name TrialScore
extends AudioStreamPlayer

var world: TrialWorld
var synchronized=AudioStreamSynchronized.new()
var intensity: float=0
var presence: float=0
var starts: int=0

func _ready() -> void:
	world=get_parent()
	bus="Music"
	synchronized.stream_count=2
	for index in 2:
		var music=load("res://assets/trial_audio/"+("score_base" if index==0 else "score_intensity")+".wav").duplicate() as AudioStreamWAV
		music.loop_end=int(round(music.get_length()*music.mix_rate))
		music.loop_mode=AudioStreamWAV.LOOP_FORWARD
		synchronized.set_sync_stream(index,music)
	synchronized.set_sync_stream_volume(0,-15)
	synchronized.set_sync_stream_volume(1,-80)
	stream=synchronized; volume_db=-80; starts=1
	if DisplayServer.get_name()!="headless": play()

func _process(delta: float) -> void:
	if not is_instance_valid(world.hero) or not is_instance_valid(world.warden): return
	var playing=Session.running and world.ui.mode=="play" and not world.won and world.hero.model.state!="dead"
	presence=move_toward(presence,1.0 if playing else 0.0,delta*.7)
	intensity=lerpf(intensity,1.0 if world.warden.phase==2 else .3,1-exp(-delta*.8))
	volume_db=linear_to_db(maxf(.00001,presence))
	synchronized.set_sync_stream_volume(1,linear_to_db(maxf(.00001,intensity*.20)))

func _exit_tree() -> void:
	stop(); stream=null
