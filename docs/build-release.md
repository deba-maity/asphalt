# Build and release

Godot 4.7.2 stable **standard**, GDScript, Compatibility. `engine-version.json` is the pin; update engine, scripts, templates, export preset and future CI together if that version changes. Official source: [release archive](https://godotengine.org/download/archive/4.7.2-stable/). Compatibility is the [official low-end/older-hardware rendering baseline](https://docs.godotengine.org/en/stable/tutorials/rendering/renderers.html).

## Local setup and launch

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1
.\Launch.cmd
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1 -Editor
```

Setup downloads the tagged win64 standard ZIP, verifies its pinned SHA-256 against the official release-asset digest, extracts under ignored `tools/engine`, verifies `--version`, and imports the project. A user-supplied matching engine can instead open `game/project.godot`. No installation, Python, export templates or internet is required to run an already-built executable. The machine-specific cached editor is not committed.

## Windows preview export

```powershell
# Python 3 stdlib is needed only to fetch templates automatically.
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1 -Templates
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Rendered
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
& .\exports\windows\AshenVow.exe
```

The template fetcher uses HTTP ZIP ranges to retrieve only debug/release x86-64 Windows templates from the official `Godot_v4.7.2-stable_export_templates.tpz`, verifies each member's ZIP CRC and extracts to ignored `tools/export_templates/4.7.2.stable`. It avoids keeping the full 1.28 GB cross-platform archive. If your proxy does not support ranges, install the **same** version's standard templates through Godot and update the two custom-template paths in the export preset to those local files. Do not substitute a different patch or .NET build.

`game/export_presets.cfg` explicitly includes JSON content and bakes the PCK into the executable. Developer tests are excluded. Build output includes `AshenVow.exe`, root license, Godot license, component notices and a SHA-256 build-hash JSON. The preview is unsigned and intended for local review. It is not published or submitted anywhere. `exports/` is ignored output. Redistribute the accompanying notices with any copy.

To regenerate dependency notices after an engine update:

```powershell
& .\tools\engine\Godot_v4.7.2-stable_win64_console.exe --headless --path game --script res://tests/write_notices.gd
```

## Actual build evidence

The pinned editor imported and exported the Windows preview successfully on the development machine. Runtime-asset inclusion was visible in the export transcript: all nine character scenes, three JSON definitions and seven imported audio resources were packed. Exported-executable smoke results are retained in `docs/evidence/export-smoke.txt`. This early preview does not establish reproducible byte-identical builds, signing, installer behavior, target-laptop performance or release certification.

## Later release pass — not implemented

Pass four will add a clean-checkout automated build, dependency verification, CI, release ZIP and checksums, versioned metadata and a download website. `site/` is reserved and empty. GitHub Pages publication requires an identified destination; none has been provided and none was invented. Android remains optional and requires touch UI, renderer/device testing and actual exports. No mobile capability is claimed today.
