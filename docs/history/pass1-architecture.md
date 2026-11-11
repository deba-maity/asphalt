# Architecture and ownership

`main.tscn` owns the main script. Main owns one `ChapterWorld` and one `GameInterface`. Loading/restarting queues the former world for deletion before creating a new one; scene-owned fighters, geometry, interactions and NPCs disappear with it. Main also handles window-close save and focus-loss pause. Scene loading is synchronous and local in pass one; no unsupported chapter destinations are exposed.

Only three focused autoloads exist:

| Service | Responsibility |
|---|---|
| Session | Plain persistent progress, quest lookup, reward/purchase idempotency, checkpoint IDs; owns SaveStore. Never stores chapter scene nodes. |
| Preferences | Input actions, independent settings.cfg, sensitivity/inversion/volume/shadows, controller-disconnect action release. |
| Sound | Six reusable one-shot voices and one low-volume looping ambience player. No network or streaming. Headless tests disable sound. |

UI coordination and zone observation are world/main responsibilities rather than more globals. `chapter_01.json` supplies zones, checkpoints, quests, NPCs, encounters, rewards and dialogue; `combat.json` supplies attack windows, stamina, dodge/parry and enemy configurations; `poses.json` supplies joint pose targets. IDs are keys, while titles are display data. Example namespaces: `ch01_*`, `zone_*`, `quest_*`, `enc_*`, `enemy_*`, `cp_*`, `npc_*`, `obj_*`, `reward_*`, `purchase_*`, `evt_*`, `learn_*`.

## Combat and animation

`CombatModel` is a testable RefCounted state machine. `idle`/`guard` can begin attacks, dodge or healing. Attacks have windup → active → recovery. Attack, dodge, heal, hit, talk, transition and dead states exclude conflicting actions. Hit can interrupt normal actions; dialogue/transition reject damage; fatal damage wins over normal recovery. Healing applies at the start of its interruptible recovery and consumes one draught. Foreman armor is an explicit exception to hit interruption, not health protection. Paused trees stop physics and game-time accumulation.

`Fighter` owns CharacterBody3D, model, visible Figure, hurtbox, logical weapon active-volume and camera nodes where applicable. Damage uses an active-window sphere query against the opposing faction's Area3D hurtboxes, plus reach, facing and environment line-of-sight tests. The model claims each target instance ID once per swing serial. A second physics tick or duplicate event cannot damage that target again. NPCs have no combat hurtbox. Body layers: environment 1, player 2, enemy 3; hurtbox layers player 4, enemy 5. The world owns a bounded enemy list; there is no per-frame scene-tree search. Scenery is batched into MultiMesh instances once at construction.

Movement is physical and animation is in-place. A joint hierarchy is authored in Figure's mesh source and baked as nine self-contained runtime scenes. Pose targets interpolate by `1-exp(-rate*delta)`. Walk/run cycles use actual horizontal speed with separate stride frequency calibration. Clips/equivalents: idle, walk, run, light windup/strike, heavy windup/strike, guard, parry response, crouched dodge, hit, heal, death fall, conversation gesture. There is no root-motion, imported skeleton, animation event damage, skinning or foot-IK solver. Runtime assets retain the same Y-up / -Z-forward basis, approximately 1.9m adult height, explicit right-hand weapon pivot and intentionally smaller child scale.

The camera has an independent yaw pivot and sphere-shaped SpringArm3D on environment layer 1, with the player's body excluded. Lock-on selects a nearby visible enemy, follows its bearing and drops on death, obstruction or excessive distance. Dialogue reframes toward the selected interactable; cursor ownership belongs to UI mode. Input hotkeys run before GUI focus navigation so Tab reliably closes the journal; the gameplay overlay ignores pointer events.

## Persistence contract

Schema 1 is JSON only: chapter/zone/checkpoint, flags, crowns, purchases, max health/current health/heal stock, unlocks, claimed rewards and playtime. No object deserialization. Validate required fields, types, allowed chapter/zone/checkpoint, finite bounded numbers, string identifiers and boolean flags. Future schema versions are refused. Loading attempts primary then previous valid backup; failure leaves damaged files intact and explains the condition on title.

Writing serializes to `progress.tmp`, flushes/closes, validates the serialized file, preserves a valid primary as `progress.backup.json` (or renames a damaged primary), then renames temporary to primary. If replacement fails, backup remains recoverable. This is a safe replacement sequence on the same volume, not a promise against all power-loss or filesystem failure scenarios. Settings are separate ConfigFile data. In-game scene nodes are never serialized. Writes occur after story/reward/purchase/checkpoint/healing changes and save/quit. Continue spawns at the checkpoint, preserving progress and saved health; death restores full health and three draughts. Encounter flags, not individual corpses, persist.
