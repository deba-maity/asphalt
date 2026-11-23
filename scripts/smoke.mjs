import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const external = process.env.TEST_BASE_URL;
const url = external || "http://127.0.0.1:5175";
const server = external
  ? null
  : spawn(process.execPath, ["server.js"], {
      env: {
        ...process.env,
        PORT: "5175",
        HMR_PORT: "24680",
        VITE_CACHE_DIR: "node_modules/.vite-smoke",
      },
      stdio: "pipe",
      windowsHide: true,
    });
let browser;
let page;
const errors = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await delay(100);
  }
  assert(ready, "Development server must start");
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader'],
  });
  page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__nightshift);
  await page.waitForFunction(() => window.__nightshift.game.preview && !window.__nightshift.game.previewFrame, null, {timeout:30000});
  const previewIdle=await page.evaluate(async()=>{
    const g=window.__nightshift.game,renderer=g.preview.renderer;
    const before=renderer.info.render.frame;
    await new Promise(resolve=>setTimeout(resolve,500));
    return renderer.info.render.frame-before;
  });
  assert.equal(previewIdle,0,'Settled showroom stops redrawing');
  assert(await page.evaluate(()=>document.documentElement.dataset.quality==='battery'),'Fresh settings start with the lower-power profile');
  await page.getByRole("button", { name: /settings/i }).click();
  await page.locator("#quality-mode").selectOption("battery");
  await page.locator('#reduced-motion').check();
  assert.equal(
    await page.evaluate(() => window.__nightshift.game.targetFPS),
    30,
  );
  await page.reload();
  await page.waitForFunction(() => window.__nightshift);
  assert.equal(
    await page.evaluate(() => window.__nightshift.game.qualityMode),
    "battery",
  );
  assert(await page.evaluate(()=>window.__nightshift.game.reducedMotion),'Reduced motion is saved');
  await page.getByRole("button", { name: "HIT THE STREETS" }).click();
  await page.locator('[data-action="choose-mode"]').first().click();
  await page.locator('[data-action="choose-map"]').first().click();
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(() => window.__nightshift.game.phase === "play");
  const stats = await page.evaluate(async () => {
    const { game: g } = window.__nightshift;
    const original = g.renderer.render.bind(g.renderer);
    let frames = 0;
    g.renderer.render = (...args) => {
      frames++;
      return original(...args);
    };
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const runningFrames = frames;
    g.togglePause();
    const elapsed = g.elapsed;
    frames = 0;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const pausedFrames = frames;
    const pausedElapsed = g.elapsed;
    const audioState=g.audio.context?.state;
    g.togglePause();
    g.renderer.render = original;
    return {
      runningFrames,
      pausedFrames,
      elapsed,
      pausedElapsed,
      audioState,
      calls: g.renderer.info.render.calls,
    };
  });
  console.log('FRAME BUDGET',stats);
  assert(
    stats.runningFrames <= 37 && stats.runningFrames >= 1,
    "Battery mode caps rendering at 30fps",
  );
  assert.equal(stats.pausedFrames, 0, "Paused game must not redraw");
  assert.equal(stats.audioState,'suspended','Pause suspends the audio graph');
  assert.equal(
    stats.elapsed,
    stats.pausedElapsed,
    "Paused game must not simulate",
  );
  assert(
    stats.calls < 650,
    "City draw calls remain within the mobile scene budget",
  );
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.__nightshift.game.player.speed > 0);
  await page.keyboard.up("w");
  assert(
    await page.evaluate(() => window.__nightshift.game.player.speed > 0),
    "Keyboard accelerates",
  );
  assert(await page.evaluate(()=>{
    const g=window.__nightshift.game;
    g.player.speed=0;g.player.velocityX=0;g.player.velocityZ=0;
    g.keys.KeyW=true;g.touch.KeyW=false;g.updatePlayer(1/60);
    const moved=g.player.speed>0;g.keys={};return moved;
  }),'Released touch controls do not override held keyboard controls');
  for (const [key, sign] of [["ArrowLeft", 1], ["d", -1]]) {
    await page.evaluate(sign => {
      const p = window.__nightshift.game.player;
      p.mesh.rotation.y = sign * 1.54;
      p.speed = 16;
      p.steerInput = 0;
    }, sign);
    await page.keyboard.down(key);
    await page.waitForFunction(sign =>
      window.__nightshift.game.player.mesh.rotation.y * sign > 1.7, sign, {timeout: 10000});
    await page.keyboard.up(key);
  }
  const mapResults = await page.evaluate(async () => {
    const { maps, modes } = await import("/src/data.js");
    const { game: g, ui } = window.__nightshift;
    const results = [];
    for (const map of [...maps, maps[0], maps[0]]) {
      ui.map = map;
      ui.mode = modes.find((m) => m.id === "time");
      ui.start();
      g.paused = true;
      g.phase = "play";
      for (let i = 0; i < 60; i++) g.updateCamera(1 / 60);
      g.world.update(1 / 60, 1, g.player.mesh.position, 210);
      g.renderScene();
      const destructible = g.world.destructibles[0];
      if (destructible) {
        g.world.destroyDestructible(destructible);
        if (destructible.visible)
          throw new Error("Batched destructibles must still disappear");
      }
      results.push({
        map: map.id,
        calls: g.renderer.info.render.calls,
        geometries: g.renderer.info.memory.geometries,
      });
    }
    return results;
  });
  assert(mapResults.every((result) => result.calls < 650));
  assert(
    mapResults.at(-1).geometries <= mapResults.at(-2).geometries + 2,
    "Repeated races release generated geometry",
  );
  const fleet = await page.evaluate(async () => {
    const { vehicles } = await import("/src/data.js");
    const { game: g } = window.__nightshift;
    for (const spec of vehicles) {
      const actor = g.makeActor(spec, spec.color);
      g.alignActorToRoad(actor);
      if (!Number.isFinite(actor.mesh.position.y))
        throw new Error(`Invalid vehicle ${spec.name}`);
    }
    g.renderScene();
    return vehicles.length;
  });
  assert(fleet >= 23, "All fleet models are available");
  const rematchPositions=await page.evaluate(async()=>{
    const {game:g,ui}=window.__nightshift;
    let sent=0;
    const network={position(){sent++;},send(){}};
    const config={mode:ui.mode,map:ui.map,vehicle:ui.vehicle,color:ui.color,difficulty:'easy',network};
    g.lastNetwork=180; // Previous race's simulation clock.
    await g.start(config);cancelAnimationFrame(g.animationFrame);g.phase='play';
    for(let i=0;i<60;i++)g.simulate(1/60);
    return sent;
  });
  assert(rematchPositions>=15 && rematchPositions<=21,'A rematch immediately resumes regular LAN position updates');
  await page.evaluate(() => window.__nightshift.ui.exitToHome());
  assert.equal(await page.locator(".pause-overlay").count(), 0);
  await page.close();
  const mobile = await browser.newPage({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
  });
  mobile.on("pageerror", (error) => errors.push(error.message));
  mobile.on("console", message => { if (message.type() === "error") { errors.push(message.text()); console.error(message.text()); } });
  await mobile.goto(url);
  await mobile.waitForFunction(() => window.__nightshift, null, {timeout:90000});
  await mobile.evaluate(() => {
    const { ui, game: g } = window.__nightshift;
    ui.start();
    g.phase = "play";
    g.callbacks.countdown("");
  });
  const controls = await mobile.evaluate(() => {
    const { game: g } = window.__nightshift;
    const press = (key, id) =>
      document.querySelector(`[data-drive="${key}"]`).dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: id,
          pointerType: "touch",
        }),
      );
    // Capture requires a trusted active pointer; use real touch events below.
    return {
      visible: getComputedStyle(document.querySelector(".touch-controls"))
        .display,
      auto: g.touch.active,
      width: document.documentElement.scrollWidth,
    };
  });
  assert.equal(controls.visible, "block");
  assert(controls.auto);
  assert.equal(controls.width, 844);
  const cdp = await mobile.context().newCDPSession(mobile);
  const left = await mobile.locator('[data-drive="KeyA"]').boundingBox();
  const nitro = await mobile.locator('[data-drive="ShiftLeft"]').boundingBox();
  const point = (box, id) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    id,
  });
  await mobile.evaluate(() => {
    const p = window.__nightshift.game.player;
    p.mesh.rotation.y = 1.54;
    p.speed = 16;
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point(left, 1), point(nitro, 2)],
  });
  assert(
    await mobile.evaluate(
      () =>
        window.__nightshift.game.touch.KeyA &&
        window.__nightshift.game.touch.ShiftLeft,
    ),
    "Two thumbs can steer and boost simultaneously",
  );
  await mobile.waitForFunction(() => window.__nightshift.game.player.mesh.rotation.y > 1.7,
    null, {timeout: 10000});
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert(
    await mobile.evaluate(
      () =>
        !window.__nightshift.game.touch.KeyA &&
        !window.__nightshift.game.touch.ShiftLeft,
    ),
    "Touch release clears held inputs",
  );
  const sameLeft=[point(left,3),{...point(left,4),x:left.x+left.width*.65}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:sameLeft});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[sameLeft[1]]});
  assert(await mobile.evaluate(()=>window.__nightshift.game.touch.KeyA),'The remaining finger keeps its control held');
  await mobile.evaluate(()=>window.__nightshift.game.togglePause());
  assert.equal(await mobile.locator('[data-drive].held').count(),0,'Pause clears the held appearance');
  assert(await mobile.evaluate(()=>!window.__nightshift.game.touch.KeyA),'Pause releases touch input');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.evaluate(()=>window.__nightshift.game.togglePause());
  await mobile.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth),
    390,
    "Portrait layout fits the screen",
  );
  await mobile.evaluate(() => {
    const { game: g } = window.__nightshift;
    g.keys.KeyW = true;
    window.dispatchEvent(new Event("blur"));
  });
  assert(
    await mobile.evaluate(
      () =>
        window.__nightshift.game.paused && !window.__nightshift.game.keys.KeyW,
    ),
    "Losing focus pauses and clears controls",
  );
  assert.deepEqual(errors, [], "No browser runtime errors");
  console.log(
    JSON.stringify(
      {
        result: "PASS",
        fleet,
        stats,
        maps: mapResults,
        mobile: "landscape, portrait, multi-touch, release, focus",
      },
      null,
      2,
    ),
  );
} catch(error) {
  console.error('BROWSER ERRORS',JSON.stringify(errors));
  if(page && !page.isClosed()) console.error('STATE',await page.evaluate(()=>{
    const g=window.__nightshift?.game;
    return g?{phase:g.phase,running:g.running,paused:g.paused,time:g.time,hidden:document.hidden,steps:g.clock.steps,dropped:g.clock.dropped}:document.body.innerText;
  }).catch(()=>null));
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
