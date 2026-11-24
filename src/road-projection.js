export function nearestPointOnPath(position, points, closed, candidates) {
  let distanceSq = Infinity, x = 0, z = 0, index = 0, fraction = 0;
  const segments = closed ? points.length : points.length - 1;
  const count = candidates ? candidates.length : segments;
  for (let j = 0; j < count; j++) {
    const i = candidates ? candidates[j] : j;
    const a = points[i], b = points[(i + 1) % points.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const px = a.x + t * dx, pz = a.z + t * dz;
    const squared = (position.x - px) ** 2 + (position.z - pz) ** 2;
    if (squared < distanceSq) {
      distanceSq = squared;
      x = px;
      z = pz;
      index = i;
      fraction = t;
    }
  }
  return { x, z, index, fraction, distance: Math.sqrt(distanceSq) };
}

// Each cell includes every segment whose projection could fall within reach of a
// point in that cell. Segment order preserves the tie break at shared endpoints.
export function roadProjection(points, reach, cellSize = 32) {
  const columns = new Map();
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const left = Math.floor((Math.min(a.x, b.x) - reach) / cellSize);
    const right = Math.floor((Math.max(a.x, b.x) + reach) / cellSize);
    const top = Math.floor((Math.min(a.z, b.z) - reach) / cellSize);
    const bottom = Math.floor((Math.max(a.z, b.z) + reach) / cellSize);
    for (let x = left; x <= right; x++) {
      if (!columns.has(x)) columns.set(x, new Map());
      const column = columns.get(x);
      for (let z = top; z <= bottom; z++) {
        if (!column.has(z)) column.set(z, []);
        column.get(z).push(i);
      }
    }
  }
  return (position) => {
    const cells = columns.get(Math.floor(position.x / cellSize));
    const candidates = cells?.get(Math.floor(position.z / cellSize));
    if (candidates) {
      const hit = nearestPointOnPath(position, points, true, candidates);
      if (hit.distance <= reach) return hit;
    }
    return nearestPointOnPath(position, points, true);
  };
}
