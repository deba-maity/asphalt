import assert from "node:assert/strict";
import test from "node:test";
import { Vector3 } from "three";
import { maps } from "../src/data.js";
import { mapOverpasses, planShortcutRoads, sampleHybridClosedRoute } from "../src/course-shape.js";
import { flyoverLayouts, flyoverHalfWidth, flyoverEnd, flyoverSurface } from "../src/flyover.js";
import { nearestPointOnPath, roadProjection } from "../src/road-projection.js";

for (const map of maps) {
  const controls = map.route.map(([x,z]) => new Vector3(x,0,z));
  const samples = sampleHybridClosedRoute(controls, map.id === "neon" ? 22 : 18, map.straightSegments);
  const main = roadProjection(samples, 23);
  const cuts = planShortcutRoads(controls, map.shortcuts, .052, main);
  const spans = flyoverLayouts(map.id, samples, controls.length);

  test(map.name + " cross streets clear the full width of every driving lane", () => {
    for (const deck of spans) {
      for (let s = -flyoverEnd; s <= flyoverEnd; s += .5) {
        const height = flyoverSurface(s);
        for (const x of [-flyoverHalfWidth, 0, flyoverHalfWidth]) {
          const point = deck.mid.clone().addScaledVector(deck.forward,s).addScaledVector(deck.normal,x);
          if (main(point).distance <= 13.5) assert.ok(height - 1.32 - .052 > 4.3, "main road clearance at " + s);
          for (const cut of cuts) {
            const projection = nearestPointOnPath(point,cut.points,false);
            if (projection.distance > 11.2) continue;
            const i = projection.index, u = projection.fraction;
            const cutHeight = cut.heightProfile[i] * (1 - u) + cut.heightProfile[i + 1] * u;
            assert.ok(height - 1.32 - cutHeight > 4.3, cut.label + " overhead clearance at " + s);
          }
        }
      }
      for (const station of deck.span) assert.equal(station.point.y, flyoverSurface(station.length - flyoverEnd));
      for (let s = -flyoverEnd + 1; s <= flyoverEnd; s++) {
        assert.ok(Math.abs(flyoverSurface(s) - flyoverSurface(s - 1)) < .28);
      }
    }
  });

  test(map.name + " flyover shortcut mouths share level asphalt and interior crossings have headroom", () => {
    const bridges = mapOverpasses(samples, cuts);
    assert.equal(bridges.length > 0, map.id === "neon" || map.id === "mesa");
    for (const road of cuts.filter(r => r.elevated)) {
      assert.equal(road.heightProfile[0], .052);
      assert.equal(road.heightProfile.at(-1), .052);
      for (let i = 1; i < road.points.length; i++) {
        const a = road.points[i - 1], b = road.points[i];
        for (let k = 0; k <= 12; k++) {
          const t = k / 12, p = a.clone().lerp(b,t);
          const h = road.heightProfile[i - 1] * (1 - t) + road.heightProfile[i] * t;
          if (main(p).distance < 18.7) {
            assert.ok(h < .15 || h - .72 - .052 > 4.3, road.label + " interleaved decks at " + i + " / " + t);
          }
        }
      }
    }
  });
}
