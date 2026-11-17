# Ashen Trial: motion and presentation revision — 0.6.0-rc.1

This revision concentrates on the existing duel with the Cinder Warden. Select **Enter the Ashen Trial** from the title screen. The six-chapter campaign remains separately selectable and retains its own saves and art.

The improvements are implemented in the playable project. The underlying characters are still stylized Quaternius assets with animator-authored clips. This revision does not establish God of War or Black Myth: Wukong quality, realistic character art, facial performance, or bespoke cinematic combat choreography.

## Motion and combat

- Local bone poses interpolate between physics ticks. Parent movement uses Godot physics interpolation, while the skeleton avoids a second interpolation pass. Hit stop freezes both pose snapshots, and teleporting clears old history.
- Interruptions use decaying rotational and positional offsets that preserve the outgoing pose and approximate velocity. Quaternion logarithms, exponentials and a rotation Jacobian handle large non-collinear changes. The authored clip remains the destination; animation is not replaced with generated sine-wave motion.
- Walking and jogging use their own extracted stride lengths. A contact-phase bake aligns directional loops before blending. Analog input retains magnitude, lateral/backward speeds are bounded, and stationary turns use authored footwork and extracted root-yaw curves.
- Foot contacts retain their old anchor while releasing, avoiding abrupt replanting. Ground correction, acceleration lean, target gaze, guard recoil and repeated hit reactions are bounded. Some foot sliding remains, especially in low lateral swing phases.
- A 70-particle mantle on each fighter responds to movement, gravity and bounded wind. Constraints, body capsules and floor correction control its shape. It has no self-collision or wall collision and is not a production garment simulator.
- Damage follows the held sword through the arm's interpolated joint chain. Sweeps are clipped to the actual damage interval, including intervals crossed between ticks. Each finisher cut can claim one hit per target; interruption cancels further claims. Fast blade motion is not mistaken for actor teleportation.
- Drinking shows a flask and hides the sword. Health arrives when the bottle reaches the mouth; interruption cancels the pending heal. Defeat releases one physical sword with blade, guard and grip collision shapes.

## Presentation and sound

The camera follows interpolated movement, eases encounter framing and changes field of view modestly during sprinting. A separate spring-arm collision mount preserves the camera offset: wall retraction is immediate, while outward release is interpolated. Short blade ribbons and bounded impact particles follow contact; reduced-effects settings suppress them. The trial HUD removes the campaign objective panel, separates messages from the boss bar and shows delayed damage on the boss health display.

The courtyard uses CC0 Poly Haven stone/ground maps, mossy rock meshes, a castle door and forest panorama. Architectural edges are beveled. The collidable colonnade sits outside the fighting ring, leaving the duel floor clear. Character and environment textures use mipmaps and high-quality compressed imports up to 2048 pixels. Sources are pinned in the provenance files; game startup makes no network requests.

Seventeen CC0 Kenney foley clips play through a bounded spatial voice pool, with contact-driven steps, variation and restrained room reverb. An original 16-bar D-minor score uses CC0 VSCO 2 Community Edition instrument recordings. Its two 48-second PCM stems share one synchronized stream; the second layer rises during the Warden's second phase without restarting the music.

Display settings now offer 30/60/90/120 FPS caps, 540p through 1080p rendering, and off/2×/4× MSAA. Fresh settings default to a 60 FPS cap and 2× MSAA. Existing saved settings are respected: if a prior installation is capped at 30, choose **Settings → Display → 60 FPS**. A selectable cap does not demonstrate that a particular GPU sustains it.

## Verification

All Godot execution for this revision is headless. No graphical game was opened, no desktop input was captured, and no human duel or subjective audio listening acceptance is claimed.

The [evidence directory](evidence/motion-amplification/) records the final test results, build identity, source hashes and endurance scope. The original three-hour run freezes an early candidate. A separate later run checks the more complete candidate; these are distinct snapshots, not a claim that the final executable received every minute of earlier testing.

The isolated review captures actual runtime post-IK joints, cloth and props under scripted input. A hidden browser renders those recordings with Three.js and independent lighting. Its stills/video are **not Godot screenshots**, do not reproduce the game's camera or shading, and cannot establish laptop GPU performance. No concept art or unrelated footage is used as gameplay evidence.

Gait telemetry compares the previous commit with this revision using the same fixture. The metric is horizontal toe speed while two consecutive samples are below seven centimetres. Low swing motion can enter this metric: it is not a pure planted-foot slip measurement. Travel speeds also changed for strafing/backward movement. See the comparison data before drawing conclusions about individual gaits.

## Optional authoring and inspection

Normal setup/build uses committed assets. It does not require Blender, an asset account, NumPy, SoundFile, Node or an internet connection at runtime. Optional regeneration uses Python with NumPy and SoundFile; the isolated reviewer uses Node and pinned development dependencies.

```powershell
python .\tools\fetch_court_assets.py
python .\tools\fetch_trial_audio.py
python .\tools\author_trial_score.py
python .\tools\configure_texture_imports.py
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --editor --import --quit
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/bake_gait_phases.gd

# Record actual runtime joints without opening the game.
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/export_motion_review.gd
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --fixed-fps 60 -- --test-record-motion
npm ci --prefix tools/qa
npx --prefix tools/qa playwright install chromium
node .\tools\qa\review-runtime.cjs --video

# Freeze a separate source snapshot and run a real-time headless stress fixture.
# Use a new label for each run; prior snapshots are never overwritten.
python .\tools\run_endurance.py --seconds 5400 --label my-candidate
```

The endurance fixture replenishes health/stamina, exercises actions and creates a rematch every two minutes. It checks bounded node count and Godot static memory after warmup. This tests stability, not difficulty balance, GPU performance, or a natural three-hour playthrough.

Credits and redistribution notices accompany builds: [characters/motion](PERFORMANCE_ASSET_LICENSE.txt), [courtyard art](COURT_ASSET_LICENSE.txt), and [foley/instrument recordings](TRIAL_AUDIO_LICENSE.txt). Original integration and score composition remain MIT; the credited source art and recordings retain CC0.
