import * as THREE from "three";
import { shortcutMarkerIndex } from "./shortcut-guide.js";
import { sampleHybridClosedRoute, planShortcutRoads, timingGateFraction } from "./course-shape.js";
import { courseSpan, trimSpan, offsetStation, spanGeometry, bridgeRuns, bridgeRailOffset, rampSpan, rampRailRuns } from "./course-structures.js";
import { nearestPointOnPath, roadProjection } from "./road-projection.js";
import { courseCorners } from "./corner-notes.js";
import { gatesPerSegment } from "./data.js";
import { batchWorld } from "./rendering.js";
import { advanceRoute, deflectVelocity } from "./route-motion.js";
import {
  createVehicle,
  animateVehicle,
  alignVehicleToSurface,
} from "./vehicle.js";

// Shared immutable geometry. These are intentionally never disposed by World;
// World instances can be destroyed and rebuilt as the player changes maps.
const box = new THREE.BoxGeometry(1, 1, 1);
const poleGeo = new THREE.CylinderGeometry(0.5, 0.55, 1, 8);
const lowCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
const discGeo = new THREE.CylinderGeometry(1, 1, 0.06, 16);
const sphereGeo = new THREE.SphereGeometry(1, 10, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 8);
const routeArrowGeo = new THREE.BufferGeometry();
routeArrowGeo.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(
    [-0.9, 0, -1.25, 0.9, 0, -1.25, 0, 0, 1.35],
    3,
  ),
);
routeArrowGeo.setIndex([0, 1, 2]);
routeArrowGeo.computeVertexNormals();
const vec = (p) => new THREE.Vector3(p[0], 0, p[1]);

const seeded = (n) => {
  let v = Math.abs(Math.floor(n * 9973)) + 1;
  return () => ((v = (v * 16807) % 2147483647) - 1) / 2147483646;
};

const clamp = THREE.MathUtils.clamp;
const TAU = Math.PI * 2;
const roadHalfWidth = 10.5;
const shortcutHalfWidth = 8.2;
const shoulderAllowance = 3;

function mesh(
  parent,
  geometry,
  material,
  position,
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  shadows = false,
) {
  const m = new THREE.Mesh(geometry, material);

  m.position.set(...position);
  m.scale.set(...scale);
  m.rotation.set(...rotation);

  m.castShadow = shadows;
  m.receiveShadow = shadows;

  m.userData.worldOwned = true;

  parent.add(m);

  return m;
}

function tangentAt(points, i, closed = true) {
  const n = points.length;

  const prev = points[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
  const next = points[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];

  const t = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);

  if (t.lengthSq() < 0.00001) {
    t.set(0, 0, 1);
  }

  return t.normalize();
}

function sampleClosedRoute(route, subdivisions = 10) {
  const result = [];

  for (let i = 0; i < route.length; i++) {
    const a = route[i];
    const b = route[(i + 1) % route.length];

    for (let s = 0; s < subdivisions; s++) {
      result.push(a.clone().lerp(b, s / subdivisions));
    }
  }

  return result;
}

function sampleSmoothClosedRoute(route, count) {
  const curve = new THREE.CatmullRomCurve3(route, true, "centripetal", 0.42);
  const points = curve.getSpacedPoints(count);
  points.pop();

  return points.map((point) => new THREE.Vector3(point.x, 0, point.z));
}

function createRibbonGeometry(points, halfWidth, y, uvScale = 14) {
  const positions = [];
  const uvs = [];
  const indices = [];

  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p = points[i];

    const t = tangentAt(points, i);

    const side = new THREE.Vector3(-t.z, 0, t.x);

    const left = p.clone().addScaledVector(side, halfWidth);
    const right = p.clone().addScaledVector(side, -halfWidth);

    const v = (i / Math.max(1, n - 1)) * uvScale;

    const py = typeof y === "function" ? y(i, n) : Array.isArray(y) ? y[i] : y;

    positions.push(left.x, py, left.z, right.x, py, right.z);

    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < n - 1; i++) {
    const k = i * 2;

    indices.push(
      k,
      k + 2,
      k + 1,

      k + 1,
      k + 2,
      k + 3,
    );
  }

  const k = (n - 1) * 2;

  indices.push(
    k,
    0,
    k + 1,

    k + 1,
    0,
    1,
  );

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

function createOpenRibbonGeometry(points, halfWidth, y, uvScale = 8) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p = points[i];
    const t = tangentAt(points, i, false);
    const side = new THREE.Vector3(-t.z, 0, t.x);
    const left = p.clone().addScaledVector(side, halfWidth);
    const right = p.clone().addScaledVector(side, -halfWidth);
    const v = (i / Math.max(1, n - 1)) * uvScale;

    const py = typeof y === "function" ? y(i, n) : Array.isArray(y) ? y[i] : y;

    positions.push(left.x, py, left.z, right.x, py, right.z);
    uvs.push(0, v, 1, v);
  }

  for (let i = 0; i < n - 1; i++) {
    const k = i * 2;
    indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
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

function makeCanvasTexture(draw, width = 256, height = 256) {
  const canvas = document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return texture;
}

function isMobileOrLowPower() {
  const coarse =
    typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;

  const touch =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const cores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 8 : 8;

  const memory =
    typeof navigator !== "undefined" ? navigator.deviceMemory || 8 : 8;

  return Boolean(coarse || touch || cores <= 4 || memory <= 4);
}

function localPoint(center, yaw, lx, ly, lz) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);

  return new THREE.Vector3(
    center.x + lx * c + lz * s,
    ly,
    center.z - lx * s + lz * c,
  );
}

export class World {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;

    this.group = new THREE.Group();

    this.group.name = `World:${map.id}`;

    scene.add(this.group);

    this.controlRoute = map.route.map(vec);

    this.route = sampleHybridClosedRoute(
      this.controlRoute,
      gatesPerSegment,
      map.straightSegments || [],
    );

    this.samples = sampleHybridClosedRoute(
      this.controlRoute,
      map.id === "neon" ? 22 : 18,
      map.straightSegments || [],
    );
    this.projectMainRoad = roadProjection(this.samples, roadHalfWidth + shoulderAllowance + 1);
    // The timing stripe sits on the opening straight, clear of the corner at route[0].
    this.finishLine = this.route[0].clone().lerp(this.route[1], timingGateFraction);
    this.finishSamples = Math.ceil(timingGateFraction * this.samples.length / this.route.length);
    this.finishForward = this.route[1].clone().sub(this.route[0]).normalize();
    this.timingLines = new Map([[0, {point: this.finishLine, forward: this.finishForward}]]);
    this.sampleDistances = [0];
    for (let i = 0; i < this.samples.length; i++) {
      const next = this.samples[(i + 1) % this.samples.length];
      this.sampleDistances.push(this.sampleDistances[i] + this.samples[i].distanceTo(next));
    }
    this.courseLength = this.sampleDistances.at(-1);
    this.corners = courseCorners(this.samples, this.sampleDistances, this.controlRoute.length);
    this.timingOffset = this.route[0].distanceTo(this.finishLine);
    this.roadSurfaceY = 0.052;
    this.shortcutRoads = planShortcutRoads(this.controlRoute, map.shortcuts || [], this.roadSurfaceY);
    this.destructibles = [];

    this.boundaryRadius =
      Math.max(...this.controlRoute.map((p) => Math.hypot(p.x, p.z))) + 110;

    this.markers = [];
    this.traffic = [];
    this.materials = [];
    this.materialCache = new Map();
    this.batchBox = box;
    this.textures = [];
    this.cityLights = [];
    this.geometries = [];

    this.instancedBatches = new Map();

    this.cityBuildings = [];
    this.landmarkAnchors = [];

    this.citySeed = map.id.length * 131 + 314;

    this.lowPower = isMobileOrLowPower();

    this.quality = this.lowPower
      ? {
          buildingCap: map.environment?.maxBuildingsMobile ?? 42,
          landmarkCap: 6,
          windowCap: 1700,
          streetStride: 2,
          skylineCount: 62,
          pointLights: 0,
        }
      : {
          buildingCap: Math.min(map.environment?.maxBuildingsDesktop ?? 60, 60),
          landmarkCap: 7,
          windowCap: 2200,
          streetStride: 1,
          skylineCount: 64,
          pointLights: 0,
        };

    this.build();
  }

  trackGeometry(geometry) {
    this.geometries.push(geometry);
    return geometry;
  }

  material(options) {
    const cacheKey = JSON.stringify(options, (k, v) =>
      v?.isTexture ? v.uuid : v,
    );
    if (this.materialCache.has(cacheKey))
      return this.materialCache.get(cacheKey);
    const material = new THREE.MeshStandardMaterial(options);

    this.materials.push(material);
    this.materialCache.set(
      JSON.stringify(options, (k, v) => (v?.isTexture ? v.uuid : v)),
      material,
    );

    if (options.map) {
      this.textures.push(options.map);
    }

    return material;
  }

  physical(options) {
    const { transmission, clearcoat, clearcoatRoughness, ...standard } =
      options;
    return this.material(standard);
  }

  basic(options) {
    const material = new THREE.MeshBasicMaterial(options);

    this.materials.push(material);

    if (options.map) {
      this.textures.push(options.map);
    }

    return material;
  }

  build() {
    const isNeon = this.map.id === "neon";

    this.scene.background = new THREE.Color(isNeon ? 0x020711 : this.map.sky);

    this.scene.fog = new THREE.FogExp2(
      isNeon ? 0x142438 : this.map.fog,
      isNeon ? 0.0038 : 0.0035,
    );

    this.buildRoadMaterials(isNeon);
    this.buildGround(isNeon);
    this.buildSky(isNeon);

    if (isNeon) {
      this.buildNightCity();
    } else {
      this.buildRegionalWorld();
    }

    this.buildRoute();
    this.buildCheckpoints();
    this.buildRegionalDetails();
    this.buildStreetFrontage();
    this.buildAtmosphere();
    this.buildTraffic();
    batchWorld(this);
    this.createVisibilityCells();
  }

  buildRoadMaterials(isNeon) {
    this.asphaltTexture = makeCanvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = "#10161c";

        ctx.fillRect(0, 0, w, h);

        const r = seeded(51);

        for (let i = 0; i < 28; i++) {
          ctx.globalAlpha = 0.07 + r() * 0.08;

          ctx.fillStyle = i % 2 ? "#68737a" : "#06090c";

          ctx.fillRect(r() * w, r() * h, 18 + r() * 70, 2 + r() * 8);
        }

        ctx.globalAlpha = 1;

        for (let i = 0; i < 9000; i++) {
          const v = 17 + Math.floor(r() * 24);

          ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;

          ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
        }

        ctx.globalAlpha = 0.13;

        for (let i = 0; i < 80; i++) {
          ctx.fillStyle = "#a1aab1";

          ctx.fillRect(r() * w, r() * h, 4 + r() * 28, 0.5 + r() * 1.2);
        }

        ctx.globalAlpha = 1;
      },
      512,
      512,
    );

    this.asphaltTexture.repeat.set(1, 1);
    this.asphaltTexture.anisotropy = 4;

    this.roadMat = this.physical({
      color: isNeon ? 0x687888 : 0x899197,
      roughness: isNeon ? (this.lowPower ? 0.58 : 0.5) : 0.72,
      metalness: 0.13,
      clearcoat: isNeon ? 0.42 : 0.2,
      clearcoatRoughness: 0.34,
      map: this.asphaltTexture,
      envMapIntensity: 0.16,
      bumpMap: this.asphaltTexture,
      bumpScale: 0.035,
    });

    this.roadEdgeMat = this.material({
      color: isNeon ? 0x20272d : 0x252b31,
      roughness: 0.83,
      metalness: 0.1,
    });

    const sidewalkTexture = makeCanvasTexture(
      (ctx, w, h) => {
        const r = seeded(89);

        ctx.fillStyle = isNeon ? "#4e555b" : "#6c645a";

        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = "rgba(20,25,30,.28)";

        ctx.lineWidth = 2;

        for (let y = 0; y <= h; y += 42) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        for (let x = 0; x <= w; x += 64) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.08;

        for (let i = 0; i < 1200; i++) {
          ctx.fillStyle = i % 2 ? "#fff" : "#050505";

          ctx.fillRect(r() * w, r() * h, 1, 1);
        }

        ctx.globalAlpha = 1;
      },
      256,
      256,
    );

    sidewalkTexture.repeat.set(2.5, 12);

    this.sidewalkMat = this.material({
      color: 0xffffff,
      roughness: 0.91,
      metalness: 0.03,
      map: sidewalkTexture,
    });

    this.curbMat = this.material({
      color: 0x444a4f,
      roughness: 0.76,
      metalness: 0.12,
    });

    this.drainMat = this.material({
      color: 0x1b2024,
      roughness: 0.7,
      metalness: 0.5,
    });

    this.lineMat = this.basic({
      color: isNeon ? 0xf2f4f4 : 0xf3e5c8,
    });

    this.edgeLineMat = this.basic({
      color: isNeon ? 0x7eddf7 : 0xffdb98,
      transparent: true,
      opacity: 0.46,
    });

    this.rumbleMat = this.basic({
      color: isNeon ? 0x5ce8ff : 0xe7b45b,
      transparent: true,
      opacity: 0.62,
    });

    this.neonSpillMat = this.basic({
      color: isNeon ? 0x45dfff : 0xffdb98,
      transparent: true,
      opacity: isNeon ? 0.16 : 0.08,
      depthWrite: false,
    });
  }

  buildGround(isNeon) {
    const groundTexture = makeCanvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = isNeon
          ? "#080f16"
          : this.map.id === "mesa"
            ? "#987657"
            : this.map.id === "dock"
              ? "#41464a"
              : "#344a3e";

        ctx.fillRect(0, 0, w, h);

        const r = seeded(74);

        for (let i = 0; i < 4500; i++) {
          const n = Math.floor(14 + r() * 25);
          ctx.globalAlpha = isNeon ? 0.7 : 0.13;
          ctx.fillStyle = i % 2 ? "#05080a" : "#e0cfb0";

          ctx.fillRect(r() * w, r() * h, 1 + r() * 4, 1 + r() * 4);
        }
        ctx.globalAlpha = 1;
      },
      512,
      512,
    );

    groundTexture.repeat.set(7, 7);

    const ground = mesh(
      this.group,
      this.trackGeometry(new THREE.PlaneGeometry(1120, 1120)),
      this.material({
        map: groundTexture,
        roughness: 0.96,
        metalness: 0.02,
      }),
      [0, -0.35, 0],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
      false,
    );

    ground.receiveShadow = true;
  }

  buildSky(isNeon) {
    const texture = makeCanvasTexture(
      (ctx, w, h) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, h);

        if (isNeon) {
          gradient.addColorStop(0, "#020308");

          gradient.addColorStop(0.42, "#071220");

          gradient.addColorStop(1, "#142536");
        } else {
          gradient.addColorStop(0, this.map.sky || "#658695");

          gradient.addColorStop(
            0.65,
            this.map.id === "mesa"
              ? "#d58a66"
              : this.map.id === "coast"
                ? "#d2c6b1"
                : "#b98576",
          );
          gradient.addColorStop(1, "#5c6576");
        }

        ctx.fillStyle = gradient;

        ctx.fillRect(0, 0, w, h);

        const random = seeded(934);
        if (!isNeon) {
          const sunX = w * 0.73,
            sunY = h * 0.48;
          const haze = ctx.createRadialGradient(
            sunX,
            sunY,
            0,
            sunX,
            sunY,
            h * 0.36,
          );
          haze.addColorStop(0, "rgba(255,223,170,.5)");
          haze.addColorStop(1, "rgba(255,201,150,0)");
          ctx.fillStyle = haze;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = "rgba(255,234,195,.92)";
          ctx.beginPath();
          ctx.arc(sunX, sunY, h * 0.025, 0, TAU);
          ctx.fill();
          for (let i = 0; i < 20; i++) {
            ctx.fillStyle = "rgba(235,221,211,.035)";
            ctx.beginPath();
            ctx.ellipse(
              random() * w,
              h * (0.23 + random() * 0.24),
              30 + random() * 100,
              2 + random() * 5,
              0,
              0,
              TAU,
            );
            ctx.fill();
          }
          ctx.fillStyle =
            this.map.id === "mesa"
              ? "#987766"
              : this.map.id === "coast"
                ? "#7c9698"
                : "#777b86";
          ctx.beginPath();
          ctx.moveTo(0, h * 0.54);
          for (let x = 0; x <= w; x += w / 30)
            ctx.lineTo(x, h * (0.48 + random() * 0.06));
          ctx.lineTo(w, h * 0.59);
          ctx.lineTo(0, h * 0.59);
          ctx.fill();
        } else {
          for (let i = 0; i < 180; i++) {
            ctx.fillStyle = `rgba(211,230,246,${0.15 + random() * 0.4})`;
            ctx.fillRect(
              random() * w,
              random() * h * 0.43,
              0.5 + random(),
              0.5 + random(),
            );
          }
        }
        if (isNeon) {
          const glow = ctx.createRadialGradient(
            w * 0.5,
            h * 0.78,
            20,
            w * 0.5,
            h * 0.78,
            w * 0.55,
          );
          glow.addColorStop(0, "rgba(76,145,190,.16)");
          glow.addColorStop(1, "rgba(76,145,190,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
        }
      },
      1024,
      512,
    );

    const sky = new THREE.Mesh(
      this.trackGeometry(new THREE.SphereGeometry(600, 24, 12)),
      this.basic({
        map: texture,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );

    this.scene.background = texture;
    // Equirectangular background avoids clipping the sky at mobile draw distances.
    texture.mapping = THREE.EquirectangularReflectionMapping;
    sky.visible = false;
    sky.frustumCulled = false;

    sky.userData.worldOwned = true;

    this.group.add(sky);
  }

  buildRoute() {
    const points = this.samples;

    const g = this.group;

    const road = new THREE.Mesh(
      this.trackGeometry(createRibbonGeometry(points, roadHalfWidth, 0.05, 16)),
      this.roadMat,
    );

    road.receiveShadow = true;

    road.userData.worldOwned = true;

    g.add(road);

    const edge = new THREE.Mesh(
      this.trackGeometry(createRibbonGeometry(points, 11.75, -0.015, 16)),
      this.roadEdgeMat,
    );

    edge.receiveShadow = true;

    edge.userData.worldOwned = true;

    g.add(edge);

    const sidewalk = new THREE.Mesh(
      this.trackGeometry(createRibbonGeometry(points, 13.35, -0.05, 18)),
      this.sidewalkMat,
    );

    sidewalk.receiveShadow = true;

    sidewalk.userData.worldOwned = true;

    g.add(sidewalk);

    this.addRoadMarkings(points);

    this.addRouteGuidanceArrows(points);

    this.addRoadSurfaceDetails();

    this.addSidewalkDetails();

    if (this.map.id === "neon") {
      this.buildSelectedIntersections();

      this.buildFlyover(5, 6);

      this.buildUnderpass(9 / gatesPerSegment, 10 / gatesPerSegment);

      this.buildBridgeRails(13 / gatesPerSegment, 14 / gatesPerSegment);
    }

    this.buildMapSetPieces();

    this.buildShortcutRoads();

    this.addCourseDressing();

    this.addRoadBarrierSystems();

    this.addDestructibleRoadTowers();
  }

  buildShortcutRoads() {
    if (!this.shortcutRoads.length) return;

    const deckMat = this.material({
      color: 0x1e252d,
      roughness: 0.52,
      metalness: 0.22,
    });

    const railMat = this.material({
      color: 0x404950,
      roughness: 0.64,
      metalness: 0.46,
    });

    const glowMat = this.basic({
      color: this.map.accent,
      transparent: true,
      opacity: 0.66,
    });

    const branchArrows = [];
    const arrowTransform = new THREE.Object3D();

    for (const shortcut of this.shortcutRoads) {
      const { points, elevated, heightProfile } = shortcut;
      const road = new THREE.Mesh(
        this.trackGeometry(
          createOpenRibbonGeometry(points, shortcutHalfWidth, heightProfile, 8),
        ),
        this.roadMat,
      );
      road.receiveShadow = true;
      road.userData.worldOwned = true;
      this.group.add(road);

      for (let i = 2; i < points.length - 1; i += 2) {
        const a = points[i - 1], b = points[i + 1];
        const direction = b.clone().sub(a);
        const pitch = -Math.atan2(heightProfile[i + 1] - heightProfile[i - 1], Math.hypot(direction.x, direction.z));
        arrowTransform.rotation.set(pitch, Math.atan2(direction.x, direction.z), 0, "YXZ");
        arrowTransform.position.copy(points[i]).y = heightProfile[i] + .12;
        arrowTransform.scale.set(1.25, 1, 1.6);
        arrowTransform.updateMatrix();
        branchArrows.push(arrowTransform.matrix.clone());
      }
      const entrance = points[2], heading = tangentAt(points, 2, false);
      const entryYaw = Math.atan2(heading.x, heading.z);
      const sign = localPoint(entrance, entryYaw, shortcutHalfWidth + 1.5, heightProfile[2] + 2.6, 0);
      this.addPanel(sign, entryYaw + Math.PI, shortcut.label, "OPTIONAL SHORTCUT", 8, 2);

      const edges = [
        this.createContinuousLine(
          points,
          -7.65,
          0.05,
          heightProfile.map((h) => h + 0.085),
          false,
        ),
        this.createContinuousLine(
          points,
          7.65,
          0.05,
          heightProfile.map((h) => h + 0.085),
          false,
        ),
      ];
      edges.forEach((edge) => {
        edge.material = glowMat;
        edge.userData.worldOwned = true;
        this.group.add(edge);
      });

      for (let i = 3; !elevated && i < points.length - 3; i += 5) {
        const p = points[i];
        const t = tangentAt(points, i);
        const yaw = Math.atan2(t.x, t.z);
        const side = new THREE.Vector3(-t.z, 0, t.x);

        for (const sign of [-1, 1]) {
          const rail = p.clone().addScaledVector(side, sign * 8.6);
          const h = heightProfile[i];
          if (this.projectMainRoad(rail).distance <= roadHalfWidth + .8) continue;
          mesh(
            this.group,
            box,
            railMat,
            [rail.x, h + 0.72, rail.z],
            [0.28, 1.24, 1.3],
            [0, yaw, 0],
          );
        }
      }

      if (elevated) {
        const span = rampSpan(shortcut);
        this.addCourseSlab("Shortcut deck", span, -shortcutHalfWidth, shortcutHalfWidth, -.72, -.045, deckMat);
        for (const side of [-1, 1]) {
          const offset = side * (shortcutHalfWidth - .12);
          const runs = rampRailRuns(span, offset, this.projectMainRoad, roadHalfWidth, this.roadSurfaceY);
          for (const run of runs) {
            this.addCourseSlab("Shortcut parapet", run, offset - .12, offset + .12, 0, .88, railMat);
          }
        }
        for (const step of [.32, .5, .68]) {
          const station = span[Math.floor(step * (span.length - 1))];
          const h = station.point.y;
          const p = [0, -6, 6].map(offset => offsetStation(station, offset, 0))
            .find(point => this.projectMainRoad(point).distance > roadHalfWidth + 1.1);
          if (!p) continue;
          mesh(
            this.group,
            box,
            deckMat,
            [p.x, Math.max(1.6, h * 0.5), p.z],
            [1.4, Math.max(2.2, h), 1.4],
          );
        }
      }
    }
    this.installInstance("shortcutArrows", routeArrowGeo,
      this.basic({ color: 0xffc870, side: THREE.DoubleSide, toneMapped: false }),
      branchArrows);
  }

  createSignTexture(title, subtitle, accent = this.map.accent) {
    return makeCanvasTexture(
      (ctx, w, h) => {
        const gradient = ctx.createLinearGradient(0, 0, w, h);
        gradient.addColorStop(0, "#07101a");
        gradient.addColorStop(0.56, "#111522");
        gradient.addColorStop(1, "#261338");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);

        ctx.globalAlpha = 0.26;
        ctx.fillStyle = accent;
        for (let i = -2; i < 6; i++) {
          ctx.fillRect(i * 118, h * 0.72, 82, 8);
        }
        ctx.globalAlpha = 1;

        ctx.strokeStyle = accent;
        ctx.lineWidth = 7;
        ctx.strokeRect(9, 9, w - 18, h - 18);

        ctx.fillStyle = "#f7fbff";
        ctx.font = "700 54px Arial";
        ctx.fillText(title.toUpperCase(), 28, 74);

        ctx.fillStyle = accent;
        ctx.font = "700 21px Arial";
        ctx.fillText(subtitle.toUpperCase(), 31, 111);
      },
      512,
      128,
    );
  }

  addPanel(position, yaw, title, subtitle, width = 13.5, height = 3.4) {
    const texture = this.createSignTexture(title, subtitle);
    const material = this.basic({
      map: texture,
      side: THREE.FrontSide,
      toneMapped: false,
    });

    const panel = mesh(
      this.group,
      this.trackGeometry(new THREE.PlaneGeometry(width, height)),
      material,
      [position.x, position.y, position.z],
      [1, 1, 1],
      [0, yaw, 0],
    );

    panel.userData.worldOwned = true;
    const back = panel.clone();
    back.position.add(
      new THREE.Vector3(-Math.sin(yaw) * 0.03, 0, -Math.cos(yaw) * 0.03),
    );
    back.rotation.y += Math.PI;
    this.group.add(back);
    return panel;
  }

  addCourseDressing() {
    const accent = this.basic({
      color: this.map.accent,
      transparent: true,
      opacity: this.map.id === "neon" ? 0.9 : 0.72,
    });

    const dark = this.material({
      color: 0x10151c,
      roughness: 0.62,
      metalness: 0.62,
    });

    const warning = this.basic({
      color:
        this.map.id === "dock"
          ? 0xffa255
          : this.map.id === "mesa"
            ? 0xffd05a
            : 0x55e7ff,
      transparent: true,
      opacity: 0.82,
    });

    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const chevrons = [];
    const supports = [];

    const start = this.finishLine;
    const startYaw = this.segmentAngle(0);

    for (const side of [-1, 1]) {
      const post = localPoint(start, startYaw, side * 10.8, 3.6, -1.6);
      mesh(
        this.group,
        box,
        dark,
        [post.x, post.y, post.z],
        [0.32, 7.2, 0.32],
        [0, startYaw, 0],
      );
    }

    mesh(
      this.group,
      box,
      accent,
      [start.x, 7.1, start.z],
      [22.0, 0.22, 0.42],
      [0, startYaw, 0],
    );

    this.addPanel(
      localPoint(start, startYaw, 0, 5.7, -1.9),
      startYaw,
      "START / FINISH",
      this.map.name,
      11.6,
      2.45,
    );

    const billboardCount = this.lowPower ? 2 : 4;
    for (let i = 0; i < billboardCount; i++) {
      const index =
        (2 + i * Math.floor(this.route.length / billboardCount)) %
        this.route.length;
      const side = i % 2 ? -1 : 1;
      const yaw = this.segmentAngle(index);
      const label = i % 3 === 0 ? "NITRO" : i % 3 === 1 ? "APEX" : "TOUCHDRIVE";
      const pos = localPoint(this.route[index], yaw, side * 22.5, 5.2, 0);

      mesh(
        this.group,
        box,
        dark,
        [pos.x, 2.3, pos.z],
        [0.24, 4.6, 0.24],
        [0, yaw, 0],
      );
      this.addPanel(pos, yaw, label, "NIGHTSHIFT SERIES", 10.2, 2.75);
    }

    for (let i = 1; i < this.route.length; i++) {
      const prev = tangentAt(this.route, i - 1);
      const next = tangentAt(this.route, i);
      const turn = prev.x * next.z - prev.z * next.x;

      if (Math.abs(turn) < 0.18 && i % 3 !== 0) continue;

      const yaw = this.segmentAngle(i);
      const side = turn >= 0 ? -1 : 1;

      for (let j = -1; j <= 1; j++) {
        const base = localPoint(
          this.route[i],
          yaw,
          side * 11.6,
          1.15,
          j * 2.15,
        );
        matrix.compose(
          base,
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw - side * 0.42),
          new THREE.Vector3(1.25, 0.22, 0.08),
        );
        chevrons.push(matrix.clone());

        matrix.compose(
          localPoint(this.route[i], yaw, side * 12.0, 0.72, j * 2.15),
          q.identity(),
          new THREE.Vector3(0.16, 1.44, 0.16),
        );
        supports.push(matrix.clone());
      }
    }

    this.installRoadside("courseChevrons", box, warning, chevrons);
    this.installRoadside("courseChevronSupports", box, dark, supports);
  }

  clearForRoadside(position, margin = 0) {
    if (this.projectMainRoad(position).distance <= roadHalfWidth + margin) return false;
    return this.shortcutRoads.every(road =>
      nearestPointOnPath(position, road.points, false).distance > shortcutHalfWidth + margin);
  }

  installRoadside(key, geometry, material, matrices) {
    const point = new THREE.Vector3();
    const clear = matrices.filter(matrix => {
      for (const x of [-.5, .5]) {
        for (const z of [-.5, 0, .5]) {
          point.set(x, 0, z).applyMatrix4(matrix);
          if (!this.clearForRoadside(point, .15)) return false;
        }
      }
      return true;
    });
    this.installInstance(key, geometry, material, clear);
  }

  addRoadBarrierSystems() {
    const concrete = this.material({
      color: 0x86817b,
      roughness: 0.94,
      metalness: 0.02,
    });

    const steel = this.material({
      color: 0x68747c,
      roughness: 0.46,
      metalness: 0.78,
    });

    const white = this.basic({
      color: 0xf2f7f7,
      transparent: true,
      opacity: 0.9,
    });

    const green = this.material({
      color: 0x182b22,
      roughness: 0.98,
      metalness: 0,
    });

    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    const kRails = [];
    const guardRails = [];
    const posts = [];
    const delineators = [];
    const medians = [];

    for (let i = 0; i < this.route.length; i++) {
      const p = this.route[i];
      const prev = tangentAt(this.route, i - 1);
      const next = tangentAt(this.route, i);
      const turn = prev.x * next.z - prev.z * next.x;
      const tangent = tangentAt(this.route, i);
      const yaw = Math.atan2(tangent.x, tangent.z);
      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);

      if (Math.abs(turn) > 0.12) {
        const outside = turn > 0 ? -1 : 1;
        const base = p.clone().addScaledVector(side, outside * 13.35);

        matrix.compose(
          base.clone().setY(this.roadSurfaceY + 0.58),
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
          new THREE.Vector3(0.24, 0.42, 5.8),
        );
        guardRails.push(matrix.clone());

        for (let j = -1; j <= 1; j++) {
          matrix.compose(
            p
              .clone()
              .addScaledVector(side, outside * 13.65)
              .addScaledVector(tangent, j * 2.2)
              .setY(this.roadSurfaceY + 0.52),
            q.identity(),
            new THREE.Vector3(0.13, 1.04, 0.13),
          );
          posts.push(matrix.clone());
        }
      }

      if (i % 5 === 2) {
        for (const sign of [-1, 1]) {
          matrix.compose(
            p
              .clone()
              .addScaledVector(side, sign * 12.15)
              .setY(this.roadSurfaceY + 0.42),
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
            new THREE.Vector3(0.36, 0.84, 3.6),
          );
          kRails.push(matrix.clone());
        }
      }

      if (i % 4 === 0) {
        matrix.compose(
          p
            .clone()
            .addScaledVector(side, 15.2)
            .setY(this.roadSurfaceY + 0.12),
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
          new THREE.Vector3(0.7, 0.24, 5.2),
        );
        medians.push(matrix.clone());

        for (const sign of [-1, 1]) {
          matrix.compose(
            p
              .clone()
              .addScaledVector(side, sign * 12.3)
              .setY(this.roadSurfaceY + 0.76),
            q.identity(),
            new THREE.Vector3(0.1, 1.35, 0.1),
          );
          delineators.push(matrix.clone());
        }
      }
    }

    this.installRoadside("jerseyBarriers", box, concrete, kRails);
    this.installRoadside("guardRailBeams", box, steel, guardRails);
    this.installRoadside("guardRailPosts", poleGeo, steel, posts);
    this.installRoadside("delineatorPosts", poleGeo, white, delineators);
    this.installRoadside("medianIslands", box, green, medians);
  }

  addDestructibleRoadTowers() {
    const concreteMat = this.material({
      color: 0x8b8580,
      roughness: 0.92,
      metalness: 0.02,
    });

    const plasticMat = this.material({
      color: 0xd87135,
      roughness: 0.62,
      metalness: 0.05,
    });

    const metalMat = this.material({
      color: 0x5c666d,
      roughness: 0.45,
      metalness: 0.72,
    });

    const stripeMat = this.basic({
      color: this.map.id === "mesa" ? 0xffd05a : 0xf3f7ff,
      transparent: true,
      opacity: 0.9,
    });

    const count = Math.min(this.lowPower ? 5 : 9, this.route.length - 3);

    for (let n = 0; n < count; n++) {
      const i = 2 + ((n * 3) % (this.route.length - 3));
      const p = this.route[i];
      const t = tangentAt(this.route, i);
      const side = new THREE.Vector3(-t.z, 0, t.x);
      const roadside = n % 2 ? -21.5 : 21.5;
      const pos = p.clone().addScaledVector(side, roadside);
      const yaw = Math.atan2(t.x, t.z);
      const style = n % 3;
      if (!this.clearForRoadside(pos, 3.2)) continue;

      const barrier = new THREE.Group();
      barrier.position.set(pos.x, this.roadSurfaceY, pos.z);
      barrier.rotation.y = yaw;
      barrier.userData.worldOwned = true;
      barrier.userData.destructible = true;
      barrier.userData.radius = style === 0 ? 3.2 : 2.7;
      barrier.userData.alive = true;

      if (style === 0) {
        mesh(barrier, box, concreteMat, [0, 0.42, 0], [5.8, 0.84, 0.78]);
        mesh(barrier, box, concreteMat, [0, 0.95, 0], [4.8, 0.34, 0.46]);
        mesh(
          barrier,
          box,
          stripeMat,
          [-1.55, 1.16, -0.27],
          [1.25, 0.12, 0.06],
          [0, 0, 0.42],
        );
        mesh(
          barrier,
          box,
          stripeMat,
          [1.55, 1.16, -0.27],
          [1.25, 0.12, 0.06],
          [0, 0, -0.42],
        );
      } else if (style === 1) {
        mesh(barrier, box, metalMat, [0, 4.1, 0], [0.38, 8.2, 0.38]);
        mesh(barrier, box, metalMat, [0, 7.95, 0], [3.7, 0.14, 0.14]);
        mesh(
          barrier,
          box,
          metalMat,
          [-1.35, 5.95, 0],
          [0.12, 4.0, 0.12],
          [0, 0, 0.34],
        );
        mesh(
          barrier,
          box,
          metalMat,
          [1.35, 5.95, 0],
          [0.12, 4.0, 0.12],
          [0, 0, -0.34],
        );
        mesh(barrier, box, stripeMat, [0, 2.0, -0.24], [1.4, 0.2, 0.05]);
      } else {
        for (const x of [-1.6, 0, 1.6]) {
          mesh(
            barrier,
            lowCylinderGeo,
            plasticMat,
            [x, 0.72, 0],
            [0.52, 1.44, 0.52],
          );
          mesh(barrier, box, stripeMat, [x, 1.08, -0.48], [0.76, 0.12, 0.05]);
          mesh(barrier, box, stripeMat, [x, 0.46, -0.48], [0.76, 0.12, 0.05]);
        }
        mesh(barrier, box, metalMat, [0, 1.58, 0], [4.6, 0.12, 0.12]);
      }

      if (style === 1) {
        for (const x of [-2.1, 2.1]) {
          mesh(
            barrier,
            lowCylinderGeo,
            plasticMat,
            [x, 0.48, 0.45],
            [0.28, 0.96, 0.28],
          );
          mesh(barrier, box, stripeMat, [x, 0.9, 0.2], [0.5, 0.09, 0.05]);
        }
      }

      this.group.add(barrier);
      barrier.userData.topY = new THREE.Box3().setFromObject(barrier).max.y;
      this.destructibles.push(barrier);
    }
  }

  destroyDestructible(target, force = 1) {
    if (!target?.userData?.alive) return false;

    target.userData.alive = false;
    target.visible = false;
    target.position.y = -20;

    for (const child of target.children) {
      child.visible = false;
    }

    void force;
    return true;
  }

  addRouteGuidanceArrows(points) {
    const matrices = [];
    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const interval = this.lowPower ? 20 : 14;
    let travelled = interval;
    const material = this.basic({
      color: 0x63ffd4,
      toneMapped: false,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < points.length; i++) {
      travelled += points[i].distanceTo(points[(i + points.length - 1) % points.length]);
      if (travelled < interval) continue;
      travelled %= interval;
      const p = points[i];
      const t = tangentAt(points, i);
      const yaw = Math.atan2(t.x, t.z);

      matrix.compose(
        new THREE.Vector3(p.x, this.roadSurfaceY + 0.13, p.z),
        q.setFromAxisAngle(yAxis, yaw),
        new THREE.Vector3(1.55, 1, 1.85),
      );
      matrices.push(matrix.clone());
    }

    this.installInstance(
      "routeGuidanceArrows",
      routeArrowGeo,
      material,
      matrices,
    );
  }

  addRoadMarkings(points) {
    const laneOffsets = [-3.5, 0, 3.5];

    for (let i = 0; i < laneOffsets.length; i++) {
      const stripe = this.createDashedRibbon(
        points,
        laneOffsets[i],
        0.055,
        0.12,
        i !== 1,
      );

      stripe.material = this.lineMat;

      stripe.userData.worldOwned = true;

      this.group.add(stripe);
    }

    const edgeLeft = this.createContinuousLine(points, -9.85, 0.032, 0.13);

    const edgeRight = this.createContinuousLine(points, 9.85, 0.032, 0.13);

    edgeLeft.material = this.edgeLineMat;

    edgeRight.material = this.edgeLineMat;

    edgeLeft.userData.worldOwned = true;

    edgeRight.userData.worldOwned = true;

    this.group.add(edgeLeft, edgeRight);
  }

  createContinuousLine(points, laneOffset, width, y, closed = true) {
    const verts = [];
    const inds = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      const t = tangentAt(points, i, closed);

      const s = new THREE.Vector3(-t.z, 0, t.x);

      const a = p.clone().addScaledVector(s, laneOffset + width);

      const b = p.clone().addScaledVector(s, laneOffset - width);

      const py =
        typeof y === "function"
          ? y(i, points.length)
          : Array.isArray(y)
            ? y[i]
            : y;

      verts.push(a.x, py, a.z, b.x, py, b.z);
    }

    for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
      const k = i * 2;

      const next = ((i + 1) % points.length) * 2;
      inds.push(
        k,
        next,
        k + 1,

        k + 1,
        next,
        next + 1,
      );
    }

    const geometry = this.trackGeometry(new THREE.BufferGeometry());

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3),
    );

    geometry.setIndex(inds);

    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, this.lineMat);
  }

  createDashedRibbon(points, laneOffset, width, y, dashed = true) {
    const verts = [];
    const inds = [];

    for (let i = 0; i < points.length - 1; i++) {
      if (dashed && i % 8 >= 4) {
        continue;
      }

      const a = points[i];
      const b = points[i + 1];

      const ta = tangentAt(points, i);

      const tb = tangentAt(points, i + 1);

      const sa = new THREE.Vector3(-ta.z, 0, ta.x);

      const sb = new THREE.Vector3(-tb.z, 0, tb.x);

      const al = a.clone().addScaledVector(sa, laneOffset + width);

      const ar = a.clone().addScaledVector(sa, laneOffset - width);

      const bl = b.clone().addScaledVector(sb, laneOffset + width);

      const br = b.clone().addScaledVector(sb, laneOffset - width);

      const k = verts.length / 3;

      verts.push(
        al.x,
        y,
        al.z,

        ar.x,
        y,
        ar.z,

        bl.x,
        y,
        bl.z,

        br.x,
        y,
        br.z,
      );

      inds.push(
        k,
        k + 2,
        k + 1,

        k + 1,
        k + 2,
        k + 3,
      );
    }

    const geometry = this.trackGeometry(new THREE.BufferGeometry());

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3),
    );

    geometry.setIndex(inds);

    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, this.lineMat);
  }

  createSideStrip(points, innerOffset, outerOffset, y, material) {
    const verts = [];
    const inds = [];

    for (let i = 0; i < points.length; i++) {
      const p = points[i];

      const t = tangentAt(points, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      const a = p.clone().addScaledVector(side, innerOffset);

      const b = p.clone().addScaledVector(side, outerOffset);

      verts.push(
        a.x,
        y,
        a.z,

        b.x,
        y,
        b.z,
      );
    }

    for (let i = 0; i < points.length - 1; i++) {
      const k = i * 2;

      inds.push(
        k,
        k + 2,
        k + 1,

        k + 1,
        k + 2,
        k + 3,
      );
    }

    const geometry = this.trackGeometry(new THREE.BufferGeometry());

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(verts, 3),
    );

    geometry.setIndex(inds);

    geometry.computeVertexNormals();

    return new THREE.Mesh(geometry, material);
  }

  addRoadSurfaceDetails() {
    const r = seeded(1201);

    const manholeMatrices = [];
    const patchMatrices = [];
    const drainMatrices = [];

    const matrix = new THREE.Matrix4();

    const q = new THREE.Quaternion();

    for (let i = 1; i < this.route.length; i += 3) {
      const p = this.route[i];

      const t = tangentAt(this.route, i);

      const yaw = Math.atan2(t.x, t.z);

      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

      matrix.compose(
        p
          .clone()
          .add(new THREE.Vector3((r() - 0.5) * 5, 0.075, (r() - 0.5) * 3)),
        q,
        new THREE.Vector3(1, 1, 1),
      );

      manholeMatrices.push(matrix.clone());

      if (i % 2 === 1) {
        matrix.compose(
          p.clone().addScaledVector(new THREE.Vector3(-t.z, 0, t.x), -3.5),
          q,
          new THREE.Vector3(4.2, 0.035, 0.16),
        );

        patchMatrices.push(matrix.clone());
      }
    }

    for (let i = 0; i < this.route.length; i += this.quality.streetStride) {
      const p = this.route[i];

      const t = tangentAt(this.route, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      for (const sign of [-1, 1]) {
        const pos = p.clone().addScaledVector(side, sign * 10.95);

        matrix.compose(
          pos.clone().setY(0.12),
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(t.x, t.z)),
          new THREE.Vector3(0.28, 1, 1.1),
        );

        drainMatrices.push(matrix.clone());
      }
    }

    this.installInstance("manholes", discGeo, this.drainMat, manholeMatrices);

    this.installInstance("roadPatches", box, this.roadEdgeMat, patchMatrices);

    this.installInstance("drains", box, this.drainMat, drainMatrices);

    for (const sign of [-1, 1]) {
      const strip = this.createSideStrip(
        this.samples,
        sign * 10.72,
        sign * 10.88,
        0.15,
        this.drainMat,
      );

      strip.userData.worldOwned = true;

      this.group.add(strip);
    }

    const rumbleSegments = this.map.id === "neon" ? [3, 6, 12] : [];

    for (const i of rumbleSegments) {
      const p = this.route[i];

      const t = tangentAt(this.route, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      const yaw = Math.atan2(t.x, t.z);

      for (let j = -2; j <= 2; j++) {
        const pos = p.clone().addScaledVector(t, j * 1.2);

        const left = pos.clone().addScaledVector(side, 9.65);

        const right = pos.clone().addScaledVector(side, -9.65);

        mesh(
          this.group,
          box,
          this.rumbleMat,
          [left.x, 0.16, left.z],
          [0.48, 0.035, 0.6],
          [0, yaw, 0],
        );

        mesh(
          this.group,
          box,
          this.rumbleMat,
          [right.x, 0.16, right.z],
          [0.48, 0.035, 0.6],
          [0, yaw, 0],
        );
      }
    }

    if (this.map.id === "neon") {
      const spillMatrices = [];

      for (let i = 0; i < this.route.length; i++) {
        const district = this.getDistrictForSegment(i);

        if ((district?.roadDetail ?? 0.7) < 0.75 && i % 2) {
          continue;
        }

        const p = this.route[i];

        const t = tangentAt(this.route, i);

        const side = new THREE.Vector3(-t.z, 0, t.x);

        const yaw = Math.atan2(t.x, t.z);

        for (const sign of [-1, 1]) {
          if ((i + sign + 2) % 3 === 0 && district?.type !== "neonDistrict") {
            continue;
          }

          matrix.compose(
            p
              .clone()
              .addScaledVector(side, sign * (7.9 + r() * 0.6))
              .setY(0.145),
            q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
            new THREE.Vector3(3.4 + r() * 2.4, 0.018, 0.18),
          );

          spillMatrices.push(matrix.clone());
        }
      }

      this.installInstance(
        "roadNeonSpills",
        box,
        this.neonSpillMat,
        spillMatrices,
      );
    }
  }

  addSidewalkDetails() {
    const metal = this.material({
      color: 0x4a535a,
      roughness: 0.45,
      metalness: 0.84,
    });

    const dark = this.material({
      color: 0x1d252a,
      roughness: 0.76,
      metalness: 0.3,
    });

    const planter = this.material({
      color: 0x16271e,
      roughness: 0.96,
      metalness: 0.02,
    });

    const light = this.basic({
      color: 0x7fe9ff,
    });

    const matrix = new THREE.Matrix4();

    const q = new THREE.Quaternion();

    const poles = [];
    const bollards = [];
    const planters = [];

    for (
      let i = 0;
      i < this.samples.length;
      i += 7 * this.quality.streetStride
    ) {
      const p = this.samples[i];

      const t = tangentAt(this.samples, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      const yaw = Math.atan2(t.x, t.z);

      for (const sign of [-1, 1]) {
        const pos = p.clone().addScaledVector(side, sign * 14.85);
        if (!this.clearForRoadside(pos, 3.0)) continue;

        matrix.compose(
          pos.clone().setY(4.15),
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
          new THREE.Vector3(0.18, 8.2, 0.18),
        );

        poles.push(matrix.clone());

        if (i % 14 === 0 || !this.lowPower) {
          const planterPos = p.clone().addScaledVector(side, sign * 17.0);

          matrix.compose(
            planterPos.clone().setY(0.36),
            q.identity(),
            new THREE.Vector3(1.7, 0.72, 0.7),
          );

          planters.push(matrix.clone());
        }

        if (i % 2 === 0) {
          const bpos = p.clone().addScaledVector(side, sign * 12.85);

          matrix.compose(
            bpos.clone().setY(0.52),
            q.identity(),
            new THREE.Vector3(0.13, 1.04, 0.13),
          );

          bollards.push(matrix.clone());
        }
      }
    }

    this.installInstance("lampPoles", poleGeo, metal, poles);

    this.installInstance("bollards", poleGeo, metal, bollards);

    this.installInstance("planters", box, planter, planters);

    const lampHeads = [];

    for (
      let i = 0;
      i < this.samples.length;
      i += 14 * this.quality.streetStride
    ) {
      const p = this.samples[i];

      const t = tangentAt(this.samples, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      for (const sign of [-1, 1]) {
        const pos = p.clone().addScaledVector(side, sign * 14.85);
        if (!this.clearForRoadside(pos, 3.0)) continue;

        const m = new THREE.Matrix4();

        m.compose(
          pos.clone().setY(8.25),
          new THREE.Quaternion(),
          new THREE.Vector3(0.42, 0.22, 0.42),
        );

        lampHeads.push(m);
      }
    }

    this.installInstance(
      "lampHeads",
      sphereGeo,
      this.basic({
        color: 0xffe8be,
      }),
      lampHeads,
    );

    if (this.quality.pointLights > 0) {
      const indices = [5, 19, 34, 49];

      for (const i of indices.slice(0, this.quality.pointLights)) {
        const p = this.samples[i % this.samples.length];

        const lightObj = new THREE.PointLight(0xffdca6, 3.5, 19, 2.2);

        lightObj.position.set(p.x, 7.8, p.z);

        lightObj.userData.worldOwned = true;

        this.group.add(lightObj);

        this.cityLights.push(lightObj);
      }
    }

    const utility = [];

    for (let i = 0; i < this.route.length; i += 3) {
      const p = this.route[i];

      const t = tangentAt(this.route, i);

      const side = new THREE.Vector3(-t.z, 0, t.x);

      const pos = p.clone().addScaledVector(side, i % 2 ? 16.8 : -16.8);

      matrix.compose(
        pos.clone().setY(0.7),
        q.identity(),
        new THREE.Vector3(0.8, 1.4, 0.55),
      );

      utility.push(matrix.clone());
    }

    this.installInstance("utilityBoxes", box, dark, utility);

    void light;
  }

  buildSelectedIntersections() {
    const env = this.map.environment;

    if (!env) return;

    const r = seeded(4102);

    for (const district of env.districts) {
      if (r() > district.sideStreetChance) {
        continue;
      }

      const indices = [district.from, district.to];

      for (const i of indices.slice(0, this.quality.pointLights)) {
        if (i >= this.route.length) {
          continue;
        }

        this.buildIntersection(this.route[i], this.segmentAngle(i));
      }
    }
  }

  buildIntersection(point, heading) {
    const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));

    const forward = new THREE.Vector3(
      -Math.sin(heading),
      0,
      -Math.cos(heading),
    );

    for (let row = -2; row <= 2; row++) {
      const center = point
        .clone()
        .addScaledVector(forward, row * 1.15)
        .addScaledVector(side, 9.85);

      mesh(
        this.group,
        box,
        this.lineMat,
        [center.x, 0.125, center.z],
        [7.2, 0.018, 0.25],
        [0, heading, 0],
      );
    }

    for (const sign of [-1, 1]) {
      const branchPos = point
        .clone()
        .addScaledVector(
          new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)),
          20 * sign,
        );

      const branchYaw = heading - (sign * Math.PI) / 2;

      const road = mesh(
        this.group,
        box,
        this.roadMat,
        [branchPos.x, 0.01, branchPos.z],
        [7.2, 0.035, 20],
        [0, branchYaw, 0],
      );

      road.receiveShadow = true;

      for (let j = -1; j <= 1; j += 2) {
        const stripePos = point
          .clone()
          .addScaledVector(
            new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)),
            sign * 13.7,
          )
          .addScaledVector(
            new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading)),
            j * 3.1,
          );

        mesh(
          this.group,
          box,
          this.lineMat,
          [stripePos.x, 0.12, stripePos.z],
          [0.22, 0.018, 4.8],
          [0, branchYaw, 0],
        );
      }
    }
  }

  buildMapSetPieces() {
    const plans = {
      neon: [
        ["bridge", 1, 2],
        ["flyover", 18, 19],
      ],
      coast: [
        ["bridge", 2, 5],
        ["flyover", 5, 6],
        ["underpass", 14, 15],
      ],
      dock: [
        ["flyover", 3, 5],
        ["underpass", 11, 12],
        ["bridge", 15, 16],
      ],
      mesa: [
        ["bridge", 3, 5],
        ["flyover", 7, 8],
        ["underpass", 13, 14],
      ],
    };

    const entries = plans[this.map.id] || [];

    for (const [type, ai, bi] of entries) {
      if (type === "flyover") this.buildFlyover(ai, bi);
      else if (type === "underpass") this.buildUnderpass(ai, bi);
      else this.buildBridgeRails(ai, bi);
    }
  }

  buildFlyover(from, to) {
    // The middle of a chord can be far outside a hairpin. Cross the actual lane.
    const stride = this.samples.length / this.controlRoute.length;
    const first = from * stride;
    const span = ((to - from + this.controlRoute.length) % this.controlRoute.length) * stride;
    const index = Math.round(first + span / 2) % this.samples.length;
    const mid = this.samples[index], tangent = tangentAt(this.samples, index);
    const yaw = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
    const asphalt = this.material({ color: 0x343d44, roughness: 0.9 });
    const concrete = this.material({ color: 0x687279, roughness: 0.85 });
    const paint = this.basic({ color: 0xf2d992 });
    // Local Z runs across the race course. Both approaches meet the ground.
    const section = (x, z1, h1, z2, h2, width, height, material) => {
      const pos = localPoint(mid, yaw, x, (h1 + h2) / 2, (z1 + z2) / 2);
      const slab = mesh(this.group, box, material, [pos.x, pos.y, pos.z],
        [width, height, Math.hypot(z2 - z1, h2 - h1) + 0.10]);
      slab.rotation.set(-Math.atan2(h2 - h1, z2 - z1), yaw, 0, "YXZ");
    };
    for (const [z1, h1, z2, h2] of [[-60, -0.3, -22, 7.6], [-22, 7.6, 22, 7.6], [22, 7.6, 60, -0.3]]) {
      section(0, z1, h1, z2, h2, 9.8, 0.7, asphalt);
      for (const side of [-1, 1]) section(side * 4.8, z1, h1 + 0.75, z2, h2 + 0.75, 0.3, 0.9, concrete);
      section(0, z1, h1 + 0.37, z2, h2 + 0.37, 0.12, 0.04, paint);
    }
    for (const offset of [-19, 19]) {
      const p = localPoint(mid, yaw, 0, 3.65, offset);
      mesh(this.group, box, concrete, [p.x, p.y, p.z], [6.8, 7.3, 1.3], [0, yaw, 0]);
    }
  }

  addCourseSlab(name, span, left, right, bottom, top, material) {
    const geometry = this.trackGeometry(spanGeometry(span, left, right, bottom, top));
    const piece = new THREE.Mesh(geometry, material);
    piece.name = name;
    piece.receiveShadow = true;
    this.group.add(piece);
  }

  buildUnderpass(from, to) {
    const section = courseSpan(this.samples, this.controlRoute.length, from, to);
    const length = section[section.length - 1].length;
    const half = Math.min(38, length * .35);
    const covered = trimSpan(section, length / 2 - half, length / 2 + half);
    if (covered.length < 2) return;

    const wall = this.material({color: 0x20262c, roughness: .76, metalness: .18});
    const lamps = this.basic({color: 0x94eaff});
    const edge = roadHalfWidth + 1.25;
    this.addCourseSlab("Underpass wall", covered, -edge - 1, -edge, 0, 10.8, wall);
    this.addCourseSlab("Underpass wall", covered, edge, edge + 1, 0, 10.8, wall);
    this.addCourseSlab("Underpass roof", covered, -edge - 1, edge + 1, 10.8, 11.5, wall);
    const start = covered[0].length, end = covered[covered.length - 1].length;
    const lights = Math.max(1, Math.round((end - start) / 11));
    for (let i = 0; i < lights; i++) {
      const at = start + (i + .5) * (end - start) / lights;
      const [station] = trimSpan(covered, at, at);
      const bulb = offsetStation(station, 0, 10.74);
      const yaw = Math.atan2(-station.normal.z, station.normal.x);
      mesh(this.group, box, lamps, bulb.toArray(), [6.8, .10, .32], [0, yaw, 0]);
    }
  }

  buildBridgeRails(from, to) {
    const section = courseSpan(this.samples, this.controlRoute.length, from, to);
    const mouths = (this.map.shortcuts ?? []).flatMap(({from, to}) => [this.controlRoute[from], this.controlRoute[to]]);
    const rail = this.material({color: 0x4f5a60, roughness: .42, metalness: .84});
    const accent = this.basic({color: 0x55dfff});
    for (const span of bridgeRuns(section, mouths)) {
      for (const sign of [-1, 1]) {
        const offset = sign * bridgeRailOffset;
        this.addCourseSlab("Bridge guardrail", span, offset - .12, offset + .12, .96, 1.16, rail);
        this.addCourseSlab("Bridge reflectors", span, offset - .07, offset + .07, 1.16, 1.21, accent);
        let nextSupport = 0;
        for (let i = 0; i < span.length; i++) {
          const station = span[i];
          if (station.length < nextSupport && i < span.length - 1) continue;
          const post = offsetStation(station, offset, .53);
          mesh(this.group, box, rail, post.toArray(), [.22, 1.06, .22]);
          nextSupport = station.length + 7.5;
        }
      }
    }
  }

  segmentAngle(i) {
    const a = this.route[i];

    const b = this.route[(i + 1) % this.route.length];

    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  buildNightCity() {
    const env = this.map.environment;

    if (!env) return;

    this.cityMats = {
      facade: [
        this.physical({
          color: 0x1a252e,
          roughness: 0.57,
          metalness: 0.38,
          clearcoat: 0.18,
        }),

        this.physical({
          color: 0x242d37,
          roughness: 0.62,
          metalness: 0.32,
          clearcoat: 0.14,
        }),

        this.physical({
          color: 0x302b37,
          roughness: 0.66,
          metalness: 0.28,
          clearcoat: 0.1,
        }),

        this.physical({
          color: 0x1a3336,
          roughness: 0.58,
          metalness: 0.35,
          clearcoat: 0.16,
        }),
      ],

      glass: this.physical({
        color: 0x0d2838,
        roughness: 0.12,
        metalness: 0.5,
        transmission: 0.02,
        clearcoat: 0.72,
      }),

      darkGlass: this.physical({
        color: 0x0b1e2a,
        roughness: 0.14,
        metalness: 0.48,
        clearcoat: 0.7,
      }),

      roof: this.material({
        color: 0x474d53,
        roughness: 0.7,
        metalness: 0.38,
      }),

      concrete: this.material({
        color: 0x3c4245,
        roughness: 0.86,
        metalness: 0.08,
      }),

      trim: this.material({
        color: 0x556169,
        roughness: 0.52,
        metalness: 0.68,
      }),

      storefront: this.physical({
        color: 0x102b3a,
        roughness: 0.18,
        metalness: 0.52,
        clearcoat: 0.62,
      }),

      roadDark: this.material({
        color: 0x171d21,
        roughness: 0.88,
        metalness: 0.08,
      }),

      plant: this.material({
        color: 0x16271e,
        roughness: 0.97,
        metalness: 0,
      }),

      warm: this.basic({
        color: 0xffc879,
      }),

      cold: this.basic({
        color: 0x9bdcff,
      }),

      neon: this.basic({
        color: 0x54dcff,
      }),

      warning: this.basic({
        color: 0xffc857,
      }),
    };

    this.windowGeo = new THREE.BoxGeometry(1, 1, 0.07);

    this.trackGeometry(this.windowGeo);

    this.windowMatrices = {
      warm: [],
      cold: [],
    };

    this.windowCount = 0;

    this.prepareLandmarkAnchors();

    this.generateCityBuildings();

    this.buildLandmarks();

    this.buildCityStreetScenes();

    this.buildCityPark();

    this.addSkylineLayers();

    this.flushCityInstances();
  }

  prepareLandmarkAnchors() {
    this.landmarkAnchors = [];

    const landmarks = this.map.environment?.landmarks || [];

    const limit = Math.min(this.quality.landmarkCap, landmarks.length);

    for (let index = 0; index < limit; index++) {
      const landmark = landmarks[index];

      const point = this.pointOnSegment(
        landmark.segment,
        landmark.distance,
        0.52,
        landmark.side,
      );

      this.landmarkAnchors.push({
        ...landmark,
        point,
      });
    }
  }

  pointOnSegment(segment, distance, fraction = 0.5, sideSign = 1) {
    const i = this.authorSegmentToRouteIndex(segment);

    const a = this.route[i];

    const b = this.route[(i + 1) % this.route.length];

    const p = a.clone().lerp(b, fraction);

    const t = b.clone().sub(a).normalize();

    const side = new THREE.Vector3(-t.z, 0, t.x);

    return p.addScaledVector(side, distance * sideSign);
  }

  authorSegmentToRouteIndex(segment) {
    const authorCount = this.controlRoute?.length || this.route.length;
    const normalized = ((segment % authorCount) + authorCount) % authorCount;

    return (
      Math.round((normalized / authorCount) * this.route.length) %
      this.route.length
    );
  }

  routeSegmentToAuthorIndex(index) {
    const authorCount = this.controlRoute?.length || this.route.length;

    return Math.floor(
      ((((index % this.route.length) + this.route.length) % this.route.length) /
        this.route.length) *
        authorCount,
    );
  }

  getDistrictForSegment(index) {
    const authorIndex = this.routeSegmentToAuthorIndex(index);

    return (
      this.map.environment?.districts.find(
        (d) => authorIndex >= d.from && authorIndex <= d.to,
      ) || this.map.environment?.districts[0]
    );
  }

  chooseBuildingFamily(district, r) {
    const families = district?.families || ["mixedUse", "commercial"];

    return families[Math.floor(r() * families.length)];
  }

  buildingPlacementAllowed(position, width, depth) {
    const roadClearance = this.distanceToRoad(position);
    const footprint = Math.max(width, depth);

    if (roadClearance < 32 + footprint * 0.48) {
      return false;
    }

    const park = this.map.environment?.park;

    if (
      park &&
      Math.hypot(position.x - park.x, position.z - park.z) <
        park.radius + Math.max(width, depth) * 0.5 + 4
    ) {
      return false;
    }

    for (const landmark of this.landmarkAnchors) {
      if (
        position.distanceTo(landmark.point) <
        19 + Math.max(width, depth) * 0.55
      ) {
        return false;
      }
    }

    for (const other of this.cityBuildings) {
      const clearance = 2.2 + Math.max(width, depth, other.w, other.d) * 0.38;

      if (
        position.distanceTo(other.center) <
        clearance + Math.max(width, depth, other.w, other.d) * 0.28
      ) {
        return false;
      }
    }

    return true;
  }

  addBuildingPart(key, material, position, scale, yaw = 0, geometry = box) {
    const batchKey = `${key}:${material.uuid}:${geometry.uuid}`;

    let batch = this.instancedBatches.get(batchKey);

    if (!batch) {
      batch = {
        key: batchKey,
        geometry,
        material,
        matrices: [],
      };

      this.instancedBatches.set(batchKey, batch);
    }

    const matrix = new THREE.Matrix4();

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

    matrix.compose(
      new THREE.Vector3(position.x, position.y, position.z),
      q,
      new THREE.Vector3(...scale),
    );

    batch.matrices.push(matrix);
  }

  queueWindow(kind, center, yaw, width, height) {
    if (this.windowCount >= this.quality.windowCap) {
      return;
    }

    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));

    const matrix = new THREE.Matrix4();

    matrix.compose(center, q, new THREE.Vector3(width, height, 1));

    this.windowMatrices[kind].push(matrix);

    this.windowCount++;
  }

  buildWindowRows(record, style) {
    const { center, yaw, w, d, h, seed } = record;

    const r = seeded(seed);

    const floorStart = 3.0;

    const floorStep =
      style === "commercial" || style === "lowRiseStorefront"
        ? 3.4
        : style === "residential"
          ? 4.0
          : style === "warehouse"
            ? 5.2
            : 4.4;

    const maxFloors = Math.max(1, Math.floor((h - 2) / floorStep));

    const floorStride = this.lowPower && h > 55 ? 1.35 : 1;

    for (let floor = 0; floor < maxFloors; floor += floorStride) {
      const y = floorStart + floor * floorStep;

      let widthFactor = 1;
      let depthFactor = 1;

      if (style === "steppedTower") {
        if (y > h * 0.75) {
          widthFactor = 0.54;
          depthFactor = 0.6;
        } else if (y > h * 0.5) {
          widthFactor = 0.78;
          depthFactor = 0.82;
        }
      } else if (style === "hotel") {
        widthFactor = 0.82;
        depthFactor = 0.78;
      } else if (style === "mixedUse" && y > 14) {
        widthFactor = 0.78;
        depthFactor = 0.74;
      } else if (style === "officeSlab") {
        widthFactor = 1.0;
        depthFactor = 0.78;
      } else if (style === "warehouse") {
        widthFactor = 0.7;
        depthFactor = 0.7;
      }

      const activeW = w * widthFactor;

      const activeD = d * depthFactor;

      const left = -activeW * 0.4;

      const step =
        style === "commercial" || style === "lowRiseStorefront"
          ? 2.8
          : style === "warehouse"
            ? 4.2
            : 3.35;

      let col = 0;

      for (let x = left; x <= activeW * 0.4; x += step) {
        if (r() < (style === "residential" ? 0.11 : 0.17)) {
          col++;
          continue;
        }

        const lit =
          style === "warehouse"
            ? r() > 0.68
            : r() > (style === "hotel" ? 0.18 : 0.28);

        const front = localPoint(center, yaw, x, y, -activeD / 2 - 0.065);

        this.queueWindow(
          lit ? "warm" : "cold",
          front,
          yaw,
          style === "commercial" || style === "lowRiseStorefront" ? 1.15 : 1.3,
          style === "commercial" || style === "lowRiseStorefront" ? 1.22 : 1.55,
        );

        col++;
      }

      if (!this.lowPower || floor % 2 === 0) {
        for (let z = -activeD * 0.34; z <= activeD * 0.34; z += 3.5) {
          if (r() < 0.18) {
            continue;
          }

          const side = r() > 0.5 ? 1 : -1;

          const sidePos = localPoint(
            center,
            yaw,
            side * (activeW / 2 + 0.065),
            y,
            z,
          );

          this.queueWindow(
            r() > 0.52 ? "cold" : "warm",
            sidePos,
            yaw + Math.PI / 2,
            1.18,
            1.48,
          );
        }
      }
    }
  }

  generateCityBuildings() {
    const env = this.map.environment;

    const r = seeded(this.citySeed);

    let id = 0;

    for (
      let segment = 0;
      segment < this.route.length &&
      this.cityBuildings.length < this.quality.buildingCap;
      segment++
    ) {
      const district = this.getDistrictForSegment(segment);

      if (!district) {
        continue;
      }

      const anchorFractions = [0.24, 0.72];

      for (const sideSign of [-1, 1]) {
        for (const fraction of anchorFractions) {
          if (this.cityBuildings.length >= this.quality.buildingCap) {
            break;
          }

          if (r() > district.density) {
            continue;
          }

          const a = this.route[segment];

          const b = this.route[(segment + 1) % this.route.length];

          const p = a.clone().lerp(b, fraction);

          const t = b.clone().sub(a).normalize();

          const side = new THREE.Vector3(-t.z, 0, t.x);

          const depthOffset =
            40 + r() * (district.type === "downtown" ? 18 : 13);

          const center = p
            .addScaledVector(side, depthOffset * sideSign)
            .addScaledVector(t, (r() - 0.5) * 4.5);

          const yaw =
            Math.atan2(t.x, t.z) -
            sideSign * (Math.PI / 2) +
            (r() - 0.5) * 0.045;

          const family = this.chooseBuildingFamily(district, r);

          const [minH, maxH] = district.heights;

          let h = minH + r() * (maxH - minH);

          if (family === "commercial") {
            h = 13 + r() * 16;
          }

          if (family === "lowRiseStorefront") {
            h = 9 + r() * 11;
          }

          if (family === "parking") {
            h = 15 + r() * 19;
          }

          if (family === "warehouse") {
            h = 10 + r() * 12;
          }

          if (family === "officeSlab") {
            h = clamp(h, 26, 68);
          }

          if (family === "residential") {
            h = clamp(h, 22, maxH);
          }

          if (family === "glassTower" || family === "steppedTower") {
            h = Math.max(42, h);
          }

          const w =
            family === "commercial"
              ? 13 + r() * 8
              : family === "lowRiseStorefront"
                ? 18 + r() * 13
                : family === "warehouse"
                  ? 22 + r() * 16
                  : 16 + r() * 13;

          const d =
            family === "commercial"
              ? 10 + r() * 7
              : family === "warehouse"
                ? 17 + r() * 11
                : 13 + r() * 10;

          if (!this.buildingPlacementAllowed(center, w, d)) {
            continue;
          }

          const record = {
            id: id++,
            center,
            yaw,
            w,
            d,
            h,
            family,
            district: district.type,
            seed: Math.floor(r() * 1000000),
            frontage: r() < district.storefrontChance,
          };

          this.cityBuildings.push(record);

          this.buildBuilding(record);
        }
      }

      if (
        this.cityBuildings.length < this.quality.buildingCap &&
        district.density > 0.72 &&
        r() > 0.24
      ) {
        const a = this.route[segment];

        const b = this.route[(segment + 1) % this.route.length];

        const p = a.clone().lerp(b, 0.52);

        const t = b.clone().sub(a).normalize();

        const sideSign = r() > 0.5 ? 1 : -1;

        const side = new THREE.Vector3(-t.z, 0, t.x);

        const center = p.addScaledVector(side, (58 + r() * 24) * sideSign);

        const yaw =
          Math.atan2(t.x, t.z) - sideSign * (Math.PI / 2) + 0.12 * (r() - 0.5);

        const family = this.chooseBuildingFamily(district, r);

        let h = 22 + r() * (district.type === "downtown" ? 55 : 42);

        if (family === "lowRiseStorefront" || family === "warehouse") {
          h = 10 + r() * 14;
        } else if (family === "officeSlab") {
          h = 28 + r() * 34;
        }

        const w =
          family === "warehouse"
            ? 24 + r() * 18
            : family === "lowRiseStorefront"
              ? 20 + r() * 12
              : 14 + r() * 14;

        const d = family === "warehouse" ? 18 + r() * 12 : 12 + r() * 14;

        if (this.buildingPlacementAllowed(center, w, d)) {
          const record = {
            id: id++,
            center,
            yaw,
            w,
            d,
            h,
            family,
            district: district.type,
            seed: Math.floor(r() * 1000000),
            frontage: false,
          };

          this.cityBuildings.push(record);

          this.buildBuilding(record);
        }
      }
    }

    while (this.cityBuildings.length < Math.min(this.quality.buildingCap, 34)) {
      const segment = this.cityBuildings.length % this.route.length;

      const district = this.getDistrictForSegment(segment);

      const p = this.pointOnSegment(
        segment,
        61 + (this.cityBuildings.length % 3) * 7,
        0.5,
        this.cityBuildings.length % 2 ? 1 : -1,
      );

      const t = tangentAt(this.route, segment);

      const yaw =
        Math.atan2(t.x, t.z) -
        (this.cityBuildings.length % 2 ? 1 : -1) * (Math.PI / 2);

      const family =
        district?.families?.[
          this.cityBuildings.length % (district.families.length || 1)
        ] || "mixedUse";

      const record = {
        id: this.cityBuildings.length,
        center: p,
        yaw,
        w: 18,
        d: 14,
        h: 30,
        family,
        district: district?.type || "boulevard",
        seed: 3000 + this.cityBuildings.length,
        frontage: false,
      };

      if (!this.buildingPlacementAllowed(p, record.w, record.d)) {
        break;
      }

      this.cityBuildings.push(record);

      this.buildBuilding(record);
    }

    for (const record of this.cityBuildings) {
      if (record.frontage) {
        this.addFrontageModule(record);
      }
    }
  }

  buildBuilding(record) {
    const { family, center, yaw, w, d, h } = record;

    const facadeIndex =
      (record.id * 7 + family.length) % this.cityMats.facade.length;

    const facade = this.cityMats.facade[facadeIndex];

    switch (family) {
      case "glassTower":
        this.buildGlassTower(record, facade);
        break;

      case "steppedTower":
        this.buildSteppedTower(record, facade);
        break;

      case "residential":
        this.buildResidential(record, facade);
        break;

      case "commercial":
        this.buildCommercial(record, facade);
        break;

      case "lowRiseStorefront":
        this.buildLowRiseStorefront(record, facade);
        break;

      case "officeSlab":
        this.buildOfficeSlab(record, facade);
        break;

      case "warehouse":
        this.buildWarehouse(record, facade);
        break;

      case "parking":
        this.buildParkingGarage(record, facade);
        break;

      case "hotel":
        this.buildHotel(record, facade);
        break;

      default:
        this.buildMixedUse(record, facade);
        break;
    }

    if (
      family !== "commercial" &&
      family !== "parking" &&
      family !== "lowRiseStorefront" &&
      family !== "warehouse"
    ) {
      this.addBuildingPart(
        "roofCap",
        this.cityMats.roof,
        localPoint(center, yaw, 0, h + 0.35, 0),
        [w * 0.84, 0.7, d * 0.82],
        yaw,
      );
    }

    this.buildWindowRows(record, family);

    void w;
  }

  buildGlassTower(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "glassTowerBase",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    this.addBuildingPart(
      "glassBand",
      this.cityMats.glass,
      localPoint(center, yaw, 0, h * 0.52, -d / 2 - 0.05),
      [w * 0.82, h * 0.76, 0.08],
      yaw,
    );

    for (const x of [-w * 0.35, 0, w * 0.35]) {
      this.addBuildingPart(
        "glassFin",
        this.cityMats.trim,
        localPoint(center, yaw, x, h * 0.52, -d / 2 - 0.13),
        [0.24, h * 0.78, 0.18],
        yaw,
      );
    }

    this.addBuildingPart(
      "glassCrown",
      this.cityMats.darkGlass,
      localPoint(center, yaw, 0, h - 1.0, 0),
      [w * 0.62, 2, d * 0.58],
      yaw,
    );
  }

  buildSteppedTower(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "stepLower",
      facade,
      localPoint(center, yaw, 0, h * 0.28, 0),
      [w, h * 0.55, d],
      yaw,
    );

    this.addBuildingPart(
      "stepMiddle",
      this.cityMats.facade[(record.id + 1) % 4],
      localPoint(center, yaw, 0, h * 0.64, 0),
      [w * 0.78, h * 0.3, d * 0.82],
      yaw,
    );

    this.addBuildingPart(
      "stepTop",
      this.cityMats.darkGlass,
      localPoint(center, yaw, 0, h * 0.86, 0),
      [w * 0.54, h * 0.2, d * 0.6],
      yaw,
    );

    for (let i = -1; i <= 1; i++) {
      this.addBuildingPart(
        "stepLedge",
        this.cityMats.trim,
        localPoint(center, yaw, i * w * 0.33, h * 0.57, 0),
        [0.16, 0.32, d * 0.9],
        yaw,
      );
    }
  }

  buildResidential(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "residential",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    this.addBuildingPart(
      "residentialCore",
      this.cityMats.darkGlass,
      localPoint(center, yaw, 0, h * 0.53, -d / 2 - 0.035),
      [w * 0.3, h * 0.82, 0.07],
      yaw,
    );

    const balconyStep = this.lowPower ? 12 : 8;

    for (let y = 6; y < h - 5; y += balconyStep) {
      this.addBuildingPart(
        "balconyBand",
        this.cityMats.trim,
        localPoint(center, yaw, 0, y, -d / 2 - 0.25),
        [w * 0.73, 0.18, 1.0],
        yaw,
      );
    }
  }

  buildCommercial(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "commercialMass",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    this.addBuildingPart(
      "commercialGlass",
      this.cityMats.storefront,
      localPoint(center, yaw, 0, Math.min(3.8, h * 0.32), -d / 2 - 0.055),
      [w * 0.88, Math.min(6.0, h * 0.42), 0.08],
      yaw,
    );

    this.addBuildingPart(
      "commercialCanopy",
      this.cityMats.trim,
      localPoint(center, yaw, 0, 3.4, -d / 2 - 0.8),
      [w * 0.82, 0.18, 1.4],
      yaw,
    );
  }

  buildLowRiseStorefront(record, facade) {
    const { center, yaw, w, d, h } = record;

    const floorH = Math.min(5.2, h * 0.46);

    this.addBuildingPart(
      "lowRiseBase",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    this.addBuildingPart(
      "lowRiseStoreGlass",
      this.cityMats.storefront,
      localPoint(center, yaw, 0, floorH * 0.5, -d / 2 - 0.065),
      [w * 0.88, floorH, 0.09],
      yaw,
    );

    for (const x of [-0.32, 0, 0.32]) {
      this.addBuildingPart(
        "lowRisePilaster",
        this.cityMats.trim,
        localPoint(center, yaw, w * x, floorH * 0.52, -d / 2 - 0.16),
        [0.18, floorH * 1.06, 0.22],
        yaw,
      );
    }

    this.addBuildingPart(
      "lowRiseCanopy",
      this.cityMats.neon,
      localPoint(center, yaw, 0, floorH + 0.3, -d / 2 - 0.8),
      [w * 0.72, 0.14, 1.25],
      yaw,
    );

    this.addBuildingPart(
      "lowRiseRoofCap",
      this.cityMats.concrete,
      localPoint(center, yaw, 0, h + 0.28, 0),
      [w * 1.03, 0.56, d * 1.04],
      yaw,
    );
  }

  buildOfficeSlab(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "officeSlabCore",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w * 1.12, h, d * 0.82],
      yaw,
    );

    this.addBuildingPart(
      "officeSlabGlass",
      this.cityMats.darkGlass,
      localPoint(center, yaw, 0, h * 0.5, -d * 0.42 - 0.08),
      [w * 0.92, h * 0.8, 0.08],
      yaw,
    );

    for (const x of [-0.43, -0.18, 0.18, 0.43]) {
      this.addBuildingPart(
        "officeVerticalFin",
        this.cityMats.trim,
        localPoint(center, yaw, w * x, h * 0.5, -d * 0.43 - 0.14),
        [0.16, h * 0.88, 0.18],
        yaw,
      );
    }

    this.addBuildingPart(
      "officeMechanicalRoof",
      this.cityMats.roof,
      localPoint(center, yaw, w * 0.18, h + 1.2, 0),
      [w * 0.38, 2.4, d * 0.38],
      yaw,
    );
  }

  buildWarehouse(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "warehouseMass",
      this.cityMats.concrete,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    this.addBuildingPart(
      "warehouseLoadingDoor",
      this.cityMats.darkGlass,
      localPoint(center, yaw, -w * 0.22, 2.3, -d / 2 - 0.08),
      [w * 0.22, 4.2, 0.12],
      yaw,
    );

    this.addBuildingPart(
      "warehouseServiceDoor",
      this.cityMats.storefront,
      localPoint(center, yaw, w * 0.22, 1.7, -d / 2 - 0.09),
      [w * 0.12, 3.0, 0.12],
      yaw,
    );

    for (const x of [-0.38, -0.12, 0.14, 0.38]) {
      this.addBuildingPart(
        "warehouseRib",
        this.cityMats.trim,
        localPoint(center, yaw, w * x, h * 0.5, -d / 2 - 0.12),
        [0.14, h * 0.92, 0.16],
        yaw,
      );
    }

    this.addBuildingPart(
      "warehouseRoofSaw",
      this.cityMats.roof,
      localPoint(center, yaw, 0, h + 0.55, 0),
      [w * 0.8, 1.1, d * 0.7],
      yaw + 0.08,
    );
  }

  buildParkingGarage(record, facade) {
    const { center, yaw, w, d, h } = record;

    this.addBuildingPart(
      "parkingCore",
      facade,
      localPoint(center, yaw, 0, h / 2, 0),
      [w, h, d],
      yaw,
    );

    for (let y = 4; y < h; y += 4.4) {
      this.addBuildingPart(
        "parkingSlab",
        this.cityMats.trim,
        localPoint(center, yaw, 0, y, -d / 2 - 0.06),
        [w * 0.88, 0.18, 0.22],
        yaw,
      );
    }

    this.addBuildingPart(
      "parkingGlassCore",
      this.cityMats.darkGlass,
      localPoint(center, yaw, w * 0.26, h * 0.52, -d / 2 - 0.1),
      [w * 0.18, h * 0.78, 0.14],
      yaw,
    );
  }

  buildHotel(record, facade) {
    const { center, yaw, w, d, h } = record;

    const podiumH = Math.min(9, h * 0.22);

    this.addBuildingPart(
      "hotelPodium",
      this.cityMats.facade[(record.id + 2) % 4],
      localPoint(center, yaw, 0, podiumH / 2, 0),
      [w * 1.08, podiumH, d * 1.08],
      yaw,
    );

    this.addBuildingPart(
      "hotelTower",
      facade,
      localPoint(center, yaw, 0, podiumH + (h - podiumH) / 2, 0),
      [w * 0.82, h - podiumH, d * 0.78],
      yaw,
    );

    this.addBuildingPart(
      "hotelEntrance",
      this.cityMats.storefront,
      localPoint(center, yaw, 0, 2.4, -d * 0.56),
      [w * 0.38, 3.6, 0.12],
      yaw,
    );

    this.addBuildingPart(
      "hotelCrown",
      this.cityMats.darkGlass,
      localPoint(center, yaw, 0, h - 2.0, -d * 0.1),
      [w * 0.54, 3.2, d * 0.45],
      yaw,
    );
  }

  buildMixedUse(record, facade) {
    const { center, yaw, w, d, h } = record;

    const podiumH = clamp(8 + h * 0.12, 8, 14);

    this.addBuildingPart(
      "mixedPodium",
      this.cityMats.facade[(record.id + 3) % 4],
      localPoint(center, yaw, 0, podiumH / 2, 0),
      [w * 1.12, podiumH, d * 1.08],
      yaw,
    );

    this.addBuildingPart(
      "mixedTower",
      facade,
      localPoint(center, yaw, 0, podiumH + (h - podiumH) / 2, d * 0.06),
      [w * 0.78, h - podiumH, d * 0.74],
      yaw,
    );

    this.addBuildingPart(
      "mixedStorefront",
      this.cityMats.storefront,
      localPoint(center, yaw, 0, 2.7, -d * 0.56),
      [w * 0.76, 4.0, 0.1],
      yaw,
    );

    this.addBuildingPart(
      "mixedCrown",
      this.cityMats.trim,
      localPoint(center, yaw, 0, h - 1.3, 0),
      [w * 0.55, 1.3, d * 0.5],
      yaw,
    );
  }

  addFrontageModule(record) {
    const { center, yaw, w, d } = record;

    const r = seeded(record.seed + 33);

    const front = -d / 2 - 0.7;

    const signMat = r() > 0.5 ? this.cityMats.neon : this.cityMats.warm;

    const entryW = clamp(w * 0.18, 2.2, 3.2);

    this.addBuildingPart(
      "shopEntry",
      this.cityMats.storefront,
      localPoint(center, yaw, (r() - 0.5) * w * 0.38, 1.35, front),
      [entryW, 2.4, 0.08],
      yaw,
    );

    this.addBuildingPart(
      "shopCanopy",
      signMat,
      localPoint(center, yaw, 0, 3.3, front - 0.22),
      [w * 0.55, 0.13, 0.8],
      yaw,
    );

    this.addBuildingPart(
      "shopUtility",
      this.cityMats.roof,
      localPoint(center, yaw, w * 0.34, 0.58, front + 0.25),
      [0.65, 1.1, 0.5],
      yaw,
    );

    if (r() > 0.35) {
      this.addBuildingPart(
        "shopPlanter",
        this.cityMats.plant,
        localPoint(center, yaw, -w * 0.35, 0.28, front + 0.1),
        [1.2, 0.55, 0.62],
        yaw,
      );
    }
  }

  flushCityInstances() {
    for (const batch of this.instancedBatches.values())
      this.installInstance(
        batch.key,
        batch.geometry,
        batch.material,
        batch.matrices,
      );
    this.installInstance(
      "cold-windows",
      this.windowGeo,
      this.cityMats.cold,
      this.windowMatrices.cold,
    );
    this.installInstance(
      "warm-windows",
      this.windowGeo,
      this.cityMats.warm,
      this.windowMatrices.warm,
    );
  }

  installInstance(key, geometry, material, matrices) {
    if (!matrices.length) return null;
    const cells = new Map();
    for (const matrix of matrices) {
      const e = matrix.elements;
      const cell = `${Math.floor(e[12] / 140)}:${Math.floor(e[14] / 140)}`;
      if (!cells.has(cell)) cells.set(cell, []);
      cells.get(cell).push(matrix);
    }
    let first = null;
    for (const [cell, transforms] of cells) {
      const object = new THREE.InstancedMesh(
        geometry,
        material,
        transforms.length,
      );
      transforms.forEach((matrix, i) => object.setMatrixAt(i, matrix));
      object.instanceMatrix.needsUpdate = true;
      object.computeBoundingSphere();
      object.castShadow = false;
      object.receiveShadow = false;
      object.userData.worldOwned = true;
      object.name = `instances:${key}:${cell}`;
      this.group.add(object);
      first ||= object;
    }
    return first;
  }

  buildLandmarks() {
    for (const landmark of this.landmarkAnchors) {
      switch (landmark.type) {
        case "spire":
          this.addMeridianSpire(landmark);
          break;

        case "arcTower":
          this.addArcTower(landmark);
          break;

        case "transitHub":
          this.addTransitHub(landmark);
          break;

        case "neonPlaza":
          this.addNeonPlaza(landmark);
          break;

        case "interchange":
          this.addLandmarkInterchange(landmark);
          break;

        case "hotel":
          this.addLandmarkHotel(landmark);
          break;

        case "billboardDistrict":
          this.addBillboardDistrict(landmark);
          break;

        default:
          break;
      }
    }
  }

  addMeridianSpire(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const dark = this.material({
      color: 0x18242c,
      roughness: 0.56,
      metalness: 0.68,
    });

    const glass = this.physical({
      color: 0x0c2a3b,
      roughness: 0.14,
      metalness: 0.54,
      clearcoat: 0.76,
    });

    const glow = this.basic({
      color: 0x54dcff,
    });

    mesh(
      this.group,
      lowCylinderGeo,
      dark,
      [p.x, 2.6 * s, p.z],
      [14 * s, 5.2 * s, 14 * s],
    );

    mesh(
      this.group,
      lowCylinderGeo,
      glass,
      [p.x, 41 * s, p.z],
      [7.2 * s, 76 * s, 7.2 * s],
    );

    mesh(
      this.group,
      coneGeo,
      dark,
      [p.x, 81 * s, p.z],
      [7.8 * s, 16 * s, 7.8 * s],
    );

    mesh(
      this.group,
      poleGeo,
      glow,
      [p.x, 99 * s, p.z],
      [0.16 * s, 20 * s, 0.16 * s],
    );

    const ring = mesh(
      this.group,
      new THREE.TorusGeometry(9.6 * s, 0.24 * s, 6, 36),
      glow,
      [p.x, 54 * s, p.z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );

    ring.userData.worldOwned = true;
  }

  addArcTower(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const facade = this.physical({
      color: 0x10293a,
      roughness: 0.16,
      metalness: 0.46,
      clearcoat: 0.8,
    });

    const trim = this.material({
      color: 0x53626b,
      roughness: 0.42,
      metalness: 0.84,
    });

    const glow = this.basic({
      color: 0x3edfff,
    });

    mesh(
      this.group,
      new THREE.CylinderGeometry(12 * s, 16 * s, 68 * s, 14),
      facade,
      [p.x, 34 * s, p.z],
    );

    mesh(
      this.group,
      poleGeo,
      trim,
      [p.x - 7 * s, 35 * s, p.z],
      [0.36 * s, 72 * s, 0.36 * s],
    );

    mesh(
      this.group,
      poleGeo,
      trim,
      [p.x + 7 * s, 35 * s, p.z],
      [0.36 * s, 72 * s, 0.36 * s],
    );

    const arch = mesh(
      this.group,
      new THREE.TorusGeometry(13 * s, 0.42 * s, 6, 42, Math.PI),
      glow,
      [p.x, 56 * s, p.z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );

    arch.userData.worldOwned = true;
  }

  addTransitHub(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const dark = this.material({
      color: 0x202a31,
      roughness: 0.48,
      metalness: 0.62,
    });

    const glass = this.physical({
      color: 0x0c2635,
      roughness: 0.16,
      metalness: 0.52,
      clearcoat: 0.74,
    });

    const glow = this.basic({
      color: 0x8cf1ff,
    });

    mesh(
      this.group,
      lowCylinderGeo,
      dark,
      [p.x, 3 * s, p.z],
      [15 * s, 6 * s, 15 * s],
    );

    mesh(
      this.group,
      new THREE.CylinderGeometry(13 * s, 13 * s, 5 * s, 20),
      glass,
      [p.x, 8 * s, p.z],
    );

    mesh(
      this.group,
      new THREE.TorusGeometry(14.5 * s, 0.28 * s, 6, 40),
      glow,
      [p.x, 11 * s, p.z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;

      mesh(
        this.group,
        poleGeo,
        dark,
        [p.x + Math.cos(a) * 11 * s, 5 * s, p.z + Math.sin(a) * 11 * s],
        [0.25 * s, 10 * s, 0.25 * s],
      );
    }
  }

  addNeonPlaza(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const floor = this.material({
      color: 0x121a20,
      roughness: 0.72,
      metalness: 0.32,
    });

    const glow = this.basic({
      color: 0xff3d93,
    });

    mesh(
      this.group,
      box,
      floor,
      [p.x, 0.18 * s, p.z],
      [34 * s, 0.36 * s, 28 * s],
    );

    mesh(
      this.group,
      lowCylinderGeo,
      glow,
      [p.x, 6 * s, p.z],
      [4.5 * s, 12 * s, 4.5 * s],
    );

    for (const side of [-1, 1]) {
      mesh(
        this.group,
        box,
        glow,
        [p.x + side * 13 * s, 7 * s, p.z],
        [0.4 * s, 14 * s, 7.5 * s],
      );
    }

    mesh(
      this.group,
      box,
      this.cityMats.neon,
      [p.x, 13.5 * s, p.z],
      [29 * s, 0.16 * s, 0.35 * s],
    );
  }

  addLandmarkInterchange(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const dark = this.material({
      color: 0x263039,
      roughness: 0.62,
      metalness: 0.66,
    });

    const glow = this.basic({
      color: 0x54dcff,
    });

    mesh(
      this.group,
      box,
      dark,
      [p.x, 8 * s, p.z],
      [48 * s, 0.65 * s, 8 * s],
      [0, landmark.side > 0 ? 0.2 : -0.2, 0],
    );

    for (let i = -2; i <= 2; i++) {
      mesh(
        this.group,
        box,
        dark,
        [p.x + i * 9 * s, 4 * s, p.z],
        [1.1 * s, 8 * s, 1.1 * s],
      );
    }

    mesh(
      this.group,
      box,
      glow,
      [p.x, 8.5 * s, p.z],
      [40 * s, 0.12 * s, 0.28 * s],
    );
  }

  addLandmarkHotel(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const facade = this.physical({
      color: 0x302b37,
      roughness: 0.48,
      metalness: 0.42,
      clearcoat: 0.22,
    });

    const glass = this.cityMats.darkGlass;

    const glow = this.basic({
      color: 0xffc879,
    });

    mesh(this.group, box, facade, [p.x, 19 * s, p.z], [28 * s, 38 * s, 22 * s]);

    mesh(this.group, box, glass, [p.x, 47 * s, p.z], [20 * s, 20 * s, 16 * s]);

    mesh(
      this.group,
      box,
      glow,
      [p.x, 58 * s, p.z],
      [14 * s, 0.16 * s, 0.3 * s],
    );

    mesh(
      this.group,
      poleGeo,
      glow,
      [p.x, 67 * s, p.z],
      [0.14 * s, 18 * s, 0.14 * s],
    );
  }

  addBillboardDistrict(landmark) {
    const s = landmark.scale || 1;

    const p = landmark.point;

    const pole = this.material({
      color: 0x303a42,
      roughness: 0.56,
      metalness: 0.72,
    });

    const signs = ["CITY LOOP", "NORTH DISTRICT", "MERIDIAN AVE"];

    for (let i = 0; i < 3; i++) {
      const x = p.x + (i - 1) * 8 * s;

      const y = (7 + i * 4) * s;

      mesh(
        this.group,
        poleGeo,
        pole,
        [x, y * 0.52, p.z],
        [0.22 * s, y, 0.22 * s],
      );

      this.addTextBillboard(
        signs[i],
        new THREE.Vector3(x, y, p.z - 0.35 * s),
        0.92 * s,
        i % 2 ? "#54dcff" : "#ff3d93",
      );
    }
  }

  addTextBillboard(text, position, scale = 1, tint = "#54dcff", yaw = 0) {
    const texture = makeCanvasTexture(
      (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = "#071018";

        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = tint;

        ctx.lineWidth = 5;

        ctx.strokeRect(3, 3, w - 6, h - 6);

        ctx.fillStyle = "#f4fbff";

        ctx.font = "bold 30px Arial";

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        ctx.fillText(text, w / 2, h / 2);
      },
      512,
      128,
    );

    const material = this.basic({
      map: texture,
      transparent: true,
    });

    const sign = mesh(
      this.group,
      new THREE.PlaneGeometry(3.8 * scale, 0.95 * scale),
      material,
      [position.x, position.y, position.z],
      [1, 1, 1],
      [0, yaw, 0],
    );

    sign.material.side = THREE.DoubleSide;

    sign.userData.worldOwned = true;
  }

  buildCityStreetScenes() {
    const env = this.map.environment;

    const metal = this.material({
      color: 0x4a535a,
      roughness: 0.5,
      metalness: 0.82,
    });

    const binMat = this.material({
      color: 0x242c30,
      roughness: 0.84,
      metalness: 0.22,
    });

    const carMats = [
      this.material({
        color: 0x263442,
        roughness: 0.56,
        metalness: 0.52,
      }),

      this.material({
        color: 0x5c2434,
        roughness: 0.58,
        metalness: 0.45,
      }),

      this.material({
        color: 0x4b5b61,
        roughness: 0.62,
        metalness: 0.42,
      }),
    ];

    for (let i = 0; i < this.cityBuildings.length; i++) {
      const record = this.cityBuildings[i];

      const district = this.getDistrictForSegment(
        record.id % this.route.length,
      );
      const propDensity = district?.propDensity ?? 0.7;

      if (this.distanceToRoad(record.center) > 62) {
        continue;
      }

      const r = seeded(record.seed + 900);

      const front = -record.d / 2 - 2.0;

      const localX = (r() - 0.5) * record.w * 0.52;

      if (r() < 0.35 * propDensity) {
        const p = localPoint(
          record.center,
          record.yaw,
          localX,
          0.7,
          front + r() * 1.2,
        );

        this.addBuildingPart(
          "dumpster",
          binMat,
          p,
          [1.05, 1.2, 0.7],
          record.yaw,
        );
      }

      if (r() < 0.43 * propDensity) {
        const p = localPoint(
          record.center,
          record.yaw,
          -record.w * 0.26,
          0.35,
          front + 0.3,
        );

        this.addBuildingPart(
          "bollardCluster",
          metal,
          p,
          [0.18, 0.7, 1.1],
          record.yaw,
        );
      }

      if (r() < 0.28 * propDensity && record.family !== "glassTower") {
        const p = localPoint(
          record.center,
          record.yaw,
          record.w * 0.3,
          0.6,
          front + 0.15,
        );

        this.addBuildingPart(
          "loadingBay",
          this.cityMats.darkGlass,
          p,
          [record.w * 0.12, 1.0, 0.08],
          record.yaw,
        );
      }

      if (r() < 0.34 * propDensity) {
        const p = localPoint(
          record.center,
          record.yaw,
          localX * 0.45,
          0.55,
          front + 2.4,
        );

        const mat =
          carMats[
            (record.id + Math.floor(r() * carMats.length)) % carMats.length
          ];

        this.addBuildingPart("parkedCar", mat, p, [2.8, 0.8, 1.35], record.yaw);

        this.addBuildingPart(
          "parkedCarCabin",
          this.cityMats.darkGlass,
          localPoint(p, record.yaw, 0, 0.55, 0),
          [1.35, 0.45, 0.95],
          record.yaw,
        );
      }
    }

    for (const scene of env.streetScenes || []) {
      this.addStreetScene(scene, metal, binMat, carMats);
    }

    for (const item of env.signage || []) {
      const p = this.pointOnSegment(
        item.segment,
        item.distance,
        0.5,
        item.side,
      );

      const yaw = this.segmentAngle(
        this.authorSegmentToRouteIndex(item.segment),
      );

      const pole = new THREE.Mesh(poleGeo, metal);

      pole.position.set(p.x, 1.8, p.z);

      pole.scale.set(0.12, 3.6, 0.12);

      pole.rotation.y = yaw;

      pole.userData.worldOwned = true;

      this.group.add(pole);

      this.addTextBillboard(
        item.text,
        new THREE.Vector3(p.x, 3.4, p.z),
        0.72,
        item.side < 0 ? "#54dcff" : "#ff4f8f",
        yaw,
      );
    }

    const service = this.pointOnSegment(8, 31, 0.45, -1);

    this.addBuildingPart(
      "serviceBay",
      binMat,
      service,
      [4.8, 1.8, 3.1],
      this.segmentAngle(this.authorSegmentToRouteIndex(8)),
    );
  }

  addStreetScene(scene, metal, dark, carMats) {
    const center = this.pointOnSegment(
      scene.segment,
      scene.distance,
      scene.fraction ?? 0.52,
      scene.side,
    );

    const yaw =
      this.segmentAngle(this.authorSegmentToRouteIndex(scene.segment)) -
      scene.side * (Math.PI / 2);

    const label = scene.label || "CITY LOOP";

    const tint = scene.side < 0 ? "#54dcff" : "#ff4f8f";

    const signAt = (x, y, z, scale = 0.5) => {
      this.addTextBillboard(
        label,
        localPoint(center, yaw, x, y, z),
        scale,
        tint,
        yaw,
      );
    };

    if (scene.type === "taxiDropoff") {
      this.addBuildingPart(
        "dropoffCanopy",
        this.cityMats.neon,
        localPoint(center, yaw, 0, 2.55, -0.7),
        [9.5, 0.16, 1.25],
        yaw,
      );

      this.addBuildingPart(
        "dropoffGlass",
        this.cityMats.storefront,
        localPoint(center, yaw, 0, 1.25, -0.1),
        [7.2, 2.3, 0.08],
        yaw,
      );

      for (const x of [-3.2, 3.2]) {
        this.addBuildingPart(
          "dropoffCar",
          carMats[x < 0 ? 0 : 1],
          localPoint(center, yaw, x, 0.45, 2.6),
          [2.6, 0.72, 1.25],
          yaw,
        );
      }

      signAt(0, 3.45, -1.42, 0.62);
      return;
    }

    if (scene.type === "construction") {
      for (let i = -2; i <= 2; i++) {
        this.addBuildingPart(
          "constructionBarrier",
          this.cityMats.warning,
          localPoint(center, yaw, i * 1.55, 0.55, 0.35),
          [1.1, 0.55, 0.22],
          yaw,
        );

        this.addBuildingPart(
          "constructionCone",
          this.cityMats.warning,
          localPoint(center, yaw, i * 1.6, 0.48, 1.35),
          [0.38, 0.95, 0.38],
          yaw,
          coneGeo,
        );
      }

      for (const x of [-3.3, 3.3]) {
        this.addBuildingPart(
          "scaffoldPole",
          metal,
          localPoint(center, yaw, x, 2.4, -1.1),
          [0.16, 4.8, 0.16],
          yaw,
          poleGeo,
        );
      }

      signAt(0, 3.15, -1.25, 0.52);
      return;
    }

    if (scene.type === "transitStop") {
      this.addBuildingPart(
        "busShelterRoof",
        metal,
        localPoint(center, yaw, 0, 2.75, -0.4),
        [7.6, 0.16, 2.2],
        yaw,
      );

      this.addBuildingPart(
        "busShelterGlass",
        this.cityMats.storefront,
        localPoint(center, yaw, 0, 1.45, -1.15),
        [7.2, 2.45, 0.08],
        yaw,
      );

      this.addBuildingPart(
        "busShelterBench",
        dark,
        localPoint(center, yaw, 0, 0.52, 0.05),
        [4.8, 0.36, 0.55],
        yaw,
      );

      signAt(0, 3.45, -1.6, 0.58);
      return;
    }

    if (scene.type === "delivery") {
      this.addBuildingPart(
        "deliveryTruck",
        carMats[2],
        localPoint(center, yaw, -1.8, 0.85, 1.2),
        [4.2, 1.6, 1.55],
        yaw,
      );

      this.addBuildingPart(
        "deliveryCab",
        this.cityMats.darkGlass,
        localPoint(center, yaw, 0.9, 1.05, 1.2),
        [1.25, 1.15, 1.35],
        yaw,
      );

      this.addBuildingPart(
        "deliveryBayDoor",
        this.cityMats.darkGlass,
        localPoint(center, yaw, 2.7, 1.8, -1.05),
        [3.4, 3.2, 0.12],
        yaw,
      );

      signAt(2.7, 3.85, -1.25, 0.5);
      return;
    }

    if (scene.type === "parkingEntry") {
      this.addBuildingPart(
        "parkingPortal",
        this.cityMats.concrete,
        localPoint(center, yaw, 0, 2.0, -0.95),
        [7.2, 4.0, 0.55],
        yaw,
      );

      this.addBuildingPart(
        "parkingVoid",
        this.cityMats.darkGlass,
        localPoint(center, yaw, 0, 1.65, -1.28),
        [4.8, 2.8, 0.12],
        yaw,
      );

      for (const x of [-2.6, 2.6]) {
        this.addBuildingPart(
          "parkingGate",
          this.cityMats.warning,
          localPoint(center, yaw, x, 0.9, 1.5),
          [2.2, 0.12, 0.16],
          yaw + 0.25 * Math.sign(x),
        );
      }

      signAt(0, 4.4, -1.55, 0.56);
      return;
    }

    if (scene.type === "maintenance") {
      for (let i = -3; i <= 3; i++) {
        this.addBuildingPart(
          "maintenanceFence",
          metal,
          localPoint(center, yaw, i * 1.15, 1.0, 0.2),
          [0.1, 2.0, 0.12],
          yaw,
          poleGeo,
        );
      }

      this.addBuildingPart(
        "maintenanceBox",
        dark,
        localPoint(center, yaw, -2.4, 0.85, -1.0),
        [1.4, 1.7, 0.82],
        yaw,
      );

      this.addBuildingPart(
        "maintenanceServiceDoor",
        this.cityMats.darkGlass,
        localPoint(center, yaw, 2.1, 1.55, -1.15),
        [1.7, 2.8, 0.12],
        yaw,
      );

      signAt(0, 3.2, -1.35, 0.46);
    }
  }

  buildCityPark() {
    const park = this.map.environment?.park;

    if (!park) return;

    const grass = this.material({
      color: 0x11261d,
      roughness: 0.98,
      metalness: 0,
    });

    const path = this.material({
      color: 0x505252,
      roughness: 0.92,
      metalness: 0.02,
    });

    const water = this.physical({
      color: 0x173b47,
      roughness: 0.2,
      metalness: 0.35,
      clearcoat: 0.55,
    });

    mesh(
      this.group,
      new THREE.CircleGeometry(park.radius, 28),
      grass,
      [park.x, -0.16, park.z],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
    );

    mesh(
      this.group,
      new THREE.RingGeometry(park.radius * 0.38, park.radius * 0.43, 26),
      path,
      [park.x, -0.11, park.z],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
    );

    mesh(
      this.group,
      new THREE.CircleGeometry(5.6, 20),
      water,
      [park.x + 4, -0.04, park.z - 3],
      [1, 0.35, 1],
      [-Math.PI / 2, 0, 0],
    );

    const r = seeded(778);

    const treeMats = [
      this.material({
        color: 0x143021,
        roughness: 0.95,
      }),

      this.material({
        color: 0x1b392a,
        roughness: 0.94,
      }),

      this.material({
        color: 0x2a211d,
        roughness: 1,
      }),
    ];

    const crownMatricesA = [];
    const crownMatricesB = [];
    const trunkMatrices = [];

    const q = new THREE.Quaternion();

    const matrix = new THREE.Matrix4();

    const treeGeoA = new THREE.IcosahedronGeometry(1.5, 0);

    const trunkGeo = new THREE.CylinderGeometry(0.55, 0.7, 1, 7);

    this.trackGeometry(treeGeoA);

    this.trackGeometry(trunkGeo);

    for (let i = 0; i < (this.lowPower ? 10 : 15); i++) {
      const angle = r() * TAU;

      const radius = 6 + r() * (park.radius - 8);

      const x = park.x + Math.cos(angle) * radius;

      const z = park.z + Math.sin(angle) * radius;

      const scale = 0.85 + r() * 0.55;

      matrix.compose(
        new THREE.Vector3(x, 3.7 * scale, z),
        q.identity(),
        new THREE.Vector3(1.8 * scale, 2.3 * scale, 1.8 * scale),
      );

      (i % 2 ? crownMatricesA : crownMatricesB).push(matrix.clone());

      matrix.compose(
        new THREE.Vector3(x, 1.55 * scale, z),
        q.identity(),
        new THREE.Vector3(0.38 * scale, 3.1 * scale, 0.38 * scale),
      );

      trunkMatrices.push(matrix.clone());
    }

    this.installInstance("parkCrownsA", treeGeoA, treeMats[0], crownMatricesA);

    this.installInstance("parkCrownsB", treeGeoA, treeMats[1], crownMatricesB);

    this.installInstance("parkTrunks", trunkGeo, treeMats[2], trunkMatrices);

    const benchMat = this.material({
      color: 0x4b4c49,
      roughness: 0.78,
      metalness: 0.3,
    });

    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.3;

      const x = park.x + Math.cos(a) * 10;

      const z = park.z + Math.sin(a) * 10;

      mesh(
        this.group,
        box,
        benchMat,
        [x, 0.55, z],
        [2.4, 0.35, 0.55],
        [0, a + Math.PI / 2, 0],
      );
    }
  }

  addSkylineLayers() {
    const r = seeded(801);

    const farMat = this.material({
      color: 0x0b1722,
      roughness: 0.95,
      metalness: 0.04,
      emissive: 0x08131d,
      emissiveIntensity: 0.25,
    });

    for (let i = 0; i < this.quality.skylineCount; i++) {
      const angle = (i / this.quality.skylineCount) * TAU + r() * 0.08;

      const radius = 380 + r() * 155;

      const h = 34 + r() * 138;

      const w = 12 + r() * 26;

      this.addBuildingPart(
        "farSkyline",
        farMat,
        new THREE.Vector3(
          Math.cos(angle) * radius,
          h / 2,
          Math.sin(angle) * radius,
        ),
        [w, h, w * (0.7 + r() * 0.7)],
        0,
      );
    }
  }

  buildRegionalWorld() {
    const g = this.group;

    const m = this.map;

    const r = seeded(m.id.length * 81);

    const regionalMats = {
      sand: this.material({ color: 0xb99463, roughness: 0.98, metalness: 0 }),
      palm: this.material({ color: 0x22472d, roughness: 0.96, metalness: 0 }),
      trunk: this.material({
        color: 0x5b3f2a,
        roughness: 0.92,
        metalness: 0.02,
      }),
      glass: this.physical({
        color: 0x6fd2e3,
        roughness: 0.16,
        metalness: 0.34,
        clearcoat: 0.62,
      }),
      containerRed: this.material({
        color: 0x8b3136,
        roughness: 0.78,
        metalness: 0.18,
      }),
      containerBlue: this.material({
        color: 0x244d66,
        roughness: 0.78,
        metalness: 0.18,
      }),
      containerYellow: this.material({
        color: 0xb77737,
        roughness: 0.78,
        metalness: 0.18,
      }),
      crane: this.material({
        color: 0xd28536,
        roughness: 0.5,
        metalness: 0.54,
      }),
      mesaA: this.material({
        color: 0x7f4730,
        roughness: 0.98,
        metalness: 0.02,
      }),
      mesaB: this.material({
        color: 0xa65d39,
        roughness: 0.98,
        metalness: 0.02,
      }),
    };

    if (m.id === "coast") {
      mesh(
        g,
        new THREE.PlaneGeometry(1500, 700),
        this.material({
          color: 0x0b586d,
          roughness: 0.28,
          metalness: 0.48,
        }),
        [0, -0.24, 550],
        [1, 1, 1],
        [-Math.PI / 2, 0, 0],
      );

      mesh(
        g,
        new THREE.PlaneGeometry(1500, 110),
        regionalMats.sand,
        [0, -0.19, 220],
        [1, 1, 1],
        [-Math.PI / 2, 0, 0],
      );

      for (let i = 0; i < 22; i++) {
        const x = -500 + r() * 1000;

        const z = 100 + r() * 230;

        const h = 10 + r() * 28;

        mesh(
          g,
          this.trackGeometry(
            new THREE.CylinderGeometry(4 + r() * 4, 7 + r() * 5, h, 7),
          ),
          this.material({
            color: 0x4c626a,
            roughness: 0.9,
            metalness: 0.03,
          }),
          [x, h / 2, z],
        );
      }

      this.addCoastalSetPieces(regionalMats, r);
    }

    if (m.id === "dock") {
      this.addDockSetPieces(regionalMats, r);
    }

    if (m.id === "mesa") {
      for (let i = 0; i < 34; i++) {
        const angle = r() * TAU;

        const radius = 55 + r() * 170;

        const x = Math.cos(angle) * radius;

        const z = Math.sin(angle) * radius;

        const h = 7 + r() * 25;

        mesh(
          g,
          this.trackGeometry(new THREE.ConeGeometry(9 + r() * 12, h, 7)),
          this.material({
            color: i % 2 ? 0x75442c : 0x613827,
            roughness: 0.95,
            metalness: 0.02,
          }),
          [x, h / 2 - 0.25, z],
        );
      }

      this.addMesaSetPieces(regionalMats, r);
    }

    for (let i = 0; i < (this.lowPower ? 44 : 64); i++) {
      const angle = r() * TAU;

      const radius = 90 + r() * 390;

      const x = Math.cos(angle) * radius;

      const z = Math.sin(angle) * radius;

      if (this.distanceToRoad(new THREE.Vector3(x, 0, z)) < 19) {
        continue;
      }

      const w = 7 + r() * 18;

      const h = m.id === "dock" ? 5 + r() * 18 : 8 + r() * 32;

      const color =
        m.id === "dock"
          ? 0x47373a
          : m.id === "mesa"
            ? i % 2
              ? 0x8a5136
              : 0x69402d
            : 0x38545c;

      mesh(
        g,
        box,
        this.material({
          color,
          roughness: 0.86,
          metalness: 0.1,
        }),
        [x, h / 2, z],
        [w, h, w],
      );
    }
  }

  addCoastalSetPieces(mats, r) {
    const palmCount = this.lowPower ? 11 : 18;
    const trunkMatrices = [];
    const crownMatrices = [];
    const resortMatrices = [];
    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < palmCount; i++) {
      const x =
        -145 + (i / Math.max(1, palmCount - 1)) * 290 + (r() - 0.5) * 14;
      const z = 55 + r() * 28;

      if (this.distanceToRoad(new THREE.Vector3(x, 0, z)) < 21) continue;

      matrix.compose(
        new THREE.Vector3(x, 3.1, z),
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * TAU),
        new THREE.Vector3(0.24, 6.2, 0.24),
      );
      trunkMatrices.push(matrix.clone());

      for (let j = 0; j < 4; j++) {
        matrix.compose(
          new THREE.Vector3(
            x + Math.cos(j * Math.PI * 0.5) * 1.3,
            6.55,
            z + Math.sin(j * Math.PI * 0.5) * 1.3,
          ),
          q.setFromEuler(new THREE.Euler(0.55, j * Math.PI * 0.5, 0.18)),
          new THREE.Vector3(1.55, 0.42, 2.7),
        );
        crownMatrices.push(matrix.clone());
      }
    }

    for (let i = 0; i < (this.lowPower ? 7 : 12); i++) {
      const x = -190 + r() * 380;
      const z = 122 + r() * 68;
      const h = 10 + r() * 26;

      if (this.distanceToRoad(new THREE.Vector3(x, 0, z)) < 26) continue;

      matrix.compose(
        new THREE.Vector3(x, h / 2, z),
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 0.4),
        new THREE.Vector3(8 + r() * 10, h, 7 + r() * 8),
      );
      resortMatrices.push(matrix.clone());
    }

    this.installInstance("coastPalmTrunks", poleGeo, mats.trunk, trunkMatrices);
    this.installInstance("coastPalmCrowns", coneGeo, mats.palm, crownMatrices);
    this.installInstance("coastResortTowers", box, mats.glass, resortMatrices);
  }

  addDockSetPieces(mats, r) {
    const containerMats = [
      mats.containerRed,
      mats.containerBlue,
      mats.containerYellow,
    ];
    const containerMatrices = [[], [], []];
    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < (this.lowPower ? 36 : 58); i++) {
      const anchor = this.route[i % this.route.length];
      const yaw = this.segmentAngle(i % this.route.length);
      const side = i % 2 ? -1 : 1;
      const row = Math.floor(i / this.route.length);
      const pos = localPoint(
        anchor,
        yaw,
        side * (31 + row * 8 + r() * 7),
        1.35 + (i % 3) * 1.05,
        (r() - 0.5) * 18,
      );

      if (this.distanceToRoad(pos) < 24) continue;

      matrix.compose(
        pos,
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + (r() - 0.5) * 0.2),
        new THREE.Vector3(6.6, 2.7, 2.55),
      );
      containerMatrices[i % containerMatrices.length].push(matrix.clone());
    }

    containerMatrices.forEach((matrices, i) =>
      this.installInstance(
        `dockContainers${i}`,
        box,
        containerMats[i],
        matrices,
      ),
    );

    for (const index of [1, 5, 9]) {
      if (index >= this.route.length) continue;
      const yaw = this.segmentAngle(index);
      const base = localPoint(this.route[index], yaw, 38, 0, 0);
      mesh(
        this.group,
        box,
        mats.crane,
        [base.x, 10, base.z],
        [1.2, 20, 1.2],
        [0, yaw, 0],
      );
      mesh(
        this.group,
        box,
        mats.crane,
        [base.x, 20.6, base.z],
        [19, 0.9, 0.9],
        [0, yaw + 0.22, 0],
      );
      mesh(
        this.group,
        box,
        mats.crane,
        [base.x, 13.0, base.z],
        [13, 0.42, 0.42],
        [0.34, yaw + 0.22, 0],
      );
    }
  }

  addMesaSetPieces(mats, r) {
    const wallMatrices = [];
    const gateMatrices = [];
    const q = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();

    for (let i = 0; i < this.route.length; i += 2) {
      const yaw = this.segmentAngle(i);
      const h = 12 + r() * 22;

      for (const side of [-1, 1]) {
        const pos = localPoint(
          this.route[i],
          yaw,
          side * (28 + r() * 16),
          h / 2 - 0.2,
          (r() - 0.5) * 12,
        );
        matrix.compose(
          pos,
          q.setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            yaw + (r() - 0.5) * 0.4,
          ),
          new THREE.Vector3(8 + r() * 10, h, 5 + r() * 9),
        );
        wallMatrices.push(matrix.clone());
      }
    }

    for (const index of [2, 6, 10]) {
      if (index >= this.route.length) continue;
      const yaw = this.segmentAngle(index);
      for (const side of [-1, 1]) {
        matrix.compose(
          localPoint(this.route[index], yaw, side * 18.5, 7.0, 0),
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + side * 0.16),
          new THREE.Vector3(4.4, 14, 4.4),
        );
        gateMatrices.push(matrix.clone());
      }
    }

    this.installInstance("mesaCanyonWalls", box, mats.mesaA, wallMatrices);
    this.installInstance("mesaRockGates", coneGeo, mats.mesaB, gateMatrices);
  }

  buildCheckpoints() {
    const g = this.group;
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 96;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const beaconMaterial = new THREE.SpriteMaterial({map: texture, transparent: true, toneMapped: false});
    this.materials.push(beaconMaterial);
    this.textures.push(texture);
    this.gateBeacon = new THREE.Sprite(beaconMaterial);
    this.gateBeacon.scale.set(10.6, 2, 1);
    this.gateBeacon.renderOrder = 2;
    g.add(this.gateBeacon);
    const branchGlow = this.basic({ color: 0x66ffcc, transparent: true, opacity: 0.84 });
    this.branchGate = new THREE.Group();
    for (const side of [-1, 1]) {
      mesh(this.branchGate, box, branchGlow, [side * (shortcutHalfWidth - 0.3), 2.1, 0], [0.22, 4.2, 0.22]);
    }
    mesh(this.branchGate, box, branchGlow, [0, 4.2, 0], [shortcutHalfWidth * 2 - 0.4, 0.18, 0.18]);
    this.branchGate.visible = false;
    g.add(this.branchGate);
    const start = this.finishLine, yaw = this.segmentAngle(0);
    const tiles = [this.basic({color: 0xf8fafc}), this.basic({color: 0x11151b})];
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < 20; column++) {
        const tile = localPoint(start, yaw, column - 9.5, 0.21, row - 0.5);
        mesh(g, box, tiles[(row + column) % 2], [tile.x,tile.y,tile.z], [1, 0.035, 1], [0,yaw,0]);
      }
    }

    for (let i = 0; i < this.route.length; i++) {
      const point = this.gatePosition(i);

      const angle = this.segmentAngle(i);

      const marker = new THREE.Group();

      marker.position.copy(point);

      marker.rotation.y = angle;

      const postMat = this.basic({
        color: 0x5d8293,
        transparent: true,
        opacity: 0.52,
      });

      const glow = this.basic({
        color: this.map.accent,
        transparent: true,
        opacity: 0.18,
      });

      mesh(marker, box, postMat, [-10.2, 2.4, 0], [0.38, 4.8, 0.38]);

      mesh(marker, box, postMat, [10.2, 2.4, 0], [0.38, 4.8, 0.38]);

      mesh(marker, box, glow, [0, 4.75, 0], [20.7, 0.24, 0.24]);

      const arrow = mesh(
        marker,
        coneGeo,
        glow,
        [0, 2.85, -0.1],
        [0.48, 0.92, 0.48],
        [Math.PI / 2, 0, Math.PI],
      );

      marker.userData = {
        glow,
        postMat,
        arrow,
      };

      g.add(marker);

      this.markers.push(marker);
    }
  }

  buildRegionalDetails() {
    const id = this.map.id;
    if (id === "neon") return;
    const r = seeded(290 + id.length),
      dummy = new THREE.Object3D();
    const groups = new Map();
    const put = (
      key,
      geometry,
      material,
      position,
      scale,
      rotation = [0, 0, 0],
    ) => {
      if (!groups.has(key))
        groups.set(key, { geometry, material, matrices: [] });
      dummy.position.copy(position);
      dummy.scale.set(...scale);
      dummy.rotation.set(...rotation);
      dummy.updateMatrix();
      groups.get(key).matrices.push(dummy.matrix.clone());
    };
    const trunk = this.material({ color: 0x76553c, roughness: 0.98 });
    const leaves = this.material({
      color: 0x34644b,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const leaf = this.trackGeometry(new THREE.BufferGeometry());
    leaf.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 0, 0, 1.6, 0.32, 0.48, 3.7, -0.65, 0, 1.6, 0.32, -0.48],
        3,
      ),
    );
    leaf.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 0, 0.4, 1, 1, 0.5, 0.4, 0], 2),
    );
    leaf.setIndex([0, 1, 2, 0, 2, 3]);
    leaf.computeVertexNormals();
    const rock = this.trackGeometry(new THREE.CylinderGeometry(0.72, 1, 1, 7));
    const rockMat = this.material({ color: 0xa46d4f, roughness: 1 });
    const strata = this.material({ color: 0xcd9a6d, roughness: 1 });
    const cactus = this.material({ color: 0x486b50, roughness: 0.9 });
    const containerColors = [0x9a4f43, 0x436b7a, 0xb39b66];
    const corrugation = makeCanvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = "#b0b0b0";
        ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 8) {
          ctx.fillStyle = "#858585";
          ctx.fillRect(x, 0, 2, h);
          ctx.fillStyle = "#c8c8c8";
          ctx.fillRect(x + 2, 0, 1, h);
        }
        ctx.strokeStyle = "#303536";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, w - 4, h - 4);
      },
      128,
      64,
    );
    const containers = containerColors.map((color) =>
      this.material({
        color,
        map: corrugation,
        roughness: 0.83,
        metalness: 0.2,
      }),
    );
    for (let i = 0; i < this.samples.length; i += id === "coast" ? 7 : 18) {
      const p = this.samples[i],
        t = tangentAt(this.samples, i),
        side = new THREE.Vector3(-t.z, 0, t.x),
        yaw = Math.atan2(t.x, t.z);
      for (const sign of [-1, 1]) {
        const base = p
          .clone()
          .addScaledVector(
            side,
            sign * (id === "mesa" ? 24 + r() * 18 : 20 + r() * 7),
          );
        if (this.distanceToRoad(base) < 17) continue;
        if (id === "coast") {
          const height = 5.5 + r() * 2.8;
          put(
            "palm-trunks",
            lowCylinderGeo,
            trunk,
            base.clone().setY(height / 2),
            [0.2, height, 0.2],
            [0.035 * sign, yaw, 0.06 * sign],
          );
          for (let j = 0; j < 6; j++)
            put(
              "palm-fronds",
              leaf,
              leaves,
              base.clone().setY(height),
              [1, 1, 1],
              [0, (j / 6) * TAU + r() * 0.12, 0],
            );
        } else if (id === "dock") {
          const color = i % 3;
          put(
            "containers-" + color,
            box,
            containers[color],
            base.clone().setY(1.3),
            [5.8, 2.6, 2.5],
            [0, yaw, 0],
          );
          if (i % 36 === 0)
            put(
              "containers-upper-" + color,
              box,
              containers[color],
              base.clone().setY(3.9),
              [5.8, 2.6, 2.5],
              [0, yaw + 0.05, 0],
            );
        } else {
          const height = 6 + r() * 13,
            width = 4 + r() * 7;
          put(
            "mesa-rocks",
            rock,
            rockMat,
            base.clone().setY(height / 2 - 0.3),
            [width, height, width * 0.8],
            [0, yaw, 0],
          );
          put(
            "mesa-strata",
            rock,
            strata,
            base.clone().setY(height * 0.58),
            [width * 0.88, 0.3, width * 0.7],
            [0, yaw, 0],
          );
          const plant = base.clone().addScaledVector(t, 9);
          if (this.distanceToRoad(plant) > 17) {
            put(
              "cactus",
              lowCylinderGeo,
              cactus,
              plant.clone().setY(1.6),
              [0.22, 3.2, 0.22],
            );
            put(
              "cactus-arms",
              lowCylinderGeo,
              cactus,
              plant.clone().add(new THREE.Vector3(0.55, 1.6, 0)),
              [0.15, 1.1, 0.15],
              [0, 0, Math.PI / 2],
            );
            put(
              "cactus-tips",
              lowCylinderGeo,
              cactus,
              plant.clone().add(new THREE.Vector3(1, 2.05, 0)),
              [0.15, 1.1, 0.15],
            );
          }
        }
      }
    }
    for (const [key, { geometry, material, matrices }] of groups)
      this.installInstance(key, geometry, material, matrices);
  }

  buildStreetFrontage() {
    if (this.map.id !== "neon") return;
    const r = seeded(873);
    const facade = makeCanvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = "#18252e";
        ctx.fillRect(0, 0, w, h);
        for (let y = 8; y < h; y += 16)
          for (let x = 6; x < w; x += 16) {
            ctx.fillStyle =
              r() > 0.55 ? (r() > 0.5 ? "#b0c8be" : "#e0be7c") : "#213440";
            ctx.fillRect(x, y, 5, 7);
            ctx.fillStyle = "#0d171f";
            ctx.fillRect(x, y + 8, 9, 2);
          }
        ctx.fillStyle = "#0c1a24";
        for (let x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h);
      },
      128,
      256,
    );
    facade.anisotropy = 2;
    const walls = this.material({
      map: facade,
      color: 0x8fabb3,
      emissiveMap: facade,
      emissive: 0xb5a279,
      emissiveIntensity: 0.36,
      roughness: 0.83,
      metalness: 0.12,
      envMapIntensity: 0.22,
    });
    const trim = this.material({ color: 0x293d48, roughness: 0.8 });
    const matrices = [],
      roofs = [],
      awnings = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.samples.length; i += 9) {
      const p = this.samples[i],
        t = tangentAt(this.samples, i),
        side = new THREE.Vector3(-t.z, 0, t.x);
      const yaw = Math.atan2(t.x, t.z);
      for (const direction of [-1, 1]) {
        const width = 12 + r() * 10,
          depth = 14 + r() * 8,
          height = 12 + r() * 35;
        const center = p
          .clone()
          .addScaledVector(side, direction * (29 + depth * 0.5));
        if (this.distanceToRoad(center) < depth * 0.5 + 20) continue;
        // Keep the existing authored buildings and landmarks readable.
        if (
          this.cityBuildings.some(
            (b) => b.center.distanceTo(center) < (b.w + width) * 0.6 + 7,
          )
        )
          continue;
        dummy.position.set(center.x, height * 0.5, center.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(width, height, depth);
        dummy.updateMatrix();
        matrices.push(dummy.matrix.clone());
        dummy.position.y = height + 0.18;
        dummy.scale.set(width + 1, 0.35, depth + 1);
        dummy.updateMatrix();
        roofs.push(dummy.matrix.clone());
        const door = center
          .clone()
          .addScaledVector(side, -direction * (depth * 0.5 + 0.3));
        dummy.position.set(door.x, 3.7, door.z);
        dummy.scale.set(width * 0.8, 0.15, 1.8);
        dummy.updateMatrix();
        awnings.push(dummy.matrix.clone());
      }
    }
    this.installInstance("frontage-facades", box, walls, matrices);
    this.installInstance("frontage-roofs", box, trim, roofs);
    this.installInstance("frontage-awnings", box, trim, awnings);
  }

  buildAtmosphere() {
    // Broad textured pools imply street lighting without adding dynamic lights.
    const glow = makeCanvasTexture(
      (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(
          w / 2,
          h / 2,
          1,
          w / 2,
          h / 2,
          w / 2,
        );
        gradient.addColorStop(0, "rgba(188,224,255,.23)");
        gradient.addColorStop(0.3, "rgba(132,185,231,.10)");
        gradient.addColorStop(1, "rgba(90,160,220,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      },
      64,
      64,
    );
    const pool = this.basic({
      map: glow,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: this.map.id === "neon" ? 0.65 : 0.22,
    });
    const geometry = this.trackGeometry(new THREE.PlaneGeometry(1, 1));
    const matrices = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.samples.length; i += 18) {
      const p = this.samples[i],
        t = tangentAt(this.samples, i);
      dummy.position.set(p.x, 0.058, p.z);
      dummy.rotation.set(-Math.PI / 2, 0, -Math.atan2(t.x, t.z));
      dummy.scale.set(17, 28, 1);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
    }
    this.installInstance("baked-street-light", geometry, pool, matrices);
    // Distant terrain silhouettes give each region a horizon and a sense of scale.
    if (this.map.id !== "neon") {
      const r = seeded(144 + this.map.id.length);
      const material = this.material({
        color:
          this.map.id === "mesa"
            ? 0x995a45
            : this.map.id === "coast"
              ? 0x526b75
              : 0x565360,
        roughness: 1,
      });
      const mountain = this.trackGeometry(new THREE.ConeGeometry(1, 1, 9));
      const shapes = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU;
        dummy.position.set(
          Math.cos(a) * (this.boundaryRadius + 140),
          -12 + r() * 15,
          Math.sin(a) * (this.boundaryRadius + 140),
        );
        dummy.rotation.set(0, r() * TAU, 0);
        dummy.scale.set(60 + r() * 65, 35 + r() * 60, 50 + r() * 55);
        dummy.updateMatrix();
        shapes.push(dummy.matrix.clone());
      }
      this.installInstance("regional-horizon", mountain, material, shapes);
    }
  }

  buildTraffic() {
    const count = this.map.id === "neon" ? (this.lowPower ? 6 : 9) : 6;

    for (let i = 0; i < count; i++) {
      const spec = {
        kind: "car",

        profile:
          i % 4 === 0
            ? "super"
            : i % 4 === 1
              ? "coupe"
              : i % 4 === 2
                ? "muscle"
                : "rally",
      };

      const color = ["#2d465c", "#6e293e", "#4b5d66", "#1c6872", "#70502b"][
        i % 5
      ];

      const traffic = createVehicle(spec, color);

      traffic.scale.setScalar(0.72);

      const routeIndex = Math.floor((i + 1) * this.samples.length / (count + 1));

      traffic.position.copy(this.samples[routeIndex]);

      const tangent = tangentAt(this.samples, routeIndex);

      const side = new THREE.Vector3(-tangent.z, 0, tangent.x);

      traffic.position.addScaledVector(side, i % 2 ? 3.2 : -3.2);

      alignVehicleToSurface(
        traffic,
        this.roadSurfaceY,
      );

      traffic.rotation.y = Math.atan2(-tangent.x, -tangent.z);

      traffic.userData.disposeWithWorld = true;

      traffic.traverse((object) => {
        object.userData.disposeWithWorld = true;

        object.castShadow = false;
      });

      this.group.add(traffic);

      this.traffic.push({
        mesh: traffic,
        index: routeIndex,
        progress: 0,
        speed: 7.5 + (i % 4) * 1.8,
        lane: i % 2 ? 3.2 : -3.2,
      });
    }
  }

  gatePosition(index) {
    return index === 0 ? this.finishLine : this.route[index];
  }

  lapFraction(actor) {
    const position = actor.mesh.position;
    const stride = this.samples.length / this.route.length;
    if (actor.cut) {
      const { road, gate } = actor.cut;
      const from = this.sampleDistances[this.authorSegmentToRouteIndex(road.from) * stride];
      const to = this.sampleDistances[this.authorSegmentToRouteIndex(road.to) * stride];
      const previous = road.points[gate - 1], target = road.points[gate];
      const dx = target.x - previous.x, dz = target.z - previous.z;
      const along = clamp(((position.x - previous.x)*dx + (position.z - previous.z)*dz) / (dx*dx + dz*dz || 1), 0, 1);
      const fraction = (gate - 1 + along) / (road.points.length - 1);
      return (from + (to - from) * fraction - this.timingOffset) / this.courseLength;
    }
    const { distance } = this.mainLocation(actor);
    return clamp((distance - this.timingOffset) / this.courseLength, 0, 1);
  }

  mainLocation(actor) {
    const position = actor.mesh.position;
    const samples = this.samples, count = samples.length, stride = count / this.route.length;
    const end = (actor.next || this.route.length) * stride;
    const last = actor.next === 0 ? end + this.finishSamples : end;
    let closest = Infinity, distance = 0, sample = 0;
    for (let i = end - stride; i < last; i++) {
      const index = i % count, a = samples[index], b = samples[(index + 1) % count];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = clamp(((position.x - a.x) * dx + (position.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      const squared = (position.x - a.x - t * dx) ** 2 + (position.z - a.z - t * dz) ** 2;
      if (squared < closest) {
        closest = squared;
        sample = i;
        distance = (i >= count ? this.courseLength : 0) + this.sampleDistances[index]
          + t * (this.sampleDistances[index + 1] - this.sampleDistances[index]);
      }
    }
    return { distance, sample };
  }

  markSectors(gates) {
    const paint = this.basic({color: 0x8cf5d8});
    for (const gate of gates) {
      if (this.timingLines.has(gate)) continue;
      const i = gate * this.samples.length / this.route.length;
      const before = this.samples[(i - 1 + this.samples.length) % this.samples.length];
      const after = this.samples[(i + 1) % this.samples.length];
      const forward = after.clone().sub(before).normalize();
      const point = this.gatePosition(gate);
      this.timingLines.set(gate, {point, forward});
      const yaw = Math.atan2(forward.x, forward.z);
      for (const offset of [-.4, .4]) {
        const at = localPoint(point, yaw, 0, .20, offset);
        mesh(this.group, box, paint, [at.x, at.y, at.z], [roadHalfWidth * 2, .025, .24], [0, yaw, 0]);
      }
    }
  }

  finishFraction(fromX, fromZ, to) {
    return this.timingFraction(0, fromX, fromZ, to);
  }

  timingFraction(gate, fromX, fromZ, to) {
    const {point: line, forward} = this.timingLines.get(gate);
    const before = (fromX - line.x) * forward.x + (fromZ - line.z) * forward.z;
    const after = (to.x - line.x) * forward.x + (to.z - line.z) * forward.z;
    if (!(before < 0 && after >= 0)) return null;
    const fraction = -before / (after - before);
    const x = fromX + (to.x - fromX) * fraction - line.x;
    const z = fromZ + (to.z - fromZ) * fraction - line.z;
    return Math.abs(x * forward.z - z * forward.x) <= roadHalfWidth + shoulderAllowance ? fraction : null;
  }

  setNextMarker(index, label = index ? "GATE " + index : "LAP LINE", road = null, gate = 0) {
    if (road) gate = shortcutMarkerIndex(road, gate);
    if (this.activeMarker === index && this.gateLabel === label && this.markedRoad === road && this.branchIndex === gate) return;
    const roadChanged = this.markedRoad !== road || this.activeMarker !== index;
    this.markedRoad = road;
    this.branchIndex = gate;
    this.activeMarker = index;
    const position = road ? road.points[gate] : this.gatePosition(index);
    const height = road ? road.heightProfile[gate] : position.y;
    this.branchGate.visible = !!road;
    if (road) {
      const before = road.points[Math.max(0, gate - 1)], after = road.points[Math.min(road.points.length - 1, gate + 1)];
      this.branchGate.position.set(position.x, height, position.z);
      this.branchGate.rotation.y = Math.atan2(after.x - before.x, after.z - before.z);
    }
    const texture = this.gateBeacon.material.map;
    if (this.gateLabel !== label) {
      this.gateLabel = label;
      const ctx = texture.image.getContext("2d");
      ctx.fillStyle = "#062a29"; ctx.fillRect(0, 0, 512, 96);
      ctx.lineWidth = 8; ctx.strokeStyle = "#76ffce"; ctx.strokeRect(4, 4, 504, 88);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 52px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(label, 256, 67, 485);
      texture.needsUpdate = true;
    }
    this.gateBeacon.position.set(position.x, height + 6.6, position.z);
    if (!roadChanged) return;
    this.markers.forEach((marker, i) => {
      const active = !road && i === index;
      marker.visible = road ? i === index : active || i === (index + 1) % this.route.length;
      marker.userData.glow.color.set(active ? 0x66ffcc : 0xe1fff6);
      marker.userData.glow.opacity = active ? 0.93 : 0.27;
      marker.userData.postMat.color.set(active ? 0x66ffcc : 0xb1d9d5);
      marker.userData.postMat.opacity = active ? 0.93 : 0.32;
      marker.userData.arrow.visible = active;
    });
  }

  distanceToRoad(position) {
    let nearest = this.projectMainRoad(position).distance;
    for (const shortcut of this.shortcutRoads) {
      nearest = Math.min(nearest, nearestPointOnPath(position, shortcut.points, false).distance);
    }
    return nearest;
  }

  constrainToRoad(actor) {
    const position = actor.mesh.position;
    let center = this.projectMainRoad(position);
    const segment = center.index;
    actor.courseDistance = THREE.MathUtils.lerp(this.sampleDistances[segment], this.sampleDistances[segment + 1], center.fraction);
    let pastEdge = center.distance - roadHalfWidth;
    let branch = null;
    for (const road of this.shortcutRoads) {
      if (actor.role === "race" || (actor.roadBranch && actor.roadBranch !== road)) continue;
      const candidate = nearestPointOnPath(position, road.points, false);
      const junction = candidate.index < 3 || candidate.index >= road.points.length - 4;
      const following = actor.roadBranch === road;
      // Neighbouring shoulders and overpasses are not junctions. Hold the
      // current surface through the middle of a shortcut even at a crossing.
      if (!following && !junction && actor.cut?.road !== road) continue;
      const pastShortcut = candidate.distance - shortcutHalfWidth;
      if ((following && !junction) || pastShortcut + (following ? -.4 : .4) < pastEdge) {
        center = candidate;
        pastEdge = pastShortcut;
        branch = road;
      }
    }
    actor.roadBranch = branch;
    if (branch) {
      const stride = this.samples.length / this.route.length;
      const from = this.sampleDistances[this.authorSegmentToRouteIndex(branch.from) * stride];
      const to = this.sampleDistances[this.authorSegmentToRouteIndex(branch.to) * stride];
      const fraction = (center.index + center.fraction) / (branch.points.length - 1);
      actor.courseDistance = from + ((to - from + this.courseLength) % this.courseLength) * fraction;
    }
    actor.roadHeight = branch ? THREE.MathUtils.lerp(branch.heightProfile[center.index],
      branch.heightProfile[center.index + 1], center.fraction) : this.roadSurfaceY;
    if (pastEdge > shoulderAllowance) {
      const nx = (center.x - position.x) / center.distance;
      const nz = (center.z - position.z) / center.distance;
      position.x += nx * (pastEdge - shoulderAllowance);
      position.z += nz * (pastEdge - shoulderAllowance);
      deflectVelocity(actor, nx, nz, 0);
    }
    return pastEdge <= 0;
  }

  getRoadHeightAt(x, z, previousHeight) {
    let nearest = Infinity;
    let height = this.roadSurfaceY;

    for (const shortcut of this.shortcutRoads) {
      if (!shortcut.heightProfile?.length) continue;

      const points = shortcut.points;

      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lenSq = dx * dx + dz * dz || 1;
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / lenSq, 0, 1);
        const px = a.x + dx * t;
        const pz = a.z + dz * t;
        const d = Math.hypot(x - px, z - pz);

        if (d < nearest) {
          nearest = d;
          height = THREE.MathUtils.lerp(
            shortcut.heightProfile[i],
            shortcut.heightProfile[i + 1],
            t,
          );
        }
      }
    }

    if (nearest < 8.9) {
      // At grade-separated crossings a car beneath a bridge stays on the lower road.
      if (Number.isFinite(previousHeight) && height - previousHeight > 1.1 &&
          this.projectMainRoad({ x, z }).distance <= roadHalfWidth + shoulderAllowance) return this.roadSurfaceY;
      return height;
    }

    return this.roadSurfaceY;
  }

  createVisibilityCells() {
    this.visibilityCells = [];
    for (const object of this.group.children) {
      if (!object.isMesh || object.frustumCulled === false) continue;
      if (!object.geometry.boundingSphere)
        object.geometry.computeBoundingSphere();
      if (object.isInstancedMesh && !object.boundingSphere)
        object.computeBoundingSphere();
      const sphere = (
        object.isInstancedMesh
          ? object.boundingSphere
          : object.geometry.boundingSphere
      ).clone();
      sphere.applyMatrix4(object.matrixWorld);
      if (sphere.radius > 160) continue;
      this.visibilityCells.push({ object, sphere });
    }
    this.visibilityTimer = 0;
  }

  update(dt, time, focus, distance = 290) {
    this.visibilityTimer -= dt;
    if (focus && this.visibilityTimer <= 0) {
      this.visibilityTimer = 0.2;
      for (const { object, sphere } of this.visibilityCells)
        object.visible =
          focus.distanceToSquared(sphere.center) <
          (distance + sphere.radius) ** 2;
    }
    for (const traffic of this.traffic) {
      advanceRoute(this.samples, traffic, dt * traffic.speed);
      traffic.mesh.position.x=traffic.x;
      traffic.mesh.position.z=traffic.z;

      alignVehicleToSurface(
        traffic.mesh,
        this.roadSurfaceY,
      );

      traffic.mesh.rotation.y = traffic.heading;

      if (
        !focus ||
        traffic.mesh.position.distanceToSquared(focus) < distance * distance
      )
        animateVehicle(
          traffic.mesh,
          traffic.speed,
          false,
          time,
          0,
          false,
          false,
          dt,
        );
    }

    for (const marker of this.markers) {
      if (marker.userData.arrow.visible) {
        marker.userData.arrow.rotation.z = time * 2;

        marker.userData.arrow.position.y = 2.85 + Math.sin(time * 3) * 0.12;
      }
    }

    for (let i = 0; i < this.cityLights.length; i++) {
      const light = this.cityLights[i];

      light.intensity = 3.0 + Math.sin(time * (0.8 + i * 0.17)) * 0.14;
    }
  }

  dispose() {
    this.scene.remove(this.group);

    const disposed = new Set();

    this.group.traverse((object) => {
      if (
        (object.userData?.worldOwned ||
          object.geometry?.userData?.disposeWithActor) &&
        object.geometry &&
        ![box, poleGeo, lowCylinderGeo, discGeo, sphereGeo, coneGeo].includes(
          object.geometry,
        )
      ) {
        object.geometry.dispose?.();
      }

      if (object.userData?.disposeWithWorld) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => {
            if (material.userData.disposeWithActor) material.dispose?.();
          });
        } else {
          if (object.material?.userData.disposeWithActor)
            object.material.dispose();
        }
      }
    });

    for (const material of this.materials) {
      if (!disposed.has(material)) {
        material.dispose?.();
        disposed.add(material);
      }
    }

    for (const texture of this.textures) {
      texture.dispose?.();
    }

    for (const geometry of new Set(this.geometries)) geometry.dispose();
    this.materials.length = 0;
    this.textures.length = 0;
    this.geometries.length = 0;

    this.materialCache.clear();
    this.instancedBatches.clear();

    this.markers.length = 0;
    this.traffic.length = 0;
    this.destructibles.length = 0;
    this.cityLights.length = 0;
  }
}
