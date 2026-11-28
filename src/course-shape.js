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

export function shortcutPoints(source, shortcut) {
  const from = source[shortcut.from % source.length];
  const to = source[shortcut.to % source.length];
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
  const controls = map.route.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const main = sampleHybridClosedRoute(controls, 12, map.straightSegments);
  const cuts = (map.shortcuts ?? []).map((road) => shortcutPoints(controls, road));
  const points = main.concat(...cuts);
  const xs = points.map((p) => p.x), zs = points.map((p) => p.z);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...zs), bottom = Math.max(...zs);
  const scale = Math.min(254 / (right - left || 1), 135 / (bottom - top || 1));
  const project = (p) => [(150 + (p.x - (left + right) / 2) * scale).toFixed(1),
    (90 + (p.z - (top + bottom) / 2) * scale).toFixed(1)];
  const path = (line) => line.map((p, i) => (i ? "L" : "M") + project(p).join(",")).join(" ");
  const line = controls[0].clone().lerp(controls[1], timingGateFraction / gatesPerSegment);
  const preview = { circuit: path(main) + " Z", cuts: cuts.map(path), start: project(line) };
  previews.set(map.id, preview);
  return preview;
}
