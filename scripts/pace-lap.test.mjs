import test from "node:test";
import assert from "node:assert/strict";
import { PaceLap, districtBest } from "../src/pace-lap.js";
import { raceTime } from "../src/timing.js";
import { storage } from "../src/storage.js";
import { raceRecord } from "../src/race-timing.js";

const spec = { name: "Apex GT", kind: "car" };
const position = (x, z = 0) => ({x, z});

test("historical Meridian times and ghosts stay associated with the longer track", () => {
  storage.setItem("nightshift-best-neon", "89");
  storage.setItem("nightshift-pace-v1-neon", JSON.stringify({duration: 89000, splits: [89000],
    frames: [[0,0,0,0,0],[89000,0,0,0,0]], vehicle: spec.name, kind: spec.kind}));
  storage.setItem("nightshift-race-v1-neon-sprint-normal", "[30000,60000,89000]");
  const lap = new PaceLap("neon", 1, spec);
  assert.equal(lap.best, null);
  assert.equal(lap.reference, null);
  assert.equal(raceRecord("neon", "sprint", "normal"), null);
  lap.record(0, position(0), 0, 0);
  lap.gate(0, 96);
  lap.finish(96, position(100), 0, 0);
  assert.equal(districtBest("neon"), 96);
  assert.equal(storage.getItem("nightshift-best-neon"), "89");
});

test("reference laps preserve skipped gates and interpolate across the yaw seam", () => {
  const lap = new PaceLap("test-sector", 4, spec);
  lap.record(0, position(0), 0, Math.PI - .1);
  lap.record(1, position(10), 1, -Math.PI + .1);
  lap.gate(1, 1);
  lap.record(1.5, position(80), 5, 0, {force: true, jump: true});
  lap.gate(3, 2);
  lap.gate(0, 3);
  assert.equal(lap.finish(3, position(90), 0, 0).improved, true);

  const replay = new PaceLap("test-sector", 4, spec);
  assert.equal(replay.reference.vehicle, spec.name);
  assert.equal(replay.pose(.5).x, 5);
  assert.equal(replay.pose(.5).y, .5);
  assert.ok(Math.abs(Math.abs(replay.pose(.5).heading) - Math.PI) < .01);
  assert.equal(replay.pose(1.4).x, 10);
  assert.equal(replay.pose(1.5).x, 80);
  assert.equal(replay.pose(3.1), null);
  replay.gate(2, .8);
  assert.equal(replay.lastSplit, null);
  replay.gate(3, 1.8);
  assert.equal(replay.lastSplit.delta, -.2);
});

test("legacy times survive slower recorded laps and damaged replay data", () => {
  const district = "test-legacy";
  storage.setItem("nightshift-best-" + district, "30");
  storage.setItem("nightshift-pace-v1-" + district, "{");
  const first = new PaceLap(district, 2, spec);
  assert.equal(first.best, 30);
  assert.equal(first.reference, null);
  first.record(0, position(0), 0, 0);
  first.gate(0, 40);
  assert.deepEqual(first.finish(40, position(100), 0, 0), {best: 30, improved: false, delta: 10});
  const second = new PaceLap(district, 2, spec);
  second.record(0, position(0), 0, 0);
  second.gate(0, 35);
  second.finish(35, position(100), 0, 0);
  assert.equal(new PaceLap(district, 2, spec).reference.duration, 35000);
  assert.equal(districtBest(district), 30);
  assert.equal(new PaceLap(district, 3, spec).reference, null);
  for (const invalid of ["NaN", "Infinity", "-12"]) {
    storage.setItem("nightshift-best-bad", invalid);
    assert.equal(districtBest("bad"), null);
  }
});

test("even a long slow run keeps a bounded replay with its start and finish", () => {
  const lap = new PaceLap("test-long", 2, spec);
  for (let i = 0; i < 20000; i++) lap.record(i * .15, position(i % 200), 0, 0);
  lap.gate(0, 3000);
  lap.finish(3000, position(200), 0, 0);
  const stored = new PaceLap("test-long", 2, spec);
  assert.ok(stored.reference.frames.length <= 6000);
  assert.equal(stored.pose(0).x, 0);
  assert.equal(stored.pose(3000).x, 200);
});

test("timers carry rounded hundredths into the next minute", () => {
  assert.equal(raceTime(59.999), "01:00.00");
  assert.equal(raceTime(61.236), "01:01.24");
});
