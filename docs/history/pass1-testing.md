# Validation and manual checks

Run from the repository root with the pinned editor. `tools/test.ps1 -Rendered` imports, runs 31 meaningful logic checks, starts a rendered input/system test, starts a fresh-save rendered chapter traversal, then exits/relaunches and continues that completed save. Every process returns a failing status on failed checks. Developer transcripts are in `tools/logs`; the retained smaller reports are below. Validation save folders are separate from normal progress.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Rendered
# Individual commands:
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/unit_tests.gd
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --path game -- --validate-systems
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --path game -- --validate-play
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --path game -- --validate-continue
```

## Actual evidence, 2026-11-11

- Logic: **31/31 passed**. Damage only in the active window, once per target per swing, new-swing reuse; stamina spending/refusal/recovery; attack-state exclusions; parry/held guard; dodge invulnerability/recovery; death exclusions; real-file save/load round trip; previous-backup recovery; rejected invalid values/schema; damaged-file preservation; reward/purchase idempotency; persisted chapter completion.
- Rendered systems: **24/24 passed**. Engine input events exercise W, Shift, mouse orbit, left/right click, Ctrl/release, Space, R, Escape pause/resume and Tab journal. Tests observe actual character movement and combat state, an actual camera-blocking wall, Q target selection, hurtbox damage exactly once per swing, E family interaction, dialogue damage exclusion, fatal-damage screen, checkpoint restore with one player and retained story flag. The isolated camera/hurtbox tests place test actors; these are separate from campaign traversal.
- Rendered fresh-save campaign: **passed**. The script walks the connected map through normal movement, selects normal attacks/guard/healing, takes the contract, defeats all five enemies in all three encounters, rests at the shrine, gets 30 crowns, buys bread for 8 and completes supper. It does not teleport, bypass health/damage, grant invulnerability or directly set chapter-completion flags. It advances dialogue without reading delay and is not a human playtest. Pause position freeze is checked at the end.
- Separate process relaunch + Continue: **passed**, preserving `ch01_complete`, supper, the claimed reward, purchase and 22 crowns. See [continue report](../evidence/continue.txt).
- Rendered menu bounds: **passed** for title with Continue present, settings and journal at 1280 × 720. [UI transcript](../evidence/ui.txt) and additional captures `00_title.png`, `07_settings.png`, `08_journal.png` record the layouts. This caught and fixed an overflowing controller-help line.
- Godot headless import and Windows preview export ran with 4.7.2 stable and matching Windows release templates. See [build instructions](build-release.md) for export smoke evidence and limitations.

Reports: [logic](../evidence/unit.txt), [systems](../evidence/systems.txt), [chapter traversal](../evidence/playthrough.txt), [continue](../evidence/continue.txt). Screenshots below are actual Godot viewport captures, not generated promotional imagery. They were inspected to find and fix washed lighting, obstructed home framing and dialogue presentation. They establish that these scenes rendered; they do not prove animation quality over time or a human user's control experience.

| Capture | Scene |
|---|---|
| [01_settlement.png](../evidence/01_settlement.png) | Home, family and village |
| [02_movement.png](../evidence/02_movement.png) | Journey onto the woodland road |
| [03_normal_combat.png](../evidence/03_normal_combat.png) | Road bandit windup and lock-on |
| [04_foreman.png](../evidence/04_foreman.png) | Foreman encounter |
| [05_return_home.png](../evidence/05_return_home.png) | Honeybread/family dialogue |
| [06_chapter_complete.png](../evidence/06_chapter_complete.png) | Deliberate saved endpoint |

## Human verification still required

- Play on the actual Ryzen 5 5500U laptop; assess sustained frame times, display scaling and settings.
- Use physical keyboard/mouse and a real controller. Automated input injection is useful evidence, not a physical-device test. Unplug a controller while guarding/moving and check no stuck actions.
- Assess camera comfort at all wall angles, lock-on readability, pose continuity, sword clipping, gait matching, dodge feel, audio levels and subtitle readability. Test all menu choices with the mouse and controller focus.
- Repeat from a human fresh save with optional conversations, declining the contract/purchase, dying mid-encounter, save/quit mid-quest, and backup recovery after a deliberately damaged **copied** save. Avoid damaging real progress.
- Resize the window and check the fixed 720p viewport. Long sessions, unusual Windows username paths, inaccessible-save-folder errors and power-loss interruption need broader coverage.

Known fixes during pass one: accepted safe StringName flag keys before JSON serialization; stopped invisible UI overlay consuming mouse events; routed Tab before GUI focus navigation; removed unused sky radiance generation that emitted GL shutdown leaks; moved a house out of the direct return-home route; reframed family dialogue; kept long control help within the viewport. Final reports supersede earlier development transcripts.
