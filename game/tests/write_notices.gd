extends SceneTree

func _initialize() -> void:
	var file = FileAccess.open("res://../docs/THIRD_PARTY_NOTICES.txt",FileAccess.WRITE)
	file.store_string("Godot 4.7.2 standard build — embedded component notices\n\n")
	file.store_string(JSON.stringify(Engine.get_copyright_info(),"  ")+"\n\n")
	var licenses = Engine.get_license_info()
	for id in licenses:
		file.store_string("\n===== "+id+" =====\n"+licenses[id]+"\n")
	file.close()
	print("Wrote notices for ",licenses.size()," license entries.")
	quit()
