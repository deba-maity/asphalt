import * as THREE from "three";

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tire: new THREE.CylinderGeometry(1, 1, 1, 22),
  rim: new THREE.CylinderGeometry(0.68, 0.68, 1.02, 18),
  disc: new THREE.CylinderGeometry(0.74, 0.74, 0.05, 18),
  torus: new THREE.TorusGeometry(1, 0.075, 8, 22),
  flame: new THREE.ConeGeometry(0.18, 0.72, 10),
  sphere: new THREE.SphereGeometry(1, 16, 10),
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
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x0c1b26,
    metalness: 0.18,
    roughness: 0.05,
    transmission: 0.04,
    transparent: true,
    opacity: 0.86,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
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
  parent.add(mesh);
  return mesh;
}

function paintMaterial(color) {
  return owned(
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.72,
      roughness: 0.24,
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
  return part(parent, geo.tire, material, position, scale, rotation);
}

function createWheel(parent, x, z, radius, data, front = false, width = 0.34) {
  const pivot = new THREE.Group();
  pivot.position.set(x, radius, z);
  parent.add(pivot);

  const spin = new THREE.Group();
  pivot.add(spin);

  part(spin, geo.tire, shared.tire, [0, 0, 0], [radius, width, radius], [
    0,
    0,
    Math.PI / 2,
  ]);
  part(
    spin,
    geo.rim,
    shared.rim,
    [0, 0, 0],
    [radius * 0.63, width * 1.1, radius * 0.63],
    [0, 0, Math.PI / 2],
  );
  part(
    spin,
    geo.disc,
    shared.brake,
    [x > 0 ? -width * 1.13 : width * 1.13, 0, 0],
    [radius * 0.58, width * 1.5, radius * 0.58],
    [0, 0, Math.PI / 2],
  );
  part(
    parent,
    geo.torus,
    shared.rubber,
    [x, radius + 0.04, z],
    [radius * 1.13, radius * 1.13, 1],
    [0, Math.PI / 2, 0],
  );

  data.wheels.push({ pivot, spin, front });
}

function addCarLights(body, c, data) {
  const headMat = lightMaterial(0xe8fbff);
  const rearMat = lightMaterial(0xff263f);

  for (const x of [-c.w * 0.28, c.w * 0.28]) {
    part(body, geo.box, shared.lampHousing, [x, 0.03, -c.l * 0.5 - 0.02], [
      c.w * 0.25,
      0.18,
      0.08,
    ]);
    part(body, geo.box, headMat, [x, 0.05, -c.l * 0.505], [
      c.w * 0.2,
      0.07,
      0.035,
    ]);
    part(body, geo.box, rearMat, [x * 1.18, 0.12, c.l * 0.49], [
      c.w * 0.22,
      0.11,
      0.045,
    ]);
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

function buildCar(root, spec, paint, data, police) {
  const profiles = {
    coupe: { w: 2.05, l: 4.75, h: 0.62, cabin: 0.55, nose: 0.18, wing: false },
    muscle: { w: 2.24, l: 4.95, h: 0.72, cabin: 0.5, nose: 0.03, wing: false },
    super: { w: 2.16, l: 4.9, h: 0.54, cabin: 0.43, nose: -0.05, wing: true },
    hyper: { w: 2.2, l: 5.05, h: 0.5, cabin: 0.38, nose: -0.14, wing: true },
    rally: { w: 2.16, l: 4.58, h: 0.86, cabin: 0.56, nose: 0.1, wing: true },
  };

  const c = profiles[spec.profile] || profiles.coupe;
  const wheelRadius = spec.profile === "rally" ? 0.56 : 0.5;
  const body = new THREE.Group();
  body.position.y = wheelRadius + c.h * 0.45;
  root.add(body);

  part(body, geo.box, paint, [0, 0, c.nose], [c.w, c.h, c.l * 0.78]);
  part(body, geo.box, paint, [0, 0.1, -c.l * 0.24], [
    c.w * 0.82,
    c.h * 0.42,
    c.l * 0.42,
  ], [-0.07, 0, 0]);
  part(body, geo.box, paint, [0, -0.05, c.l * 0.36], [
    c.w * 0.94,
    c.h * 0.55,
    c.l * 0.26,
  ]);
  part(body, geo.box, shared.carbon, [0, -0.28, -c.l * 0.32], [
    c.w * 0.96,
    0.14,
    c.l * 0.28,
  ]);
  part(body, geo.box, shared.carbon, [0, -0.24, c.l * 0.47], [
    c.w * 0.88,
    0.18,
    c.l * 0.1,
  ]);
  part(body, geo.box, shared.carbon, [-c.w * 0.52, -0.13, 0.06], [
    0.08,
    0.18,
    c.l * 0.64,
  ]);
  part(body, geo.box, shared.carbon, [c.w * 0.52, -0.13, 0.06], [
    0.08,
    0.18,
    c.l * 0.64,
  ]);
  part(body, geo.box, shared.carbon, [0, c.h * 0.36, -c.l * 0.32], [
    c.w * 0.42,
    0.035,
    c.l * 0.22,
  ], [-0.12, 0, 0]);
  part(body, geo.box, shared.satin, [0, c.h * 0.24, -c.l * 0.48], [
    c.w * 0.62,
    0.045,
    0.055,
  ]);
  part(body, geo.box, shared.carbon, [-c.w * 0.56, 0.02, -c.l * 0.02], [
    0.06,
    c.h * 0.3,
    c.l * 0.28,
  ], [0, 0, -0.04]);
  part(body, geo.box, shared.carbon, [c.w * 0.56, 0.02, -c.l * 0.02], [
    0.06,
    c.h * 0.3,
    c.l * 0.28,
  ], [0, 0, 0.04]);

  part(body, geo.box, shared.glass, [0, c.cabin, -c.l * 0.02], [
    c.w * 0.58,
    c.h * 0.55,
    c.l * 0.32,
  ], [-0.05, 0, 0]);
  part(body, geo.box, shared.glass, [0, c.cabin * 0.94, c.l * 0.18], [
    c.w * 0.5,
    c.h * 0.48,
    c.l * 0.18,
  ], [0.12, 0, 0]);
  part(body, geo.box, shared.satin, [0, c.cabin + 0.02, -c.l * 0.22], [
    c.w * 0.5,
    0.035,
    0.055,
  ], [-0.05, 0, 0]);
  part(body, geo.box, shared.satin, [0, c.cabin * 0.84, c.l * 0.3], [
    c.w * 0.42,
    0.03,
    0.05,
  ], [0.1, 0, 0]);

  part(body, geo.box, shared.carbon, [-c.w * 0.58, c.cabin * 0.75, -0.12], [
    0.12,
    0.08,
    0.2,
  ]);
  part(body, geo.box, shared.carbon, [c.w * 0.58, c.cabin * 0.75, -0.12], [
    0.12,
    0.08,
    0.2,
  ]);

  if (c.wing) {
    part(body, geo.box, shared.carbon, [0, c.cabin + 0.17, c.l * 0.43], [
      c.w * 0.64,
      0.07,
      0.22,
    ]);
    part(body, geo.box, shared.carbon, [-c.w * 0.36, c.cabin, c.l * 0.43], [
      0.05,
      0.28,
      0.05,
    ]);
    part(body, geo.box, shared.carbon, [c.w * 0.36, c.cabin, c.l * 0.43], [
      0.05,
      0.28,
      0.05,
    ]);
  }

  for (const x of [-c.w * 0.46, c.w * 0.46]) {
    createWheel(root, x, -c.l * 0.3, wheelRadius, data, true, 0.34);
    createWheel(root, x, c.l * 0.31, wheelRadius, data, false, 0.36);
  }

  addCarLights(body, c, data);

  for (const x of [-c.w * 0.26, c.w * 0.26]) {
    tube(body, [x, -0.12, c.l * 0.53], [0.11, 0.11, 0.36], shared.chrome, [
      Math.PI / 2,
      0,
      0,
    ]);
    addNitro(root, data, x, c.l * 0.59);
  }

  if (police) addPoliceBar(root, data, c.w);
}

function addBikeRider(frame, profile, paint) {
  const long = profile === "cruiser";
  const dirt = profile === "dirt";
  const lean = long ? -0.22 : dirt ? -0.36 : -0.48;
  const hipZ = long ? 0.54 : 0.38;

  part(frame, geo.sphere, shared.riderSuit, [0, 0.78, hipZ], [0.34, 0.24, 0.32]);
  part(frame, geo.box, shared.riderSuit, [0, 1.12, hipZ - 0.26], [0.54, 0.72, 0.26], [
    lean,
    0,
    0,
  ]);
  part(frame, geo.sphere, shared.riderArmor, [0, 1.52, hipZ - 0.72], [0.33, 0.35, 0.36], [
    lean * 0.28,
    0,
    0,
  ]);
  part(frame, geo.box, shared.glass, [0, 1.49, hipZ - 1.03], [0.46, 0.1, 0.08], [
    lean * 0.2,
    0,
    0,
  ]);
  part(frame, geo.box, paint, [0, 1.28, hipZ - 0.48], [0.44, 0.08, 0.09], [
    lean,
    0,
    0,
  ]);

  for (const side of [-1, 1]) {
    part(frame, geo.box, shared.riderSuit, [side * 0.27, 1.02, hipZ - 0.64], [0.11, 0.12, 0.86], [
      -0.92,
      side * 0.08,
      side * 0.18,
    ]);
    part(frame, geo.sphere, shared.riderArmor, [side * 0.42, 0.82, hipZ - 1.02], [0.11, 0.1, 0.11]);
    part(frame, geo.box, shared.riderSuit, [side * 0.26, 0.55, hipZ + 0.08], [0.13, 0.62, 0.14], [
      0.42,
      0,
      side * 0.12,
    ]);
    part(frame, geo.box, shared.riderArmor, [side * 0.28, 0.38, hipZ - 0.36], [0.12, 0.13, 0.58], [
      -0.74,
      0,
      side * 0.08,
    ]);
    part(frame, geo.box, shared.rubber, [side * 0.27, 0.26, hipZ - 0.7], [0.17, 0.11, 0.31], [
      -0.62,
      0,
      side * 0.06,
    ]);
  }
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

  part(frame, geo.box, paint, [0, 0.36, -0.28], [0.74, 0.38, 0.86], [-0.12, 0, 0]);
  part(frame, geo.sphere, paint, [0, 0.43, -0.34], [0.48, 0.25, 0.62], [-0.18, 0, 0]);
  part(frame, geo.box, paint, [0, 0.46, -0.72], [0.52, 0.28, 0.58], [-0.3, 0, 0]);
  part(frame, geo.sphere, shared.carbon, [0, 0.18, 0.02], [0.34, 0.3, 0.34]);
  part(frame, geo.box, shared.carbon, [0, 0.26, 0.36], [0.58, 0.18, 0.95], [0.08, 0, 0]);
  part(frame, geo.box, shared.rubber, [0, 0.55, 0.42], [0.56, 0.14, 0.9], [-0.08, 0, 0]);
  part(frame, geo.box, shared.carbon, [0, 0.08, -0.02], [0.16, 0.16, wheelBase * 0.8], [
    0.08,
    0,
    0,
  ]);
  addBikeRider(frame, profile, paint);

  tube(frame, [-0.22, 0.12, -0.05], [0.035, 0.035, wheelBase * 0.66], shared.chrome, [
    Math.PI / 2,
    0,
    0.22,
  ]);
  tube(frame, [0.22, 0.12, -0.05], [0.035, 0.035, wheelBase * 0.66], shared.chrome, [
    Math.PI / 2,
    0,
    -0.22,
  ]);
  tube(frame, [-0.18, 0.28, 0.15], [0.032, 0.032, wheelBase * 0.5], shared.chrome, [
    Math.PI / 2,
    0,
    -0.38,
  ]);
  tube(frame, [0.18, 0.28, 0.15], [0.032, 0.032, wheelBase * 0.5], shared.chrome, [
    Math.PI / 2,
    0,
    0.38,
  ]);

  part(frame, geo.box, shared.glass, [0, 0.74, -0.92], [0.46, 0.18, 0.2], [
    -0.42,
    0,
    0,
  ]);
  part(frame, geo.box, paint, [0, 0.25, rearZ - 0.18], [0.54, 0.1, 0.72], [
    0.18,
    0,
    0,
  ]);
  part(frame, geo.sphere, paint, [0, 0.21, rearZ - 0.15], [0.42, 0.08, 0.58], [
    0.18,
    0,
    0,
  ]);
  part(frame, geo.box, paint, [0, 0.18, frontZ + 0.06], [0.5, 0.09, 0.62], [
    -0.18,
    0,
    0,
  ]);
  part(frame, geo.sphere, paint, [0, 0.2, frontZ + 0.08], [0.38, 0.07, 0.48], [
    -0.18,
    0,
    0,
  ]);

  const fork = new THREE.Group();
  fork.position.set(0, 0.22, frontZ);
  fork.rotation.x = long ? -0.12 : -0.3;
  root.add(fork);
  tube(fork, [-0.2, 0.15, 0], [0.055, 0.055, 1.15], shared.chrome, [
    0.18,
    0,
    0,
  ]);
  tube(fork, [0.2, 0.15, 0], [0.055, 0.055, 1.15], shared.chrome, [
    0.18,
    0,
    0,
  ]);
  part(fork, geo.box, shared.chrome, [0, 0.74, -0.12], [0.95, 0.06, 0.08]);
  part(fork, geo.box, shared.rubber, [-0.52, 0.75, -0.12], [0.22, 0.08, 0.09]);
  part(fork, geo.box, shared.rubber, [0.52, 0.75, -0.12], [0.22, 0.08, 0.09]);
  data.handlebars = fork;

  data.frontFork = createBikeWheel(root, 0, frontZ, radius, data, true);
  createBikeWheel(root, 0, rearZ, radius, data, false);

  const rearMat = lightMaterial(0xff233c);
  const headMat = lightMaterial(0xe4fbff);
  part(frame, geo.box, headMat, [0, 0.66, frontZ - 0.14], [0.36, 0.1, 0.06]);
  part(frame, geo.box, rearMat, [0, 0.42, rearZ + 0.38], [0.42, 0.09, 0.06]);
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
  part(spin, geo.torus, shared.tire, [0, 0, 0], [r, r, 1.25], [0, Math.PI / 2, 0]);
  part(spin, geo.rim, shared.rim, [0, 0, 0], [r * 0.62, 0.18, r * 0.62], [
    0,
    0,
    Math.PI / 2,
  ]);
  for (let i = 0; i < 5; i++) {
    part(
      spin,
      geo.box,
      shared.chrome,
      [0, 0, 0],
      [r * 1.06, 0.035, 0.035],
      [0, 0, (i * Math.PI) / 5],
    );
  }
  data.wheels.push({ pivot, spin, front });
  return pivot;
}

function buildInterceptor(root, spec, paint, data, police) {
  const w = 2.48;
  const l = 5.18;
  const r = 0.58;
  const body = new THREE.Group();
  body.position.y = 0.82;
  root.add(body);

  part(body, geo.box, paint, [0, -0.04, 0], [w, 0.68, l]);
  part(body, geo.box, paint, [0, 0.42, 0.25], [w * 0.78, 0.68, l * 0.45]);
  part(body, geo.box, shared.carbon, [0, 0.04, -l * 0.48], [w * 0.94, 0.18, 0.34]);
  part(body, geo.box, shared.carbon, [0, 0.03, l * 0.5], [w * 0.98, 0.2, 0.24]);
  part(body, geo.box, shared.glass, [0, 0.74, 0.18], [w * 0.62, 0.34, 1.62]);
  part(body, geo.box, shared.carbon, [0, 0.34, -l * 0.33], [
    w * 0.48,
    0.04,
    l * 0.22,
  ], [-0.08, 0, 0]);
  part(body, geo.box, shared.satin, [0, 0.22, -l * 0.55], [
    w * 0.62,
    0.05,
    0.06,
  ]);
  part(body, geo.box, shared.carbon, [-w * 0.54, 0.04, -0.05], [
    0.08,
    0.26,
    l * 0.32,
  ]);
  part(body, geo.box, shared.carbon, [w * 0.54, 0.04, -0.05], [
    0.08,
    0.26,
    l * 0.32,
  ]);

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
    part(turret, geo.tire, shared.carbon, [0, 0, 0], [0.38, 0.24, 0.38], [
      0,
      0,
      Math.PI / 2,
    ]);
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

  part(body, geo.box, shared.carbon, [0, -0.42, 0], [w * 0.94, 0.32, l * 0.78]);
  part(body, geo.box, paint, [0, 0.02, -0.12], [w, 0.74, l * 0.7]);
  part(body, geo.box, paint, [0, 0.58, 0.18], [w * 0.68, 0.72, l * 0.36]);
  part(body, geo.box, shared.glass, [0, 0.82, -0.1], [w * 0.5, 0.36, 0.98]);
  part(body, geo.box, shared.carbon, [0, -0.1, -l * 0.54], [w * 1.08, 0.32, 0.32]);
  part(body, geo.box, shared.carbon, [0, -0.18, l * 0.52], [w, 0.25, 0.22]);

  for (const x of [-w * 0.55, w * 0.55]) {
    createWheel(root, x, -l * 0.32, r, data, true, 0.52);
    createWheel(root, x, l * 0.33, r, data, false, 0.55);
  }

  addCarLights(body, { w, l }, data);
  tube(body, [-w * 0.36, 0.78, 0.16], [0.055, 0.055, 1.4], shared.chrome, [
    0.42,
    0,
    0,
  ]);
  tube(body, [w * 0.36, 0.78, 0.16], [0.055, 0.055, 1.4], shared.chrome, [
    0.42,
    0,
    0,
  ]);
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

export function createVehicle(spec, color = spec.color || "#ff4b63", police = false) {
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

  if (spec.kind === "bike") buildBike(root, spec, paint, data, police);
  else if (spec.kind === "heavy") buildInterceptor(root, spec, paint, data, police);
  else if (spec.kind === "monster") buildMonster(root, spec, paint, data, police);
  else buildCar(root, spec, paint, data, police);

  part(
    root,
    geo.box,
    owned(
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: spec.kind === "bike" ? 0.22 : 0.3,
        depthWrite: false,
      }),
    ),
    [0, 0.035, 0],
    spec.kind === "bike"
      ? [0.9, 0.01, 2.8]
      : spec.kind === "monster"
        ? [3.7, 0.01, 5.6]
        : [2.35, 0.01, 5.0],
    undefined,
    false,
  );

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
) {
  const d = vehicle.userData;
  const spin = speed * 0.095;

  for (const wheel of d.wheels) {
    wheel.spin.rotation.x -= spin;
    if (wheel.front) {
      wheel.pivot.rotation.y = THREE.MathUtils.lerp(
        wheel.pivot.rotation.y,
        steering * 0.48,
        0.2,
      );
    }
  }

  if (d.handlebars) d.handlebars.rotation.y = steering * 0.45;
  if (d.frontFork) d.frontFork.rotation.y = steering * 0.36;
  if (d.turret) d.turret.rotation.y = THREE.MathUtils.lerp(d.turret.rotation.y, steering * 0.22, 0.08);

  vehicle.rotation.z = THREE.MathUtils.lerp(
    vehicle.rotation.z,
    d.spec.kind === "bike" ? -steering * 0.31 : -steering * 0.1,
    0.11,
  );

  for (const light of d.headLights) light.color.setHex(0xe8fbff);
  for (const light of d.brakeLights) {
    light.color.setHex(braking ? 0xffedf0 : 0xff263f);
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
