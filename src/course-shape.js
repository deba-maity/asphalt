import * as THREE from "three";

import { gatesPerSegment } from "./data.js";

export const timingGateFraction = .4;

function catmullPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;

  return new THREE.Vector3(
    0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    0,
    0.5 *
      (2 * p1.z +
        (-p0.z + p2.z) * t +
        (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
        (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  );
}

export function sampleHybridClosedRoute(route, subdivisions, straightSegments = []) {
  const result = [];
  const straight = new Set(straightSegments);
  const n = route.length;

  for (let i = 0; i < n; i++) {
    const p0 = route[(i - 1 + n) % n];
    const p1 = route[i];
    const p2 = route[(i + 1) % n];
    const p3 = route[(i + 2) % n];

    for (let s = 0; s < subdivisions; s++) {
      const t = s / subdivisions;
      result.push(
        straight.has(i)
          ? p1.clone().lerp(p2, t)
          : catmullPoint(p0, p1, p2, p3, t),
      );
    }
  }

  return result;
}

// Join constant-radius corners with their common tangent straights. Each
// authored intersection keeps its gate number at the middle of its bend.
function roundedCircuit(vertices, subdivisions, desiredRadius) {
  const count = vertices.length;
  const bends = vertices.map((p, i) => {
    const before = p.clone().sub(vertices[(i + count - 1) % count]);
    const after = vertices[(i + 1) % count].clone().sub(p);
    const available = .46 * Math.min(before.length(), after.length());
    before.normalize();
    after.normalize();
    const turn = Math.atan2(before.x * after.z - before.z * after.x, before.dot(after));
    const tangent = Math.tan(Math.abs(turn) / 2);
    const trim = Math.min(available, desiredRadius * tangent);
    const radius = tangent > 1e-7 ? trim / tangent : desiredRadius;
    const entry = p.clone().addScaledVector(before, -trim);
    const exit = p.clone().addScaledVector(after, trim);
    const side = Math.sign(turn);
    const cx = entry.x - side * before.z * radius;
    const cz = entry.z + side * before.x * radius;
    const angle = Math.atan2(entry.z - cz, entry.x - cx);
    const arc = t => Math.abs(turn) < 1e-7 ? p.clone() :
      new THREE.Vector3(cx + radius * Math.cos(angle + turn * t), 0, cz + radius * Math.sin(angle + turn * t));
    return {entry, exit, arc, half: Math.abs(turn) * radius / 2};
  });
  const result = [];
  for (let i = 0; i < count; i++) {
    const a = bends[i], b = bends[(i + 1) % count];
    const straight = a.exit.distanceTo(b.entry);
    for (let j = 0; j < subdivisions; j++) {
      const distance = (a.half + straight + b.half) * j / subdivisions;
      if (distance < a.half) result.push(a.arc(.5 + distance / (2 * a.half)));
      else if (distance <= a.half + straight) result.push(a.exit.clone().lerp(b.entry, (distance - a.half) / straight));
      else result.push(b.arc((distance - a.half - straight) / (2 * b.half)));
    }
  }
  return result;
}

export function districtCourse(map) {
  const vertices = map.route.map(([x,z]) => new THREE.Vector3(x, 0, z));
  const subdivisions = map.id === "neon" || map.cornerRadius ? 22 : 18;
  const samples = map.cornerRadius ? roundedCircuit(vertices, subdivisions, map.cornerRadius)
    : sampleHybridClosedRoute(vertices, subdivisions, map.straightSegments);
  const controlRoute = samples.filter((_, i) => i % subdivisions === 0);
  const route = samples.filter((_, i) => i % (subdivisions / gatesPerSegment) === 0);
  return {controlRoute, route, samples};
}

export function shortcutPoints(source, shortcut) {
  const from = source[shortcut.from % source.length];
  const to = source[shortcut.to % source.length];
  if (shortcut.handles) {
    const [a, b] = shortcut.handles.map(([x,z]) => new THREE.Vector3(x, 0, z));
    return new THREE.CubicBezierCurve3(from, a, b, to).getPoints(18);
  }
  const mid = from.clone().lerp(to, 0.5);
  const direct = to.clone().sub(from);
  const side = new THREE.Vector3(-direct.z, 0, direct.x).normalize();
  const control = mid.addScaledVector(
    side,
    (shortcut.side || 1) * (shortcut.bend || 54),
  );
  const points = [];

  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const a = from.clone().lerp(control, t);
    const b = control.clone().lerp(to, t);
    points.push(a.lerp(b, t));
  }

  return points;
}

export function planShortcutRoads(controlRoute, shortcuts, surfaceY, projectMainRoad) {
  return shortcuts.map(shortcut => {
    const points = shortcutPoints(controlRoute, shortcut);
    const elevated = Boolean(shortcut.elevated);
    const heightProfile = points.map(() => surfaceY);
    if (elevated) {
      const distance = [0];
      for (let i = 1; i < points.length; i++) distance.push(distance[i - 1] + points[i].distanceTo(points[i - 1]));
      // Both roads share level asphalt until the whole ramp has cleared the
      // racing lane. At a later crossing the shortcut is already at full height.
      let first = 0, last = points.length - 1;
      while (first < last && projectMainRoad(points[first]).distance < 21) first++;
      while (last > first && projectMainRoad(points[last]).distance < 21) last--;
      for (let i = first; i <= last; i++) {
        const run = Math.min(distance[i] - distance[first], distance[last] - distance[i]);
        const t = Math.min(1, run / 64);
        heightProfile[i] += 6.65 * t * t * (3 - 2 * t);
      }
    }
    return { ...shortcut, points, elevated, heightProfile };
  });
}

// Find grade-separated intersections, excluding the flat junctions at either end.
export function mapOverpasses(samples, roads) {
  const crossings = [];
  for (const road of roads) {
    if (!road.elevated) continue;
    for (let j = 1; j < road.points.length; j++) {
      const a = road.points[j - 1], b = road.points[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      for (let i = 0; i < samples.length; i++) {
        const c = samples[i], d = samples[(i + 1) % samples.length];
        const ex = d.x - c.x, ez = d.z - c.z;
        const cross = dx * ez - dz * ex;
        if (Math.abs(cross) < .001) continue;
        const px = c.x - a.x, pz = c.z - a.z;
        const t = (px * ez - pz * ex) / cross;
        const u = (px * dz - pz * dx) / cross;
        if (t < 0 || t >= 1 || u < 0 || u >= 1) continue;
        const height = road.heightProfile[j - 1] * (1 - t) + road.heightProfile[j] * t;
        if (height > 4.5) crossings.push({x:a.x+t*dx, z:a.z+t*dz, angle:Math.atan2(dz,dx)});
      }
    }
  }
  return crossings;
}

const previews = new Map();
export function coursePreview(map) {
  if (previews.has(map.id)) return previews.get(map.id);
  const {controlRoute, route, samples: main} = districtCourse(map);
  const cuts = (map.shortcuts ?? []).map((road) => shortcutPoints(controlRoute, road));
  const points = main.concat(...cuts);
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...zs), bottom = Math.max(...zs);
  const scale = Math.min(254 / (right - left || 1), 135 / (bottom - top || 1));
  const project = (p) => [(150 + (p.x - (left + right) / 2) * scale).toFixed(1),
    (90 + (p.z - (top + bottom) / 2) * scale).toFixed(1)];
  const path = (line) => line.map((p, i) => (i ? "L" : "M") + project(p).join(",")).join(" ");
  const station = (map.startFraction ?? timingGateFraction) * main.length / route.length;
  const index = Math.floor(station);
  const line = main[index].clone().lerp(main[index + 1], station - index);
  const viaCuts = [];
  const stride = main.length / controlRoute.length;
  for (let segment = 0; segment < controlRoute.length;) {
    const index = (map.shortcuts ?? []).findIndex(road => road.from === segment && road.to > segment && road.to < controlRoute.length);
    if (index < 0) {
      viaCuts.push(...main.slice(segment * stride, (segment + 1) * stride));
      segment++;
    } else {
      viaCuts.push(...cuts[index].slice(0, -1));
      segment = map.shortcuts[index].to;
    }
  }
  const length = line => line.reduce((total, p, i) => total + p.distanceTo(line[(i + 1) % line.length]), 0);
  const preview = { circuit: path(main) + " Z", viaCuts: path(viaCuts) + " Z", cuts: cuts.map(path),
    start: project(line), metres: length(main), cutMetres: length(viaCuts) };
  previews.set(map.id, preview);
  return preview;
}
