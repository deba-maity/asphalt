import * as THREE from "three";
import { consolidateVehicle } from "./rendering.js";
import { createTouring } from "./touring.js";
import { damp, spring } from "./timing.js";
import { createRider, updateRider } from "./rider.js";

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tire: new THREE.CylinderGeometry(1, 1, 1, 22),
  rim: new THREE.CylinderGeometry(0.68, 0.68, 1.02, 18),
  disc: new THREE.CylinderGeometry(0.74, 0.74, 0.05, 18),
  torus: new THREE.TorusGeometry(.87, .13, 10, 28),
  flame: new THREE.ConeGeometry(0.18, 0.72, 10),
  sphere: new THREE.SphereGeometry(1, 16, 10),
  shadow: new THREE.PlaneGeometry(1, 1),
};

const shared = {
  tire: new THREE.MeshStandardMaterial({
    color: 0x050608,
    roughness: 0.72,
    metalness: 0.02,
  }),
  rim: new THREE.MeshStandardMaterial({
    color: 0xb8c4ce,
    roughness: 0.23,
    metalness: 0.9,
  }),
  brake: new THREE.MeshStandardMaterial({
    color: 0xb93d28,
    emissive: 0x5a0d08,
    emissiveIntensity: 0.45,
    roughness: 0.32,
    metalness: 0.38,
  }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x183342,
    metalness: 0.8,
    roughness: 0.12,
    envMapIntensity: 1.8,
  }),
  carbon: new THREE.MeshStandardMaterial({
    color: 0x05070b,
    roughness: 0.34,
    metalness: 0.62,
  }),
  rubber: new THREE.MeshStandardMaterial({
    color: 0x020304,
    roughness: 0.82,
    metalness: 0.02,
  }),
  chrome: new THREE.MeshStandardMaterial({
    color: 0x9faeb8,
    roughness: 0.18,
    metalness: 1,
  }),
  satin: new THREE.MeshStandardMaterial({
    color: 0xdfe8ee,
    roughness: 0.28,
    metalness: 0.74,
  }),
  riderSuit: new THREE.MeshStandardMaterial({
    color: 0x07090d,
    roughness: 0.5,
    metalness: 0.18,
  }),
  riderArmor: new THREE.MeshStandardMaterial({
    color: 0x161f2a,
    roughness: 0.34,
    metalness: 0.46,
  }),
  lampHousing: new THREE.MeshStandardMaterial({
    color: 0x111821,
    roughness: 0.38,
    metalness: 0.55,
  }),
};

const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 64;
const shadowCtx = shadowCanvas.getContext("2d");
const shadowGradient = shadowCtx.createRadialGradient(32, 32, 8, 32, 32, 32);
shadowGradient.addColorStop(0, "rgba(0,0,0,.8)");
shadowGradient.addColorStop(1, "rgba(0,0,0,0)");
shadowCtx.fillStyle = shadowGradient;
shadowCtx.fillRect(0, 0, 64, 64);
const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
shared.contactShadow = new THREE.MeshBasicMaterial({
  map: shadowTexture,
  transparent: true,
  depthWrite: false,
  opacity: 0.65,
});
for (const material of Object.values(shared))
  material.userData.sharedVehicle = true;

function owned(material) {
  material.userData.disposeWithActor = true;
  return material;
}

function part(
  parent,
  geometry,
  material,
  position,
  scale = [1, 1, 1],
  rotation,
  shadows = true,
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.userData.vehiclePart = true;
  parent.add(mesh);
  return mesh;
}

function paintMaterial(color) {
  return owned(
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.65,
      roughness: 0.27,
      envMapIntensity: 1.25,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
      emissive: color,
      emissiveIntensity: 0.018,
    }),
  );
}

function lightMaterial(color) {
  return owned(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
}

function tube(
  parent,
  position,
  scale,
  material = shared.chrome,
  rotation = [0, 0, 0],
) {
  return part(
    parent,
    geo.tire,
    material,
    position,
    [scale[0], scale[2], scale[1]],
    rotation,
  );
}

function createWheel(parent, x, z, radius, data, front = false, width = 0.34) {
  const pivot = new THREE.Group();
  pivot.position.set(x, radius, z);
  parent.add(pivot);

  const spin = new THREE.Group();
  pivot.add(spin);

  part(
    spin,
    geo.tire,
    shared.tire,
    [0, 0, 0],
    [radius, width, radius],
    [0, 0, Math.PI / 2],
  );
  part(
    spin,
    geo.rim,
    shared.carbon,
    [0, 0, 0],
    [radius * 0.63, width * 1.1, radius * 0.63],
    [0, 0, Math.PI / 2],
  );
  part(
    spin,
    geo.disc,
    shared.brake,
    [x > 0 ? -width * 0.47 : width * 0.47, 0, 0],
    [radius * 0.58, width * 1.5, radius * 0.58],
    [0, 0, Math.PI / 2],
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++)
      part(
        spin,
        geo.box,
        shared.rim,
        [side * width * 0.54, 0, 0],
        [0.025, radius * 1.05, 0.045],
        [(i * Math.PI) / 5, 0, 0],
      );
    part(
      spin,
      geo.rim,
      shared.chrome,
      [side * width * 0.56, 0, 0],
      [radius * 0.18, 0.035, radius * 0.18],
      [0, 0, Math.PI / 2],
    );
  }
  data.wheels.push({ pivot, spin, front, radius });
}

function addCarLights(body, c, data) {
  const headMat = lightMaterial(0xe8fbff);
  const rearMat = lightMaterial(0xff263f);

  for (const x of [-c.w * 0.28, c.w * 0.28]) {
    part(
      body,
      geo.box,
      shared.lampHousing,
      [x, 0.03, -c.l * 0.5 - 0.02],
      [c.w * 0.25, 0.18, 0.08],
    );
    part(
      body,
      geo.box,
      headMat,
      [x, 0.05, -c.l * 0.505],
      [c.w * 0.2, 0.07, 0.035],
    );
    part(
      body,
      geo.box,
      rearMat,
      [x * 1.18, 0.12, c.l * 0.49],
      [c.w * 0.22, 0.11, 0.045],
    );
  }

  data.headLights.push(headMat);
  data.brakeLights.push(rearMat);
}

function addNitro(root, data, x, z) {
  const material = owned(
    new THREE.MeshBasicMaterial({
      color: 0x45ddff,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const flame = part(
    root,
    geo.flame,
    material,
    [x, 0.42, z],
    [1, 1, 1],
    [Math.PI / 2, 0, 0],
    false,
  );
  flame.visible = false;
  data.flames.push(flame);
}

function coachwork(sections) {
  const positions = [],
    indices = [];
  for (const [z, width, bottom, top] of sections) {
    const r = (top - bottom) * 0.22;
    for (const [x, y] of [
      [-width * 0.84, bottom],
      [-width, bottom + r],
      [-width, top - r],
      [-width * 0.76, top],
      [width * 0.76, top],
      [width, top - r],
      [width, bottom + r],
      [width * 0.84, bottom],
    ])
      positions.push(x, y, z);
  }
  for (let n = 0; n < sections.length - 1; n++)
    for (let i = 0; i < 8; i++) {
      const a = n * 8 + i,
        b = n * 8 + ((i + 1) % 8),
        c = a + 8,
        d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  for (let i = 1; i < 7; i++) {
    indices.push(0, i, i + 1);
    const k = (sections.length - 1) * 8;
    indices.push(k, k + i + 1, k + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      new Array((positions.length / 3) * 2).fill(0),
      2,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.disposeWithActor = true;
  return geometry;
}

function buildCar(root, spec, paint, data, police) {
  const profiles = {
    coupe: { w: 2.05, l: 4.75, h: 0.62, cabin: 0.55, wing: false },
    muscle: { w: 2.24, l: 4.95, h: 0.72, cabin: 0.5, wing: false },
    super: { w: 2.28, l: 5.08, h: 0.52, cabin: 0.4, wing: true },
    hyper: { w: 2.42, l: 5.32, h: 0.46, cabin: 0.34, wing: true },
    rally: { w: 2.16, l: 4.58, h: 0.86, cabin: 0.56, wing: true },
  };
  const c = profiles[spec.profile] || profiles.coupe;
  const radius = spec.profile === "rally" ? 0.44 : 0.4;
  const body = new THREE.Group();
  body.position.y = radius + c.h * 0.32;
  root.add(body);
  data.body=body; data.bodyRest=body.position.y;
  const half = c.w * 0.5;
  part(
    body,
    coachwork([
      [-c.l * 0.52, half * 0.79, -0.17, 0.02],
      [-c.l * 0.43, half * 0.96, -0.23, c.h * 0.22],
      [-c.l * 0.28, half, -0.23, c.h * 0.4],
      [-c.l * 0.06, half * 0.94, -0.23, c.h * 0.36],
      [c.l * 0.2, half * 0.96, -0.23, c.h * 0.36],
      [c.l * 0.36, half, -0.2, c.h * 0.4],
      [c.l * 0.5, half * 0.9, -0.15, c.h * 0.25],
    ]),
    paint,
    [0, 0, 0],
  );
  // Fastback canopy: an angled windscreen, real roofline, and tapered rear glass.
  const roofY = c.h * 0.35 + c.cabin;
  part(
    body,
    coachwork([
      [-c.l * 0.22, half * 0.71, c.h * 0.27, c.h * 0.35],
      [-c.l * 0.065, half * 0.58, c.h * 0.3, roofY],
      [c.l * 0.12, half * 0.59, c.h * 0.3, roofY],
      [c.l * 0.33, half * 0.73, c.h * 0.27, c.h * 0.35],
    ]),
    shared.glass,
    [0, 0, 0],
  );
  part(
    body,
    coachwork([
      [-c.l * 0.065, half * 0.57, roofY - 0.015, roofY + 0.025],
      [c.l * 0.11, half * 0.58, roofY - 0.015, roofY + 0.025],
    ]),
    paint,
    [0, 0, 0],
  );
  const skirtY = -0.2;
  for (const side of [-1, 1]) {
    part(
      body,
      geo.box,
      shared.carbon,
      [side * half * 0.96, skirtY, 0.08],
      [0.055, 0.08, c.l * 0.58],
    );
    // Pillars, flush door handles and compact wing mirrors.
    part(
      body,
      geo.box,
      shared.carbon,
      [side * half * 0.6, c.h * 0.36 + c.cabin * 0.48, c.l * 0.11],
      [0.035, c.cabin * 0.91, 0.055],
    );
    part(
      body,
      geo.box,
      shared.chrome,
      [side * half * 0.952, c.h * 0.22, c.l * 0.1],
      [0.018, 0.028, 0.19],
    );
    part(
      body,
      geo.sphere,
      paint,
      [side * half * 1.01, c.h * 0.4, -c.l * 0.11],
      [0.13, 0.065, 0.16],
    );
    if (c.wing)
      part(
        body,
        geo.box,
        shared.carbon,
        [side * half * 0.88, -0.02, c.l * 0.05],
        [0.035, 0.13, 0.34],
        [0, side * 0.17, 0],
      );
  }
  // Integrated splitters and a diffuser, with no oversized floating trim.
  part(
    body,
    geo.box,
    shared.carbon,
    [0, -0.17, -c.l * 0.495],
    [c.w * 0.89, 0.08, 0.24],
  );
  part(
    body,
    geo.box,
    shared.carbon,
    [0, -0.1, c.l * 0.49],
    [c.w * 0.75, 0.19, 0.1],
  );
  for (let i = -2; i <= 2; i++)
    part(
      body,
      geo.box,
      shared.carbon,
      [i * c.w * 0.11, -0.2, c.l * 0.49],
      [0.025, 0.11, 0.22],
    );
  const head = lightMaterial(0xe8fbff),
    rear = lightMaterial(0xff263f);
  const bumperZ = -c.l * 0.503;
  for (const side of [-1, 1]) {
    part(
      body,
      geo.box,
      shared.lampHousing,
      [side * c.w * 0.29, 0.025, bumperZ],
      [c.w * 0.25, 0.12, 0.065],
    );
    part(
      body,
      geo.box,
      head,
      [side * c.w * 0.29, 0.055, bumperZ - 0.035],
      [c.w * 0.22, 0.035, 0.035],
    );
    part(
      body,
      geo.box,
      head,
      [side * c.w * 0.39, 0.025, bumperZ - 0.034],
      [0.025, 0.075, 0.035],
    );
    part(
      body,
      geo.box,
      shared.lampHousing,
      [side * c.w * 0.28, 0.115, c.l * 0.49],
      [c.w * 0.25, 0.09, 0.045],
    );
    part(
      body,
      geo.box,
      rear,
      [side * c.w * 0.28, 0.13, c.l * 0.514],
      [c.w * 0.23, 0.038, 0.025],
    );
    part(
      body,
      geo.tire,
      shared.chrome,
      [side * c.w * 0.28, -0.12, c.l * 0.51],
      [0.075, 0.19, 0.075],
      [Math.PI / 2, 0, 0],
    );
    addNitro(root, data, side * c.w * 0.28, c.l * 0.55);
  }
  part(body, geo.box, rear, [0, 0.13, c.l * 0.514], [c.w * 0.38, 0.022, 0.025]);
  data.headLights.push(head);
  data.brakeLights.push(rear);
  if (c.wing) {
    const wingY = c.h * 0.34 + 0.21;
    part(
      body,
      geo.box,
      shared.carbon,
      [0, wingY, c.l * 0.4],
      [c.w * 0.88, 0.055, 0.24],
      [-0.08, 0, 0],
    );
    for (const side of [-1, 1])
      part(
        body,
        geo.box,
        shared.carbon,
        [side * c.w * 0.27, wingY - 0.12, c.l * 0.4],
        [0.035, 0.24, 0.05],
      );
  }
  if (spec.profile === "muscle") {
    for (const side of [-1, 1])
      part(
        body,
        geo.box,
        shared.carbon,
        [side * 0.16, c.h * 0.27, -c.l * 0.32],
        [0.12, 0.02, c.l * 0.23],
        [-0.075, 0, 0],
      );
  }
  for (const x of [-c.w * 0.45, c.w * 0.45]) {
    createWheel(root, x, -c.l * 0.29, radius, data, true, 0.28);
    createWheel(root, x, c.l * 0.3, radius, data, false, 0.31);
  }
  if (police) addPoliceBar(root, data, c.w);
}

function buildBike(root, spec, paint, data, police) {
  const profile = spec.profile || "sport";
  const radius = profile === "dirt" ? 0.55 : 0.47;
  const long = profile === "cruiser";
  const dirt = profile === "dirt";
  const frame = new THREE.Group();
  frame.position.y = 0.64;
  root.add(frame);

  const wheelBase = long ? 2.85 : dirt ? 2.55 : 2.48;
  const frontZ = -wheelBase * 0.52;
  const rearZ = wheelBase * 0.48;

  part(
    frame,
    geo.box,
    paint,
    [0, 0.36, -0.28],
    [0.74, 0.38, 0.86],
    [-0.12, 0, 0],
  );
  part(
    frame,
    geo.sphere,
    paint,
    [0, 0.43, -0.34],
    [0.48, 0.25, 0.62],
    [-0.18, 0, 0],
  );
  part(
    frame,
    geo.box,
    paint,
    [0, 0.46, -0.72],
    [0.52, 0.28, 0.58],
    [-0.3, 0, 0],
  );
  part(frame, geo.sphere, shared.carbon, [0, 0.18, 0.02], [0.34, 0.3, 0.34]);
  part(
    frame,
    geo.box,
    shared.carbon,
    [0, 0.26, 0.36],
    [0.58, 0.18, 0.95],
    [0.08, 0, 0],
  );
  part(
    frame,
    geo.box,
    shared.rubber,
    [0, 0.55, 0.42],
    [0.56, 0.14, 0.9],
    [-0.08, 0, 0],
  );
  part(
    frame,
    geo.box,
    shared.carbon,
    [0, 0.08, -0.02],
    [0.16, 0.16, wheelBase * 0.8],
    [0.08, 0, 0],
  );

  tube(
    frame,
    [-0.22, 0.12, -0.05],
    [0.035, 0.035, wheelBase * 0.66],
    shared.chrome,
    [Math.PI / 2, 0, 0.22],
  );
  tube(
    frame,
    [0.22, 0.12, -0.05],
    [0.035, 0.035, wheelBase * 0.66],
    shared.chrome,
    [Math.PI / 2, 0, -0.22],
  );
  tube(
    frame,
    [-0.18, 0.28, 0.15],
    [0.032, 0.032, wheelBase * 0.5],
    shared.chrome,
    [Math.PI / 2, 0, -0.38],
  );
  tube(
    frame,
    [0.18, 0.28, 0.15],
    [0.032, 0.032, wheelBase * 0.5],
    shared.chrome,
    [Math.PI / 2, 0, 0.38],
  );

  part(
    frame,
    geo.box,
    shared.glass,
    [0, 0.74, -0.92],
    [0.46, 0.18, 0.2],
    [-0.42, 0, 0],
  );
  part(
    frame,
    geo.box,
    paint,
    [0, 0.25, rearZ - 0.18],
    [0.54, 0.1, 0.72],
    [0.18, 0, 0],
  );
  part(
    frame,
    geo.sphere,
    paint,
    [0, 0.21, rearZ - 0.15],
    [0.42, 0.08, 0.58],
    [0.18, 0, 0],
  );
  part(
    frame,
    geo.box,
    paint,
    [0, 0.18, frontZ + 0.06],
    [0.5, 0.09, 0.62],
    [-0.18, 0, 0],
  );
  part(
    frame,
    geo.sphere,
    paint,
    [0, 0.2, frontZ + 0.08],
    [0.38, 0.07, 0.48],
    [-0.18, 0, 0],
  );

  const fork=new THREE.Group();fork.position.set(0,radius,frontZ);root.add(fork);
  const gripHeight=long?1.32:1.24;
  for(const side of [-1,1]) {
    const bottom=new THREE.Vector3(side*.17,0,0),top=new THREE.Vector3(side*.17,gripHeight-radius-.03,.56);
    const beam=part(fork,geo.tire,shared.chrome,[0,0,0],[.043,bottom.distanceTo(top),.043]);
    beam.position.copy(bottom).lerp(top,.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),top.clone().sub(bottom).normalize());
    part(fork,geo.sphere,shared.rubber,[side*.46,gripHeight-radius,.58],[.13,.045,.05]);
  }
  part(fork,geo.box,shared.chrome,[0,gripHeight-radius,.58],[1.02,.045,.055]);
  data.handlebars=fork;data.gripHeight=gripHeight;
  data.frontFork=createBikeWheel(root,0,frontZ,radius,data,true);
  createBikeWheel(root,0,rearZ,radius,data,false);
  createRider(frame,data,shared);

  const rearMat = lightMaterial(0xff233c);
  const headMat = lightMaterial(0xe4fbff);
  // Lamp lenses sit in housings attached to the fork and tail, not in space
  // ahead of the front wheel or above the rear fender.
  const lampY=gripHeight-radius-.20;
  part(fork, geo.box, shared.lampHousing, [0, lampY, .32], [.40, .17, .22]);
  part(fork, geo.box, headMat, [0, lampY, .195], [.32, .095, .035]);
  part(frame, geo.box, shared.lampHousing, [0, .24, rearZ + .16], [.45, .13, .18]);
  part(frame, geo.box, rearMat, [0, .24, rearZ + .26], [.36, .075, .035]);
  data.headLights.push(headMat);
  data.brakeLights.push(rearMat);

  tube(frame, [0.34, 0.08, rearZ + 0.25], [0.11, 0.11, 0.5], shared.chrome, [
    Math.PI / 2,
    0,
    0,
  ]);
  tube(frame, [-0.18, 0.14, 0.58], [0.08, 0.08, 0.35], shared.satin, [
    Math.PI / 2,
    0,
    0,
  ]);
  addNitro(root, data, 0.25, rearZ + 0.45);
  if (police) addPoliceBar(root, data, 0.8);
}

function createBikeWheel(parent, x, z, r, data, front) {
  const pivot = new THREE.Group();
  pivot.position.set(x, r, z);
  parent.add(pivot);
  const spin = new THREE.Group();
  pivot.add(spin);
  part(
    spin,
    geo.torus,
    shared.tire,
    [0, 0, 0],
    [r, r, 1.1],
    [0, Math.PI / 2, 0],
  );
  part(
    spin,
    geo.rim,
    shared.carbon,
    [0, 0, 0],
    [r * 1.07, 0.16, r * 1.07],
    [0, 0, Math.PI / 2],
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++)
      part(
        spin,
        geo.box,
        shared.chrome,
        [side * 0.09, 0, 0],
        [0.025, r * 1.45, 0.035],
        [(i * Math.PI) / 5, 0, 0],
      );
    part(
      spin,
      geo.rim,
      shared.chrome,
      [side * 0.1, 0, 0],
      [r * 0.2, 0.03, r * 0.2],
      [0, 0, Math.PI / 2],
    );
  }
  data.wheels.push({ pivot, spin, front, radius: r });
  return pivot;
}

function buildInterceptor(root, spec, paint, data, police) {
  const w = 2.48;
  const l = 5.18;
  const r = 0.58;
  const body = new THREE.Group();
  body.position.y = 0.82;
  root.add(body);
  data.body=body; data.bodyRest=body.position.y;

  part(body, geo.box, paint, [0, -0.04, 0], [w, 0.68, l]);
  part(body, geo.box, paint, [0, 0.42, 0.25], [w * 0.78, 0.68, l * 0.45]);
  part(
    body,
    geo.box,
    shared.carbon,
    [0, 0.04, -l * 0.48],
    [w * 0.94, 0.18, 0.34],
  );
  part(body, geo.box, shared.carbon, [0, 0.03, l * 0.5], [w * 0.98, 0.2, 0.24]);
  part(body, geo.box, shared.glass, [0, 0.74, 0.18], [w * 0.62, 0.34, 1.62]);
  part(
    body,
    geo.box,
    shared.carbon,
    [0, 0.34, -l * 0.33],
    [w * 0.48, 0.04, l * 0.22],
    [-0.08, 0, 0],
  );
  part(
    body,
    geo.box,
    shared.satin,
    [0, 0.22, -l * 0.55],
    [w * 0.62, 0.05, 0.06],
  );
  part(
    body,
    geo.box,
    shared.carbon,
    [-w * 0.54, 0.04, -0.05],
    [0.08, 0.26, l * 0.32],
  );
  part(
    body,
    geo.box,
    shared.carbon,
    [w * 0.54, 0.04, -0.05],
    [0.08, 0.26, l * 0.32],
  );

  for (const x of [-w * 0.45, w * 0.45]) {
    createWheel(root, x, -l * 0.29, r, data, true, 0.38);
    createWheel(root, x, l * 0.29, r, data, false, 0.4);
  }

  addCarLights(body, { w, l }, data);
  tube(body, [-w * 0.42, 0.05, -l * 0.56], [0.07, 0.07, 0.85], shared.chrome, [
    Math.PI / 2,
    0,
    0,
  ]);
  tube(body, [w * 0.42, 0.05, -l * 0.56], [0.07, 0.07, 0.85], shared.chrome, [
    Math.PI / 2,
    0,
    0,
  ]);
  addNitro(root, data, -0.42, l * 0.6);
  addNitro(root, data, 0.42, l * 0.6);

  if (spec.armed) {
    const turret = new THREE.Group();
    turret.position.set(0, 1.32, 0.08);
    root.add(turret);
    part(
      turret,
      geo.tire,
      shared.carbon,
      [0, 0, 0],
      [0.38, 0.24, 0.38],
      [0, 0, Math.PI / 2],
    );
    tube(turret, [-0.16, 0.04, -0.58], [0.045, 0.045, 1.1], shared.chrome, [
      Math.PI / 2,
      0,
      0,
    ]);
    tube(turret, [0.18, 0.12, -0.5], [0.075, 0.075, 0.92], shared.satin, [
      Math.PI / 2,
      0,
      0,
    ]);
    data.turret = turret;
  }

  if (police || spec.kind === "heavy") addPoliceBar(root, data, w);
}

function buildMonster(root, spec, paint, data, police) {
  const w = 2.95;
  const l = 5.25;
  const r = 0.82;
  const body = new THREE.Group();
  body.position.y = 1.34;
  root.add(body);
  data.body=body; data.bodyRest=body.position.y;

  part(body, geo.box, shared.carbon, [0, -0.42, 0], [w * 0.94, 0.32, l * 0.78]);
  part(body, geo.box, paint, [0, 0.02, -0.12], [w, 0.74, l * 0.7]);
  part(body, geo.box, paint, [0, 0.58, 0.18], [w * 0.68, 0.72, l * 0.36]);
  part(body, geo.box, shared.glass, [0, 0.82, -0.1], [w * 0.5, 0.36, 0.98]);
  part(
    body,
    geo.box,
    shared.carbon,
    [0, -0.1, -l * 0.54],
    [w * 1.08, 0.32, 0.32],
  );
  part(body, geo.box, shared.carbon, [0, -0.18, l * 0.52], [w, 0.25, 0.22]);

  for (const x of [-w * 0.55, w * 0.55]) {
    createWheel(root, x, -l * 0.32, r, data, true, 0.52);
    createWheel(root, x, l * 0.33, r, data, false, 0.55);
  }

  addCarLights(body, { w, l }, data);
  tube(
    body,
    [-w * 0.36, 0.78, 0.16],
    [0.055, 0.055, 1.4],
    shared.chrome,
    [0.42, 0, 0],
  );
  tube(
    body,
    [w * 0.36, 0.78, 0.16],
    [0.055, 0.055, 1.4],
    shared.chrome,
    [0.42, 0, 0],
  );
  addNitro(root, data, -0.36, l * 0.6);
  addNitro(root, data, 0.36, l * 0.6);

  if (police) addPoliceBar(root, data, w);
}

function addPoliceBar(root, data, w) {
  const bar = new THREE.Group();
  bar.position.set(0, 1.55, 0.08);
  root.add(bar);
  const blue = lightMaterial(0x1b7cff);
  const red = lightMaterial(0xff1945);
  part(bar, geo.box, blue, [-w * 0.17, 0, 0], [w * 0.28, 0.1, 0.24]);
  part(bar, geo.box, red, [w * 0.17, 0, 0], [w * 0.28, 0.1, 0.24]);
  data.police = [blue, red];
}

export function createVehicle(
  spec,
  color = spec.color || "#ff4b63",
  police = false,
) {
  const root = new THREE.Group();
  const data = {
    spec,
    wheels: [],
    flames: [],
    headLights: [],
    brakeLights: [],
    police: null,
    paint: null,
    handlebars: null,
    frontFork: null,
    turret: null,
    contactMinY: 0,
  };
  root.userData = data;

  const paint = paintMaterial(color);
  data.paint = paint;

  if (spec.asset === 'touring' && createTouring(root, data, paint, police)) {
    addNitro(root,data,-.62,2.25); addNitro(root,data,.62,2.25);
    if(police) addPoliceBar(root,data,2.05);
  }
  else if (spec.kind === "bike") buildBike(root, spec, paint, data, police);
  else if (spec.kind === "heavy")
    buildInterceptor(root, spec, paint, data, police);
  else if (spec.kind === "monster")
    buildMonster(root, spec, paint, data, police);
  else buildCar(root, spec, paint, data, police);

  const shadow = part(
    root,
    geo.shadow,
    shared.contactShadow,
    [0, 0.018, 0],
    spec.kind === "bike"
      ? [1.3, 3.3, 1]
      : spec.kind === "monster"
        ? [4.4, 6.3, 1]
        : [3.1, 5.6, 1],
    [-Math.PI / 2,0,0],
    false,
  );
  consolidateVehicle(root);

  root.userData.radius =
    spec.kind === "bike" ? 1.55 : spec.kind === "monster" ? 3.35 : 2.8;
  return root;
}

export function getVehicleGroundOffset(vehicle) {
  const contactMinY = vehicle.userData?.contactMinY;

  if (Number.isFinite(contactMinY)) {
    return -contactMinY * (vehicle.scale?.y || 1);
  }

  const bounds = new THREE.Box3().setFromObject(vehicle);
  return -bounds.min.y;
}

export function disposeVehicle(vehicle) {
  const geometries=new Set(), materials=new Set();
  vehicle.traverse(object=>{
    if(object.geometry?.userData?.disposeWithActor) geometries.add(object.geometry);
    for(const material of Array.isArray(object.material)?object.material:[object.material])
      if(material?.userData?.disposeWithActor) materials.add(material);
  });
  for(const geometry of geometries) geometry.dispose();
  for(const material of materials) material.dispose();
  vehicle.removeFromParent();
}

export function alignVehicleToSurface(vehicle, surfaceY = 0) {
  vehicle.position.y = surfaceY + getVehicleGroundOffset(vehicle);
  return vehicle.position.y;
}

export function animateVehicle(
  vehicle,
  speed,
  boosting,
  time,
  steering = 0,
  braking = false,
  drifting = false,
  dt = 1 / 60,
) {
  const d = vehicle.userData;

  for (const wheel of d.wheels) {
    wheel.spin.rotation.x = (wheel.spin.rotation.x - speed * dt / (wheel.radius || .47)) % (Math.PI * 2);
    if (wheel.front) {
      wheel.pivot.rotation.y = THREE.MathUtils.lerp(
        wheel.pivot.rotation.y,
        steering * (.48 - Math.min(.24, Math.abs(speed) * .004)),
        1 - Math.pow(0.8, dt * 60),
      );
    }
  }

  if (d.handlebars && d.frontFork) d.handlebars.rotation.y=d.frontFork.rotation.y;
  updateRider(d,speed,steering,boosting,dt);
  if (d.turret)
    d.turret.rotation.y = THREE.MathUtils.lerp(
      d.turret.rotation.y,
      steering * 0.22,
      -Math.expm1(-5*dt),
    );

  if (d.spec.kind === 'bike') {
    vehicle.rotation.z = damp(vehicle.rotation.z, -steering * .38 * Math.min(1, Math.abs(speed) / 14), 7, dt);
  } else if (d.body) {
    const acceleration = d.acceleration ?? (speed - (d.previousSpeed ?? speed)) / Math.max(.001,dt);
    const pitchTarget = THREE.MathUtils.clamp(-acceleration * .0018, -.045, .045);
    const rollTarget = THREE.MathUtils.clamp(-steering * Math.abs(speed) * .0025, -.085, .085);
    [d.body.rotation.x, d.pitchVelocity] = spring(d.body.rotation.x, d.pitchVelocity || 0, pitchTarget, 12, dt);
    [d.body.rotation.z, d.rollVelocity] = spring(d.body.rotation.z, d.rollVelocity || 0, rollTarget, 10, dt);
    d.body.position.y = d.bodyRest + Math.sin(time * 14) * Math.min(.005, Math.abs(speed) * .00012);
    for(const body of d.bodies || []) if(body!==d.body) {
      body.position.copy(d.body.position);body.quaternion.copy(d.body.quaternion);
    }
  }
  d.previousSpeed = speed;

  for (const light of d.headLights) light.color.setHex(0xe8fbff);
  for (const light of d.brakeLights) {
    light.color.setHex(braking ? 0xff4540 : 0xc01825);
    if(light.emissive) light.emissiveIntensity = braking ? 3 : .8;
  }

  for (const flame of d.flames) {
    flame.visible = boosting;
    flame.scale.setScalar(boosting ? 0.75 + Math.sin(time * 38) * 0.27 : 0.01);
  }

  if (d.police) {
    d.police.forEach((m, i) =>
      m.color.setHex(
        Math.floor(time * 8 + i) % 2 ? (i ? 0xff163c : 0x1678ff) : 0x07111f,
      ),
    );
  }

  vehicle.userData.drifting = drifting;
}

export function setVehicleColor(vehicle, color) {
  const paint = vehicle.userData.paint;
  if (paint) {
    paint.color.set(color);
    paint.emissive.set(color);
  }
}
