import test from "node:test";
import assert from "node:assert/strict";
import { Vector3 } from "three";
import { RaceTiming, raceRecord, sectorGates } from "../src/race-timing.js";
import { sampleHybridClosedRoute, timingGateFraction } from "../src/course-shape.js";
import { gatesPerSegment, maps } from "../src/data.js";
import { storage } from "../src/storage.js";

function circuit(map) {
  const controls = map.route.map(([x,z]) => new Vector3(x,0,z));
  const samples = sampleHybridClosedRoute(controls, 18, map.straightSegments);
  const route = sampleHybridClosedRoute(controls, gatesPerSegment, map.straightSegments);
  const sampleDistances = [0];
  samples.forEach((p,i) => sampleDistances.push(sampleDistances.at(-1) + p.distanceTo(samples[(i+1)%samples.length])));
  return { map, route, samples, sampleDistances, courseLength: sampleDistances.at(-1),
    timingOffset: route[0].distanceTo(route[1]) * timingGateFraction,
    shortcutRoads: map.shortcuts, authorSegmentToRouteIndex: index => index * gatesPerSegment };
}

test("all legal routes pass both sector marks in the same order", () => {
  for (const map of maps) {
    const world = circuit(map);
    const [first, second, finish] = sectorGates(world);
    assert(first > 0 && second > first && second < world.route.length);
    assert.equal(finish, 0);
    for (const gate of [first, second]) {
      for (const cut of map.shortcuts) {
        assert(gate <= cut.from * gatesPerSegment || gate > cut.to * gatesPerSegment, map.id + " " + cut.label);
      }
    }
  }
});

test("a complete circuit stores all nine cumulative stamps and compares matching sectors on a rematch", () => {
  const world = circuit({...maps[0], id:"test-nine"});
  const first = new RaceTiming(world, "race", "medium");
  first.gate(0, 5);
  first.gate(first.gates[1], 8);
  assert.equal(first.latest, null);
  const stamps = [10,24,38,48,59,71,81,92,102];
  stamps.forEach((stamp,i) => first.gate(first.gates[i%3],stamp));
  const result = first.finish();
  assert.deepEqual(result.rows, [[10,14,14],[10,11,12],[10,11,10]]);
  assert(result.improved); assert.equal(result.best,102);
  assert.equal(raceRecord(world.map.id, "sprint", "medium"), null);
  assert.equal(raceRecord(world.map.id, "race", "easy"), null);
  const rematch = new RaceTiming(world,"race","medium");
  rematch.gate(rematch.gates[0], 11);
  rematch.gate(rematch.gates[1], 24);
  assert.equal(rematch.latest.delta,-1);
  assert.equal(rematch.finish(),null);
  assert.deepEqual(raceRecord(world.map.id,"race","medium"),stamps.map(t => t*1000));
});

test("invalid and slower sprint records leave a usable class best", () => {
  const world = circuit({...maps[1],id:"test-short"});
  const key = "nightshift-race-v1-test-short-sprint-hard";
  for (const invalid of ["broken","null","[1,0,4]","[1,2]","[1,2,2]"]) {
    storage.setItem(key,invalid);
    assert.equal(raceRecord(world.map.id,"sprint","hard"),null);
  }
  for (const increasing of [[10,20,30],[9,20,32],[8,18,28]]) {
    const timing = new RaceTiming(world,"sprint","hard");
    increasing.forEach((time,i) => timing.gate(timing.gates[i],time));
    assert.equal(timing.finish().best, Math.min(30,increasing[2]));
  }
  assert.deepEqual(raceRecord(world.map.id,"sprint","hard"),[8000,18000,28000]);
});
