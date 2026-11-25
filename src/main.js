import './styles.css';

const app = document.querySelector('#app');
let ui;

function showStartupError(error) {
  console.error('NIGHTSHIFT failed to start', error);
  const detail = error instanceof Error ? error.message : 'An unknown browser error occurred.';
  const graphicsError = /webgl|graphics|rendering context/i.test(detail);
  app.innerHTML = `<section class="startup-error" role="alert">
    <h1>NIGHTSHIFT //</h1>
    <strong>${graphicsError ? 'The 3D display could not start.' : 'The game could not finish loading.'}</strong>
    <span id="startup-detail"></span>
    <small>${graphicsError ? 'Open this link in a browser with WebGL 2 and hardware acceleration enabled.' : 'Check your connection, then retry loading the game.'}</small>
    <button type="button" id="retry-startup">RETRY</button>
  </section>`;
  document.querySelector('#startup-detail').textContent = detail;
  document.querySelector('#retry-startup')?.addEventListener('click', () => location.reload());
}

async function boot() {
  try {
    // Importing inside boot turns module, GPU, and renderer failures into a
    // visible screen instead of leaving the browser on an empty black page.
    const [{ Game }, { Network }, { UI }] = await Promise.all([
      import('./game.js'), import('./network.js'), import('./ui.js')
    ]);
    const { loadTouring } = await import('./touring.js');
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
    // All cars have playable geometry immediately. The larger touring models
    // can arrive while the driver is already choosing a mode or district.
    loadTouring().then(() => {
      const preview = game.preview;
      if (preview && ui.vehicle.asset === "touring" && !preview.vehicle.userData.asset) {
        game.mountPreview(preview.host, ui.vehicle, ui.color);
      }
    }).catch(error => console.warn("Touring detail unavailable. Using the coupe model.", error));
  } catch (error) {
    showStartupError(error);
  }
}

boot();
