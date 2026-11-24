# NIGHTSHIFT

Racing, time trials and pursuit across four districts, on the `nightshift` branch of `deba-maity/asphalt`. This branch is independent of `ashen-vow`; `main` is unchanged. Current source: **1.1.0-rc.1**.

[Play Nightshift in a browser](https://deba-maity.github.io/asphalt/nightshift/)

Choose **Hit the Streets**, a mode, a district and a vehicle, then **Deploy**. Hold **W** or **Up** to accelerate and steer with **A/D** or **Left/Right**. Follow the green arrows through the numbered gates. The corner display calls bends earlier at higher speeds. An amber braking cue marks the turn on the minimap. On the district screen, choose **Via shortcuts** to have the minimap and next marker lead you onto each optional cut. Lit arches follow the deck of the selected shortcut, and the green line continues past the junction to show the exit direction. Staying on the main road restores the regular gate guidance. Cross the checkered stripe in the direction of travel to finish a lap. Sprint takes one lap and Race takes three. Solo races stay open after rivals finish. The results show your place, gap to the winner and three sector times for each lap. On a rematch, crossing a sector gate shows the time you gained or lost against your best completed run on that district, in the same mode and difficulty. Pause offers **Return to last gate** and **Restart run**.

In **Police Escape**, follow the gates to extraction. The heat display shows the nearest unit ahead or behind you. Patrols follow the main road, so taking a shortcut or accelerating away after a sideswipe can open a gap. Hold a lead of 90 metres over every patrol for six seconds to lose one heat level. The breakaway countdown appears in the heat display. A stopped car under sustained contact can be busted.

Complete a **Time Trial** to record a pace ghost for that district. On the next run, the violet outline follows your recorded line and the timer compares matching gates. The ghost and your best time live in the current browser. The ghost can be switched off in Settings.

## Install and open on your own PC

Use Node.js 22 or newer. From the repository in PowerShell:

```powershell
git fetch origin
git switch nightshift
git pull --ff-only origin nightshift
npm ci
npm run dev
```

Open **http://localhost:5173** in your browser. Keep the terminal open; Ctrl+C stops the server. Do not open `index.html` directly. The game assets are included in the repository; no Blender installation or asset account is needed to play.

To keep ASHEN VOW in its existing folder, create a separate worktree instead of switching that folder:

```powershell
git fetch origin
git worktree add -b nightshift ..\nightshift origin/nightshift
Set-Location ..\nightshift
npm ci
npm run dev
```

Use that worktree command once. If you already created a local `nightshift` branch, use `git worktree add ..\nightshift nightshift` instead.

[Revision details, isolated asset comparisons and evidence](docs/revision-1.1.md)

## What changed

- Sprint is a one-lap race against rivals; Free Drive leaves the route open for practice. These replace two menu entries whose advertised chase roles were not implemented. Race, Time Trial and Police Escape remain available.
- Apex GT and Eclipse V8 use a detailed, credited touring model with separate rolling wheels, steering pivots and stationary brake calipers. A simpler mesh takes over at distance. The other vehicles retain their procedural art.
- Motorcycles have rebuilt forks, better proportioned riders, hands attached to the steering bars, and responsive lean/tuck. Car bodies use damped suspension pitch and roll while the wheels remain grounded.
- Driving uses fixed 60 Hz simulation, interpolated moving bodies, analog steering, travel-vector drift and gradual grip recovery. A damped chase camera responds to speed; Reduced camera motion removes shake and field-of-view changes.
- Tire marks and particles use fixed storage and a small number of draw calls. Traffic follows the sampled road with continuous lane position and heading. Collision responses remove inward momentum; LAN cars turn along the shortest angle.
- Menus settle instead of continuously rendering the garage. Pausing or switching apps stops the race render loop and suspends engine audio. Battery saver also disables decorative menu animations.
- The LAN relay validates and bounds messages, limits packet rates and queued data, transfers host ownership, and reports full/disconnected rooms. Rematches immediately resume position updates, and guests keep their result screen while waiting for the host. Local play binds to this machine only by default.

This is still an independent prototype. The detailed car does not replace every vehicle or environment, and these changes do not establish AAA visual quality. Native GPU frame rate, temperature, physical controllers and subjective driving feel still require testing on your PC.

## Controls and lower-power settings

| Input | Action |
|---|---|
| W / S | Accelerate / brake and reverse |
| A / D or arrows | Steer |
| Space / Shift | Drift / nitro |
| F / R | Gun / rocket on armed vehicles |
| Escape | Pause |

Touch controls support simultaneous steering and pedals. Use the left stick or D-pad to steer with a controller, RT to accelerate, LT to brake and reverse, and RB for nitro. Start pauses or resumes. Move through menus with the D-pad or left stick, use A to choose or cycle a setting, and B to go back. Physical gamepad acceptance has not been performed.

Fresh settings start in **Battery saver**: 30 FPS, at most 600,000 internal pixels and 600 pixels high. Balanced allows 60 FPS / 1,152,000 pixels / 900 high; High fidelity allows 60 FPS / 2,073,600 pixels / 1080 high. These are upper limits; screen size and automatic resolution reduction can lower them. Existing preferences are preserved. Lower rendering work can reduce power demand, but no laptop temperature reduction is claimed.

On the public site, **Race a friend** starts a one-lap Time Trial. After finishing any solo Time Trial, use **Copy challenge link**. Opening it shows the target time, district and vehicle. A friend can race the same setup, compare their finish time and send their own challenge back.

For LAN crews, run `npm run dev:lan` and give other players the host computer's local IP address and the same room code. The first connected driver is the host and chooses the route and mode in the crew lobby. Changing a vehicle returns to the same crew; Back leaves and disconnects. This is a casual LAN relay, not an authenticated public competitive service. A static `npm run preview` build does not include the lobby relay.

## Verification and assets

```powershell
npm run test:unit
npm run build
npx playwright install chromium --only-shell
npm run test:smoke
node scripts/visual-contracts.mjs
```

Browser checks use headless Chromium and SwiftShader, with no desktop window or desktop input. Their frame counts are budget checks, not native performance measurements. `node scripts/endurance.mjs 3600 LABEL` freezes runtime files, steps simulation for a real-time hour and samples software rendering at checkpoints. Results go to ignored `artifacts/`.

The touring asset is adapted from **BMW 1 Series M In Cycles by Mike Pan**, under **CC BY-SA 3.0**, including the adaptation. See [model attribution](public/assets/touring/LICENSE.txt) and the in-game Settings credits link. Rebuild with `python scripts/fetch-touring.py`, then run `scripts/compile-touring.py` in Blender 4.5.16 with `--background --factory-startup --disable-autoexec --python-exit-code 1`. The source download is pinned by SHA-256. The car, distance mesh and rig metadata are checked for reproducible conversion. Third-party libraries retain their own licenses.

Generated bundles, screenshots and browser profiles are excluded from Git. Removing previously tracked profiles from this branch does not rewrite repository history or delete local copies.
