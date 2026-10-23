import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const QUALITY = {
  battery: {
    label: "Battery saver",
    fps: 30,
    scale: 0.78,
    min: 0.55,
    distance: 210,
  },
  balanced: {
    label: "Balanced",
    fps: 60,
    scale: 0.9,
    min: 0.62,
    distance: 290,
  },
  quality: {
    label: "High fidelity",
    fps: 60,
    scale: 1.15,
    min: 0.75,
    distance: 380,
  },
};

// A small, prefiltered studio probe gives paint and glass reflections without
// rendering the world again every frame.
export function createEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.06, 0.1, 80);
  room.dispose();
  pmrem.dispose();
  return target;
}

// Merge rigid pieces inside each animated parent. Wheels, steering pivots,
// flames and light materials retain their independent animation.
export function consolidateVehicle(root) {
  const parents = [];
  root.traverse((o) => {
    if (o.isGroup) parents.push(o);
  });
  for (const parent of parents) {
    const batches = new Map();
    for (const child of parent.children) {
      if (!child.isMesh || !child.visible || child.material.transparent)
        continue;
      const key = child.material.uuid;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(child);
    }
    for (const pieces of batches.values()) {
      if (pieces.length < 2) continue;
      const clones = pieces.map((piece) => {
        piece.updateMatrix();
        return piece.geometry.clone().applyMatrix4(piece.matrix);
      });
      const geometry = mergeGeometries(clones);
      clones.forEach((g) => g.dispose());
      if (!geometry) continue;
      geometry.userData.disposeWithActor = true;
      const mesh = new THREE.Mesh(geometry, pieces[0].material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      pieces.forEach((piece) => {
        piece.removeFromParent();
        if (piece.geometry.userData.disposeWithActor) piece.geometry.dispose();
      });
    }
  }
}

// Spatial batches preserve frustum culling. One city-wide instance bounds
// would otherwise send distant windows and street furniture to the GPU.
export function batchWorld(world) {
  const excluded = new Set([
    ...world.markers,
    ...world.traffic.map((t) => t.mesh),
    ...world.destructibles,
  ]);
  const batches = new Map();
  world.group.updateMatrixWorld(true);
  const visit = (object) => {
    if (excluded.has(object)) return;
    if (
      object.isMesh &&
      !object.isInstancedMesh &&
      object.visible &&
      !Array.isArray(object.material) &&
      !object.material.transparent &&
      object.geometry === world.batchBox
    ) {
      const p = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
      const key = `${object.geometry.uuid}:${object.material.uuid}:${Math.floor(p.x / 100)}:${Math.floor(p.z / 100)}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(object);
    }
    [...object.children].forEach(visit);
  };
  visit(world.group);
  for (const pieces of batches.values()) {
    if (pieces.length < 3) continue;
    const instance = new THREE.InstancedMesh(
      pieces[0].geometry,
      pieces[0].material,
      pieces.length,
    );
    pieces.forEach((piece, i) => {
      instance.setMatrixAt(i, piece.matrixWorld);
      piece.removeFromParent();
    });
    instance.computeBoundingSphere();
    instance.name = "static-spatial-batch";
    instance.matrixAutoUpdate = false;
    world.group.add(instance);
  }
  world.group.traverse((o) => {
    if (!o.isMesh || excluded.has(o)) return;
    let parent = o.parent;
    while (parent && parent !== world.group) {
      if (excluded.has(parent)) return;
      parent = parent.parent;
    }
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
}
