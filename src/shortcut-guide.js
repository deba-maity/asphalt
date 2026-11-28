export function shortcutMarkerIndex(road, gate) {
  // Keep the arch fixed through a stretch of the ramp while the line follows
  // every bend. The final arch always sits at the junction on the main road.
  return Math.min(road.points.length - 1, Math.max(3, Math.ceil(gate / 3) * 3));
}

export function shortcutMergeCue(world, player) {
  const {road, gate} = player.cut, points = road.points;
  if (gate < points.length - 4) return null;
  const end = points.at(-1), before = points.at(-2);
  const index = world.authorSegmentToRouteIndex(road.to) * world.samples.length / world.route.length;
  const after = world.samples[(index + 2) % world.samples.length];
  const ax = end.x - before.x, az = end.z - before.z;
  const bx = after.x - end.x, bz = after.z - end.z;
  const turn = Math.atan2(ax * bz - az * bx, ax * bx + az * bz);
  const grip = 3.1 + player.spec.handling * .055;
  const speed = Math.sqrt(20 * grip / Math.max(.25, Math.abs(turn)));
  const stopping = Math.max(0, (player.speed ** 2 - speed ** 2) / (2 * (5 + player.spec.braking * .12)));
  const pos = player.mesh.position;
  let remaining = Math.hypot(points[gate].x - pos.x, points[gate].z - pos.z);
  for (let i = gate + 1; i < points.length; i++) remaining += points[i].distanceTo(points[i - 1]);
  if (remaining > Math.max(40, stopping + player.speed * .9)) return null;
  const braking = Math.abs(turn) > .45 && player.speed > speed + 2 && remaining < stopping + player.speed * .55;
  const label = Math.abs(turn) < .32 ? "JOIN MAIN ROAD" : "MERGE " + (turn < 0 ? "LEFT" : "RIGHT");
  return {label: (braking ? "BRAKE · " : "") + label, detail: road.label + " · " + Math.round(remaining) + "M TO MAIN ROAD",
    braking, targetKph: Math.round(speed * 5.7), apex: end};
}

// The entry junction still has to be crossed. The planned route is only advice;
// the race accepts a shortcut after the car physically reaches its first marker.
export function shortcutApproach(world, player) {
  const pos = player.mesh.position;
  const n = world.route.length;
  for (const road of world.shortcutRoads) {
    const entry = world.authorSegmentToRouteIndex(road.from);
    const gatesAhead = (entry - player.next + n) % n;
    const arriving = gatesAhead <= 1;
    if (!arriving && player.next !== (entry + 1) % n) continue;
    const origin = road.points[0];
    const entryDistance = Math.hypot(pos.x - origin.x, pos.z - origin.z);
    if (arriving && entryDistance > 150) continue;
    const sample = entry * world.samples.length / n;
    const incoming = world.samples[(sample - 2 + world.samples.length) % world.samples.length];
    const mainExit = world.samples[(sample + 3) % world.samples.length];
    const fork = road.points[2];
    const bx = fork.x - origin.x, bz = fork.z - origin.z;
    const ix = origin.x - incoming.x, iz = origin.z - incoming.z;
    const angle = Math.abs(Math.atan2(ix*bz - iz*bx, ix*bx + iz*bz));
    const cross = (mainExit.x - origin.x)*bz - (mainExit.z - origin.z)*bx;
    const side = cross < 0 ? "LEFT" : "RIGHT";
    if (arriving) return { road, entry, side, arriving, gate: 0, angle, distance: entryDistance };
    let closest = Infinity, gate = 1;
    for (let i = 1; i <= 3; i++) {
      const a = road.points[i - 1], b = road.points[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((pos.x-a.x)*dx + (pos.z-a.z)*dz) / (dx*dx + dz*dz || 1)));
      const distance = Math.hypot(pos.x - a.x - t*dx, pos.z - a.z - t*dz);
      if (distance < closest) {
        closest = distance;
        gate = Math.min(3, t > .8 ? i + 1 : i);
      }
    }
    // A driver who stays on the main road gets the regular next gate back.
    if (entryDistance > 18 && closest > 13) continue;
    return { road, entry, side, arriving, gate, angle, distance: 0 };
  }
  return null;
}
