# Ashen Trial — 0.5.0-rc.1

Development now centers on one duel. The trial replaces procedural body/pose animation with actual skinned characters and animator-authored clips. The older campaign remains available separately. This does **not** establish parity with God of War or Black Myth: Wukong: the selected art is stylized, with no facial performance, bespoke combat choreography, cinematic production or sophisticated cloth simulation.

## Implementation

- Two textured characters combine Quaternius ranger outfits and compatible base heads, with 65 bones each. Original texture pixels are preserved; a runtime shader gives Rayan muted red cloth and the Warden ash-colored cloth. Imports use 1024-pixel textures with mipmaps for the integrated-GPU target.
- 45 curated clips per character, retargeted offline using global rest/pose rotation deltas and target proportions. Runtime actions use sword idle, three strikes, heavy attack, recoveries, directional walk/jog, sprint, roll, sidestep, block, reactions, drink and death. Extra clips remain available for development; 45 clips do not mean 45 player actions.
- Distance-driven gait phase, directional and walk/jog blends, upper-body weapon stance and interrupt-aware transitions. Authored root curves move attacks and rolls through collision handling, scaled to the target rig.
- Analytic two-bone foot correction, bounded world-space contacts and contact-driven footsteps. This limited correction does not guarantee zero sliding in every blended pose.
- Shared combat/pose timing, recovery combo buffering, drinking recovery, short impact pauses, directional reactions and synchronized second-phase animation/damage tempo.
- Compact courtyard, closer camera, boss display, trial guide, death/victory animation and rematch flow. The title shows the arena and focuses the trial button. Separate trial persistence preserves campaign Continue.

## Verification and limits

All engine execution used `--headless`. No graphical game was opened or real desktop input captured. The [evidence directory](evidence/ashen-trial/) contains trial logs, regression summaries, bake output, build metadata and an isolated posed-asset contact sheet.

The contact sheet is **CPU-projected deformed geometry and albedo**, not a game screenshot. It checks skin assembly, poses and weapon attachment. It does not reproduce engine lighting, normal maps, shadows, motion over time, floor correction or the camera.

- 48 trial assertions pass at 30 and 60 actual physics ticks/second, in source and a copied executable outside the checkout.
- Existing unit, campaign logic, UI layout, rig, procedural motion, system, quality and transition suites pass. Full campaign traversal and relaunch/Continue pass.
- Trial checks cover finite/orthonormal poses, loop flags, stride motion, bounded contacts, blade trajectories, separate finisher cuts, damage timing, combos, sidesteps/rolls, wall collisions, drinking, phase tempo, both result flows and save isolation.
- Some fixtures position actors and set health to isolate collisions/results. They are not evidence of a natural complete human duel or difficulty balance.
- Target Ryzen 5500U frame rate, rendered shaders/materials, subjective animation quality, controller feel and audio listening remain unmeasured.

## Rebuild the art

Normal setup/build uses committed assets. Rebuilding art needs Python with NumPy; optional CPU inspection also needs Pillow.

```powershell
python .\tools\fetch_performance_assets.py
python .\tools\compile_performance_assets.py
python .\tools\extract_motion_curves.py
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --editor --import --quit
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_performance.gd
```

The fetcher verifies SHA-256 and extraction paths. It uses publisher free character downloads and a public CC0 motion redistribution pinned to an immutable commit. No credentials or purchases are needed. Source GLBs are authoring inputs; the executable uses baked animation libraries and excludes source mannequins and authoring scripts.

Provenance and license are in `game/assets/performance/`. Characters/textures: Quaternius. Animation: Quaternius and Gonzalo Furnier. These are **authored animations, not motion capture**. Integration code remains MIT; imported art/motion retain CC0. Credits and `PERFORMANCE_ASSET_LICENSE.txt` accompany the executable.

Isolated asset inspection, without opening the game:

```powershell
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/inspect_performance.gd
python .\tools\inspect_performance.py
```

The next quality gate is an on-device rendered review. Further motion polish should follow actual foot/weapon/camera observations. A realistic visual target requires more detailed art and custom animation production; additional procedural detail alone will not close that gap.
