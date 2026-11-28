import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { maps, gatesPerSegment } from '../src/data.js';
import { shortcutPoints, sampleHybridClosedRoute } from '../src/course-shape.js';
import { shortcutApproach, shortcutMergeCue } from '../src/shortcut-guide.js';

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

test('a fast driver gets a braking and merge direction before the final flyover arch', () => {
  const map = maps.find(m => m.id === 'neon');
  const control = map.route.map(([x,z]) => new Vector3(x,0,z));
  const road = map.shortcuts.find(s => s.label === 'FLYOVER');
  const points = shortcutPoints(control,road);
  const world = {samples:sampleHybridClosedRoute(control,22,map.straightSegments),
    route:sampleHybridClosedRoute(control,gatesPerSegment,map.straightSegments), authorSegmentToRouteIndex:i=>i*gatesPerSegment};
  const player = {cut:{road:{...road,points},gate:points.length-1},speed:37,spec:{handling:75,braking:48},
    mesh:{position:points.at(-2).clone()}};
  const cue = shortcutMergeCue(world,player);
  assert.equal(cue.label,'BRAKE · MERGE RIGHT');
  assert.equal(cue.apex,points.at(-1));
  player.speed = 6;
  assert.equal(shortcutMergeCue(world,player).label,'MERGE RIGHT');
  player.cut.gate = 4;
  assert.equal(shortcutMergeCue(world,player),null);
});
