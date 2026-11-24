import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { maps } from "../src/data.js";
import { sampleHybridClosedRoute } from "../src/course-shape.js";
import { courseSpan, trimSpan, offsetStation, spanGeometry, bridgeRuns, bridgeRailOffset } from "../src/course-structures.js";

const bridgeSections = {neon: [1,2], coast: [2,5], dock: [15,16], mesa: [3,5]};
test("bridge rails follow the full drawn road, leaving gaps where drivers can take a shortcut", () => {
  for (const map of maps) {
    const route = map.route.map(([x,z]) => new THREE.Vector3(x, 0, z));
    const samples = sampleHybridClosedRoute(route, map.id === "neon" ? 22 : 18, map.straightSegments);
    const span = courseSpan(samples, route.length, ...bridgeSections[map.id]);
    const junctions = map.shortcuts.flatMap(({from,to}) => [route[from], route[to]]);
    const runs = bridgeRuns(span, junctions);
    assert.ok(runs.length, map.id + " bridge has continuous rails");
    for (const run of runs) {
      for (let j=0; j<run.length-1; j++) {
        for (const sign of [-1,1]) {
          const a = run[j], b = run[j+1];
          const edgeA = offsetStation(a, sign * bridgeRailOffset, 1.1);
          const edgeB = offsetStation(b, sign * bridgeRailOffset, 1.1);
          const mid = a.point.clone().lerp(b.point,.5);
          const near = new THREE.Line3(edgeA, edgeB).closestPointToPoint(mid, true, new THREE.Vector3());
          assert.ok(Math.hypot(near.x-mid.x,near.z-mid.z) > 10.5, map.id + " rail enters racing surface");
        }
        const middle = new THREE.Line3(run[j].point, run[j+1].point);
        assert.ok(junctions.every(p=>middle.closestPointToPoint(p,true,new THREE.Vector3()).distanceTo(p) >= 16));
      }
    }
  }
});

test("a curved tunnel has a continuous visible ceiling, side clearance, and capped ends", () => {
  const path = Array.from({length:48}, (_,i) => {
    const angle = i * Math.PI/24;
    return new THREE.Vector3(45*Math.cos(angle),0,45*Math.sin(angle));
  });
  const section = courseSpan(path, 8, 7, 1);
  const cropped = trimSpan(section, 7, section.at(-1).length-9);
  assert.equal(cropped[0].length,7);
  assert.equal(cropped.at(-1).length,section.at(-1).length-9);
  assert.ok(cropped.length>3);
  const shape = spanGeometry(cropped,-12.75,12.75,10.8,11.5);
  const vertices=shape.getAttribute("position"), normals=shape.getAttribute("normal");
  assert.equal(vertices.count, ((cropped.length-1)*4+2)*6);
  assert.ok(Array.from(vertices.array).every(Number.isFinite));
  assert.ok(Array.from({length:normals.count}, (_,i)=>normals.getY(i)).some(y=>y < -.99));
  const light=trimSpan(cropped,13,13);
  assert.equal(light.length,1);
  assert.equal(light[0].length,13);
  shape.dispose();
});
