# Content authoring and stable contracts

Current rig update: see [animation-revision.md](animation-revision.md). Bodies are now weighted ArrayMesh/Skin resources under BodySkeleton. Figure joint nodes drive the skeleton and original equipment together. Author the body in character_skin.gd, then rebake all role scenes. The older hard-joint descriptions below explain the retained driver contract, not the current body deformation.

Work from the repository root and commit generated runtime files. Run `tools/test.ps1 -Campaign` after changes. [Architecture](architecture.md) documents bounded loading and the persistent player.

## Chapters, dialogue, quests and attacks

`tools/author_campaign.py` is the editable source for later chapters, nine zone JSONs and matching `game/scenes/zones/zone_*.tscn`. It emits `game/content/campaign.json` and `zone_*.json`. Edit the generator before regenerating; direct output changes are overwritten. Opening content is hand-maintained in `game/content/chapter_01.json`, `game/scenes/zones/hearthmere.tscn` and the opening world script. Campaign index has chapter entries, zone **path strings**, default/checkpoint positions and loading estimates; do not preload scenes into globals.

Zone JSON defines interactions, dialogue, requirements, objectives, discoveries, encounters, rewards and exits. Use existing `interaction`, `lines`, `zone` helpers and effects handled by `campaign_zone.gd`/Session. `tools/author_combat.py` generates `game/content/combat.json`: attacks define anticipation/active/recovery, pose, damage, tracking and defense. Enemy behavior is in `fighter.gd` and coordinator; retain three-active/one-committed budgets. Include reload/skip/interruption coverage for new objectives.

## Add a checkpoint and transition

In the zone's authoring data, append `dict(id="cp_mill_bank", position=[3,0,-24], label="Mill bank")` beside existing `checkpoints`. Choose an unobstructed safe position and meaningful shrine label. The generator copies checkpoints into the campaign index; preserve the zone's default `checkpoint` unless intentionally changing it. Opening checkpoints need changes in both hand-authored opening JSON and its manifest construction. Test shrine save, ordinary death/retry, Continue and existing saves.

Add a destination through `zone(...)` with chapter/data/scene/default checkpoint/role dependencies. Add an exit `interaction` with `transition` equal to that **zone ID**, explicit requirements and effect where needed. Request the existing main transition coordinator; never load the next chapter globally. It validates/request-loads before releasing old state, detaches the persistent player, frees the old zone/caches, constructs and transactionally commits arrival. Disconnect persistent signals and reject stale callbacks. Add failure/quit-during-transition fixtures for new paths.

## Replace a character without breaking the rig

Original mesh source: `game/scripts/figure.gd`; shared pose rotations: `game/content/poses.json`; timing/analytic leg sampling: `animation_policy.gd`; baked role scenes: `game/assets/characters/`. No FBX/Blender importer is currently required. For future glTF assets, document editable source and runtime import paths under assets and record provenance.

Preserve Figure's role/armed interface and joint dictionary: hips, torso, head, arm_l/r, elbow_l/r, hand_l/r, leg_l/r, knee_l/r and weapon. Y up, -Z forward, metres, approximately 1.9m adult/0.64 child scale. Retain right-hand weapon grip, align blade with active hit volume and preserve Fighter's collision/hurtbox root. A skinned replacement needs an adapter from this pose/timing contract to bones. Do not rename required keys or retime visible strikes separately from damage. Test all roles, bow/shield, guard/parry, phases, story/death and returned body. Rendered foot placement/clipping still requires review.

These regenerate outputs from the root:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
python .\tools\author_campaign.py
python .\tools\author_combat.py
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path .\game --script res://tests/bake_characters.gd
python .\tools\generate_audio.py
```

Audio is original deterministic synthesis, committed as WAV. Optional Pillow `prepare_site_assets.py` generates icon files and compresses **existing real** screenshots; no invented game imagery. `render_site_credits.py` regenerates complete escaped notices.

## Saves, licenses and generated files

Keep established chapter/zone/checkpoint/objective/object/encounter/reward IDs stable. Add explicit SaveStore migration before changing IDs/schema. Preserve canonical-death/resurrection once-only counters, returned-body compatibility and separate replay store. Rewards/purchases require stable unique IDs to prevent reload farming. Test old saves and future-schema refusal.

Record author/source/license/modifications/runtime files in `game/assets/manifest.json`; retain MIT/Godot/component notices. Never infer a license from public availability. Update `docs/CREDITS.txt`, regenerate site credits and package. No paid/franchise/unknown-license assets are used.

Do not hand-edit `.godot`, import caches, baked characters, generator-owned later JSON/scenes/audio, exported PE/PCK, BUILD.json, release.json, SHA256SUMS, archives, browser reports or `site/release-data.json`. Change the responsible source then regenerate. `release-config.json` is the authoritative release version; PE and Android overrides are transient generated values. Engine/action pins are deliberate reviewed inputs.
