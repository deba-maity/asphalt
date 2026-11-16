# Visual and motion revision: 0.4.0-rc.3

This revision responds to the second rejection of the game's appearance. It changes character motion, clothing, materials, scenery and camera framing. It remains an original procedural indie game, **not God of War / Wukong production quality**. No downloaded franchise assets, mocap, photogrammetry or professional sculpting are claimed.

## What changed

- Fixed sprint cadence: the previous one-metre full-cycle distance produced 5.7 cycles/second. Cadence now varies from 0.8 to 2.05 cycles/second, with contact duration limited by the leg's reach. Displacement still drives phase, so moving into a wall does not keep the legs running.
- Added ankle bones, world-space foot locks, ground-normal foot alignment and pelvis height correction. Two ground rays at most per grounded actor; no per-vertex CPU skinning. Plants release during swings, dodges, death, airborne movement, state changes and teleports. Uniform enemy scales are accounted for. Footstep audio follows actual plant acquisition.
- Replaced two-pose melee interpolation with original eight-key clips: ready, anticipation, chamber, release, contact, follow-through, recoil and settle. Light cuts alternate. The combat model's windup/active/recovery intervals remain the timing authority; damage rules and save/story progression are unchanged. Corrected the torso pitch convention and a blade path that passed behind the character during active damage.
- Added layered leather armour, asymmetric shoulder protection, fitted cuffs and boots, fingers, belt/pouches, split coat tails, a smaller scarf collar and a tapered diamond-section sword. Coat/scarf bones use bounded damped secondary motion. All 18 character scenes are rebaked, with UVs, tangents and grouped material surfaces. Bodies remain below the 6,000-vertex budget; tiny fingers/rivets use lower tessellation.
- Authored fourteen original 512px color/normal maps for earth, stone, wood, plaster, cloth, leather and steel. Import settings explicitly enable mipmaps. Maps are shared, generated offline and committed; players need no new art tools.
- Replaced the repetitive road tiles with a blended ground shader, stacked-cone trees with branching trunks/twigs and opaque individual leaves, primitive rocks with irregular reusable meshes, and cone grass with blade clusters. Added restrained foliage wind, masonry foundations, timber surfaces and roof courses. Static scenery still batches through MultiMesh; mesh/material caches are fixed reusable sets and included in benchmark telemetry.
- Added a sky gradient, cooler ambient fill, warmer directional light, filmic tonemapping and a 2048px shadow map. Camera distance changes from 5.6m to 4.25m and FOV from 64 to 59 degrees; collision retraction remains active. World labels are smaller and disappear beyond 7.5m. Compatibility rendering, resolution options and reduced-effects settings remain available.

## Verification and limits

The source regression suite includes the previous 42 rig checks and 40 new motion/geometry checks. New checks exercise attack-boundary continuity, forward blade paths, finite cadence/contact reach, four movement directions at three speeds on flat and eight-degree sloped ground, enemy scales 0.85/1.3, teleport/dodge/story-fall anchor release and outward rock normals. Grounded contact error must stay below 5mm in these fixtures. The campaign suite exercises all chapters, ending, save/Continue and transitions.

Evidence for this revision is stored in `docs/evidence/visual-revision`. The isolated character contact sheet is a CPU projection of exported mesh geometry, **not a game screenshot**. It has flat shading and omits textures, game lighting, shadows and ground IK. It was useful for correcting torso direction, collar/shoulder proportions and armour overlap; it does not establish rendered acceptance.

No graphical game execution or desktop input capture was used here. GPU shader appearance/performance, integrated-Radeon frame times, subjective animation quality, camera comfort, close-up deformation, remaining clipping and audio still need review on the play machine. No FPS guarantee or AAA-quality acceptance is inferred from headless tests. Increasing geometry, surface detail and shadow resolution has a GPU cost that these tests do not measure. Facial animation, distinct sculpted character assets, production motion capture, cinematic performances and environment art at the requested benchmark remain absent.

## Pull, rebuild and open on the play laptop

Use **PowerShell** in the existing checkout:

```powershell
Set-Location 'C:\Users\Dmaity\Desktop\asphalt'
git switch ashen-vow
git pull --ff-only origin ashen-vow
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
.\exports\windows\AshenVow.exe
```

The previous setup installation is sufficient. Launch the rebuilt EXE, not an older extracted rc.1/rc.2 executable. Existing ordinary saves remain compatible. Historical release ZIPs are not overwritten by this revision.

## Authoring

`character_skin.gd`, `figure.gd` and `weapon_geometry.gd` author the baked character meshes. `combat_motion.gd`, `animation_policy.gd` and `foot_placement.gd` control runtime motion. `scenery_geometry.gd`, `surface_library.gd`, `art_direction.gd` and the two surface shaders supply the environment changes.

Optional development-only regeneration:

```powershell
python .\tools\author_surfaces.py  # numpy + Pillow; no download/API
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --editor --import --quit
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_characters.gd
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/inspect_assets.gd
python .\tools\inspect_assets.py  # isolated geometry inspection, no game window
```

Environment API references were checked against the [official Godot Environment documentation](https://docs.godotengine.org/en/4.6/classes/class_environment.html). Actual compatibility is checked with the repository's pinned 4.7.2 engine, not inferred from that documentation alone.

Final verification: 298 headless assertions passed across the component suites, exercised at 30/60 simulation settings; native Windows export passed; the copied executable passed 38 packaged quality checks, the complete six-chapter campaign/credits and separate Continue from an independent working directory. The final story-fall guard was checked in the 40-case motion fixture at both rates and in the packaged campaign. See `evidence/visual-revision/verification.json` for the executable hash and explicit unverified visual/GPU gates.
