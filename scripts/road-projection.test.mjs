import test from 'node:test';
import assert from 'node:assert/strict';
import { maps } from '../src/data.js';
import { coursePreview, districtCourse, shortcutPoints } from '../src/course-shape.js';
import { nearestPointOnPath, roadProjection } from '../src/road-projection.js';

test('indexed road projection agrees with an exhaustive search across every circuit', () => {
  for (const map of maps) {
    const {samples: road} = districtCourse(map);
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

test('Meridian bends have room to steer and each shortcut meets the forward racing line', () => {
  const map = maps.find(m => m.id === 'neon');
  const {samples, controlRoute} = districtCourse(map);
  const count = samples.length, stride = count / controlRoute.length;
  const turn = (a, b) => Math.abs(Math.atan2(a.x*b.z - a.z*b.x, a.dot(b)));
  let metres = 0;
  for (let i=0; i<count; i++) {
    const a = samples[i].clone().sub(samples[(i + count - 1) % count]);
    const b = samples[(i + 1) % count].clone().sub(samples[i]);
    const radians = turn(a,b);
    assert.ok(a.length() > 1 && (a.length() + b.length()) / (2 * radians) > 32, 'Tight bend at sample ' + i);
    metres += b.length();
  }
  assert.ok(Math.abs(metres - coursePreview(map).metres) < .001);
  for (const road of map.shortcuts) {
    const points = shortcutPoints(controlRoute,road);
    const entry = road.from * stride, exit = road.to * stride;
    assert.ok(points[0].equals(samples[entry]) && points.at(-1).equals(samples[exit]));
    const incoming = samples[entry].clone().sub(samples[entry-1]);
    const outgoing = samples[exit+1].clone().sub(samples[exit]);
    assert.ok(turn(incoming, points[1].clone().sub(points[0])) < Math.PI / 5, road.label + ' fork');
    assert.ok(turn(points.at(-1).clone().sub(points.at(-2)), outgoing) < Math.PI / 5, road.label + ' merge');
  }
});
