const controlSelector = 'button:not(:disabled), select:not(:disabled), input:not(:disabled), summary, a[href]:not([href="#"])';
const preferredSelector = '.primary, .mode-card.featured, .map-card.selected';

function focusControl(control) {
  if (!control) return;
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function directionOf(pad) {
  const x = Number(pad.buttons[15]?.pressed) - Number(pad.buttons[14]?.pressed) || pad.axes[0] || 0;
  const y = Number(pad.buttons[13]?.pressed) - Number(pad.buttons[12]?.pressed) || pad.axes[1] || 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.55) return "";
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? "left" : "right";
  return y < 0 ? "up" : "down";
}

// Select the nearest control in the indicated direction, preferring the same
// row or column. Use layout coordinates so this works on portrait grids too.
function neighbor(origin, controls, direction) {
  const horizontal = direction === "left" || direction === "right";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const a = origin.getBoundingClientRect();
  let best = null, bestScore = Infinity;
  for (const control of controls) {
    if (control === origin) continue;
    const b = control.getBoundingClientRect();
    const dx = (b.left + b.right - a.left - a.right) / 2;
    const dy = (b.top + b.bottom - a.top - a.bottom) / 2;
    const along = sign * (horizontal ? dx : dy);
    if (along <= 2) continue;
    const across = Math.abs(horizontal ? dy : dx);
    const gap = horizontal ? Math.max(a.top - b.bottom, b.top - a.bottom, 0)
                           : Math.max(a.left - b.right, b.left - a.right, 0);
    const score = along + across * 0.35 + gap * 3;
    if (score < bestScore) { bestScore = score; best = control; }
  }
  return best;
}

export function bindMenuGamepad(root, game) {
  let frame = 0, previousPad, previousButtons = [], previousDirection = "", repeatAt = 0;
  const menu = () => root.querySelector(".pause-overlay") || root.querySelector("#menu-layer .screen");
  const reset = () => { previousPad = undefined; previousButtons = []; previousDirection = ""; };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; reset(); };
  const wake = () => { if (!frame && !document.hidden) frame = requestAnimationFrame(poll); };
  const usePointer = () => root.classList.remove("controller-nav");
  root.addEventListener("pointerdown", usePointer);
  window.addEventListener("keydown", usePointer);
  window.addEventListener("gamepadconnected", wake);
  window.addEventListener("gamepaddisconnected", () => {
    if (!game.readGamepad()) { stop(); usePointer(); }
  });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : wake());

  function poll(now) {
    frame = 0;
    const pad = game.readGamepad();
    if (!pad || document.hidden) { reset(); return; }
    wake();
    const buttons = [pad.buttons[0]?.pressed, pad.buttons[1]?.pressed, pad.buttons[9]?.pressed];
    const direction = directionOf(pad);
    const same = previousPad === pad.index;
    const [accept, back, pause] = buttons.map((held, i) => same && held && !previousButtons[i]);
    const move = same && direction && (direction !== previousDirection || now >= repeatAt);
    if (!same || direction !== previousDirection) repeatAt = now + 380;
    else if (move) repeatAt = now + 160;
    previousPad = pad.index;
    previousButtons = buttons;
    previousDirection = direction;
    if (!accept && !back && !pause && !move) return;

    if (pause && game.running && game.phase !== "finished") {
      root.classList.add("controller-nav");
      game.togglePause();
      if (game.paused) focusControl(menu()?.querySelector('[data-action="resume"]'));
      return;
    }
    if (game.running && !game.paused && game.phase !== "finished") return;
    const screen = menu();
    if (!screen) return;
    root.classList.add("controller-nav");
    if (back) {
      (screen.querySelector('[data-action="resume"], .back') || screen.querySelector('[data-action="home"]'))?.click();
      focusControl(menu()?.querySelector(preferredSelector));
      return;
    }
    const controls = [...screen.querySelectorAll(controlSelector)].filter(control => control.getClientRects().length);
    const current = controls.includes(document.activeElement) ? document.activeElement
      : screen.querySelector(preferredSelector) || controls[0];
    if (!current) return;
    if (move && !accept) { focusControl(neighbor(current, controls, direction) || current); return; }
    if (!accept) return;
    focusControl(current);
    if (current.tagName === "SELECT") {
      current.selectedIndex = (current.selectedIndex + 1) % current.options.length;
      current.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    current.click();
    if (current.isConnected) return;
    const next = menu();
    if (!next) return;
    // Paint, difficulty and vehicle filters redraw in place. Keep the driver
    // on the control they used when its replacement is on the new screen.
    const match = [...next.querySelectorAll("[data-action]")].find(control =>
      control.dataset.action === current.dataset.action && control.dataset.id === current.dataset.id &&
      control.dataset.color === current.dataset.color);
    focusControl(match || next.querySelector(preferredSelector) || next.querySelector(controlSelector));
  }
  wake();
}
