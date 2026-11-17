# Motion amplification evidence

Source regression: **417/417 assertions passed**, plus full campaign traversal, Continue, quit and resume transition checks. The focused trial passes 48 checks at 30/60 actual physics ticks; motion quality passes 51 at each rate; physical combat passes 18 at each rate. Test logs describe stress fixtures and do not establish natural human play or rendered quality.

The Windows candidate is **0.6.0-rc.1**, built from clean source commit `d6eb9e79ddd80eec37de3f5e0786d9c3e6ee0734`. Its executable is 304,177,200 bytes with SHA-256 `62a61babd27f2e06c1370f848f1a6ae061daf8a3294c859372baab021fcb362b`. The local delivery ZIP passes all nine checks after extraction into a fresh path containing spaces, without the editor, source checkout or `--path`: quality, campaign, Continue, and trial/motion/combat at 30 and 60 actual physics ticks. See `windows-build.json`, `portable-verification.json`, `release.json` and `SHA256SUMS.txt`.

A separate fresh Git worktree passed the complete 417-assertion suite and campaign/Continue traversal. Its first import started without a `.godot` cache, and 37 downloaded asset digests were verified after checkout. The native motion suite also passes 51 checks at 90 and 120 simulated render steps per second with 60 physics ticks. These deterministic timing checks are not GPU frame-rate measurements.

Source and portable validation now share a Windows mutex because their campaign relaunch fixtures intentionally use the same save location. An initial overlapping run exposed a temporary-save race between validators; the final source and portable suites were rerun through the lock and both passed. This tooling fix is in the packaged source commit.

Two real-time headless endurance runs completed with **zero failures and exit code 0**. The early development snapshot ran 10800.008 seconds (three hours), with 89 rematches and 25,668 action requests. The final runtime ran 5400.015 seconds (90 minutes), with 44 rematches and 13,122 action requests. Its settled node count stayed at 313; sampled Godot static memory changed by 84,420 bytes from the three-minute warmup to the final sample. See `endurance-summary.json`, the complete minute samples/logs and both frozen source manifests.

The three-hour run predates the final combat/camera/cloth/audio fixes. It is not three hours on the delivered executable. The separate 90-minute run uses the final runtime, and all 386 working source files still matched their frozen hashes at completion. The snapshot itself was also checked, allowing only its isolated user-directory override. `frozen-source-match.json` checks them against the packaged source with the stated text line-ending normalization. Intermediate intentionally stopped candidates are excluded.

The stress fixture refills health/stamina and forces a rematch every two minutes. It samples node count and Godot static memory once per minute, failing above 12 extra nodes or 64 MiB extra static memory after warmup. These are stability checks, not human play, process/GPU-memory measurements or rendered FPS acceptance.

`gait-*.json` compares commit `f8291133361260b1c196d6fa3fdeb67d56124611` with this revision. `gait-method.json` defines the metric and limitations. At 60 physics ticks, mean near-ground toe speeds in m/s are:

| Gait | Previous | Revised |
|---|---:|---:|
| Walk forward | 0.344 | 0.063 |
| Jog forward | 0.102 | 0.120 |
| Jog left | 3.003 | 1.403 |
| Jog backward | 0.429 | 0.340 |
| Sprint | 0.405 | 0.403 |

This threshold metric includes low swing motion and is not pure planted-foot slip. Strafing/backward travel speeds also changed. The data does not show a universal improvement in every gait.

The PNGs and `runtime-motion.webm` show an **isolated runtime joint/cloth recording in an independent Three.js renderer**. They are not Godot screenshots or recordings of the graphical game. `review-provenance.json` identifies the recording and limitations. Godot was run only headless under the user's Remote Desktop restriction.

`score-signal.json` verifies both original score stems are finite, bounded 48-second PCM audio at matching sample rates/frame counts. It is signal/resource evidence, not subjective listening acceptance. Art and recording credits are in the repository's license documents and the portable package.
