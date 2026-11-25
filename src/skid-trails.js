import * as THREE from "three";
import { nearestPointOnPath } from "./road-projection.js";

export class SkidTrails {
  constructor(scene) {
    this.capacity = 384;
    this.cursor = 0;
    this.connected = false;
    this.changed = false;
    this.offset = new THREE.Vector3();
    this.previousOffset = new THREE.Vector3();
    this.positions = new Float32Array(this.capacity * 18);
    this.life = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity * 6);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.geometry.setAttribute(
      "opacity",
      new THREE.BufferAttribute(this.alphas, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const tread = new Float32Array(this.capacity * 6);
    for (let i = 0; i < this.capacity; i++)
      tread.set([0, 1, 1, 0, 1, 0], i * 6);
    this.geometry.setAttribute("tread", new THREE.BufferAttribute(tread, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      side: THREE.DoubleSide,
      vertexShader: `attribute float opacity, tread; varying float alpha, across;
        void main(){alpha=opacity;across=tread;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float alpha, across;
        void main(){
          if(alpha<.001) discard;
          float edge=smoothstep(0.,.11,min(across,1.-across));
          float groove=smoothstep(.015,.052,abs(abs(across-.5)-.20));
          gl_FragColor=vec4(.016,.020,.023,alpha*edge*mix(.51,1.,groove));
        }`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  sample(actor, world, marking) {
    if (!marking || !actor.onRoad) {
      this.connected = false;
      return;
    }
    if (this.vehicle !== actor.mesh) {
      this.vehicle = actor.mesh;
      this.wheels = actor.mesh.userData.wheels.filter(
        (wheel) => !wheel.front && !wheel.lod,
      );
      this.current = this.wheels.map(() => new THREE.Vector3());
      this.previous = this.wheels.map(() => new THREE.Vector3());
      this.connected = false;
    }
    if (!this.wheels.length) return;
    const ramp = actor.roadBranch;
    for (let i = 0; i < this.wheels.length; i++) {
      const point = this.wheels[i].pivot.getWorldPosition(this.current[i]);
      let height = world.roadSurfaceY;
      if (ramp?.elevated) {
        const at = nearestPointOnPath(point, ramp.points, false);
        height = THREE.MathUtils.lerp(
          ramp.heightProfile[at.index],
          ramp.heightProfile[at.index + 1],
          at.fraction,
        );
      }
      point.y = height + 0.018;
    }
    const yaw = actor.mesh.rotation.y;
    const halfWidth = actor.spec?.kind === "bike" ? 0.071 : 0.114;
    this.offset.set(Math.cos(yaw) * halfWidth, 0, -Math.sin(yaw) * halfWidth);
    if (this.connected) {
      const distance = this.current[0].distanceTo(this.previous[0]);
      if (distance < 0.18) return;
      if (distance < 3) {
        for (let wheel = 0; wheel < this.current.length; wheel++) {
          const index = this.cursor++ % this.capacity;
          for (let vertex = 0; vertex < 6; vertex++) {
            const end = vertex === 2 || vertex >= 4;
            const p = end ? this.current[wheel] : this.previous[wheel];
            const offset = end ? this.offset : this.previousOffset;
            const side = vertex === 1 || vertex === 2 || vertex === 4 ? 1 : -1;
            const at = index * 18 + vertex * 3;
            this.positions[at] = p.x + side * offset.x;
            this.positions[at + 1] = p.y;
            this.positions[at + 2] = p.z + side * offset.z;
          }
          this.life[index] = 12;
        }
        this.changed = true;
      }
    }
    [this.previous, this.current] = [this.current, this.previous];
    this.previousOffset.copy(this.offset);
    this.connected = true;
  }
  update(dt) {
    if (!this.changed && !this.mesh.visible) return;
    let active = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] = Math.max(0, this.life[i] - dt);
      const alpha = Math.min(0.48, this.life[i] * 0.14);
      this.alphas.fill(alpha, i * 6, i * 6 + 6);
      active ||= alpha > 0;
    }
    this.mesh.visible = active;
    if (this.changed) this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;
    this.changed = false;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
