class_name ShoreProgress
extends SaveStore

# Checkpoints denote the next playable activity. Each echo is a fresh encounter.
const SHORE := 1
const FIRST_ECHO := 7
const OPEN_GATE := FIRST_ECHO + TrialPassage.WARDEN + 1
const DAWN := OPEN_GATE + 1

var milestone := 0
var rehearsed := false

func accepts(value: Variant) -> bool:
	if not value is Dictionary or not value.get("rehearsed") is bool: return false
	var schema: Variant = value.get("schema")
	if schema != 1 and schema != 2: return false
	var mark: Variant = value.get("milestone")
	if not (mark is int or mark is float): return false
	return is_finite(float(mark)) and float(mark) == floorf(float(mark)) and mark >= SHORE and mark <= (OPEN_GATE if value.schema == 1 else DAWN)

func restore() -> void:
	milestone = 0
	rehearsed = false
	last_error = ""
	for filename in ["progress.json", "progress.backup.json"]:
		var saved: Variant = read_file(directory + filename)
		if saved != null:
			milestone = int(saved.milestone)
			# The final marker in version 1 always reopened the epilogue.
			if saved.schema == 1 and milestone == OPEN_GATE: milestone = DAWN
			rehearsed = saved.rehearsed
			if filename == "progress.backup.json": last_error = "Your shore journey resumed from its previous checkpoint."
			return
	if FileAccess.file_exists(directory + "progress.json") or FileAccess.file_exists(directory + "progress.backup.json"):
		last_error = "The shore checkpoint could not be read. You can begin at the ember again."

func remember(next: int, trained: bool, new_journey: bool = false) -> void:
	if next < SHORE or next > DAWN: return
	if not new_journey and (next < milestone or (next == milestone and last_error.is_empty())): return
	milestone = next
	rehearsed = trained
	if not write({"schema": 2, "milestone": next, "rehearsed": trained}):
		last_error = "This checkpoint is available until you close the game. Storage could not save it on this device."

func label() -> String:
	if milestone == DAWN: return "Passage to dawn"
	if milestone == OPEN_GATE: return "The open north gate"
	if milestone >= FIRST_ECHO: return str(TrialPassage.ENCOUNTERS[milestone - FIRST_ECHO].name).capitalize()
	if milestone >= SHORE: return str(TrialArrival.LESSONS[milestone - SHORE][0])
	return ""
