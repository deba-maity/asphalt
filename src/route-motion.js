const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const angleDelta = (from, to) => Math.atan2(Math.sin(to-from), Math.cos(to-from));

// Start a moving car at an arc length on a closed road. Distances include the
// closing segment, so reinforcements can join either side of the lap line.
export function routeStateAt(distances, arcLength, lane) {
  const length = distances.at(-1);
  const at = ((arcLength % length) + length) % length;
  let low = 0, high = distances.length - 1;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (distances[mid] <= at) low = mid;
    else high = mid;
  }
  return { index: low, progress: (at - distances[low]) / (distances[high] - distances[low] || 1), lane };
}

// Preserve travelled distance through segment boundaries. Dropping the excess
// (or sampling the old segment after incrementing index) makes traffic jump.
export function advanceRoute(route, state, distance) {
  const n=route.length;
  if(n<2 || !Number.isFinite(distance) || distance<0) return;
  let a=route[state.index], b=route[(state.index+1)%n];
  let length=Math.hypot(b.x-a.x,b.z-a.z);
  let remaining=clamp(state.progress || 0,0,1)*length+distance;
  for(let guard=0;guard<n*2;guard++) {
    if(length>.0001 && remaining<length) break;
    remaining-=length; state.index=(state.index+1)%n;
    a=route[state.index];b=route[(state.index+1)%n];
    length=Math.hypot(b.x-a.x,b.z-a.z);
  }
  state.progress=length>.0001?clamp(remaining/length,0,1):0;
  const t=state.progress, previous=route[(state.index+n-1)%n], next=route[(state.index+2)%n];
  // Interpolating endpoint tangents keeps the lane offset and yaw continuous.
  const ax=b.x-previous.x, az=b.z-previous.z, al=Math.hypot(ax,az)||1;
  const bx=next.x-a.x, bz=next.z-a.z, bl=Math.hypot(bx,bz)||1;
  let tx=ax/al*(1-t)+bx/bl*t, tz=az/al*(1-t)+bz/bl*t;
  const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
  const lane=state.lane||0;
  state.x=a.x+(b.x-a.x)*t-tz*lane;
  state.z=a.z+(b.z-a.z)*t+tx*lane;
  state.heading=Math.atan2(-tx,-tz);
}

// Comfortable traffic speeds depend on local curvature. Carry the braking
// distance backwards around the lap so cars slow before a bend.
export function trafficSpeedLimits(route) {
  const count = route.length, limits = new Float32Array(count), lengths = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = route[(i + count - 1) % count], b = route[i], c = route[(i + 1) % count];
    const x1 = b.x - a.x, z1 = b.z - a.z, x2 = c.x - b.x, z2 = c.z - b.z;
    const turn = Math.abs(Math.atan2(x1*z2 - z1*x2, x1*x2 + z1*z2));
    lengths[i] = Math.hypot(x2, z2);
    const arc = .5 * (Math.hypot(x1, z1) + lengths[i]);
    limits[i] = turn > .0001 ? clamp(Math.sqrt(2.55 * arc / turn), 4.2, 17) : 17;
  }
  for (let k = 2*count - 1; k >= 0; k--) {
    const i = k % count, next = limits[(i+1) % count];
    limits[i] = Math.min(limits[i], Math.sqrt(next*next + 2*3.1*lengths[i]));
  }
  return limits;
}

export function moveStreetTraffic(route, limits, car, dt, followingLimit = Infinity) {
  if (!(dt > 0)) { advanceRoute(route, car, 0); return; }
  const next = (car.index + 1) % route.length;
  const target = Math.min(followingLimit, car.cruiseSpeed, limits[car.index] + (limits[next] - limits[car.index]) * car.progress);
  const previousSpeed = car.speed;
  car.speed += clamp(target - car.speed, -4.2 * dt, 2.0 * dt);
  car.acceleration = (car.speed - previousSpeed) / dt;
  const distance = (car.speed + previousSpeed) * .5 * dt;
  const previousHeading = car.heading;
  advanceRoute(route, car, distance);
  if (previousHeading == null || distance < .0001) return;
  // The visible street cars are at 72% scale with a two-metre wheelbase.
  // Positive yaw turns the wheel toward the same side as the body.
  const curvature = angleDelta(previousHeading, car.heading) / distance;
  const fullLock = .48 - Math.min(.24, car.speed * .004);
  car.steering = clamp(Math.atan(2 * curvature) / fullLock, -1, 1);
}

// Remove the inward component while retaining tangential motion along a wall.
export function deflectVelocity(state, nx, nz, restitution=.08) {
  const length=Math.hypot(nx,nz); if(length<.0001) return;
  nx/=length;nz/=length;
  const inward=(state.velocityX||0)*nx+(state.velocityZ||0)*nz;
  if(inward<0) {
    state.velocityX-=(1+restitution)*inward*nx;
    state.velocityZ-=(1+restitution)*inward*nz;
  }
}
