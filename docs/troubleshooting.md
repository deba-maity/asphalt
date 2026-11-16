# Troubleshooting

Keep progress/logs and record the exact error before changing anything. Player files live in `%APPDATA%\AshenVow\`; paste that path into Explorer. Commands below run from `C:\Users\debajyothi.m\wuk\ashen-vow` unless stated otherwise.

| Problem | What to do |
|---|---|
| Godot executable not found | From the root run `powershell -File .\tools\setup.ps1`; or pass `-GodotPath` with the actual full standard 4.7.2 executable path. `GODOT_EXE` is another shell-local option. |
| Wrong engine/template | Use **4.7.2 stable standard**, not .NET/another patch. `setup.ps1 -Templates` retrieves pinned Windows members. For editor-installed matching templates pass `-TemplateDirectory`; wrong SHA fails deliberately. Do not edit pins to bypass an integrity error. |
| First import takes time | Wait for headless import/editor scan to finish; inspect `tools/logs/*-import.log`. Initial imported cache is generated locally. A fresh checkout has no `.godot`. Concurrent builds in one checkout are unsupported. |
| Interrupted preset rewrite | From root run `python .\tools\prepare_export.py --restore`; then retry. Backup file is `tools/cache/export-presets.original`. |
| Missing indirect resource after export | Keep export_filter all_resources and content/*.json. Check campaign manifest paths/case, zone scene dependencies, import errors and packaged test logs; rerun full release verification. Do not distribute a source-only path workaround. |
| Portable executable fails | Fully extract the **Windows x86_64** ZIP, compare SHA-256, keep notices/data together. PCK is embedded. Check OpenGL 3.3-capable driver support and logs. Record security/driver messages; do not disable security software. |
| Failed chapter transition | Use the recovery/checkpoint option; keep progress and error log. The coordinator validates before committing arrival and can restore checkpoint. Report origin/destination/objective and `BUILD.json`. Do not rename zone/checkpoint IDs in a save. |
| Missing audio | Check Settings Audio master/music/effects/ambient, Windows output and app mixer. Remote/headless tests do not play/listen to sound. Capture the zone/context and log for failures. |
| Mouse/focus capture | Escape pauses/releases capture. Resume, release held actions, then click/gameplay deliberately. Focus loss resets buffered intent. Check rebindings in Settings Controls; avoid conflicting bindings. Physical device acceptance remains open. |
| Low FPS | Start 720p/30; lower 3D to 540p, disable shadows/reduce effects. Use normal plugged-in laptop conditions and record preset/driver. Follow benchmark.md; no FPS is guaranteed. |
| Wrong resolution | 3D height and logical HUD/window size are separate. Check Settings Display 3D resolution, window/fullscreen, OS scaling and monitor mode. Save settings and restart if the device/window manager behaves unexpectedly. |
| Android SDK/signing | Follow android.md exact JDK17/API36/build-tools36.1.0, shell paths and same-version template. Missing key/alias/password or different update signer must fail; never commit keys. Android touch/device support is incomplete. |
| Pages 404 | Check Settings Pages Source is GitHub Actions, successful Deploy job/github-pages environment, and use the exact URL including repository subpath. Run local HTTP preview with that subpath. Root-relative assets or `file://` previews are insufficient. |
| Release link missing/404 | Before publication this is intentional. Publish coherent assets to the actual public repository, then run Pages with that exact tag. site_release.py must anonymously verify names/bytes/SHA. Draft/private/missing/rate-limited assets must not enable downloads. Re-run snapshot verification after fixing access; do not hand-edit fake links. |

## Damaged save

Close the game. Copy the entire AppData AshenVow folder to a safe backup first. The game validates progress, retains `progress.backup.json`, preserves damaged files and reports recovery. Schema-one migration retains its original backup; newer unknown schemas are refused even when an older backup exists. Do not edit your only copy or delete both save files. If automatic recovery fails, send preserved copies and `logs/godot.log` privately to the owner. Restore a known-good **copy** only after checking version/schema compatibility. Settings and replay files are separate; resetting a display preference does not require deleting campaign progress.

For updates, extract the new build to a new game directory and keep AppData. Back up before first launch. An Android uninstall may remove saves; signed same-ID `install -r` update behavior remains untested.
