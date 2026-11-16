# ASHEN VOW

An original offline, single-player, third-person sword adventure. Rayan begins with family and paid protection work; **six playable chapters** lead through revenge, a costly resurrection and an ending with credits. Checkpoints, save migration and chapter replay are implemented. Native **Godot 4.7.2 stable standard / GDScript / Compatibility**, no Electron or runtime network dependency.

**0.4.0-rc.1 is a Windows candidate, not a production-quality release.** The campaign is short; the multi-hour goal is unmet. Hard-jointed art, animation, camera, synthesized sound and physical inputs need human acceptance. Ryzen 5500U performance is unmeasured. No game window was opened on this Remote Desktop. Working title; no trademark clearance claimed.

Repository: `C:\Users\debajyothi.m\wuk\ashen-vow`. Project: [game/project.godot](game/project.godot). Single version source: [release-config.json](release-config.json). **No GitHub remote, public release or public website is configured.** No download URL is invented.

## A. I want to download and play

The local candidate is at **`exports\releases\v0.4.0-rc.1\AshenVow-v0.4.0-rc.1-windows-x86_64.zip`**. Beside it are `SHA256SUMS.txt`, `release.json`, `portable-verification.json` and a separately labelled source ZIP. After publication, select the **windows-x86_64.zip** asset in this project's actual GitHub **Releases** page. Source ZIPs require development tools. **APKs are for Android, not your Windows laptop. No APK is supplied.**

1. Compare the complete SHA-256 with the manifest from that release. From the folder containing the downloaded files:

   ```powershell
   Get-FileHash -Algorithm SHA256 .\AshenVow-v0.4.0-rc.1-windows-x86_64.zip
   Get-Content .\SHA256SUMS.txt
   ```

2. Right-click the ZIP → **Extract All** into a new folder. Open its `AshenVow-v0.4.0-rc.1-windows-x86_64` directory and double-click **AshenVow.exe**. Keep its README, BUILD.json, credits and notices together. The PCK/game data is embedded in the executable; Godot, Python, a browser, an account and internet are unnecessary at runtime.
3. Choose **New Game**, follow the objective and E prompts, speak to Mira and Saren. Replacement asks for confirmation. **R** drinks a healing draught; stone shrines refill supplies and save checkpoints. **Continue** returns to a valid checkpoint. Ordinary combat death retries it; authored story progression is separate. After the ending, Continue stays at the memorial. Chapter replay uses separate saves.

This build is **unsigned**: no code-signing certificate is configured. Do not disable Windows security. Preserve any block/error message and report it to the owner. Download only from the actual repository chosen by the owner.

### Controls and settings

| Default input | Action |
|---|---|
| WASD / mouse / Shift | Move / orbit camera / sprint |
| Left / right mouse | Light / heavy attack |
| Left Ctrl / Space | Directional guard and timed parry / stamina dodge |
| Q / E / R | Lock-on / interact or advance / heal |
| F | Later defensive ability |
| Tab / Escape | Journal/help / pause (including story) |
| Arrows / Enter | Menus / confirmation |

Controller: sticks move/orbit, X/Y attack, LB guard, B dodge, RB lock, A interact, D-pad up heal, LT later ability, left-stick click sprint, Back journal, Start pause. Physical controller acceptance remains outstanding. Focus loss/disconnect clears actions and buffered intent.

**Settings → Controls** rebinds keyboard/mouse and updates prompts. **Play** has Story/Standard difficulty, three subtitle sizes, sensitivity/inversion, optional shake and reduced effects. Story reduces incoming damage by 40% and widens parry timing without removing content. **Display** has 540p/720p/900p 3D resolution independent of HUD, window/fullscreen, shadows, low-memory transitions and 30/60 caps. **Audio** separates master/music/effects/ambient. Start at **720p/30**; 60 is experimental, not guaranteed performance.

### Saves, backup, updates and reporting

Paste **`%APPDATA%\AshenVow\`** into Explorer. `progress.json` is the campaign, `progress.backup.json` the previous valid save, `settings.cfg` preferences, `chapter_replay\` replay saves, `logs\godot.log` runtime log. Tests use separate validation directories. While the game is closed, copy the **whole AppData AshenVow folder** to a backup. Extract updates into a new game folder; leave AppData in place and retain its backup until verified. Schema-one saves migrate with `progress.schema1.backup.json`; future schemas are safely refused.

No public issue tracker exists yet. Share diagnostics with the owner; after publication use the real repository's **Issues → New issue**. Include `BUILD.json`, chapter/objective/checkpoint, steps, Windows/GPU/driver, settings, log and optionally a backed-up save. Exclude personal files. See [troubleshooting](docs/troubleshooting.md).

### Hardware and limitations

Windows x86_64 and OpenGL 3.3-capable graphics are renderer requirements, **not a measured minimum specification**. Historical pass-one captures came from i7-1185G7 / Intel Iris Xe at 720p. They do not establish current-build performance. **Ryzen 5 5500U / 16 GB / integrated Radeon remains untested.** Follow [local acceptance](docs/local-acceptance.md) and [benchmark.md](docs/benchmark.md) on the play laptop. See [known issues](docs/known-issues.md) and [release verification](docs/release-verification.md). Headless success is not visual/audio/device or FPS proof.

## B. I want to open, modify, build and publish

### Directory map and prerequisites

| Path | Purpose |
|---|---|
| `game/project.godot` | Godot project; main scene `scenes/main.tscn` |
| `game/content/` | Campaign/zone/dialogue/quest/combat/pose JSON |
| `game/scripts/`, `game/scenes/` | Runtime code, rig, UI and bounded zone loading |
| `game/assets/` | Committed characters, audio, branding and license manifest |
| `game/tests/` | Fixtures and developer bake/capture helpers |
| `tools/` | PowerShell entry points, fetchers, packaging and site checks |
| `site/` | Static Pages HTML/CSS/JS, compressed historical screenshots |
| `.github/workflows/` | Validation, Windows candidate, optional Android, Pages |
| `docs/` | Architecture, authoring, tests and evidence |
| `exports/`, `tools/engine/`, `tools/export_templates/`, `tools/cache/` | Ignored generated outputs and tools |

Build: Windows x64, PowerShell 5.1+, Git, **Python 3.10+** stdlib and exact pinned standard Godot/templates. Verified locally with Python 3.14. Website QA adds **Node 24.18.0** and locked development-only npm dependencies. Optional Pillow regenerates icon/WebP assets; committed assets need no generator. GitHub CLI is only for publishing. Blender is unnecessary. Android prerequisites are separate.

Every block below states its working directory. If cloned elsewhere, replace the root path with your checkout's full path. No helper changes global OS configuration or installs unrelated tools. The PowerShell bypass applies only to that invocation.

### Setup, editor and source launch

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\setup.ps1 -Templates -ReleaseTools
```

Official versioned downloads are verified against [engine-version.json](engine-version.json). Cache locations are above. `rcedit` stamps native PE icon/version only. Use an existing exact engine by passing **`-GodotPath 'FULL PATH TO GODOT EXE'`**, replacing that labelled value with the executable's actual path, or set `GODOT_EXE` in this shell. Setup also accepts `-GodotPath`. Wrong versions fail explicitly. If proxy range requests fail, install **4.7.2 standard** through Godot **Editor → Manage Export Templates → Download and Install**, then pass its directory to build/release with `-TemplateDirectory`. Do not substitute .NET or another patch version.

These commands **open graphics**; run only on the machine where you intend to edit/play. They were not run here:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1 -Editor
# In the editor, F5 runs the main scene; F8 stops it.
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\launch.ps1
```

Alternatively import `game\project.godot` in the project manager. `Launch.cmd` invokes the same source launcher.

### Tests, Windows export and portable ZIP

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test.ps1 -Campaign -SimulationHz 30
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\build.ps1
# Review and commit source before packaging; dirty checkouts are refused.
git status --short
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\release.ps1
python .\tools\check_release.py .\exports\releases\v0.4.0-rc.1
```

`build.ps1` imports, validates templates, exports **Windows Preview** x86_64 with all resources and indirect JSON, embeds PCK and stamps icon/version. Output: `exports\windows\AshenVow.exe` and notices. Scene/dialogue/audio dependencies are included. Source-only capture/bake/notice writers are excluded; explicit packaged behavior fixtures remain accessible only through test flags.

`release.ps1` reruns tests/build, optionally signs, packages Windows/source separately, extracts to a fresh path **with spaces**, then runs quality/settings, full New Game→ending and separate Continue without editor/project paths. Logs: `tools\logs\` and release directory. Metadata records commit, date, engine, platform/architecture, status, bytes, SHA-256 and tests. Checksums are finalized after stamping/signing/packaging. [Build details](docs/build-release.md).

No certificate is configured. If you have one, `release.ps1` accepts `-SigningThumbprint` from `Cert:\CurrentUser\My` and your provider's `-TimestampUrl`, validates Authenticode, then hashes signed bytes. CI defaults unsigned. Source ZIP is exactly the recorded clean Git commit. Existing candidate archives are never overwritten; pass `-OutputDirectory` for a different directory. Fix `SOURCE_DATE_EPOCH` to `git show -s --format=%ct HEAD` for stable ZIP timestamps/build identity. Practical clean-checkout reproducibility does not promise byte-identical native imports/signatures across machines.

### Target-laptop benchmark (opens graphics)

Read [benchmark.md](docs/benchmark.md), fill `benchmark-environment.json` from the example, then **on the laptop**:

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\benchmark.ps1 -Minutes 15
```

F8 records manual gameplay; F9 captures actual viewports with metadata. Reports: `%APPDATA%\AshenVow\benchmarks\`; process memory: `tools\logs\benchmark\process-memory.csv`. `-Headless` measures simulation/resources only.

### Website preview and project subpath checks

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow'
python .\tools\site_release.py --release .\exports\releases\v0.4.0-rc.1\release.json
python .\tools\check_site.py
python .\tools\preview_site.py --base /ashen-vow/ --port 4173
```

Open **http://127.0.0.1:4173/ashen-vow/**. Ctrl+C stops it. Test another project name with `--base /repository-name/` and open that exact path. All assets are relative; deployment supplies HTTPS. There is no browser game, backend, analytics, embedded token or per-visitor GitHub API request. Metadata is generated at build time. Before publication, download stays unavailable; real local artifact size/hash can still be shown.

Stop the manual preview before automated browser checks (they own port 4173):

```powershell
Set-Location 'C:\Users\debajyothi.m\wuk\ashen-vow\tools\qa'
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium
npm test
```

Tests cover 320/390/768/1440px, keyboard focus, accessibility, reduced motion, assets, subpath, no-JS/error fallback and a clearly isolated publication fixture. Test URLs are not deployed or claimed real. Source: `site/`; generated `release-data.json` is ignored. Complete static credits are generated from committed notices with `python tools/render_site_credits.py` from the root.

### Publishing and Android

[Publishing instructions](docs/publishing.md) explain the exact remote activation: identify **your actual project repository**, configure/check origin and `gh auth status`, push reviewed source, configure **Settings → Pages → Source: GitHub Actions**, run **Windows candidate**, then **Deploy download site** with the verified public version tag. They also describe Actions logs, environments, permissions, public verification and updates. No account/repository destination is inferred here. Windows/Pages need only the automatic permission-scoped `GITHUB_TOKEN`; no token enters website source. Publication is manual, prerelease, and refuses existing versions.

[Android preparation](docs/android.md) includes exact SDK/JDK/Gradle versions from the tagged engine, preset, check-only command, signed internal-build route and required CI secrets. Android is **unavailable**, not a mobile-supported release: SDK/signing/touch/device acceptance are incomplete. Windows delivery is independent.

### Content authors and further reading

[Content authoring](docs/content-authoring.md) explains actual chapter/zone/dialogue/quest/attack sources, model import/rig contract, checkpoints, bounded transitions, stable save IDs, licenses and generated files. [Architecture](docs/architecture.md) describes the one persistent player and separate zone ownership. [Asset provenance](docs/assets.md), [progress](docs/progress.md), [release verification](docs/release-verification.md), [known issues](docs/known-issues.md).

Original code, story and assets: [MIT](LICENSE). [Credits](docs/CREDITS.txt), Godot and component notices accompany the package and website.
