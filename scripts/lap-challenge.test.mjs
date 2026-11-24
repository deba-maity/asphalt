import test from 'node:test';
import assert from 'node:assert/strict';
import {readLapChallenge, lapChallengeLink} from '../src/lap-challenge.js';

test('a shared lap uses the displayed hundredth, the original road and the same vehicle', () => {
  const address = 'https://example.com/games/nightshift/?preview=1#old';
  const link = lapChallengeLink(address, 'coast', 'bike0', 102.376);
  assert.equal(link, 'https://example.com/games/nightshift/#lap=coast.bike0.10238');
  const target = readLapChallenge(new URL(link).hash);
  assert.equal(target.map.id, 'coast');
  assert.equal(target.vehicle.id, 'bike0');
  assert.equal(target.ticks, 10238);
});

test('incomplete, unknown or out-of-range challenges leave the home screen available', () => {
  for (const hash of ['', '#lap=neon.car0.0', '#lap=coast.bike0.-2', '#lap=coast.unknown.72',
    '#lap=unknown.car0.741', '#lap=neon.car0.10000000', '#lap=neon.car0.1.5']) {
    assert.equal(readLapChallenge(hash), null);
  }
  assert.equal(lapChallengeLink('https://example.com/', 'coast', 'car0', NaN), null);
});
