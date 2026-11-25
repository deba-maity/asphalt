import * as THREE from "three";
import { nearestPointOnPath } from "./road-projection.js";

const front = [0, 2, 5, 9, 14, 20, 27];
const rear = [0, 0.9, 2.2, 4.0];
const vertexShader = `
  attribute float rearLight;
  attribute float surfaceMask;
  varying float isRear;
  varying float mask;
  varying vec2 roadUV;

  void main() {
    roadUV = uv;
    isRear = rearLight;
    mask = surfaceMask;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;
const fragmentShader = `
  uniform float night, brake, boost;
  varying float isRear, mask;
  varying vec2 roadUV;

  void main() {
    float x = roadUV.x * 2.0 - 1.0;
    float t = roadUV.y;
    float spread = mix(.24, .63, t);
    float separation = mix(.49, .25, t);
    float lobe = (abs(x) - separation) / spread;
    float cones = exp(-2.0 * lobe * lobe);
    float edge = (1.0 - smoothstep(.64, 1.0, abs(x))) * (1.0 - smoothstep(.32, 1.0, t)) * smoothstep(0.0, .085, t);
    vec3 light = mix(vec3(.54, .72, .78), vec3(.82, .86, .79), t);
    float strength = cones * edge * night * .25;
    if (isRear > .5) {
      light = mix(vec3(1.0, .035, .016), vec3(.04, .44, 1.0), boost);
      strength = cones * edge * (.035 * night + .23 * brake + .28 * boost);
    }
    gl_FragColor = vec4(light, strength * mask);
    #include <colorspace_fragment>
  }`;

// One draw covers the twin headlamps and the reflection from the tail lamps.
// Only the deck carrying the car can receive their light.
export class RoadLights {
  constructor(scene, district) {
    this.sections = [];
    this.ambientNight = { neon: 1, dock: 0.65 }[district] ?? 0.03;
    const coords = [],
      tails = [],
      indices = [];
    for (const [rows, tail] of [
      [front, false],
      [rear, true],
    ]) {
      const start = coords.length / 2;
      for (let i = 0; i < rows.length; i++) {
        const t = rows[i] / rows.at(-1);
        this.sections.push({ distance: rows[i], t, tail });
        for (let side = 0; side < 3; side++) {
          coords.push(side / 2, t);
          tails.push(Number(tail));
          const n = start + i * 3 + side;
          if (i && side) indices.push(n - 4, n - 3, n, n - 4, n, n - 1);
        }
      }
    }
    this.positions = new THREE.Float32BufferAttribute(
      new Float32Array(tails.length * 3),
      3,
    );
    this.masks = new THREE.Float32BufferAttribute(
      new Float32Array(tails.length),
      1,
    );
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.masks.setUsage(THREE.DynamicDrawUsage);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", this.positions);
    this.geometry.setAttribute("surfaceMask", this.masks);
    this.geometry.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(coords, 2),
    );
    this.geometry.setAttribute(
      "rearLight",
      new THREE.Float32BufferAttribute(tails, 1),
    );
    this.geometry.setIndex(indices);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        night: { value: this.ambientNight },
        brake: { value: 0 },
        boost: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Player road lights";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    scene.add(this.mesh);
    this.probe = { x: 0, z: 0 };
    this.last = { x: NaN, z: NaN, yaw: NaN, road: null };
  }

  update(actor, world) {
    const { x, z } = actor.mesh.position;
    const yaw = actor.mesh.rotation.y;
    const road = actor.roadBranch;
    let night = this.ambientNight;
    if (!road && Number.isFinite(actor.courseDistance)) {
      for (const tunnel of world.tunnelSpans) {
        const gap = Math.abs(actor.courseDistance - tunnel.center);
        const inside = tunnel.half - Math.min(gap, world.courseLength - gap);
        night = Math.max(night, THREE.MathUtils.smoothstep(inside, -3, 5));
      }
    }
    this.material.uniforms.night.value = night;
    this.material.uniforms.brake.value = actor.mesh.userData.brakeAmount || 0;
    this.material.uniforms.boost.value = actor.boosting ? 1 : 0;
    if (
      x === this.last.x &&
      z === this.last.z &&
      yaw === this.last.yaw &&
      road === this.last.road
    )
      return;
    Object.assign(this.last, { x, z, yaw, road });

    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const bike = actor.spec.kind === "bike";
    let vertex = 0;
    for (const { distance, t, tail } of this.sections) {
      const length = (bike ? 1.15 : 2.05) + distance;
      const along = tail ? length : -length;
      const width = tail
        ? (bike ? 0.65 : 1.4) + t * 1.3
        : (bike ? 1.15 : 1.75) + t * 5.2;
      for (let side = -1; side <= 1; side++) {
        const px = x + c * side * width + s * along;
        const pz = z - s * side * width + c * along;
        let y = world.roadSurfaceY,
          mask = 1;
        if (road?.elevated) {
          this.probe.x = px;
          this.probe.z = pz;
          const at = nearestPointOnPath(this.probe, road.points, false);
          y = THREE.MathUtils.lerp(
            road.heightProfile[at.index],
            road.heightProfile[at.index + 1],
            at.fraction,
          );
          if (y > world.roadSurfaceY + 0.75)
            mask =
              1 -
              THREE.MathUtils.smoothstep(
                at.distance,
                road.halfWidth - 1,
                road.halfWidth + 0.25,
              );
        }
        this.positions.setXYZ(vertex, px, y + 0.105, pz);
        this.masks.setX(vertex++, mask);
      }
    }
    this.positions.needsUpdate = true;
    this.masks.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
