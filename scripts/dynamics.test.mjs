import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedClock, damp, spring, pixelRatioFor } from '../src/timing.js';
import { driveStep } from '../src/driving.js';
import { vehicles } from '../src/data.js';
import { advanceRoute, angleDelta, deflectVelocity } from '../src/route-motion.js';

const fresh = () => ({ speed: 0, boost: 100, heading: 0, x: 0, z: 0 });
function replay(fps, spec = vehicles[0]) {
  const state = fresh(), clock = new FixedClock();
  let elapsed = 0;
  for (let frame = 0; frame < fps * 30; frame++) clock.advance(1 / fps, dt => {
    const input = { gas: elapsed < 25, brake: elapsed >= 25, steer: elapsed > 5 && elapsed < 15 ? .35 : 0,
      hand: elapsed > 10 && elapsed < 12, boost: elapsed > 18 && elapsed < 20 };
    driveStep(state, input, spec, dt);
    state.x += state.velocityX * dt; state.z += state.velocityZ * dt;
    elapsed += dt;
  });
  return { state, clock };
}

test('30, 60, 90, 120 and 144 Hz presentation replay identical physics', () => {
  const reference = replay(60);
  for (const fps of [30, 90, 120, 144]) {
    const result = replay(fps);
    assert.equal(result.clock.steps, 1800);
    assert.deepEqual(result.state, reference.state);
    assert.equal(result.clock.dropped, 0);
  }
});
test('long stalls have a finite catch-up budget and report discarded time', () => {
  const clock = new FixedClock(); let steps = 0;
  clock.advance(600, () => steps++);
  assert.equal(steps, 8);
  assert(clock.dropped > 599.8);
  assert(clock.fraction >= 0 && clock.fraction < 1);
  for (const invalid of [-1, NaN, Infinity]) assert.equal(clock.advance(invalid, () => assert.fail()), 0);
  assert.throws(() => new FixedClock(0), RangeError);
});
test('all fleet variants remain finite and within their speed/boost envelopes', () => {
  for (const spec of vehicles) {
    const { state } = replay(30, spec);
    for (const [name, value] of Object.entries(state))
      if (typeof value === 'number') assert(Number.isFinite(value), `${spec.name}: ${name}`);
    assert(state.boost >= 0 && state.boost <= 100);
    const top = (spec.maxSpeed || 285) / 5.7;
    assert(state.speed >= -top * .24 - .001 && state.speed <= top * 1.08 + .001);
  }
});
test('drift creates slip, then recovers smoothly when the handbrake releases', () => {
  const state = fresh();
  for(let i=0;i<600;i++) driveStep(state,{gas:1},vehicles[0],1/60);
  for(let i=0;i<60;i++) driveStep(state,{gas:1,steer:.6,hand:true},vehicles[0],1/60);
  assert(Math.abs(state.slip) > .1);
  const heading = state.heading, vx = state.velocityX, vz = state.velocityZ;
  driveStep(state,{gas:1},vehicles[0],1/60);
  assert(Math.abs(state.heading - heading) < .1);
  assert(Math.hypot(state.velocityX-vx,state.velocityZ-vz) < 8);
  for(let i=0;i<180;i++) driveStep(state,{gas:1},vehicles[0],1/60);
  assert(Math.abs(state.slip) < .002);
  assert(Math.abs(state.steerInput) < .001);
});
test('braking reduces travel momentum and reverse speed is limited', () => {
  const state = fresh();
  for(let i=0;i<600;i++) driveStep(state,{gas:1},vehicles[0],1/60);
  const speed = Math.hypot(state.velocityX,state.velocityZ);
  for(let i=0;i<60;i++) driveStep(state,{brake:1},vehicles[0],1/60);
  assert(Math.hypot(state.velocityX,state.velocityZ) < speed*.8);
  for(let i=0;i<1200;i++) driveStep(state,{brake:1},vehicles[0],1/60);
  assert(state.speed < 0);
  assert(Math.abs(state.speed) <= vehicles[0].maxSpeed / 5.7 * .24 + .001);
  const before = {...state};
  driveStep(state,{},vehicles[0],0);
  assert.deepEqual(state,before);
});
test('camera and suspension springs have frame-independent step response', () => {
  let reference;
  for (const fps of [30,60,120]) {
    let value=0, velocity=0, eased=0;
    for(let i=0;i<fps;i++) {
      [value,velocity]=spring(value,velocity,10,9,1/fps);
      eased=damp(eased,10,9,1/fps);
      assert(value >= 0 && value <= 10);
    }
    if(reference) { assert(Math.abs(value-reference.value)<1e-10); assert(Math.abs(eased-reference.eased)<1e-10); }
    reference={value,eased};
  }
});
test('absolute pixel budgets hold at laptop, retina, 4K and 8K sizes', () => {
  for(const [width,height,dpr] of [[1280,720,1],[1920,1080,1.5],[3840,2160,2],[7680,4320,3]]) {
    const ratio=pixelRatioFor(width,height,dpr,.78,600000,600);
    assert(width*height*ratio*ratio <= 600000 + .01);
    assert(height*ratio <= 600 + .01);
    assert(ratio<=dpr);
  }
});
test('traffic carries distance across a segment without snapping backwards', () => {
  const route=[{x:0,z:0},{x:10,z:0},{x:20,z:0},{x:30,z:0}];
  const state={index:0,progress:.99,lane:0};
  advanceRoute(route,state,.2);
  assert.equal(state.index,1); assert(Math.abs(state.x-10.1)<1e-9);
  advanceRoute(route,state,11);
  assert.equal(state.index,2); assert(Math.abs(state.x-21.1)<1e-9);
});
test('lane position and yaw remain continuous at sampled road joints', () => {
  const route=[{x:0,z:0},{x:10,z:0},{x:20,z:10},{x:20,z:20},{x:0,z:20}];
  const state={index:0,progress:.999,lane:3.2};
  advanceRoute(route,state,0);const before={...state};
  advanceRoute(route,state,.02);
  assert(Math.hypot(state.x-before.x,state.z-before.z)<.04);
  assert(Math.abs(angleDelta(before.heading,state.heading))<.01);
});
test('remote yaw uses the short arc at the -pi/pi seam', () => {
  assert(Math.abs(angleDelta(Math.PI-.01,-Math.PI+.01)-.02)<1e-12);
});
test('collision removes inward momentum and preserves motion along a barrier', () => {
  const state={velocityX:-10,velocityZ:6};
  deflectVelocity(state,1,0,0);
  assert.equal(state.velocityX,0);assert.equal(state.velocityZ,6);
  deflectVelocity(state,0,1,0);
  assert.equal(state.velocityZ,6);
});
