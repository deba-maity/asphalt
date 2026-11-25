// One bay of poured concrete, with shuttering lines and reflected strip light.
// The path UV repeats exactly once between successive tunnel fixtures.
export function paintTunnelBay(ctx, width, height) {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  for (const [position, color] of [
    [0, "#424a51"],
    [0.14, "#829397"],
    [0.55, "#778489"],
    [0.82, "#626f72"],
    [1, "#404c50"],
  ])
    base.addColorStop(position, color);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.scale(width, height);
  const wash = ctx.createRadialGradient(0.5, 0.26, 0, 0.5, 0.26, 0.5);
  wash.addColorStop(0, "rgba(222,222,198,.44)");
  wash.addColorStop(0.6, "rgba(199,211,197,.16)");
  wash.addColorStop(1, "rgba(199,211,197,0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1, 1);
  ctx.restore();
  let seed = 73;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 4800; i++) {
    ctx.fillStyle = i % 2 ? "rgba(220,229,223,.11)" : "rgba(33,45,48,.15)";
    ctx.fillRect(
      random() * width,
      random() * height,
      1 + random() * 1.3,
      1 + random() * 2.0,
    );
  }
  for (const x of [0, width / 2]) {
    ctx.fillStyle = "rgba(24,36,38,.61)";
    ctx.fillRect(x, 0, 2, height);
    ctx.fillStyle = "rgba(222,222,203,.26)";
    ctx.fillRect(x + 2, 0, 1, height);
    for (const y of [height * 0.27, height * 0.7]) {
      for (const mount of [0.13, 0.36]) {
        ctx.fillStyle = "rgba(40,49,49,.6)";
        ctx.beginPath();
        ctx.arc(x + width * mount, y, 1.3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }
  ctx.fillStyle = "rgba(34,44,44,.44)";
  ctx.fillRect(0, height * 0.53, width, 1.5);
  for (let i = 0; i < 23; i++) {
    const x = random() * width,
      y = random() * 0.18 * height,
      length = (0.11 + random() * 0.4) * height;
    const stain = ctx.createLinearGradient(0, y, 0, y + length);
    stain.addColorStop(0, "rgba(71,66,47,.2)");
    stain.addColorStop(1, "rgba(71,66,47,0)");
    ctx.fillStyle = stain;
    ctx.fillRect(x, y, 1 + random() * 2, length);
  }
}
