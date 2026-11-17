# Pass-four release verification

This is the historical **0.4.0-rc.1** record. For the current **0.6.0-rc.1** trial, use [motion amplification evidence](evidence/motion-amplification/). Historical executable hashes and acceptance statements below apply only to their named candidate.

Client date: **2026-11-16**. Exact engine: Godot **4.7.2 stable standard**, Compatibility. Game verification remains **headless** under the user's Remote Desktop instruction. Website browser checks are headless Chromium, not game play. Current Windows candidate is unsigned. No public release/site/hosted workflow result is claimed.

| Check | Result | Evidence / scope |
|---|---|---|
| Source import / automated campaign at 30 and 60 Hz | **Passed** | evidence/pass4/source-30 and source-60; 216 grouped assertions per suite, close/relaunch and full New Game-to-credits/Continue. Includes ordinary deaths/retries, canonical death/resurrection, migration, settings, transition failure/ownership. |
| Native Windows export, icon/version and embedded data | **Passed** | tools/logs/pass4-build-first.txt and pass4-stamped-quality.txt; stamped PE passed 38/38 quality checks. |
| Static website / subpath / asset budget | **Passed** | check_site.py: relative links, image metadata, generated unavailable release state, <1.5 MB total static site. |
| Website desktop/mobile/keyboard/a11y | **Passed** | tools/qa/test-results/results.json; 7 browser scenarios at 320/390/768/1440px, axe WCAG checks, keyboard focus, reduced motion, fallback and isolated published-link fixture. First guide overflow/no-JS assertion failures fixed before this final pass. |
| PowerShell/Python/workflow configuration | **Passed** | Windows PowerShell AST, Python compileall, actionlint1.7.12 all four workflows; actions pinned official full SHAs. This is not hosted execution. |
| Clean-checkout import/build/package | **Passed** | Fresh git clone at exports/Verified source with spaces, commit d32158c; empty .godot, existing exact editor via explicit path, pinned templates, downloaded/verified rcedit. Import, source suite, native export and archive creation succeeded. See pass4-clean-setup-fixed.txt and pass4-clean-release-fixed.txt (latter ends at the subsequently fixed harness assertion described below). |
| Fresh ZIP extraction / no developer directory dependency | **Passed** | evidence/pass4/preflight-portable logs and pass4-portable-fixed.txt. Fresh temporary extraction with spaces, packaged quality38/38, full campaign/ending and separate Continue; no --path/editor invocation. Fixtures intentionally write isolated AppData test saves. |
| Artifact hashes/contents | **Passed** | check_release.py validated final ZIP/JSON manifest, size, CRC, embedded BUILD identity and source ZIP commit. Preflight identity/checksums retained separately; final candidate identity is generated at exports/releases/v0.4.0-rc.1/release.json. No preflight hash is advertised as that later candidate's hash. |
| Windows Authenticode signing | **Not run** | No signing certificate; candidate explicitly unsigned. Optional signing path has no credential-backed execution evidence. |
| Rendered game / listening / physical devices | **Not run** | User prohibited game play on Remote Desktop. Logical checks do not establish subjective quality. |
| Ryzen5500U / sustained rendered FPS / thermals | **Not run** | Target laptop unavailable; procedure in local-acceptance.md and benchmark.md. |
| GitHub release/public links/Pages/hosted CI | **Not run** | No identified origin/authentication. Complete local files plus docs/publishing.md activation instructions. |
| Android export/install/play/update | **Not run** | SDK/signing/device absent; no complete touch adaptation. CheckOnly reports missing prerequisites; no game APK. |

The six-chapter campaign and ending have automated execution coverage, but it is short. A prior normal-speed fast automated traversal was roughly six minutes, not a human duration/FPS measurement. The original multi-hour target remains unmet. Economical hard-jointed art, camera, sound and long-session comfort require human acceptance. This is a distribution candidate, not proof of production quality.

Retained evidence is in [evidence/pass4](evidence/pass4). Generated tools/caches/exports remain ignored. The preflight archive was built from d32158c; the updated verification harness was used to validate its actual unchanged bytes. Final release metadata records its own exact source commit; later documentation/evidence commits are not misrepresented as that executable's build commit.

Two verification failures were found and corrected: (1) Windows core.autocrlf made Godot-rewritten .import files appear dirty despite equivalent contents; repository .gitattributes now enforces LF for those files, confirmed in a second fresh clone. (2) the portable verifier initially demanded the word PASS in every process; Continue's actual success message is “Relaunch Continue restored ending…”. The game had exited0/restored correctly. The verifier now requires each mode's specific success marker and rejects ERROR/FAIL across stdout/stderr. Re-extraction/campaign/Continue then passed. Earlier failure output is retained; it is not presented as a game failure or a final passing pipeline.

Website screenshots here are **website QA**, not new game captures. Historical images in the site are explicitly labelled pass-one. Public-link activation is exercised only with an isolated test fixture; no public release URL is verified or claimed locally. Target-laptop/human gates remain not run for the reasons above.

## Final delivered candidate

The complete updated release.ps1 pipeline passed from clean source commit 1d4982d626db1bcc8da0ac2507bc5cf34c2e80c1. Final build UTC: **2026-11-16T09:57:08+00:00**. This documentation/evidence commit follows the executable build and does not alter its identity.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| AshenVow-v0.4.0-rc.1-windows-x86_64.zip | 38524139 | 59196466e0d4f1bcc2d80337df15486b0442e627666911c24185b8bb5824e55a |
| AshenVow-v0.4.0-rc.1-source.zip | 5795764 | e22ffe25bdd7cfd897fae44ac8b3dec4dcce47eb7641b3fb9afe9b69f51b7cb0 |

Final logs/manifest/identity: [evidence/pass4/final](evidence/pass4/final). Fresh extraction quality, full campaign/ending and separate Continue passed with the updated mode-specific verifier. Final source ZIP commit comment and embedded BUILD.json match release.json; every intended uploaded ZIP/JSON has a verified checksum.

**Passed:** same-input repeat Windows/source packaging produced identical hashes at the same epoch; existing output was refused; a deliberately altered temporary archive copy was rejected. This is deterministic packaging, not a cross-machine native byte-identity claim. No original artifact was changed by the rejection test.

**Not run:** public URLs/hosted CI/Pages, credential-backed signing, graphical/audio/device acceptance, Ryzen5500U performance and Android installation/play, for the reasons recorded above. The generated local site snapshot shows this actual candidate size/date/hash and keeps downloads unavailable until publication.
