# Pass-two continuation record

Date: 2026-11-11, using the supplied client date. Repository: `C:\Users\debajyothi.m\wuk\ashen-vow`. Same Godot 4.7.2 standard/Compatibility project. Pass-one commit `dec13db` and [historical records](pass1-progress.md) preserve the previous foundation. No engine switch, unrelated application change, purchase, account, backend or publication occurred.

## Implemented now

All six requested chapters are reachable through normal play, across ten locally packaged zones. The opening and its original save keys remain. Later content includes the errand/aftermath/survivor/pursuit, Varo, two revenge locations, Neri's rescue and tempered edge, optional deeper flask, Kesran's winnable fight and Avel's skippable betrayal/fall, the Counting Shore and informed resurrection cost, the playable Ashstep lesson and veil, changed mill and reactive elites, Serit, bridge/court, Halvek's two phases, an authored resolution, memorial and credits. Optional household/organization discoveries and remembered dialogue records are functional.

Combat now has guarding/heavy/ranged/reactive behaviors, projectiles, an attack-lease coordinator, a three-actor active budget, posture effects and Resolve/counter mechanics. Default low-memory transitions disable/free previous zones before construction, keep one persistent player, and retain at most one budgeted speculative resource set. Missing paths, cancellation, duplicates and construction failures recover safely. Schema-two persistence migrates schema one with a preserved original backup and keeps ordinary death, canonical death, one return, powers and ending distinct. Chapter replay uses a separate store; Continue preserves the campaign.

## Verification and user constraint

The user instructed **not to play the game on the Remote Desktop**. Graphical runs were stopped. Subsequent validation is headless: core/campaign/state/input/layout/transition checks, complete source New Game-to-credits traversal, separate Continue, plus a packaged executable campaign traversal and relaunch. See `docs/evidence/pass2` for exact final reports and stage/memory measurements. No complete rendered or human pass-two playthrough is claimed, and no target-laptop result is inferred. Desktop capture/orbit checks are skipped under headless mode.

One normal-speed automated headless traversal took 375 seconds; accelerated runs report simulation and wall time separately. This is a short authored campaign, with immediate dialogue and automated combat in that observation. The desired compact multi-hour scope remains unmet/unmeasured and would require substantial authored expansion. Do not call the current build a multi-hour adventure.

## Stable state to preserve

Campaign definitions and checkpoint mapping: `game/content/campaign.json`. Chapter IDs: `ch01_bread_steel`, `ch02_night_cinders`, `ch03_road_revenge`, `ch04_between_ashes`, `ch05_returned`, `ch06_last_dawn`. Keep old opening keys, `zone_alder_road` alias, and schema-one migration. Canonical flags/counters: `evt_story_death`, `evt_resurrected`, `cost_isha_voice`, `story_deaths=1`, `resurrections=1`. The returned body must never resume an earlier mortal chapter in the main save. Ending: `campaign_complete`, `ending`, `credits`, `zone_memorial`. Named bosses: `boss_varo`, `boss_kesran`, `boss_warden`, `boss_serit`, `boss_halvek`.

## Pass three priorities

1. Run the game locally on the intended play machine; perform a human full-campaign review and physical keyboard/mouse/controller tests. Respect the Remote Desktop restriction here.
2. Refine hard-jointed animation, stride/foot handling, bow/throw/counter poses, weapon clipping, camera/cinematic framing, lighting, environments and audio. Current original fallback assets are functional and simple.
3. Evaluate combat tuning, normal/elite behavior, encounter composition, Resolve pressure and boss-phase readability from human play, without adding grind.
4. Improve accessibility: rebinding, subtitle sizing/contrast, assist options and controller UI. Test settings/error paths and long sessions.
5. Profile the actual Ryzen 5 5500U laptop and separate I/O, activation, shader/GPU and presentation costs. A 30 FPS design target remains unproven there.
6. Decide the authored scope needed for the multi-hour target: additional relationships, optional journeys, discoveries and distinct encounters. Preserve the complete ending and save migration while expanding.

## Pass four and remaining release work

The local Windows preview exports and has headless packaged-campaign evidence. Clean-checkout reproducibility/CI, release ZIPs/checksums/signing decisions, optional Android feasibility/touch support and a GitHub Pages download site remain future work. `site/` is reserved; there is no remote or published website. Runtime assets/data are committed, while engine/templates, `.godot`, developer logs and exports remain ignored.
