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
