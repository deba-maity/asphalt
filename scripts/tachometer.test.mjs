import assert from "node:assert/strict";
import test from "node:test";
import { vehicles } from "../src/data.js";
import { Tachometer } from "../src/tachometer.js";

test("every vehicle pulls through its gears, holds a cruising gear and can select reverse", () => {
  for (const spec of vehicles) {
    const gauge = new Tachometer(spec);
    for (let i = 0; i < 60; i++) gauge.onGrid(1, 1 / 60);
    assert.equal(gauge.display, "N");
    assert.ok(gauge.fraction > 0.54 && gauge.fraction < 0.57);
    let last = 1,
      shifts = 0;
    for (let i = 0; i <= 1200; i++) {
      const speed = ((spec.maxSpeed / 5.7) * i) / 1200;
      gauge.update(speed, 1, false, 1 / 60);
      assert.ok(gauge.gear >= last && gauge.gear <= last + 1, spec.name);
      assert.ok(
        Number.isFinite(gauge.rpm) && gauge.fraction > 0 && gauge.fraction <= 1,
      );
      if (gauge.gear !== last) {
        shifts++;
        assert.ok(gauge.load < 0.5);
      }
      last = gauge.gear;
    }
    assert.equal(shifts, gauge.gears.length - 1);
    for (let i = 0; i < 240; i++)
      gauge.update((spec.maxSpeed / 5.7) * 0.65, 0.55, false, 1 / 60);
    const held = gauge.display;
    for (let i = 0; i < 240; i++) {
      gauge.update(
        (spec.maxSpeed / 5.7) * (0.65 + Math.sin(i) * 0.007),
        0.55,
        false,
        1 / 60,
      );
      assert.equal(gauge.display, held);
    }
    gauge.update(-2, 0, false, 1 / 60);
    assert.equal(gauge.display, "R");
    gauge.update(0, 0, false, 1 / 60);
    assert.equal(gauge.display, "N");
  }
});
