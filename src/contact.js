import { Matrix4, Vector3 } from "three";

// Sample the actual near model in its rest pose. Tyres and bumpers contribute;
// transparent shadows, exhaust flames and distant LODs stay outside the body.
const directions = Array.from({length: 32}, (_, i) => {
  const angle = i * Math.PI * 2 / 32;
  return [Math.cos(angle), Math.sin(angle)];
});

export function modelFootprint(model, frame = model) {
  frame.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(frame.matrixWorld).invert();
  const matrix = new Matrix4(), vertex = new Vector3();
  const support = directions.map(() => ({dot: -Infinity, x: 0, z: 0}));
  let bottom = Infinity, top = -Infinity;

  function sample(object) {
    if (!object.visible) return;
    if (object.isLOD) { sample(object.levels[0].object); return; }
    const positions = object.geometry?.getAttribute("position");
    if (positions && !object.material?.transparent) {
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i).applyMatrix4(matrix);
        bottom = Math.min(bottom, vertex.y);
        top = Math.max(top, vertex.y);
        for (let k = 0; k < directions.length; k++) {
          const dot = vertex.x * directions[k][0] + vertex.z * directions[k][1];
          const best = support[k];
          if (dot > best.dot) { best.dot = dot; best.x = vertex.x; best.z = vertex.z; }
        }
      }
    }
    for (const child of object.children) sample(child);
  }
  sample(model);
  const points = [];
  let prev = support.at(-1);
  for (const p of support) {
    if (Math.hypot(p.x - prev.x, p.z - prev.z) > .0001) points.push({x: p.x, z: p.z});
    prev = p;
  }
  if (points.length < 3) throw new Error("A contact footprint needs a solid body");
  return {points, bottom, top, radius: Math.max(...points.map(p => Math.hypot(p.x, p.z)))};
}

export function followingSpeed(driver, roadUsers) {
  const mesh = driver.mesh, body = mesh.userData.footprint;
  const fx = -Math.sin(mesh.rotation.y), fz = -Math.cos(mesh.rotation.y);
  let limit = Infinity;
  for (const other of roadUsers) {
    if (other === driver) continue;
    const target = other.mesh, shape = target.userData.footprint;
    const dx = target.position.x - mesh.position.x, dz = target.position.z - mesh.position.z;
    const forward = dx * fx + dz * fz;
    if (forward <= 0 || dx * dx + dz * dz > 36 * 36 || Math.abs(target.position.y - mesh.position.y) > 1.75) continue;
    const myHull = worldOutline(mesh, body), theirHull = worldOutline(target, shape);
    const myLane = interval(myHull, -fz, fx), theirLane = interval(theirHull, -fz, fx);
    if (theirLane.min > myLane.max + .15 || myLane.min > theirLane.max + .15) continue;
    const clearance = interval(theirHull,fx,fz).min - interval(myHull,fx,fz).max;
    const vx = other.velocityX ?? -(other.speed || 0) * Math.sin(target.rotation.y);
    const vz = other.velocityZ ?? -(other.speed || 0) * Math.cos(target.rotation.y);
    const leadSpeed = Math.max(0, vx * fx + vz * fz);
    // Brake early enough to leave a small bumper gap. Contact and damage are
    // still resolved separately from the visible vehicle bodies.
    limit = Math.min(limit, Math.sqrt(leadSpeed ** 2 + 7 * Math.max(0, clearance - 1.15)));
  }
  return limit;
}

const poses = new WeakMap();
function worldOutline(mesh, shape) {
  let shapes = poses.get(mesh);
  if (!shapes) { shapes = new Map(); poses.set(mesh, shapes); }
  let pose = shapes.get(shape);
  if (!pose) {
    pose = {points: shape.points.map(() => ({x: 0, z: 0}))};
    shapes.set(shape, pose);
  }
  const x = mesh.position.x, z = mesh.position.z, yaw = mesh.rotation.y;
  const sx = mesh.scale.x, sz = mesh.scale.z;
  if (pose.x === x && pose.z === z && pose.yaw === yaw && pose.sx === sx && pose.sz === sz) return pose.points;
  Object.assign(pose, {x, z, yaw, sx, sz});
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (let i = 0; i < shape.points.length; i++) {
    const src = shape.points[i], out = pose.points[i];
    out.x = x + c * sx * src.x + s * sz * src.z;
    out.z = z - s * sx * src.x + c * sz * src.z;
  }
  return pose.points;
}

function interval(points, nx, nz) {
  let min = Infinity, max = -Infinity;
  for (const p of points) {
    const d = p.x * nx + p.z * nz;
    min = Math.min(min, d); max = Math.max(max, d);
  }
  return {min, max};
}

// Return the shortest displacement that takes the first body out of the second.
// A positive skin is only used to keep an already touching patrol pinned.
export function bodyContact(first, second, shape = second.userData.footprint, skin = 0) {
  const body = first.userData.footprint;
  if (!body || !shape) return null;
  const a = first.position, b = second.position;
  const reach = body.radius * Math.max(first.scale.x, first.scale.z) +
    shape.radius * Math.max(second.scale.x, second.scale.z) + skin;
  if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > reach * reach ||
      a.y + body.bottom * first.scale.y >= b.y + shape.top * second.scale.y ||
      b.y + shape.bottom * second.scale.y >= a.y + body.top * first.scale.y) return null;
  const left = worldOutline(first, body), right = worldOutline(second, shape);
  let depth = Infinity, nx = 0, nz = 0;
  for (const outline of [left, right]) {
    let previous = outline.at(-1);
    for (const point of outline) {
      const dx = point.x - previous.x, dz = point.z - previous.z, len = Math.hypot(dx, dz);
      previous = point;
      if (len < .00001) continue;
      const x = -dz / len, z = dx / len;
      const p = interval(left, x, z), q = interval(right, x, z);
      const positive = q.max - p.min, negative = p.max - q.min;
      const overlap = Math.min(positive, negative);
      if (overlap <= -skin) return null;
      if (overlap < depth) {
        depth = overlap;
        const sign = positive < negative ? 1 : -1;
        nx = x * sign; nz = z * sign;
      }
    }
  }
  // Place scrape effects on the shared face instead of in the centre of a car.
  const normal = (interval(left, nx, nz).min + interval(right, nx, nz).max) * .5;
  const t1 = interval(left, -nz, nx), t2 = interval(right, -nz, nx);
  const tangent = (Math.max(t1.min, t2.min) + Math.min(t1.max, t2.max)) * .5;
  return {nx, nz, depth, x: nx * normal - nz * tangent, z: nz * normal + nx * tangent};
}
