import { storage } from "./storage.js";
import { angleDelta } from "./route-motion.js";

const limit = 6000;
const scale = 10; // decimetres
const key = (district) => "nightshift-pace-v1-" + district;

export function districtBest(district) {
  const value = Number(storage.getItem("nightshift-best-" + district));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function referenceLap(district, gates) {
  try {
    const lap = JSON.parse(storage.getItem(key(district)));
    if (!lap || !Number.isSafeInteger(lap.duration) || lap.duration <= 0 ||
        !Array.isArray(lap.splits) || lap.splits.length !== gates ||
        !lap.splits.every((s) => s === null || (Number.isSafeInteger(s) && s >= 0 && s <= lap.duration)) ||
        !Array.isArray(lap.frames) || lap.frames.length < 2 || lap.frames.length > limit ||
        typeof lap.vehicle !== "string" || typeof lap.kind !== "string") return null;
    let previous = -1;
    for (const f of lap.frames) {
      if (!Array.isArray(f) || f.length < 5 || f.length > 6 || !f.every(Number.isSafeInteger) ||
          f[0] <= previous || f[0] > lap.duration ||
          Math.abs(f[1]) > 30000 || Math.abs(f[2]) > 1000 || Math.abs(f[3]) > 30000 ||
          Math.abs(f[4]) > 3142 || (f.length === 6 && f[5] !== 1)) return null;
      previous = f[0];
    }
    return lap.frames[0][0] === 0 && previous === lap.duration ? lap : null;
  } catch { return null; }
}

// Each sample stores milliseconds, three decimetre coordinates and milliradians.
// Sparse gate times allow a legal shortcut to skip a split on either lap.
export class PaceLap {
  constructor(district, gates, vehicle) {
    this.district = district;
    this.vehicle = vehicle;
    this.reference = referenceLap(district, gates);
    this.best = districtBest(district);
    this.splits = Array(gates).fill(null);
    this.frames = [];
    this.interval = 150;
    this.lastSplit = null;
    this.cursor = 0;
  }

  record(seconds, position, height, heading, { force = false, jump = false } = {}) {
    const stamp = Math.round(seconds * 1000);
    const last = this.frames.at(-1);
    if (last && !force && stamp - last[0] < this.interval) return;
    if (last && stamp < last[0]) return;
    if (last?.[0] === stamp) this.frames.pop();
    if (this.frames.length >= limit) {
      let skippedJump = false;
      this.frames = this.frames.filter((frame, i) => {
        skippedJump ||= frame[5] === 1;
        if (i % 2) return false;
        if (skippedJump) frame[5] = 1;
        skippedJump = false;
        return true;
      });
      jump ||= skippedJump;
      this.interval *= 2;
    }
    const frame = [stamp, Math.round(position.x * scale), Math.round(height * scale),
      Math.round(position.z * scale), Math.round(angleDelta(0, heading) * 1000)];
    if (jump || (last?.[0] === stamp && last[5])) frame.push(1);
    this.frames.push(frame);
  }

  gate(index, seconds) {
    const stamp = Math.round(seconds * 1000);
    this.splits[index] = stamp;
    const previous = this.reference?.splits[index];
    this.lastSplit = Number.isFinite(previous) ? { index, seconds, delta: (stamp - previous) / 1000 } : null;
  }

  finish(seconds, position, height, heading) {
    if (!Number.isFinite(seconds) || seconds <= 0) return { best: this.best, improved: false };
    this.record(seconds, position, height, heading, { force: true });
    const previous = districtBest(this.district);
    const improved = previous === null || seconds < previous;
    this.best = improved ? seconds : previous;
    if (improved) storage.setItem("nightshift-best-" + this.district, this.best);
    const duration = Math.round(seconds * 1000);
    const saved = referenceLap(this.district, this.splits.length);
    if (this.frames.length >= 2 && (!saved || duration < saved.duration)) {
      storage.setItem(key(this.district), JSON.stringify({
        vehicle: this.vehicle.name, kind: this.vehicle.kind, duration, frames: this.frames, splits: this.splits
      }));
    }
    return { best: this.best, improved, delta: previous === null ? null : seconds - previous };
  }

  pose(seconds) {
    if (!this.reference) return null;
    const { frames, duration } = this.reference;
    const stamp = seconds * 1000;
    if (stamp > duration || stamp < 0) return null;
    while (this.cursor > 0 && frames[this.cursor][0] > stamp) this.cursor--;
    while (this.cursor < frames.length - 2 && frames[this.cursor + 1][0] <= stamp) this.cursor++;
    const a = frames[this.cursor], b = frames[this.cursor + 1];
    const t = b[5] && stamp < b[0] ? 0 : Math.min(1, (stamp - a[0]) / (b[0] - a[0]));
    return {
      x: (a[1] + (b[1] - a[1]) * t) / scale,
      y: (a[2] + (b[2] - a[2]) * t) / scale,
      z: (a[3] + (b[3] - a[3]) * t) / scale,
      heading: a[4] / 1000 + angleDelta(a[4] / 1000, b[4] / 1000) * t
    };
  }
}
