// Check the built scene, including instance transforms and spatially batched meshes.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  logLevel: "error",
  server: {host: "127.0.0.1", port: 0, hmr: false, watch: null},
  cacheDir: "node_modules/.vite-clearance",
});
let browser;
try {
  await server.listen();
  const origin = "http://127.0.0.1:" + server.httpServer.address().port;
  browser = await chromium.launch({headless: true});
  for (const compact of [false, true]) {
    const page = await browser.newPage({hasTouch: compact});
    await page.addInitScript(compact => {
      Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
      Object.defineProperty(navigator, "deviceMemory", {get: () => 8});
      Object.defineProperty(navigator, "maxTouchPoints", {get: () => compact ? 5 : 0});
      const nativeMedia = matchMedia.bind(window);
      window.matchMedia = query => query === "(pointer: coarse)" ? {matches: compact} : nativeMedia(query);
    }, compact);
    await page.route(origin + "/survey.html", route => route.fulfill({
      contentType: "text/html", body: "<!doctype html><title>Road clearance test</title>",
    }));
    await page.goto(origin + "/survey.html");
    const result = await page.evaluate(async () => {
      const {Box3, Matrix4, Scene, Triangle, Vector3} = await import("/node_modules/three/build/three.module.js");
      const {World, roadHalfWidth} = await import("/src/world.js");
      const {maps} = await import("/src/data.js");
      const world = new World(new Scene(), maps.find(map => map.id === "neon"));
      world.group.updateMatrixWorld(true);
      const sections = [];
      const low = .34, high = 4.3;
      function addSection(a, b, startY, endY, halfWidth, name) {
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
        const bounds = new Box3(
          new Vector3(Math.min(a.x,b.x) - Math.abs(dz)*halfWidth, Math.min(startY,endY) + low, Math.min(a.z,b.z) - Math.abs(dx)*halfWidth),
          new Vector3(Math.max(a.x,b.x) + Math.abs(dz)*halfWidth, Math.max(startY,endY) + high, Math.max(a.z,b.z) + Math.abs(dx)*halfWidth),
        );
        const volume = new Box3(new Vector3(0, low, -halfWidth), new Vector3(length, high, halfWidth));
        function local(point, target) {
          const x = point.x - a.x, z = point.z - a.z;
          const along = x*dx + z*dz;
          target.set(along, point.y - startY - along*(endY-startY)/length, z*dx - x*dz);
        }
        sections.push({name, bounds, volume, local});
      }
      for (const [i, a] of world.samples.entries()) {
        const b = world.samples[(i+1) % world.samples.length];
        addSection(a, b, world.roadSurfaceY, world.roadSurfaceY, roadHalfWidth,
          "main circuit, gate " + (i * world.route.length / world.samples.length).toFixed(1));
      }
      for (const road of world.shortcutRoads) for (let i=1; i<road.points.length; i++) {
        addSection(road.points[i-1], road.points[i], road.heightProfile[i-1], road.heightProfile[i], road.halfWidth,
          road.label + ", section " + i);
      }
      const dynamic = new Set([...world.markers, ...world.destructibles, ...world.traffic.map(car => car.mesh)]);
      const matrix = new Matrix4(), instance = new Matrix4(), bounds = new Box3(), faceBounds = new Box3();
      const face = new Triangle(), local = new Triangle(), intersections = new Set();
      let testedFaces = 0;
      world.group.traverse(object => {
        if (!object.isMesh || object.material?.transparent || object.material?.isShaderMaterial) return;
        for (let parent=object; parent; parent=parent.parent) if (dynamic.has(parent)) return;
        const geometry = object.geometry;
        const positions = geometry.getAttribute("position");
        if (!positions) return;
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        for (let part=0; part<(object.isInstancedMesh ? object.count : 1); part++) {
          matrix.copy(object.matrixWorld);
          if (object.isInstancedMesh) { object.getMatrixAt(part, instance); matrix.multiply(instance); }
          bounds.copy(geometry.boundingBox).applyMatrix4(matrix);
          const nearby = sections.filter(section => bounds.intersectsBox(section.bounds));
          if (!nearby.length) continue;
          const vertices = Array.from({length: positions.count}, (_, i) =>
            new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix));
          const index = geometry.index;
          const vertex = i => vertices[index ? index.getX(i) : i];
          for (let i=0; i<(index?.count ?? positions.count); i+=3) {
            face.set(vertex(i), vertex(i+1), vertex(i+2));
            faceBounds.makeEmpty().expandByPoint(face.a).expandByPoint(face.b).expandByPoint(face.c);
            testedFaces++;
            for (const section of nearby) {
              if (!section.bounds.intersectsBox(faceBounds)) continue;
              section.local(face.a, local.a); section.local(face.b, local.b); section.local(face.c, local.c);
              if (section.volume.intersectsTriangle(local)) intersections.add((object.name || geometry.type) + " at " + section.name);
            }
          }
        }
      });
      const report = {compact: world.lowPower, testedFaces, sections: sections.length, intersections: [...intersections]};
      world.dispose();
      return report;
    });
    assert.equal(result.compact, compact);
    assert.ok(result.testedFaces > 1000 && result.sections > 500);
    assert.deepEqual(result.intersections, [], JSON.stringify(result.intersections.slice(0, 12)));
    console.log(compact ? "Compact" : "Full", result.sections, "road sections clear across", result.testedFaces, "candidate faces");
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
