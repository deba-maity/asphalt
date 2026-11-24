import test from 'node:test';
import assert from 'node:assert/strict';
import { PursuitHeat } from '../src/pursuit-heat.js';

test('contact builds heat, and only a continuous six-second lead loses a unit', () => {
  const pursuit = new PursuitHeat('medium');
  pursuit.update(32, false, 100);
  assert.equal(pursuit.level, 3);
  pursuit.update(5, true, 100);
  pursuit.update(.1, false, 100);
  pursuit.update(5, true, 100);
  assert.equal(pursuit.level, 3);
  pursuit.update(1, true, 100);
  assert.equal(pursuit.level, 2);
  assert.equal(pursuit.breakaways, 1);
  assert.equal(pursuit.peak, 3);
  pursuit.update(6, true, 100);
  pursuit.update(60, true, 100);
  assert.equal(pursuit.level, 1);
  assert.equal(pursuit.breakaways, 2);
});

test('damage thresholds count once and difficulty changes how soon backup arrives', () => {
  const easy = new PursuitHeat('easy'), hard = new PursuitHeat('hard');
  easy.update(12, false, 100);
  hard.update(12, false, 100);
  assert.equal(easy.level, 1);
  assert.equal(hard.level, 2);
  hard.update(0, false, 65);
  hard.update(0, false, 65);
  assert.equal(hard.level, 3);
  hard.update(80, false, 40);
  assert.equal(hard.level, 5);
});
