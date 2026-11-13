# ASHEN VOW — quality implementation, pass three

An original offline, single-player, third-person sword adventure. Rayan's modest protection work becomes a pursuit through the Cinder Ledger's roads, an authored betrayal, a costly resurrection, and a final confrontation with Halvek. **All six chapters have playable objectives and a complete ending.** Pass three improves input, combat feedback, animation timing, camera, settings, props and audio, and provides a local benchmark/capture workflow. This remains a short campaign with original economical art and outstanding human/visual acceptance, not a finished multi-hour release. ASHEN VOW remains a working title without trademark clearance.

**Repository:** `C:\Users\debajyothi.m\wuk\ashen-vow`

**Project:** [`game/project.godot`](game/project.godot) — open the **game** folder in **Godot 4.7.2 stable, standard GDScript build**, and press F5. Compatibility/OpenGL remains the renderer. The exact engine/template pin and editor ZIP checksum are in [`engine-version.json`](engine-version.json).

## Play and installation

On the machine where you intend to play, run **`exports\windows\AshenVow.exe`**, or double-click **`Launch.cmd`** for the source project. The exported Windows build needs no Godot installation, Python, Blender, account or connection. Transfer the accompanying license/notice files with it. The cached editor and templates are already present on this development machine; they are ignored build tools rather than committed assets.

**Remote Desktop:** further verification here is headless, without game windows, audio or desktop input capture. Launch the graphical game manually only where you want to play it.

For a fresh source checkout, install the pinned standard Godot build, or use the setup command below. Python 3 is optional for regenerating audio/content/models or fetching matching Windows templates; it is not a gameplay dependency. Tool downloads need internet once. All installed campaign resources are local.

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
# Headless checks; -Campaign includes New Game through credits and relaunch:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
# Check the 30 Hz display-simulation path as well (physics stays 60 Hz):
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign -SimulationHz 30
# Rebuild the Windows executable without opening a game window:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
# Fresh source setup, only if the pinned editor is absent:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
# Optional, on the machine where you want the graphical editor:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1 -Editor
```

## The playable campaign

| Chapter | Playable journey |
|---|---|
| 1 · Bread and Steel | Family, paid protection, two road encounters, foreman, 30-crown pay, honeybread and supper. Choose **Begin the next day** on its chapter card, or speak to Mira after continuing an old completed opening save. |
| 2 · Night of Cinders | Fetch willow bark, return to the altered settlement, search household objects, hear Edda, pursue raiders, defeat Captain Varo and recover his dispatch. |
| 3 · The Road of Revenge | Riverside mill and Copper Stair; disciplined guards, bowmen and brutes; rescue Neri, learn the tempered edge, defeat Kesran, then face Avel's authored betrayal after the winnable fight. |
| 4 · Between Ashes | Explore the Counting Shore, choose the Keeper's trial, learn Ashstep against the Still Warden, cross the veil, and accept the cost of returning. |
| 5 · The Returned | Revisit the drained mill, pass a ward, face reactive elites, optionally find Mira's letter, defeat Marshal Serit and find Halvek's route. |
| 6 · The Last Dawn | Last bridge, separate Dawn Court, two-phase Halvek fight, broken Ledger, return-home memorial, reflective ending and credits. |

Follow the gold objective and E prompts. Rest at stone shrines, particularly before bosses. Guard ordinary attacks, use heavy blows to break a guard after Neri's lesson, and evade attacks the prompts identify as unblockable. Conversations can be advanced or skipped; records remain accessible in **Tab → remembered conversations & discoveries**. Optional discoveries and the 20-crown deeper flask provide context and a practical purchase without grinding.

After completion, **Continue** returns to the memorial. **Chapter select** offers unlocked chapters with separate replay saves and appropriate starting abilities; it preserves the campaign Continue file. No developer command is needed to reach any chapter.

## Controls and current systems

| Input | Action |
|---|---|
| WASD / mouse / Shift | Walk / orbit camera / sprint |
| Left / right mouse | Light / heavy attack; heavy becomes an opening counter when available |
| Left Ctrl / Space | Directional guard and timed parry / stamina dodge |
| F | Ashstep, after the Keeper lends it; left trigger on controller |
| Q / E / R | Lock-on / interact or advance / healing draught |
| Tab / Escape | Journal / pause; Escape pauses story sequences too |
| Arrows and Enter | Navigate menus and dialogue choices |

Controller mapping: sticks move/orbit, X/Y light/heavy, LB guard, B dodge, RB lock, A interact/confirm, D-pad up heal, left-stick click sprint, LT Ashstep, Back journal, Start pause. A physical controller remains untested. Disconnect and focus loss release actions and buffered intent. Keyboard/mouse actions can be rebound in Settings → Controls; help, subtitles and world prompts use the current mapping. Escape is reserved for pause, F8 for benchmark recording and F9 for a real viewport screenshot with metadata.

Settings have four sections: **Play** (Standard/Story difficulty, three subtitle sizes, sensitivity/inversion, optional shake off by default, reduced effects), **Display** (540p/720p/900p 3D resolution, window size/fullscreen, shadows, low-memory transitions and 30/60 FPS caps), **Audio** (master/music/effects/ambient), and **Controls**. HUD remains at a logical 720p size while 3D rendering scales independently. Low baseline is 720p/30 FPS; the optional 60 FPS cap is experimental and carries no performance guarantee. Story reduces incoming damage by 40% and widens parry timing; every story path and ending remains available.

Combat has active hit windows, once-per-swing damage, interruption/recovery, stamina, posture, health, guard/parry, dodge, healing and checkpoint restart. A single 160ms input buffer accepts recent recovery intent and preserves its dodge direction; attacks stay committed through anticipation/active frames. Menu-closing clicks are quarantined. Ashstep costs one of three Resolve charges; exact defensive timing opens a heavy counter. Hits and parries replenish Resolve. Elites catch careless evasion; later wards and unguardable attacks make positioning matter. An encounter coordinator limits nearby active enemies to three and committed attacks to one. Projectiles snapshot their damage rules, and corpses/effects/audio remain bounded. Eighteen original articulated runtime characters share authored pose timing and a displacement-driven leg solution. Camera collision pulls in immediately and releases outward gradually; lock-on can acquire a nearby opponent behind the player.

Fourteen original synthesized clips provide separate calm/combat music stems, wind/river/realm ambience, surface footsteps and combat sounds. Music blends without restarting at every small zone boundary; aftermath and memorial dialogue have deliberate quiet. Detailed bird, bowl, letters, Ledger seals, home table, market awning and route lanterns replace some generic interaction props. These changes are implemented and tested for behavior/resource integrity, but have not had a rendered art or listening review here.

## Saves, migration and logs

Windows data: **`%APPDATA%\AshenVow\`**. Schema-two `progress.json` records chapter, zone, checkpoint, objective, flags, boss defeats, rewards, purchases, abilities, Resolve, health/heal progression, canonical death/resurrection and ending/credits. Continue returns to a valid checkpoint. Ordinary death refills checkpoint health/draughts/Resolve; it never repeats the canonical resurrection. Cleared encounters stay cleared; unfinished ones reset. Unique rewards and purchases cannot be farmed by reloading.

Schema-one opening saves migrate explicitly, preserving flags, currency, purchases and rewards. **`progress.schema1.backup.json`** retains the original before migration. Normal safe replacement retains `progress.backup.json`; damaged files are preserved and explained, and future schemas are refused without silently loading an older backup. Settings remain in `settings.cfg`; Godot logs are in `logs\godot.log`. Replays use `chapter_replay\`. Tests use separate `campaign_validation\`, `transition_validation\`, `validation_systems\` and other fixture folders.

## Verification and limits

The [test record](docs/testing.md) distinguishes automated execution from visual checks. The source suite passes at 30 and 60 Hz simulation, including the complete campaign and relaunch. Exported-build checks cover quality regressions and repeated full-campaign travel. No game window was opened in pass three. Visual animation/camera review, subjective audio review and physical devices remain untested under the user's Remote Desktop restriction. Historical opening screenshots remain in `docs/evidence`; they are not images of the pass-three build.

One pass-two normal-speed headless traversal observed **375 seconds**, with fast dialogue and automated combat. Current accelerated checks report simulation time and wall time separately. These are not human duration or FPS benchmarks. **The compact multi-hour goal has not been achieved or measured**. The Ryzen 5 5500U laptop remains untested; a 30 FPS design target is not a measured result.

For local acceptance, follow the [target-laptop benchmark guide](docs/benchmark.md). On that laptop, fill `benchmark-environment.json` from the example and invoke `tools\benchmark.ps1` for a sustained automated route, or press F8 during manual play. Reports include frame distributions/spikes, available counters and transition stages; F9 captures real game screenshots with machine/preset metadata. The wrapper also samples process memory. **This graphical procedure was prepared for you and has not been run on this Remote Desktop.**

- [Design and chapter content](docs/design.md)
- [Architecture, ownership and loading](docs/architecture.md)
- [Asset pipeline and provenance](docs/assets.md) / [asset manifest](game/assets/manifest.json)
- [Performance targets and actual measurements](docs/performance.md)
- [Validation commands and evidence](docs/testing.md)
- [Local laptop benchmark and screenshot procedure](docs/benchmark.md)
- [Continuation record](docs/progress.md)
- [Build and release instructions](docs/build-release.md)

Original code, writing and assets use the [MIT license](LICENSE). Godot and component notices accompany exports. No repository or website has been published; release automation, optional Android and the download site remain pass-four work.
