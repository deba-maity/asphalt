# Asset provenance and editable pipeline

All game models, geometry, animation poses, dialogue, story and synthesized sounds were created originally for this implementation with Codex assistance. No downloaded art, motion capture, extracted models, franchise content, unknown-license files, external animation rigs or paid plugins are used. The machine-readable [asset manifest](../game/assets/manifest.json) records authorship, license, source/method, runtime files and required notice. Original assets use the root MIT license.

Blender was not found in the inspected PATH or standard Program Files location. The fallback is an intentionally stylized hard-jointed character with recognizable adult/child proportions, shoulders/elbows/hips/knees, hands, face features, clothing, boots and right-hand sword. This is an articulated Node3D rig, **not** a skinned or motion-captured model. It has editable GDScript geometry and JSON poses. The baked `.tscn` runtime assets contain their meshes and materials and run without Blender or any generator installed.

```powershell
# From the repository root, after editing figure.gd or chapter NPC appearance:
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_characters.gd
# Regenerate original WAV files (Python stdlib only):
python .\tools\generate_audio.py
```

Animation changes in `content/poses.json` are read directly; geometry changes require rebaking. Scene definitions use one metre per unit, Y up and -Z forward. Scale is 1.0 for adults, 0.64 for Isha, 1.18 for the foreman. There is no arbitrary bone remapping step: all nine characters share explicit joint names. The right-hand grip and blade axis are recorded in `source_assets/character-source.json`. Rendered captures show walking, combat windup, foreman and homecoming; source tests verify assets load and active hit volumes work. Check stride matching and clipping again after any pose edits.

Limitations: hard joints, analytic gait, limited mesh detail, no facial motion, finger animation, foot planting or cinematic animation production. Shadows and palette are basic. Seven mono PCM sounds are deliberately simple synthesized effects and wind/drone, not a scored soundtrack or voiced dialogue. Audio output was initialized successfully; no subjective listening test is claimed.

Godot is MIT-licensed; its notice is in `GODOT_LICENSE.txt` and copied with Windows exports, along with `THIRD_PARTY_NOTICES.txt` generated from the pinned engine's embedded component/license information. The editor's bundled default font follows those distribution notices. The title asks for an OS-provided Georgia/Liberation Serif through SystemFont and falls back if absent; no OS font files are redistributed. The engine is downloaded from the official tagged build with the SHA-256 pin in `engine-version.json`. Templates come from the matching official 4.7.2 standard archive and are checked by ZIP CRC during extraction.
