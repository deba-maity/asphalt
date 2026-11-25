// The engine note and instrument panel follow the same road speed. Different
// upshift and downshift thresholds keep the indicated gear steady in a bend.
const carGears = [0.19, 0.32, 0.47, 0.64, 0.83, 1.08];
const bikeGears = [0.24, 0.39, 0.54, 0.7, 0.87, 1.08];
const heavyGears = [0.22, 0.42, 0.66, 1.05];

export class Tachometer {
  constructor(spec) {
    const bike = spec.kind === "bike";
    const heavy = spec.kind === "heavy" || spec.kind === "monster";
    this.gears = heavy ? heavyGears : bike ? bikeGears : carGears;
    this.top = spec.maxSpeed;
    this.idle = bike ? 1350 : heavy ? 630 : 850;
    this.redline = bike
      ? spec.profile === "cruiser"
        ? 6800
        : 11600
      : heavy
        ? 3650
        : spec.profile === "muscle"
          ? 6250
          : 7600;
    this.pulses = bike
      ? spec.profile === "sport"
        ? 2
        : 1
      : heavy || spec.profile === "muscle"
        ? 4
        : 2;
    this.gear = 1;
    this.display = "N";
    this.rpm = this.idle;
    this.fraction = this.idle / this.redline;
    this.load = 0;
    this.shiftTime = 0;
  }

  onGrid(throttle, dt) {
    this.display = "N";
    this.load = Math.min(1, Math.max(0, Number(throttle) || 0));
    const target = this.idle + this.load * (this.redline * 0.56 - this.idle);
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt * 7));
    this.fraction = this.rpm / this.redline;
  }

  update(speed, throttle, boost, dt) {
    const velocity = (Math.abs(speed) * 5.7) / this.top;
    const load = boost ? 1 : Math.min(1, Math.max(0, Number(throttle) || 0));
    const previous = this.gear;
    this.shiftTime = Math.max(0, this.shiftTime - dt);
    if (speed <= 0.3) this.gear = 1;
    else if (this.shiftTime === 0) {
      if (
        this.gear < this.gears.length &&
        velocity > this.gears[this.gear - 1] * (0.81 + 0.16 * load)
      )
        this.gear++;
      else if (this.gear > 1 && velocity < this.gears[this.gear - 2] * 0.7)
        this.gear--;
    }
    if (this.gear !== previous) this.shiftTime = 0.16;
    this.display =
      speed < -0.3
        ? "R"
        : Math.abs(speed) <= 0.3 && load < 0.05
          ? "N"
          : String(this.gear);
    const ratio = Math.min(
      1,
      velocity / (speed < -0.3 ? 0.18 : this.gears[this.gear - 1]),
    );
    const revs = Math.max(this.idle + load * 670, this.redline * ratio);
    this.rpm += (revs - this.rpm) * (1 - Math.exp(-dt * 13));
    this.fraction = this.rpm / this.redline;
    this.load = load * (1 - (0.65 * this.shiftTime) / 0.16);
  }
}
