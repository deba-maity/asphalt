import { Vector3 } from "three";

// Positions are measured along the authored racing line, in control-point intervals.
// In Neon the transit viaduct crosses beyond the Sky Cut landing and the underpass.
const locations = {neon: [7.23, 18.5], coast: [5.5], dock: [4], mesa: [7.5]};
export const flyoverHalfWidth = 4.9;
export const flyoverEnd = 83;
const plateauEnd = 24, rampEnd = 67;

function surfaceHeight(station) {
  const t = Math.max(0, Math.min(1, (Math.abs(station) - plateauEnd) / (rampEnd - plateauEnd)));
  return 7.96 - 7.9 * t * t * (3 - 2 * t);
}

export function flyoverLayouts(mapId, samples, controlCount) {
  return (locations[mapId] || []).map(location => {
    const stationIndex = Math.round(location * samples.length / controlCount) % samples.length;
    const mid = samples[stationIndex];
    const tangent = samples[(stationIndex + 1) % samples.length].clone()
      .sub(samples[(stationIndex + samples.length - 1) % samples.length]).normalize();
    const forward = new Vector3(tangent.z, 0, -tangent.x);
    const normal = new Vector3(forward.z, 0, -forward.x);
    const yaw = Math.atan2(forward.x, forward.z);
    const span = [];
    // Integer metre stations give the road mesh and both axles the same surface.
    for (let s = -flyoverEnd; s <= flyoverEnd; s++) {
      const distance = Math.abs(s);
      if (distance === flyoverEnd || (distance >= plateauEnd && distance <= rampEnd)) {
        span.push({point: mid.clone().addScaledVector(forward, s).setY(surfaceHeight(s)), normal, length: s + flyoverEnd});
      }
    }
    return {mid, stationIndex, yaw, forward, normal, span};
  });
}

// Interpolate between the exact same stations triangulated by the deck.
export function flyoverSurface(station) {
  const lo = Math.floor(station), t = station - lo;
  return surfaceHeight(lo) * (1 - t) + surfaceHeight(lo + 1) * t;
}

export function distanceToFlyover(position, layout) {
  const x = position.x - layout.mid.x, z = position.z - layout.mid.z;
  const along = Math.abs(x * layout.forward.x + z * layout.forward.z);
  const across = x * layout.normal.x + z * layout.normal.z;
  return Math.hypot(across, Math.max(0, along - flyoverEnd));
}
