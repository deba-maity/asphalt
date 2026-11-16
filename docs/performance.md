# Pass-three performance and budget record

Primary target: Windows laptop, Ryzen 5 5500U, 16 GB RAM, integrated Radeon and shared memory. The approximately 496 MB dedicated allocation is not a hard total graphics-memory limit, and shared RAM is not a discrete 8 GB GPU. Display resolution, driver, power profile and thermals remain unconfirmed. **No target-laptop measurement exists.**

Low design: 720p internal 3D, fixed-aspect readable HUD, 30 FPS cap, Compatibility renderer, modest shadows, bounded opponents/effects and compact zones. Settings offer a 540p fallback, 900p and an optional 60 FPS cap for local evaluation. These are choices, not performance promises. On resize, 3D scale is recalculated from the actual letterboxed window area so choosing a larger window does not silently discard the internal-resolution target.

## Initial adjustable budgets

| Item | Budget / implementation |
|---|---|
| Opponents | At most three admitted nearby, one attack lease; typical authored pair or single boss. |
| Geometry | Eighteen reusable hard-jointed character variants; target under 5,000 triangles each. Static repeated scenery uses MultiMesh; dynamic wheel stays out of batching. No ragdolls or runtime navmesh bake. |
| Materials/textures | Small cached flat-color palette, no external high-resolution texture library. Generated geometry/material caches clear on zone replacement. |
| Lighting | One shadowed sun, 1024 shadow map, 38–45m shadow range; warm home fill unshadowed. Disable sun shadows on lower hardware if measurements justify it. |
| Effects | No particle systems. One tell ring and short impact per actor, a player ash mark, six projectiles maximum with lifetime limit; dead bodies expire. |
| Audio | Eight one-shot voices, two synchronized stems and one current ambience; fourteen cues loaded once. Per-cue throttling prevents hit-sound accumulation. |
| Streaming | One current zone and at most one speculative resource set, 24 MB metadata estimate by default; low-memory unload-before-construction. This estimate is not a measured VRAM cap. |
| Telemetry | Bounded frame/one-second/spike arrays and last 32 transition records. No telemetry upload or background account service. |

These are practical starting budgets, not proof that a target frame rate has been met. CPU-only animation and shape/query caching reduce avoidable file parsing and per-hit allocation; those changes still need profiling with rendering enabled.

## Actual development measurements

Inspected development machine: Windows 11 Pro, i7-1185G7, approximately 32 GB visible RAM, Intel Iris Xe. All pass-three execution is headless in accordance with the Remote Desktop restriction. Old pass-one 28.7 FPS average was a different earlier build and is retained only in [history](history/pass1-performance.md).

The [packaged sustained report](evidence/pass3/headless-sustained-report.json) completed three campaigns / 27 transitions in **33.97 seconds of accelerated headless wall time**. It recorded 68,081 frame-callback intervals; those are CPU loop intervals and must not be converted into a rendered FPS claim. Max observed scene-node count was 999 and max observed resource count 443 across changing zones. Same-zone counts vary with transient corpses, dialogue and UI; the [repeated restart metrics](evidence/pass3/restart-metrics.json) and passing ownership tests establish that old scenes are freed and equal-zone nodes do not accumulate.

Metrics separate background request elapsed time, instantiation, `_ready` work, old-zone release and total swap. The report includes a bounded spike list rather than hiding first-use/load spikes. Main-thread activation still has a cost even when I/O occurs in a background thread. The release static-allocation counter is unavailable; the process-memory wrapper is provided for actual laptop working/private bytes. Shader compilation, GPU uploads/timing, visible draw/triangle counts, VRAM/shared-memory driver telemetry and thermal behavior are **unavailable in these headless results**.

## Collecting real evidence

Follow [benchmark.md](benchmark.md). F8 records/stops local measurements; F9 captures the real viewport with metadata. The wrapper repeats a complete representative route for at least 15 minutes and samples the game process. Its graphical invocation has not been run here. The captured p50/p95/p99/max, >50ms spikes, loading stages and counters should be reviewed alongside human observations. Engine monitors may update slowly or be unavailable in release, as documented by [Godot Performance](https://docs.godotengine.org/en/stable/classes/class_performance.html); absent values must remain unavailable.

3D bilinear scaling and fixed-aspect window scaling follow the official [Viewport](https://docs.godotengine.org/en/stable/classes/class_viewport.html) and [Window](https://docs.godotengine.org/en/stable/classes/class_window.html) APIs. The project stays within Compatibility features and does not rely on screen-space GI, volumetric fog, TAA or other advanced renderer-only effects.

Acceptance remains sustained low-preset testing on the real Ryzen laptop, with its actual driver, display, charger/power mode and thermals recorded. No OS power, driver or firmware setting is changed automatically. The short campaign still lacks the authored scope needed to substantiate a multi-hour adventure; automation duration is not a human playtime.

## Pass-four status

No new rendered or target-laptop performance measurement was made. Packaging/site/headless results are in release-verification.md; they do not establish Ryzen5500U FPS, GPU memory or thermal stability. Use local-acceptance.md and benchmark.md on the play laptop.
