# Local target-laptop benchmark and screenshot procedure

This procedure is for the machine where you intend to play. No graphical benchmark was run on the Remote Desktop. The primary target remains Ryzen 5 5500U, 16 GB RAM and integrated Radeon. The approximately 496 MB reported dedicated allocation is not a total graphics-memory cap; shared memory is not a discrete GPU.

## Before running

Copy the Windows executable, notices and repository tools to the laptop. Copy `benchmark-environment.example.json` to `benchmark-environment.json` in the repository root and fill the form: laptop model, CPU/GPU/driver, charger/battery, existing Windows power mode, actual display resolution, preset, remote-desktop status and observations. This is manual context; the game does not change power mode, driver or firmware. The wrapper copies this form into `%APPDATA%\AshenVow\benchmark-environment.json` for the executable to read.

For the current trial, select **Lower power** in Display first: 540p internal 3D, 30 FPS cap, MSAA and sun shadows off. Then compare **Balanced** (720p/60) under the same conditions. These are selectable budgets, not guaranteed frame rates. Existing preferences are retained; do not assume an older installation changed preset automatically. Keep other applications and charger/battery conditions recorded. Warm-up and cold first-use behavior should be measured separately.

## Manual route

Launch the game locally. F8 starts recording; F8 again writes the report. F9 writes an actual viewport PNG plus JSON identifying zone, adapter, CPU, settings and your environment form. Recording does not alter story progress. Use a separate chapter replay if you want to preserve your campaign position.

For the current trial, complete the opening and three teaching echoes, then repeat the Cinder Warden, including phase two, pillar/wall camera movement and the result/pause screens. Use F8/F9 as described above; record the trial encounter alongside its shared zone identifier. For archive regression separately, play the settlement, fallen-cart fight, foreman, mill guard/bowman combination, Counting Shore trial and veil, returned elite/bowman, Halvek phases and memorial. Use consecutive natural gates/boats/chapters and several checkpoint retries. Orbit near the house, pillars and kiln, fight near a wall, turn lock-on toward a target behind you, and resize the window. Continue for at least 15–20 minutes on the laptop to expose throttling or accumulation. Listen for loop seams, balance and pause behavior. Record comfort and problems in the form; no counter replaces human observations.

## Automated sustained route (archived campaign)

From PowerShell in the repository root **on the laptop**:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\benchmark.ps1 -Minutes 15
```

This route exercises the archived campaign, not the new default trial passage. It explicitly opens a local game window, runs the real New Game-to-credits automation without debug jumps, then repeats whole campaigns until at least the requested wall time has passed. It uses dedicated campaign-validation progress rather than ordinary saves. No `--fixed-fps` acceleration is used by the wrapper, so rendering and real-time pacing are exercised. It may exceed 15 minutes to finish the current campaign. Use the window close control to stop early; existing reports are still written. Do not manually fight the automated route while it controls the player.

The route includes all ten zones, normal and combined encounters, bosses, realm effects and many transitions. It fast-forwards dialogue and uses consistent combat decisions. Its duration is not a human campaign-length claim. A manual run is still required for camera, readability, input, animation and sound assessment.

For a window-free development check only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\benchmark.ps1 -Headless -Minutes 1
```

Headless reports are labelled as development checks and leave graphics metrics null. Do not publish them as laptop frame-rate evidence. The local sustained-route harness can also be invoked directly with `--benchmark --campaign-play --benchmark-route --benchmark-seconds=900`; these are developer flags, not player-menu shortcuts.

## Files and interpretation

Reports: `%APPDATA%\AshenVow\benchmarks\<timestamp-and-run-id>\report.json`. Frame intervals include mean, p50/p95/p99, maximum and a bounded list of spikes over 50ms with zone/UI context. One-second samples include process/physics engine timings, active enemies, node/resource/physics-object counts, generated caches and supported draw/primitive/video-memory counters. Transition history separates background loading, instantiation, `_ready` work and previous-zone release. The report notes sample limits.

The wrapper adds `tools/logs/benchmark/process-memory.csv` with timestamped working set, private bytes and CPU seconds for the actual game process. Keep that CSV with the engine report. Engine static-memory counters in release builds are unavailable, not zero usage. GPU execution, driver-level VRAM/shared-memory allocation and thermal/power telemetry are not collected; use a trusted local profiler for those and attach its output. No values are invented.

Screenshot examples to collect: home/family, normal combat, a later boss, Counting Shore, returned mill, Halvek and memorial. Select real captures after checking that the metadata describes the **actual laptop and preset**. There are no new pass-three screenshots in this repository, because the user barred graphical play here. Historical pass-one captures must be identified as such if reused.

A release decision needs actual sustained target-hardware data, a complete human traversal and visual/audio acceptance. See [known issues and release gates](known-issues.md).
