import * as THREE from "three";

// One bounded particle draw instead of a material/draw call for every spark.
export class Effects {
  constructor(scene) {
    this.capacity = 96;
    this.cursor = 0;
    this.positions = new Float32Array(this.capacity * 3);
    this.colors = new Float32Array(this.capacity * 3);
    this.sizes = new Float32Array(this.capacity);
    this.alphas = new Float32Array(this.capacity);
    this.styles = new Float32Array(this.capacity);
    this.origin = new THREE.Vector3();
    this.drawingSize = new THREE.Vector2();
    this.emitted = false;
    this.geometry = new THREE.BufferGeometry();
    for (const [name, values, size] of [
      ["position", this.positions, 3],
      ["color", this.colors, 3],
      ["particleSize", this.sizes, 1],
      ["opacity", this.alphas, 1],
      ["particleStyle", this.styles, 1],
    ]) {
      this.geometry.setAttribute(
        name,
        new THREE.BufferAttribute(values, size).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
    }
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { viewportHeight: { value: 720 } },
      vertexShader: `attribute float particleSize, opacity, particleStyle;
        attribute vec3 color; uniform float viewportHeight;
        varying vec3 tint; varying float alpha, style;
        void main(){
          vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p;
          gl_PointSize=clamp(particleSize*viewportHeight*.5*projectionMatrix[1][1]/max(1.,-p.z),1.,128.);
          tint=color; alpha=opacity; style=particleStyle;
        }`,
      fragmentShader: `varying vec3 tint; varying float alpha, style;
        void main(){
          vec2 q=(gl_PointCoord-.5)*2.;
          float r=length(q);
          if(r>1.||alpha<.001) discard;
          float density=pow(1.-r,1.8);
          if(style>0.) {
            float angle=atan(q.y,q.x);
            float edge=.79+.085*sin(3.*angle+style)+.067*cos(5.*angle-style);
            density=(1.-smoothstep(.16,edge,r))*(.78+.22*cos(q.x*6.+style)*sin(q.y*4.-style));
          }
          gl_FragColor=vec4(tint,alpha*density);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.group = new THREE.Points(this.geometry, this.material);
    this.group.frustumCulled = false;
    this.group.visible = false;
    this.group.onBeforeRender = (renderer) => {
      this.material.uniforms.viewportHeight.value =
        renderer.getDrawingBufferSize(this.drawingSize).y;
    };
    scene.add(this.group);
    this.pool = Array.from({ length: this.capacity }, () => ({
      life: 0,
      velocity: new THREE.Vector3(),
      color: new THREE.Color(),
    }));
  }
  emit(origin, color, count = 1, velocity = 1, options = {}) {
    this.emitted = true;
    for (let n = 0; n < Math.min(this.capacity, count); n++) {
      const index = this.cursor++ % this.capacity,
        p = this.pool[index],
        angle = Math.random() * Math.PI * 2;
      p.life = p.max =
        (options.life ?? 0.3) + Math.random() * (options.lifeJitter ?? 0.45);
      p.growth = options.growth ?? 1.8;
      p.opacity = options.opacity ?? 0.85;
      p.gravity = options.gravity ?? 2.5;
      const spread = options.spread ?? 0.7;
      this.positions.set(
        [
          origin.x + (Math.random() - 0.5) * spread,
          origin.y,
          origin.z + (Math.random() - 0.5) * spread,
        ],
        index * 3,
      );
      p.color.set(color);
      p.color.toArray(this.colors, index * 3);
      this.sizes[index] =
        (options.scale ?? 0.25) + Math.random() * (options.scaleJitter ?? 0.34);
      this.alphas[index] = p.opacity;
      this.styles[index] = options.smoke
        ? 0.01 + Math.random() * Math.PI * 2
        : 0;
      p.velocity.set(
        Math.cos(angle) * velocity * (0.3 + Math.random()),
        (options.lift ?? 0.3) + Math.random() * velocity * 0.3,
        Math.sin(angle) * velocity * (0.3 + Math.random()),
      );
      p.velocity.x += options.driftX ?? 0;
      p.velocity.z += options.driftZ ?? 0;
    }
  }
  tireSpray(actor, district, loose, reduced) {
    const bike = actor.spec.kind === "bike";
    const dirt = {
      mesa: 0xcaa182,
      coast: 0xc0b5a1,
      dock: 0x958e84,
      neon: 0x99958f,
    };
    const color = loose ? dirt[district] : 0xb5bfc2;
    const options = {
      smoke: true,
      life: loose ? 0.66 : 0.82,
      lifeJitter: 0.28,
      scale: bike ? 0.36 : 0.52,
      scaleJitter: 0.22,
      growth: 1.65,
      lift: 0.62,
      gravity: -0.65,
      spread: 0.12,
      driftX: actor.velocityX * 0.14,
      driftZ: actor.velocityZ * 0.14,
      opacity: (loose ? 0.34 : 0.4) * (reduced ? 0.5 : 1),
    };
    for (const wheel of actor.mesh.userData.wheels) {
      if (wheel.front || wheel.lod) continue;
      wheel.pivot.getWorldPosition(this.origin);
      this.origin.y -= wheel.radius * 0.76;
      this.emit(this.origin, color, 1, 0.55, options);
    }
  }

  exhaust(actor, reduced) {
    const yaw = actor.mesh.rotation.y;
    const options = {
      scale: 0.16,
      scaleJitter: 0.08,
      life: 0.12,
      lifeJitter: 0.13,
      lift: 0.08,
      spread: 0.055,
      opacity: reduced ? 0.3 : 0.66,
      growth: 0.5,
      gravity: 0,
      driftX: Math.sin(yaw) * 3,
      driftZ: Math.cos(yaw) * 3,
    };
    for (const flame of actor.mesh.userData.flames) {
      flame.getWorldPosition(this.origin);
      this.emit(this.origin, 0x60c5fa, 1, 0.32, options);
    }
  }

  update(dt) {
    let active = false;
    for (let i = 0; i < this.capacity; i++) {
      const p = this.pool[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.alphas[i] = 0;
        continue;
      }
      active = true;
      this.positions[i * 3] += p.velocity.x * dt;
      this.positions[i * 3 + 1] += p.velocity.y * dt;
      this.positions[i * 3 + 2] += p.velocity.z * dt;
      p.velocity.y -= p.gravity * dt;
      p.velocity.multiplyScalar(Math.exp(-dt * 1.8));
      this.alphas[i] = Math.min(1, (p.life / p.max) * 1.25) * p.opacity;
      this.sizes[i] *= Math.exp(dt * p.growth);
    }
    if (!active && !this.group.visible && !this.emitted) return;
    this.group.visible = active;
    const attributes = this.geometry.attributes;
    attributes.position.needsUpdate =
      attributes.particleSize.needsUpdate =
      attributes.opacity.needsUpdate =
        true;
    if (this.emitted) {
      attributes.color.needsUpdate =
        attributes.particleStyle.needsUpdate = true;
      this.emitted = false;
    }
  }
  dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
