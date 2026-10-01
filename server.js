import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';

const port = Number(process.env.PORT || 5173);
const hmrPort = Number(process.env.HMR_PORT || 24678);
const rooms = new Map();
let idCounter = 1;

function room(code) {
  if (!rooms.has(code)) rooms.set(code, { players: new Map(), state: { phase: 'lobby' } });
  return rooms.get(code);
}
function broadcast(r, message, except) {
  const text = JSON.stringify(message);
  for (const player of r.players.values()) if (player.ws !== except && player.ws.readyState === 1) player.ws.send(text);
}
function playerList(r) {
  return [...r.players.values()].map(({ id, name, vehicle, color, ready }) => ({ id, name, vehicle, color, ready }));
}

// Browser test profiles are kept beside the project. Their cache writes must
// never be treated as source edits, or Vite will repeatedly reload the game.
const vite = await createViteServer({
  optimizeDeps: {
    entries: ['index.html']
  },
  server: {
    middlewareMode: true,
    hmr: { port: hmrPort },
    watch: { ignored: ['**/chrome-*/**', '**/edge-*/**'] }
  },
  appType: 'spa'
});
const http = createServer((req, res) => vite.middlewares(req, res));
const wss = new WebSocketServer({ server: http });

wss.on('connection', (ws) => {
  const id = `p${idCounter++}`;
  let currentRoom;
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'join') {
      if (currentRoom) return;
      const code = String(msg.room || 'NIGHT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'NIGHT';
      const r = room(code);
      if (r.players.size >= 4) return ws.send(JSON.stringify({ type: 'error', message: 'Lobby is full.' }));
      currentRoom = code;
      r.players.set(id, { id, ws, name: String(msg.name || 'Driver').slice(0, 14), vehicle: msg.vehicle || 'Apex GT', color: msg.color || '#ff4b63', ready: false });
      ws.send(JSON.stringify({ type: 'joined', id, room: code, state: r.state, players: playerList(r) }));
      broadcast(r, { type: 'players', players: playerList(r) });
    }
    if (!currentRoom) return;
    const r = room(currentRoom); const player = r.players.get(id); if (!player) return;
    if (msg.type === 'setup') { Object.assign(player, { vehicle: msg.vehicle || player.vehicle, color: msg.color || player.color, ready: !!msg.ready }); broadcast(r, { type: 'players', players: playerList(r) }); }
    if (msg.type === 'start') { r.state = { phase: 'countdown', mode: msg.mode, map: msg.map, seed: Date.now() }; broadcast(r, { type: 'start', state: r.state }); }
    if (msg.type === 'position') broadcast(r, { type: 'position', id, data: msg.data }, ws);
    if (msg.type === 'event') {
      if (msg.event?.type === 'finish') r.state = { ...r.state, phase: 'result', result: { id, ...msg.event } };
      broadcast(r, { type: 'event', id, event: msg.event });
    }
  });
  ws.on('close', () => {
    if (!currentRoom) return;
    const r = rooms.get(currentRoom); if (!r) return;
    r.players.delete(id); broadcast(r, { type: 'players', players: playerList(r) });
    if (!r.players.size) rooms.delete(currentRoom);
  });
});

http.listen(port, '0.0.0.0', () => console.log(`NIGHTSHIFT is running at http://localhost:${port}`));
