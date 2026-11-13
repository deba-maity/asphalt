# Validation — pass two

All further verification after the user's Remote Desktop instruction is **headless**. The test runner opens no game window and captures no desktop input. A short partial graphical opening/input check occurred before that instruction; it is not a rendered full-campaign traversal. Pass-one screenshots and its historical report remain available. No complete human pass-two playthrough, physical-controller test, subjective listening test or target-laptop benchmark is claimed.

## Commands

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
# Real-time headless simulation instead of accelerated fixed time:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign -RealTime
# Individual developer fixtures; these remain outside normal player menus:
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/campaign_logic.gd
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game -- --test-transitions
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --fixed-fps 60 --path game -- --campaign-play
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game -- --campaign-continue
```

The runner imports, runs core logic, campaign logic, layout bounds, input/system fixtures and transitions, then optionally runs the campaign and separate-process Continue. Accelerated runs use fixed simulation time and are not performance benchmarks. Every stage fails its process on a failed assertion. Validation folders are separate from ordinary progress; the campaign harness writes under `%APPDATA%\AshenVow\campaign_validation\evidence`.

## Actual retained evidence

See [source transcript](../evidence/pass2/source-checks.txt), [campaign](../evidence/pass2/source-campaign.txt), [relaunch](../evidence/pass2/source-continue.txt), [packaged campaign](../evidence/pass2/packaged-campaign.txt), [packaged relaunch](../evidence/pass2/packaged-continue.txt), and the two transition metric JSON files. The source suite passed **160 checks**: 31 core, 34 campaign logic, 10 layout bounds, 22 headless input/system, and 63 transition/system checks, plus traversal/relaunch. Two desktop-mouse checks were skipped as described below.

| Group | What is exercised |
|---|---|
| Core combat/save logic | Active windows, once-per-swing damage, stamina, state exclusions, guard/parry, dodge, health/death, safe replacement, damaged/future saves, reward/purchase idempotency. |
| Campaign logic | Schema-one migration and preserved backup, future-schema refusal without rollback, compatible six chapter replay starts, Resolve/counter behavior, posture/defense rules, one canonical death/resurrection, boundary saves and packaged zone/quest definitions. |
| Headless input/system | Logical keyboard/button events for movement, sprint, attacks, guard/release, dodge, heal, pause, journal, actual camera-wall collision, lock-on, hurtbox damage, dialogue, fatal damage and checkpoint restore. Desktop mouse capture/orbit are explicitly skipped because no graphics window is opened. |
| Transition/system fixtures | Duplicate request, missing resource, construction failure and checkpoint recovery, stale cancellation, budget refusal, eight unload/reload cycles in both memory modes, player identity, one active zone, node-count stability, ordinary death before/after return, story skip/camera restore, pause/save before completion, optional flask, post-Warden fallback lesson, duplicate betrayal skip, separate replay store. |
| UI bounds | Title, six-chapter select, settings, journal, remembered records, subtitles, chapter card, credits and recovery panels remain within the logical 1280 × 720 viewport. This is a layout assertion, not visual inspection. |

The full campaign harness starts New Game, uses physical movement, stamina, real attack windows/hurtboxes and normal interactions, completes the opening, visits all ten zones, defeats the encounters and five later named bosses, performs the actual Ashstep lesson and veil traversal, accepts the canonical return, finishes the memorial and credits, and checks one player plus active/attack budgets. It does not teleport, grant health, set encounter/story completion flags or invoke chapter fixtures during this traversal. Separate isolated fixture tests do place actors or set initial chapter states; these are not counted as a campaign playthrough. Long dialogue is sometimes skipped through the same completion path as the UI.

The packaged executable is also traversed **headlessly from New Game through credits**, proving indirectly referenced scenes, actor assets and JSON are in the PCK. A second packaged process continues the completed memorial and verifies exactly one canonical death and resurrection. Static inspection or source-only imports are not substituted for that packaged check.

## What remains manual

On the intended play machine: assess all later art/animation, camera comfort, actual mouse capture, controller focus/disconnection, audio levels, readability, combat feel, phase telegraphs, veil effects and cinematics. Play the full journey at human reading/exploration speed. Try optional discoveries, declining choices, deaths in each boss, save/quit at chapter boundaries and mid-story, window resizing, long sessions and copied-save corruption recovery. Measure the actual Ryzen laptop separately. The multi-hour content target needs additional authored scope; do not extrapolate human duration from automation.

Foundational fixes in this pass include JSON numeric compatibility, typed save-location checks, old-zone callback shutdown, shared-script-safe loading, a real pre-construction release in low-memory mode, malformed-root cleanup/recovery, restoration of camera/input on story skip, and a remnant lesson to prevent defeating the Warden from closing the only progression path. [Pass-one testing history](pass1-testing.md) is retained for continuity.
