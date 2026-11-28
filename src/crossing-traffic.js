import { flyoverSurface } from "./flyover.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function commuterMesh(world, bus) {
  const boxes = [], lamps = [],
    transform = new THREE.Matrix4(),
    q = new THREE.Quaternion();
  const block = new THREE.BoxGeometry(1, 1, 1),
    tyre = new THREE.CylinderGeometry(1, 1, 1, 10);
  const add = (geometry, x, y, z, w, h, l, color, axle = false, lit = false) => {
    q.setFromEuler(new THREE.Euler(0, 0, axle ? Math.PI / 2 : 0));
    transform.compose(
      new THREE.Vector3(x, y, z),
      q,
      new THREE.Vector3(w, h, l),
    );
    const part = geometry.clone().applyMatrix4(transform),
      paint = new THREE.Color(color);
    const colors = [];
    for (let i = 0; i < part.attributes.position.count; i++)
      colors.push(paint.r, paint.g, paint.b);
    part.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    (lit ? lamps : boxes).push(part);
  };
  const w = bus ? 2.24 : 1.92,
    l = bus ? 7.8 : 4.36,
    r = bus ? 0.48 : 0.35;
  const body = bus ? 0xc2ac7f : 0x6e8c99,
    windows = 0x283c48,
    trim = 0x303942;
  add(block, 0, r + 0.32, 0, w, 0.68, l, body);
  const top = bus ? 2.35 : 1.55,
    cabin = bus ? l * 0.96 : l * 0.64;
  add(block, 0, (top + 0.78) * 0.5, 0.1, w * 0.91, top - 0.78, cabin, body);
  if (bus) {
    // Roof vent and a narrow route display keep the bus legible above the parapet.
    add(block, 0, top + .085, .65, 1.22, .17, 2.1, 0x939b99);
    add(block, 0, top - .10, .077 - cabin * .5, w * .67, .13, .05, 0xe3aa60, false, true);
  }
  for (const side of [-1, 1]) {
    if (bus) {
      add(block, side * w * .503, 1.02, 0, .025, .21, l * .97, 0x347775);
      add(block, side * w * .459, top - .09, .35 - cabin * .5, .035, .105, .51, 0xf4ad5c, false, true);
    }
    const n = bus ? 6 : 3,
      cell = cabin / n;
    for (let i = 0; i < n; i++)
      add(
        block,
        side * w * 0.457,
        top - 0.36,
        0.1 - cabin * 0.5 + cell * (i + 0.5),
        0.031,
        bus ? 0.57 : 0.35,
        cell * 0.79,
        bus ? [0x77776a, 0xa29376, 0x6d7777][i % 3] : windows,
        false,
        bus,
      );
    for (const z of [-l * 0.297, l * 0.297]) {
      add(tyre, side * w * 0.443, r, z, r, 0.29, r, 0x20282b, true);
      add(
        tyre,
        side * w * 0.507,
        r,
        z,
        r * 0.59,
        0.023,
        r * 0.59,
        0x798182,
        true,
      );
    }
    add(
      block,
      side * w * 0.33,
      r + 0.36,
      -l * 0.502,
      w * 0.19,
      0.12,
      0.04,
      0xffe9c4, false, true,
    );
    add(
      block,
      side * w * 0.35,
      r + 0.37,
      l * 0.502,
      w * 0.15,
      0.13,
      0.04,
      0xdc6958, false, true,
    );
  }
  add(
    block,
    0,
    top - 0.34,
    0.09 - cabin * 0.5,
    w * 0.82,
    bus ? 0.49 : 0.33,
    0.035,
    windows,
  );
  add(
    block,
    0,
    top - 0.34,
    0.12 + cabin * 0.5,
    w * 0.76,
    bus ? 0.5 : 0.3,
    0.035,
    windows,
  );
  add(block, 0, r + 0.01, 0, w * 1.01, 0.12, l * 0.985, trim);
  const solid = mergeGeometries(boxes), glassAndLights = mergeGeometries(lamps);
  const merged = world.trackGeometry(mergeGeometries([solid, glassAndLights], true));
  for (const shape of [...boxes, ...lamps, solid, glassAndLights]) shape.dispose();
  block.dispose();
  tyre.dispose();
  return merged;
}

export function crossingTraffic(world, layout, phase) {
  const {mid, yaw} = layout;
  if (!world.commuters) {
    world.commuters = [commuterMesh(world, false), commuterMesh(world, true)];
  }
  const paint = world.material({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.22,
  });
  const material = [paint, world.basic({vertexColors: true})];
  const group = new THREE.Group();
  group.name = "Cross-street traffic";
  world.group.add(group);
  const riders = world.commuters.map(
    (geometry) => new THREE.Mesh(geometry, material),
  );
  group.add(...riders);
  const cs = Math.cos(yaw),
    sn = Math.sin(yaw);
  return {
    group,
    update(time, focus, view) {
      group.visible =
        !focus || Math.hypot(focus.x - mid.x, focus.z - mid.z) < view + 46;
      if (!group.visible) return;
      for (let i = 0; i < riders.length; i++) {
        const direction = i === 0 ? 1 : -1;
        const station =
          (((time * (i === 0 ? 10.0 : 7.4) + phase + i * 65) % 210) - 105) *
          direction;
        const vehicle = riders[i];
        // Waiting vehicles re-enter from the far ends of the approaches.
        vehicle.visible = Math.abs(station) < 80;
        if (!vehicle.visible) continue;
        // Sample each axle. A long bus straddling a crest has a different pitch
        // from a short sedan at the same station.
        const wheelbase = (i === 0 ? 4.36 : 7.8) * .594;
        const back = flyoverSurface(station - wheelbase / 2);
        const front = flyoverSurface(station + wheelbase / 2);
        const height = (front + back) / 2;
        const slope = (front - back) / wheelbase;
        const lane = -direction * 2.23;
        vehicle.position.set(
          mid.x + lane * cs + station * sn,
          height,
          mid.z - lane * sn + station * cs,
        );
        vehicle.rotation.set(
          Math.atan(slope) * direction,
          yaw + (direction > 0 ? Math.PI : 0),
          0,
          "YXZ",
        );
      }
    },
  };
}
