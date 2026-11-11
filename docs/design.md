# Design and chapter outline

The ordinary life must matter before it is lost. Rayan is competent, human, and paid modestly. Hearthmere's clay houses, honeybread, buckles and family jokes establish the scale of his world. Black cords on the road crew foreshadow an organization without turning this opening into exposition. Dialogue carries the story without voice acting. Combat has no gore or dismemberment.

## Implemented: ch01_bread_steel — Bread and Steel

One compact connected environment: `zone_hearthmere` and `zone_alder_road`. No loading wait between them. The journey is family → work → fallen cart → shrine → alder ambush → kiln foreman → pay → bread → family supper. Two enemies in each normal encounter; one foreman. The foreman cycles sweep, sweep, overhead slam, with a long punishable final recovery. Heavy attacks interrupt him; light attacks do not interrupt his attacking armor. Gold rings and body poses telegraph enemy windups. Guard works from the front; a parry costs stamina and staggers the attacker. A dodge's middle protects the player; its recovery is vulnerable.

The shrine is optional. Checkpoint restart resets unfinished encounters; cleared encounters, pay, purchases and family events persist. Returning to town takes less than half a minute on foot; there is no repeat ambush or artificial waiting. The ending displays completion and saves `ch01_complete` and `evt_family_supper`. No later-campaign button appears.

## Planned narrative — not implemented

| ID | Chapter | Purpose |
|---|---|---|
| ch02_unlit_hearth | The Unlit Hearth | A return to an attacked settlement. Quiet aftermath, covered household objects, testimony from neighbor Edda; no explicit images of the family's deaths. The black cords lead to the Cinder Ledger, an organization selling protection through terror. |
| ch03_levy_of_ash | Levy of Ash | Travel through Sere Fen with a survivor. Protect a ferry and follow an intermediary. First later boss and meaningful equipment choice. |
| ch04_last_breath | The Copper Stair | Enter the Ledger's counting city. Revenge isolates Rayan; an ambush kills him. |
| ch05_counting_shore | The Counting Shore | An otherworldly trial offers return at the cost of a precious memory. The player gains vow-step and guard-break capabilities through playable trials. His family cannot be restored. |
| ch06_debts_at_dawn | Debts at Dawn | Return through changed territory, dismantle the Ledger's power and confront Halvek. End with Rayan choosing to protect others while carrying his grief. A last crust left at the family marker echoes chapter one. |

These are design commitments to refine in pass two, not scenes, quests or unlocks currently available. Only `sword_basics` is a permanent unlock in the initial save.

## Scope and presentation

Original stylized historical fantasy with subdued cloth, timber, clay, stone, and long late-day shadows. Third-person melee, readable attacks and a small active-enemy count. No endless arena, multiplayer, loot treadmill, backend, live service or copied franchise material. AI opponents pursue in sight within their small notice radius; this first road does not require a navigation mesh. Later environments will need path navigation and encounter activation.
