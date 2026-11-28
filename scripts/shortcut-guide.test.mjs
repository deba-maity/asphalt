import test from 'node:test';
import assert from 'node:assert/strict';
import { maps, gatesPerSegment } from '../src/data.js';
import { districtCourse, shortcutPoints } from '../src/course-shape.js';
import { shortcutApproach, shortcutMergeCue } from '../src/shortcut-guide.js';

test('all authored junctions offer a continuous shortcut guide and restore the main path if declined', () => {
  for (const map of maps) {
    const {controlRoute: control, route, samples} = districtCourse(map);
    const roads = map.shortcuts.map(s => ({...s, points: shortcutPoints(control,s)}));
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

test('a fast driver gets a braking and merge direction before the final Sky Cut arch', () => {
  const map = maps.find(m => m.id === 'neon');
  const {controlRoute: control, samples, route} = districtCourse(map);
  const road = map.shortcuts.find(s => s.label === 'SKY CUT');
  const points = shortcutPoints(control,road);
  const world = {samples, route, authorSegmentToRouteIndex:i=>i*gatesPerSegment};
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
