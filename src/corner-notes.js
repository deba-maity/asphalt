// Read the approach and departure either side of each authored corner on the
// sampled racing surface. Very shallow kinks don't warrant a driving prompt.
export function courseCorners(samples, distances, controlCount) {
  const count = samples.length, stride = count / controlCount;
  const wrap = i => (i + count) % count;
  const corners = [];
  for (let control = 0; control < controlCount; control++) {
    const i = Math.round(control * stride);
    const apex = samples[i];
    function direction(step) {
      let index = i, walked = 0;
      for (let n = 0; n < stride && walked < 30; n++) {
        const next = wrap(index + step);
        walked += samples[index].distanceTo(samples[next]);
        index = next;
      }
      // Sample the road tangent at the edge of the turn, not its chord.
      const incoming = samples[wrap(index - 1)], outgoing = samples[wrap(index + 1)];
      return {x: outgoing.x - incoming.x, z: outgoing.z - incoming.z, walked};
    }
    const before = direction(-1), after = direction(1);
    const turn = Math.atan2(before.x * after.z - before.z * after.x, before.x * after.x + before.z * after.z);
    const angle = Math.abs(turn);
    if (angle < .48) continue;
    const bend = angle > 2.16 ? "HAIRPIN" : angle > .92 ? "TURN" : "EASY";
    corners.push({point: apex, distance: distances[i], angle, radius: (before.walked + after.walked) / angle,
      label: bend + (turn < 0 ? " LEFT" : " RIGHT")});
  }
  return corners;
}

export function approachingCorner(corners, progress, length, speed, spec) {
  const velocity = Math.max(0, speed);
  const horizon = Math.min(140, Math.max(28, 12 + velocity * 2.6));
  let nearest = null;
  for (const bend of corners) {
    const distance = ((bend.distance - progress) % length + length) % length;
    if (distance > horizon || (nearest && distance >= nearest.distance)) continue;
    const grip = 3.1 + spec.handling * .055;
    const target = Math.sqrt(bend.radius * grip);
    const slowdown = Math.max(0, (velocity * velocity - target * target) / (2 * (5 + spec.braking * .12)));
    nearest = {bend, distance, targetSpeed: target, braking: bend.angle > .92 && velocity > target + 1 && distance <= slowdown + velocity * .42};
  }
  return nearest;
}
