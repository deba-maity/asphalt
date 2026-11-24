export const breakawayDistance = 90;
export const breakawaySeconds = 6;

export class PursuitHeat {
  constructor(difficulty) {
    this.interval = { easy: 22, medium: 16, hard: 12 }[difficulty] ?? 16;
    this.level = 1;
    this.peak = 1;
    this.breakaways = 0;
    this.clearTime = 0;
    this.pressure = 0;
    this.damageLevel = 0;
    this.notice = 0;
  }

  update(dt, separated, health) {
    this.notice = Math.max(0, this.notice - dt);
    const damageLevel = Math.floor(Math.max(0, 100 - health) / 30);
    if (damageLevel > this.damageLevel) {
      this.level = Math.min(5, this.level + damageLevel - this.damageLevel);
      this.damageLevel = damageLevel;
    }
    if (separated) {
      this.pressure = Math.max(0, this.pressure - dt);
      if (this.level > 1) this.clearTime += dt;
      if (this.clearTime >= breakawaySeconds) {
        this.level--;
        this.breakaways++;
        this.clearTime = 0;
        this.notice = 3;
      }
    } else {
      this.clearTime = 0;
      this.pressure += dt;
      if (this.pressure >= this.interval) {
        this.level = Math.min(5, this.level + Math.floor(this.pressure / this.interval));
        this.pressure %= this.interval;
      }
    }
    this.peak = Math.max(this.peak, this.level);
  }
}
