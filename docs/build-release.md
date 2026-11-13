# Build and release — pass two

Use Godot **4.7.2 stable standard**, GDScript, Compatibility, and exactly matching Windows export templates. `engine-version.json` pins version/status/renderer and the official editor ZIP SHA-256. The tagged engine is unmodified. [Official archive](https://godotengine.org/download/archive/4.7.2-stable/) and [renderer guidance](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html) remain the references.

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
# Optional fresh-tool setup; standard editor, verified before extracting:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1 -Templates
# All further verification is headless, suitable for this Remote Desktop:
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
```

The template fetcher uses HTTP ranges on the official 4.7.2 standard template ZIP, retrieves only Windows debug/release x86-64 members and validates their ZIP CRC. Cached engine/templates are ignored. If a proxy prevents ranges, install the same version's standard templates through Godot and update the two custom-template paths. Do not substitute a patch or .NET build.

The export preset packs all resources and explicitly includes `content/*.json`. The ten zone scenes hold their relevant actor scene dependencies, and manifest strings use packaged local paths. Developer validation scripts needed for headless packaged traversal are included but have no normal-menu entries; bake/image-capture/notice-generation tools are excluded. The embedded PCK means no loose data download is needed. No runtime network API exists.

Build output: `exports/windows/AshenVow.exe`, root MIT license, Godot license, component notices and `build-hash.json`. The preview is unsigned; its exact digest is in the retained build hash. `exports/` is ignored generated output. Ship the notice files with any copy. On the machine where the user intends to play, double-click the executable; neither Godot nor Python is required. No graphical launch is performed here after the user's instruction.

## Packaged headless verification

```powershell
# These flags create separate validation saves and never open a game window.
& .\exports\windows\AshenVow.exe --headless --fixed-fps 60 -- --campaign-play
& .\exports\windows\AshenVow.exe --headless -- --campaign-continue
```

The packaged full traversal reaches credits with actual movement, collisions, combat and interactions; the second process verifies the ending and canonical state at the memorial. Reports live under `%APPDATA%/AshenVow/campaign_validation/evidence` and retained copies are in `docs/evidence/pass2`. Fixed FPS advances simulation faster than wall time; it is not a graphics benchmark. Actual final process exits and build hash are recorded in [export evidence](evidence/pass2/export.txt).

Regenerate engine notices after any engine change with the headless `tests/write_notices.gd` tool. Change the engine pin, templates, script paths and future CI together. The current early preview is not a claim of byte-identical reproducible release builds, installer/signing behavior, Android support, target-laptop performance or release certification.

Pass four will add a clean-checkout release workflow, CI, archives and public download metadata. Website publication needs an identified repository; none was invented or published. Android remains optional and needs real device, input, renderer and export work. The empty `site/` directory is reserved for that later pass.

## Pass-three package evidence and local checks

The current Windows build retains the pinned engine/templates and all dynamic scenes/data. New audio, settings, quality fixtures, props and benchmark/capture scripts are included in the PCK. It passed 38 packaged behavior checks, three accelerated headless campaigns (27 transitions), and separate Continue. See `evidence/pass3/export.txt` and `evidence/pass3/build-hash.json`. No graphical launch was made on the Remote Desktop.

`tools/benchmark.ps1` without `-Headless` is an explicit local user action that opens the game on the play machine. See `benchmark.md` before invoking it. Current-build screenshots and rendered laptop metrics must be collected there; historical opening captures cannot establish pass-three visual quality. Human full-campaign, visual/audio, physical-device and target-laptop acceptance remain release blockers listed in `known-issues.md`.

The export preset carries version 0.3.0.0 as a local preview marker. Clean-checkout reproducibility/CI, final release packaging and website publication remain pass four. No new license or online dependency was introduced.
