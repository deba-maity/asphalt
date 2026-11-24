import { maps, vehicles } from "./data.js";

export function readLapChallenge(hash) {
  const parts = /^#lap=([a-z0-9]+)\.([a-z0-9]+)\.([1-9]\d{0,7})$/.exec(hash);
  if (!parts) return null;
  const map = maps.find(item => item.id === parts[1]);
  const vehicle = vehicles.find(item => item.id === parts[2]);
  const ticks = Number(parts[3]);
  return map && vehicle && ticks <= 24 * 60 * 60 * 100 ? { hash, map, vehicle, ticks } : null;
}

export function lapChallengeLink(address, map, vehicle, seconds) {
  const ticks = Math.round(seconds * 100);
  const hash = "#lap=" + map + "." + vehicle + "." + ticks;
  if (!readLapChallenge(hash)) return null;
  const url = new URL(address);
  url.search = "";
  url.hash = hash;
  return url.href;
}
