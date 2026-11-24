import * as THREE from "three";

export const bridgeRailOffset = 12.1;

// Each station uses the same center and lateral direction as the drivable ribbon.
export function courseSpan(samples, controlCount, from, to) {
  const stride = samples.length / controlCount;
  const first = Math.round(from * stride);
  let last = Math.round(to * stride);
  if (last <= first) last += samples.length;
  const span = [];
  let length = 0;
  for (let i = first; i <= last; i++) {
    const index = i % samples.length;
    const point = samples[index];
    const before = samples[(index - 1 + samples.length) % samples.length];
    const after = samples[(index + 1) % samples.length];
    const normal = new THREE.Vector3(after.z - before.z, 0, before.x - after.x).normalize();
    if (span.length) length += point.distanceTo(span[span.length - 1].point);
    span.push({ point, normal, length });
  }
  return span;
}

export function trimSpan(span, start, end) {
  const result = [];
  for (let i = 1; i < span.length; i++) {
    const a = span[i - 1], b = span[i];
    const length = b.length - a.length;
    if (!length || b.length < start || a.length > end) continue;
    if (!result.length) result.push(interpolate(a, b, Math.max(start, a.length), length));
    if (b.length >= end) {
      if (result[result.length - 1].length < end) result.push(interpolate(a, b, end, length));
      break;
    }
    if (b.length > result[result.length - 1].length) result.push(b);
  }
  return result;
}

function interpolate(a, b, distance, length) {
  const t = (distance - a.length) / length;
  return {point: a.point.clone().lerp(b.point, t), normal: a.normal.clone().lerp(b.normal, t).normalize(), length: distance};
}

export function offsetStation(station, offset, height) {
  const point = station.point.clone().addScaledVector(station.normal, offset);
  point.y += height;
  return point;
}

// A closed rectangular section follows every bend. Shared endpoints keep
// curved rails, tunnel soffits and walls continuous, including on tight turns.
export function spanGeometry(span, left, right, bottom, top) {
  const vertices = [];
  const face = (a, b, c, d) => {
    for (const v of [a,b,c,a,c,d]) vertices.push(v.x,v.y,v.z);
  };
  let previous;
  for (const station of span) {
    const ring = [offsetStation(station,left,bottom), offsetStation(station,left,top),
      offsetStation(station,right,top), offsetStation(station,right,bottom)];
    if (!previous) face(...ring);
    else for (let j=0; j<4; j++) face(previous[j],ring[j],ring[(j+1)%4],previous[(j+1)%4]);
    previous = ring;
  }
  if (previous) face(...previous.reverse());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

export function bridgeRuns(span, openings) {
  const runs = [];
  let run = [];
  for (let i = 1; i < span.length; i++) {
    const a = span[i - 1], b = span[i];
    const segment = new THREE.Line3(a.point, b.point);
    const nearest = new THREE.Vector3();
    const atJunction = openings.some(point => segment.closestPointToPoint(point, true, nearest).distanceToSquared(point) < 16 * 16);
    if (atJunction) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      if (!run.length) run.push(a);
      run.push(b);
    }
  }
  if (run.length) runs.push(run);
  return runs;
}
