import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { World } from "./world.js";
import { createVehicle, animateVehicle } from "./vehicle.js";
import { vehicles } from "./data.js";
import { Effects } from "./effects.js";
import { AudioEngine } from "./audio.js";

const clamp = THREE.MathUtils.clamp;
const mod = (a, n) => ((a % n) + n) % n;

const LOW_POWER_DEVICE = (() => {
  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  const touch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;

  const memory =
    typeof navigator !== "undefined" ? navigator.deviceMemory || 8 : 8;

  return Boolean(coarse || touch || cores <= 4 || memory <= 4);
})();

export class Game {
  constructor(stage, callbacks = {}) {
    this.stage = stage;

    this.callbacks = callbacks;

    this.clock = new THREE.Clock();

    this.keys = {};

    this.actors = [];

    this.remotes = new Map();

    this.running = false;

    this.lastNetwork = 0;

    this.audio = new AudioEngine();

    this.fxTimer = 0;

    this.lowPower = LOW_POWER_DEVICE;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: this.lowPower ? "low-power" : "high-performance",
    });

    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, this.lowPower ? 1 : 1.35),
    );

    this.renderer.setSize(innerWidth, innerHeight);

    this.renderer.setClearColor(0x07111d, 1);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.shadowMap.enabled = !this.lowPower;

    this.renderer.shadowMap.type = this.lowPower
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;

    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.renderer.toneMappingExposure = this.lowPower ? 1.16 : 1.28;

    this.renderer.domElement.className = "game-canvas";

    this.stage.append(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      65,
      innerWidth / innerHeight,
      0.1,
      800,
    );

    this.composer = new EffectComposer(this.renderer);

    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(innerWidth, innerHeight),
        this.lowPower ? 0.28 : 0.46,
        this.lowPower ? 0.38 : 0.5,
        0.84,
      ),
    );

    this.listen();

    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;

      this.camera.updateProjectionMatrix();

      this.renderer.setSize(innerWidth, innerHeight);

      this.composer.setSize(innerWidth, innerHeight);
    };

    addEventListener("resize", this.resize);
  }

  listen() {
    addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }

      if (e.code === "Escape" && this.running) {
        this.togglePause();
      }
    });

    addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }

  mountPreview(host, spec, color) {
    this.clearPreview();

    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: this.lowPower ? "low-power" : "high-performance",
    });

    renderer.setPixelRatio(Math.min(devicePixelRatio, this.lowPower ? 1 : 1.2));

    renderer.outputColorSpace = THREE.SRGBColorSpace;

    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    renderer.toneMappingExposure = 1.18;

    renderer.shadowMap.enabled = !this.lowPower;

    renderer.shadowMap.type = this.lowPower
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;

    renderer.domElement.className = "preview-canvas";

    host.append(renderer.domElement);

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x060a12);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 120);

    const stage = new THREE.Group();

    scene.add(stage);

    const vehicle = createVehicle(spec, color);

    stage.add(vehicle);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1320,
      roughness: 0.32,
      metalness: 0.82,
    });

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(5.1, 5.1, 0.18, 64),
      floorMat,
    );

    floor.position.y = -0.55;

    floor.receiveShadow = true;

    stage.add(floor);

    const innerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x111d31,
      roughness: 0.22,
      metalness: 0.65,
      emissive: 0x07182a,
      emissiveIntensity: 0.35,
    });

    const innerFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.35, 4.35, 0.08, 64),
      innerFloorMat,
    );

    innerFloor.position.y = -0.44;

    stage.add(innerFloor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(4.55, 0.035, 8, 96),
      new THREE.MeshBasicMaterial({
        color: 0x55dcff,
        transparent: true,
        opacity: 0.72,
      }),
    );

    ring.rotation.x = Math.PI / 2;

    ring.position.y = -0.32;

    stage.add(ring);

    const rearGlow = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 64),
      new THREE.MeshBasicMaterial({
        color: 0x351b62,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );

    rearGlow.rotation.x = -Math.PI / 2;

    rearGlow.position.y = -0.31;

    stage.add(rearGlow);

    const hemi = new THREE.HemisphereLight(0xbcecff, 0x100d1b, 1.9);

    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xeaf8ff, 4.2);

    key.position.set(5.5, 8.5, 6);

    key.castShadow = !this.lowPower;

    if (!this.lowPower) {
      key.shadow.mapSize.set(1024, 1024);
    }

    key.shadow.camera.near = 0.1;

    key.shadow.camera.far = 45;

    key.shadow.camera.left = -8;

    key.shadow.camera.right = 8;

    key.shadow.camera.top = 8;

    key.shadow.camera.bottom = -8;

    scene.add(key);

    const rim = new THREE.DirectionalLight(0x7f55ff, 5.0);

    rim.position.set(-6, 4.5, -5);

    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x4de8ff, 2.2);

    fill.position.set(7, 2.5, -5);

    scene.add(fill);

    const frontGlow = new THREE.PointLight(0x48dfff, 7, 15, 2);

    frontGlow.position.set(0, 1.2, -4.5);

    scene.add(frontGlow);

    const backGlow = new THREE.PointLight(0xe948ff, 8, 15, 2);

    backGlow.position.set(0, 2.5, 3.6);

    scene.add(backGlow);

    const accentA = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 4.8, 0.08),
      new THREE.MeshBasicMaterial({
        color: 0x52e8ff,
        transparent: true,
        opacity: 0.3,
      }),
    );

    accentA.position.set(-5.7, 2.0, -1.2);

    stage.add(accentA);

    const accentB = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 4.8, 0.08),
      new THREE.MeshBasicMaterial({
        color: 0xff48cf,
        transparent: true,
        opacity: 0.22,
      }),
    );

    accentB.position.set(5.4, 2.0, 1.5);

    stage.add(accentB);

    const box = new THREE.Box3().setFromObject(vehicle);

    const center = box.getCenter(new THREE.Vector3());

    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);

    const scale =
      spec.kind === "bike" ? 1.1 : spec.kind === "heavy" ? 0.82 : 0.98;

    const targetY = Math.max(0.05, -box.min.y + 0.1);

    vehicle.position.y += targetY;

    stage.position.y -= center.y * 0.06;

    const distance = Math.max(5.4, maxDim * (1.55 / scale));

    const angle =
      spec.kind === "bike" ? 0.82 : spec.kind === "heavy" ? 0.72 : 0.74;

    camera.position.set(
      Math.sin(angle) * distance,
      Math.max(2.1, size.y * 0.7 + 2.0),
      Math.cos(angle) * distance,
    );

    camera.lookAt(0, Math.max(0.55, size.y * 0.42), 0);

    let active = true;

    let time = 0;

    let width = 520;
    let height = 330;

    const resize = () => {
      const rect = host.getBoundingClientRect();

      width = Math.max(180, Math.floor(rect.width || 520));

      height = Math.max(180, Math.floor(rect.height || 330));

      renderer.setSize(width, height, false);

      camera.aspect = width / height;

      camera.updateProjectionMatrix();
    };

    resize();

    const observer = new ResizeObserver(resize);

    observer.observe(host);

    const cleanupMaterial = (material) => material?.dispose?.();

    const tick = () => {
      if (!active) {
        return;
      }

      time += 0.0085;

      stage.rotation.y = Math.sin(time * 0.5) * 0.08 + time * 0.34;

      const hover = Math.sin(time * 2.1) * 0.025;

      vehicle.position.y += (targetY + hover - vehicle.position.y) * 0.06;

      animateVehicle(vehicle, 0, false, time, 0, false, false);

      ring.rotation.z = time * 0.28;

      ring.material.opacity = 0.53 + Math.sin(time * 2.1) * 0.13;

      renderer.render(scene, camera);

      this.previewFrame = requestAnimationFrame(tick);
    };

    tick();

    this.preview = {
      renderer,
      active,
      observer,
      scene,

      dispose: () => {
        observer.disconnect();

        scene.traverse((o) => {
          if (o.geometry) {
            o.geometry.dispose?.();
          }

          if (Array.isArray(o.material)) {
            o.material.forEach(cleanupMaterial);
          } else {
            cleanupMaterial(o.material);
          }
        });
      },
    };
  }

  clearPreview() {
    if (this.preview) {
      this.preview.active = false;

      cancelAnimationFrame(this.previewFrame);

      this.preview.dispose?.();

      this.preview.renderer.domElement.remove();

      this.preview.renderer.dispose();

      this.preview = null;
    }
  }

  async start(config) {
    this.clearPreview();

    this.stop();

    this.config = config;

    this.scene.clear();

    this.actors = [];

    this.remotes.clear();

    this.world = new World(this.scene, config.map);

    this.effects = new Effects(this.scene);

    this.actorGroup = new THREE.Group();

    this.actorGroup.name = "GameplayActors";

    this.scene.add(this.actorGroup);

    this.audio.start();

    const hemi = new THREE.HemisphereLight(
      0xa9dfff,
      0x1a1420,
      this.lowPower ? 1.75 : 2.1,
    );

    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(
      0xffdcc4,
      this.lowPower ? 2.65 : 3.1,
    );

    sun.position.set(-60, 90, 35);

    sun.castShadow = !this.lowPower;

    if (!this.lowPower) {
      sun.shadow.mapSize.set(1024, 1024);

      sun.shadow.camera.left = -140;

      sun.shadow.camera.right = 140;

      sun.shadow.camera.top = 140;

      sun.shadow.camera.bottom = -140;
    }

    this.scene.add(sun);

    this.scene.add(new THREE.AmbientLight(0x273149, 1.1));

    this.player = this.makeActor(config.vehicle, config.color, false, "YOU");

    this.player.mesh.position.copy(this.world.route[0]);

    this.player.mesh.position.y = 0.05;

    this.player.mesh.rotation.y = this.routeAngle(0);

    this.player.next = 1;

    this.player.lap = 0;

    this.player.health = 100;

    this.player.boost = 100;

    this.player.progress = 0;

    this.addPlayerLights();

    this.actors.push(this.player);

    if (config.mode.id === "race") {
      for (let i = 0; i < Math.min(5, config.aiCount || 5); i++) {
        this.spawnAI(i, "race");
      }
    }

    this.world.setNextMarker(this.player.next);

    this.camera.position
      .copy(this.player.mesh.position)
      .add(new THREE.Vector3(10, 7, 13));

    this.running = true;

    this.phase = "countdown";

    this.countdown = 3.2;

    this.elapsed = 0;

    this.time = 0;

    this.heat = 1;

    this.paused = false;

    this.finishTimer = 0;

    this.shake = 0;

    this.clock.start();

    this.frame();
  }

  stop() {
    this.running = false;

    this.audio.stop();

    if (this.actorGroup) {
      this.actorGroup.traverse((object) => {
        if (object.geometry?.userData?.disposeWithActor) {
          object.geometry.dispose?.();
        }

        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (material.userData?.disposeWithActor) {
              material.dispose?.();
            }
          });
        } else if (object.material?.userData?.disposeWithActor) {
          object.material?.dispose?.();
        }
      });

      this.actorGroup.removeFromParent();

      this.actorGroup = null;
    }

    if (this.effects) {
      this.effects.dispose();

      this.effects = null;
    }

    if (this.world) {
      this.world.dispose();

      this.world = null;
    }
  }

  makeActor(spec, color, police = false, name = "DRIVER") {
    const mesh = createVehicle(spec, color);

    this.actorGroup?.add(mesh);

    return {
      mesh,
      spec,
      name,
      police,
      role: police ? "police" : "racer",
      speed: 0,
      next: 1,
      lap: 0,
      progress: 0,
      health: 100,
      boost: 100,
      onRoad: true,
      remote: false,
    };
  }

  addPlayerLights() {
    if (this.lowPower) {
      return;
    }

    const headMat = new THREE.MeshBasicMaterial({
      color: 0xf7fbff,
    });

    const rearMat = new THREE.MeshBasicMaterial({
      color: 0xff4b63,
    });

    const head = new THREE.PointLight(0xdff8ff, 3.2, 28, 2);

    const rear = new THREE.PointLight(0xff405b, 1.4, 14, 2);

    head.position.set(0, 0.85, -2.0);

    rear.position.set(0, 0.55, 2.2);

    this.player.mesh.add(head, rear);

    void headMat;
    void rearMat;
  }

  spawnAI(i, role = "racer") {
    const spec = vehicles[(i + 1) % vehicles.length];

    const a = this.makeActor(
      spec,
      spec.color,
      role === "police",
      role === "police" ? `POLICE ${i + 1}` : `RIVAL ${i + 1}`,
    );

    const h = this.routeAngle(0);

    const forward = new THREE.Vector3(-Math.sin(h), 0, -Math.cos(h));

    const side = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));

    if (role === "police") {
      a.mesh.position.copy(
        this.world.route[mod(i + 5, this.world.route.length)],
      );

      a.mesh.position.add(new THREE.Vector3((i - 1) * 3, 0.05, i));
    } else {
      a.mesh.position.copy(this.world.route[0]);

      a.mesh.position
        .addScaledVector(forward, -8 - i * 4)
        .addScaledVector(side, (i - 1) * 3.2);
    }

    a.mesh.position.y = 0.05;

    a.mesh.rotation.y = h;

    a.next = 1;

    a.role = role;

    a.skill =
      ({
        easy: 0.73,
        medium: 0.87,
        hard: 1.02,
      }[this.config.difficulty || "medium"] || 0.87) +
      i * 0.035;

    this.actors.push(a);
  }

  routeAngle(i) {
    const a = this.world.route[i];

    const b = this.world.route[(i + 1) % this.world.route.length];

    return Math.atan2(a.x - b.x, a.z - b.z);
  }

  updatePlayer(dt) {
    const p = this.player;

    const k = this.keys;

    const pad = [...(navigator.getGamepads?.() || [])].find(Boolean);

    let gas = k.KeyW || k.ArrowUp;

    let brake = k.KeyS || k.ArrowDown;

    let left = k.KeyA || k.ArrowLeft;

    let right = k.KeyD || k.ArrowRight;

    let hand = k.Space;

    let boost = (k.ShiftLeft || k.ShiftRight) && p.boost > 1 && p.speed > 10;

    if (pad) {
      gas ||= pad.buttons[7]?.value || pad.buttons[0]?.pressed;

      brake ||= pad.buttons[6]?.value || pad.buttons[1]?.pressed;

      left ||= pad.axes[0] < -0.18;

      right ||= pad.axes[0] > 0.18;

      hand ||= pad.buttons[2]?.pressed;

      boost ||= pad.buttons[5]?.pressed && p.boost > 1;
    }

    const max = 12 + p.spec.top * 0.42;

    const acc = 4 + p.spec.accel * 0.105;

    const brakeForce = 5 + p.spec.braking * 0.08;

    if (gas) {
      p.speed += acc * dt;
    } else if (brake) {
      p.speed -= brakeForce * dt;
    } else {
      p.speed *= Math.pow(hand ? 0.91 : 0.975, dt * 60);
    }

    if (boost) {
      p.speed += 21 * dt;

      p.boost = Math.max(0, p.boost - 20 * dt);
    } else {
      p.boost = Math.min(100, p.boost + 5.5 * dt);
    }

    p.speed = clamp(p.speed, -max * 0.32, max * (boost ? 1.17 : 1));

    const steer = (right ? 1 : 0) - (left ? 1 : 0);

    const bike = p.spec.kind === "bike";

    const heavy = p.spec.kind === "heavy";

    const drifting = hand && Math.abs(p.speed) > 11;

    const grip =
      (0.45 + p.spec.handling * 0.009) * (bike ? 1.15 : heavy ? 0.73 : 1);

    const turn =
      -steer *
      (0.5 + grip) *
      dt *
      (p.speed >= 0 ? 1 : -1) *
      clamp(Math.abs(p.speed) / 10, 0.15, 1.22) *
      (drifting ? 1.82 : 1);

    p.mesh.rotation.y += turn;

    p.mesh.position.x -= Math.sin(p.mesh.rotation.y) * p.speed * dt;

    p.mesh.position.z -= Math.cos(p.mesh.rotation.y) * p.speed * dt;

    const radius = Math.hypot(p.mesh.position.x, p.mesh.position.z);

    if (radius > 210) {
      p.mesh.position.multiplyScalar(210 / radius);

      p.speed *= -0.35;

      this.shake = 1;
    }

    const roadDistance = this.world.distanceToRoad(p.mesh.position);

    p.onRoad = roadDistance < 10.5;

    if (!p.onRoad) {
      p.speed *= Math.pow(0.93, dt * 18);

      if (roadDistance > 24) {
        p.speed *= -0.34;

        this.shake = 0.8;
      }
    }

    animateVehicle(p.mesh, p.speed, boost, this.time, -steer, brake, drifting);

    this.audio.update(p.speed, boost);

    this.fxTimer -= dt;

    if (this.fxTimer <= 0 && (boost || drifting)) {
      this.fxTimer = boost ? 0.028 : 0.055;

      const rear = new THREE.Vector3(
        Math.sin(p.mesh.rotation.y),
        0.35,
        Math.cos(p.mesh.rotation.y),
      );

      this.effects?.emit(
        p.mesh.position.clone().addScaledVector(rear, boost ? 2.2 : 1.7),
        boost ? 0x31dfff : 0xcbd6de,
        boost ? 2 : 1,
        boost ? 2.6 : 0.7,
      );
    }

    this.checkProgress(p);

    if (this.collisions(p)) {
      p.health = Math.max(0, p.health - 4 * dt);

      this.shake = 0.7;

      this.effects?.emit(p.mesh.position, 0xffb45b, 5, 4);

      this.audio.blip(94, 0.12);
    }
  }

  updateAI(a, dt) {
    let target;

    if (a.role === "police") {
      target = this.player.mesh.position;
    } else {
      target = this.world.route[a.next];
    }

    const dx = target.x - a.mesh.position.x;

    const dz = target.z - a.mesh.position.z;

    const desired = Math.atan2(-dx, -dz);

    let delta =
      mod(desired - a.mesh.rotation.y + Math.PI, Math.PI * 2) - Math.PI;

    a.mesh.rotation.y +=
      clamp(delta, -1.5 * dt, 1.5 * dt) * (a.role === "police" ? 1.5 : 1);

    const max =
      (9 + a.spec.top * 0.35) *
      (a.role === "police" ? 1.02 + (this.heat - 1) * 0.055 : a.skill);

    a.speed = THREE.MathUtils.lerp(
      a.speed,
      max,
      dt * (a.role === "police" ? 1.4 : 0.72),
    );

    a.mesh.position.x -= Math.sin(a.mesh.rotation.y) * a.speed * dt;

    a.mesh.position.z -= Math.cos(a.mesh.rotation.y) * a.speed * dt;

    if (a.role !== "police" && Math.hypot(dx, dz) < 14) {
      const hit = a.next;

      a.next = (a.next + 1) % this.world.route.length;

      if (hit === 0) {
        a.lap++;

        if (this.config.mode.id === "race" && a.lap >= 3) {
          this.finish(`${a.name} WINS`);
        }
      }
    }

    if (
      a.role !== "police" &&
      this.world.distanceToRoad(a.mesh.position) > 28
    ) {
      a.mesh.position.lerp(this.world.route[a.next], dt * 0.8);
    }

    if (a.role === "police" && Math.hypot(dx, dz) < 5) {
      this.player.health = Math.max(0, this.player.health - 8 * dt);

      this.shake = 1;
    }

    animateVehicle(a.mesh, a.speed, false, this.time, delta, false, false);
  }

  updateRemote(a, dt) {
    if (!a.target) {
      return;
    }

    a.mesh.position.lerp(a.target.position, clamp(dt * 12, 0, 1));

    a.mesh.rotation.y = THREE.MathUtils.lerp(
      a.mesh.rotation.y,
      a.target.rotation,
      clamp(dt * 12, 0, 1),
    );

    animateVehicle(a.mesh, a.target.speed || 0, false, this.time);
  }

  collisions(p) {
    let hit = false;

    for (const a of this.actors) {
      if (a === p || a.remote) {
        continue;
      }

      const d = p.mesh.position.distanceTo(a.mesh.position);

      const limit =
        (p.mesh.userData.radius || 2) + (a.mesh.userData.radius || 2);

      if (d < limit * 0.72) {
        hit = true;

        const away = p.mesh.position.clone().sub(a.mesh.position);

        if (away.lengthSq() < 0.1) {
          away.set(1, 0, 0);
        }

        away.normalize();

        p.mesh.position.addScaledVector(away, 0.28);

        p.speed *= p.spec.kind === "heavy" ? 0.98 : 0.88;
      }
    }

    return hit;
  }

  checkProgress(p) {
    const point = this.world.route[p.next];

    if (p.mesh.position.distanceTo(point) < 13) {
      const hit = p.next;

      p.next = (p.next + 1) % this.world.route.length;

      if (hit === 0) {
        p.lap++;

        if (this.config.mode.id === "race" && p.lap >= 3) {
          this.finish("FIRST PLACE");
        }

        if (this.config.mode.id === "time") {
          this.finish("TIME RECORDED");
        }

        if (["escape", "versus", "friend"].includes(this.config.mode.id)) {
          this.finish("ESCAPED THE HEAT");
        }
      }

      p.progress = p.lap * this.world.route.length + p.next;

      this.world.setNextMarker(p.next);
    }
  }

  remotePosition(id, data) {
    let a = this.remotes.get(id);

    if (!a) {
      const spec = vehicles.find((v) => v.name === data.vehicle) || vehicles[0];

      a = this.makeActor(spec, data.color || "#ffffff", false, "LAN DRIVER");

      a.remote = true;

      this.remotes.set(id, a);

      this.actors.push(a);
    }

    a.target = {
      position: new THREE.Vector3(data.x, 0.22, data.z),
      rotation: data.rotation,
      speed: data.speed,
    };
  }

  addRemotePlayer(player) {
    if (player.id === this.config.network?.id || this.remotes.has(player.id)) {
      return;
    }

    const spec = vehicles.find((v) => v.name === player.vehicle) || vehicles[0];

    const a = this.makeActor(spec, player.color, false, player.name);

    a.remote = true;

    a.mesh.position.copy(this.world.route[0]);

    a.mesh.position.add(new THREE.Vector3(4 + this.remotes.size * 3, 0.22, 0));

    this.remotes.set(player.id, a);

    this.actors.push(a);
  }

  setRemotePlayers(players) {
    players.forEach((p) => this.addRemotePlayer(p));
  }

  finish(title) {
    if (this.phase === "finished") {
      return;
    }

    this.phase = "finished";

    this.finishTimer = 3;

    let best;

    if (this.config.mode.id === "time") {
      const key = `nightshift-best-${this.world.map.id}`;

      const previous = Number(localStorage.getItem(key) || 0);

      best = !previous || this.elapsed < previous ? this.elapsed : previous;

      localStorage.setItem(key, String(best));

      if (best === this.elapsed) {
        title = "NEW PERSONAL BEST";
      }
    }

    this.config.network?.send({
      type: "event",
      event: {
        type: "finish",
        title,
        time: this.elapsed,
        mode: this.config.mode.id,
      },
    });

    this.callbacks.result?.({
      title,
      time: this.elapsed,
      mode: this.config.mode.title,
      best,
    });
  }

  remoteFinish(event) {
    if (this.phase === "finished") {
      return;
    }

    this.phase = "finished";

    this.finishTimer = 3;

    this.callbacks.result?.({
      title: event.title || "RACE COMPLETE",
      time: event.time || this.elapsed,
      mode: this.config.mode.title,
    });
  }

  updatePoliceHeat() {
    if (this.config.mode.id !== "escape") {
      return;
    }

    this.heat = Math.min(
      5,
      1 +
        Math.floor(this.elapsed / 15) +
        Math.floor((100 - this.player.health) / 30),
    );

    let cops = this.actors.filter((a) => a.role === "police").length;

    while (cops < this.heat) {
      this.spawnAI(cops, "police");

      cops++;
    }
  }

  togglePause() {
    if (this.phase === "finished") {
      return;
    }

    this.paused = !this.paused;

    this.callbacks.pause?.(this.paused);
  }

  frame() {
    if (!this.running) {
      return;
    }

    requestAnimationFrame(() => this.frame());

    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.paused) {
      this.composer.render();
      return;
    }

    this.time += dt;

    if (this.phase === "countdown") {
      this.countdown -= dt;

      const value =
        this.countdown > 2
          ? "3"
          : this.countdown > 1
            ? "2"
            : this.countdown > 0
              ? "1"
              : "GO!";

      this.callbacks.countdown?.(value);

      if (this.countdown <= -0.7) {
        this.phase = "play";

        this.callbacks.countdown?.("");
      }
    } else if (this.phase === "play") {
      this.elapsed += dt;

      this.updatePoliceHeat();

      this.updatePlayer(dt);

      for (const a of this.actors) {
        if (a === this.player) {
          continue;
        }

        if (a.remote) {
          this.updateRemote(a, dt);
        } else {
          this.updateAI(a, dt);
        }
      }

      if (this.player.health <= 0) {
        this.finish("BUSTED");
      }

      if (this.config.network && this.time - this.lastNetwork > 0.05) {
        this.lastNetwork = this.time;

        this.config.network.position({
          x: this.player.mesh.position.x,

          z: this.player.mesh.position.z,

          rotation: this.player.mesh.rotation.y,

          speed: this.player.speed,

          vehicle: this.player.spec.name,

          color: this.config.color,

          next: this.player.next,

          lap: this.player.lap,
        });
      }
    } else if (this.phase === "finished") {
      this.finishTimer -= dt;

      if (this.finishTimer < 0) {
        this.stop();
      }
    }

    this.world.update(dt, this.time);

    this.effects?.update(dt);

    this.updateCamera(dt);

    this.callbacks.hud?.(this.hudState());

    this.composer.render();
  }

  updateCamera(dt) {
    const p = this.player.mesh.position;

    const h = this.player.mesh.rotation.y;

    const spd = Math.abs(this.player.speed);

    const drift = this.player.mesh.userData.drifting;

    const back = 6.8 + spd * 0.035;

    const desired = new THREE.Vector3(
      p.x + Math.sin(h) * back,

      p.y + 2.85 + spd * 0.016,

      p.z + Math.cos(h) * back,
    );

    this.camera.position.lerp(desired, 1 - Math.pow(0.00055, dt));

    const look = p.clone().add(
      new THREE.Vector3(
        -Math.sin(h) * (8.4 + spd * 0.06),

        1.05 + Math.min(spd * 0.008, 0.55),

        -Math.cos(h) * (8.4 + spd * 0.06),
      ),
    );

    if (this.shake > 0) {
      look.x += (Math.random() - 0.5) * this.shake;

      look.y += (Math.random() - 0.5) * this.shake;

      this.shake = Math.max(0, this.shake - dt * 2.7);
    }

    this.camera.lookAt(look);

    this.camera.fov = THREE.MathUtils.lerp(
      this.camera.fov,
      61 + clamp(spd * 0.1, 0, 7) + (drift ? 1.4 : 0),
      dt * 4,
    );

    this.camera.updateProjectionMatrix();
  }

  hudState() {
    const p = this.player;

    const pursuit = ["escape", "versus", "friend"].includes(
      this.config.mode.id,
    );

    const rank =
      1 +
      this.actors.filter(
        (a) =>
          a !== p &&
          !a.police &&
          a.lap * this.world.route.length + a.next >
            p.lap * this.world.route.length + p.next,
      ).length;

    return {
      speed: Math.round(Math.abs(p.speed) * 5.7),

      boost: p.boost,

      health: p.health,

      lap: p.lap + 1,

      next: p.next || this.world.route.length,

      targetIndex: p.next,

      total: this.world.route.length,

      time: this.elapsed,

      wanted: pursuit
        ? this.config.mode.id === "escape"
          ? this.heat
          : Math.max(1, Math.ceil((100 - p.health) / 20) + 1)
        : 0,

      rank,

      map: this.world.map,

      player: p,

      actors: this.actors,
    };
  }
}
