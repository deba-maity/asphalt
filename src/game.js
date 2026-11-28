import { bodyContact } from "./contact.js";
import { courseFlag } from "./finish-marshal.js";
import { storage } from "./storage.js";
import { PaceLap } from "./pace-lap.js";
import { PursuitHeat, breakawayDistance, breakawaySeconds } from "./pursuit-heat.js";
import { nearestPointOnPath } from "./road-projection.js";
import { shortcutApproach, shortcutMarkerIndex, shortcutMergeCue } from "./shortcut-guide.js";
import { RaceTiming } from "./race-timing.js";
import { paceGhost } from "./pace-ghost.js";
import { approachingCorner } from "./corner-notes.js";
import * as THREE from "three";
import { World, roadHalfWidth } from "./world.js";
import {
  createVehicle,
  animateVehicle,
  alignVehicleToSurface,
  applyStreetLighting,
  getVehicleGroundOffset,
  setVehicleColor,
  disposeVehicle,
} from "./vehicle.js";
import { vehicles } from "./data.js";
import { Effects } from "./effects.js";
import { AudioEngine } from "./audio.js";
import { QUALITY, createEnvironment } from "./rendering.js";
import { FixedClock, damp, spring, pixelRatioFor } from "./timing.js";
import { driveStep, engineAcceleration } from "./driving.js";
import { Tachometer } from "./tachometer.js";
import { SkidTrails } from "./skid-trails.js";
import { RoadLights } from "./road-lights.js";
import { advanceRoute, angleDelta, routeStateAt } from "./route-motion.js";

const clamp = THREE.MathUtils.clamp;

function contactMass(actor) {
  return ({bike: .55, heavy: 2.1, monster: 2.4})[actor.spec.kind] || 1;
}
function changeVelocity(actor, nx, nz, amount) {
  actor.velocityX = (actor.velocityX || 0) + nx * amount;
  actor.velocityZ = (actor.velocityZ || 0) + nz * amount;
  actor.speed = -Math.sin(actor.mesh.rotation.y) * actor.velocityX - Math.cos(actor.mesh.rotation.y) * actor.velocityZ;
}
const mod = (a, n) => ((a % n) + n) % n;
const gridRowSpacing = 8;

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

    this.keys = {};

    this.actors = [];

    this.remotes = new Map();

    this.projectiles = [];

    this.running = false;

    this.lastNetwork = 0;

    this.audio = new AudioEngine();

    this.fxTimer = 0;

    this.weaponCooldown = 0;

    this.lowPower = LOW_POWER_DEVICE;
    this.qualityMode =
      storage.getItem("nightshift-quality") ||
      "battery";
    if (!QUALITY[this.qualityMode]) this.qualityMode = "balanced";
    this.applyQuality(this.qualityMode);
    this.frameCost = 0;
    this.qualityTimer = 0;
    this.shadowMapsEnabled = false;
    this.touch = {};
    this.guideShortcuts = storage.getItem("nightshift-guide-cuts") === "true";
    this.autoAccelerate = storage.getItem("nightshift-auto") !== "false";
    this.reducedMotion = storage.getItem("nightshift-reduced-motion") === "true" ||
      (storage.getItem("nightshift-reduced-motion") === null && matchMedia("(prefers-reduced-motion: reduce)").matches);
    document.documentElement.classList.toggle('reduced-motion',this.reducedMotion);
    this.lastFrameTime = 0;
    this.lastSimulationTime = 0;
    this.hudTimer = 0;
    this.clock = new FixedClock();
    this.frameCallback = (stamp) => this.frame(stamp);
    this.cameraVelocity = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();
    this.cameraAnchor = new THREE.Vector3();
    this.cameraReady = false;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "low-power",
    });

    this.applyRenderScale();

    this.renderer.setSize(innerWidth, innerHeight);

    this.renderer.setClearColor(0x07111d, 1);

    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.renderer.shadowMap.enabled = this.shadowMapsEnabled;

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

    this.environment = createEnvironment(this.renderer);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.6;

    this.listen();

    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;

      this.camera.updateProjectionMatrix();
      if (this.preview) return;

      this.applyRenderScale();

      this.renderer.setSize(innerWidth, innerHeight);
      if (this.running && this.paused) this.renderScene();
    };

    addEventListener("resize", this.resize);
  }

  listen() {
    addEventListener("blur", () => {
      this.keys = {};
      this.touch = {};
      if (this.running && !this.paused && this.phase !== "finished")
        this.togglePause();
    });
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        this.running &&
        !this.paused &&
        this.phase !== "finished"
      )
        this.togglePause();
    });
    addEventListener("keydown", (e) => {
      this.keys[e.code] = true;

      if (
        this.running && !this.paused && this.phase !== "finished" &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          e.code,
        )
      ) {
        e.preventDefault();
      }

      if (e.code === "Escape" && !e.repeat && this.running) {
        this.togglePause();
      }
    });

    addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
    });
  }

  mountPreview(host, spec, color) {
    if (!host?.isConnected || this.running) return;
    this.clearPreview(false);

    // The showroom and race never draw together. Moving the existing canvas
    // keeps the graphics context, shader cache and environment probe warm.
    const renderer = this.renderer;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = false;
    renderer.domElement.className = "preview-canvas";
    renderer.domElement.style.removeProperty("width");
    renderer.domElement.style.removeProperty("height");
    host.append(renderer.domElement);

    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x080c12);
    scene.environment = this.environment.texture;
    scene.environmentIntensity = 0.65;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 120);

    const stage = new THREE.Group();

    scene.add(stage);

    const vehicle = createVehicle(spec, color);

    stage.add(vehicle);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0c1320,
      roughness: 0.65,
      metalness: 0.2,
    });

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(5.1, 5.1, 0.18, 64),
      floorMat,
    );

    floor.position.y = -0.55;

    floor.receiveShadow = true;

    stage.add(floor);

    const innerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x182227,
      roughness: 0.65,
      metalness: 0.2,
      emissive: 0x071012,
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
        color: 0xc3dfaa,
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
        color: 0x203c36,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    );

    rearGlow.rotation.x = -Math.PI / 2;

    rearGlow.position.y = -0.31;

    stage.add(rearGlow);

    const hemi = new THREE.HemisphereLight(0xc6dce2, 0x121b18, 1.25);

    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff3df, 2.8);

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

    const rim = new THREE.DirectionalLight(0xb8cdd9, 2.3);

    rim.position.set(-6, 4.5, -5);

    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xc5e2d4, 1.4);

    fill.position.set(7, 2.5, -5);

    scene.add(fill);

    const frontGlow = new THREE.PointLight(0xbde6ff, 2.4, 15, 2);

    frontGlow.position.set(0, 1.2, -4.5);

    scene.add(frontGlow);

    const backGlow = new THREE.PointLight(0xd4ff8c, 2.8, 15, 2);

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

    const previewSurfaceY = -0.4;

    const targetY = previewSurfaceY + getVehicleGroundOffset(vehicle);

    alignVehicleToSurface(vehicle, previewSurfaceY);

    stage.position.y -= center.y * 0.06;

    const distance = Math.max(5.4, maxDim * (1.3 / scale));

    const angle = spec.kind === "bike" ? 0.82 : 0.74;

    camera.position.set(
      Math.sin(angle) * distance,
      Math.max(2.1, size.y * 0.7 + 2.0),
      Math.cos(angle) * distance,
    );

    camera.lookAt(0, Math.max(0.55, size.y * 0.42), 0);

    let active = true;
    let lastPreviewTime = 0;
    let wakeUntil = performance.now() + (this.reducedMotion ? 0 : 1800);
    let drag = null;
    let turn = -2.15;

    let time = 0;

    let width = 520;
    let height = 330;

    const resize = () => {
      const rect = host.getBoundingClientRect();

      width = Math.max(180, Math.floor(rect.width || 520));

      height = Math.max(180, Math.floor(rect.height || 330));

      renderer.setPixelRatio(pixelRatioFor(width, height, devicePixelRatio, 1, 360000, 600));
      renderer.setSize(width, height, false);

      camera.aspect = width / height;

      camera.updateProjectionMatrix();
      wake();
    };

    const observer = new ResizeObserver(resize);


    const cleanupMaterial = (material) => {
      if (!material?.userData?.sharedVehicle) material?.dispose?.();
    };

    const tick = (stamp = performance.now()) => {
      this.previewFrame = 0;
      if (!active || document.hidden) return;
      if (stamp - lastPreviewTime < 1000 / 15 - .5) {
        this.previewFrame = requestAnimationFrame(tick); return;
      }
      const delta = Math.min(
        (stamp - (lastPreviewTime || stamp - 33)) / 1000,
        0.1,
      );
      lastPreviewTime = stamp;
      time += delta;

      stage.rotation.y = turn;
      vehicle.position.y = targetY;

      animateVehicle(vehicle, 0, false, time, 0, false, false, delta);

      ring.rotation.z = time * 0.28;

      ring.material.opacity = 0.53 + Math.sin(time * 2.1) * 0.13;

      renderer.render(scene, camera);
      if (stamp < wakeUntil) this.previewFrame = requestAnimationFrame(tick);
    };
    function wake() {
      if (active && !document.hidden && !thisGame.previewFrame)
        thisGame.previewFrame = requestAnimationFrame(tick);
    }
    const thisGame = this;
    const down = (event) => {
      drag = { id: event.pointerId, x: event.clientX };
      host.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      turn += (event.clientX - drag.x) * .008;
      drag.x = event.clientX; wake();
    };
    const release = () => { drag = null; };
    const visibility = () => {
      if (document.hidden) { cancelAnimationFrame(this.previewFrame); this.previewFrame = 0; }
      else wake();
    };
    host.style.touchAction = "pan-y";
    host.setAttribute("aria-label", "Vehicle preview. Drag to rotate.");
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("lostpointercapture", release);
    host.addEventListener("pointerup", release);
    document.addEventListener("visibilitychange", visibility);
    resize();
    observer.observe(host);

    this.preview = {
      renderer,
      active,
      observer,
      scene,
      host,
      vehicle,
      recolor(paint) { setVehicleColor(vehicle, paint); wake(); },

      dispose: () => {
        active = false;
        host.removeEventListener("pointerdown", down);
        host.removeEventListener("pointermove", move);
        host.removeEventListener("pointerup", release);
        host.removeEventListener("lostpointercapture", release);
        document.removeEventListener("visibilitychange", visibility);
        observer.disconnect();

        scene.traverse((o) => {
          if (
            o.geometry &&
            (!o.userData.vehiclePart || o.geometry.userData.disposeWithActor)
          ) {
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

  clearPreview(restoreRaceCanvas = true) {
    if (!this.preview) return;
    cancelAnimationFrame(this.previewFrame);
    this.previewFrame = 0;
    this.preview.dispose();
    this.preview = null;
    if (restoreRaceCanvas) {
      this.stage.append(this.renderer.domElement);
      this.renderer.domElement.className = "game-canvas";
      this.renderer.toneMappingExposure = this.lowPower ? 1.16 : 1.28;
      this.renderer.shadowMap.enabled = this.shadowMapsEnabled;
      this.resize();
    }
  }

  async start(config) {
    this.clearPreview();

    this.stop();

    this.config = config;

    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = .6;
    this.lastFrameTime = 0;
    this.lastSimulationTime = 0;
    this.clock.reset();
    this.lastNetwork = 0;
    this.cameraReady = false;
    this.cameraVelocity.set(0, 0, 0);

    this.world = new World(this.scene, config.map);
    this.camera.far = QUALITY[this.qualityMode].distance + 100;
    this.camera.updateProjectionMatrix();

    this.effects = new Effects(this.scene);
    this.skids = new SkidTrails(this.scene);
    this.roadLights = new RoadLights(this.scene, config.map.id);

    this.actorGroup = new THREE.Group();

    this.actorGroup.name = "GameplayActors";

    this.scene.add(this.actorGroup);

    this.projectiles = [];

    this.weaponCooldown = 0;

    this.projectileGeo = new THREE.SphereGeometry(0.22, 10, 8);
    this.projectileGeo.userData.disposeWithActor = true;

    this.bulletMat = new THREE.MeshBasicMaterial({
      color: 0x9eefff,
      toneMapped: false,
    });
    this.bulletMat.userData.disposeWithActor = true;

    this.rocketMat = new THREE.MeshBasicMaterial({
      color: 0xffc15d,
      toneMapped: false,
    });
    this.rocketMat.userData.disposeWithActor = true;

    this.tachometer = new Tachometer(config.vehicle);
    this.gridTone = "";
    this.audio.start();

    const hemi = new THREE.HemisphereLight(
      0xa9dfff,
      0x1a1420,
      this.lowPower ? 1.75 : 2.1,
    );

    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(
      config.map.id === "neon"
        ? 0xb8d2f3
        : config.map.id === "coast"
          ? 0xffefd1
          : 0xffba87,
      config.map.id === "neon" ? 1.4 : 2.5,
    );

    sun.position.set(-60, 90, 35);

    sun.castShadow = false;

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

    this.player.mesh.position.copy(this.world.finishLine);
    const competitive = ["race", "sprint"].includes(config.mode.id);
    if (competitive) {
      this.player.mesh.position.addScaledVector(this.world.finishForward, -2.5);
    }

    this.alignActorToRoad(this.player);

    this.player.mesh.rotation.y = this.routeAngle(0);

    this.player.next = 1;

    this.player.lap = 0;

    this.player.health = 100;

    this.player.boost = 100;

    this.player.progress = 0;
    this.lapTimes = [];
    this.raceTiming = competitive && !config.network ? new RaceTiming(this.world, config.mode.id, config.difficulty || "medium") : null;
    if (this.raceTiming) this.world.markSectors(this.raceTiming.gates);
    this.lastLapAt = 0;
    this.goUntil = 0;
    this.pace = config.mode.id === "time" ? new PaceLap(config.map.id, this.world.route.length, config.vehicle) : null;
    this.pace?.record(0, this.player.mesh.position, this.player.surfaceY, this.player.mesh.rotation.y);
    if (this.pace?.reference && storage.getItem("nightshift-ghost") !== "false") {
      this.ghost = paceGhost(this.pace.reference.kind);
      this.actorGroup.add(this.ghost);
    }

    this.actors.push(this.player);

    if (competitive) {
      for (let i = 0; i < Math.min(5, config.aiCount || 5); i++) {
        this.spawnAI(i, "race");
      }
    }

    this.showNextGate();

    this.camera.position
      .copy(this.player.mesh.position)
      .add(new THREE.Vector3(10, 7, 13));

    this.running = true;

    this.phase = "countdown";

    this.countdown = 3.2;

    this.elapsed = 0;

    this.time = 0;

    this.heat = 1;
    this.pursuit = config.mode.id === "escape" ? new PursuitHeat(config.difficulty) : null;
    this.pursuitContact = false;

    this.paused = false;

    this.finishTimer = 0;

    this.shake = 0;

    this.frame(performance.now());
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.keys = {};
    this.touch = {};

    this.audio.stop();
    this.pace = null;
    this.raceTiming = null;
    this.ghost = null;
    this.skids?.dispose(); this.skids = null;
    this.roadLights?.dispose(); this.roadLights = null;

    this.projectiles.length = 0;
    this.projectileGeo?.dispose();
    this.bulletMat?.dispose();
    this.rocketMat?.dispose();

    if (this.actorGroup) {
      disposeVehicle(this.actorGroup);
      this.actorGroup = null;
    }

    if (this.effects) {
      this.effects.dispose();

      this.effects = null;
    }

    if (this.world) {
      this.world.dispose();
      this.world = null;
      this.scene.clear();
      this.scene.background = null;
      this.scene.environment = null;
      this.scene.fog = null;
      // Three keeps the latest render list for each scene. Returning to the
      // garage can leave the race scene idle indefinitely.
      this.renderer.renderLists.dispose();
    }
    this.actors = [];
    this.remotes.clear();
    this.player = null;
  }

  makeActor(spec, color, police = false, name = "DRIVER") {
    const mesh = createVehicle(spec, color, police);
    applyStreetLighting(mesh, this.world?.streetLighting);

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
      steerInput: 0,
      weaponHeat: 0,
    };
  }

  applyRenderScale() {
    if (!this.renderer || this.preview) return;

    const profile = QUALITY[this.qualityMode];
    const ratio = pixelRatioFor(innerWidth, innerHeight, devicePixelRatio || 1,
      this.renderScale, profile.pixels, profile.height);
    if (ratio !== this.renderer.getPixelRatio()) this.renderer.setPixelRatio(ratio);
  }

  applyQuality(mode) {
    this.qualityMode = QUALITY[mode] ? mode : "balanced";
    document.documentElement.dataset.quality=this.qualityMode;
    const profile = QUALITY[this.qualityMode];
    this.targetFPS = profile.fps;
    this.renderScale = profile.scale;
    this.minRenderScale = profile.min;
    this.maxRenderScale = profile.scale;
    this.qualityTimer = 0;
    storage.setItem("nightshift-quality", this.qualityMode);
    this.applyRenderScale();
    if (this.camera) {
      this.camera.far = profile.distance + 100;
      this.camera.updateProjectionMatrix();
    }
  }

  updateAdaptiveQuality(cost, dt) {
    this.frameCost = THREE.MathUtils.lerp(this.frameCost || cost, cost, 0.06);
    this.frameInterval = THREE.MathUtils.lerp(
      this.frameInterval || dt,
      dt,
      0.04,
    );
    this.qualityTimer += dt;
    if (this.qualityTimer < 3 || this.phase !== "play") return;
    this.qualityTimer = 0;
    // Measure work time, not the deliberate frame limiter's idle time.
    const budget = 1000 / this.targetFPS;
    if (
      (this.frameCost > budget * 0.85 ||
        this.frameInterval > 1.35 / this.targetFPS) &&
      this.renderScale > this.minRenderScale
    ) {
      this.renderScale = Math.max(this.minRenderScale, this.renderScale - 0.06);
    }
  }

  alignActorToRoad(actor) {
    if (!actor?.mesh || !this.world) return;

    actor.surfaceY = actor.roadHeight ?? this.world.getRoadHeightAt(actor.mesh.position.x, actor.mesh.position.z, actor.surfaceY ?? 0);
    alignVehicleToSurface(actor.mesh, actor.surfaceY, actor.roadSlopeX, actor.roadSlopeZ);
  }

  spawnAI(i, role = "racer") {
    const spec = vehicles[(i + 1) % vehicles.length];

    const a = this.makeActor(
      spec,
      spec.color,
      role === "police",
      role === "police" ? `POLICE ${i + 1}` : `RIVAL ${i + 1}`,
    );

    let h = this.routeAngle(0);

    if (role === "police") {
      const world = this.world;
      const playerDistance = this.player.courseDistance ?? world.mainLocation(this.player).distance;
      a.patrolLane = i % 2 ? -3.3 : 3.3;
      a.disabledFor = 0;
      a.patrolSlot = i;
      a.regroupTime = 0;
      a.patrol = routeStateAt(world.sampleDistances, playerDistance - 46 - i * 12, a.patrolLane);
      advanceRoute(world.samples, a.patrol, 0);
      a.mesh.position.set(a.patrol.x, world.roadSurfaceY, a.patrol.z);
      a.roadHeight = world.roadSurfaceY;
    } else {
      a.raceLane = ((i % 3) - 1) * 3.2;

      // Leave the center lane open for the player's launch. Racers keep their
      // starting columns until the field has room to merge onto the racing line.
      a.gridLane = i % 2 ? -5.5 : 5.5;
      const row = Math.floor(i / 2);

      const distance = this.world.timingOffset - 2.5 - (row + 1) * gridRowSpacing;
      const slot = routeStateAt(this.world.sampleDistances, distance, -a.gridLane);
      advanceRoute(this.world.samples, slot, 0);
      a.mesh.position.set(slot.x, this.world.roadSurfaceY, slot.z);
      h = slot.heading;
    }

    this.alignActorToRoad(a);

    a.mesh.rotation.y = a.patrol?.heading ?? h;

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
    if (i === 0) return Math.atan2(-this.world.finishForward.x, -this.world.finishForward.z);
    const a = this.world.route[i];

    const b = this.world.route[(i + 1) % this.world.route.length];

    return Math.atan2(a.x - b.x, a.z - b.z);
  }

  readGamepad() {
    try {
      const pads = Array.from(navigator.getGamepads?.() ?? []).filter(Boolean);
      const active = pad => pad.buttons.some(button => button.pressed || button.value > .15) || pad.axes.some(axis => Math.abs(axis) > .24);
      const previous = pads.find(pad => pad.index === this.padIndex);
      const pad = previous && active(previous) ? previous : pads.find(active) ?? previous ?? pads[0];
      if (pad) this.padIndex = pad.index;
      return pad;
    } catch {
      // Some embedded players have no gamepad permission. Keyboard and touch still drive.
      return null;
    }
  }

  updatePlayer(dt, score = true) {
    const p = this.player;
    const fromX = p.mesh.position.x, fromZ = p.mesh.position.z;

    const k = { ...this.keys };
    // Releasing a touch pedal must not cancel a held physical keyboard key.
    for(const [key,pressed] of Object.entries(this.touch)) if(pressed) k[key]=pressed;

    const pad = this.readGamepad();

    let gas =
      k.KeyW ||
      k.ArrowUp ||
      (this.touch.active && this.autoAccelerate && !k.KeyS && !k.Space);

    let brake = k.KeyS || k.ArrowDown;

    let hand = k.Space;

    let boost = (k.ShiftLeft || k.ShiftRight) && p.boost > 1 && p.speed > 10;

    let gun = k.KeyF || k.ControlLeft || k.ControlRight;

    let rocket = k.KeyR || k.KeyE;

    if (pad) {
      gas ||= pad.buttons[7]?.value || pad.buttons[0]?.pressed;

      brake ||= pad.buttons[6]?.value || pad.buttons[1]?.pressed;

      hand ||= pad.buttons[2]?.pressed;

      boost ||= pad.buttons[5]?.pressed && p.boost > 1;

      gun ||= pad.buttons[4]?.pressed;

      rocket ||= pad.buttons[3]?.pressed;
    }

    const bike = p.spec.kind === "bike", monster = p.spec.kind === "monster";
    const axis = pad && Math.abs(pad.axes[0] || 0) > .18
      ? (pad.axes[0] - Math.sign(pad.axes[0]) * .18) / .82 : 0;
    const keyboardSteer = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
    const padSteer = Number(!!pad?.buttons[15]?.pressed) - Number(!!pad?.buttons[14]?.pressed);
    p.heading = p.mesh.rotation.y;
    driveStep(p, { gas, brake, steer: keyboardSteer || padSteer || axis, hand, boost }, p.spec, dt);
    const steer = p.steerInput, drifting = p.drifting;
    boost = p.boosting;
    p.mesh.rotation.y = p.heading;
    p.mesh.position.x += p.velocityX * dt;
    p.mesh.position.z += p.velocityZ * dt;
    Object.assign(p.mesh.userData, { acceleration: p.acceleration, yawRate: p.yawRate, slip: p.slip });

    p.onRoad = this.world.constrainToRoad(p);

    if (!p.onRoad && !p.spec.offroadImmune) {
      const penalty = monster
        ? 0.975
        : bike && p.spec.profile === "dirt"
          ? 0.965
          : 0.93;

      p.speed *= Math.pow(penalty, dt * 18);
    }

    this.alignActorToRoad(p);
    this.skids?.sample(p, this.world, drifting || (brake && p.speed > 22));

    animateVehicle(
      p.mesh,
      p.speed,
      boost,
      this.time,
      -steer,
      brake,
      drifting,
      dt,
    );

    this.handleWeapons(p, gun, rocket, dt);

    this.tachometer.update(p.speed, gas, boost, dt);
    this.audio.update(p.speed, boost, this.tachometer, drifting);

    this.fxTimer -= dt;

    const loose = !p.onRoad && Math.abs(p.speed) > 7;
    const sliding = drifting || (brake && p.speed > 22);
    if (this.fxTimer <= 0 && (boost || sliding || loose)) {
      this.fxTimer = this.reducedMotion ? .16 : (loose ? .075 : .055);
      if (sliding || loose) this.effects?.tireSpray(p, this.world.map.id, loose, this.reducedMotion);
      if (boost) this.effects?.exhaust(p, this.reducedMotion);
    }

    if (score) this.checkProgress(p, fromX, fromZ, dt);

  }

  handleWeapons(p, gun, rocket, dt) {
    if (!p.spec.armed) return;

    p.weaponHeat = Math.max(0, (p.weaponHeat || 0) - dt);

    if (rocket && p.weaponHeat <= 0) {
      this.fireProjectile(p, "rocket");
      p.weaponHeat = 1.25;
      return;
    }

    if (gun && p.weaponHeat <= 0) {
      this.fireProjectile(p, "bullet");
      p.weaponHeat = 0.13;
    }
  }

  fireProjectile(actor, type) {
    const dir = new THREE.Vector3(
      -Math.sin(actor.mesh.rotation.y),
      0,
      -Math.cos(actor.mesh.rotation.y),
    );
    if (actor.roadBranch) {
      const road = actor.roadBranch;
      const {index} = nearestPointOnPath(actor.mesh.position, road.points, false);
      const a = road.points[index], b = road.points[index + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const rise = road.heightProfile[index + 1] - road.heightProfile[index];
      dir.y = rise * (dx * dir.x + dz * dir.z) / (dx * dx + dz * dz || 1);
      dir.normalize();
    }
    const start = actor.mesh.position.clone();
    start.y = (actor.surfaceY ?? start.y) + (type === "rocket" ? 1.35 : .9);
    start.addScaledVector(dir, type === "rocket" ? 3.4 : 2.8);

    const shot = new THREE.Mesh(
      this.projectileGeo,
      type === "rocket" ? this.rocketMat : this.bulletMat,
    );
    shot.position.copy(start);
    shot.scale.setScalar(type === "rocket" ? 1.9 : 0.8);
    shot.userData.disposeWithActor = true;
    this.actorGroup?.add(shot);

    this.projectiles.push({
      mesh: shot,
      owner: actor,
      dir,
      type,
      speed: type === "rocket" ? 82 : 138,
      ttl: type === "rocket" ? 2.2 : 0.9,
      radius: type === "rocket" ? 5.6 : 1.7,
      damage: type === "rocket" ? 55 : 12,
    });

    this.audio.blip(
      type === "rocket" ? 74 : 220,
      type === "rocket" ? 0.18 : 0.045,
    );
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      projectile.ttl -= dt;
      projectile.mesh.position.addScaledVector(
        projectile.dir,
        projectile.speed * dt,
      );

      const hit =
        projectile.ttl <= 0 ||
        this.hitProjectileActor(projectile) ||
        this.hitProjectileObstacle(projectile) ||
        this.world.distanceToRoad(projectile.mesh.position) > 62;

      if (hit) {
        this.effects?.emit(
          projectile.mesh.position,
          projectile.type === "rocket" ? 0xffb45b : 0x9eefff,
          projectile.type === "rocket" ? 16 : 4,
          projectile.type === "rocket" ? 7 : 2,
        );

        projectile.mesh.removeFromParent();
        this.projectiles.splice(i, 1);
      }
    }
  }

  hitProjectileActor(projectile) {
    for (const actor of this.actors) {
      if (actor === projectile.owner || actor.remote || actor.disabledFor > 0) continue;

      const bodyHeight = (actor.surfaceY ?? actor.mesh.position.y) + 1;
      if (Math.abs(projectile.mesh.position.y - bodyHeight) > 1.65) continue;
      const limit = (actor.mesh.userData.radius || 2) + projectile.radius;

      if (actor.mesh.position.distanceTo(projectile.mesh.position) < limit) {
        actor.health = Math.max(0, actor.health - projectile.damage);
        if (actor.role === "police" && actor.health === 0) actor.disabledFor = 6;
        actor.speed *= projectile.type === "rocket" ? -0.18 : 0.55;

        const away = actor.mesh.position.clone().sub(projectile.mesh.position);
        if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        actor.mesh.position.addScaledVector(
          away.normalize(),
          projectile.type === "rocket" ? 5.2 : 1.4,
        );

        if (actor === this.player) {
          this.shake = projectile.type === "rocket" ? 1.6 : 0.55;
        }

        return true;
      }
    }

    return false;
  }

  hitProjectileObstacle(projectile) {
    for (const obstacle of this.world.destructibles || []) {
      if (!obstacle.userData.alive) continue;

      const limit = (obstacle.userData.radius || 2.4) + projectile.radius;

      const height = projectile.mesh.position.y;
      if (height < obstacle.position.y - .35 || height > obstacle.userData.topY + .35) continue;
      if (Math.hypot(obstacle.position.x - projectile.mesh.position.x, obstacle.position.z - projectile.mesh.position.z) < limit) {
        this.world.destroyDestructible(obstacle, projectile.damage);
        return true;
      }
    }

    return false;
  }

  updateRacer(a, dt, score = true) {
    const world = this.world, position = a.mesh.position, samples = world.samples;
    const fromX = position.x, fromZ = position.z;
    if (a.finishedAt != null && this.elapsed - a.finishedAt > 2.5) {
      a.mesh.visible = false;
      return;
    }
    const stride = samples.length / world.route.length;
    const end = (a.next || world.route.length) * stride;
    const last = a.next === 0 ? end + world.finishSamples : end;
    let nearest = end, distance = Infinity;
    for (let index = end - stride; index <= last; index++) {
      const d = position.distanceToSquared(samples[index % samples.length]);
      if (d < distance) { distance = d; nearest = index; }
    }
    let look = nearest, length = 0;
    const lookAhead = Math.max(12, Math.abs(a.speed) * .65);
    while (length < lookAhead) {
      const i = look % samples.length;
      const next = (i + 1) % samples.length;
      length += samples[i].distanceTo(samples[next]);
      look++;
    }
    const target = samples[look % samples.length];
    const ahead = samples[(look + 1) % samples.length];
    const forward = ahead.clone().sub(target).normalize();
    const merge = clamp((this.elapsed - 4) / 3, 0, 1);
    const lane = THREE.MathUtils.lerp(a.gridLane, a.raceLane, merge * merge * (3 - 2 * merge));
    const x = target.x + forward.z * lane;
    const z = target.z - forward.x * lane;
    const desired = Math.atan2(position.x - x, position.z - z);
    const error = angleDelta(a.mesh.rotation.y, desired);
    const cruise = (a.spec.maxSpeed || 260) / 5.7 * a.skill * .85;
    const corner = clamp(1 - Math.abs(error) * .75, .35, 1);
    const targetSpeed = a.finishedAt == null ? cruise * corner : 12;
    a.heading = a.mesh.rotation.y;
    driveStep(a, {
      gas: a.speed < targetSpeed ? 1 : 0,
      brake: a.speed > targetSpeed + 2 ? .65 : 0,
      steer: clamp(-error * 2.5, -1, 1),
    }, a.spec, dt);
    a.mesh.rotation.y = a.heading;
    position.x += a.velocityX * dt;
    position.z += a.velocityZ * dt;
    a.onRoad = world.constrainToRoad(a);
    if (!a.onRoad && !a.spec.offroadImmune) a.speed *= Math.pow(.93, dt * 18);
    this.alignActorToRoad(a);
    if (score) this.scoreRacer(a, fromX, fromZ, dt);
    animateVehicle(a.mesh, a.speed, false, this.time, -a.steerInput, a.acceleration < -2, false, dt);
  }

  scoreRacer(a, fromX, fromZ, dt) {
    const world = this.world, position = a.mesh.position;
    if (a.finishedAt == null) {
      const gate = world.gatePosition(a.next);
      const crossing = a.next === 0 ? world.finishFraction(fromX, fromZ, position) : null;
      if (a.next === 0 ? crossing !== null : Math.hypot(position.x - gate.x, position.z - gate.z) < 15.5) {
        if (a.next === 0 && ++a.lap >= this.lapGoal()) {
          a.finishedAt = Math.max(0, this.elapsed - (1 - crossing) * dt);
          if (this.config.network) this.finish(a.name + " WINS");
        }
        a.next = (a.next + 1) % world.route.length;
      }
    }
  }

  updateAI(a, dt, score = true) {
    if (a.role !== "police") { this.updateRacer(a, dt, score); return; }
    const world = this.world, player = this.player, path = a.patrol;
    const distances = world.sampleDistances;
    const patrolDistance = THREE.MathUtils.lerp(distances[path.index], distances[path.index + 1], path.progress);
    const playerDistance = player.courseDistance ?? world.mainLocation(player).distance;
    const gap = mod(playerDistance - patrolDistance + world.courseLength / 2, world.courseLength) - world.courseLength / 2;
    a.pursuitGap = gap;
    if (a.disabledFor > 0) {
      a.disabledFor = Math.max(0, a.disabledFor - dt);
      if (a.disabledFor === 0) a.health = 100;
    }
    const pace = clamp(1 + (a.skill - .87) * .5, .9, 1.15);
    const speedLimit = a.spec.maxSpeed / 5.7 * (.74 + (this.heat - 1) * .04) * pace;
    a.regroupTime = Math.max(0, a.regroupTime - dt);
    const regrouping = a.regroupTime > 0;
    let targetSpeed = clamp(player.speed + gap * .68, 0, speedLimit);
    if (gap < -25) targetSpeed = speedLimit * .52;
    if (regrouping) targetSpeed = Math.min(speedLimit * .52, Math.max(0, player.speed - 8));
    if (a.disabledFor > 0) targetSpeed = 0;
    const previousSpeed = a.speed;
    a.speed += clamp(targetSpeed - a.speed, -(5 + a.spec.braking * .12) * dt, engineAcceleration(a.spec) * dt);
    let targetLane = a.disabledFor > 0 ? Math.sign(a.patrolLane) * 9 : a.patrolLane;
    if (a.disabledFor <= 0 && !regrouping && Math.abs(gap) < 22 && !player.roadBranch && !player.cut) {
      const dx = player.mesh.position.x - path.x, dz = player.mesh.position.z - path.z;
      targetLane = clamp(path.lane + dx * Math.cos(path.heading) - dz * Math.sin(path.heading), -roadHalfWidth, roadHalfWidth);
    }
    path.lane = damp(path.lane, targetLane, 1.7, dt);
    const previousHeading = path.heading;
    advanceRoute(world.samples, path, Math.max(0, a.speed) * dt);
    a.mesh.position.set(path.x, world.roadSurfaceY, path.z);
    a.mesh.rotation.y = path.heading;
    this.alignActorToRoad(a);
    if (a.disabledFor <= 0 && bodyContact(player.mesh, a.mesh, a.mesh.userData.footprint, .025)) {
      this.pursuitContact = true;
      // A moving driver can pull clear after a sideswipe. At a standstill the unit holds contact.
      if (!regrouping && player.speed > 7) {
        a.regroupTime = 3;
        a.speed *= .65;
      }
    }
    const steer = dt > 0 ? clamp(-angleDelta(previousHeading, path.heading) / dt, -1, 1) : 0;
    animateVehicle(a.mesh, a.speed, false, this.time, steer, a.speed < previousSpeed, false, dt);
  }

  updateRemote(a, dt) {
    if (!a.target) {
      return;
    }

    const blend=-Math.expm1(-dt*12);
    a.mesh.position.lerp(a.target.position, blend);
    a.mesh.rotation.y += angleDelta(a.mesh.rotation.y,a.target.rotation)*blend;
    a.speed = a.target.speed;
    if (a.target.surface !== undefined) {
      const road = this.world.shortcutRoads[a.target.surface - 1] ?? null;
      const center = road ? nearestPointOnPath(a.mesh.position, road.points, false) : null;
      this.world.alignRoadSurface(a, road, center);
    } else {
      // Older peers only send x/z; retain their last known height at crossings.
      a.roadHeight = undefined;
      a.roadSlopeX = a.roadSlopeZ = 0;
    }
    this.alignActorToRoad(a);

    animateVehicle(
      a.mesh,
      a.target.speed || 0,
      false,
      this.time,
      0,
      false,
      false,
      dt,
    );
  }

  collisions(p) {
    let hit = false;
    const resolve = (mesh, other, contact, movable) => {
      if (!contact) return;
      const {nx, nz, depth} = contact;
      const share = movable ? contactMass(other) / (contactMass(p) + contactMass(other)) : 1;
      p.mesh.position.x += nx * depth * share;
      p.mesh.position.z += nz * depth * share;
      if (movable) {
        mesh.position.x -= nx * depth * (1 - share);
        mesh.position.z -= nz * depth * (1 - share);
        other.onRoad = this.world.constrainToRoad(other);
        this.alignActorToRoad(other);
      }
      const vx = other?.velocityX ?? -(other?.speed || 0) * Math.sin(mesh.rotation.y);
      const vz = other?.velocityZ ?? -(other?.speed || 0) * Math.cos(mesh.rotation.y);
      const closing = -(((p.velocityX || 0) - vx) * nx + ((p.velocityZ || 0) - vz) * nz);
      if (closing > 0) {
        const impulse = closing * 1.025;
        changeVelocity(p, nx, nz, impulse * share);
        if (movable) changeVelocity(other, -nx, -nz, impulse * (1 - share));
      }
      hit = true;
      if (p !== this.player || closing < 1.2 || this.time < (p.nextCollisionEffect || 0)) return;
      p.nextCollisionEffect = this.time + .22;
      p.health = Math.max(0, p.health - Math.min(4, closing * .12));
      this.shake = Math.min(.8, closing * .055);
      this.effects?.emit(new THREE.Vector3(contact.x, p.mesh.position.y + .5, contact.z), 0xffb45b, 5, 4);
      this.audio.blip(94, .12);
    };
    for (let i = this.actors.indexOf(p) + 1; i < this.actors.length; i++) {
      const a = this.actors[i];
      if (a.remote || a.finishedAt != null) continue;
      const contact = bodyContact(p.mesh, a.mesh);
      if (!contact) continue;
      if (a.police && Math.abs(p.speed) < 1 && Math.abs(a.speed) < 4) {
        a.speed = 0;
        continue;
      }
      resolve(a.mesh, a, contact, !a.police);
    }
    for (const traffic of this.world.traffic) {
      resolve(traffic.mesh, traffic, bodyContact(p.mesh, traffic.mesh), false);
    }
    for (const obstacle of this.world.destructibles || []) {
      if (!obstacle.userData.alive) continue;
      for (const shape of obstacle.userData.footprints) {
        const contact = bodyContact(p.mesh, obstacle, shape);
        if (!contact) continue;
        if (p.spec.canSmash || p.spec.kind === "monster") {
          this.world.destroyDestructible(obstacle, Math.abs(p.speed));
          p.speed *= .92;
          this.effects?.emit(obstacle.position, 0xffb45b, 12, 6);
          this.audio.blip(62, .14);
          break;
        }
        resolve(obstacle, null, contact, false);
      }
    }
    return hit;
  }

  checkProgress(p, fromX = p.mesh.position.x, fromZ = p.mesh.position.z, dt = 0) {
    const world = this.world;
    const pos = p.mesh.position;
    const near = (point, radius) => Math.hypot(pos.x - point.x, pos.z - point.z) < radius;
    const timed = world.timingLines.has(p.next);
    const crossing = timed ? world.timingFraction(p.next, fromX, fromZ, pos) : null;
    let hit = (timed ? crossing !== null : near(world.route[p.next], 15.5)) ? p.next : -1;
    // A legal shortcut substitutes its own ordered gates between the two junctions.
    if (!p.cut) {
      for (const road of world.shortcutRoads) {
        const entry = world.authorSegmentToRouteIndex(road.from);
        if (p.next !== (entry + 1) % world.route.length) continue;
        const fork = road.points[3];
        if (near(fork, 10)) { p.cut = { road, gate: 4 }; break; }
      }
    }
    if (p.cut) {
      const { road, gate } = p.cut;
      const target = road.points[gate];
      const finalGate = gate === road.points.length - 1;
      // Inside and outside lanes join the circuit on different sides of the arch.
      if (near(target, 12) || (finalGate && world.hasMergedFromShortcut(road, p, fromX, fromZ))) {
        if (finalGate) {
          hit = world.authorSegmentToRouteIndex(road.to);
          p.cut = null;
        } else {
          p.cut.gate++;
        }
      } else if (hit >= 0 || !near(target, 65)) {
        p.cut = null;
      }
      if (p.cut) {
        world.setNextMarker(world.authorSegmentToRouteIndex(road.to), road.label, road, p.cut.gate);
        return;
      }
      this.showNextGate();
    }
    if (hit >= 0) {
      const stamp = Math.max(0, this.elapsed - (1 - (crossing ?? 1)) * dt);
      this.pace?.gate(hit, stamp);
      this.raceTiming?.gate(hit, stamp);
      p.next = (hit + 1) % this.world.route.length;

      if (hit === 0) {
        p.lap++;

        if (this.config.mode.id !== "cruise") {
          this.lapTimes.push(stamp - this.lastLapAt);
          this.lastLapAt = stamp;
          if (p.lap >= this.lapGoal()) p.finishedAt = stamp;
        }
        if (this.config.mode.id === "time") this.finish("TIME RECORDED");
        if (this.config.mode.id === "escape") this.finish("ESCAPED THE HEAT");
      }

      p.progress = p.lap * this.world.route.length + p.next;

      this.showNextGate();
    }
    this.updateShortcutGuide();
  }

  remotePosition(id, data) {
    if(!this.running || !this.world || !data || ![data.x,data.z,data.rotation,data.speed].every(Number.isFinite)) return;
    let a = this.remotes.get(id);

    if (!a) {
      const spec = vehicles.find((v) => v.name === data.vehicle) || vehicles[0];

      a = this.makeActor(spec, data.color || "#ffffff", false, "LAN DRIVER");

      a.remote = true;

      this.remotes.set(id, a);

      this.actors.push(a);
    }

    if (Number.isInteger(data.next) && data.next >= 0 && data.next < this.world.route.length) a.next = data.next;
    if (Number.isInteger(data.lap) && data.lap >= 0 && data.lap <= this.lapGoal()) a.lap = data.lap;
    a.target = {
      position: new THREE.Vector3(data.x, a.mesh.position.y, data.z),
      surface: Number.isInteger(data.surface) && data.surface >= 0 && data.surface <= this.world.shortcutRoads.length ? data.surface : undefined,
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

    a.mesh.position.add(new THREE.Vector3(4 + this.remotes.size * 3, 0, 0));

    this.alignActorToRoad(a);

    this.remotes.set(player.id, a);

    this.actors.push(a);
  }

  setRemotePlayers(players) {
    if(!this.running || !this.world) return;
    const ids=new Set(players.map(p=>p.id));
    for(const [id,actor] of this.remotes) if(!ids.has(id)) {
      this.remotes.delete(id);this.actors=this.actors.filter(a=>a!==actor);
      disposeVehicle(actor.mesh);
    }
    players.forEach((p) => this.addRemotePlayer(p));
  }

  finish(title) {
    if (this.phase === "finished") {
      return;
    }

    this.phase = "finished";

    this.finishTimer = 3;

    const stamp = this.player.finishedAt ?? this.elapsed;
    let trial;
    if (this.pace && this.player.finishedAt != null) {
      const p = this.player;
      trial = this.pace.finish(stamp, p.mesh.position, p.surfaceY, p.mesh.rotation.y);
      if (trial.improved) title = "NEW PERSONAL BEST";
    }

    this.config.network?.send({
      type: "event",
      event: {
        type: "finish",
        title,
        time: stamp,
        mode: this.config.mode.id,
      },
    });

    const classified = !this.config.network && ["race", "sprint"].includes(this.config.mode.id) && this.player.finishedAt != null;
    const race = classified ? this.raceTiming?.finish() : null;
    this.callbacks.result?.({
      title,
      time: stamp,
      race,
      laps: [...this.lapTimes],
      standings: classified ? this.standings().map(({ actor }) => ({
        name: actor.name, me: actor === this.player, time: actor.finishedAt ?? null,
        lap: Math.min(this.lapGoal(), actor.lap + 1)
      })) : null,
      mode: this.config.mode.title,
      pursuit: this.pursuit && { peak: this.pursuit.peak, breakaways: this.pursuit.breakaways, health: Math.round(this.player.health) },
      best: race?.best ?? trial?.best,
      delta: race?.delta ?? trial?.delta,
    });
  }

  remoteFinish(event, sender) {
    if (!this.running || !this.world || this.phase === "finished") {
      return;
    }

    this.phase = "finished";

    this.finishTimer = 3;

    const name = this.config.network?.players?.find((p) => p.id === sender)?.name || "CREW DRIVER";
    const place = event.title === "FIRST PLACE";
    const title = place ? name + " WINS" : this.config.mode.id === "time" ? name + " FINISHED" : event.title;
    this.callbacks.result?.({
      title: title || "RACE COMPLETE",
      time: event.time ?? this.elapsed,
      mode: this.config.mode.title,
    });
  }

  updatePoliceHeat(dt = 0) {
    if (!this.pursuit) return;
    const units = this.actors.filter(actor => actor.role === "police");
    const separated = units.length > 0 && !this.pursuitContact && units.every(unit => unit.pursuitGap > breakawayDistance);
    this.pursuit.update(dt, separated, this.player.health);
    this.heat = this.pursuit.level;
    if (units.length > this.heat) {
      // The abandoned unit is already well behind the driver when dispatch recalls it.
      const leaving = units.reduce((back, unit) => unit.pursuitGap > back.pursuitGap ? unit : back);
      this.actors.splice(this.actors.indexOf(leaving), 1);
      disposeVehicle(leaving.mesh);
    } else {
      for (let slot = 0, count = units.length; count < this.heat; slot++) {
        if (units.some(unit => unit.patrolSlot === slot)) continue;
        this.spawnAI(slot, "police");
        count++;
      }
    }
  }

  returnToCheckpoint() {
    if (!this.paused || this.phase !== "play") return;
    const p = this.player;
    const previous = mod(p.next - 1, this.world.route.length);
    p.cut = null;
    p.roadBranch = null;
    p.roadSlopeX = p.roadSlopeZ = 0;
    p.guidedFork = null;
    p.roadHeight = this.world.roadSurfaceY;
    p.mesh.position.copy(this.world.gatePosition(previous));
    p.mesh.rotation.y = this.routeAngle(previous);
    p.surfaceY = this.world.roadSurfaceY;
    p.speed = p.velocityX = p.velocityZ = p.steerInput = p.slip = 0;
    this.alignActorToRoad(p);
    this.rememberPose(p.mesh);
    p.courseDistance = this.world.mainLocation(p).distance;
    this.pace?.record(this.elapsed, p.mesh.position, p.surfaceY, p.mesh.rotation.y, {force: true, jump: true});
    this.cameraReady = false;
    this.showNextGate();
    this.togglePause();
  }

  togglePause() {
    if (this.phase === "finished") {
      return;
    }

    this.paused = !this.paused;
    cancelAnimationFrame(this.animationFrame);
    this.lastFrameTime = 0;
    this.lastSimulationTime = 0;
    this.clock.accumulator = 0;
    this.keys = {};
    this.touch = { active: matchMedia("(pointer: coarse)").matches };
    this.audio.setMuted(this.paused);

    this.callbacks.pause?.(this.paused);
    if (!this.paused && this.running) this.animationFrame = requestAnimationFrame(this.frameCallback);
  }

  renderScene() {
    // Resizing clears WebGL's drawing buffer. Paint the road in the same frame.
    this.applyRenderScale();
    if (this.player && this.world) {
      const { x, z } = this.player.mesh.position;
      this.world.guidanceFocus.set(x, z);
      this.roadLights?.update(this.player, this.world);
    }
    this.renderer.render(this.scene, this.camera);
  }

  eachMovingMesh(callback) {
    for (const actor of this.actors) callback(actor.mesh);
    for (const actor of this.world?.traffic || []) callback(actor.mesh);
  }

  rememberPose(mesh) {
    let pose = mesh.userData.presentation;
    if (!pose) pose = mesh.userData.presentation = {
      previous: mesh.position.clone(), rotation: mesh.quaternion.clone(),
      saved: mesh.position.clone(), savedRotation: mesh.quaternion.clone(),
    };
    pose.previous.copy(mesh.position); pose.rotation.copy(mesh.quaternion);
  }

  frame(timestamp = performance.now()) {
    if (!this.running || this.paused || document.hidden) return;
    this.animationFrame = requestAnimationFrame(this.frameCallback);
    const interval = 1000 / this.targetFPS;
    const elapsed = timestamp - this.lastFrameTime;
    if (this.lastFrameTime && elapsed < interval - .5) return;
    const dt = this.lastSimulationTime ? (timestamp - this.lastSimulationTime) / 1000 : 1 / this.targetFPS;
    // Background/focus changes pause explicitly. A slow shader compilation
    // drops excess catch-up through FixedClock instead of trapping the player
    // in repeated automatic pauses on a slower machine.
    this.actualFrameDelta = dt;
    this.lastSimulationTime = timestamp;
    this.lastFrameTime = timestamp - (elapsed % interval);
    const workStart = performance.now();
    this.clock.advance(dt, (step) => this.simulate(step));
    if (!this.running || !this.world) return;
    this.eachMovingMesh((mesh) => {
      const pose = mesh.userData.presentation;
      if (!pose) return;
      pose.saved.copy(mesh.position); pose.savedRotation.copy(mesh.quaternion);
      // Never interpolate across a recovery teleport or a remote respawn.
      if (pose.previous.distanceToSquared(pose.saved) > 144) return;
      mesh.position.lerpVectors(pose.previous, pose.saved, this.clock.fraction);
      mesh.quaternion.slerpQuaternions(pose.rotation, pose.savedRotation, this.clock.fraction);
    });
    this.updateCamera(dt);
    this.renderScene();
    this.eachMovingMesh((mesh) => {
      const pose = mesh.userData.presentation;
      if (pose) { mesh.position.copy(pose.saved); mesh.quaternion.copy(pose.savedRotation); }
    });
    this.hudTimer += dt;
    if (this.hudTimer >= .1) {
      this.callbacks.hud?.(this.hudState()); this.hudTimer = 0;
    }
    this.updateAdaptiveQuality(performance.now() - workStart, dt);
  }

  simulate(dt) {
    if (!this.running || !this.world) return;
    this.eachMovingMesh((mesh) => this.rememberPose(mesh));
    this.time += dt;

    const racing = this.phase === "play";
    if (this.phase === "countdown") {
      this.countdown -= dt;
      this.world.setStartingLights(this.countdown > 2 ? 1 : this.countdown > 1 ? 2 : this.countdown > 0 ? 3 : 4);

      const value =
        this.countdown > 2
          ? "3"
          : this.countdown > 1
            ? "2"
            : this.countdown > 0
              ? "1"
              : "GO!";

      const pad = this.readGamepad();
      const throttle = this.keys.KeyW || this.keys.ArrowUp || this.touch.KeyW ||
        pad?.buttons[7]?.value || pad?.buttons[0]?.pressed;
      this.tachometer.onGrid(throttle, dt);
      this.audio.update(0, false, this.tachometer, false);
      if (value !== this.gridTone) {
        this.gridTone = value;
        this.audio.blip(value === "GO!" ? 880 : 440, value === "GO!" ? .18 : .075);
      }
      this.callbacks.countdown?.(value);

      if (this.countdown <= 0) {
        this.phase = "play";
        this.goUntil = .7;
      }
    } else if (racing) {
      this.elapsed += dt;
      if (this.goUntil && this.elapsed >= this.goUntil) {
        this.goUntil = 0;
        this.world.setStartingLights(0);
        this.callbacks.countdown?.("");
      }

      this.updatePoliceHeat(dt);

      this.updatePlayer(dt, false);
      this.pursuitContact = false;
      for (const a of this.actors) {
        if (a === this.player) {
          continue;
        }

        if (a.remote) {
          this.updateRemote(a, dt);
        } else {
          this.updateAI(a, dt, false);
        }
      }

    } else if (this.phase === "finished") {
      this.finishTimer -= dt;

      if (this.finishTimer < 0) {
        this.stop();
        return;
      }
    }

    this.world.update(
      dt,
      this.time,
      this.player.mesh.position,
      QUALITY[this.qualityMode].distance,
      !this.reducedMotion,
      courseFlag(this.config.mode.id, this.player, this.phase, this.elapsed),
      this.actors,
    );

    if (racing && this.phase === "play") {
      for (const actor of this.actors) {
        if (!actor.remote && !actor.police && actor.finishedAt == null && this.collisions(actor)) {
          actor.onRoad = this.world.constrainToRoad(actor);
          this.alignActorToRoad(actor);
        }
      }

      // Score the complete displacement, including a nudge across a timing line.
      // Remote peers and the pace ghost must see the same settled pose as the HUD.
      for (const actor of this.actors) {
        if (actor.remote || actor.police || actor.finishedAt != null) continue;
        const start = actor.mesh.userData.presentation.previous;
        if (actor === this.player) this.checkProgress(actor, start.x, start.z, dt);
        else this.scoreRacer(actor, start.x, start.z, dt);
      }
      if (this.pace && this.phase === "play") {
        const p = this.player;
        this.pace.record(this.elapsed, p.mesh.position, p.surfaceY, p.mesh.rotation.y);
        if (this.ghost) {
          const pose = this.pace.pose(this.elapsed);
          this.ghost.visible = !!pose;
          if (pose) {
            this.ghost.position.set(pose.x, pose.y, pose.z);
            this.ghost.rotation.y = pose.heading;
            // Fade the outline where it would overlap the player's bodywork.
            this.ghost.material.opacity = clamp(Math.hypot(pose.x - p.mesh.position.x, pose.z - p.mesh.position.z) / 12, .12, .75);
          }
        }
      }

      if (this.pursuitContact) {
        this.player.health = Math.max(0, this.player.health - 8 * dt);
        this.shake = 1;
      }
      this.resolveRaceFinish();
      if (this.player.health <= 0) {
        this.finish(this.config.mode.id === "escape" ? "BUSTED" : "WRECKED");
      }

      if (this.config.network && this.time - this.lastNetwork > 0.05) {
        this.lastNetwork = this.time;

        this.config.network.position({
          x: this.player.mesh.position.x,

          z: this.player.mesh.position.z,

          rotation: this.player.mesh.rotation.y,

          speed: this.player.speed,
          surface: this.world.shortcutRoads.indexOf(this.player.roadBranch) + 1,

          vehicle: this.player.spec.name,

          color: this.config.color,

          next: this.player.next,

          lap: this.player.lap,
        });
      }
    }
    this.effects?.update(dt);
    this.skids?.update(dt);

    this.updateProjectiles(dt);

  }

  updateCamera(dt) {
    const player = this.player, p = player.mesh.position;
    const heading = player.mesh.rotation.y + (player.slip || 0) * .55;
    const speed = Math.abs(player.speed);
    const grid = this.phase === "countdown" && !this.reducedMotion
      ? THREE.MathUtils.smoothstep(this.countdown, .85, 3.2) : 0;
    const back = 7.3 + Math.min(speed * .023, 1.15) - grid * 2.5;
    const lateral = grid * 3.8;
    const grade = THREE.MathUtils.clamp(
      -(player.roadSlopeX || 0) * Math.sin(heading) - (player.roadSlopeZ || 0) * Math.cos(heading), -.30, .30,
    );
    const desired = new THREE.Vector3(p.x + Math.sin(heading) * back + Math.cos(heading) * lateral,
      p.y + 2.55 + Math.min(speed * .009, .4) - grid * 1.15 - grade * back * .42,
      p.z + Math.cos(heading) * back - Math.sin(heading) * lateral);
    const lookAhead = 3.3 + Math.min(speed * .04, 2.1) - grid * 2.9;
    const look = new THREE.Vector3(p.x - Math.sin(heading) * lookAhead,
      p.y + 1.12 + grade * lookAhead * .72, p.z - Math.cos(heading) * lookAhead);
    // Damp the camera boom relative to the car. World-space damping let the
    // car recede ten metres into the distance on a fast straight.
    const jumped = this.cameraReady && this.cameraAnchor.distanceToSquared(p) >= 144;
    if (this.cameraReady && !jumped) {
      this.camera.position.sub(this.cameraAnchor).add(p);
      this.cameraLook.sub(this.cameraAnchor).add(p);
    }
    this.cameraAnchor.copy(p);
    if (!this.cameraReady || jumped || this.camera.position.distanceToSquared(desired) > 1600) {
      this.camera.position.copy(desired); this.cameraLook.copy(look);
      this.cameraVelocity.set(0, 0, 0); this.cameraReady = true;
    }
    for (const axis of ['x', 'y', 'z']) {
      const result = spring(this.camera.position[axis], this.cameraVelocity[axis], desired[axis], 9, dt);
      this.camera.position[axis] = result[0]; this.cameraVelocity[axis] = result[1];
    }
    this.cameraLook.lerp(look, -Math.expm1(-dt * 12));
    const target = this.cameraLook.clone();
    if (this.shake > 0 && !this.reducedMotion) {
      target.x += Math.sin(this.time * 51) * Math.min(.12, this.shake * .1);
      target.y += Math.sin(this.time * 67) * Math.min(.06, this.shake * .05);
    }
    this.shake = Math.max(0, this.shake - dt * 2.7);
    this.camera.lookAt(target);
    const fov = this.reducedMotion ? 63 : 59 + Math.min(speed * .14, 8) + (player.boosting ? 3 : 0);
    this.camera.fov = damp(this.camera.fov, fov, 5, dt);
    this.camera.updateProjectionMatrix();
  }

  lapGoal() { return this.config.mode.id === "race" ? 3 : 1; }

  standings() {
    return this.actors.filter((a) => !a.police).map((actor) => ({
      actor, distance: actor.lap + this.world.lapFraction(actor)
    })).sort((a, b) => {
      const left = a.actor.finishedAt ?? Infinity, right = b.actor.finishedAt ?? Infinity;
      return left === right ? b.distance - a.distance : left - right;
    });
  }

  resolveRaceFinish() {
    if (this.phase !== "play" || this.player.finishedAt == null || !["race", "sprint"].includes(this.config.mode.id)) return;
    const rank = this.standings().findIndex(({ actor }) => actor === this.player) + 1;
    const place = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH"][rank - 1] ?? rank + "TH";
    this.finish(place + " PLACE");
  }

  finalLap() {
    return this.config.mode.id !== "cruise" && (this.config.mode.id !== "race" || this.player.lap >= 2);
  }

  updateShortcutGuide() {
    const player = this.player;
    const previous = player.guidedFork;
    const next = this.guideShortcuts && !player.cut ? shortcutApproach(this.world, player) : null;
    player.guidedFork = next;
    if (previous?.road !== next?.road || previous?.gate !== next?.gate || previous?.arriving !== next?.arriving) this.showNextGate();
  }

  showNextGate() {
    const gate = this.player.next;
    const fork = this.player.guidedFork;
    if (fork && !fork.arriving && gate === (fork.entry + 1) % this.world.route.length) {
      this.world.setNextMarker(this.world.authorSegmentToRouteIndex(fork.road.to), fork.road.label, fork.road, fork.gate);
      return;
    }
    let label;
    if (!gate) label = this.config.mode.id === "escape" ? "EXTRACTION" : this.finalLap() ? "FINISH" : "LAP LINE";
    else if (this.raceTiming) {
      const sector = this.raceTiming.gates.indexOf(gate);
      if (sector >= 0) label = "S" + (sector + 1) + " · GATE " + gate;
    }
    this.world.setNextMarker(gate, label);
  }

  routeCue() {
    if (this.phase === "countdown") {
      const controls = this.touch.active
        ? (this.autoAccelerate ? "AUTO ACCELERATE ON" : "HOLD GAS TO LAUNCH")
        : "HOLD W, ↑ OR RT TO LAUNCH";
      const launch = {escape: "REACH EXTRACTION", time: "TIME TRIAL", cruise: "FREE DRIVE"};
      return { label: launch[this.config.mode.id] ?? "STARTING GRID", detail: controls };
    }
    const p = this.player;
    const route = this.world.route;
    const n = route.length;
    const index = p.next % n;
    const prev = route[(index - 1 + n) % n];
    const here = this.world.gatePosition(index);
    const next = route[(index + 1) % n];
    const fork = !p.cut && p.guidedFork;
    const entering = fork && !fork.arriving;
    const target = p.cut ? p.cut.road.points[p.cut.gate] : entering ? fork.road.points[fork.gate] : here;
    const pos = p.mesh.position;
    let distanceToTarget = Math.round(Math.hypot(target.x - pos.x, target.z - pos.z));
    let ahead = target, courseDistance = 0;
    if (!p.cut && !entering) {
      const world = this.world, stride = world.samples.length / n;
      const location = world.mainLocation(p);
      courseDistance = location.distance;
      const end = index ? world.sampleDistances[index * stride] : world.courseLength + world.timingOffset;
      distanceToTarget = Math.max(distanceToTarget, Math.round(end - location.distance));
      const last = index ? index * stride : world.samples.length + world.finishSamples;
      if (location.sample + 2 < last) ahead = world.samples[(location.sample + 2) % world.samples.length];
    }
    const dx = ahead.x - pos.x, dz = ahead.z - pos.z;
    const facing = (-dx * Math.sin(p.mesh.rotation.y) - dz * Math.cos(p.mesh.rotation.y)) * (p.speed < -2 ? -1 : 1);
    if (distanceToTarget > 16 && facing < -0.55 * Math.hypot(dx, dz))
      return { label: "WRONG WAY", detail: "TURN BACK TOWARD THE GREEN GATE" };
    if (p.cut) {
      const merge = shortcutMergeCue(this.world, p);
      if (merge) return merge;
      const marker = p.cut.road.points[shortcutMarkerIndex(p.cut.road, p.cut.gate)];
      return { label: p.cut.road.label, detail: Math.round(Math.hypot(marker.x - pos.x, marker.z - pos.z)) + "M TO THE NEXT ARCH" };
    }
    if (fork) {
      const grip = 3.1 + p.spec.handling * .055;
      const targetSpeed = Math.sqrt(20 * grip / Math.max(.25, fork.angle));
      const slowdown = Math.max(0, (p.speed**2 - targetSpeed**2) / (2 * (5 + p.spec.braking * .12)));
      const braking = fork.angle > .45 && p.speed > targetSpeed + 2 && fork.distance < slowdown + p.speed*.55;
      const turn = (fork.arriving ? "FORK " : "TAKE ") + fork.side;
      const instruction = fork.arriving ? Math.round(fork.distance) + "M" : fork.road.elevated ? "CLIMB THE RAMP" : "FOLLOW THE SHORTCUT";
      return { label: (braking ? "BRAKE · " : "") + turn, braking, apex: fork.road.points[0],
        targetKph: Math.round(targetSpeed * 5.7), detail: fork.road.label + " · " + instruction };
    }
    if (!index && this.config.mode.id === "escape") return { label: "EXTRACTION", detail: distanceToTarget + "M TO ESCAPE THE PURSUIT" };
    if (!index) return { label: this.finalLap() ? "FINISH LINE" : "LAP LINE", detail: distanceToTarget + "M TO THE CHECKERED LINE" };
    const corner = approachingCorner(this.world.corners, courseDistance, this.world.courseLength, p.speed, p.spec);
    if (corner) {
      const distance = Math.round(corner.distance);
      return {label: corner.bend.label, braking: corner.braking, apex: corner.bend.point,
        targetKph: Math.round(corner.targetSpeed * 5.7), detail: (corner.braking ? "BRAKE · " : "") + distance + "M TO BEND · GATE " + index};
    }
    const incoming = here.clone().sub(prev).normalize();
    const outgoing = next.clone().sub(here).normalize();
    const cross = incoming.x * outgoing.z - incoming.z * outgoing.x;
    const dot = clamp(incoming.dot(outgoing), -1, 1);
    const angle = Math.acos(dot);

    let label = "KEEP STRAIGHT";

    if (angle > 2.25) {
      label = cross < 0 ? "HAIRPIN LEFT" : "HAIRPIN RIGHT";
    } else if (angle > 0.86) {
      label = cross < 0 ? "TURN LEFT" : "TURN RIGHT";
    } else if (angle > 0.34) {
      label = cross < 0 ? "EASY LEFT" : "EASY RIGHT";
    }

    return {
      label,
      detail: `${distanceToTarget}M TO CHECKPOINT ${index}`,
    };
  }

  pursuitNote() {
    if (this.pursuitContact) return "CONTACT";
    if (this.pursuit.clearTime > 0) return "BREAKAWAY · " + Math.ceil(breakawaySeconds - this.pursuit.clearTime) + "S";
    if (this.pursuit.notice > 0) return "LOST A UNIT";
    if (this.player.roadBranch) return "UNITS ON MAIN ROAD";
    let nearest;
    for (const car of this.actors) {
      if (car.disabledFor > 0) continue;
      if (Number.isFinite(car.pursuitGap) && (nearest == null || Math.abs(car.pursuitGap) < Math.abs(nearest))) nearest = car.pursuitGap;
    }
    if (nearest == null) return this.actors.some(unit => unit.disabledFor > 0) ? "UNITS DISABLED" : "";
    return Math.round(Math.abs(nearest)) + " M " + (nearest >= 0 ? "BEHIND" : "AHEAD");
  }

  hudState() {
    const p = this.player;

    const pursuit = this.config.mode.id === "escape";

    const standings = this.standings();
    const rank = standings.findIndex(({ actor }) => actor === p) + 1;
    const progress = standings[rank - 1].distance;

    return {
      speed: Math.round(Math.abs(p.speed) * 5.7),
      gearing: this.tachometer,

      boost: p.boost,

      health: p.health,

      lap: p.lap + 1,

      next: p.next || this.world.route.length,

      targetIndex: p.next,

      total: this.world.route.length,

      time: this.elapsed,

      wanted: pursuit ? this.heat : 0,
      pursuitNote: pursuit ? this.pursuitNote() : "",

      cue: this.routeCue(),

      rank,
      progress: this.config.mode.id === "cruise" ? progress - p.lap : clamp(progress / this.lapGoal(), 0, 1),
      fieldSize: standings.length,
      winnerAhead: p.finishedAt == null && standings[0].actor.finishedAt != null,
      pace: this.pace,
      raceTiming: this.raceTiming,
      ghost: this.ghost?.visible ? this.ghost.position : null,

      map: this.world.map,

      player: p,

      actors: this.actors,
    };
  }
}
