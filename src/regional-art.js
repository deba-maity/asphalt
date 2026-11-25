import * as THREE from "three";

// A unit-sized outcrop. Recessed bedding planes and uneven ledges break up the
// silhouette; the coloured faces keep the bands readable from a moving car.
export function sandstone(seed) {
  const angles = 14,
    positions = [],
    colors = [];
  const strata = [
    [-0.5, 1.0, 0x926549],
    [-0.32, 0.93, 0xb8815a],
    [-0.27, 0.78, 0x8c5941],
    [-0.11, 0.76, 0xa16c4e],
    [-0.075, 0.85, 0xcd956b],
    [0.0, 0.83, 0x9e6248],
    [0.18, 0.68, 0xb77751],
    [0.23, 0.71, 0xd09a70],
    [0.29, 0.62, 0x9b6047],
    [0.43, 0.57, 0xb47956],
    [0.47, 0.61, 0xc18a65],
    [0.5, 0.57, 0xcf9b71],
  ];
  const rings = strata.map(([height, radius], row) =>
    Array.from({ length: angles }, (_, i) => {
      const a = (i / angles) * 2 * Math.PI;
      const wall =
        1 + 0.1 * Math.sin(a * 3 + seed) + 0.08 * Math.cos(a * 5 - seed);
      const relief = 0.023 * Math.sin(a * 2 + seed + row * 0.12);
      return [
        0.49 * radius * wall * Math.cos(a) + 0.045 * height,
        height + relief,
        0.47 * radius * wall * Math.sin(a) - 0.06 * height,
      ];
    }),
  );
  const tri = (p, q, r, color) => {
    positions.push(...p, ...q, ...r);
    for (let n = 0; n < 3; n++) colors.push(color.r, color.g, color.b);
  };
  for (let r = 1; r < rings.length; r++)
    for (let i = 0; i < angles; i++) {
      const j = (i + 1) % angles;
      const tint = new THREE.Color(strata[r][2]).multiplyScalar(
        0.94 + 0.1 * Math.sin(i * 7 + seed),
      );
      tri(rings[r - 1][i], rings[r][i], rings[r][j], tint);
      tri(rings[r - 1][i], rings[r][j], rings[r - 1][j], tint);
    }
  const cap = rings.at(-1),
    top = new THREE.Color(0xc39975);
  for (let i = 0; i < angles; i++)
    tri([0.01, 0.5, 0], cap[(i + 1) % angles], cap[i], top);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

export function facadeBox() {
  const g = new THREE.BoxGeometry(1, 1, 1),
    uv = g.getAttribute("uv");
  // Assign the roof to the coping strip rather than stretching windows across it.
  for (let i = 8; i < 16; i++) uv.setXY(i, 0.015, 0.985);
  return g;
}

export function paintFrontage(ctx, w, h, coast) {
  ctx.fillStyle = coast ? "#d3c9ac" : "#706a67";
  ctx.fillRect(0, 0, w, h);
  if (coast) {
    for (let y = 15; y < h - 12; y += 31) {
      for (let x = 6; x < w - 6; x += 28) {
        ctx.fillStyle = "#6c96a1";
        ctx.fillRect(x, y, 19, 18);
        ctx.fillStyle = "#345969";
        ctx.fillRect(x, y + 3, 19, 10);
        ctx.fillStyle = "#b3b2a4";
        ctx.fillRect(x + 9, y, 2, 16);
        ctx.fillStyle = "#45555a";
        ctx.fillRect(x - 2, y + 15, 23, 1);
      }
      ctx.fillStyle = "#8f8675";
      ctx.fillRect(0, y + 20, w, 4);
      ctx.fillStyle = "#e1d7c0";
      ctx.fillRect(0, y + 19, w, 2);
    }
  } else {
    for (let x = 1; x < w; x += 5) {
      ctx.fillStyle = "#938a7b";
      ctx.fillRect(x, 0, 1, h);
    }
    for (let x = 10; x < w; x += 48) {
      ctx.fillStyle = "#333e41";
      ctx.fillRect(x, 18, 36, 12);
      ctx.fillStyle = "#768d8f";
      ctx.fillRect(x + 1, 19, 33, 5);
      ctx.fillStyle = "#4b5555";
      ctx.fillRect(x, h * 0.55, 34, h * 0.45);
      for (let y = h * 0.55 + 5; y < h; y += 6) {
        ctx.fillStyle = "#666d69";
        ctx.fillRect(x + 2, y, 30, 1);
      }
    }
    ctx.fillStyle = "#9c5c41";
    ctx.fillRect(0, 39, w, 6);
  }
  ctx.fillStyle = coast ? "#a39c8a" : "#68696b";
  ctx.fillRect(0, 0, w, 7);
}
