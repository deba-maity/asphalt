# ASHEN VOW

Current source: **0.8.0-rc.1 — The Ashen Trial**. Offline single-player sword combat, built with Godot 4.7.2 / GDScript / Compatibility.

[Play Ashen Vow in a browser](https://deba-maity.github.io/asphalt/ashen-vow/play/)

Choose **Begin journey · The Counting Shore**. Follow the gold ember marker with **WASD**, then press **E** to listen. An edge arrow points back toward the destination when it leaves view. A quiet echo lets you practice locking on (**Q**), landing a light strike (left mouse), guarding (**Ctrl**) and rolling (**Space**). Use **Spar** (right mouse or **Y** on a controller) for an optional timing lesson. Guard a moving blade, roll clear of the raised cleave, then land a counterstrike. The echo pulls its blows. Press **E**, **A** on a controller, or **Begin** on touch when you want to start the encounter. After a defeat, **Practice guard and dodge** returns to the drill and keeps your current opponent. Three echoes prepare you for the Cinder Warden. Each completed lesson saves a checkpoint. After a victory, return to the lit ember and call the next opponent when you are ready. Health, stamina and draughts refill. Each echo rekindles a carving on the western parapet and part of the bronze sunrise on the north gate. After the second echo, the offshore beacon shines through the cloister. Defeat the Warden and walk through that gate to reach dawn. At the ending, **Revisit a duel** lets you choose any of the three echoes or the Warden for a fresh fight. You can retry or choose another opponent while your ending stays saved. On touchscreens, move with the left pad and swipe the court to look around. Push beyond the pad rim during combat to sprint. Prompts follow the last keyboard, controller or touch input. The on-screen controls change with each lesson. Use **Continue** on the same browser or device to return to your next lesson or encounter. **Warden duel · skip lessons** is a separate practice fight.

The trial uses artist-made plate armor, retargeted authored motion, physical sword sweeps, simulated cloth, a ruined courtyard and adaptive orchestral score. The earlier six-chapter campaign remains in its archive with its existing visuals and saves.

[Current changes and evidence](docs/passage-and-power.md) | [Armor revision](docs/armored-trial.md) | [Previous motion revision](docs/motion-amplification.md) | [Credits](docs/CREDITS.txt) | [Source provenance](game/assets/performance/provenance.json)

## Get the source and start Ashen Vow on Windows

Install Git. In PowerShell, open the folder where you want to keep the game. For a first checkout, run:

```powershell
git clone --single-branch --branch ashen-vow https://github.com/deba-maity/asphalt.git ashen-vow
Set-Location .\ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1
```

Setup downloads the pinned Godot 4.7.2 engine and imports the art. The first import can take several minutes. The launch command opens the game from source. Choose **Begin journey · The Counting Shore** for the story and tutorial. For later launches from this folder, run just the last command.

### Pull the latest version

Close the running game. Open PowerShell in the existing **ashen-vow** folder (the one containing `game` and `tools`), then run:

```powershell
git branch --show-current
git pull --ff-only origin ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1
```

The first command should print `ashen-vow`. This also works in a branch worktree. The public play link above opens directly on another person's computer or phone.

### Build a standalone Windows executable

Install Python 3.11 or newer. From the same folder, run:

```powershell
python --version
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1 -Templates -ReleaseTools
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
.\exports\windows\AshenVow.exe
```

The executable embeds the game data and runs offline. Keep the accompanying notices with it when sharing the Windows build.

### Build and serve the browser game locally

Install Python 3.11 or newer and the standard Godot 4.7.2 Web export template. From the game repository, run:

```powershell
python tools/build_web.py
python -m http.server 8000 --bind 127.0.0.1 --directory exports/web
```

Open [Ashen Vow on your PC](http://127.0.0.1:8000/). Press Ctrl+C in the terminal to stop serving it. The web exporter uses a temporary copy of the project to prepare its textures.

## Controls

| Input | Action |
|---|---|
| WASD / mouse / Shift | Move / camera / sprint |
| Left / right mouse | Light / heavy attack |
| Forward + Shift + right mouse | Advancing cut |
| Left Ctrl | Guard; press just before impact to parry |
| Space / Q / R | Directional roll / lock-on / healing draught |
| Tab / Escape | Trial guide or campaign journal / pause |

Queue another light attack during a swing to chain the three-move sequence (the finisher cuts twice). A roll can cancel recovery after the swing finishes. Parries and heavy hits build composure; breaking it opens a short, close-range heavy riposte. Drinking leaves you exposed. The Warden quickens below half health. The three echoes use less health, damage and speed, with longer breathing beats. Perfect parries are optional. Trial play preserves campaign Continue.

Bindings, difficulty, subtitles, audio, resolution, edge smoothing and frame cap are in Controls & settings. In **Display**, choose **Lower power** for 30 FPS / 540p / no shadows, **Balanced** for 60 FPS / 720p, or **Sharper** for 60 FPS / 1080p. Existing saved settings are preserved. Menus and pauses suspend world animation; switching apps pauses play and limits idle updates to 10 FPS. Combat timing remains independent of the rendering cap. These limits reduce avoidable work; laptop temperatures have not been measured.

## Development

Project: `game/project.godot`. Version: `release-config.json`. Branch: [ashen-vow](https://github.com/deba-maity/asphalt/tree/ashen-vow).

```powershell
# Headless checks: no game window or desktop input capture.
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --fixed-fps 30 -- --test-trial --trial-hz=30
```

The current evidence document records source and portable checks at 30/60 physics ticks, campaign regressions, clean-cache import, reproducible armor conversion and the scope of the real-time endurance run. Headless results do not establish rendered frame rate or subjective motion quality.

Original code, story, procedural campaign art and synthesized audio are MIT. Trial armor is **Knight by piacenti**, adapted under **CC BY 3.0**; motion and the original rig reference are by **Quaternius / Gonzalo Furnier**, under **CC0 1.0**. These are third-party authored assets, not original models or motion capture produced here. Court art is CC0 **Poly Haven**; foley is CC0 **Kenney**; the original trial score uses CC0 **VSCO 2 CE** instrument recordings. No God of War/Wukong assets are used.

Historical 0.4.0 records remain under `docs/`; their captures and hashes do not represent this trial.
