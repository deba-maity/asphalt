# Motion amplification evidence

Source regression: **417/417 assertions passed**, plus full campaign traversal, Continue, quit and resume transition checks. The focused trial passes 48 checks at 30/60 actual physics ticks; motion quality passes 51 at each rate; physical combat passes 18 at each rate. Test logs describe stress fixtures and do not establish natural human play or rendered quality.

The Windows candidate is built as 0.6.0-rc.1. Portable verification and the still-running endurance results are recorded separately when complete. The three-hour run uses an early frozen candidate; the later 90-minute run uses the corrected runtime. These scopes must not be conflated.

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
