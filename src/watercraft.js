import * as THREE from "three";
import { coastBank, quayEdge } from "./coastal-water.js";

// Transverse hull sections run from the transom to the bow. The flared
// shoulders narrow into a sharp cutwater, with a continuous painted boot top.
function hull(world, parent, length, beam, height, colors) {
  const pos = [],
    ink = [];
  const rows = [
    [-0.5, 0.52],
    [-0.45, 0.86],
    [-0.3, 1.0],
    [0.18, 1.0],
    [0.34, 0.86],
    [0.46, 0.42],
    [0.515, 0.018],
  ].map(([x, breadth]) => {
    const width = beam * breadth * 0.5;
    const sheer = Math.max(0, (x - 0.3) * 1.45);
    return [
      [x * length, height * (1 + sheer), -width],
      [x * length, 0.18 * height, -width * 0.93],
      [x * length, -0.12 * height, -width * 0.8],
      [x * length, -0.39 * height, -width * 0.44],
      [x * length, -0.39 * height, width * 0.44],
      [x * length, -0.12 * height, width * 0.8],
      [x * length, 0.18 * height, width * 0.93],
      [x * length, height * (1 + sheer), width],
    ];
  });
  const tones = colors.map((c) => new THREE.Color(c));
  function quad(a, b, c, d, tint) {
    for (const p of [a, b, c, a, c, d]) {
      pos.push(...p);
      ink.push(tint.r, tint.g, tint.b);
    }
  }
  const strips = [0, 1, 2, 2, 2, 1, 0, 3];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8;
      quad(a[j], a[k], b[k], b[j], tones[strips[j]]);
    }
  }
  for (const cap of [rows[0], rows.at(-1)])
    for (let i = 0; i < 3; i++)
      quad(cap[i], cap[i + 1], cap[6 - i], cap[7 - i], tones[strips[i]]);
  const skin = new THREE.BufferGeometry();
  skin.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  skin.setAttribute("color", new THREE.Float32BufferAttribute(ink, 3));
  skin.computeVertexNormals();
  const shell = new THREE.Mesh(
    world.trackGeometry(skin),
    world.material({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.15,
    }),
  );
  parent.add(shell);
}

export function makeHarbor(world, model, root) {
  const quay = model.assembly(root, "Ironpoint quay");
  const concrete = world.material({ color: 0x797570, roughness: 0.9 });
  const black = world.material({ color: 0x303435, roughness: 0.86 });
  const white = world.material({ color: 0xcdc2a7, roughness: 0.7 });
  const ochre = world.material({ color: 0xcc9b58, roughness: 0.72 });
  const red = world.material({ color: 0xab554b, roughness: 0.78 });
  const blue = world.material({ color: 0x53747d, roughness: 0.79 });
  const glass = world.material({
    color: 0x3b5258,
    roughness: 0.35,
    metalness: 0.34,
  });
  for (let i = -25; i < 26; i++) {
    const x = i * 20,
      left = quayEdge(x - 10),
      right = quayEdge(x + 10);
    const angle = Math.atan2(left - right, 20);
    const z = (left + right) * 0.5;
    quay.box(
      concrete,
      [x, -0.14, z + 0.8],
      [Math.hypot(20, right - left) + 0.04, 0.46, 2.2],
      [0, angle, 0],
    );
    if (i % 2 === 0) {
      quay.box(black, [x, 0.42, z - 0.27], [1.12, 1.12, 0.49], [0, angle, 0]);
      quay.add(model.pipe, ochre, [x, 0.4, z + 1.3], [0.44, 0.73, 0.44]);
    }
  }
  quay.finish();
  const ships = [];
  for (const [x, length, tier] of [
    [-315, 76, 2],
    [140, 101, 3],
  ]) {
    const vessel = model.assembly(root, "Moored container ship");
    vessel.group.position.set(x, -0.24, quayEdge(x) - 11.9);
    const beam = length * 0.173,
      height = length * 0.042;
    hull(
      world,
      vessel.group,
      length,
      beam,
      height,
      [0x364956, 0xb17c61, 0x9c574b, 0x727877],
    );
    const aft = -length * 0.31;
    vessel.box(
      white,
      [aft, height + 2.3, 0],
      [length * 0.12, 4.6, beam * 0.81],
    );
    vessel.box(
      white,
      [aft + 0.5, height + 5.24, 0],
      [length * 0.14, 1.35, beam * 0.94],
    );
    for (const side of [-1, 1]) {
      vessel.box(
        glass,
        [aft + 0.5, height + 5.38, side * beam * 0.472],
        [length * 0.115, 0.57, 0.08],
      );
      vessel.box(
        ochre,
        [aft + 0.5, height + 5.97, side * beam * 0.46],
        [length * 0.14, 0.12, 0.25],
      );
    }
    vessel.box(
      glass,
      [aft + length * 0.071 + 0.5, height + 5.4, 0],
      [0.075, 0.6, beam * 0.82],
    );
    vessel.box(red, [aft - 4, height + 7, 0], [2.3, 4.3, 2.6]);
    vessel.box(black, [aft - 4, height + 9.18, 0], [2.39, 0.52, 2.65]);
    vessel.bar(
      white,
      [aft + 2, height + 5.96, 0],
      [aft + 2, height + 11.2, 0],
      0.11,
    );
    vessel.bar(
      white,
      [aft + 2, height + 9.9, -1.55],
      [aft + 2, height + 9.9, 1.55],
      0.075,
    );
    const count = length > 90 ? 7 : 5,
      mats = [red, blue, ochre];
    for (let i = 0; i < count; i++)
      for (let side = -1; side <= 1; side++) {
        const rows = (i + side + 4) % 4 === 0 ? 1 : tier;
        const cx = -length * 0.168 + i * 6.65;
        for (let j = 0; j < rows; j++) {
          const mat = mats[(i + j + side + 4) % 3],
            cz = side * 2.63,
            cy = height + 1.17 + j * 2.38;
          vessel.box(mat, [cx, cy, cz], [6.35, 2.32, 2.49]);
          if (Math.abs(side) === 1)
            for (let rib = 0; rib < 6; rib++)
              vessel.box(
                mat,
                [cx - 2.58 + rib * 1.02, cy, cz + side * 1.27],
                [0.11, 2.24, 0.09],
              );
        }
      }
    vessel.finish();
    ships.push(vessel.group);
  }
  return (time) =>
    ships.forEach((ship, i) => {
      ship.position.y = -0.24 + 0.095 * Math.sin(time * 0.43 + i * 1.6);
      ship.rotation.x = 0.006 * Math.sin(time * 0.32 + i * 0.8);
    });
}

export function makeCoastalYacht(world, model, root) {
  const yacht = model.assembly(root, "Coastal cutter");
  const mast = world.material({ color: 0xceba90, roughness: 0.67 });
  const rail = world.material({
    color: 0x717d7e,
    metalness: 0.38,
    roughness: 0.55,
  });
  const glass = world.material({ color: 0x486b73, roughness: 0.39 });
  hull(
    world,
    yacht.group,
    15.8,
    4.35,
    1.15,
    [0xdfdac8, 0x527a83, 0x7d5545, 0xc8aa86],
  );
  yacht.box(mast, [-1.6, 1.43, 0], [4.2, 0.85, 2.6]);
  yacht.box(glass, [-1.63, 1.6, 0], [3.36, 0.38, 2.68]);
  yacht.bar(rail, [0.58, 1.05, 0], [0.58, 13.7, 0], 0.074);
  yacht.bar(rail, [0.58, 2.6, 0.04], [-5.15, 2.7, 0.1], 0.065);
  const panelPos = [],
    panelInk = [];
  function sail(foot, head, clew, shade) {
    const a = new THREE.Vector3(...foot),
      b = new THREE.Vector3(...head),
      c = new THREE.Vector3(...clew);
    function point(u, v) {
      const p = a
        .clone()
        .multiplyScalar(1 - u - v)
        .addScaledVector(b, u)
        .addScaledVector(c, v);
      p.z += 7 * u * v * (1 - u - v) + 0.45 * Math.sin(v * Math.PI) * (1 - u);
      return p;
    }
    const strips = 7;
    for (let j = 0; j < strips; j++)
      for (let k = 0; k < strips - j; k++) {
        const u = j / strips,
          v = k / strips,
          h = 1 / strips;
        const tone = new THREE.Color(j === strips - 3 ? 0x98765e : shade);
        const tri = (p, q, r) => {
          for (const t of [p, q, r]) {
            panelPos.push(...t.toArray());
            panelInk.push(tone.r, tone.g, tone.b);
          }
        };
        tri(point(u, v), point(u + h, v), point(u, v + h));
        if (k < strips - j - 1)
          tri(point(u + h, v), point(u + h, v + h), point(u, v + h));
      }
  }
  sail([0.52, 2.83, 0], [0.5, 13.32, 0], [-5.04, 2.83, 0.08], 0xe7d9bc);
  sail([6.8, 1.68, 0.02], [0.82, 11.67, 0.02], [1.38, 2.63, 0.68], 0xf3dec3);
  const fabric = new THREE.BufferGeometry();
  fabric.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(panelPos, 3),
  );
  fabric.setAttribute("color", new THREE.Float32BufferAttribute(panelInk, 3));
  fabric.computeVertexNormals();
  yacht.group.add(
    new THREE.Mesh(
      world.trackGeometry(fabric),
      world.material({
        vertexColors: true,
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
    ),
  );
  yacht.finish();
  return (time) => {
    const phase = time * 0.014;
    const x = -145 + 24 * Math.sin(phase);
    yacht.group.position.set(
      x,
      -0.24 + 0.15 * Math.sin(time * 0.58),
      coastBank(x, -1) - 35 - 5 * Math.sin(phase * 0.77),
    );
    yacht.group.rotation.set(
      0.068 + 0.019 * Math.sin(time * 0.69),
      0.16 + 0.09 * Math.sin(phase * 0.77),
      0.016 * Math.sin(time * 0.63),
    );
  };
}
