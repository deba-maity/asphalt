import { storage } from "./storage.js";

// Place timing gates near thirds of the driven distance. A legal shortcut
// must pass the same timing points as a car following the main circuit.
export function sectorGates(world, includeEntries = false) {
  const count = world.route.length;
  const stride = world.samples.length / count;
  const eligible = [];
  for (let gate = 1; gate < count; gate++) {
    const bypassed = world.shortcutRoads.some(road => {
      const from = world.authorSegmentToRouteIndex(road.from);
      const to = world.authorSegmentToRouteIndex(road.to);
      const offset = (gate - from + count) % count;
      // At a fork, cars can turn across the stripe sideways without crossing its timing plane.
      return (offset > 0 || !includeEntries) && offset <= (to - from + count) % count;
    });
    if (!bypassed) eligible.push(gate);
  }
  if (eligible.length < 2) return [];
  function closest(gates, fraction) {
    const target = world.timingOffset + world.courseLength * fraction;
    return gates.reduce((best, gate) => Math.abs(world.sampleDistances[gate * stride] - target)
      < Math.abs(world.sampleDistances[best * stride] - target) ? gate : best);
  }
  const first = closest(eligible.slice(0, -1), 1 / 3);
  const second = closest(eligible.filter(gate => gate > first), 2 / 3);
  return [first, second, 0];
}

function recordKey(district, mode, difficulty) {
  return ["nightshift-race-v1", district, mode, difficulty].join("-");
}

export function raceRecord(district, mode, difficulty) {
  if (mode !== "race" && mode !== "sprint") return null;
  return readSplits(recordKey(district, mode, difficulty), mode);
}

function readSplits(key, mode) {
  try {
    const splits = JSON.parse(storage.getItem(key));
    if (!Array.isArray(splits) || splits.length !== (mode === "race" ? 9 : 3)) return null;
    return splits.every((stamp, i) => Number.isSafeInteger(stamp) && stamp > (splits[i - 1] ?? 0)) ? splits : null;
  } catch { return null; }
}

export class RaceTiming {
  constructor(world, mode, difficulty) {
    this.district = world.map.id;
    this.mode = mode;
    this.difficulty = difficulty;
    this.gates = sectorGates(world);
    const overall = raceRecord(this.district, mode, difficulty);
    this.best = overall?.at(-1) ?? null;
    this.sectorKey = recordKey(this.district, mode, difficulty) + "-sectors-" + this.gates.join(".");
    this.reference = readSplits(this.sectorKey, mode);
    if (!this.reference && overall && sectorGates(world, true).join(".") === this.gates.join(".")) {
      this.reference = overall;
    }
    this.splits = [];
    this.latest = null;
  }

  gate(gate, seconds) {
    const i = this.splits.length;
    const sector = i % 3;
    if (i >= (this.mode === "race" ? 9 : 3) || gate !== this.gates[sector]) return;
    const stamp = Math.round(seconds * 1000);
    const previous = this.splits.at(-1) ?? 0;
    if (!Number.isSafeInteger(stamp) || stamp <= previous) return;
    this.splits.push(stamp);
    const duration = stamp - previous;
    const referenceDuration = this.reference && this.reference[i] - (this.reference[i - 1] ?? 0);
    this.latest = { sector: sector + 1, at: seconds, duration: duration / 1000,
      delta: referenceDuration == null ? null : (duration - referenceDuration) / 1000 };
  }

  finish() {
    if (this.splits.length !== (this.mode === "race" ? 9 : 3)) return null;
    const record = raceRecord(this.district, this.mode, this.difficulty);
    const previous = record?.at(-1);
    const total = this.splits.at(-1);
    const improved = previous == null || total < previous;
    const savedSectors = readSplits(this.sectorKey, this.mode) ?? this.reference;
    const encoded = JSON.stringify(this.splits);
    if (!savedSectors || total < savedSectors.at(-1)) storage.setItem(this.sectorKey, encoded);
    if (improved) storage.setItem(recordKey(this.district, this.mode, this.difficulty), encoded);
    const sectors = this.splits.map((stamp, i) => (stamp - (this.splits[i - 1] ?? 0)) / 1000);
    const rows = [];
    for (let i = 0; i < sectors.length; i += 3) rows.push(sectors.slice(i, i + 3));
    return { rows, improved, best: (improved ? total : previous) / 1000,
      delta: previous == null ? null : (total - previous) / 1000 };
  }
}
