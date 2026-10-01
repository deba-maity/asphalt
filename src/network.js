export class Network {
  constructor() { this.ws = null; this.id = null; this.players = []; this.room = null; this.on = () => {}; }
  connect({ room, name, vehicle, color }) {
    return new Promise((resolve, reject) => {
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      this.ws = new WebSocket(`${protocol}://${location.host}`);
      this.ws.onopen = () => this.send({ type: 'join', room, name, vehicle, color });
      this.ws.onmessage = (e) => { const msg = JSON.parse(e.data); if (msg.type === 'joined') { this.id = msg.id; this.room = msg.room; this.players = msg.players; resolve(msg); } else { if (msg.type === 'players') this.players = msg.players; this.on(msg); } };
      this.ws.onerror = () => reject(new Error('Could not reach the lobby server.'));
      this.ws.onclose = () => this.on({ type: 'closed' });
    });
  }
  send(msg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg)); }
  updateSetup(data) { this.send({ type: 'setup', ...data }); }
  position(data) { this.send({ type: 'position', data }); }
  close() { this.ws?.close(); this.ws = null; }
}
