import './styles.css';

const app = document.querySelector('#app');
let ui;

function showStartupError(error) {
  console.error('NIGHTSHIFT failed to start', error);
  const detail = error instanceof Error ? error.message : 'An unknown browser error occurred.';
  app.innerHTML = `<section class="startup-error" role="alert"><p>STARTUP INTERRUPTED</p><h1>NIGHTSHIFT //</h1><strong>The game could not create its 3D display.</strong><span>${detail}</span><button type="button" id="retry-startup">RETRY</button><small>Open this game at http://localhost:5173 — not by double-clicking index.html.</small></section>`;
  document.querySelector('#retry-startup')?.addEventListener('click', () => location.reload());
}

async function boot() {
  try {
    // Importing inside boot turns module, GPU, and renderer failures into a
    // visible screen instead of leaving the browser on an empty black page.
    const [{ Game }, { Network }, { UI }] = await Promise.all([
      import('./game.js'), import('./network.js'), import('./ui.js')
    ]);
    const stage = document.createElement('div');
    stage.id = 'stage';
    app.replaceChildren(stage);
    const network = new Network();
    const game = new Game(stage, {
      hud: state => ui?.updateHUD(state),
      countdown: value => ui?.showCountdown(value),
      gameState: state => ui?.setRunning(state.running),
      result: data => ui?.result(data),
      pause: paused => ui?.pause(paused)
    });
    ui = new UI(app, game, network);
    if (import.meta.env.DEV) globalThis.__nightshift = { game, ui, network };
    document.documentElement.classList.add('game-ready');
  } catch (error) {
    showStartupError(error);
  }
}

boot();
