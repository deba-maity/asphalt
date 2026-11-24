import * as THREE from "three";

// One translucent line mesh stands in for a previous run. It never enters the
// race field, collision checks, input system or vehicle animation pipeline.
export function paceGhost(kind) {
  const vertices = [];
  function loop(points) {
    points.forEach((point, i) => vertices.push(...point, ...points[(i + 1) % points.length]));
  }
  function shell(bottom, top) {
    loop(bottom); loop(top);
    bottom.forEach((point, i) => vertices.push(...point, ...top[i]));
  }
  function wheels(x, z, radius) {
    const rim = [];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      rim.push([x, radius + Math.cos(a) * radius, z + Math.sin(a) * radius]);
    }
    loop(rim);
  }
  if (kind === "bike") {
    wheels(0, -1.05, .4); wheels(0, 1.02, .42);
    shell([[-.16,.46,-1.0],[.16,.46,-1.0],[.2,.55,.85],[-.2,.55,.85]],
      [[-.24,.83,-.65],[.24,.83,-.65],[.20,.92,.58],[-.20,.92,.58]]);
    loop([[0,1.0,.36],[0,1.65,-.05],[0,1.52,-.48],[0,.88,-.53]]);
  } else {
    const heavy = kind === "heavy" || kind === "monster";
    const w = heavy ? 1.22 : 1.04, length = heavy ? 2.7 : 2.4, raised = heavy ? .48 : 0;
    const ring = (front, rear, half, y) => [[-half,y,front],[half,y,front],[half,y,rear],[-half,y,rear]];
    shell(ring(-length,length,w,.33+raised),ring(-length+.22,length-.08,w,.78+raised));
    shell(ring(-1.25,1.50,w*.92,.79+raised),ring(-.57,.82,w*.75,1.36+raised));
    for (const side of [-w,w]) {
      wheels(side,-length*.64,heavy ? .57 : .37);
      wheels(side,length*.63,heavy ? .57 : .37);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.LineBasicMaterial({ color: 0xc6a9ff, transparent: true, opacity: .7, depthWrite: false, toneMapped: false });
  geometry.userData.disposeWithActor = material.userData.disposeWithActor = true;
  const ghost = new THREE.LineSegments(geometry, material);
  ghost.name = "Personal pace ghost";
  ghost.visible = false;
  return ghost;
}
