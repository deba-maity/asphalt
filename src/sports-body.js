import * as THREE from "three";

function geometry(positions, indices, uv = null) {
  const mesh = new THREE.BufferGeometry();
  mesh.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  mesh.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      uv || new Array((positions.length / 3) * 2).fill(0),
      2,
    ),
  );
  mesh.setIndex(indices);
  mesh.computeVertexNormals();
  mesh.userData.disposeWithActor = true;
  return mesh;
}

// Vary the shoulder height around each tyre. The underside stays inboard of
// the wheel and the outer sheet metal follows the circular wheel opening.
export function sportsShell(config, radius) {
  const { w, l, h } = config,
    half = w / 2;
  const front = -l * 0.29,
    rear = l * 0.3,
    well = radius + 0.079;
  const stations = [
    [-0.52, 0.79, -0.17, config.nose],
    [-0.46, 0.9, -0.22, h * 0.17],
    [-0.35, 0.99, -0.23, h * 0.33],
    [-0.23, 1.0, -0.23, h * 0.41],
    [-0.07, 0.95, -0.23, h * 0.37],
    [0.12, 0.956, -0.23, h * 0.35],
    [0.26, 1.015, -0.22, h * 0.4],
    [0.38, 1.0, -0.215, h * 0.39],
    [0.47, 0.95, -0.18, h * 0.36],
    [0.5, 0.89, -0.14, h * 0.28],
  ];
  const cuts = new Set(stations.map((s) => s[0] * l));
  for (const axle of [front, rear]) {
    // Sample by angle so the lips remain round close to vertical tangency.
    for (let i = 0; i <= 16; i++)
      cuts.add(axle + Math.cos((i * Math.PI) / 16) * well);
    cuts.add(axle - well - 0.024);
    cuts.add(axle + well + 0.024);
  }
  const positions = [],
    indices = [];
  let row = 0;
  const ringSize = 20;
  for (const z of [...cuts].sort((a, b) => a - b)) {
    let segment = 0;
    while (segment < stations.length - 2 && z > stations[segment + 1][0] * l)
      segment++;
    const a = stations[segment],
      b = stations[segment + 1];
    const t = THREE.MathUtils.clamp((z / l - a[0]) / (b[0] - a[0]), 0, 1);
    const width = THREE.MathUtils.lerp(a[1], b[1], t) * half;
    const bottom = THREE.MathUtils.lerp(a[2], b[2], t);
    const crown = THREE.MathUtils.lerp(a[3], b[3], t);
    const dz = Math.min(Math.abs(z - front), Math.abs(z - rear));
    const arch =
      dz <= well
        ? Math.max(
            bottom,
            -h * 0.32 + Math.sqrt(Math.max(0, well * well - dz * dz)),
          )
        : bottom;
    const shoulder = Math.max(crown + 0.023, arch + 0.073);
    // Blend the fenders gently into a convex bonnet. A flat midsection
    // between the raised wheel lips looks hollow from the trackside camera.
    const deck = Math.max(crown, crown * 0.5 + arch * 0.5);
    const side = [
      [0.69, bottom],
      [0.765, bottom + 0.012],
      [0.8, arch - 0.012],
      [0.974, arch],
      [1.0, arch + 0.032],
      [0.997, shoulder - 0.037],
      [0.931, shoulder],
      [0.83, shoulder * 0.49 + deck * 0.51],
      [0.59, deck + 0.019],
      [0.22, deck + 0.037],
    ];
    const ring = [
      ...side.map(([x, y]) => [-x * width, y]),
      ...side
        .slice()
        .reverse()
        .map(([x, y]) => [x * width, y]),
    ];
    for (const [x, y] of ring) positions.push(x, y, z);
    if (row)
      for (let i = 0; i < ringSize; i++) {
        const n = (row - 1) * ringSize + i,
          next = (row - 1) * ringSize + ((i + 1) % ringSize);
        indices.push(
          n,
          n + ringSize,
          next,
          next,
          n + ringSize,
          next + ringSize,
        );
      }
    row++;
  }
  // Each end gets its own normals. A glossy rear panel should reflect the sky
  // independently from the horizontal deck immediately above it.
  for (const end of [0, row - 1]) {
    const offset = positions.length / 3;
    const z = positions[end * ringSize * 3 + 2];
    positions.push(0, 0.015, z);
    positions.push(
      ...positions.slice(end * ringSize * 3, (end + 1) * ringSize * 3),
    );
    for (let i = 0; i < ringSize; i++) {
      const a = offset + 1 + i,
        b = offset + 1 + ((i + 1) % ringSize);
      if (end === 0) indices.push(offset, a, b);
      else indices.push(offset, b, a);
    }
  }
  return geometry(positions, indices);
}

// A tapered strip on the rear panel. The points are authored in the rear view,
// and UVs run along the entire lens so its segmented detail stays continuous.
export function fasciaStrip(points, depth = 0.018) {
  const positions = [],
    uvs = [],
    indices = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y, z, height] = points[i],
      u = i / (points.length - 1);
    positions.push(
      x,
      y - height * 0.5,
      z,
      x,
      y + height * 0.5,
      z,
      x,
      y + height * 0.5,
      z - depth,
      x,
      y - height * 0.5,
      z - depth,
    );
    uvs.push(u, 0, u, 1, u, 1, u, 0);
    if (i === 0) continue;
    for (let side = 0; side < 4; side++) {
      const a = (i - 1) * 4 + side,
        b = (i - 1) * 4 + ((side + 1) % 4);
      indices.push(a, a + 4, b, b, a + 4, b + 4);
    }
  }
  return geometry(positions, indices, uvs);
}

export function registrationPlate() {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#151c22";
  ctx.fillRect(0, 0, 192, 64);
  ctx.strokeStyle = "#a2adb1";
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 186, 58);
  ctx.fillStyle = "#e7dfbf";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N SHIFT", 96, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    metalness: 0.16,
    roughness: 0.52,
  });
}

export function rearWing(width, chord) {
  const positions = [],
    indices = [];
  const section = [
    [0, 0.01],
    [0.13, 0.041],
    [0.64, 0.034],
    [1, 0.017],
    [0.95, -0.012],
    [0.14, -0.019],
  ];
  for (const span of [-0.5, -0.46, 0, 0.46, 0.5]) {
    for (const [z, y] of section) {
      const tip = Math.abs(span) * 2;
      positions.push(
        span * width,
        y + tip * tip * 0.025,
        z * chord * (1 - tip * 0.16) + tip * tip * 0.053,
      );
    }
  }
  for (let row = 0; row < 4; row++)
    for (let s = 0; s < section.length; s++) {
      const a = row * section.length + s,
        b = row * section.length + ((s + 1) % section.length);
      indices.push(
        a,
        b,
        a + section.length,
        b,
        b + section.length,
        a + section.length,
      );
    }
  for (let s = 1; s < section.length - 1; s++) {
    indices.push(0, s + 1, s);
    const offset = 4 * section.length;
    indices.push(offset, offset + s, offset + s + 1);
  }
  return geometry(positions, indices);
}
