import * as THREE from "three";
import { consolidateVehicle } from "./rendering.js";
import { createTouring } from "./touring.js";
import { damp, spring } from "./timing.js";
import { sportsShell, fasciaStrip, registrationPlate, rearWing } from "./sports-body.js";
import { wheelArt } from "./wheel-art.js";
import { createRider, updateRider } from "./rider.js";

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  tire: new THREE.CylinderGeometry(1, 1, 1, 22),
  distantTyre: new THREE.CylinderGeometry(1, 1, 1, 10),
  rim: new THREE.CylinderGeometry(0.68, 0.68, 1.02, 18),
  torus: new THREE.TorusGeometry(.87, .13, 10, 28),
  flame: new THREE.ConeGeometry(0.18, 0.72, 10),
  sphere: new THREE.SphereGeometry(1, 16, 10),
  shadow: new THREE.PlaneGeometry(1, 1),
  exhaustRim: new THREE.TorusGeometry(1, .115, 7, 22),
  exhaustBore: new THREE.CircleGeometry(1, 22),
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
  plate: registrationPlate(),
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
shared.exhaustFlame = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: "varying float along; void main(){along=clamp(position.y/.72+.5,0.,1.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: [
    "varying float along; void main(){",
    "vec3 hot=mix(vec3(.86,.93,1.),vec3(.09,.60,1.),smoothstep(.02,.45,along));",
    "vec3 flame=mix(hot,vec3(.32,.14,.80),smoothstep(.45,.95,along));",
    "gl_FragColor=vec4(flame,.85*(1.-smoothstep(.15,1.,along)));",
    "#include <colorspace_fragment>",
    "}"
  ].join("\n")
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

  part(spin, wheelArt.tyre, shared.tire, [0,0,0], [width,radius,radius]);
  part(spin, wheelArt.barrel, shared.rim, [0,0,0], [width,radius,radius]);
  const side = Math.sign(x) || 1;
  part(spin, wheelArt.rotor, shared.satin, [side*width*.25,0,0], [width,radius,radius]);
  part(spin, wheelArt.spokes, shared.rim, [side*width*.46,0,0], [radius,radius,radius], [0,side<0?Math.PI:0,0]);
  part(spin, geo.tire, shared.satin, [side*width*.50,0,0], [radius*.163,.040,radius*.163], [0,0,Math.PI/2]);
  // The caliper is attached to the steering upright. Only the rotor,
  // spokes and tyre should spin as a vehicle pulls away.
  part(pivot, geo.box, shared.brake, [side*width*.32,radius*.20,radius*.47],
    [width*.20,radius*.46,radius*.19], [-.34,0,0]);
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
  const material = shared.exhaustFlame;
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
  flame.userData.nozzleZ = z;
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
    coupe: { w: 2.05, l: 4.75, h: .62, cabin: .57, glass: [-.23,-.073,.132,.325], nose: .05, wing: false },
    muscle: { w: 2.24, l: 4.95, h: .72, cabin: .55, glass: [-.146,-.014,.169,.346], nose: .125, wing: false },
    super: { w: 2.28, l: 5.08, h: .52, cabin: .53, glass: [-.277,-.105,.083,.261], nose: .036, wing: true },
    hyper: { w: 2.42, l: 5.32, h: .46, cabin: .48, glass: [-.302,-.130,.059,.251], nose: .027, wing: true },
    rally: { w: 2.16, l: 4.58, h: .86, cabin: .68, glass: [-.255,-.138,.228,.331], nose: .142, wing: true },
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
    sportsShell(c, radius),
    paint,
    [0, 0, 0],
  );
  // Fastback canopy: an angled windscreen, real roofline, and tapered rear glass.
  const roofY = c.h * 0.35 + c.cabin;
  const [windshield, roofFront, roofBack, liftgate] = c.glass.map(ratio => ratio * c.l);
  part(
    body,
    coachwork([
      [windshield, half * .73, c.h * .27, c.h * .39],
      [roofFront, half * .60, c.h * .30, roofY],
      [roofBack, half * .615, c.h * .30, roofY],
      [liftgate, half * .73, c.h * .27, c.h * .39],
    ]),
    shared.glass,
    [0, 0, 0],
  );
  part(
    body,
    coachwork([
      [roofFront, half * .50, roofY - .012, roofY + .018],
      [roofFront + .10, half * .53, roofY - .010, roofY + .029],
      [roofBack - .09, half * .54, roofY - .010, roofY + .028],
      [roofBack, half * .505, roofY - .012, roofY + .016],
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
    const brace = (from, to, width, mat) => {
      const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
      const length = a.distanceTo(b), rotation = b.clone().sub(a).normalize();
      const piece = part(body, geo.box, mat, a.lerp(b, .5).toArray(), [width,length,width*.91]);
      piece.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), rotation);
    };
    brace([side*half*.717, c.h*.394, windshield], [side*half*.497, roofY+.002, roofFront+.012], .045, paint);
    brace([side*half*.713, c.h*.394, liftgate], [side*half*.506, roofY+.002, roofBack-.015],
      spec.profile === "rally" ? .112 : .073, paint);
    const post = roofFront + (roofBack-roofFront)*.73;
    brace([side*half*.607, c.h*.39, post+.035], [side*half*.524, roofY-.006,post], .035,shared.carbon);
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
      [side * half * 1.01, c.h * 0.45, windshield + .24],
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
  addSportsNose(body, c, spec.profile, head);
  addSportsTail(body, root, c, spec.profile, data, rear);
  data.headLights.push(head);
  data.brakeLights.push(rear);
  if (c.wing) {
    const height = c.h * .34 + .23;
    const wing = new THREE.Group();
    wing.position.set(0, height, c.l * .38);
    body.add(wing);
    part(wing, rearWing(c.w * .88, .31), shared.carbon, [0, 0, 0]);
    for (const side of [-1, 1]) {
      part(body, geo.box, shared.carbon, [side * c.w * .27, height - .12, c.l * .38 + .06], [.044, .25, .094], [.16, 0, 0]);
      part(wing, geo.box, shared.carbon, [side * c.w * .44, .028, .18], [.036, .13, .26], [-.12, 0, 0]);
    }
    if (spec.profile === "hyper" || spec.profile === "super") data.activeWing = wing;
  }
  if (spec.profile === "rally") {
    const scoop = roofFront + (roofBack - roofFront) * .32;
    part(body,coachwork([[scoop-.19,.18,roofY+.012,roofY+.112],[scoop+.17,.15,roofY+.012,roofY+.061]]),paint,[0,0,0]);
    part(body,geo.box,shared.carbon,[0,roofY+.073,scoop-.194],[.271,.051,.01]);
    for (const side of [-1,1]) {
      part(body,geo.sphere,shared.lampHousing,[side*.22,.064,-c.l*.520],[.116,.116,.076]);
      part(body,geo.sphere,head,[side*.22,.066,-c.l*.528],[.082,.082,.040]);
    }
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
  installDistantCar(root, data, c, radius, paint, head, rear);
  if (police) addPoliceBar(root, data, c.w);
}

function installDistantCar(root, data, c, radius, paint, head, rear) {
  // At street distances keep the original footprint, silhouette, suspension
  // and signal colours. Hidden, high-detail wheel assemblies need no draw.
  const near = new THREE.Group(), far = new THREE.Group();
  near.add(...root.children.filter(child => !data.flames.includes(child)));
  const shell = new THREE.Group();
  shell.position.copy(data.body.position);
  far.add(shell);
  const half = c.w / 2, roof = c.h * .35 + c.cabin;
  part(shell, coachwork([
    [-c.l*.52, half*.81, -.17, .039],[-c.l*.31, half*.99, -.21, c.h*.47],
    [c.l*.30, half, -.21, c.h*.50],[c.l*.5, half*.89, -.14, c.h*.29],
  ]), paint, [0,0,0]);
  part(shell, coachwork([
    [c.l*c.glass[0],half*.72,c.h*.32,c.h*.40],[c.l*c.glass[1],half*.60,c.h*.35,roof],
    [c.l*c.glass[2],half*.615,c.h*.35,roof],[c.l*c.glass[3],half*.71,c.h*.32,c.h*.40],
  ]), shared.glass, [0,0,0]);
  part(shell, geo.box, paint, [0,roof+.006,c.l*(c.glass[1]+c.glass[2])*.5],[c.w*.52,.031,c.l*(c.glass[2]-c.glass[1])]);
  if (c.wing) part(shell, geo.box, shared.carbon,[0,c.h*.34+.24,c.l*.41],[c.w*.87,.042,.29]);
  for (const side of [-1,1]) {
    part(shell, geo.box,head,[side*c.w*.32,.016,-c.l*.521],[c.w*.19,.033,.028]);
    part(shell, geo.box,rear,[side*c.w*.32,.039,c.l*.503],[c.w*.19,.054,.03]);
    for (const z of [-c.l*.29,c.l*.30]) {
      const mount = side*c.w*.45;
      part(far,geo.distantTyre,shared.tire,[mount,radius,z],[radius,.30,radius],[0,0,Math.PI/2]);
      part(far,geo.distantTyre,shared.rim,[mount+side*.154,radius,z],[radius*.70,.021,radius*.70],[0,0,Math.PI/2]);
    }
  }
  data.bodies = [data.body,shell];
  const lod = new THREE.LOD();
  lod.name = "Street vehicle detail";
  lod.addLevel(near,0);
  lod.addLevel(far,42,.15);
  root.add(lod);
}

function addSportsNose(body, config, profile, lamp) {
  const half = config.w * .5, nose = config.l * .52;
  function band(material, line) {
    const points = line.slice().sort((a,b) => a[0] - b[0])
      .map(([x,y,offset,height]) => [half*x,y,nose+offset,height]);
    part(body, fasciaStrip(points, .012), material, [0,0,0], [1,1,1], [0,Math.PI,0]);
  }
  const muscle = profile === "muscle";
  const leftEdge = muscle ? .60 : .47;
  band(shared.carbon, [
    [-leftEdge,-.065,.009,.050],[-.32,-.087,.012,.103],[.32,-.087,.012,.103],[leftEdge,-.065,.009,.050]
  ]);
  for (const height of [-.107,-.076]) {
    band(shared.lampHousing,[[-.37,height,.024,.009],[0,height-.003,.025,.009],[.37,height,.024,.009]]);
  }
  for (const side of [-1,1]) {
    const sideBand = (material,line) => band(material,line.map(([x,y,z,h])=>[x*side,y,z,h]));
    sideBand(shared.lampHousing,[[.50,.003,.014,.064],[.73,.013,.017,.087],[.80,.026,-.015,.074],[.90,.066,-.233,.039]]);
    sideBand(lamp,[[.53,.020,.030,.016],[.73,.042,.033,.022],[.80,.051,-.004,.025],[.89,.077,-.213,.012]]);
    if (muscle || profile === "rally") {
      for (const x of [.60,.70]) sideBand(lamp,[[x-.018,-.001,.034,.031],[x+.018,.002,.034,.029]]);
    } else {
      sideBand(lamp,[[.69,-.003,.034,.014],[.75,.000,.032,.017],[.79,.015,.002,.012]]);
    }
    sideBand(shared.carbon,[[.595,-.102,.013,.056],[.72,-.094,.013,.086],[.81,-.068,-.032,.062]]);
    sideBand(shared.satin,[[.64,-.093,.025,.008],[.72,-.084,.024,.010],[.79,-.069,-.012,.008]]);
  }
}

function addSportsTail(body, root, config, profile, data, rearLight) {
  const { w, l, h } = config;
  const bumper = l * .50, half = w / 2;
  function strip(material, layout, depth = .02) {
    const ordered = layout.slice().sort((a, b) => a[0] - b[0]);
    const points = ordered.map(([x, y, inset, height]) => [x * half, y, bumper + inset, height]);
    part(body, fasciaStrip(points, depth), material, [0, 0, 0]);
  }
  strip(shared.lampHousing, [
    [-.91,.022,-.055,.108],[-.82,.039,.024,.17],[-.53,.013,.032,.14],
    [-.23,-.011,.034,.12],[.23,-.011,.034,.12],[.53,.013,.032,.14],[.82,.039,.024,.17],[.91,.022,-.055,.108],
  ]);
  for (const side of [-1, 1]) {
    const line = layout => strip(rearLight, layout.map(([x,y,z,height]) => [side*x,y,z,height]), .009);
    if (profile === "muscle") {
      for (let i=0; i<3; i++) {
        const x=.43+i*.147;
        line([[x,.020,.047,.102],[x+.072,.028,.047,.103]]);
      }
    } else if (profile === "rally") {
      line([[.40,.044,.049,.064],[.77,.049,.048,.078],[.82,.039,.038,.061]]);
      line([[.45,-.023,.048,.032],[.79,-.017,.044,.037]]);
    } else {
      line([[.24,.029,.048,.021],[.56,.059,.048,.032],[.79,.090,.044,.035],[.86,.061,.017,.055]]);
      line([[.55,-.025,.049,.022],[.78,-.003,.048,.027],[.86,.036,.018,.031]]);
    }
    // Recess the bore just behind the metal lip, with no silver end cap.
    const px=side*w*.29, py=-.152, pz=bumper+.075;
    part(body, geo.exhaustRim, shared.satin, [px,py,pz], [.099,.068,.065]);
    part(body, geo.exhaustBore, shared.rubber, [px,py,pz-.010], [.093,.064,1]);
    addNitro(root,data,px,pz+.018);
    if (profile === "hyper" || profile === "super") {
      for (let slat=0; slat<4; slat++)
        part(body,geo.box,shared.carbon,[side*w*.33,h*.367+.016,l*(.341+slat*.014)],[w*.127,.022,.024],[-.16,0,0]);
    }
  }
  part(body, geo.box, shared.carbon, [0,-.116,bumper+.025], [.49,.123,.037]);
  part(body, geo.shadow, shared.plate, [0,-.105,bumper+.048], [.40,.103,1]);
  part(body, geo.box, rearLight, [0,h*.36+.02,l*.336], [w*.16,.022,.034]);
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
  // Keep yaw on the full circle when presentation restores the mesh quaternion.
  root.rotation.order = "YXZ";
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

  const contactShadow = part(
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
  const roadRig = new THREE.Group();
  roadRig.name = "Road alignment";
  if (spec.kind === "bike") {
    data.leanRig = new THREE.Group();
    data.leanRig.name = "Motorcycle bank";
    data.leanRig.add(...root.children.filter(child => child !== contactShadow));
    roadRig.add(data.leanRig, contactShadow);
  } else {
    roadRig.add(...root.children.slice());
  }
  root.add(roadRig);
  data.roadRig = roadRig;

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

const surfaceUp = new THREE.Vector3(0, 1, 0);
const localRoadNormal = new THREE.Vector3();

export function alignVehicleToSurface(vehicle, surfaceY = 0, slopeX = 0, slopeZ = 0) {
  vehicle.position.y = surfaceY + getVehicleGroundOffset(vehicle);
  const rig = vehicle.userData.roadRig;
  if (rig) {
    const yaw = vehicle.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    localRoadNormal.set(-slopeX * c + slopeZ * s, 1, -slopeX * s - slopeZ * c).normalize();
    rig.quaternion.setFromUnitVectors(surfaceUp, localRoadNormal);
  }
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
  updateRider(d, speed, steering, boosting, braking, dt);
  if (d.turret)
    d.turret.rotation.y = THREE.MathUtils.lerp(
      d.turret.rotation.y,
      steering * 0.22,
      -Math.expm1(-5*dt),
    );

  if (d.spec.kind === 'bike') {
    // A yaw to the right is negative around Y. Banking to the right is
    // likewise negative around Z, with the road shadow level under the tyres.
    const lean = steering * .49 * Math.min(1, Math.abs(speed) / 14);
    d.leanRig.rotation.z = damp(d.leanRig.rotation.z, lean + .028 * d.rider.footDown, 7, dt);
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
  if (d.activeWing) {
    const airbrake = braking ? THREE.MathUtils.smoothstep(Math.abs(speed), 9, 35) : 0;
    d.activeWing.rotation.x = damp(d.activeWing.rotation.x, -.025 - airbrake * .55, braking ? 8 : 4, dt);
  }
  d.previousSpeed = speed;

  for (const light of d.headLights) light.color.setHex(0xe8fbff);
  d.brakeAmount = damp(d.brakeAmount || 0, braking ? 1 : 0, braking ? 26 : 12, dt);
  for (const light of d.brakeLights) {
    light.color.setRGB(.60 + .40*d.brakeAmount, .008 + .10*d.brakeAmount, .016 + .035*d.brakeAmount);
    if (light.emissive) light.emissiveIntensity = .8 + 2.2*d.brakeAmount;
  }

  for (const flame of d.flames) {
    flame.visible = boosting;
    if (boosting) {
      const pulse = Math.sin(time * 27 + flame.position.x * 4) * .12 + Math.sin(time * 43) * .06;
      const length = 1.65 + pulse + Math.min(Math.abs(speed) / 90, .65);
      flame.scale.set(.86 + pulse, length, .86 + pulse);
      flame.position.z = flame.userData.nozzleZ + .36 * length;
    }
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

// Match the paint to the structure the car is actually under. The height
// falloff keeps vehicles crossing the upper deck out of its ground shadow.
export function applyStreetLighting(vehicle, lighting) {
  if (!lighting) return;
  const paint = vehicle.userData.paint;
  paint.onBeforeCompile = shader => {
    shader.uniforms.districtOcclusion = { value: lighting.texture };
    shader.uniforms.districtShade = lighting.strength;
    shader.vertexShader = "varying vec3 districtPoint;\n" + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n districtPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;",
    );
    shader.fragmentShader = "varying vec3 districtPoint;\nuniform sampler2D districtOcclusion;\nuniform float districtShade;\n" +
      shader.fragmentShader.replace("#include <opaque_fragment>", `
        vec2 mapUV = vec2(.5 + districtPoint.x / 1120., .5 - districtPoint.z / 1120.);
        float onStreet = 1. - smoothstep(2.4, 5.9, districtPoint.y);
        outgoingLight *= 1. - districtShade * onStreet * texture2D(districtOcclusion, mapUV).g;
        #include <opaque_fragment>
      `);
  };
  paint.customProgramCacheKey = () => "nightshift-painted-street";
  paint.needsUpdate = true;
}

export function setVehicleColor(vehicle, color) {
  const paint = vehicle.userData.paint;
  if (paint) {
    paint.color.set(color);
    paint.emissive.set(color);
  }
}
