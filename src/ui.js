import { lapChallengeLink, readLapChallenge } from "./lap-challenge.js";
import { shortcutMarkerIndex } from "./shortcut-guide.js";
import { bindMenuGamepad } from "./menu-gamepad.js";
import { storage } from "./storage.js";
import { raceTime as time } from "./timing.js";
import { captureFinishPhoto, saveFinishPhoto } from "./finish-photo.js";
import { coursePreview } from "./course-shape.js";
import { districtBest } from "./pace-lap.js";
import { raceRecord } from "./race-timing.js";
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

const districtPhotos = {
  neon: new URL("./districts/neon.webp", import.meta.url).href,
  coast: new URL("./districts/coast.webp", import.meta.url).href,
  dock: new URL("./districts/dock.webp", import.meta.url).href,
  mesa: new URL("./districts/mesa.webp", import.meta.url).href,
};

function mapArt(map) {
  const preview = coursePreview(map);
  return `<div class="map-art district-photo" aria-hidden="true">
    <img src="${districtPhotos[map.id]}" alt="" width="640" height="432" decoding="async">
    <svg class="district-plan" viewBox="12 14 276 150" preserveAspectRatio="xMidYMid meet">
      <path d="${preview.circuit}" fill="none" stroke="#061015" stroke-width="7" stroke-linejoin="round"/>
      <path d="${preview.circuit}" fill="none" stroke="${map.accent}" stroke-width="3.4" stroke-linejoin="round"/>
      ${preview.cuts.map(path => `<path d="${path}" fill="none" stroke="#ffbe77" stroke-width="2.4" stroke-dasharray="4 3"/>`).join("")}
      <circle cx="${preview.start[0]}" cy="${preview.start[1]}" r="4" fill="white" stroke="#142326" stroke-width="1.5"/>
    </svg>
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
    this.pagesHosted = location.hostname.endsWith(".github.io");
    this.lapTarget = null;
    this.mapBack = "modes";
    const savedDifficulty = storage.getItem("nightshift-difficulty");
    this.difficulty = ["easy", "medium", "hard"].includes(savedDifficulty) ? savedDifficulty : "medium";
    this.vehicleFilter = "all";
    this.root.innerHTML = `<main id="menu-layer"></main><section id="hud" hidden><div class="hud-vignette"></div><div class="hud-top"><div class="wordmark small">NIGHTSHIFT<span>//</span></div><div class="objective-stack"><span id="objective">RACE // 3 LAPS</span><i class="route-progress"><b id="route-progress"></b></i></div><div class="race-tools"><div class="timing-stack"><div id="timer">00:00.00</div><span id="pace-note" hidden></span></div><button class="pause-button" data-action="pause" aria-label="Pause race">Ⅱ</button></div></div><div id="countdown"></div><div id="event-feed"><b id="drive-state">HOLD THE LINE</b><span id="drive-detail">CHECKPOINT LINKED</span></div><div class="hud-bottom"><div class="mini-wrap"><canvas id="minimap" width="170" height="170"></canvas><span>ROUTE LINK</span><b>MAP</b></div><div class="readouts"><div class="speed-pod"><div class="rev-row"><span class="gear-indicator">GEAR <b id="current-gear">N</b></span><span class="shift-lights" aria-hidden="true"><i></i></span></div><span class="sr-only">Speed</span><strong id="speed">000</strong><em>KM/H</em></div><div class="meter"><label>NITRO CORE <b id="nitro-text">100</b></label><i><b id="nitro"></b></i><label class="armor">INTEGRITY <b id="health-text">100</b></label><i class="health"><b id="health"></b></i></div></div><div class="race-state"><b id="position">LAP 1 / 3</b><span id="checkpoint">CHECKPOINT 1</span><div id="wanted"></div></div></div><div class="touch-controls" aria-label="Driving controls"><div class="touch-steering"><button data-drive="KeyA" aria-label="Steer left">❮</button><button data-drive="KeyD" aria-label="Steer right">❯</button></div><div class="touch-weapons"><button data-drive="KeyF" aria-label="Fire gun">FIRE</button><button data-drive="KeyR" aria-label="Launch rocket">ROCKET</button></div><div class="touch-pedals"><button class="touch-nitro" data-drive="ShiftLeft" aria-label="Use nitro">N₂O</button><button data-drive="Space" aria-label="Drift">DRIFT</button><button data-drive="KeyS" aria-label="Brake and reverse">BRAKE</button><button class="touch-gas" data-drive="KeyW" aria-label="Accelerate">GAS</button></div></div></section><div id="toast" role="status" aria-live="polite"></div>`;
    this.layer = this.root.querySelector("#menu-layer");
    this.hud = this.root.querySelector("#hud");
    this.mini = this.root.querySelector("#minimap");
    this.bind();
    this.bindDriving();
    this.homeObserver = new MutationObserver(() => this.installHomeVehicle());
    this.homeObserver.observe(this.layer, { childList: true });
    this.openEntry();
    window.addEventListener("hashchange", () => {
      if (this.game.running) {
        if (readLapChallenge(location.hash)) this.toast("New challenge ready when you return to the menu");
      } else this.openEntry();
    });
    bindMenuGamepad(this.root, this.game);
  }

  bind() {
    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.repeat || event.defaultPrevented) return;
      if (event.target?.matches?.("select, input, textarea")) return;
      const back = this.layer.querySelector(".back");
      if (back) { event.preventDefault(); back.click(); }
    });
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
    if (action === "take-challenge") {
      const invite = readLapChallenge(location.hash);
      if (!invite) { this.exitToHome(); return; }
      this.lapTarget = invite;
      this.mode = modes.find(mode => mode.id === "time");
      this.map = invite.map;
      this.vehicle = invite.vehicle;
      this.color = invite.vehicle.color;
      this.networked = false;
      this.start();
    }
    if (action === "copy-lap") this.copyChallenge();
    if (action === "save-photo") {
      const photo = this.layer.querySelector(".finish-photo canvas");
      if (photo) saveFinishPhoto(photo, this.map.id);
    }
    if (action === "quality") {
      this.game.applyQuality(data.id);
      this.showSettings();
    }
    if (action === "modes") this.showModes();
    if (action === "garage") this.showVehicle(true);
    if (action === "map") this.showMaps();
    if (action === "garage-race-setup") {
      this.mapBack = "garage";
      this.showMaps();
    }
    if (action === "choose-mode") {
      this.mode = modes.find((m) => m.id === data.id) || modes[0];
      this.networked = false;
      this.mapBack = "modes";
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
      this.game.preview?.recolor(this.color);
      for (const swatch of this.layer.querySelectorAll('[data-action="color"]')) {
        const selected = swatch.dataset.color === this.color;
        swatch.classList.toggle("active", selected);
        swatch.setAttribute("aria-pressed", String(selected));
      }
    }
    if (action === "difficulty" && ["easy", "medium", "hard"].includes(data.id)) {
      this.difficulty = data.id;
      storage.setItem("nightshift-difficulty", data.id);
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

  shell(kicker, title, body, backAction = "home") {
    this.layer.innerHTML = `<section class="screen panel-screen"><button class="back" data-action="${backAction}">← BACK</button><div class="panel-head"><p>${kicker}</p><h1>${title}</h1></div>${body}</section>`;
  }

  openEntry() {
    const invite = readLapChallenge(location.hash);
    if (!invite) { this.showHome(); return; }
    this.network.close();
    this.networked = false;
    this.game.clearPreview();
    this.hud.hidden = true;
    this.shell("TIME TRIAL", "Beat " + time(invite.ticks / 100),
      `<div class="lap-invite"><h2>${esc(invite.map.name)}</h2><p>One lap in the ${esc(invite.vehicle.name)}. Cross the finish line before the target time.</p><button class="primary" data-action="take-challenge">RACE THIS LAP <i>→</i></button></div>`);
  }

  async copyChallenge() {
    const field = this.layer.querySelector("#lap-link");
    if (!field) return;
    try {
      await navigator.clipboard.writeText(field.value);
      if (field.isConnected) this.toast("Challenge link copied");
    } catch {
      if (!field.isConnected) return;
      field.hidden = false;
      field.focus();
      field.select();
      this.toast("Copy the selected challenge link");
    }
  }

  showHome() {
    this.lapTarget = null;
    this.network.close();
    this.networked=false;
    this.game.clearPreview();
    this.root.querySelector(".pause-overlay")?.remove();
    this.hud.hidden = true;
    this.layer.innerHTML = `<section class="home screen"><div class="home-topline"><a class="studio-mark" href="#" aria-label="Nightshift home">N<span>//</span></a><span>THE STREETS ARE YOURS</span><button data-action="settings" aria-label="Open settings">⚙ <span>SETTINGS</span></button></div><div class="home-car"><div class="silhouette"></div></div><div class="home-copy"><p class="eyebrow"><i></i> AFTER HOURS. NO LIMITS.</p><h1 class="wordmark">NIGHT<br>SHIFT<span>//</span></h1><p class="tagline">Chase the horizon.<br><b>Lose the pursuit.</b></p><div class="menu-actions"><button class="primary" data-action="modes">HIT THE STREETS <i>↗</i></button><div class="home-secondary"><button data-action="garage">GARAGE <small>${vehicles.length} RIDES</small></button><button data-action="lobby">${this.pagesHosted ? "RACE A FRIEND <small>TIME TRIAL</small>" : "CREW UP <small>LOCAL / LAN</small>"}</button></div></div></div><div class="hero-copy"><span>IN YOUR GARAGE / 01</span><strong>${esc(this.vehicle.name)}</strong><small>${esc(this.vehicle.type).toUpperCase()} <b>↗</b></small></div><div class="home-data"><span><b>04</b> DISTINCT DISTRICTS</span><span><b>${vehicles.length}</b> WAYS TO ESCAPE</span><span class="power-label"><i></i> ${QUALITY_LABELS[this.game.qualityMode]}</span></div><span class="home-coordinate">40°43′ N &nbsp; 73°59′ W &nbsp; // &nbsp; MIDNIGHT RUN</span></section>`;
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
        (m, i) => {
          const record = raceRecord(m.id, this.mode.id, this.difficulty);
          const best = this.mode.id === "time" ? districtBest(m.id) : record ? record.at(-1) / 1000 : null;
          return `<button class="map-card map-${m.id} ${selected === m.id ? "selected" : ""}" data-action="choose-map" data-id="${m.id}">${mapArt(m)}<div class="map-card-copy"><span>ROUTE ${String(i + 1).padStart(2, "0")}</span><h2>${esc(m.name)}</h2><p>${esc(m.tag)}</p><div class="map-facts"><b>${m.route.length * gatesPerSegment} GATES</b><span>${m.straightSegments?.length || 0} SPRINTS</span><span>${m.shortcuts?.length || 0} CUTS</span></div>${best ? `<small class="map-best">BEST ${time(best)}</small>` : ""}</div><i class="map-arrow">↗</i></button>`;
        },
      )
      .join("");
    this.shell(
      `${esc(this.mode.title).toUpperCase()} // ROUTE SELECT`,
      "City routes",
      `<div class="map-selector"><div class="map-selector-head"><div><label class="route-guide-choice">ROUTE GUIDE <select id="route-guide"><option value="main" ${!this.game.guideShortcuts ? "selected" : ""}>Main circuit</option><option value="cuts" ${this.game.guideShortcuts ? "selected" : ""}>Via shortcuts</option></select></label><p>Follow the green line. You can choose either road at a fork.</p></div></div><div class="map-grid-premium">${cards}</div><div class="map-detail-strip"><div><small>SELECTED DISTRICT</small><b>${esc((maps.find((m) => m.id === selected) || maps[0]).tag).toUpperCase()}</b></div><div><small>RACE ROUTE</small><b>${(maps.find((m) => m.id === selected) || maps[0]).route.length * gatesPerSegment} GATES / ${(maps.find((m) => m.id === selected) || maps[0]).straightSegments?.length || 0} STRAIGHTS</b></div><div><small>ATMOSPHERE</small><b>${selected === "neon" ? "NEON NIGHT" : selected === "coast" ? "COASTAL DAWN" : selected === "dock" ? "INDUSTRIAL DUSK" : "DESERT SUNSET"}</b></div></div></div>`,
      this.mapBack,
    );
  }

  showVehicle(garage = false) {
    this.inGarage = garage;
    const vehicle = this.vehicle;
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
          `<button class="swatch swatch-lg ${c === this.color ? "active" : ""}" data-action="color" data-color="${c}" aria-pressed="${c === this.color}" style="--color:${c}" aria-label="Paint ${c}"></button>`,
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
      `<div class="garage-modern"><div class="garage-hero"><div class="garage-hero-grid"></div><div class="preview-wrap premium-preview"><div id="vehicle-preview"></div><div class="preview-corner preview-corner-a">DRAG TO ROTATE</div><div class="preview-corner preview-corner-b">DESIGNED TO DRIVE</div><div class="vehicle-floor-lines"></div><div class="vehicle-type">${esc(vehicle.type).toUpperCase()}</div><div class="vehicle-hero-stamp"><small>RATING</small><b>${rating}</b><span>CLASS ${vehicle.kind === "heavy" ? "H" : vehicle.kind === "bike" ? "B" : "A"}</span></div></div></div><aside class="vehicle-info-modern"><div class="vehicle-id-row"><span>VEHICLE ${vehicles.indexOf(vehicle) + 1}/${vehicles.length}</span><b>${vehicle.kind === "heavy" ? "HEAVY" : vehicle.kind === "bike" ? "BIKE" : "CAR"}</b></div><h2>${esc(vehicle.name)}</h2><p class="vehicle-blurb">${esc(vehicle.type)} built for midnight routes. Tune the finish, then take the fastest line.</p><div class="stats stats-premium">${stat("MAX KM/H", maxSpeed, "cyan", vehicle.top)}${stat("ACCEL", vehicle.accel)}${stat("HANDLING", vehicle.handling)}${stat("BRAKING", vehicle.braking)}${stat("DURABILITY", vehicle.armor, "pink")}${stat("NITRO", vehicle.boost, "violet")}</div><div class="garage-control-row"><div><span>PAINT</span><div class="colors-premium">${palette}</div></div><button class="primary deploy-lg" data-action="${garage ? (this.networked ? "back" : "garage-race-setup") : "start"}">${garage ? (this.networked ? "RETURN TO CREW" : "RACE SETUP") : "DEPLOY"} <i>→</i></button></div></aside><div class="fleet-dock"><div class="fleet-head"><div><span>FLEET</span><p>Swipe, drag or use the wheel to browse.</p></div><div class="fleet-filters">${filters}</div></div><div class="vehicle-list-premium">${options}</div></div></div>`,
      garage ? (this.networked ? "back" : "home") : "map",
    );
    const host = this.root.querySelector("#vehicle-preview");
    requestAnimationFrame(() => this.game.mountPreview(host, vehicle, this.color));
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
    if (this.pagesHosted) {
      this.shell("TIME TRIAL", "Race a friend",
        '<div class="lap-invite"><p>Finish one lap and copy the challenge link from your result. Your friend can open it to race the same district and vehicle.</p><button class="primary" data-action="choose-mode" data-id="time">SET A LAP TIME <i>→</i></button></div>');
      return;
    }
    this.shell(
      "LOCAL NETWORK // UP TO 4 DRIVERS",
      "Start a crew",
      `<div class="lobby-form"><label>DRIVER CALLSIGN<input id="driver-name" maxlength="14" value="${esc(this.playerName)}"></label><label>LOBBY CODE<input id="room-code" maxlength="8" value="NIGHT"></label><button class="primary" data-action="join">CONNECT <i>→</i></button><p>Share this code with drivers on the same network. The host machine runs the lobby server.</p></div>`,
      "home",
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
      "home",
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
    const leavingInvite = this.layer.querySelector('[data-action="take-challenge"]') || this.lapTarget?.hash === location.hash;
    if (leavingInvite) {
      try { history.replaceState(history.state, "", location.pathname + location.search); }
      catch { /* The menu still works in embeds that restrict browser history. */ }
    }
    this.lapTarget = null;
    this.routeMap = null;
    this.releaseDriving?.();
    this.game.stop();
    this.root.querySelector(".pause-overlay")?.remove();
    this.network.close();
    this.networked = false;
    document.exitFullscreen?.().catch(() => {});
    if (leavingInvite) this.showHome();
    else this.openEntry();
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
      `<div class="settings settings-modern"><label>PERFORMANCE<select id="quality-mode">${profiles}</select><small>Battery saver limits frames and resolution for longer sessions. Balanced is the everyday setting. High fidelity adds resolution.</small></label><label>AI DIFFICULTY<span class="difficulty-row">${levels}</span></label><label class="setting-toggle"><span>AUTO ACCELERATE<small>On touchscreens, focus on steering. Brake and drift override the throttle.</small></span><input type="checkbox" id="auto-accelerate" ${this.game.autoAccelerate ? "checked" : ""}></label><label class="setting-toggle"><span>TIME TRIAL GHOST<small>Race your fastest recorded lap in each district.</small></span><input type="checkbox" id="pace-ghost" ${storage.getItem("nightshift-ghost") !== "false" ? "checked" : ""}></label><label class="setting-toggle"><span>REDUCED CAMERA MOTION<small>Steady field of view and no impact shake.</small></span><input type="checkbox" id="reduced-motion" ${this.game.reducedMotion ? "checked" : ""}></label><label class="setting-toggle"><span>ENGINE AUDIO<small>Engine, nitro and effects.</small></span><input type="checkbox" id="audio-enabled" ${this.game.audio.enabled ? "checked" : ""}></label><p><a href="credits.html" target="_blank" rel="noopener">Model credits &amp; licenses</a></p><div class="control-reference"><span>DESKTOP</span><p>WASD / arrows · steer & drive<br>Space · drift &nbsp; Shift · nitro<br>F · gun &nbsp; R · rocket &nbsp; Esc · pause</p><span>CONTROLLER</span><p>D-pad / left stick · navigate or steer<br>A · choose or cycle an option &nbsp; B · back<br>RT / LT · gas / brake &nbsp; X · drift &nbsp; RB · nitro<br>LB · gun &nbsp; Y · rocket &nbsp; Start · pause</p><span>PHONE</span><p>Hold the steering arrows. Use drift, brake and nitro with your other thumb. Landscape gives you more room.</p></div></div>`,
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
      if (e.target.id === "route-guide") {
        this.game.guideShortcuts = e.target.value === "cuts";
        storage.setItem("nightshift-guide-cuts", String(this.game.guideShortcuts));
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
    const steeringPointers = new Set();
    const press = (pointerId, button) => {
      const previous = held.get(pointerId);
      if (previous === button) return;
      held.delete(pointerId);
      if (previous && ![...held.values()].includes(previous)) {
        previous.classList.remove("held");
        this.game.touch[previous.dataset.drive] = false;
      }
      if (button) {
        held.set(pointerId, button);
        button.classList.add("held");
        this.game.touch[button.dataset.drive] = true;
      }
    };
    const release = (event) => {
      steeringPointers.delete(event.pointerId);
      press(event.pointerId, null);
    };
    this.releaseDriving = () => {
      for (const button of held.values()) {
        button.classList.remove("held");
        this.game.touch[button.dataset.drive] = false;
      }
      held.clear();
      steeringPointers.clear();
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
      if (e.pointerType === "touch" && button.closest(".touch-steering")) steeringPointers.add(e.pointerId);
      this.game.touch.active = true;
      press(e.pointerId, button);
    });
    this.root.addEventListener("pointermove", (e) => {
      if (!steeringPointers.has(e.pointerId)) return;
      // Capture keeps the gesture alive when the thumb passes between arrows.
      const underThumb = document.elementFromPoint(e.clientX, e.clientY);
      press(e.pointerId, underThumb?.closest(".touch-steering [data-drive]") ?? null);
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
    const gauge = s.gearing;
    if (gauge) {
      this.root.querySelector("#current-gear").textContent = gauge.display;
      this.root.querySelector(".shift-lights").style.setProperty("--revs", Math.min(1, gauge.fraction) * 100 + "%");
    }
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
    if (s.raceTiming) {
      const sector = s.raceTiming.latest;
      const recent = sector && s.time - sector.at < 5;
      pace.hidden = !recent && s.raceTiming.best == null;
      pace.dataset.ahead = recent && sector.delta != null ? String(sector.delta < 0) : "";
      pace.textContent = recent
        ? "S" + sector.sector + " " + time(sector.duration) + (sector.delta == null ? "" : " · " + signedSeconds(sector.delta))
        : s.raceTiming.best != null ? "BEST " + time(s.raceTiming.best / 1000) : "";
    }
    if (this.lapTarget) {
      pace.hidden = false;
      if (showSplit) {
        pace.textContent = "G" + split.index + " " + signedSeconds(split.delta) + " VS YOUR BEST";
      } else {
        pace.dataset.ahead = "";
        pace.textContent = "TARGET " + time(this.lapTarget.ticks / 100);
      }
    }
    this.root.querySelector("#position").textContent =
      racing
        ? `${s.rank} / ${s.fieldSize} • LAP ${Math.min(s.lap, laps)} / ${laps}`
        : pursuit
          ? "ESCAPE RUN"
          : this.mode.id === "cruise" ? "FREE DRIVE" : "TIME TRIAL";
    this.root.querySelector("#checkpoint").textContent =
      `CHECKPOINT ${s.next} / ${s.total}`;
    const instruction = this.root.querySelector("#drive-state");
    instruction.textContent = s.cue?.label || "HOLD THE LINE";
    instruction.classList.toggle("braking-cue", Boolean(s.cue?.braking));
    this.root.querySelector("#drive-detail").textContent =
      s.cue?.detail || `CHECKPOINT ${s.next} / ${s.total}`;
    this.root.querySelector("#objective").textContent = pursuit
      ? "REACH EXTRACTION"
      : this.mode.id === "cruise" ? "EXPLORE THE ROUTE"
      : this.mode.id === "time" ? "BEAT YOUR PERSONAL BEST"
      : s.winnerAhead ? "LEADER FINISHED // RACE TO THE LINE" : `${this.mode.title.toUpperCase()} // FOLLOW THE GREEN GATES`;
    if (this.lastWanted !== s.wanted) {
      this.root.querySelector("#wanted").innerHTML = s.wanted
        ? `<small>HEAT</small>${"<i>◆</i>".repeat(s.wanted)}<small class="pursuit-gap"></small>`
        : "";
      this.lastWanted = s.wanted;
    }
    if (s.wanted) this.root.querySelector(".pursuit-gap").textContent = s.pursuitNote;
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
    const fork = !cut && s.player.guidedFork;
    const entering = fork && !fork.arriving;
    const branch = cut || (entering ? fork : null);
    const target = branch ? branch.road.points[shortcutMarkerIndex(branch.road, branch.gate)] : world.gatePosition(s.targetIndex);
    const car = s.player.mesh.position;
    ctx.beginPath(); ctx.moveTo(ox + car.x * scale, oy + car.z * scale);
    const trace = (p) => ctx.lineTo(ox + p.x * scale, oy + p.z * scale);
    const samples = world.samples;
    const stride = samples.length / world.route.length;
    const traceBranch = (road, first) => {
      for (let i = first; i < road.points.length; i++) trace(road.points[i]);
      const merge = world.authorSegmentToRouteIndex(road.to) * stride;
      for (let i = 1; i <= stride * 2; i++) trace(samples[(merge + i) % samples.length]);
    };
    if (branch) {
      traceBranch(branch.road, branch.gate);
    } else {
      const end = (s.targetIndex || world.route.length) * stride;
      let closest = end, best = Infinity;
      const last = s.targetIndex === 0 ? end + world.finishSamples : end;
      for (let i = end - stride; i <= last; i++) {
        const distance = car.distanceToSquared(samples[i % samples.length]);
        if (distance < best) { best = distance; closest = i; }
      }
      const limit = fork?.arriving ? fork.entry * stride : s.targetIndex === 0 && this.game.finalLap() ? last - 1 : end + 3 * stride;
      for (let i = closest; i <= limit; i++) trace(samples[i % samples.length]);
      if (s.targetIndex === 0 && this.game.finalLap()) trace(world.finishLine);
      if (fork?.arriving) traceBranch(fork.road, 1);
    }
    ctx.strokeStyle = "#65ffcb"; ctx.lineWidth = 3.5; ctx.lineJoin = "round"; ctx.stroke();
    const start = world.finishLine;
    ctx.fillStyle = "#fff"; ctx.fillRect(ox + start.x * scale - 2, oy + start.z * scale - 2, 4, 4);
    ctx.beginPath(); ctx.arc(ox + target.x * scale, oy + target.z * scale, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#43e5ae"; ctx.lineWidth = 1.5; ctx.stroke();
    if (s.cue?.braking && s.cue.apex) {
      const bend = s.cue.apex;
      ctx.beginPath(); ctx.arc(ox + bend.x * scale, oy + bend.z * scale, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffbd62"; ctx.lineWidth = 2; ctx.stroke();
    }
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
        a === s.player ? "#d4ff6a" : a.disabledFor > 0 ? "#ffbf61" : a.police ? "#ff4861" : "#8898ae";
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
    const laps = !data.race && data.laps?.length > 1 ? `<div class="lap-breakdown" aria-label="Lap times">${data.laps.map((value, i) =>
      `<span>LAP ${i + 1} <b>${time(value)}</b></span>`).join("")}</div>` : "";
    const completedTrial = this.mode.id === "time" && !this.networked && data.laps?.length === 1;
    const link = completedTrial ? lapChallengeLink(location.href, this.map.id, this.vehicle.id, data.time) : null;
    const copyButton = link ? '<button data-action="copy-lap">COPY CHALLENGE LINK</button>' : "";
    const copyField = link ? `<input id="lap-link" aria-label="Lap challenge link" readonly hidden value="${esc(link)}">` : "";
    let challengeResult = "";
    if (completedTrial && this.lapTarget) {
      const delta = Math.round(data.time * 100) - this.lapTarget.ticks;
      const result = delta === 0 ? "TARGET MATCHED" : time(Math.abs(delta) / 100) + (delta < 0 ? " UNDER TARGET" : " OVER TARGET");
      challengeResult = `<strong class="challenge-margin">${result} · TARGET ${time(this.lapTarget.ticks / 100)}</strong>`;
    }
    const pursuit = data.pursuit ? `<dl class="pursuit-result"><div><dt>Peak heat</dt><dd>${data.pursuit.peak} / 5</dd></div><div><dt>Breakaways</dt><dd>${data.pursuit.breakaways}</dd></div><div><dt>Car health</dt><dd>${data.pursuit.health}%</dd></div></dl>` : "";
    let sectorSheet = "";
    if (data.race) {
      const rows = data.race.rows.map((sectors, lap) => {
        const total = sectors.reduce((sum, seconds) => sum + seconds, 0);
        return `<tr><th scope="row">${lap + 1}</th>${sectors.map(seconds => `<td>${time(seconds)}</td>`).join("")}<td>${time(total)}</td></tr>`;
      });
      sectorSheet = `<details class="sector-sheet"><summary>Sector times</summary><table aria-label="Sector and lap times"><thead><tr><th>Lap</th><th>S1</th><th>S2</th><th>S3</th><th>Total</th></tr></thead><tbody>${rows.join("")}</tbody></table></details>`;
    }
    const hasPhoto = this.game.player?.finishedAt != null && !this.networked;
    const photo = hasPhoto ? '<details class="finish-photo" hidden><summary>Finish photo</summary><figure></figure><button data-action="save-photo">SAVE PHOTO</button></details>' : '';
    this.layer.innerHTML = `<section class="result screen"><p>${esc(this.map.name)}</p><h1>${esc(data.title)}</h1><div class="result-time">${time(data.time)}</div><span>${data.best ? `${data.race?.improved ? "NEW BEST" : "BEST"} ${time(data.best)} // ` : ""}${esc(data.mode).toUpperCase()}${data.delta != null ? " // " + signedSeconds(data.delta) + " VS BEST" : ""}</span>${challengeResult}${standings}${laps}${sectorSheet}${pursuit}${copyField}${photo}<div><button class="primary" data-action="rematch">RUN IT BACK <i>→</i></button>${copyButton}<button data-action="home">MAIN MENU</button></div></section>`;
    this.layer.querySelector('[data-action="rematch"]')?.focus({preventScroll:true});
    if (hasPhoto) {
      const holder = this.layer.querySelector(".finish-photo");
      const finishedWorld = this.game.world;
      requestAnimationFrame(() => {
        if (!holder.isConnected || finishedWorld !== this.game.world) return;
        const image = captureFinishPhoto(this.game, data.title, data.time);
        if (!image) return;
        holder.querySelector("figure").append(image);
        holder.hidden = false;
        holder.open = matchMedia("(min-width: 1040px) and (min-height: 490px)").matches;
      });
    }
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
