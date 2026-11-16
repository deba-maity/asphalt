# ASHEN VOW

Current source: **0.5.0-rc.1 — The Ashen Trial**. Offline single-player sword combat, built with Godot 4.7.2 / GDScript / Compatibility.

Select **Enter the Ashen Trial** for the new focused duel: textured skinned characters, authored sword attacks and recoveries, directional locomotion, root-motion rolls, foot correction and a Warden encounter. The earlier six-chapter campaign remains separately selectable with its existing visuals and saves.

This is a substantial animation-pipeline replacement, **not God of War or Black Myth: Wukong quality**. The art remains stylized. Headless tests and isolated CPU asset inspection cannot establish rendered quality, input feel or laptop GPU performance. No graphical game was opened on the Remote Desktop.

[Changes and evidence](docs/ashen-trial.md) | [Credits](docs/CREDITS.txt) | [Source provenance](game/assets/performance/provenance.json)

## Pull, build and open on your Windows PC

Run in **PowerShell**, from your existing checkout:

```powershell
Set-Location 'C:\Users\Dmaity\Desktop\asphalt'
git switch ashen-vow
git pull --ff-only origin ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1 -Templates -ReleaseTools
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
.\exports\windows\AshenVow.exe
```

The final command opens the game on your PC. **Enter the Ashen Trial** shows the new work; **Continue** opens the older campaign. Setup downloads missing pinned tools; the compiled character and motion assets are committed. No Blender or asset account is required.

For a new checkout, first run `git clone --branch ashen-vow https://github.com/deba-maity/asphalt.git`, then `Set-Location asphalt`, followed by setup/build/open above. Python 3 is required by build tools. The exported executable embeds its data and needs neither Godot, Python nor internet. Keep the accompanying notices with it.

This is an unsigned Windows candidate. Android remains experimental and was not built for this revision. No new release binary has been published; old 0.4.0 archives do not contain the trial.

## Controls

| Input | Action |
|---|---|
| WASD / mouse / Shift | Move / camera / sprint |
| Left / right mouse | Light / heavy attack |
| Left Ctrl | Guard; press just before impact to parry |
| Space / Q / R | Directional roll / lock-on / healing draught |
| Tab / Escape | Trial guide or campaign journal / pause |

Queue another light attack during a swing to chain the three-strike sequence. A roll can cancel recovery after the swing finishes. Drinking leaves you exposed. The Warden quickens below half health. Victory and defeat offer fresh rematches; trial play preserves campaign Continue.

Bindings, difficulty, subtitles, audio, resolution and frame cap are in Controls & settings. Start at 720p/30 on integrated graphics; target-laptop performance is unmeasured.

## Development

Project: `game/project.godot`. Version: `release-config.json`. Branch: [ashen-vow](https://github.com/deba-maity/asphalt/tree/ashen-vow).

```powershell
# Headless checks: no game window or desktop input capture.
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --fixed-fps 30 -- --test-trial --trial-hz=30
```

48 trial checks pass in source and copied Windows builds at 30/60 physics ticks. Existing regression checks and campaign traversal/Continue also pass. See the evidence document for limits.

Original code, story, procedural campaign art and synthesized audio are MIT. Trial art is by **Quaternius**; animation by **Quaternius and Gonzalo Furnier**, under **CC0 1.0**. These are third-party authored assets, not original models or motion capture produced here. No God of War/Wukong assets are used.

Historical 0.4.0 records remain under `docs/`; their captures and hashes do not represent this trial.
