# Pass one continuation record

Date: 2026-11-11. Dedicated repository: `C:\Users\debajyothi.m\wuk\ashen-vow`. The supplied workspace was empty; no unrelated application or preexisting user work was modified. No purchase, account, backend, publication or remote repository was needed.

## Implemented

Pinned Godot 4.7.2 stable standard/Compatibility and matching Windows templates; a source project and Windows preview; physical third-person locomotion/orbit/collision/lock-on; coherent combat timings, health/stamina, guard/parry/dodge/heal, death/checkpoints; focused session/settings/audio services; JSON definitions for chapter/combat/quests/dialogue/rewards/checkpoints; UI, journal, tutorial learning and settings; safe validated saves and previous backup; original baked articulated characters, poses, environment and synthesized audio; complete opening chapter with optional details and saved completion. All intended chapter-one beats are functional. See README for the playable route and controls.

Stable identity: chapter `ch01_bread_steel`; zones `zone_hearthmere`, `zone_alder_road`; checkpoints `cp_home`, `cp_road_shrine`; encounters `enc_fallen_cart`, `enc_alder_ambush`, `enc_foreman`; reward `reward_saren_road`; purchase `purchase_honeybread`; completion `evt_family_supper`, `ch01_complete`. Keep these IDs in save migrations and later chapter manifests.

## Verification

`tools/test.ps1 -Rendered`: 31 logic checks + 24 input/system checks, fresh-save rendered traversal, then separate relaunch/Continue. Additional rendered bounds checks cover title/settings/journal at 720p. Reports and nine real screenshots are in `docs/evidence`. `tools/build.ps1` exports using the exact Windows template version; final exported-executable headless and rendered startup smoke tests exited 0. The engine archive SHA-256 matches official GitHub release-asset metadata. Development-machine hardware and observations are recorded in `performance.md`; target-laptop tests remain outstanding.

## Pass two: implement next

1. Preserve schema-1 saves; add explicit migration fixtures before adding chapters and progression. Build manifest-driven chapter loading with clear failed-load recovery and exactly one player.
2. Implement the unlit-home aftermath, survivor relationship, Sere Fen journey and later city; add objectives, checkpoints and connected exploration.
3. Implement Rayan's death, playable resurrection trial, persistent cost and new combat unlocks, later enemies/bosses, rewards and meaningful upgrade choices.
4. Finish the return confrontation and ending. Test a complete campaign from fresh and continued saves, including reward idempotency across chapters.

## Pass three and four

Pass three: animation/geometry/lighting/audio polish, planted-foot or better gait handling, combat feel, accessibility options (remapping, subtitle scaling, contrast, assist options), human playtests, target-laptop profiling and long-session/save-failure tests. Pass four: reproducible release automation/CI, release metadata/checksums/ZIPs, optional Android only after feasibility testing, GitHub Pages download website for an identified repository and final documentation. The early Windows preview is not the final pass-four release pipeline.

## Current limitations

Only chapter one is playable. No resurrection, later-campaign progression or ending exists. Original fallback animation is hard-jointed and interpolated, without IK, skinning, faces or fingers. Environment/AI/audio are intentionally simple; no navmesh is needed on this road, but later layouts require it. A physical controller, human playthrough, target laptop, extended sessions, accessibility overhaul, Android and distribution website are untested/unimplemented. The observed development FPS is an average under a cap and does not establish stable 30 FPS. Keep those distinctions in future reports.

No credentials are stored. Runtime assets and source definitions belong in Git; `.godot`, engine/templates, logs and `exports` are ignored. The current repository has no remote. Continue from `README.md`, this record, and the retained test evidence rather than treating planned chapters as implemented content.
