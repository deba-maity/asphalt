// Rebuild the single ground-shadow image used by each district and device layout.
// All silhouettes come from the shipped scenery; no runtime shadow pass is needed.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const origin = "http://127.0.0.1:5238";
const server = spawn(process.execPath, ["server.js"], {
  env: {
    ...process.env,
    PORT: "5238",
    HMR_PORT: "24673",
    VITE_CACHE_DIR: "node_modules/.vite-shadow-bake",
  },
  stdio: "ignore",
  windowsHide: true,
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await delay(150);
  }
  browser = await chromium.launch({ headless: true });
  await mkdir("src/shadows", { recursive: true });
  for (const compact of [false, true]) {
    const page = await browser.newPage({
      hasTouch: compact,
      viewport: { width: 800, height: 540 },
    });
    await page.addInitScript((compactLayout) => {
      const media = window.matchMedia.bind(window);
      window.matchMedia = (query) =>
        query === "(pointer: coarse)"
          ? { matches: compactLayout }
          : media(query);
      Object.defineProperty(navigator, "maxTouchPoints", {
        get: () => (compactLayout ? 5 : 0),
      });
      Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 8 });
      Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    }, compact);
    // A blank document on the Vite origin avoids bringing up the game menu.
    await page.route(origin + "/baker.html", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>District shadow baker</title>",
      }),
    );
    await page.goto(origin + "/baker.html");
    for (const id of ["neon", "coast", "dock", "mesa"]) {
      const output = await page.evaluate(
        async ({ id, compact }) => {
          const THREE =
            await import("/node_modules/three/build/three.module.js");
          const { World } = await import("/src/world.js");
          const { maps } = await import("/src/data.js");
          const scene = new THREE.Scene();
          const world = new World(
            scene,
            maps.find((m) => m.id === id),
          );
          if (world.lowPower !== compact)
            throw new Error("Wrong hardware layout for " + id);
          for (const object of [
            ...world.markers,
            ...world.destructibles,
            ...world.traffic.map((t) => t.mesh),
          ])
            object.visible = false;
          world.group.traverse((o) => {
            if (
              o.material?.transparent ||
              o.isSprite ||
              o.type === "Points" ||
              [
                "Cross-street traffic",
                "Rotating lighthouse lens",
                "Traveling hoist",
                "Illuminated rim",
                "Wind turbine rotor",
                "Moored container ship",
                "Coastal cutter",
                "District ground shadows",
              ].includes(o.name)
            )
              o.visible = false;
          });
          const opaque = new THREE.ShaderMaterial({
            depthWrite: false,
            depthTest: false,
            side: THREE.DoubleSide,
            vertexShader: `
            varying float altitude;
            void main() {
              vec4 p=vec4(position,1.);
              #ifdef USE_INSTANCING
                p=instanceMatrix*p;
              #endif
              p=modelMatrix*p;
              altitude=p.y;
              vec2 projected=p.xz + max(p.y,0.)*vec2(60./90.,-35./90.);
              gl_Position=vec4(projected.x/560.,-projected.y/560.,0.,1.);
            }`,
            fragmentShader: `
            varying float altitude;
            void main() {
              if(altitude<.36) discard;
              gl_FragColor=vec4(1.);
            }`,
          });
          const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
          });
          const size = 1536;
          renderer.setSize(size, size, false);
          renderer.setClearColor(0, 0);
          scene.background = null;
          scene.overrideMaterial = opaque;
          const cam = new THREE.OrthographicCamera(
            -2000,
            2000,
            2000,
            -2000,
            -2000,
            2000,
          );
          cam.position.set(0, 700, 0);
          cam.up.set(0, 0, -1);
          cam.lookAt(0, 0, 0);
          renderer.render(scene, cam);
          // A soft penumbra plus a sharper contact edge survives mipmapping on a phone.
          const softened = document.createElement("canvas");
          softened.width = softened.height = size;
          const ctx = softened.getContext("2d");
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, size, size);
          for (const [blur, opacity] of [
            [3.4, 0.46],
            [1.1, 0.51],
            [0, 0.39],
          ]) {
            ctx.filter = blur ? "blur(" + blur + "px)" : "none";
            ctx.globalAlpha = opacity;
            ctx.drawImage(renderer.domElement, 0, 0);
          }
          const data = softened.toDataURL("image/webp", 0.7).split(",")[1];
          renderer.dispose();
          renderer.forceContextLoss();
          opaque.dispose();
          world.dispose();
          return data;
        },
        { id, compact },
      );
      const file = "src/shadows/" + id + (compact ? "-compact" : "") + ".webp";
      await writeFile(file, Buffer.from(output, "base64"));
      console.log(file, Buffer.byteLength(output, "base64"), "bytes");
    }
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
