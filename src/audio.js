export class AudioEngine {
  constructor() {
    this.enabled = localStorage.getItem("nightshift-audio") !== "false";
    this.muted = false;
    this.context = null;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.nitro = null;
    this.nitroGain = null;
  }
  start() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.11 : 0;
      this.master.connect(this.context.destination);
      this.engine = this.context.createOscillator();
      this.engine.type = "sawtooth";
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.0001;
      this.engine.connect(this.engineGain).connect(this.master);
      this.engine.start();
      this.nitro = this.context.createOscillator();
      this.nitro.type = "square";
      this.nitroGain = this.context.createGain();
      this.nitroGain.gain.value = 0.0001;
      this.nitro.connect(this.nitroGain).connect(this.master);
      this.nitro.start();
    }
    this.setMuted(false);
    this.context.resume?.();
  }
  update(speed, boost) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(
      58 + Math.abs(speed) * 4.5,
      now,
      0.05,
    );
    this.engineGain.gain.setTargetAtTime(
      0.012 + Math.min(Math.abs(speed) / 120, 0.045),
      now,
      0.08,
    );
    this.nitro.frequency.setTargetAtTime(130 + Math.abs(speed) * 5, now, 0.03);
    this.nitroGain.gain.setTargetAtTime(boost ? 0.055 : 0.0001, now, 0.04);
  }
  blip(freq = 150, duration = 0.08) {
    if (!this.context) return;
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
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem("nightshift-audio", enabled);
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
  }
  stop() {
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
  }
}
