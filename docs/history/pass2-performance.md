# Performance targets and evidence

## Target laptop — no measurements

Windows, Ryzen 5 5500U, 16 GB RAM, integrated Radeon with shared system memory and approximately 496 MB reported dedicated allocation. That allocation is not a hard total-memory cap, and shared memory does not make this a discrete 8 GB GPU. Display resolution, power profile, driver and thermals remain unconfirmed. No target-laptop performance is claimed.

Design remains 1280 × 720 internal viewport, 30 FPS cap, Compatibility renderer, compact zones, small active encounters, static collision, restrained effects and shadows. No optional 60 FPS mode is offered. Sun shadows can be disabled. All gameplay/resources are offline.

## Development environment and Remote Desktop

The inspected development system is Windows 11 Pro, i7-1185G7, approximately 32 GB visible RAM and Intel Iris Xe driver 32.0.101.7085. Pass-one rendered evidence is historical: 28.7 FPS average under a 30 FPS cap, not stable-30 or target-hardware evidence. See [historical record](pass1-performance.md).

During pass two the user explicitly said **not to play the game on this Remote Desktop**. Graphical runs were stopped; subsequent verification, scene traversal and exported-executable checks use `--headless` with dummy audio. No headless frame rate is reported as graphics performance. Mouse capture and captured-mouse orbit tests are skipped in the headless suite. No new full-campaign screenshots, listening test or GPU benchmark is claimed.

## Loading and allocation observations

[Source transition metrics](../evidence/pass2/source-transitions.json) and [packaged metrics](../evidence/pass2/packaged-transitions.json) record actual local runs. Fields separate request/poll elapsed time, scene instantiation, `_ready` geometry/scripts, old-zone release-frame time, total swap, node count and engine-reported static memory. These are development CPU/engine observations. Total swap spans frame boundaries and save work; it is not a pure instantiation benchmark. Shader preparation and GPU uploads remain unmeasured.

Repeated eight-zone alternation left the same-zone scene-node count stable; old-node weak references became null and the same player survived. Source debug runs report approximately 49–52 MB of engine static allocations during later zones; this is not total working set or graphics memory. Release engine static-memory counters return zero when unavailable; **zero does not mean zero memory use**. Exact retained logs supersede these rounded descriptions.

One speculative next-zone set is allowed, with a default metadata estimate budget of 24 MB. Estimates are authoring guidance, not measured hard caps. Default low-memory mode frees old scene nodes and generated caches before constructing the next zone. Normal mode is available through `[streaming] low_memory=false` in settings and is tested separately. No navigation bake runs during ordinary transitions.

## Duration observations

A normal-speed headless New Game-to-credits run took 375 seconds with very fast dialogue and automated combat. Accelerated checks use Godot's documented `--fixed-fps 60`, which disables real-time synchronization; their logs record simulation duration and real wall-clock duration separately. They generally cover about six minutes of simulated campaign time in seconds of wall time. These values establish automated reachability, not a human campaign length. The multi-hour design goal is not met or substantiated by the current short implementation.

## Local target-machine checks still needed

Record target CPU/GPU/driver, build hash, charger/battery, power profile, resolution, shadow setting and thermals. Warm up, then play through every environment and boss phase. Measure sustained average and percentile frame times, worst hitches, working set and graphics allocations using a profiler. Separate resource I/O, instantiation/scripts, shader warm-up and GPU upload/presentation costs. Check repeated zone travel and long sessions. Adjust foliage, shadows, batching and animation draw calls from real observations, rather than inferring a laptop result from these headless or Remote Desktop runs.
