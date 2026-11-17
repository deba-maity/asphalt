extends Node

const CLIPS=["swing","hit","guard","parry","heal","reward","step_earth","step_stone","amb_wind","amb_river","amb_ashes","music_calm","music_combat"]
var voices: Array[AudioStreamPlayer]=[]
var tracks: Array[AudioStreamPlayer]=[]
var ambience: AudioStreamPlayer
var resources: Dictionary={}
var next_allowed: Dictionary={}
var voice_index: int=0
var music_blend: float=0
var combat: bool=false
var silence: bool=false
var current_ambience: String=""
var clock: float=0
var music_starts: int=0
var trial_score: bool=false

func _ready() -> void:
	process_mode=Node.PROCESS_MODE_PAUSABLE
	for name in ["Music","Effects","Ambient"]:
		if AudioServer.get_bus_index(name)<0:
			AudioServer.add_bus()
			var index=AudioServer.bus_count-1
			AudioServer.set_bus_name(index,name)
			AudioServer.set_bus_send(index,"Master")
	for id in CLIPS:
		var stream=load("res://assets/audio/"+id+".wav") as AudioStreamWAV
		if stream==null: push_error("Missing audio: "+id); continue
		if id.begins_with("amb_") or id.begins_with("music_"):
			stream=stream.duplicate()
			stream.loop_mode=AudioStreamWAV.LOOP_FORWARD
			stream.loop_end=stream.data.size()/2
		resources[id]=stream
	for i in 8:
		var voice=AudioStreamPlayer.new()
		voice.bus="Effects"
		add_child(voice); voices.append(voice)
	for id in ["music_calm","music_combat"]:
		var track=AudioStreamPlayer.new()
		track.bus="Music"
		track.stream=resources.get(id)
		track.volume_db=-80
		add_child(track); tracks.append(track)
	ambience=AudioStreamPlayer.new()
	ambience.bus="Ambient"
	ambience.volume_db=-16
	add_child(ambience)
	Preferences.changed.connect(update_volumes)
	update_volumes()

func update_volumes() -> void:
	for pair in [["Master",Preferences.volume],["Music",Preferences.music_volume],["Effects",Preferences.effects_volume],["Ambient",Preferences.ambient_volume]]:
		AudioServer.set_bus_volume_db(AudioServer.get_bus_index(pair[0]),linear_to_db(maxf(.00001,float(pair[1]))))

func context(zone: String, in_combat: bool, quiet: bool=false, use_trial_score: bool=false) -> void:
	combat=in_combat
	silence=quiet
	trial_score=use_trial_score
	var next="amb_ashes" if zone=="zone_counting_shore" else ("amb_river" if zone=="zone_sere_mill" else "amb_wind")
	if next!=current_ambience:
		current_ambience=next
		ambience.stop()
		ambience.stream=resources.get(next)
		if DisplayServer.get_name()!="headless": ambience.play()
	# Stems share length and start together once. No restart for small zone changes.
	if music_starts==0:
		music_starts=1
		if DisplayServer.get_name()!="headless":
			for track in tracks: track.play()

func _process(delta: float) -> void:
	clock+=delta
	music_blend=move_toward(music_blend,1.0 if combat else 0.0,delta*.45)
	if tracks.size()==2:
		tracks[0].volume_db=linear_to_db(maxf(.00001,(1-music_blend)*(.0 if silence or trial_score else .24)))
		tracks[1].volume_db=linear_to_db(maxf(.00001,music_blend*(.0 if silence or trial_score else .23)))
	if ambience!=null: ambience.volume_db=-40 if silence else -16

func play(id: String) -> void:
	if not resources.has(id): id="swing"
	if clock<float(next_allowed.get(id,0)): return
	next_allowed[id]=clock+(.12 if id in ["hit","guard","parry"] else .07)
	if DisplayServer.get_name()=="headless": return
	var voice=voices[voice_index%voices.size()]
	voice_index+=1
	voice.stream=resources[id]
	voice.pitch_scale=[.94,1.0,1.06][voice_index%3]
	voice.volume_db=-13 if id.begins_with("step_") else -10
	voice.play()

func footstep(zone: String) -> void:
	play("step_stone" if zone in ["zone_copper_stair","zone_dawn_approach","zone_dawn_court","zone_counting_shore"] else "step_earth")

func _exit_tree() -> void:
	for p in voices+tracks:
		p.stop(); p.stream=null
	if ambience!=null: ambience.stop(); ambience.stream=null
	resources.clear()
