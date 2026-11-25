import * as THREE from "three";
import { raceTime } from "./timing.js";

// A second view of the real crossing, including paint, opponents, light and
// steering pose. Copy the backbuffer before the next animation frame clears it.
export function captureFinishPhoto(game, title, seconds) {
  const player = game.player;
  const course = game.world;
  const renderer = game.renderer;
  if (!course || !player || renderer.getContext().isContextLost()) return null;
  const here = player.mesh.position.clone();
  const direction = course.finishForward;
  const right = new THREE.Vector3(direction.z, 0, -direction.x);
  const lane = here.clone().sub(course.finishLine).dot(right);
  const vehicleHeight = player.spec.kind === "monster" || player.spec.kind === "heavy" ? 1.0 : .68;
  const camera = new THREE.PerspectiveCamera(41, 16 / 9, .15, game.camera.far);
  camera.position.copy(here).addScaledVector(direction, 5.8).addScaledVector(right, lane > 0 ? -4.8 : 4.8);
  camera.position.y = player.surfaceY + vehicleHeight + 1.02;
  const focus = here.clone().addScaledVector(direction, -.30);
  focus.y = player.surfaceY + vehicleHeight;
  camera.lookAt(focus);
  const image = document.createElement("canvas");
  image.width = 960;
  const frameHeight = 540;
  image.height = frameHeight + 89;
  const ctx = image.getContext("2d");
  if (!ctx) return null;
  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalScale = renderer.getPixelRatio();
  const guides = course.group.children.filter(object => object.visible &&
    /^instances:(routeGuidanceArrows|shortcutArrows):/.test(object.name));
  try {
    // Expose one full-resolution frame without permanently raising race cost.
    // This only changes the drawing buffer, preserving the canvas CSS layout.
    renderer.setDrawingBufferSize(image.width, frameHeight, game.lowPower ? 1.5 : 2);
    for (const guide of guides) guide.visible = false;
    renderer.render(game.scene, camera);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(renderer.domElement, 0, 0, image.width, frameHeight);
  } finally {
    for (const guide of guides) guide.visible = true;
    renderer.setDrawingBufferSize(originalSize.x, originalSize.y, originalScale);
    renderer.render(game.scene, game.camera);
  }
  ctx.fillStyle = "#0c141a";
  ctx.fillRect(0, frameHeight, image.width, 89);
  ctx.fillStyle = course.map.accent;
  ctx.fillRect(0, frameHeight, image.width, 3);
  ctx.fillStyle = "#aec1c5";
  ctx.font = '15px "DM Mono", monospace';
  ctx.fillText(course.map.name.toUpperCase() + "  /  " + player.spec.name.toUpperCase(), 24, frameHeight + 30);
  ctx.fillStyle = "#f1f2e9";
  ctx.font = '700 37px "Barlow Condensed", sans-serif';
  ctx.fillText(title.toUpperCase(), 24, frameHeight + 69);
  ctx.textAlign = "right";
  ctx.font = '29px "DM Mono", monospace';
  ctx.fillText(raceTime(seconds), image.width - 24, frameHeight + 58);
  image.setAttribute("role", "img");
  image.setAttribute("aria-label", player.spec.name + " crossing the line at " + course.map.name + " in " + raceTime(seconds));
  return image;
}

export function saveFinishPhoto(canvas, district) {
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Nightshift-" + district + "-finish.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, "image/png");
}
