# Performance targets and measurements

## Target laptop — untested

Windows, Ryzen 5 5500U, 16 GB RAM, integrated AMD Radeon, no dedicated GPU. The reported approximately 496 MB allocation is dedicated allocation, **not** a cap on all usable graphics memory. Shared system memory does not make this a discrete 8 GB card. Display resolution, power profile, driver version and thermals are not yet known. No target-laptop benchmark has been performed.

Initial design: fixed 1280 × 720 viewport scaled to the window, 30 FPS cap, Compatibility/OpenGL renderer, compact connected zones, at most two nearby normal enemies or one foreman, one shadowed directional light, optional shadows, no postprocessing stack or dynamic GI, no high-resolution texture library or ragdolls. Repeated scenery uses MultiMesh; immutable meshes/materials are cached. Models have hard joints and modest geometry. Shader compilation and first-use allocations can still cause initial hitches.

## Development machine — actual execution

Recorded 2026-11-11 using the client-provided date. Windows 11 Pro 10.0.26200, Intel i7-1185G7, approximately 32 GB visible RAM, Intel Iris Xe driver 32.0.101.7085. The process reported OpenGL 3.3 Compatibility. This is a different system from the target and may be reached through Remote Desktop. Presentation and background activity can affect the measurement.

The retained rendered chapter run averaged **28.7 FPS with a 30 FPS cap**, over 68.6 seconds and 134.2 metres of scripted traversal, including screenshots, UI and dialogue. See [`evidence/playthrough.txt`](evidence/playthrough.txt). This is an engine-frame average, not a GPU benchmark, percentile frametime analysis, or evidence of stable 30 FPS on either machine. Earlier initial geometry/lighting work averaged 27.2 FPS. No 60 FPS mode is offered on these measurements. Headless logic checks are not graphics-performance evidence.

## Laptop verification procedure

1. Record model, exact CPU/GPU/driver, Windows version, plugged-in/battery mode, power profile, resolution, shadow setting and build hash.
2. Launch the preview at the default 720p viewport and 30 FPS cap. Warm up by walking around Hearthmere for one minute.
3. Play every encounter, orbit near buildings, move through trees, use lock-on and effects, return home, and repeat after relaunch.
4. Use the Godot debugger profiler for a source run, or a local frame capture tool for the exported build. Record average, 1% low, p95/p99 frame times, worst hitch, working set and graphics allocations; measure shadows on and off.
5. Spend at least ten minutes under sustained load. Check charger/battery and thermal changes. Record genuine observations here. Do not convert the machine's shared-memory limit into a claim of dedicated VRAM.

Further work: split/budget scenery batches by zone if needed, lower foliage counts/shadow distance, profile articulated draw calls, and only add an optional 60 FPS setting when actual hardware measurements justify it.
