# Armored trial revision — 0.7.0-rc.1

The screenshot supplied during this revision showed the original campaign village. Its primitive figures, repeated scenery and flat material treatment do not resemble God of War, Black Myth: Wukong or Elden Ring. More procedural armor on the previous ranger figures also failed that target. This revision replaces the trial's character foundation and makes the current encounter the unambiguous Play option. The earlier campaign remains in a clearly labeled prototype archive with its saves intact.

## Character and motion changes

- **Knight by piacenti**, CC BY 3.0, replaces both ranger figures. It has artist-authored plate geometry and 2048-pixel color, normal, metallic and roughness maps. The two fighters share this base model with warm/cold steel palettes, different scale and distinct simulated mantles; these are not two independently authored character models.
- The source was unrigged. The new reproducible Blender pipeline removes the shield, fits 65 bones, assigns anatomical skin weights, preserves rigid plate zones, and converts the A pose to a T bind pose. Forty-five existing authored CC0 clips are retargeted to those proportions. These clips are not newly captured motion capture.
- The first light attack uses the shorter authored cut. Warden cleaves and finishers have moving anticipation, with root movement and damage windows driven by the same remapped animation clock. A forward sprint plus heavy attack performs a committed advancing cut; the second-phase Warden uses its own range/corridor-limited advancing attack.
- Upper-body target-height gaze, hand-prop attachment updates, curved sword guard/grip/fullered blade, and bounded optional camera impact response supplement the existing inertial transitions, interpolated bones and foot correction.
- Original mantles have woven trim, a broken vow seal, different hems and shoulder collision capsules. A ruined cloister and fitted radial masonry frame the courtyard outside the combat space. Material and ambient-light levels are restrained.
- The main menu displays the build version and provides artist credits. The old campaign's ambiguous “Begin a new journey” entry has moved into the prototype archive.

The preceding gameplay pass adds composure breaks and physical ripostes, authored enemy pattern families and recovery, defensive input buffering, guard rearming, obstacle-aware spacing, round statistics, camera/input fixes and clearer encounter instructions.

## Reference inspection

Official references were inspected as reference material only; no franchise assets or source code were copied into the game:

- [God of War Ragnarök combat guide](https://www.playstation.com/en-us/games/god-of-war-ragnarok/god-of-war-combat-refresher-course/), including its publicly available attack video. Two YouTube videos required age-verified sign-in and were not accessed through user accounts. The official costume/art guide was also consulted.
- [Black Myth: Wukong gameplay](https://www.youtube.com/watch?v=VUlzltBX3Ac) and [PlayStation gallery](https://www.playstation.com/en-us/games/black-myth-wukong/). Selected footage frames were examined for poses, cloth/armor layers and attack presentation.
- [Elden Ring official gameplay preview](https://www.youtube.com/watch?v=JldMvQMO_5U) and [official image gallery](https://www.eldenring.jp/movieandimages.html). Selected footage frames informed silhouette, palette and environmental scale.
- [Ozz animation](https://github.com/guillaumeblanc/ozz-animation), including its MIT license and look-at sample, was read for joint-local correction and chain weighting. [Motion-Matching](https://github.com/orangeduck/Motion-Matching) and its MIT license were reviewed as another public reference. Neither codebase nor dataset was incorporated; this game does not claim to implement motion matching.

Reference videos and images remain in the ignored authoring cache. They are not distributed with the game.

## Rebuilding the character assets

Normal setup/build uses committed assets. Blender is needed only to reproduce the art conversion. Python authoring also uses NumPy and Pillow. Obtain Blender from its official distribution and verify its published checksum.

```powershell
python .\tools\fetch_knight_asset.py
# Replace the executable path with your verified Blender installation.
& 'C:\Tools\Blender\blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 .\tools\cache\duel-reference\armor.blend --python .\tools\compile_knight.py
python .\tools\optimize_knight_assets.py
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --editor --import --quit
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_performance.gd
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_gait_phases.gd
```

The fetcher pins the source SHA-256 and extracts only `armor.blend`. Embedded scripts are disabled. Only the armor mesh and its four maps are selected; the source's unrelated packed sample photograph is excluded. Lossless PNG compression and shared external maps avoid duplicate textures. About 77 MB of unused ranger maps were removed. Provenance and modifications are recorded in `game/assets/performance/knight_provenance.json` and `KNIGHT_LICENSE.txt`; the complete attribution also accompanies the portable executable.

## Validation status and limits

The visual checkpoint passed 512 headless assertions, complete campaign traversal and relaunch/Continue. It also passed the new physical-contact checks for both advancing cuts, both finisher contacts, ordinary and second-phase heavy strikes. Final audit and portable-package evidence will be recorded here after completion.

All Godot execution was headless. Blender used background mode with automatic script execution disabled. Separate hidden WebGL viewers inspected the imported poses and actual recorded runtime joints/cloth across 19 action segments per fighter. A static courtyard export was also inspected. These use independent lighting, and their images are explicitly labeled **not game screenshots**. They do not verify Godot's rendered materials, sustained GPU frame rate, human input feel, physical controller behavior or audio listening.

This is still below the requested AAA visual/animation level. It is a more detailed armored duel with a stronger asset foundation, not evidence of parity with those games. Native rendered acceptance remains outstanding under the user's restriction against opening the game on this Remote Desktop.
