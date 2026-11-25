import { storage } from "./storage.js";
export class AudioEngine {
  constructor() {
    this.enabled = storage.getItem("nightshift-audio") !== "false";
    this.muted = false;
    this.context = null;
    this.active = false;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.nitro = null;
    this.nitroGain = null;
  }
  start() {
    this.active = true;
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.11 : 0;
      this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      const harmonics = new Float32Array([
        0, 1, 0.55, 0.27, 0.38, 0.16, 0.11, 0.14, 0.055, 0.04,
      ]);
      this.engine.setPeriodicWave(
        this.context.createPeriodicWave(
          new Float32Array(harmonics.length),
          harmonics,
        ),
      );
      this.intake = this.context.createBiquadFilter();
      this.intake.type = "lowpass";
      this.intake.Q.value = 0.55;
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.0001;
      this.engine
        .connect(this.intake)
        .connect(this.engineGain)
        .connect(this.master);
      this.engine.start();
      // A filtered air loop follows the tyres and the nitrous valve.
      const noise = this.context.createBuffer(
        1,
        this.context.sampleRate,
        this.context.sampleRate,
      );
      const samples = noise.getChannelData(0);
      let seed = 7943;
      for (let i = 0; i < samples.length; i++) {
        seed = (seed * 16807) % 2147483647;
        samples[i] = seed / 1073741823.5 - 1;
      }
      this.nitro = this.context.createBufferSource();
      this.nitro.buffer = noise;
      this.nitro.loop = true;
      this.air = this.context.createBiquadFilter();
      this.air.type = "bandpass";
      this.air.Q.value = 0.7;
      this.nitroGain = this.context.createGain();
      this.nitroGain.gain.value = 0.0001;
      this.nitro.connect(this.air).connect(this.nitroGain).connect(this.master);
      this.nitro.start();
    }
    this.setMuted(false);
  }
  update(speed, boost, gauge, drifting) {
    if (!this.context || !this.active || !this.enabled || this.muted) return;
    const now = this.context.currentTime;
    const revs = gauge.fraction,
      throttle = gauge.load;
    this.engine.frequency.setTargetAtTime(
      (gauge.rpm / 60) * gauge.pulses,
      now,
      0.025,
    );
    this.intake.frequency.setTargetAtTime(
      300 + revs * 750 + throttle * 1150,
      now,
      0.055,
    );
    this.engineGain.gain.setTargetAtTime(
      0.042 + 0.052 * throttle + revs * 0.046,
      now,
      0.05,
    );
    const road = Math.min(1, Math.abs(speed) / 47);
    this.air.frequency.setTargetAtTime(
      boost ? 1750 : drifting ? 1220 : 540 + 360 * road,
      now,
      0.07,
    );
    this.nitroGain.gain.setTargetAtTime(
      0.0001 + road * road * 0.065 + (boost ? 0.19 : drifting ? 0.13 : 0),
      now,
      0.06,
    );
  }
  blip(freq = 150, duration = 0.08) {
    if (!this.context || !this.active || !this.enabled || this.muted) return;
    const o = this.context.createOscillator(),
      g = this.context.createGain(),
      now = this.context.currentTime;
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.04, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + duration);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    storage.setItem("nightshift-audio", enabled);
    this.setMuted(this.muted);
  }
  setMuted(muted) {
    this.muted = muted;
    if (this.master)
      this.master.gain.setTargetAtTime(
        this.enabled && !muted ? 0.11 : 0,
        this.context.currentTime,
        0.03,
      );
    this.syncContext();
  }
  syncContext() {
    const context = this.context;
    if (!context || context.state === "closed") return;
    const shouldRun = this.active && this.enabled && !this.muted;
    // Suspend the graph itself; a zero gain still spends audio-thread work.
    const operation = shouldRun ? context.resume() : context.suspend();
    operation?.catch(() => {});
  }
  stop() {
    this.active = false;
    if (this.nitroGain)
      this.nitroGain.gain.setTargetAtTime(
        0.0001,
        this.context.currentTime,
        0.03,
      );
    if (this.engineGain)
      this.engineGain.gain.setTargetAtTime(
        0.0001,
        this.context.currentTime,
        0.08,
      );
    this.syncContext();
  }
}
