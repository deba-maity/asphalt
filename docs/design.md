# Campaign design — implemented content

The original opening's people, place names and ordinary details remain: Mira adjusts Rayan's buckle, Isha asks for something other than a stone, Tova saves a honeybread loaf, and Oren promises a bowl that will not leak. The later story follows those particulars rather than substituting generic memories. The family loss is shown through an altered village, folded cloth, objects and Edda's testimony. There is no explicit image of the family's deaths.

## Journey and identifiers

| Chapter ID | Active zones | Main authored actions |
|---|---|---|
| ch01_bread_steel | zone_hearthmere (also preserves legacy zone_alder_road alias) | Existing paid job, road fights, foreman, pay, purchase, supper; then a functional next-day action. |
| ch02_night_cinders | zone_cinder_errand, zone_cinder_home | Willow-bark errand; changed settlement, Isha's bird, Edda, optional sewing basket, remaining raiders, Captain Varo, dispatch and departure. |
| ch03_road_revenge | zone_sere_mill, zone_copper_stair | Guard/bow combinations, Neri rescue and revelation, tempered edge, optional flask, ferry register, occupied approach, Kesran, Avel's betrayal. |
| ch04_between_ashes | zone_counting_shore | Broken-moon memory, Keeper's informed choice, Ashstep lesson, Warden, veil traversal and the single return to life. |
| ch05_returned | zone_mill_return | Changed mill geometry, drained channel, ward, hunter/bow combination, optional Mira letter, Serit and his orders. |
| ch06_last_dawn | zone_dawn_approach, zone_dawn_court, zone_memorial | Bridge/gate combinations, register, Halvek's explanation and two phases, broken seal, bowl/bird memorial, last crust, credits. |

The six-chapter order follows the pass-two brief. Unimplemented chapter names proposed in the pass-one design were never persistence keys. Existing chapter-one keys remain compatible. `tools/author_campaign.py` is the editable source for later dialogue/quests/objects/encounters and local scene manifests. Generated content is committed.

## Opponents and progression

Five behavior families are implemented: aggressive thieves/scouts, patient guarding swordsmen, slow heavy attackers with punishable recovery, ranged bowmen with swept projectiles, and elites that guard repeated light attacks and lunge after evasive movement. Authored pairings include guard/bow and elite/bow, with readable escape space. Only one attack lease is active; waiting opponents guard or reposition, and age-based selection prevents indefinite passivity.

Named confrontations: Varo repeats lunges before a delayed feint; Kesran guards and answers a committed attack; the Still Warden uses unguardable rings and echoes; Serit changes distance to throw and cleave; Halvek changes from shield stance to seal attacks after a protected, announced phase transition. The opening foreman's original two-sweep/overhead pattern remains.

Neri teaches `tempered_edge` without payment: heavy strikes break patient guards. The optional deeper flask costs 20 crowns and raises stock to four. The opening guarantees 30 crowns before the required 8-crown loaf; Varo supplies another 20, so the optional purchase is affordable without repetition. Later first-clear rewards are finite. Required story passage never depends on optional shopping or grinding.

Ashstep is temporarily lent in the trial and retained after resurrection. F/LT spends one of three Resolve charges for a short enhanced step. Its invulnerability is 0.04–0.36 seconds; an actual defensive contact by 0.22 seconds opens a 2.5-second heavy-counter opportunity. A parry also opens a counter. Hits/parries restore Resolve; resting refills it. The commitment and recovery, limited resource, reactive elites and physical ward crossings create decisions beyond higher damage. A nonlethal Warden remnant keeps the mandatory lesson available if a player defeats the boss first.

## Death, cost and resolution

Ordinary combat death uses checkpoint restart. Kesran's fight is winnable. Afterwards, Avel's skippable betrayal and a brief input-locked fall send Rayan to the Counting Shore; no unwinnable health bar stands in for the event. The canonical death is committed once with the realm checkpoint. The Keeper states the return's cost before acceptance: Rayan keeps Isha's words but loses the sound of her voice. The trial and veil must be completed before returning. Later ordinary deaths preserve that returned body and its abilities.

Mira found a register hidden in Neri's damaged coat and copied names of families marked for Ledger violence. Halvek ordered the witnesses killed to preserve the organization through fear. Neri and the saved register make his actions known after his defeat. The memorial resolves the price without undoing it: Rayan remembers the soup joke and last crust, cannot recover Isha's laughter, and returns to protecting travelers. Credits and a useful memorial Continue conclude the campaign.

## Duration and remaining design work

This implementation supplies a beginning, middle, resurrection, climax and ending with real completion paths. Its authored content is currently short. A normal-speed headless traversal took 375 seconds with immediate dialogue advancement and automated combat. No human multi-hour claim is made. A compact two-to-three-hour target would need substantially more optional journeys, relationships, discoveries and encounter layouts. Repeated enemies, idle waiting and empty distance are not an acceptable way to reach it. Human pacing and that expansion remain future work.
