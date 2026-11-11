# ASHEN VOW — pass one

An original offline, single-player, third-person sword adventure. Rayan protects travelers to provide for Mira and Isha. **Bread and Steel**, the complete playable opening chapter, follows a paid job from the family doorstep to a bandit-held woodland road and back to supper. ASHEN VOW is a working title; no trademark clearance is claimed.

**Game directory:** `C:\Users\debajyothi.m\wuk\ashen-vow`  
**Godot project:** [`game/project.godot`](game/project.godot)  
**Required engine:** Godot **4.7.2 stable**, standard GDScript build, Compatibility renderer. The exact pin is in [`engine-version.json`](engine-version.json), checked against the [official release archive](https://godotengine.org/download/archive/4.7.2-stable/).

## Play now

On this development machine, double-click **`Launch.cmd`**, or launch **`exports\windows\AshenVow.exe`**. The preview executable runs without installing Godot, Python, Blender, or an account. The engine and matching Windows export templates are already cached locally; build output and tools binaries are ignored by Git.

For source editing, open the **`game`** folder in Godot 4.7.2, import `project.godot`, and press **F5** to run the main scene. You can also use the editor command below. On a fresh checkout install the standard Godot build yourself, or run `tools\setup.ps1` to download the pinned Windows editor once. Internet is only needed for tool downloads. Python 3 is optional, for regenerating audio or retrieving Windows templates; gameplay has no Python dependency.

Copy into PowerShell:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
.\Launch.cmd
# Open the project editor:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1 -Editor
# Fresh checkout: download/check the editor, then import:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
# Logic checks, then optional rendered systems + full chapter + relaunch:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Rendered
# Rebuild the Windows preview with matching templates:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
```

Choose **Begin a new journey**. Speak to Mira, then Saren at the north gate. Follow the gold objective marker through the fallen-cart fight, scout ambush and foreman. The roadside shrine is an optional rest/checkpoint. Return to Saren for 30 crowns, buy Tova's honeybread for 8, then speak to Mira for the family scene and saved chapter ending. Optional conversations with Isha and Oren, the well and abandoned wagon add context. Continue resumes at the saved checkpoint with persistent quest progress; it does not restore an arbitrary position.

## What works

Third-person walk/sprint, mouse/controller orbit, collision-aware camera, visible-enemy lock-on, light/heavy attacks, directional guard, timed parry, dodge invulnerability, stamina, health, healing, death/checkpoint restore; three encounters with two bandit types and a patterned foreman; interactive NPCs, dialogue choices/skip, navigation cues, journal, disappearing tutorial tips, pause, input/audio/shadow settings; validated JSON saves with temporary writes and a previous-save backup. Nine original articulated character scenes, editable authored poses and seven original synthesized sounds are included.

## Controls

| Input | Action |
|---|---|
| WASD / mouse | Move / orbit camera |
| Shift / Space | Sprint / dodge |
| Left / right mouse | Light / heavy attack |
| Left Ctrl | Hold guard; press just before impact to parry |
| Q / E / R | Toggle lock-on / interact or advance / heal |
| Tab / Escape | Journal and help / pause and resume |
| Arrows, Enter | Navigate and confirm dialogue/menu choices |

Controller actions are wired: left/right sticks move/orbit; X/Y light/heavy; LB guard; B dodge; RB lock; A interact/confirm; D-pad up heal; stick-click sprint; Back journal; Start pause. A physical controller has **not** been tested. Disconnect releases action states. Settings provide sensitivity, vertical inversion, volume and shadow toggle. The 720p viewport and 30 FPS limit are intentional; 60 FPS is not offered without measurements supporting it. The input map in `preferences.gd` is authoritative.

## Saves and logs

Windows: **`%APPDATA%\AshenVow\`**. `progress.json` contains versioned progress; `progress.backup.json` retains the previous valid save. Invalid primary files are preserved with a `.damaged-*` suffix when a new valid save is written. `settings.cfg` is separate. Godot logs are in `logs\godot.log`. Back up this folder before manually editing progress. Validation uses `validation\`, `validation_systems\`, and `unit_tests\` subfolders, leaving ordinary saves alone. Developer command transcripts are in ignored `tools\logs\`; retained results and real viewport screenshots are in [`docs/evidence`](docs/evidence).

## Validation and limits

See [`docs/testing.md`](docs/testing.md) for actual results and screenshots. The opening is tested through a fresh-save scripted **rendered** playthrough and separate keyboard/mouse input-event checks; this is not a claim of a human playtest or target-laptop testing. The development machine is an i7-1185G7 / Intel Iris Xe system. Ryzen 5 5500U performance is unmeasured. These are intentionally simple hard-jointed, low-polygon assets; facial animation, IK, exact foot planting, richer environments and audio mixing need later polish.

Only chapter one exists. Revenge, family-loss aftermath, Rayan's death, resurrection trial, permanent combat progression, later bosses and the final ending are **planned for pass two**. Pass three covers refinement, accessibility and performance; pass four covers reproducible release packaging, optional Android and a GitHub Pages download site. No website or repository has been published.

## Project guide

- [Design and chapter outline](docs/design.md)
- [Architecture and ownership](docs/architecture.md)
- [Asset pipeline, credits and provenance](docs/assets.md) / [machine-readable manifest](game/assets/manifest.json)
- [Performance targets and measurements](docs/performance.md)
- [Tests and manual checks](docs/testing.md)
- [Progress and continuation record](docs/progress.md)
- [Build and release instructions](docs/build-release.md)

Original code, writing and assets use the [MIT license](LICENSE). Godot's notice is retained in [GODOT_LICENSE.txt](docs/GODOT_LICENSE.txt).
