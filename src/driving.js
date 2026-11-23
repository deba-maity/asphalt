import { damp } from './timing.js';
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function engineAcceleration(spec) {
  return 4 + spec.accel * (spec.kind === 'bike' ? .115 : spec.kind === 'heavy' ? .078 : .105);
}

// Lightweight arcade dynamics: a real travel vector catches up with the
// chassis heading. Releasing drift recovers grip continuously, not by snapping
// the car sideways. All rates use seconds and are shared across render modes.
export function driveStep(state, input, spec, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const bike = spec.kind === 'bike', heavy = spec.kind === 'heavy', monster = spec.kind === 'monster';
  const top = (spec.maxSpeed || (bike ? 240 : monster ? 155 : heavy ? 185 : 285)) / 5.7;
  const gas = clamp(Number(input.gas) || 0, 0, 1), brake = clamp(Number(input.brake) || 0, 0, 1);
  const steerTarget = clamp(Number(input.steer) || 0, -1, 1);
  const before = state.speed;
  if (brake > .01) state.speed -= (5 + spec.braking * .12) * brake * dt;
  else if (gas > .01) state.speed += engineAcceleration(spec) * gas * dt;
  else state.speed *= Math.exp(-dt * (input.hand ? 1.5 : .36));
  const boosting = !!input.boost && state.boost > 1 && state.speed > 10 && brake < .1;
  state.boost = clamp(state.boost + (boosting ? -20 : 5.5) * dt, 0, 100);
  if (boosting) state.speed += (bike ? 25 : heavy ? 16 : monster ? 13 : 23) * dt;
  if (input.hand && state.speed > 0) state.speed *= Math.exp(-dt * .38);
  state.speed = clamp(state.speed, -top * .24, top * (boosting ? 1.08 : 1));
  state.steerInput = damp(state.steerInput || 0, steerTarget, steerTarget ? 8 : 11, dt);
  const steer = Math.abs(state.steerInput) < .008 ? 0 : state.steerInput;
  const ratio = clamp(Math.abs(state.speed) / top, 0, 1);
  const grip = (.45 + spec.handling * .009) * (bike ? 1.12 : monster ? .62 : heavy ? .68 : 1);
  const drifting = !!input.hand && state.speed > 12 && Math.abs(steer) > .08;
  const yawRate = -steer * (.5 + grip) * (state.speed < 0 ? -1 : 1) *
    clamp(Math.abs(state.speed) / 12, 0, 1.05) * (1 - ratio * .52) * (drifting ? 1.55 : 1);
  state.heading += yawRate * dt;
  const forwardX = -Math.sin(state.heading), forwardZ = -Math.cos(state.heading);
  const traction = drifting ? (bike ? 3.4 : 2.0) : 10 + grip * 3;
  state.velocityX = damp(state.velocityX || 0, forwardX * state.speed, traction, dt);
  state.velocityZ = damp(state.velocityZ || 0, forwardZ * state.speed, traction, dt);
  // Brakes reduce existing momentum as well as the requested forward speed.
  if (brake > .1 && before > 0) {
    const drag = Math.exp(-dt * brake * 1.5);
    state.velocityX *= drag; state.velocityZ *= drag;
  }
  const lateral = state.velocityX * -forwardZ + state.velocityZ * forwardX;
  state.slip = Math.atan2(lateral, Math.max(1, Math.abs(state.speed)));
  state.acceleration = (state.speed - before) / dt;
  state.yawRate = yawRate;
  state.boosting = boosting; state.drifting = drifting;
  return state;
}
