# Pass-three validation record

**Current pass-four distribution/site/rebuild results:** [release-verification.md](release-verification.md). This page retains the pass-three gameplay evidence and its limits; no new graphical game session was run in pass four.

All verification in this pass used `--headless` on the development/Remote Desktop machine. No graphical game, audible play, new screenshot, physical-controller session or target-laptop benchmark was performed. Headless layout and animation data checks cannot establish visual quality. The restriction is carried into the README and local benchmark instructions.

## Commands actually run

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign -SimulationHz 60
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign -SimulationHz 30
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
```

The pinned editor imports first. Core/campaign/layout/input/transition/quality fixtures execute, then a real close-during-loading/relaunch pair, then New Game through credits and a separate Continue process. Fixed simulation mode accelerates wall time, while physics remains 60 Hz. `-RealTime` omits acceleration but still opens no window. Fixtures use separate user-data folders and deterministic default settings. Ordinary player preferences are not loaded or overwritten by validation. Test settings round trips use an explicit fixture path.

## Results

Both [60 Hz source transcript](evidence/pass3/source-60.txt) and [30 Hz source transcript](evidence/pass3/source-30.txt) passed:

| Group | Assertions | Behavior covered |
|---|---:|---|
| Existing core | 31 | Damage windows/once-per-swing, stamina, exclusions, defense, death, safe writes/backups, invalid saves, idempotent rewards/purchases. |
| Existing campaign | 34 | Migration, preserved schema-one backup, refusal of future schemas, chapter starts, canonical states, Resolve/counter/posture, packaged resource definitions. |
| UI bounds | 28 | Title, chapter select, all four settings sections, journal/records, extra-large longest authored subtitle, chapter card, credits and error UI in the logical 720p area. These are logical bounds, not screenshot review. |
| Input/system | 22 | Synthetic input events, physical character motion, attacks, guard/dodge/heal, pause/journal, camera wall, lock-on, dialogue, ordinary death/restart. Two desktop mouse tests are explicitly skipped headlessly. |
| Loading/system | 63 | Duplicate/missing/failed/cancelled requests, budget, repeated unloads in both memory modes, old-node disposal, one player/zone, ordinary/canonical death, skips, optional flask, fallback trial lesson and replay saves. |
| New quality | 38 | Bounded input/expiry/direction, closing-click protection, disconnect/focus release, Story damage, projectile snapshot/parry ownership, interrupted/dead attack rejection, behind-player lock/release, collision/release camera and real ramp traversal, binding conflicts/current prompts, settings and resolution behavior, buses/resources/music ownership, title silence, 30/60 animation timing and truthful benchmark output. |

That is **216 grouped assertions per simulation-rate suite**, plus successful close-during-loading/relaunch and full campaign/relaunch processes. The close fixture exposed a teardown race: quitting while an uncancellable threaded parse was active caused shutdown errors. The fix drains the request over frames before engine teardown; [close](evidence/pass3/quit-transition-fixed.txt) and [resume](evidence/pass3/resume-transition-fixed.txt) logs show clean execution.

The full traversal uses actual movement, collision, attacks, stamina, damage and normal interactions from New Game. It performs the Ashstep evasion/veil, all mandatory encounters, memorial and credits. It does not teleport, grant health, set completion flags or invoke chapter-start fixtures. Separate isolated tests do place actors and choose initial states, and those are not counted as campaign traversal. Dialogue is advanced/skipped quickly, so these results do not establish a human playtime.

## Exported executable

The Windows export succeeded with the same 4.7.2 standard templates. [Packaged quality](evidence/pass3/packaged-quality.txt) passed 38 checks. [Packaged sustained traversal](evidence/pass3/packaged-sustained.txt) completed three full campaigns and 27 transitions, with a clean [separate Continue](evidence/pass3/packaged-continue3.txt). Redirected stderr was empty and process exits were zero. This exercises dynamic scenes, original audio, JSON, input/settings, fonts/UI construction, saves and loading from the PCK. See [export record](evidence/pass3/export.txt) and [build hash](evidence/pass3/build-hash.json).

The sustained route was accelerated and headless: approximately 34 seconds wall time for three fast-play simulations. It validates repeated ownership/resource handling, not graphics performance or thermal stability. The [full report](evidence/pass3/headless-sustained-report.json) labels its unavailable counters; [summary](evidence/pass3/measurement-summary.json) is derived from that file. Release builds do not expose engine static allocation counters; null is used rather than interpreting zero as no memory usage.

## Local acceptance still needed

Use [benchmark.md](benchmark.md) on the real play laptop. Complete a human campaign; inspect feet, turns, grip, interrupted swings, dodge collision agreement, pillar/wall camera behavior, behind-target lock-on and largest subtitles. Listen to effects/footsteps/loops and quiet scenes. Try real controller disconnection, focus loss, all menu directions, rebinding, fullscreen/window changes, and long sessions. Collect current-build captures with F9 and machine/preset metadata. Measure sustained low-preset frame times and memory. [Known issues](known-issues.md) lists these release gates explicitly.

Historical pass-one/pass-two evidence remains in `docs/history` and `docs/evidence/pass2`; it is not substituted for current rendered acceptance. No test result here proves the multi-hour duration target or target-laptop 30 FPS.
