import * as THREE from 'three';

// One bounded particle draw instead of a material/draw call for every spark.
export class Effects {
  constructor(scene) {
    this.capacity = 96; this.cursor = 0;
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity);
    this.geometry = new THREE.BufferGeometry();
    for (const [name, values, size] of [['position', this.positions, 3], ['color', this.colors, 3],
      ['particleSize', this.sizes, 1], ['opacity', this.alphas, 1]]) {
      this.geometry.setAttribute(name, new THREE.BufferAttribute(values, size).setUsage(THREE.DynamicDrawUsage));
    }
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: `attribute float particleSize; attribute float opacity; attribute vec3 color;
        varying vec3 tint; varying float alpha;
        void main(){ vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p;
          gl_PointSize=clamp(particleSize*450./max(1.,-p.z),1.,64.); tint=color; alpha=opacity; }`,
      fragmentShader: `varying vec3 tint; varying float alpha;
        void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.||alpha<.001) discard;
          gl_FragColor=vec4(tint,alpha*pow(1.-r,1.8));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.group = new THREE.Points(this.geometry, this.material);
    this.group.frustumCulled = false; scene.add(this.group);
    this.pool = Array.from({ length: this.capacity }, () => ({ life: 0, velocity: new THREE.Vector3(), color: new THREE.Color() }));
  }
  emit(origin, color, count = 1, velocity = 1, options = {}) {
    for (let n = 0; n < Math.min(this.capacity, count); n++) {
      const index = this.cursor++ % this.capacity, p = this.pool[index], angle = Math.random() * Math.PI * 2;
      p.life = p.max = (options.life ?? .3) + Math.random() * (options.lifeJitter ?? .45);
      p.growth = options.growth ?? 1.8; p.opacity = options.opacity ?? .85; p.gravity = options.gravity ?? 2.5;
      const spread = options.spread ?? .7;
      this.positions.set([origin.x + (Math.random() - .5) * spread, origin.y, origin.z + (Math.random() - .5) * spread], index * 3);
      p.color.set(color); p.color.toArray(this.colors, index * 3);
      this.sizes[index] = (options.scale ?? .25) + Math.random() * (options.scaleJitter ?? .34);
      this.alphas[index] = p.opacity;
      p.velocity.set(Math.cos(angle) * velocity * (.3 + Math.random()),
        (options.lift ?? .3) + Math.random() * velocity * .3, Math.sin(angle) * velocity * (.3 + Math.random()));
    }
  }
  update(dt) {
    let active = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { this.alphas[i] = 0; continue; }
      active = true;
      this.positions[i * 3] += p.velocity.x * dt;
      this.positions[i * 3 + 1] += p.velocity.y * dt;
      this.positions[i * 3 + 2] += p.velocity.z * dt;
      p.velocity.y -= p.gravity * dt; p.velocity.multiplyScalar(Math.exp(-dt * 1.8));
      this.alphas[i] = Math.min(1, p.life / p.max * 1.25) * p.opacity;
      this.sizes[i] *= Math.exp(dt * p.growth);
    }
    this.group.visible = active;
    for (const attribute of Object.values(this.geometry.attributes)) attribute.needsUpdate = true;
  }
  dispose() { this.group.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
