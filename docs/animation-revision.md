> Historical rc.2 report. The newer [rc.3 visual revision](visual-revision.md) supersedes the gait, foot-contact, materials and environment descriptions below.

# Animation and body revision â€” 0.4.0-rc.2

The user's visual review rejected the original rigid characters as too toy-like and requested God of War / Wukong-level animation. That criticism exposes a material gap in the original delivery. **This revision does not attain that benchmark.** It replaces important technical limitations, but professional character art, authored/motion-captured performances, retargeting cleanup, foot-contact work and rendered iteration are still needed. No downloaded franchise assets or claimed mocap are used.

## Implemented

- All 18 character scenes now contain a real Skeleton3D, Skin and weighted ArrayMesh body. Continuous ring geometry spans elbows and knees with parent/child weight blending. Skinning follows the retained joint-driver hierarchy; hands and weapons share transforms with the deforming body.
- Shaped waist/chest/shoulder silhouette, smaller head, curved hands/boots and facial/hair geometry replace the original body cylinders/boxes. The body uses 2,880 vertices for unarmed roles and 3,088 for armed roles, before retained equipment. These remain original procedural models with plain materials, not detailed sculpted/textured production characters.
- Directional leg targets distinguish forward/backward/sideways travel. Stance travel and phase progression use measured displacement. Knee solves remain finite across a full cycle. Foot targets are local procedural targets; terrain raycast planting, contact locks and stair adaptation are **not implemented**.
- Continuous release through the last portion of anticipation removes the old 22% pose discontinuity at damage onset. Visible strike timing still reads the actual combat clock, preserving damage/defense windows.
- Pelvis/leg weight transfer, counter-rotating head, alternating diagonal light cuts, acceleration lean, run arm/elbow changes, restrained pelvis sway/bounce and dodge compression.
- Quaternion interpolation from the interrupted pose replaces direct Euler jumps between states. Dead/hit/attack/story ownership and the same collision/player/save logic remain authoritative.

The new generator is `game/scripts/character_skin.gd`. `figure.gd` creates the retained joint/equipment rig, invokes the body generator during authoring, and samples poses during play. Baked runtime scenes contain the final mesh/skin resources: no mesh regeneration or external application is required to play. `animation_policy.gd` contains continuous attack weights and directional leg solving. No per-vertex CPU skin updates are performed at runtime; Godot owns rendering skinning.

## Rebuild and run on the play laptop

In PowerShell, from the user's existing checkout:

```powershell
Set-Location 'C:\Users\Dmaity\Desktop\asphalt'
git pull --ff-only origin ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
.\exports\windows\AshenVow.exe
```

Existing setup tools/templates remain valid. Rebuild is required; an already exported 0.4.0-rc.1 executable will not change merely from pulling source. Saves remain in AppData, unchanged. The previous release ZIP/checksums are historical artifacts and are not replaced by this revision.

For authors only, from the repository root: `& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path .\game --script res://tests/bake_characters.gd` regenerates all role scenes. Commit the generated scenes and source together. Keep bone names, parent hierarchy, rest transforms and weapon attachment contract. Body materials/mesh source remain original MIT-licensed work recorded in the asset manifest.

## Verification and remaining work

42 new headless rig/animation checks cover all 18 roles: normalized weights within serialized 16-bit weight quantization tolerance, blended joints, vertex budget, skeleton and weapon-driver transform agreement, continuous attack onset and finite directional leg solving. Existing campaign checks cover saves, collision, combat, canonical story, ending and Continue. Evidence is retained under `docs/evidence/animation-revision`.

**Not run:** graphical game inspection, subjective movement/art approval, skin silhouette under extreme poses, armor clipping, foot sliding on actual terrain, audio and Ryzen5500U GPU/frame-time measurement. The user's remote-desktop restriction remains in force. No new gameplay screenshots or AAA-quality claims are made. The weighted mesh change requires actual laptop acceptance before release promotion.

The next visual milestone needs a properly authored hero asset with UVs/materials and compatible rig, then a coherent set of idle/walk/run/strafe/start/stop/turn/guard/parry/light-chain/heavy/dodge/hit/death clips. Each needs contact and weapon-path cleanup against the gameplay clock. Add terrain-aware foot locks/IK, motion transitions and secondary animation only after reviewing those clips in the actual camera. Environment lighting/materials and cinematic staging are additional work; improved body deformation alone cannot make the existing world match the cited games.

Final local checks: **Passed** ? complete source suite including 42 new rig assertions, all 18 baked character assets, native Windows 0.4.0-rc.2 export, packaged 38/38 quality checks, full six-chapter traversal/credits and separate Continue. **Not run** ? rendered visual/hardware acceptance under the remote-desktop constraint. Source changes are intended for the existing ashen-vow branch; pull and rebuild before evaluating.
