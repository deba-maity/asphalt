import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { maps } from '../src/data.js';
import { sampleHybridClosedRoute } from '../src/course-shape.js';
import { nearestPointOnPath, roadProjection } from '../src/road-projection.js';

test('indexed road projection agrees with an exhaustive search across every circuit', () => {
  for (const map of maps) {
    const controls = map.route.map(([x,z]) => new Vector3(x,0,z));
    const road = sampleHybridClosedRoute(controls, map.id === 'neon' ? 22 : 18, map.straightSegments);
    const project = roadProjection(road, 14.5);
    for (const [i, a] of road.entries()) {
      const b = road[(i + 1) % road.length];
      const distance = a.distanceTo(b);
      for (const offset of [0, 3, -10.5, 13.5, -14.5, 15, 48, -362]) {
        const x = .35*a.x + .65*b.x + (b.z-a.z)*offset/distance;
        const z = .35*a.z + .65*b.z - (b.x-a.x)*offset/distance;
        assert.deepEqual(project({x,z}), nearestPointOnPath({x,z},road,true));
      }
      assert.deepEqual(project(a), nearestPointOnPath(a,road,true));
    }
  }
});
