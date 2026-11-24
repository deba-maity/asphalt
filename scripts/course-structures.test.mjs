import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { maps } from "../src/data.js";
import { planShortcutRoads, sampleHybridClosedRoute } from "../src/course-shape.js";
import { roadProjection } from "../src/road-projection.js";
import { courseSpan, trimSpan, offsetStation, spanGeometry, bridgeRuns, bridgeRailOffset, rampSpan, rampRailRuns } from "../src/course-structures.js";

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

test("elevated shortcut decks meet at every bend and their rails leave the main lane open", () => {
  for (const map of maps) {
    const controls = map.route.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const samples = sampleHybridClosedRoute(controls, map.id === "neon" ? 22 : 18, map.straightSegments);
    const project = roadProjection(samples, 14.5);
    const roads = planShortcutRoads(controls, map.shortcuts, .052).filter(road => road.elevated);
    assert.ok(roads.length, map.name);
    for (const road of roads) {
      const span = rampSpan(road);
      const deck = spanGeometry(span, -8.2, 8.2, -.72, -.045);
      const vertices = deck.getAttribute("position");
      assert.equal(vertices.count, (4 * (road.points.length - 1) + 2) * 6);
      for (const station of span) {
        for (const sign of [-1, 1]) {
          const edge = offsetStation(station, sign * 8.2, -.045);
          assert.ok(Array.from({length: vertices.count}, (_, i) =>
            Math.hypot(vertices.getX(i) - edge.x, vertices.getY(i) - edge.y, vertices.getZ(i) - edge.z))
            .some(distance => distance < .0001), road.label + " deck edges meet");
        }
      }
      for (const offset of [-8.08, 8.08]) {
        const runs = rampRailRuns(span, offset, project, 10.5, .052);
        assert.ok(runs.some(run => run[0].length <= span.at(-1).length / 2 && run.at(-1).length >= span.at(-1).length / 2));
        for (const run of runs) {
          for (let i = 1; i < run.length; i++) {
            const a = offsetStation(run[i - 1], offset, 0), b = offsetStation(run[i], offset, 0);
            for (let t = 0; t <= 1; t += .05) {
              const edge = a.clone().lerp(b, t);
              assert.ok(edge.y >= 3.05 || project(edge).distance > 10.6, road.label + " railing obstructs the lower lane");
            }
          }
        }
      }
      deck.dispose();
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
