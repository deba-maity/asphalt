import { storage } from "./storage.js";
import { raceTime as time } from "./timing.js";
import { coursePreview } from "./course-shape.js";
import { districtBest } from "./pace-lap.js";
import { gatesPerSegment, maps, modes, vehicles } from "./data.js";

const stat = (label, value, color = "cyan", pct = value) =>
  `<div class="stat"><span>${label}</span><i><b style="width:${Math.max(0, Math.min(100, pct))}%;--stat-color:${color}"></b></i><strong>${value}</strong></div>`;
const QUALITY_LABELS = {
  battery: "BATTERY SAVER · 30 FPS",
  balanced: "BALANCED · 60 FPS",
  quality: "HIGH FIDELITY · 60 FPS",
};

function signedSeconds(value) { return (value < 0 ? "−" : "+") + Math.abs(value).toFixed(2) + "s"; }

function esc(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function mapArt(map, large = false) {
  const preview = coursePreview(map);
  const palette = {
    neon: ["#57e9ff", "#9256ff", "#161c44"],
    coast: ["#53f1d0", "#2e8ec4", "#0e3945"],
    dock: ["#ffae65", "#d85a52", "#3a242a"],
    mesa: ["#ffd36a", "#d57543", "#48291f"],
  }[map.id];
  const buildings =
    map.id === "neon"
      ? '<g opacity=".92"><rect x="8" y="45" width="22" height="86" rx="2"/><rect x="35" y="70" width="16" height="61" rx="2"/><rect x="220" y="48" width="24" height="83" rx="2"/><rect x="251" y="68" width="18" height="63" rx="2"/><rect x="70" y="81" width="28" height="50" rx="2"/></g>'
      : map.id === "dock"
        ? '<g opacity=".9"><rect x="12" y="84" width="45" height="48"/><rect x="66" y="69" width="37" height="63"/><rect x="190" y="76" width="50" height="56"/><path d="M117 28V129M106 41h44M130 41 160 14"/></g>'
        : map.id === "coast"
          ? '<path d="M0 22 C50 44 50 8 102 31 S190 15 300 33V0H0Z"/><path d="M0 137 C52 120 75 143 123 126 S211 140 300 118V180H0Z"/>'
          : '<path d="M0 109 42 55 76 95 126 30 173 90 220 48 300 111V180H0Z"/><path d="M0 147 70 101 111 132 166 83 225 133 300 87V180H0Z" opacity=".75"/>';
  return `<div class="map-art ${large ? "large" : ""} map-art-${map.id}" style="--map-a:${palette[0]};--map-b:${palette[1]};--map-c:${palette[2]}">
    <div class="map-art-glow"></div>
    <svg viewBox="0 0 300 180" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="g-${map.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[2]}"/><stop offset="1" stop-color="#05070f"/></linearGradient>
        <filter id="blur-${map.id}"><feGaussianBlur stdDeviation="8"/></filter>
      </defs>
      <rect width="300" height="180" fill="url(#g-${map.id})"/>
      ${buildings}
      <path d="${preview.circuit}" fill="none" stroke="${palette[0]}" stroke-width="20" opacity=".12" filter="url(#blur-${map.id})"/>
      <path d="${preview.circuit}" fill="none" stroke="#07111c" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${preview.circuit}" fill="none" stroke="${palette[0]}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${preview.cuts.map((path) => `<path d="${path}" fill="none" stroke="#ffc373" stroke-width="1.5" stroke-dasharray="3 2"/>`).join("")}
      <circle cx="${preview.start[0]}" cy="${preview.start[1]}" r="3.6" fill="#fff" stroke="#141d26" stroke-width="1.2"/>
    </svg>
    <div class="map-art-scan"></div>
    <div class="map-art-label"><span>SECTOR ${String(maps.findIndex((m) => m.id === map.id) + 1).padStart(2, "0")}</span><b>${esc(map.tag)}</b></div>
  </div>`;
}

export class UI {
  constructor(app, game, network) {
    this.root = document.createElement("div");
    this.root.id = "ui-root";
    app.append(this.root);
    this.game = game;
    this.network = network;
    this.mode = modes[0];
    this.map = maps[0];
    this.vehicle = vehicles[0];
    this.color = this.vehicle.color;
    this.networked = false;
    this.playerName = "Driver";
    this.difficulty = "medium";
    this.vehicleFilter = "all";
    this.root.innerHTML = `<main id="menu-layer"></main><section id="hud" hidden><div class="hud-vignette"></div><div class="hud-top"><div class="wordmark small">NIGHTSHIFT<span>//</span></div><div class="objective-stack"><span id="objective">RACE // 3 LAPS</span><i class="route-progress"><b id="route-progress"></b></i></div><div class="race-tools"><div class="timing-stack"><div id="timer">00:00.00</div><span id="pace-note" hidden></span></div><button class="pause-button" data-action="pause" aria-label="Pause race">Ⅱ</button></div></div><div id="countdown"></div><div id="event-feed"><b id="drive-state">HOLD THE LINE</b><span id="drive-detail">CHECKPOINT LINKED</span></div><div class="hud-bottom"><div class="mini-wrap"><canvas id="minimap" width="170" height="170"></canvas><span>ROUTE LINK</span><b>MAP</b></div><div class="readouts"><div class="speed-pod"><small>SPEED</small><strong id="speed">000</strong><em>KM/H</em></div><div class="meter"><label>NITRO CORE <b id="nitro-text">100</b></label><i><b id="nitro"></b></i><label class="armor">INTEGRITY <b id="health-text">100</b></label><i class="health"><b id="health"></b></i></div></div><div class="race-state"><b id="position">LAP 1 / 3</b><span id="checkpoint">CHECKPOINT 1</span><div id="wanted"></div></div></div><div class="touch-controls" aria-label="Driving controls"><div class="touch-steering"><button data-drive="KeyA" aria-label="Steer left">❮</button><button data-drive="KeyD" aria-label="Steer right">❯</button></div><div class="touch-weapons"><button data-drive="KeyF" aria-label="Fire gun">FIRE</button><button data-drive="KeyR" aria-label="Launch rocket">ROCKET</button></div><div class="touch-pedals"><button class="touch-nitro" data-drive="ShiftLeft" aria-label="Use nitro">N₂O</button><button data-drive="Space" aria-label="Drift">DRIFT</button><button data-drive="KeyS" aria-label="Brake and reverse">BRAKE</button><button class="touch-gas" data-drive="KeyW" aria-label="Accelerate">GAS</button></div></div></section><div id="toast"></div>`;
    this.layer = this.root.querySelector("#menu-layer");
    this.hud = this.root.querySelector("#hud");
    this.mini = this.root.querySelector("#minimap");
    this.bind();
    this.bindDriving();
    this.homeObserver = new MutationObserver(() => this.installHomeVehicle());
    this.homeObserver.observe(this.layer, { childList: true });
    this.showHome();
  }

  bind() {
    this.root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      this.action(b.dataset.action, b.dataset);
    });
  }

  installHomeVehicle() {
    const host = this.layer.querySelector(".home-car");
    if (!host || host.querySelector("#home-vehicle")) return;
    host.insertAdjacentHTML("afterbegin", '<div id="home-vehicle"></div>');
    requestAnimationFrame(() => {
      const preview = this.root.querySelector("#home-vehicle");
      if (preview) this.game.mountPreview(preview, this.vehicle, this.color);
    });
  }

  action(action, data) {
    if (action === "pause") this.game.togglePause();
    if (action === "quality") {
      this.game.applyQuality(data.id);
      this.showSettings();
    }
    if (action === "modes") this.showModes();
    if (action === "garage") this.showVehicle(true);
    if (action === "map") this.showMaps();
    if (action === "choose-mode") {
      this.mode = modes.find((m) => m.id === data.id) || modes[0];
      this.networked = false;
      this.showMaps();
    }
    if (action === "choose-map") {
      this.map = maps.find((m) => m.id === data.id) || maps[0];
      this.showVehicle();
    }
    if (action === "choose-vehicle") {
      this.vehicle = vehicles.find((v) => v.id === data.id) || vehicles[0];
      this.color = this.vehicle.color;
      this.syncSetup();
      this.showVehicle(this.inGarage);
    }
    if (action === "filter-vehicles") {
      this.vehicleFilter = data.id || "all";
      this.showVehicle(data.garage === "true");
    }
    if (action === "color") {
      this.color = data.color;
      this.syncSetup();
      this.showVehicle(this.inGarage);
    }
    if (action === "difficulty") {
      this.difficulty = data.id;
      this.showSettings();
    }
    if (action === "start" || (action === "restart-solo" && this.game.paused && !this.networked)) this.start();
    if (action === "home") this.exitToHome();
    if (action === "lobby") this.showLobby();
    if (action === "join") this.joinLobby();
    if (action === "lobby-start") this.start(true);
    if (action === "settings") this.showSettings();
    if (action === "back") {
      if (this.networked && this.network.id) this.showJoinedLobby();
      else this.showHome();
    }
    if (action === "rematch") {
      this.start();
    }
    if (action === "resume") this.game.togglePause();
    if (action === "recover") this.game.returnToCheckpoint();
  }

  shell(kicker, title, body, back = true) {
    this.layer.innerHTML = `<section class="screen panel-screen"><button class="back" data-action="${back ? "back" : "home"}">← BACK</button><div class="panel-head"><p>${kicker}</p><h1>${title}</h1></div>${body}</section>`;
  }

  showHome() {
    this.network.close();
    this.networked=false;
    this.game.clearPreview();
    this.root.querySelector(".pause-overlay")?.remove();
    this.hud.hidden = true;
    this.layer.innerHTML = `<section class="home screen"><div class="home-topline"><a class="studio-mark" href="#" aria-label="Nightshift home">N<span>//</span></a><span>THE STREETS ARE YOURS</span><button data-action="settings" aria-label="Open settings">⚙ <span>SETTINGS</span></button></div><div class="home-car"><div class="silhouette"></div></div><div class="home-copy"><p class="eyebrow"><i></i> AFTER HOURS. NO LIMITS.</p><h1 class="wordmark">NIGHT<br>SHIFT<span>//</span></h1><p class="tagline">Chase the horizon.<br><b>Lose the pursuit.</b></p><div class="menu-actions"><button class="primary" data-action="modes">HIT THE STREETS <i>↗</i></button><div class="home-secondary"><button data-action="garage">GARAGE <small>${vehicles.length} RIDES</small></button><button data-action="lobby">CREW UP <small>LOCAL / LAN</small></button></div></div></div><div class="hero-copy"><span>IN YOUR GARAGE / 01</span><strong>${esc(this.vehicle.name)}</strong><small>${esc(this.vehicle.type).toUpperCase()} <b>↗</b></small></div><div class="home-data"><span><b>04</b> DISTINCT DISTRICTS</span><span><b>${vehicles.length}</b> WAYS TO ESCAPE</span><span class="power-label"><i></i> ${QUALITY_LABELS[this.game.qualityMode]}</span></div><span class="home-coordinate">40°43′ N &nbsp; 73°59′ W &nbsp; // &nbsp; MIDNIGHT RUN</span></section>`;
  }

  showModes() {
    this.game.clearPreview();
    const cards = modes
      .map(
        (m, i) =>
          `<button class="mode-card ${i === 0 ? "featured" : ""} mode-${m.id}" data-action="choose-mode" data-id="${m.id}"><span>0${i + 1}</span><h2>${esc(m.title)}</h2><p>${esc(m.detail)}</p><i>→</i><div class="mode-line"></div></button>`,
      )
      .join("");
    this.shell(
      "SELECT OPERATION",
      "What is the move?",
      `<div class="mode-grid">${cards}</div>`,
    );
  }

  showMaps() {
    this.game.clearPreview();
    const selected = this.map?.id || "neon";
    const cards = maps
      .map(
        (m, i) =>
          `<button class="map-card map-${m.id} ${selected === m.id ? "selected" : ""}" data-action="choose-map" data-id="${m.id}">${mapArt(m)}<div class="map-card-copy"><span>ROUTE ${String(i + 1).padStart(2, "0")}</span><h2>${esc(m.name)}</h2><p>${esc(m.tag)}</p><div class="map-facts"><b>${m.route.length * gatesPerSegment} GATES</b><span>${m.straightSegments?.length || 0} SPRINTS</span><span>${m.shortcuts?.length || 0} CUTS</span></div>${this.mode.id === "time" && districtBest(m.id) ? `<small class="map-best">BEST ${time(districtBest(m.id))}</small>` : ""}</div><i class="map-arrow">↗</i></button>`,
      )
      .join("");
    this.shell(
      `${esc(this.mode.title).toUpperCase()} // ROUTE SELECT`,
      "City routes",
      `<div class="map-selector"><div class="map-selector-head"><div><span>WORLD ATLAS</span><p>Green arrows trace the circuit. Amber arrows mark optional shortcuts that rejoin it.</p></div><div class="map-selected-label">${esc((maps.find((m) => m.id === selected) || maps[0]).name).toUpperCase()}</div></div><div class="map-grid-premium">${cards}</div><div class="map-detail-strip"><div><small>SELECTED DISTRICT</small><b>${esc((maps.find((m) => m.id === selected) || maps[0]).tag).toUpperCase()}</b></div><div><small>RACE ROUTE</small><b>${(maps.find((m) => m.id === selected) || maps[0]).route.length * gatesPerSegment} GATES / ${(maps.find((m) => m.id === selected) || maps[0]).straightSegments?.length || 0} STRAIGHTS</b></div><div><small>ATMOSPHERE</small><b>${selected === "neon" ? "NEON NIGHT" : selected === "coast" ? "COASTAL DAWN" : selected === "dock" ? "INDUSTRIAL DUSK" : "DESERT SUNSET"}</b></div></div></div>`,
    );
  }

  showVehicle(garage = false) {
    this.inGarage = garage;
    const vehicle = this.vehicle;
    const filtered = vehicles.filter(
      (v) =>
        this.vehicleFilter === "all" ||
        (this.vehicleFilter === "cars"
          ? v.kind === "car"
          : this.vehicleFilter === "bikes"
            ? v.kind === "bike"
            : this.vehicleFilter === "monster"
              ? v.kind === "monster"
              : v.kind === "heavy"),
    );
    if (!filtered.some((v) => v.id === vehicle.id)) this.vehicleFilter = "all";
    const visible = vehicles.filter(
      (v) =>
        this.vehicleFilter === "all" ||
        (this.vehicleFilter === "cars"
          ? v.kind === "car"
          : this.vehicleFilter === "bikes"
            ? v.kind === "bike"
            : this.vehicleFilter === "monster"
              ? v.kind === "monster"
              : v.kind === "heavy"),
    );
    const filters = [
      ["all", "ALL"],
      ["cars", "CARS"],
      ["bikes", "BIKES"],
      ["monster", "MONSTER"],
      ["heavy", "ARMORED"],
    ]
      .map(
        ([id, label]) =>
          `<button class="fleet-filter ${this.vehicleFilter === id ? "active" : ""}" data-action="filter-vehicles" data-id="${id}" data-garage="${garage}">${label}</button>`,
      )
      .join("");
    const perfRating = (v) =>
      Math.round((v.top + v.accel + v.handling + v.braking + v.boost) / 5);
    const options = visible
      .map(
        (v) =>
          `<button class="vehicle-chip-premium ${v.id === vehicle.id ? "selected" : ""}" data-action="choose-vehicle" data-id="${v.id}"><span class="vehicle-thumbnail ${v.kind}" style="--chip:${v.color}">${this.vehicleIcon(v)}</span><div><b>${esc(v.name)}</b><small>${esc(v.type)} / ${v.maxSpeed || Math.round(v.top * 3.2)} KM/H</small></div><em>${perfRating(v)}</em></button>`,
      )
      .join("");
    const palette = [
      "#ff4b63",
      "#2de2e6",
      "#ffc857",
      "#9b7bff",
      "#f5f7ff",
      "#79e68c",
    ]
      .map(
        (c) =>
          `<button class="swatch swatch-lg ${c === this.color ? "active" : ""}" data-action="color" data-color="${c}" style="--color:${c}" aria-label="Paint ${c}"></button>`,
      )
      .join("");
    const rating = Math.round(
      (vehicle.top +
        vehicle.accel +
        vehicle.handling +
        vehicle.braking +
        vehicle.armor +
        vehicle.boost) /
        6,
    );
    const maxSpeed = vehicle.maxSpeed || Math.round(vehicle.top * 3.2);
    this.shell(
      garage ? "GARAGE // FLEET" : "SELECT VEHICLE",
      vehicle.name,
      `<div class="garage-modern"><div class="garage-hero"><div class="garage-hero-grid"></div><div class="preview-wrap premium-preview"><div id="vehicle-preview"></div><div class="preview-corner preview-corner-a">DRAG TO ROTATE</div><div class="preview-corner preview-corner-b">DESIGNED TO DRIVE</div><div class="vehicle-floor-lines"></div><div class="vehicle-type">${esc(vehicle.type).toUpperCase()}</div><div class="vehicle-hero-stamp"><small>RATING</small><b>${rating}</b><span>CLASS ${vehicle.kind === "heavy" ? "H" : vehicle.kind === "bike" ? "B" : "A"}</span></div></div></div><aside class="vehicle-info-modern"><div class="vehicle-id-row"><span>VEHICLE ${vehicles.indexOf(vehicle) + 1}/${vehicles.length}</span><b>${vehicle.kind === "heavy" ? "HEAVY" : vehicle.kind === "bike" ? "BIKE" : "CAR"}</b></div><h2>${esc(vehicle.name)}</h2><p class="vehicle-blurb">${esc(vehicle.type)} built for midnight routes. Tune the finish, then take the fastest line.</p><div class="stats stats-premium">${stat("MAX KM/H", maxSpeed, "cyan", vehicle.top)}${stat("ACCEL", vehicle.accel)}${stat("HANDLING", vehicle.handling)}${stat("BRAKING", vehicle.braking)}${stat("DURABILITY", vehicle.armor, "pink")}${stat("NITRO", vehicle.boost, "violet")}</div><div class="garage-control-row"><div><span>PAINT</span><div class="colors-premium">${palette}</div></div><button class="primary deploy-lg" data-action="${garage ? (this.networked ? "back" : "map") : "start"}">${garage ? (this.networked ? "RETURN TO CREW" : "RACE SETUP") : "DEPLOY"} <i>→</i></button></div></aside><div class="fleet-dock"><div class="fleet-head"><div><span>FLEET</span><p>Swipe, drag or use the wheel to browse.</p></div><div class="fleet-filters">${filters}</div></div><div class="vehicle-list-premium">${options}</div></div></div>`,
    );
    requestAnimationFrame(() =>
      this.game.mountPreview(
        this.root.querySelector("#vehicle-preview"),
        vehicle,
        this.color,
      ),
    );
  }

  async joinLobby() {
    const code = this.root.querySelector("#room-code").value.trim() || "NIGHT";
    const name =
      this.root.querySelector("#driver-name").value.trim() || "Driver";
    this.playerName = name;
    this.networked = true;
    this.root.querySelector(".lobby-form")?.classList.add("loading");
    try {
      await this.network.connect({
        room: code,
        name,
        vehicle: this.vehicle.name,
        color: this.color,
      });
      this.showJoinedLobby();
    } catch (err) {
      this.toast(err.message);
      this.root.querySelector(".lobby-form")?.classList.remove("loading");
    }
  }

  showLobby() {
    this.game.clearPreview();
    this.shell(
      "LOCAL NETWORK // UP TO 4 DRIVERS",
      "Start a crew",
      `<div class="lobby-form"><label>DRIVER CALLSIGN<input id="driver-name" maxlength="14" value="${esc(this.playerName)}"></label><label>LOBBY CODE<input id="room-code" maxlength="8" value="NIGHT"></label><button class="primary" data-action="join">CONNECT <i>→</i></button><p>Share this code with drivers on the same network. The host machine runs the lobby server.</p></div>`,
      false,
    );
  }

  crewSetup() {
    if (this.network.host !== this.network.id)
      return "<p>The host chooses the route and mode. You can change your vehicle while waiting.</p>";
    const options=(items,selected,label)=>items.map(item=>
      `<option value="${item.id}" ${item.id===selected?'selected':''}>${esc(item[label])}</option>`).join('');
    return `<label>ROUTE<select id="lobby-map">${options(maps,this.map.id,'name')}</select></label><label>MODE<select id="lobby-mode">${options(modes,this.mode.id,'title')}</select></label>`;
  }

  showJoinedLobby() {
    this.game.clearPreview();
    const players = this.network.players;
    this.shell(
      `LOBBY // ${this.network.room}`,
      "Crew assembled",
      `<div class="lobby-view"><div id="player-slots">${this.playerSlots(players)}</div><div class="lobby-controls"><p>Connected drivers sync vehicle positions and race state over this local network. The first connected driver is the crew host.</p><div id="crew-setup" class="settings" data-host="${esc(this.network.host||'')}">${this.crewSetup()}</div><button class="secondary" data-action="garage">CHANGE VEHICLE</button><button class="primary" data-action="lobby-start" ${this.network.host===this.network.id?'':'disabled'}>${this.network.host===this.network.id?'START LAN RACE':'WAITING FOR HOST'} <i>→</i></button></div></div>`,
      false,
    );
    this.network.on = (msg) => {
      if (msg.type === "players") {
        this.network.players = msg.players;
        const slots = this.root.querySelector("#player-slots");
        if (slots) slots.innerHTML = this.playerSlots(msg.players);
        const start=this.root.querySelector('[data-action="lobby-start"]');
        if(start) { start.disabled=this.network.host!==this.network.id; start.textContent=start.disabled?'WAITING FOR HOST':'START LAN RACE →'; }
        const setup=this.root.querySelector('#crew-setup');
        if(setup && setup.dataset.host!==this.network.host) {
          setup.innerHTML=this.crewSetup();setup.dataset.host=this.network.host;
        }
        if(this.game.running) this.game.setRemotePlayers(msg.players);
      }
      if (msg.type === "position") this.game.remotePosition(msg.id, msg.data);
      if (msg.type === "event" && msg.event?.type === "finish") {
        if (msg.id !== this.network.id) this.game.remoteFinish(msg.event, msg.id);
        this.toast(`${msg.event.title} — ${msg.event.time.toFixed(2)}s`);
      }
      if (
        msg.type === "start" &&
        msg.state.phase === "countdown" &&
        (!this.game.running || this.game.phase==="finished")
      ) {
        this.map = maps.find((m) => m.id === msg.state.map) || this.map;
        this.mode = modes.find((m) => m.id === msg.state.mode) || this.mode;
        this.start(true, true);
      }
      if (msg.type === "error") this.toast(msg.message);
      if (msg.type === "closed") {
        this.networked=false;
        if(this.game.config) this.game.config.network=null;
        this.toast("Crew connection closed. You can continue offline or return home.");
      }
    };
  }

  playerSlots(players) {
    const filled = players.map(
      (p, i) =>
        `<div class="player-slot"><span>0${i + 1}</span><div class="player-dot" style="--color:${/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#ffffff'}"></div><b>${esc(p.name)}</b><small>${esc(p.vehicle)}</small></div>`,
    );
    while (filled.length < 4)
      filled.push(
        `<div class="player-slot empty"><span>0${filled.length + 1}</span><b>WAITING FOR DRIVER</b></div>`,
      );
    return filled.join("");
  }
  syncSetup() {
    if (this.networked)
      this.network.updateSetup({
        vehicle: this.vehicle.name,
        color: this.color,
        ready: true,
      });
  }
  start(lan = false, remoteStart = false) {
    lan=lan || (this.networked && !!this.network.id);
    if (lan) {
      this.networked = true;
      if (!remoteStart) {
        if(this.network.host!==this.network.id) { this.toast("The crew host starts the race."); return; }
        this.network.send({
          type: "start",
          mode: this.mode.id,
          map: this.map.id,
        });
        return; // All clients start from the same server acknowledgement.
      }
    }
    this.releaseDriving?.();
    this.game.clearPreview();
    this.layer.innerHTML = "";
    this.root.querySelector(".pause-overlay")?.remove();
    this.hud.hidden = false;
    this.root.classList.toggle("manual-gas", !this.game.autoAccelerate);
    this.game.start({
      mode: this.mode,
      map: this.map,
      vehicle: this.vehicle,
      color: this.color,
      difficulty: this.difficulty,
      networked: this.networked,
      network: this.networked ? this.network : null,
    });
    this.game.touch.active = matchMedia("(pointer: coarse)").matches;
    if (this.networked) this.game.setRemotePlayers(this.network.players);
  }
  exitToHome() {
    this.routeMap = null;
    this.releaseDriving?.();
    this.game.stop();
    this.root.querySelector(".pause-overlay")?.remove();
    this.network.close();
    this.networked = false;
    document.exitFullscreen?.().catch(() => {});
    this.showHome();
  }
  showSettings() {
    this.game.clearPreview();
    const levels = ["easy", "medium", "hard"]
      .map(
        (d) =>
          `<button class="${this.difficulty === d ? "active" : ""}" data-action="difficulty" data-id="${d}">${d.toUpperCase()}</button>`,
      )
      .join("");
    const profiles = Object.entries(QUALITY_LABELS)
      .map(
        ([id, label]) =>
          `<option value="${id}" ${this.game.qualityMode === id ? "selected" : ""}>${label}</option>`,
      )
      .join("");
    this.shell(
      "MAKE IT YOURS",
      "Your way. Your pace.",
      `<div class="settings settings-modern"><label>PERFORMANCE<select id="quality-mode">${profiles}</select><small>Battery saver limits frames and resolution for longer sessions. Balanced is the everyday setting. High fidelity adds resolution.</small></label><label>AI DIFFICULTY<span class="difficulty-row">${levels}</span></label><label class="setting-toggle"><span>AUTO ACCELERATE<small>On touchscreens, focus on steering. Brake and drift override the throttle.</small></span><input type="checkbox" id="auto-accelerate" ${this.game.autoAccelerate ? "checked" : ""}></label><label class="setting-toggle"><span>TIME TRIAL GHOST<small>Race your fastest recorded lap in each district.</small></span><input type="checkbox" id="pace-ghost" ${storage.getItem("nightshift-ghost") !== "false" ? "checked" : ""}></label><label class="setting-toggle"><span>REDUCED CAMERA MOTION<small>Steady field of view and no impact shake.</small></span><input type="checkbox" id="reduced-motion" ${this.game.reducedMotion ? "checked" : ""}></label><label class="setting-toggle"><span>ENGINE AUDIO<small>Engine, nitro and effects.</small></span><input type="checkbox" id="audio-enabled" ${this.game.audio.enabled ? "checked" : ""}></label><p><a href="credits.html" target="_blank" rel="noopener">Model credits &amp; licenses</a></p><div class="control-reference"><span>DESKTOP</span><p>WASD / arrows · steer & drive<br>Space · drift &nbsp; Shift · nitro<br>F · gun &nbsp; R · rocket &nbsp; Esc · pause</p><span>PHONE</span><p>Hold the steering arrows. Use drift, brake and nitro with your other thumb. Landscape gives you more room.</p></div></div>`,
    );
  }

  vehicleIcon(vehicle) {
    if (vehicle.kind === "bike")
      return `<svg viewBox="0 0 90 45" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="20" cy="32" r="10"/><circle cx="70" cy="32" r="10"/><path d="M20 32 34 15 55 15 70 32M34 15 45 31 60 23 55 10 64 8"/></g><path fill="var(--chip)" d="m28 15 14-8 15 5-4 9H33Z"/></svg>`;
    return `<svg viewBox="0 0 100 48" aria-hidden="true"><path fill="var(--chip)" d="m7 28 11-6 17-13 31 1 15 13 12 5v10H7Z"/><path fill="#111a22" d="m27 22 12-10h24l12 11Z"/><path fill="none" stroke="#d9fff3" stroke-width="2" d="M9 29h12m62 0h9"/><circle cx="27" cy="37" r="8" fill="#10171e"/><circle cx="76" cy="37" r="8" fill="#10171e"/><circle cx="27" cy="37" r="4" fill="#b7cbd0"/><circle cx="76" cy="37" r="4" fill="#b7cbd0"/></svg>`;
  }

  bindDriving() {
    this.root.addEventListener("change", (e) => {
      if (this.network.host===this.network.id) {
        if(e.target.id==='lobby-map') this.map=maps.find(m=>m.id===e.target.value)||this.map;
        if(e.target.id==='lobby-mode') this.mode=modes.find(m=>m.id===e.target.value)||this.mode;
      }
      if (e.target.id === "quality-mode") {
        this.game.applyQuality(e.target.value);
        this.toast("Performance setting saved");
      }
      if (e.target.id === "auto-accelerate") {
        this.game.autoAccelerate = e.target.checked;
        storage.setItem("nightshift-auto", e.target.checked);
        this.root.classList.toggle("manual-gas", !e.target.checked);
      }
      if (e.target.id === "pace-ghost") storage.setItem("nightshift-ghost", e.target.checked);
      if (e.target.id === "reduced-motion") {
        this.game.reducedMotion = e.target.checked;
        document.documentElement.classList.toggle('reduced-motion',e.target.checked);
        storage.setItem("nightshift-reduced-motion", e.target.checked);
      }
      if (e.target.id === "audio-enabled")
        this.game.audio.setEnabled(e.target.checked);
    });
    const held = new Map();
    const release = (e) => {
      const button = held.get(e.pointerId);
      if (!button) return;
      held.delete(e.pointerId);
      if ([...held.values()].includes(button)) return;
      button.classList.remove("held");
      this.game.touch[button.dataset.drive] = false;
    };
    this.releaseDriving = () => {
      for (const button of held.values()) {
        button.classList.remove("held");
        this.game.touch[button.dataset.drive] = false;
      }
      held.clear();
    };
    addEventListener("blur", this.releaseDriving);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseDriving();
    });
    this.root.addEventListener("pointerdown", (e) => {
      const button = e.target.closest("[data-drive]");
      if (!button || !this.game.running || this.game.paused) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      held.set(e.pointerId, button);
      button.classList.add("held");
      this.game.touch.active = true;
      this.game.touch[button.dataset.drive] = true;
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
      this.root.addEventListener(type, release);
    this.root.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".touch-controls")) e.preventDefault();
    });
  }

  showCountdown(value) {
    const node = this.root.querySelector("#countdown");
    node.textContent = value;
    node.classList.toggle("visible", !!value);
    node.classList.toggle("go", value === "GO!");
  }
  setRunning(running) {
    if (!running) { this.hud.hidden = true; this.routeMap = null; }
  }
  updateHUD(s) {
    if (this.hud.hidden) return;
    const pursuit = this.mode.id === "escape";
    const racing = ["race", "sprint"].includes(this.mode.id);
    const laps = this.mode.id === "sprint" ? 1 : 3;
    this.root.querySelector("#speed").textContent = String(s.speed).padStart(
      3,
      "0",
    );
    this.root.querySelector("#nitro").style.width = `${s.boost}%`;
    this.root.querySelector("#nitro-text").textContent = Math.round(s.boost);
    this.root.querySelector("#health").style.width = `${s.health}%`;
    this.root.querySelector("#health-text").textContent = Math.round(s.health);
    this.root.querySelector("#timer").textContent = time(s.time);
    const pace = this.root.querySelector("#pace-note");
    const split = s.pace?.lastSplit;
    const showSplit = split && s.time - split.seconds < 4;
    pace.hidden = !s.pace?.best;
    pace.dataset.ahead = showSplit ? String(split.delta < 0) : "";
    pace.textContent = showSplit ? "G" + split.index + "  " + signedSeconds(split.delta) + " VS PACE"
      : s.pace?.reference ? "PACE " + time(s.pace.reference.duration / 1000)
      : s.pace?.best ? "BEST " + time(s.pace.best) : "";
    this.root.querySelector("#position").textContent =
      racing
        ? `${s.rank} / ${s.fieldSize} • LAP ${Math.min(s.lap, laps)} / ${laps}`
        : pursuit
          ? "ESCAPE RUN"
          : this.mode.id === "cruise" ? "FREE DRIVE" : "TIME TRIAL";
    this.root.querySelector("#checkpoint").textContent =
      `CHECKPOINT ${s.next} / ${s.total}`;
    this.root.querySelector("#drive-state").textContent =
      s.cue?.label || "HOLD THE LINE";
    this.root.querySelector("#drive-detail").textContent =
      s.cue?.detail || `CHECKPOINT ${s.next} / ${s.total}`;
    this.root.querySelector("#objective").textContent = pursuit
      ? "OUTRUN THE PURSUIT"
      : this.mode.id === "cruise" ? "EXPLORE THE ROUTE"
      : this.mode.id === "time" ? "BEAT YOUR PERSONAL BEST"
      : s.winnerAhead ? "LEADER FINISHED // RACE TO THE LINE" : `${this.mode.title.toUpperCase()} // FOLLOW THE GREEN GATES`;
    if (this.lastWanted !== s.wanted) {
      this.root.querySelector("#wanted").innerHTML = s.wanted
        ? `<small>HEAT</small>${"<i>◆</i>".repeat(s.wanted)}`
        : "";
      this.lastWanted = s.wanted;
    }
    const routeProgress = this.root.querySelector("#route-progress");
    if (routeProgress)
      routeProgress.style.width = `${s.progress * 100}%`;
    this.drawMap(s);
  }
  mapBackground(world, width, height) {
    if (this.routeMap?.world === world && this.routeMap.canvas.width === width && this.routeMap.canvas.height === height) return this.routeMap;
    const paths = [world.samples, ...world.shortcutRoads.map((road) => road.points)];
    let extent = 1;
    for (const path of paths) for (const p of path) extent = Math.max(extent, Math.abs(p.x), Math.abs(p.z));
    const scale = Math.min(width, height) * .42 / extent;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(7,11,19,.82)";
    ctx.fillRect(0, 0, width, height);
    ctx.lineJoin = "round";
    paths.forEach((path, index) => {
      ctx.beginPath();
      path.forEach((p, i) => {
        const x = width / 2 + p.x * scale, y = height / 2 + p.z * scale;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (!index) ctx.closePath();
      ctx.setLineDash(index ? [2, 3] : []);
      ctx.lineWidth = index ? 1.2 : 3; ctx.strokeStyle = index ? "#a6adba" : "#63788b"; ctx.stroke();
    });
    this.routeMap = { world, canvas, scale };
    return this.routeMap;
  }
  drawMap(s) {
    const c = this.mini, ctx = c.getContext("2d"), world = this.game.world;
    const { canvas, scale } = this.mapBackground(world, c.width, c.height);
    const ox = c.width / 2, oy = c.height / 2;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0);
    const cut = s.player.cut;
    const target = cut ? cut.road.points[cut.gate] : world.gatePosition(s.targetIndex);
    const car = s.player.mesh.position;
    ctx.beginPath(); ctx.moveTo(ox + car.x * scale, oy + car.z * scale);
    const trace = (p) => ctx.lineTo(ox + p.x * scale, oy + p.z * scale);
    if (cut) {
      for (let i = cut.gate; i < cut.road.points.length; i++) trace(cut.road.points[i]);
    } else {
      const samples = world.samples;
      const stride = samples.length / world.route.length;
      const end = (s.targetIndex || world.route.length) * stride;
      let closest = end, best = Infinity;
      const last = s.targetIndex === 0 ? end + world.finishSamples : end;
      for (let i = end - stride; i <= last; i++) {
        const distance = car.distanceToSquared(samples[i % samples.length]);
        if (distance < best) { best = distance; closest = i; }
      }
      const limit = s.targetIndex === 0 && this.game.finalLap() ? last - 1 : end + 3 * stride;
      for (let i = closest; i <= limit; i++) trace(samples[i % samples.length]);
      if (s.targetIndex === 0 && this.game.finalLap()) trace(world.finishLine);
    }
    ctx.strokeStyle = "#65ffcb"; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.stroke();
    const start = world.finishLine;
    ctx.fillStyle = "#fff"; ctx.fillRect(ox + start.x * scale - 2, oy + start.z * scale - 2, 4, 4);
    ctx.beginPath(); ctx.arc(ox + target.x * scale, oy + target.z * scale, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#43e5ae"; ctx.lineWidth = 1.5; ctx.stroke();
    if (s.ghost) {
      const x = ox + s.ghost.x * scale, y = oy + s.ghost.z * scale;
      ctx.strokeStyle = "#d3b3ff"; ctx.lineWidth = 2;
      ctx.strokeRect(x - 3, y - 3, 6, 6);
    }
    for (const a of s.actors) {
      if (!a.mesh.visible) continue;
      const x = ox + a.mesh.position.x * scale,
        y = oy + a.mesh.position.z * scale;
      ctx.fillStyle =
        a === s.player ? "#d4ff6a" : a.police ? "#ff4861" : "#8898ae";
      ctx.save();
      ctx.translate(x, y);
      if (a === s.player) {
        ctx.rotate(-a.mesh.rotation.y);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(0, 3);
        ctx.lineTo(-4, 5);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }
  result(data) {
    this.releaseDriving?.();
    this.root.querySelector(".pause-overlay")?.remove();
    this.hud.hidden = true;
    const standings = data.standings ? `<ol class="classification" aria-label="Race standings">${data.standings.map((entry, index) =>
      `<li class="${entry.me ? "your-finish" : ""}"><span>${index + 1}</span><b>${esc(entry.name)}</b><span>${entry.time === null
        ? "LAP " + entry.lap : index === 0 ? time(entry.time) : "+" + (entry.time - data.standings[0].time).toFixed(2) + "s"}</span></li>`).join("")}</ol>` : "";
    const laps = data.laps?.length > 1 ? `<div class="lap-breakdown" aria-label="Lap times">${data.laps.map((value, i) =>
      `<span>LAP ${i + 1} <b>${time(value)}</b></span>`).join("")}</div>` : "";
    this.layer.innerHTML = `<section class="result screen"><p>${esc(this.map.name)}</p><h1>${esc(data.title)}</h1><div class="result-time">${time(data.time)}</div><span>${data.best ? `BEST ${time(data.best)} // ` : ""}${esc(data.mode).toUpperCase()}${data.delta != null ? " // " + signedSeconds(data.delta) + " VS BEST" : ""}</span>${standings}${laps}<div><button class="primary" data-action="rematch">RUN IT BACK <i>→</i></button><button data-action="home">MAIN MENU</button></div></section>`;
  }
  pause(paused) {
    this.releaseDriving?.();
    if (!paused) {
      this.root.querySelector(".pause-overlay")?.remove();
      return;
    }
    this.root.insertAdjacentHTML(
      "beforeend",
      `<div class="pause-overlay"><p>PAUSED</p><button class="primary" data-action="resume">RESUME</button>${this.game.phase === "play" ? '<button data-action="recover">RETURN TO LAST GATE</button>' : ""}${!this.networked ? '<button data-action="restart-solo">RESTART RUN</button>' : ""}<button data-action="home">QUIT TO MENU</button></div>`,
    );
  }
  toast(message) {
    const n = this.root.querySelector("#toast");
    n.textContent = message;
    n.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(() => n.classList.remove("show"), 3200);
  }
}
