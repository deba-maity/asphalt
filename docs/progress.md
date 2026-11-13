# Pass-three continuation record

Date: 2026-11-13 (client date). Repository: `C:\Users\debajyothi.m\wuk\ashen-vow`. Godot **4.7.2 stable standard / Compatibility** remains pinned. Pass-one `dec13db` and pass-two `6cd41be` remain in Git. Earlier records are retained in `docs/history`.

## Implemented improvements

- Preserved the complete six-chapter campaign, original opening, canonical death/resurrection, ending, chapter replay and schema-one/two saves. No unrelated systems or network dependency were introduced.
- Added a single 160ms recent-recovery input buffer with a captured dodge direction. Windup/active attacks stay committed. Story, hit, death, menus, focus loss and controller disconnect clear intent. Returning from menus/dialogue requires a short release interval so closing clicks cannot attack.
- Fixed projectile rule ownership: a shot keeps its attack rules after its shooter changes state; a parried shot cannot revive a dead shooter. Cached melee query shapes avoid repeated shape allocation.
- Added Story and Standard difficulty, with 40% less incoming damage and a wider parry on Story. All progression/endings remain available. Directional guard/posture and existing enemy behavior budgets remain.
- Added readable threat/counter text, bounded impact rings, optional small camera shake off by default, and reduced impact effects. Lock-on can acquire an opponent behind the player. Camera collision retracts immediately and releases outward slowly; floor snap supports gentle inclines.
- Replaced velocity-only leg cycling with measured-displacement cycling and an analytic two-link hard-joint leg solution. Lowered the rest hip to correct an approximately 6cm offset. Anticipation, visible swing and recovery share the physics combat clock. Parry response cannot overwrite hit/death/attack pose ownership. These changes still need a rendered review.
- Added tabbed settings, keyboard/mouse rebinding with conflict checks and updated prompts, 23/27/31 subtitles, sensitivity/inversion, independent audio volumes, window/fullscreen choices, 540p/720p/900p 3D rendering independent of HUD scale, shadows, low-memory transitions and 30/60 FPS caps. The low target stays 720p/30; 60 is experimental and unverified on the laptop.
- Added original footsteps, periodic ambient loops and synchronized calm/combat music stems; separate Music/Effects/Ambient buses, bounded voice pool, cue variation and deliberate quiet contexts. Small zone changes retain the music clock.
- Added purposeful original bird/bowl/letter/book/insignia/table/awning/lantern/court props and chapter palette differences. Fixed batching so the animated millwheel's geometry stays owned by its moving parent.
- Added local benchmark/capture tools: frame distribution and spikes, available engine counters, loading stages, machine/preset metadata, F8 report recording, F9 actual screenshots and a sustained-route PowerShell wrapper with process-memory sampling.
- Fixed closing during a background transition: keep scripts/services alive, poll the uncancellable task to completion, discard it and then quit. An exit/relaunch fixture now covers that race.

## Actual validation and constraint

The user said not to play on this Remote Desktop. **No graphical game window or audio playback was opened in pass three.** Source checks passed at both 30 and 60 Hz simulation, including 216 grouped assertions plus explicit close/relaunch checks and full New Game-to-credits/Continue traversals. Physics remains 60 Hz. Packaged quality checks passed; the exported executable completed **three whole headless campaigns / 27 zone transitions** in a sustained accelerated check and then passed a separate Continue. See `docs/evidence/pass3` for exact logs, hash and measurements.

The 33.97-second sustained run was accelerated headless development work, not a 15-minute thermal test or a rendered benchmark. GPU timing, graphics memory, actual target-laptop frame times and subjective visual/audio/device quality remain unavailable. No new pass-three screenshots are claimed. Historical pass-one captures are not current-build evidence.

## Unfinished acceptance

The campaign remains short; the multi-hour goal is unmet/unmeasured. Hard-jointed art, approximate gait/foot handling and economical environments are not production-polished. Rendered full-campaign review, sound listening, controller/physical-mouse/fullscreen checks, longest-session save/error review and actual Ryzen 5 5500U benchmarking are **required release gates**. Read `known-issues.md` and `benchmark.md`; do not silently relabel them as completed polish.

## Next pass

Pass four can focus on clean-checkout reproducibility, build/CI scripts, archives/checksums, notices, platform checks and a download site for an identified repository. Preserve Godot 4.7.2, schema-one/two migration, stable chapter IDs and the returned-body contract. Obtain real laptop reports/captures and human acceptance before claiming release readiness. Optional Android still needs feasibility, touch UI and device work. No website, remote repository, paid asset, service or account was created.

Useful commands: `tools/test.ps1 -Campaign`, `tools/test.ps1 -Campaign -SimulationHz 30`, `tools/build.ps1`. They stay headless. `tools/benchmark.ps1` without `-Headless` is an explicit local user action for the play laptop and must not be run graphically here. Runtime assets/data are committed; engine/templates, `.godot`, logs and exports remain ignored generated output.
