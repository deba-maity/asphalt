import { maps, modes, vehicles } from './data.js';

const stat = (label, value, color = 'cyan') => `<div class="stat"><span>${label}</span><i><b style="width:${value}%;--stat-color:${color}"></b></i><strong>${value}</strong></div>`;
const time = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function routePath(map) {
  const route = map.route;
  const xs = route.map(p => p[0]);
  const ys = route.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = 255 / Math.max(1, maxX - minX), sy = 135 / Math.max(1, maxY - minY);
  const points = route.map(([x, y]) => [22 + (x - minX) * sx, 24 + (y - minY) * sy]);
  const mid = (a, b) => [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
  const start = mid(points.at(-1), points[0]);
  const commands = [`M${start[0].toFixed(1)},${start[1].toFixed(1)}`];
  points.forEach((p, i) => {
    const m = mid(p, points[(i + 1) % points.length]);
    commands.push(`Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${m[0].toFixed(1)},${m[1].toFixed(1)}`);
  });
  return commands.join(' ') + ' Z';
}

function mapArt(map, large = false) {
  const palette = {
    neon: ['#57e9ff', '#9256ff', '#161c44'],
    coast: ['#53f1d0', '#2e8ec4', '#0e3945'],
    dock: ['#ffae65', '#d85a52', '#3a242a'],
    mesa: ['#ffd36a', '#d57543', '#48291f']
  }[map.id];
  const buildings = map.id === 'neon'
    ? '<g opacity=".92"><rect x="8" y="45" width="22" height="86" rx="2"/><rect x="35" y="70" width="16" height="61" rx="2"/><rect x="220" y="48" width="24" height="83" rx="2"/><rect x="251" y="68" width="18" height="63" rx="2"/><rect x="70" y="81" width="28" height="50" rx="2"/></g>'
    : map.id === 'dock'
      ? '<g opacity=".9"><rect x="12" y="84" width="45" height="48"/><rect x="66" y="69" width="37" height="63"/><rect x="190" y="76" width="50" height="56"/><path d="M117 28V129M106 41h44M130 41 160 14"/></g>'
      : map.id === 'coast'
        ? '<path d="M0 22 C50 44 50 8 102 31 S190 15 300 33V0H0Z"/><path d="M0 137 C52 120 75 143 123 126 S211 140 300 118V180H0Z"/>'
        : '<path d="M0 109 42 55 76 95 126 30 173 90 220 48 300 111V180H0Z"/><path d="M0 147 70 101 111 132 166 83 225 133 300 87V180H0Z" opacity=".75"/>';
  return `<div class="map-art ${large ? 'large' : ''} map-art-${map.id}" style="--map-a:${palette[0]};--map-b:${palette[1]};--map-c:${palette[2]}">
    <div class="map-art-glow"></div>
    <svg viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-${map.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[2]}"/><stop offset="1" stop-color="#05070f"/></linearGradient>
        <filter id="blur-${map.id}"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>
      <rect width="300" height="180" fill="url(#g-${map.id})"/>
      ${buildings}
      <path d="${routePath(map)}" fill="none" stroke="${palette[0]}" stroke-width="20" opacity=".12" filter="url(#blur-${map.id})"/>
      <path d="${routePath(map)}" fill="none" stroke="#07111c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${routePath(map)}" fill="none" stroke="${palette[0]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${22 + (map.route[0][0] - Math.min(...map.route.map(p => p[0]))) * (255 / Math.max(1, Math.max(...map.route.map(p => p[0])) - Math.min(...map.route.map(p => p[0]))))}" cy="24" r="5" fill="#fff"/>
    </svg>
    <div class="map-art-scan"></div>
    <div class="map-art-label"><span>SECTOR ${String(maps.findIndex(m => m.id === map.id) + 1).padStart(2, '0')}</span><b>${esc(map.tag)}</b></div>
  </div>`;
}

export class UI {
  constructor(app, game, network) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    app.append(this.root);
    this.game = game;
    this.network = network;
    this.mode = modes[0];
    this.map = maps[0];
    this.vehicle = vehicles[0];
    this.color = this.vehicle.color;
    this.networked = false;
    this.playerName = 'Driver';
    this.difficulty = 'medium';
    this.vehicleFilter = 'all';
    this.root.innerHTML = `<main id="menu-layer"></main><section id="hud" hidden><div class="hud-vignette"></div><div class="hud-top"><div class="wordmark small">NIGHTSHIFT<span>//</span></div><div class="objective-stack"><span id="objective">RACE // 3 LAPS</span><i class="route-progress"><b id="route-progress"></b></i></div><div id="timer">00:00.00</div></div><div id="countdown"></div><div id="event-feed"><b id="drive-state">HOLD THE LINE</b><span id="drive-detail">CHECKPOINT LINKED</span></div><div class="hud-bottom"><div class="mini-wrap"><canvas id="minimap" width="170" height="170"></canvas><span>ROUTE LINK</span><b>MAP</b></div><div class="readouts"><div class="speed-pod"><small>SPEED</small><strong id="speed">000</strong><em>KM/H</em></div><div class="meter"><label>NITRO CORE <b id="nitro-text">100</b></label><i><b id="nitro"></b></i><label class="armor">INTEGRITY <b id="health-text">100</b></label><i class="health"><b id="health"></b></i></div></div><div class="race-state"><b id="position">LAP 1 / 3</b><span id="checkpoint">CHECKPOINT 1</span><div id="wanted"></div></div></div></section><div id="toast"></div>`;
    this.layer = this.root.querySelector('#menu-layer');
    this.hud = this.root.querySelector('#hud');
    this.mini = this.root.querySelector('#minimap');
    this.bind();
    this.homeObserver = new MutationObserver(() => this.installHomeVehicle());
    this.homeObserver.observe(this.layer, { childList: true });
    this.showHome();
  }

  bind() {
    this.root.addEventListener('click', e => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      this.action(b.dataset.action, b.dataset);
    });
  }

  installHomeVehicle() {
    const host = this.layer.querySelector('.home-car');
    if (!host || host.querySelector('#home-vehicle')) return;
    host.insertAdjacentHTML('afterbegin', '<div id="home-vehicle"></div>');
    requestAnimationFrame(() => {
      const preview = this.root.querySelector('#home-vehicle');
      if (preview) this.game.mountPreview(preview, this.vehicle, this.color);
    });
  }

  action(action, data) {
    if (action === 'modes') this.showModes();
    if (action === 'garage') this.showVehicle(true);
    if (action === 'map') this.showMaps();
    if (action === 'choose-mode') { this.mode = modes.find(m => m.id === data.id) || modes[0]; this.networked = false; this.showMaps(); }
    if (action === 'choose-map') { this.map = maps.find(m => m.id === data.id) || maps[0]; this.showVehicle(); }
    if (action === 'choose-vehicle') { this.vehicle = vehicles.find(v => v.id === data.id) || vehicles[0]; this.color = this.vehicle.color; this.syncSetup(); this.showVehicle(); }
    if (action === 'filter-vehicles') { this.vehicleFilter = data.id || 'all'; this.showVehicle(data.garage === 'true'); }
    if (action === 'color') { this.color = data.color; this.syncSetup(); this.showVehicle(); }
    if (action === 'difficulty') { this.difficulty = data.id; this.showSettings(); }
    if (action === 'start') this.start();
    if (action === 'home') this.exitToHome();
    if (action === 'lobby') this.showLobby();
    if (action === 'join') this.joinLobby();
    if (action === 'lobby-start') this.start(true);
    if (action === 'settings') this.showSettings();
    if (action === 'back') this.showHome();
    if (action === 'rematch') { this.layer.innerHTML = ''; this.start(); }
    if (action === 'resume') this.game.togglePause();
  }

  shell(kicker, title, body, back = true) {
    this.layer.innerHTML = `<section class="screen panel-screen"><button class="back" data-action="${back ? 'back' : 'home'}">← BACK</button><div class="panel-head"><p>${kicker}</p><h1>${title}</h1></div>${body}</section>`;
  }

  showHome() {
    this.game.clearPreview();
    this.hud.hidden = true;
    this.layer.innerHTML = `<section class="home screen"><div class="grid-bg"></div><div class="home-ambient home-ambient-a"></div><div class="home-ambient home-ambient-b"></div><div class="home-copy"><p class="eyebrow">OPEN-WORLD PURSUIT // BUILD 02</p><h1 class="wordmark">NIGHTSHIFT<span>//</span></h1><p class="tagline">RACE THE CITY.<br><b>OUTRUN THE SIRENS.</b></p><div class="menu-actions"><button class="primary" data-action="modes">PLAY <i>→</i></button><button data-action="lobby">MULTIPLAYER <small>4 DRIVERS</small></button><button data-action="garage">GARAGE <small>23 VEHICLES</small></button><button data-action="settings">SETTINGS</button></div></div><div class="hero-copy"><span>FEATURED VEHICLE</span><strong>${esc(this.vehicle.name)}</strong><small>${esc(this.vehicle.type).toUpperCase()}</small></div><div class="home-car"><div class="silhouette"></div><div class="scanline"></div></div><div class="home-data"><span>4 DISTRICTS</span><span>23 VEHICLES</span><span>LOCAL / LAN</span></div></section>`;
  }

  showModes() {
    this.game.clearPreview();
    const cards = modes.map((m, i) => `<button class="mode-card ${i === 0 ? 'featured' : ''} mode-${m.id}" data-action="choose-mode" data-id="${m.id}"><span>0${i + 1}</span><h2>${esc(m.title)}</h2><p>${esc(m.detail)}</p><i>→</i><div class="mode-line"></div></button>`).join('');
    this.shell('SELECT OPERATION', 'What is the move?', `<div class="mode-grid">${cards}</div>`);
  }

  showMaps() {
    this.game.clearPreview();
    const selected = this.map?.id || 'neon';
    const cards = maps.map((m, i) => `<button class="map-card map-${m.id} ${selected === m.id ? 'selected' : ''}" data-action="choose-map" data-id="${m.id}">${mapArt(m)}<div class="map-card-copy"><span>ROUTE ${String(i + 1).padStart(2, '0')}</span><h2>${esc(m.name)}</h2><p>${esc(m.tag)}</p><div class="map-facts"><b>${m.route.length} CP</b><span>${m.straightSegments?.length || 0} SPRINTS</span><span>${m.shortcuts?.length || 0} CUTS</span></div></div><i class="map-arrow">↗</i></button>`).join('');
    this.shell(`${esc(this.mode.title).toUpperCase()} // ROUTE SELECT`, 'City routes', `<div class="map-selector"><div class="map-selector-head"><div><span>WORLD ATLAS</span><p>Pick a route by pace: straights for speed, cuts for risk, curves for handling.</p></div><div class="map-selected-label">${esc((maps.find(m => m.id === selected) || maps[0]).name).toUpperCase()}</div></div><div class="map-grid-premium">${cards}</div><div class="map-detail-strip"><div><small>SELECTED DISTRICT</small><b>${esc((maps.find(m => m.id === selected) || maps[0]).tag).toUpperCase()}</b></div><div><small>RACE ROUTE</small><b>${(maps.find(m => m.id === selected) || maps[0]).route.length} CHECKPOINTS / ${(maps.find(m => m.id === selected) || maps[0]).straightSegments?.length || 0} STRAIGHTS</b></div><div><small>ATMOSPHERE</small><b>${selected === 'neon' ? 'NEON NIGHT' : selected === 'coast' ? 'COASTAL DAWN' : selected === 'dock' ? 'INDUSTRIAL DUSK' : 'DESERT SUNSET'}</b></div></div></div>`);
  }

  showVehicle(garage = false) {
    const vehicle = this.vehicle;
    const filtered = vehicles.filter(v => this.vehicleFilter === 'all' || (this.vehicleFilter === 'cars' ? v.kind === 'car' : this.vehicleFilter === 'bikes' ? v.kind === 'bike' : this.vehicleFilter === 'monster' ? v.kind === 'monster' : v.kind === 'heavy'));
    if (!filtered.some(v => v.id === vehicle.id)) this.vehicleFilter = 'all';
    const visible = vehicles.filter(v => this.vehicleFilter === 'all' || (this.vehicleFilter === 'cars' ? v.kind === 'car' : this.vehicleFilter === 'bikes' ? v.kind === 'bike' : this.vehicleFilter === 'monster' ? v.kind === 'monster' : v.kind === 'heavy'));
    const filters = [['all', 'ALL'], ['cars', 'CARS'], ['bikes', 'BIKES'], ['monster', 'MONSTER'], ['heavy', 'ARMORED']].map(([id, label]) => `<button class="fleet-filter ${this.vehicleFilter === id ? 'active' : ''}" data-action="filter-vehicles" data-id="${id}" data-garage="${garage}">${label}</button>`).join('');
    const options = visible.map(v => `<button class="vehicle-chip-premium ${v.id === vehicle.id ? 'selected' : ''}" data-action="choose-vehicle" data-id="${v.id}"><span class="chip-orb ${v.kind}" style="--chip:${v.color}"></span><div><b>${esc(v.name)}</b><small>${esc(v.type)}</small></div><em>${Math.round((v.top + v.accel + v.handling + v.braking + v.boost) / 5)}</em></button>`).join('');
    const palette = ['#ff4b63', '#2de2e6', '#ffc857', '#9b7bff', '#f5f7ff', '#79e68c'].map(c => `<button class="swatch swatch-lg ${c === this.color ? 'active' : ''}" data-action="color" data-color="${c}" style="--color:${c}" aria-label="Paint ${c}"></button>`).join('');
    const rating = Math.round((vehicle.top + vehicle.accel + vehicle.handling + vehicle.braking + vehicle.armor + vehicle.boost) / 6);
    this.shell(garage ? 'GARAGE // FLEET' : 'SELECT VEHICLE', vehicle.name, `<div class="garage-modern"><div class="garage-hero"><div class="garage-hero-grid"></div><div class="preview-wrap premium-preview"><div id="vehicle-preview"></div><div class="preview-corner preview-corner-a">LIVE SHOWROOM</div><div class="preview-corner preview-corner-b">3D / 60 FPS TARGET</div><div class="vehicle-floor-lines"></div><div class="vehicle-type">${esc(vehicle.type).toUpperCase()}</div><div class="vehicle-hero-stamp"><small>RATING</small><b>${rating}</b><span>CLASS ${vehicle.kind === 'heavy' ? 'H' : vehicle.kind === 'bike' ? 'B' : 'A'}</span></div></div></div><aside class="vehicle-info-modern"><div class="vehicle-id-row"><span>VEHICLE ${vehicles.indexOf(vehicle) + 1}/${vehicles.length}</span><b>${vehicle.kind === 'heavy' ? 'HEAVY' : vehicle.kind === 'bike' ? 'BIKE' : 'CAR'}</b></div><h2>${esc(vehicle.name)}</h2><p class="vehicle-blurb">${esc(vehicle.type)} built for midnight routes. Tune the finish, then take the fastest line.</p><div class="stats stats-premium">${stat('TOP SPEED', vehicle.top)}${stat('ACCEL', vehicle.accel)}${stat('HANDLING', vehicle.handling)}${stat('BRAKING', vehicle.braking)}${stat('DURABILITY', vehicle.armor, 'pink')}${stat('NITRO', vehicle.boost, 'violet')}</div><div class="garage-control-row"><div><span>PAINT</span><div class="colors-premium">${palette}</div></div><button class="primary deploy-lg" data-action="${garage ? 'map' : 'start'}">${garage ? 'RACE SETUP' : 'DEPLOY'} <i>→</i></button></div></aside><div class="fleet-dock"><div class="fleet-head"><div><span>FLEET</span><p>Swipe, drag or use the wheel to browse.</p></div><div class="fleet-filters">${filters}</div></div><div class="vehicle-list-premium">${options}</div></div></div>`);
    requestAnimationFrame(() => this.game.mountPreview(this.root.querySelector('#vehicle-preview'), vehicle, this.color));
  }

  async joinLobby() {
    const code = this.root.querySelector('#room-code').value.trim() || 'NIGHT';
    const name = this.root.querySelector('#driver-name').value.trim() || 'Driver';
    this.playerName = name;
    this.networked = true;
    this.mode = modes[0];
    this.root.querySelector('.lobby-form')?.classList.add('loading');
    try { await this.network.connect({ room: code, name, vehicle: this.vehicle.name, color: this.color }); this.showJoinedLobby(); }
    catch (err) { this.toast(err.message); this.root.querySelector('.lobby-form')?.classList.remove('loading'); }
  }

  showLobby() { this.game.clearPreview(); this.shell('LOCAL NETWORK // UP TO 4 DRIVERS', 'Start a crew', `<div class="lobby-form"><label>DRIVER CALLSIGN<input id="driver-name" maxlength="14" value="${esc(this.playerName)}"></label><label>LOBBY CODE<input id="room-code" maxlength="8" value="NIGHT"></label><button class="primary" data-action="join">CONNECT <i>→</i></button><p>Share this code with drivers on the same network. The host machine runs the lobby server.</p></div>`); }

  showJoinedLobby() { this.game.clearPreview(); const players = this.network.players; this.shell(`LOBBY // ${this.network.room}`, 'Crew assembled', `<div class="lobby-view"><div id="player-slots">${this.playerSlots(players)}</div><div class="lobby-controls"><p>Connected drivers sync vehicle positions and race state over this local network.</p><button class="secondary" data-action="garage">CHANGE VEHICLE</button><button class="primary" data-action="lobby-start">START LAN RACE <i>→</i></button></div></div>`); this.network.on = msg => { if (msg.type === 'players') { this.network.players = msg.players; const slots = this.root.querySelector('#player-slots'); if (slots) slots.innerHTML = this.playerSlots(msg.players); } if (msg.type === 'position') this.game.remotePosition(msg.id, msg.data); if (msg.type === 'event' && msg.event?.type === 'finish') { if (msg.id !== this.network.id) this.game.remoteFinish(msg.event); this.toast(`${msg.event.title} — ${msg.event.time.toFixed(2)}s`); } if (msg.type === 'start' && msg.state.phase === 'countdown' && !this.game.running) { this.map = maps.find(m => m.id === msg.state.map) || this.map; this.start(true, true); } if (msg.type === 'error') this.toast(msg.message); }; }

  playerSlots(players) { const filled = players.map((p, i) => `<div class="player-slot"><span>0${i + 1}</span><div class="player-dot" style="--color:${p.color}"></div><b>${esc(p.name)}</b><small>${esc(p.vehicle)}</small></div>`); while (filled.length < 4) filled.push(`<div class="player-slot empty"><span>0${filled.length + 1}</span><b>WAITING FOR DRIVER</b></div>`); return filled.join(''); }
  syncSetup() { if (this.networked) this.network.updateSetup({ vehicle: this.vehicle.name, color: this.color, ready: true }); }
  start(lan = false, remoteStart = false) { this.game.clearPreview(); if (lan) { this.networked = true; if (!remoteStart) this.network.send({ type: 'start', mode: this.mode.id, map: this.map.id }); } this.layer.innerHTML = ''; this.hud.hidden = false; this.game.start({ mode: this.mode, map: this.map, vehicle: this.vehicle, color: this.color, difficulty: this.difficulty, networked: this.networked, network: this.networked ? this.network : null }); if (this.networked) this.game.setRemotePlayers(this.network.players); }
  exitToHome() { this.game.stop(); this.network.close(); this.networked = false; document.exitFullscreen?.().catch(() => {}); this.showHome(); }
  showSettings() { this.game.clearPreview(); const levels = ['easy', 'medium', 'hard'].map(d => `<button class="${this.difficulty === d ? 'active' : ''}" data-action="difficulty" data-id="${d}">${d.toUpperCase()}</button>`).join(''); this.shell('SETTINGS', 'Tune the night', `<div class="settings"><label>RENDER QUALITY <select><option>HIGH — BLOOM ENABLED</option><option>PERFORMANCE</option></select></label><label>AI DIFFICULTY <span class="difficulty-row">${levels}</span></label><label>CONTROL SCHEME <select><option>WASD / ARROW KEYS</option><option>GAMEPAD (AUTO-DETECT)</option></select></label><p>WASD / ARROWS to steer · SPACE handbrake · SHIFT nitro · F gun · R rocket · ESC pause</p></div>`); }
  showCountdown(value) { const node = this.root.querySelector('#countdown'); node.textContent = value; node.classList.toggle('visible', !!value); node.classList.toggle('go', value === 'GO!'); }
  setRunning(running) { if (!running) this.hud.hidden = true; }
  updateHUD(s) { if (this.hud.hidden) return; const pursuit = ['escape', 'versus', 'friend'].includes(this.mode.id); this.root.querySelector('#speed').textContent = String(s.speed).padStart(3, '0'); this.root.querySelector('#nitro').style.width = `${s.boost}%`; this.root.querySelector('#nitro-text').textContent = Math.round(s.boost); this.root.querySelector('#health').style.width = `${s.health}%`; this.root.querySelector('#health-text').textContent = Math.round(s.health); this.root.querySelector('#timer').textContent = time(s.time); this.root.querySelector('#position').textContent = this.mode.id === 'race' ? `${s.rank} / ${s.actors.filter(a => !a.police).length} • LAP ${Math.min(s.lap, 3)} / 3` : pursuit ? 'ESCAPE RUN' : 'TIME TRIAL'; this.root.querySelector('#checkpoint').textContent = `CHECKPOINT ${s.next} / ${s.total}`; this.root.querySelector('#objective').textContent = pursuit ? 'OUTRUN THE PURSUIT' : 'RACE // HOLD THE LINE'; this.root.querySelector('#wanted').innerHTML = s.wanted ? `<small>HEAT</small>${'<i>◆</i>'.repeat(s.wanted)}` : ''; const routeProgress = this.root.querySelector('#route-progress'); if (routeProgress) routeProgress.style.width = `${Math.max(3, Math.min(100, ((s.next - 1) / Math.max(1, s.total - 1)) * 100))}%`; this.drawMap(s); }
  drawMap(s) {
    const c = this.mini, ctx = c.getContext('2d'), route = s.map.route, w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(7,11,19,.82)';
    ctx.fillRect(0, 0, w, h);
    const maxExtent = Math.max(1, ...route.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
    const scale = (Math.min(w, h) * .42) / maxExtent, ox = w / 2, oy = h / 2;
    const point = p => [ox + p[0] * scale, oy + p[1] * scale];
    const mid = (a, b) => [(a[0] + b[0]) * .5, (a[1] + b[1]) * .5];
    const start = mid(point(route.at(-1)), point(route[0]));
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    route.forEach((p, i) => {
      const a = point(p);
      const b = mid(a, point(route[(i + 1) % route.length]));
      ctx.quadraticCurveTo(a[0], a[1], b[0], b[1]);
    });
    ctx.closePath();
    ctx.strokeStyle = s.map.accent;
    ctx.lineWidth = 7;
    ctx.globalAlpha = .16;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 3;
    ctx.strokeStyle = s.map.accent;
    ctx.stroke();
    route.forEach((p, i) => {
      const [x, y] = point(p);
      ctx.fillStyle = i === s.targetIndex ? '#ffffff' : '#4f9cb0';
      ctx.beginPath();
      ctx.arc(x, y, i === s.targetIndex ? 4 : 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (i === s.targetIndex) {
        ctx.strokeStyle = s.map.accent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });
    for (const a of s.actors) {
      const x = ox + a.mesh.position.x * scale, y = oy + a.mesh.position.z * scale;
      ctx.fillStyle = a === s.player ? '#fff' : a.police ? '#ff4861' : '#8898ae';
      ctx.beginPath();
      ctx.arc(x, y, a === s.player ? 4 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  result(data) { this.layer.innerHTML = `<section class="result screen"><p>OPERATION COMPLETE</p><h1>${esc(data.title)}</h1><div class="result-time">${time(data.time)}</div><span>${data.best ? `BEST ${time(data.best)} // ` : ''}${esc(data.mode).toUpperCase()}</span><div><button class="primary" data-action="rematch">RUN IT BACK <i>→</i></button><button data-action="home">MAIN MENU</button></div></section>`; }
  pause(paused) { if (!paused) { this.root.querySelector('.pause-overlay')?.remove(); return; } this.root.insertAdjacentHTML('beforeend', `<div class="pause-overlay"><p>PAUSED</p><button class="primary" data-action="resume">RESUME</button><button data-action="home">QUIT TO MENU</button></div>`); }
  toast(message) { const n = this.root.querySelector('#toast'); n.textContent = message; n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 3200); }
}
