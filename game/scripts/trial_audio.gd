class_name TrialAudio
extends Node3D

const BANKS={
	"step":["footstep_concrete_000","footstep_concrete_001","footstep_concrete_002"],
	"swing":["knifeSlice","knifeSlice2"],
	"hit":["impactPunch_heavy_000","impactPunch_heavy_001","impactPunch_heavy_002"],
	"guard":["impactMetal_medium_000","impactMetal_medium_001","impactMetal_medium_002"],
	"parry":["impactMetal_heavy_000"],
	"dodge":["cloth1","cloth2","cloth3"],
	"heal":["cloth2"],
	"draw":["drawKnife1"],
	"land":["impactSoft_heavy_000"]
}
static var streams: Dictionary={}
var voices: Array[AudioStreamPlayer3D]=[]
var counters: Dictionary={}
var events: int=0
var cursor: int=0
var random=RandomNumberGenerator.new()

func _ready() -> void:
	var bus=AudioServer.get_bus_index("TrialCourt")
	if bus<0:
		AudioServer.add_bus(); bus=AudioServer.bus_count-1
		AudioServer.set_bus_name(bus,"TrialCourt")
		AudioServer.set_bus_send(bus,"Effects")
		var reverb=AudioEffectReverb.new()
		reverb.room_size=.65; reverb.damping=.65; reverb.wet=.13; reverb.dry=1
		reverb.predelay_msec=60
		AudioServer.add_bus_effect(bus,reverb)
	for names in BANKS.values():
		for id in names:
			if not streams.has(id): streams[id]=load("res://assets/trial_audio/"+id+".ogg")
	for i in 16:
		var voice=AudioStreamPlayer3D.new()
		voice.bus="TrialCourt"
		voice.max_distance=24; voice.unit_size=3.5; voice.max_db=-3
		voice.panning_strength=.65
		voice.attenuation_filter_cutoff_hz=7000
		voice.attenuation_filter_db=-10
		add_child(voice); voices.append(voice)
	random.randomize()

func event(kind: String, at: Vector3, strength: float=1) -> void:
	if not BANKS.has(kind): Sound.play(kind); return
	var names: Array=BANKS[kind]
	var index=int(counters.get(kind,random.randi_range(0,names.size()-1)))
	var id: String=names[index%names.size()]
	counters[kind]=index+1; events+=1
	var voice=voices[cursor%voices.size()]; cursor+=1
	voice.stop()
	voice.global_position=at
	voice.stream=streams[id]
	voice.pitch_scale=random.randf_range(.94,1.04)
	var level=-17.0 if kind in ["step","heal","dodge"] else -10.0
	voice.volume_db=level+linear_to_db(clampf(strength,.2,1.3))
	if DisplayServer.get_name()!="headless": voice.play()

func _exit_tree() -> void:
	for voice in voices: voice.stop(); voice.stream=null
