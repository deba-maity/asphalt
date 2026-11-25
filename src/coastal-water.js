import * as THREE from "three";

// The road skirts two bays. Keeping the coast in world coordinates gives the
// hotels, sand and foam the same shoreline at every draw distance.
export function coastBank(x, side) {
  const reach = Math.min(Math.abs(x) / 540, 1.3);
  if (side < 0) return -282 + 95 * reach * reach + 6 * Math.sin(x * 0.012);
  return 354 - 68 * reach * reach + 9 * Math.sin(x * 0.011);
}

export function isOpenWater(x, z) {
  return z < coastBank(x, -1) || z > coastBank(x, 1);
}

// The stepped northern quay follows the two crane berths. Its nearest
// point still leaves the entire Ironpoint circuit and shortcuts on land.
export function quayEdge(x) {
  const t = THREE.MathUtils.smoothstep(x, -215, -75);
  return -279 - 33 * t;
}

function shoreGeometry(sand, harbor = false) {
  const positions = [],
    uvs = [],
    indices = [];
  for (const side of harbor ? [-1] : [-1, 1]) {
    const start = positions.length / 3;
    for (let i = 0; i <= 100; i++) {
      const x = (i - 50) * 18;
      const bank = harbor ? quayEdge(x) : coastBank(x, side);
      for (const offset of sand ? [-13, 2] : [0, 690]) {
        positions.push(x, sand ? -0.21 : -0.245, bank + side * offset);
        uvs.push(x, offset);
      }
      if (i < 100) {
        const n = start + i * 2;
        if (side > 0) indices.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
        else indices.push(n, n + 2, n + 1, n + 2, n + 3, n + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function addCoastWater(world, sandMaterial) {
  const harbor = world.map.id === "dock";
  if (!harbor) {
    const sand = new THREE.Mesh(
      world.trackGeometry(shoreGeometry(true)),
      sandMaterial,
    );
    sand.name = "Azure Run beaches";
    world.group.add(sand);
  }
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      tide: { value: 0 },
      deep: { value: new THREE.Color(harbor ? "#374d58" : "#397a8a") },
      shore: { value: new THREE.Color(harbor ? "#66757a" : "#69aaab") },
      breaker: { value: harbor ? 0.07 : 1 },
      foam: { value: new THREE.Color("#cfdbcc") },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec2 coast;
      void main() {
        coast = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      varying vec2 coast;
      uniform vec3 deep, shore, foam;
      uniform float tide, breaker;
      void main() {
        float chop = sin(coast.x * .115 + coast.y * .39 - tide * .8);
        float crest = sin(coast.x * .28 - coast.y * .64 - tide * .97 + chop);
        float edge = 4.2 + 1.4 * sin(coast.x * .06 + tide * .44) + .63 * chop;
        float wash = 1.0 - smoothstep(.4, 1.4, abs(coast.y - edge));
        vec3 water = mix(shore, deep, smoothstep(1.0, 40.0, coast.y));
        float nearDetail = 1.0 - smoothstep(.35, 1.3, fwidth(coast.y));
        water += vec3(.022, .026, .025) * (chop * .42 + pow(max(crest, 0.0), 7.0)) * nearDetail;
        water = mix(water, foam, wash * (.55 + .27 * crest) * breaker);
        gl_FragColor = vec4(water, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  world.materials.push(material);
  const ocean = new THREE.Mesh(
    world.trackGeometry(shoreGeometry(false, harbor)),
    material,
  );
  ocean.name = harbor ? "Ironpoint harbor" : "Azure Run tidal water";
  world.group.add(ocean);
  return uniforms.tide;
}
