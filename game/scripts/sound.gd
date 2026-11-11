extends Node

var voices: Array[AudioStreamPlayer] = []
var cursor: int = 0
var ambience: AudioStreamPlayer

func _ready() -> void:
	if DisplayServer.get_name() == "headless":
		return
	for i in 6:
		var p = AudioStreamPlayer.new()
		add_child(p)
		voices.append(p)
	ambience = AudioStreamPlayer.new()
	add_child(ambience)
	ambience.stream = load("res://assets/audio/hearth_wind.wav")
	ambience.volume_db = -15
	ambience.finished.connect(func(): ambience.play())
	ambience.play()

func _process(_delta: float) -> void:
	AudioServer.set_bus_volume_db(0,linear_to_db(maxf(0.0001,Preferences.volume)))

func play(id: String) -> void:
	if voices.is_empty():
		return
	var path = "res://assets/audio/" + id + ".wav"
	if not ResourceLoader.exists(path):
		return
	var p = voices[cursor % voices.size()]
	cursor += 1
	p.stream = load(path)
	p.volume_db = -9
	p.play()

func _exit_tree() -> void:
	if is_instance_valid(ambience):
		ambience.stop()
		ambience.stream = null
	for p in voices:
		p.stop()
		p.stream = null
