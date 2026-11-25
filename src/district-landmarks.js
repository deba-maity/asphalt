import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { makeHarbor, makeCoastalYacht } from "./watercraft.js";
import { coastBank } from "./coastal-water.js";

const up = new THREE.Vector3(0, 1, 0);
const turn = Math.PI * 2;
const vec = (x, y, z) => new THREE.Vector3(x, y, z);

// Assemble each rigid or animated part once. A steel frame with dozens of
// braces costs one draw per material, and rotating parts keep their own pivot.
function kit(world) {
  const cube = world.trackGeometry(new THREE.BoxGeometry(1, 1, 1));
  const pipe = world.trackGeometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const shapes = { cube, pipe };
  const cylinder = (top, bottom, sides = 16) =>
    world.trackGeometry(new THREE.CylinderGeometry(top, bottom, 1, sides));
  function assembly(parent, name) {
    const group = new THREE.Group();
    group.name = name;
    parent.add(group);
    const buckets = new Map();
    const add = (shape, mat, xyz, scale, rotation) => {
      const q = rotation?.isQuaternion
        ? rotation
        : new THREE.Quaternion().setFromEuler(
            new THREE.Euler(...(rotation || [0, 0, 0])),
          );
      const matrix = new THREE.Matrix4().compose(vec(...xyz), q, vec(...scale));
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(shape.clone().applyMatrix4(matrix));
    };
    return {
      group,
      add,
      box(mat, xyz, scale, rotation) {
        add(cube, mat, xyz, scale, rotation);
      },
      bar(mat, a, b, radius) {
        const start = vec(...a),
          end = vec(...b),
          delta = end.clone().sub(start);
        const q = new THREE.Quaternion().setFromUnitVectors(
          up,
          delta.clone().normalize(),
        );
        add(
          pipe,
          mat,
          start.lerp(end, 0.5).toArray(),
          [radius, delta.length(), radius],
          q,
        );
      },
      finish() {
        for (const [mat, pieces] of buckets) {
          const merged = world.trackGeometry(mergeGeometries(pieces));
          for (const geometry of pieces) geometry.dispose();
          const part = new THREE.Mesh(merged, mat);
          group.add(part);
        }
        return group;
      },
    };
  }
  return { ...shapes, cylinder, assembly };
}

function steel(world, color) {
  return world.material({ color, metalness: 0.36, roughness: 0.62 });
}

function signal(world, color) {
  return world.basic({ color, toneMapped: false });
}

function lighthouse(world, model, parent) {
  const tower = model.assembly(parent, "North bay light station");
  const chalk = steel(world, 0xe5d5b5),
    brick = steel(world, 0xb65848);
  const iron = steel(world, 0x35444b),
    glass = steel(world, 0x8eaeb7);
  tower.group.position.set(-205, 0, coastBank(-205, -1) - 9);
  tower.add(
    model.cylinder(7, 10, 11),
    steel(world, 0x958c74),
    [0, 0.7, 0],
    [1, 2.1, 1],
  );
  let y = 1.75;
  for (const [h, base, top, mat] of [
    [5, 2.85, 2.52, chalk],
    [3.2, 2.52, 2.29, brick],
    [4.8, 2.29, 1.96, chalk],
    [2.6, 1.96, 1.8, brick],
  ]) {
    tower.add(model.cylinder(top, base), mat, [0, y + h / 2, 0], [1, h, 1]);
    y += h;
  }
  tower.add(model.pipe, iron, [0, y, 0], [2.62, 0.32, 2.62]);
  tower.add(model.pipe, glass, [0, y + 1.21, 0], [1.49, 2.22, 1.49]);
  tower.add(model.cylinder(0.3, 2.05), brick, [0, y + 2.87, 0], [1, 1.05, 1]);
  for (let i = 0; i < 12; i++) {
    const a = (turn * i) / 12,
      b = (turn * (i + 1)) / 12;
    const x = Math.cos(a) * 2.35,
      z = Math.sin(a) * 2.35;
    tower.bar(iron, [x, y, z], [x, y + 0.9, z], 0.052);
    tower.bar(
      iron,
      [x, y + 0.9, z],
      [Math.cos(b) * 2.35, y + 0.9, Math.sin(b) * 2.35],
      0.065,
    );
    if (i % 2 === 0)
      tower.bar(
        iron,
        [x * 0.64, y + 0.05, z * 0.64],
        [x * 0.64, y + 2.29, z * 0.64],
        0.085,
      );
  }
  tower.finish();
  const lamp = model.assembly(tower.group, "Rotating lighthouse lens");
  const beam = signal(world, 0xffe9ac);
  for (const side of [-1, 1]) {
    lamp.box(beam, [0, 0, side * 1.53], [1.06, 0.97, 0.13]);
    lamp.box(iron, [0, 0, side * 1.48], [1.32, 1.17, 0.14]);
  }
  lamp.group.position.y = y + 1.2;
  lamp.finish();
  const sail = makeCoastalYacht(world, model, parent);
  return (time) => {
    sail(time);
    lamp.group.rotation.y = time * 0.77;
  };
}

function cargoYard(world, model, parent) {
  const yellow = steel(world, 0xbb763a),
    pale = steel(world, 0xd59c59),
    dark = steel(world, 0x374850);
  const cableMat = steel(world, 0x38414b),
    cargoMat = steel(world, 0x526f79);
  const working = [];
  for (const [x, z, phase] of [
    [-325, -267, 0],
    [134, -301, 8.1],
    [245, 315, 3.7],
  ]) {
    if (!world.clearForRoadside(vec(x, 0, z), 20)) continue;
    const bridge = model.assembly(parent, "Dockside container crane");
    bridge.group.position.set(x, 0, z);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        bridge.box(dark, [15 * side, 0.58, end * 3.85], [3.1, 1.16, 2.65]);
        bridge.bar(
          yellow,
          [15 * side, 1, end * 3.85],
          [13.0 * side, 17.35, end * 2.7],
          0.52,
        );
        bridge.bar(
          pale,
          [15 * side, 5.4, end * 3.85],
          [13.3 * side, 14.0, -end * 2.67],
          0.19,
        );
      }
      bridge.box(yellow, [0, 17.7, side * 2.75], [31.3, 1.1, 0.9]);
      bridge.box(pale, [0, 19.65, side * 2.75], [31.3, 0.23, 0.27]);
      for (let i = 0; i < 12; i++)
        bridge.bar(
          pale,
          [-15.55 + i * 2.6, 17.95, side * 2.75],
          [-15.55 + (i + 1) * 2.6, 19.63, side * 2.75],
          0.11,
        );
    }
    bridge.box(dark, [10.8, 16.3, 4.05], [3.9, 2.2, 2.1]);
    bridge.box(signal(world, 0xd1e1da), [10.8, 16.6, 5.14], [2.95, 0.91, 0.09]);
    bridge.finish();
    const trolley = model.assembly(bridge.group, "Traveling hoist");
    trolley.box(dark, [0, 0, 0], [4.8, 1.1, 6.6]);
    trolley.group.position.y = 17.75;
    trolley.finish();
    const lines = model.assembly(trolley.group, "Hoist cables");
    for (const side of [-1, 1])
      for (const end of [-1, 1])
        lines.bar(
          cableMat,
          [side * 1.8, 0, end * 0.87],
          [side * 1.8, -1, end * 0.87],
          0.047,
        );
    lines.finish();
    const load = model.assembly(trolley.group, "Suspended container");
    load.box(pale, [0, -0.15, 0], [6.1, 0.3, 2.65]);
    load.box(cargoMat, [0, -1.64, 0], [6.0, 2.55, 2.55]);
    for (let rib = 0; rib < 11; rib++)
      for (const side of [-1, 1])
        load.box(
          dark,
          [-2.73 + rib * 0.55, -1.64, side * 1.288],
          [0.052, 2.3, 0.045],
        );
    load.finish();
    working.push({
      trolley: trolley.group,
      lines: lines.group,
      load: load.group,
      phase,
    });
  }
  const harbor = makeHarbor(world, model, parent);
  return (time) => {
    harbor(time);
    for (const rig of working) {
      const cycle = (time + rig.phase) * 0.19;
      rig.trolley.position.x = 9.3 * Math.sin(cycle);
      const length = 4.1 + 5.8 * Math.pow(Math.abs(Math.sin(cycle)), 8);
      rig.lines.scale.y = length;
      rig.load.position.y = -length;
    }
  };
}

function windFarm(world, model, parent) {
  const ivory = steel(world, 0xd3c4a8),
    band = steel(world, 0xb96c51),
    hub = steel(world, 0x958a78);
  const rotors = [];
  const blade = model.cylinder(0.14, 0.72, 5);
  for (const [x, z, h, offset] of [
    [-280, -343, 29, 0.3],
    [-215, -352, 32, 2.1],
    [-155, -335, 27, 4.0],
    [313, -269, 29, 1.0],
    [366, 265, 25, 3.0],
  ]) {
    if (!world.clearForRoadside(vec(x, 0, z), 13)) continue;
    const frame = model.assembly(parent, "Mesa wind turbine");
    frame.group.position.set(x, 0, z);
    frame.group.rotation.y = -0.6;
    frame.add(model.cylinder(0.62, 1.27), ivory, [0, h / 2, 0], [1, h, 1]);
    frame.add(model.pipe, band, [0, 2.1, 0], [1.26, 0.48, 1.26]);
    frame.box(hub, [0, h, 0], [1.45, 1.25, 3.15]);
    frame.finish();
    const rotor = model.assembly(frame.group, "Wind turbine rotor");
    rotor.group.position.set(0, h, 1.66);
    for (let i = 0; i < 3; i++) {
      const angle = (turn * i) / 3;
      rotor.add(
        blade,
        ivory,
        [-Math.sin(angle) * 5.8, Math.cos(angle) * 5.8, 0],
        [1, 10.5, 0.31],
        [0, 0, angle],
      );
      rotor.box(
        band,
        [-Math.sin(angle) * 10.24, Math.cos(angle) * 10.24, 0],
        [0.27, 0.7, 0.13],
        [0, 0, angle],
      );
    }
    rotor.add(
      model.pipe,
      hub,
      [0, 0, 0.23],
      [0.73, 0.85, 0.73],
      [Math.PI / 2, 0, 0],
    );
    rotor.finish();
    rotors.push({ rotor: rotor.group, offset });
  }
  return (time) => {
    for (const { rotor, offset } of rotors)
      rotor.rotation.z = offset + time * (0.74 + 0.022 * offset);
  };
}

const wheelX = -254,
  wheelZ = -306;

// Leave a shallow public plaza between the wheel and the first straight.
// Lots touch the boulevard at different angles, so reserve their full footprint.
export function onWheelPlaza(x, z, radius = 0) {
  return (
    Math.abs(x - wheelX) < 29 + radius &&
    z > wheelZ - 12 - radius &&
    z < wheelZ + 38 + radius
  );
}

function meridianWheel(world, model, parent) {
  const steelwork = steel(world, 0x30435b),
    cabinMetal = steel(world, 0x385273);
  const cyan = signal(world, 0x75d6e5),
    amber = signal(world, 0xf5bd79);
  const axis = model.assembly(parent, "Meridian observation wheel");
  axis.group.position.set(wheelX, 0, wheelZ);
  axis.group.rotation.y = -0.68;
  for (const z of [-3.3, 3.3])
    for (const x of [-8.6, 8.6])
      axis.bar(steelwork, [x, 0.1, z * 1.8], [0, 18.5, z], 0.41);
  axis.box(steelwork, [0, 0.55, 0], [20, 1.1, 14]);
  const paving = steel(world, 0x435862);
  const roof = steel(world, 0x36596d);
  const light = signal(world, 0xffdcab);
  axis.box(paving, [0, -0.15, 4.2], [34, 0.45, 24]);
  // Passenger boarding platform, two ticket windows, and low approach lights.
  axis.box(steelwork, [0, 0.62, 4.0], [17, 1.14, 4.8]);
  for (const side of [-1, 1]) {
    const x = side * 12.4;
    axis.box(cabinMetal, [x, 1.55, 8.5], [4.8, 2.95, 3.0]);
    axis.box(roof, [x, 3.25, 8.5], [5.5, 0.34, 3.9]);
    axis.box(light, [x, 1.96, 10.01], [3.32, 0.86, 0.09]);
    for (let i = 0; i < 5; i++) {
      const z = -5 + i * 4.1;
      axis.box(steelwork, [side * 16, 0.62, z], [0.29, 1.2, 0.29]);
      axis.box(amber, [side * 16, 1.26, z], [0.34, 0.2, 0.34]);
    }
  }
  axis.finish();
  const wheel = model.assembly(axis.group, "Illuminated rim");
  wheel.group.position.y = 18.5;
  const radius = 14,
    segments = 36;
  for (let i = 0; i < segments; i++) {
    const a = (turn * i) / segments,
      b = (turn * (i + 1)) / segments;
    for (const z of [-1.52, 1.52]) {
      const p = [Math.cos(a) * radius, Math.sin(a) * radius, z];
      const q = [Math.cos(b) * radius, Math.sin(b) * radius, z];
      wheel.bar(i % 3 === 2 ? amber : cyan, p, q, 0.123);
      if (i % 3 === 0) wheel.bar(steelwork, [0, 0, z * 0.52], p, 0.097);
    }
  }
  const hub = model.cylinder(1.47, 1.47);
  wheel.add(hub, amber, [0, 0, 0], [1, 3.7, 1], [Math.PI / 2, 0, 0]);
  wheel.finish();
  const gondolas = [
    [cabinMetal, -1.05, [1.8, 0.72, 2.55]],
    [signal(world, 0xffffff), -0.54, [1.48, 0.36, 2.22]],
    [steelwork, -0.25, [1.92, 0.16, 2.62]],
  ].map(([material, drop, size], layer) => {
    const instances = new THREE.InstancedMesh(model.cube, material, 12);
    instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instances.boundingSphere = new THREE.Sphere(vec(0, 18.5, 0), radius + 2.8);
    if (layer === 1) {
      for (let i = 0; i < 12; i++)
        instances.setColorAt(i, i % 3 === 0 ? amber.color : cyan.color);
    }
    axis.group.add(instances);
    return { instances, drop, size: vec(...size) };
  });
  const pose = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    upright = new THREE.Quaternion();
  return (time) => {
    const angle = time * 0.087;
    wheel.group.rotation.z = angle;
    for (const { instances, drop, size } of gondolas) {
      for (let i = 0; i < 12; i++) {
        const a = angle + (turn * i) / 12;
        position.set(
          Math.cos(a) * radius,
          18.5 + Math.sin(a) * radius + drop,
          0,
        );
        instances.setMatrixAt(i, pose.compose(position, upright, size));
      }
      instances.instanceMatrix.needsUpdate = true;
    }
  };
}

export function makeDistrictLandmark(world) {
  const model = kit(world),
    root = new THREE.Group();
  root.name = "District landmark";
  world.group.add(root);
  const builders = {
    neon: meridianWheel,
    coast: lighthouse,
    dock: cargoYard,
    mesa: windFarm,
  };
  const update = builders[world.map.id](world, model, root);
  update(0);
  const bounds = new THREE.Box3()
    .setFromObject(root)
    .getBoundingSphere(new THREE.Sphere());
  return {
    root,
    update(time, focus, distance) {
      if (
        !focus ||
        focus.distanceToSquared(bounds.center) <=
          (bounds.radius + distance) ** 2
      )
        update(time);
    },
  };
}
