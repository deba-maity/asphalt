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

export function shortcutArrowPlacements(road, spacing) {
  if (!Number.isFinite(spacing) || spacing <= 0) throw new RangeError("Arrow spacing must be positive");
  const arrows = [];
  let distance = 0, next = spacing / 2;
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    const rise = road.heightProfile[i] - road.heightProfile[i - 1];
    while (next < distance + length) {
      const t = (next - distance) / length;
      arrows.push({
        x: a.x + dx * t, z: a.z + dz * t, y: road.heightProfile[i - 1] + rise * t,
        yaw: Math.atan2(dx, dz), pitch: -Math.atan2(rise, length),
      });
      next += spacing;
    }
    distance += length;
  }
  return arrows;
}

export function rampSpan(road) {
  let length = 0;
  return road.points.map((point, i) => {
    const before = road.points[Math.max(0, i - 1)], after = road.points[Math.min(road.points.length - 1, i + 1)];
    if (i) length += point.distanceTo(before);
    const normal = new THREE.Vector3(after.z - before.z, 0, before.x - after.x).normalize();
    return { point: point.clone().setY(road.heightProfile[i]), normal, length };
  });
}

// Keep parapets continuous except where a low ramp shares the main driving surface.
export function rampRailRuns(span, offset, projectMainRoad, mainHalfWidth, baseY) {
  const runs = [];
  let start = null;
  for (let i = 1; i < span.length; i++) {
    const a = span[i - 1], b = span[i], length = b.length - a.length;
    const steps = Math.max(1, Math.ceil(length / 1.5));
    for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
      const distance = a.length + j * length / steps;
      const station = interpolate(a, b, distance, length);
      const edge = offsetStation(station, offset, 0);
      const clear = edge.y >= baseY + 3 || projectMainRoad(edge).distance > mainHalfWidth + .3;
      if (clear && start === null) start = distance;
      if (!clear && start !== null) {
        const end = distance - length / steps;
        if (end > start) runs.push(trimSpan(span, start, end));
        start = null;
      }
    }
  }
  const end = span.at(-1).length;
  if (start !== null && end > start) runs.push(trimSpan(span, start, end));
  return runs;
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
  const vertices = [], uvs = [];
  const face = (corners, mapping) => {
    for (const i of [0,1,2,0,2,3]) {
      const v = corners[i];
      vertices.push(v.x,v.y,v.z);
      uvs.push(...mapping[i]);
    }
  };
  const width = right-left, height = top-bottom;
  const cap = [[0,0],[0,height],[width,height],[width,0]];
  let previous, lastU = 0;
  for (const station of span) {
    const u = station.length-span[0].length;
    const ring = [offsetStation(station,left,bottom), offsetStation(station,left,top),
      offsetStation(station,right,top), offsetStation(station,right,bottom)];
    if (!previous) face(ring, cap);
    else for (let j=0; j<4; j++) {
      const next = (j+1)%4;
      const size = j%2 === 0 ? height : width;
      const [v0,v1] = j < 2 ? [0,size] : [size,0];
      face([previous[j],ring[j],ring[next],previous[next]], [[lastU,v0],[u,v0],[u,v1],[lastU,v1]]);
    }
    previous = ring;
    lastU = u;
  }
  if (previous) face(previous.reverse(), [...cap].reverse());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));
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
