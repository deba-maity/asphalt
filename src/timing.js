// Fixed simulation and presentation cadence are deliberately independent.
// Long stalls discard excess catch-up, never replay an unbounded burst of inputs.
export class FixedClock {
  constructor(hz = 60, maxSteps = 8) {
    if (!Number.isFinite(hz) || hz <= 0 || !Number.isInteger(maxSteps) || maxSteps < 1)
      throw new RangeError('A positive frequency and step budget are required');
    this.step = 1 / hz;
    this.maxSteps = maxSteps;
    this.reset();
  }
  reset() { this.accumulator = 0; this.steps = 0; this.dropped = 0; }
  advance(seconds, update) {
    if (!Number.isFinite(seconds) || seconds < 0) return 0;
    this.dropped += Math.max(0, seconds - .25);
    this.accumulator += Math.min(seconds, 0.25);
    let count = 0;
    while (this.accumulator + 1e-9 >= this.step && count < this.maxSteps) {
      update(this.step);
      this.accumulator -= this.step;
      count++; this.steps++;
    }
    if (this.accumulator >= this.step) {
      const excess = Math.floor(this.accumulator / this.step) * this.step;
      this.dropped += excess; this.accumulator -= excess;
    }
    this.accumulator = Math.max(0, this.accumulator);
    return count;
  }
  get fraction() { return Math.min(1, this.accumulator / this.step); }
}

export function damp(current, target, rate, dt) {
  return current + (target - current) * -Math.expm1(-rate * Math.max(0, dt));
}

// Analytic critically damped spring; stable through low frame rates and does
// not change its response when a user changes the presentation cap.
export function spring(value, velocity, target, frequency, dt) {
  const offset = value - target;
  const impulse = (velocity + frequency * offset) * dt;
  const decay = Math.exp(-frequency * dt);
  return [target + (offset + impulse) * decay, (velocity - frequency * impulse) * decay];
}

export function pixelRatioFor(width, height, dpr, scale, maxPixels, maxHeight) {
  if (![width, height, dpr, scale].every(Number.isFinite) || width <= 0 || height <= 0) return 1;
  return Math.max(0.1, Math.min(dpr, scale, Math.sqrt(maxPixels / (width * height)), maxHeight / height));
}
