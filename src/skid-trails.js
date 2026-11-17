import * as THREE from 'three';

export class SkidTrails {
  constructor(scene) {
    this.capacity = 384; this.cursor = 0; this.previous = null;
    this.positions = new Float32Array(this.capacity * 18);
    this.life = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity * 6);
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, side: THREE.DoubleSide,
      vertexShader: `attribute float opacity; varying float alpha; void main(){alpha=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying float alpha; void main(){if(alpha<.001)discard;gl_FragColor=vec4(.016,.020,.023,alpha);}`,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material); this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  sample(actor, world, marking) {
    if (!marking || !actor.onRoad) { this.previous = null; return; }
    const p = actor.mesh.position, yaw = actor.mesh.rotation.y;
    const rear = actor.mesh.userData.wheels.filter(w => !w.front && !w.lod);
    if (!rear.length) return;
    const points = rear.map(w => {
      const x = p.x + Math.cos(yaw) * w.pivot.position.x + Math.sin(yaw) * w.pivot.position.z;
      const z = p.z - Math.sin(yaw) * w.pivot.position.x + Math.cos(yaw) * w.pivot.position.z;
      return new THREE.Vector3(x, world.getRoadHeightAt(x, z) + .018, z);
    });
    if (this.previous && this.previous.length === points.length) {
      const travel = points[0].distanceTo(this.previous[0]);
      if (travel < .18) return;
      if (travel < 3) points.forEach((b, wheel) => {
        const a = this.previous[wheel], offset = new THREE.Vector3(Math.cos(yaw) * .09, 0, -Math.sin(yaw) * .09);
        const corners = [a.clone().sub(offset), a.clone().add(offset), b.clone().add(offset), b.clone().sub(offset)];
        const index = this.cursor++ % this.capacity;
        [0, 1, 2, 0, 2, 3].forEach((corner, vertex) => corners[corner].toArray(this.positions, index * 18 + vertex * 3));
        this.life[index] = 12;
      });
    }
    this.previous = points;
  }
  update(dt) {
    let active = false;
    for (let i = 0; i < this.capacity; i++) {
      this.life[i] = Math.max(0, this.life[i] - dt);
      const alpha = Math.min(.38, this.life[i] * .12);
      this.alphas.fill(alpha, i * 6, i * 6 + 6); active ||= alpha > 0;
    }
    this.mesh.visible = active;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
