# ASHEN VOW

Current source: **0.8.0-rc.1 — The Ashen Trial**. Offline single-player sword combat, built with Godot 4.7.2 / GDScript / Compatibility.

Select **Play - The Ashen Trial** for a short passage with a reason to fight: Rayan returns to expose Avel's betrayal and preserve Mira and Isha's names, at the cost of remembering Isha's voice. Read the opening, face three gentle echoes that teach movement, defense and openings, then confront the Cinder Warden. Health and draughts refill between encounters; a loss retries the current one. **Warden duel - skip lessons** remains available.

The trial uses artist-made plate armor, retargeted authored motion, physical sword sweeps, simulated cloth, a ruined courtyard and adaptive orchestral score. The earlier six-chapter campaign remains in its archive with its existing visuals and saves.

This is a substantial animation-pipeline replacement, **not God of War or Black Myth: Wukong quality**. The current trial replaces the ranger figures with detailed, licensed armor, but still lacks the custom animation and environment production of those games. Headless tests and isolated CPU asset inspection cannot establish rendered quality, input feel or laptop GPU performance. No graphical game was opened on the Remote Desktop.

[Current changes and evidence](docs/passage-and-power.md) | [Armor revision](docs/armored-trial.md) | [Previous motion revision](docs/motion-amplification.md) | [Credits](docs/CREDITS.txt) | [Source provenance](game/assets/performance/provenance.json)

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

The final command opens the game on your PC. **Play · The Ashen Trial** shows the new work; **Earlier campaign · prototype archive** contains the older campaign and its Continue save. Setup downloads missing pinned tools; the compiled character and motion assets are committed. The first import can take several minutes while the higher-resolution textures are prepared. No Blender or asset account is required.

For a new checkout, first run `git clone --branch ashen-vow https://github.com/deba-maity/asphalt.git`, then `Set-Location asphalt`, followed by setup/build/open above. Python 3.11 or newer is required by build tools; check `python --version` in the same PowerShell session. The exported executable embeds its data and needs neither Godot, Python nor internet. Keep the accompanying notices with it.

This is an unsigned Windows candidate. Android remains experimental and was not built for this revision. No new release binary has been published; old 0.4.0 archives do not contain the trial.

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
