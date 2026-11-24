import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { maps, gatesPerSegment } from '../src/data.js';
import { shortcutPoints, sampleHybridClosedRoute } from '../src/course-shape.js';
import { shortcutApproach } from '../src/shortcut-guide.js';

test('all authored junctions offer a continuous shortcut guide and restore the main path if declined', () => {
  for (const map of maps) {
    const control = map.route.map(([x,z]) => new Vector3(x,0,z));
    const route = sampleHybridClosedRoute(control, gatesPerSegment, map.straightSegments);
    const roads = map.shortcuts.map(s => ({...s, points: shortcutPoints(control,s)}));
    const samples = sampleHybridClosedRoute(control, 18, map.straightSegments);
    const world = { route, samples, shortcutRoads: roads, authorSegmentToRouteIndex: i => i*gatesPerSegment };
    for (const road of roads) {
      const entry = world.authorSegmentToRouteIndex(road.from);
      const position = route[entry].clone();
      const player = { mesh: { position }, next: entry };
      const approach = shortcutApproach(world,player);
      assert.equal(approach.road, road);
      assert.equal(approach.arriving, true);
      player.next++;
      for (let i=0; i<=3; i++) {
        position.copy(road.points[i]);
        const hint = shortcutApproach(world,player);
        assert.equal(hint?.road, road, road.label);
        assert.equal(hint.arriving, false);
        assert(hint.gate >= i && hint.gate <= Math.min(i+1, 3));
      }
      position.copy(route[player.next]);
      assert.equal(shortcutApproach(world,player), null, road.label + ': main gate');
      position.set(10000,0,-10000);
      assert.equal(shortcutApproach(world,player), null);
    }
  }
});
