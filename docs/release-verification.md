# Pass-four release verification

Client date: **2026-11-16**. Exact engine: Godot **4.7.2 stable standard**, Compatibility. Game verification remains **headless** under the user's Remote Desktop instruction. Website browser checks are headless Chromium, not game play. Current Windows candidate is unsigned. No public release/site/hosted workflow result is claimed.

| Check | Result | Evidence / scope |
|---|---|---|
| Source import / automated campaign | **Passed** | tools/logs/pass4-source-60.txt; 216 grouped assertions, close/relaunch and full New Game-to-credits/Continue. Includes ordinary deaths/retries, canonical death/resurrection, migration, settings, transition failure/ownership. |
| Native Windows export, icon/version and embedded data | **Passed** | tools/logs/pass4-build-first.txt and pass4-stamped-quality.txt; stamped PE passed 38/38 quality checks. |
| Static website / subpath / asset budget | **Passed** | check_site.py: relative links, image metadata, generated unavailable release state, <1.5 MB total static site. |
| Website desktop/mobile/keyboard/a11y | **Passed** | tools/qa/test-results/results.json; 7 browser scenarios at 320/390/768/1440px, axe WCAG checks, keyboard focus, reduced motion, fallback and isolated published-link fixture. First guide overflow/no-JS assertion failures fixed before this final pass. |
| PowerShell/Python/workflow configuration | **Passed** | Windows PowerShell AST, Python compileall, actionlint1.7.12 all four workflows; actions pinned official full SHAs. This is not hosted execution. |
| Clean-checkout import/build/package | **Not run yet** | Final clean-checkout validation is the next local verification step. |
| Fresh ZIP extraction / no developer directory dependency | **Not run yet** | Release pipeline will extract in a temporary path with spaces and execute quality/campaign/Continue without --path. |
| Final artifact hashes/contents | **Not run yet** | Final package identity and hash report will be recorded after clean-checkout build. |
| Windows Authenticode signing | **Not run** | No signing certificate; candidate explicitly unsigned. Optional signing path has no credential-backed execution evidence. |
| Rendered game / listening / physical devices | **Not run** | User prohibited game play on Remote Desktop. Logical checks do not establish subjective quality. |
| Ryzen5500U / sustained rendered FPS / thermals | **Not run** | Target laptop unavailable; procedure in local-acceptance.md and benchmark.md. |
| GitHub release/public links/Pages/hosted CI | **Not run** | No identified origin/authentication. Complete local files plus docs/publishing.md activation instructions. |
| Android export/install/play/update | **Not run** | SDK/signing/device absent; no complete touch adaptation. CheckOnly reports missing prerequisites; no game APK. |

The six-chapter campaign and ending have automated execution coverage, but it is short. A prior normal-speed fast automated traversal was roughly six minutes, not a human duration/FPS measurement. The original multi-hour target remains unmet. Economical hard-jointed art, camera, sound and long-session comfort require human acceptance. This is a distribution candidate, not proof of production quality.

Final retained evidence goes in `docs/evidence/pass4/`; generated logs/caches/exports remain ignored. Release metadata records the exact source commit; later documentation/evidence commits need not be misrepresented as the executable's build commit.
