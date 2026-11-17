import { WebSocketServer } from 'ws';
import { maps, modes, vehicles } from '../src/data.js';

const vehicleNames=new Set(vehicles.map(v=>v.name));
const mapNames=new Set(maps.map(m=>m.id));
const modeNames=new Set(modes.map(m=>m.id));
const text=(value,fallback,max)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max)||fallback:fallback;
const color=(value)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:'#ff4b63';
const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
const vehicle=(value)=>vehicleNames.has(value)?value:vehicles[0].name;

export function cleanPosition(data) {
  if(!data || typeof data!=='object' || Array.isArray(data)) return null;
  if(!number(data.x,-2500,2500)||!number(data.z,-2500,2500)||!number(data.rotation,-1e6,1e6)||!number(data.speed,-150,150)) return null;
  return {x:data.x,z:data.z,rotation:Math.atan2(Math.sin(data.rotation),Math.cos(data.rotation)),speed:data.speed,
    vehicle:vehicle(data.vehicle),color:color(data.color),next:Math.floor(number(data.next,0,200)?data.next:0),lap:Math.floor(number(data.lap,0,4)?data.lap:0)};
}

export function installLobby(http) {
  const rooms=new Map();let serial=0;
  const wss=new WebSocketServer({server:http,path:'/lobby',maxPayload:4096,perMessageDeflate:false,
    verifyClient:({origin,req})=>{
      if(wss.clients.size>=256) return false;
      // Browsers must originate from this host. Native LAN clients may omit
      // Origin; this relay is a casual LAN feature, not account authentication.
      if(!origin) return true;
      try{return new URL(origin).host===req.headers.host;}catch{return false;}
    }});
  const send=(ws,data)=>{
    if(ws.readyState!==1) return;
    if(ws.bufferedAmount>65536){ws.close(1013,'Connection too slow');return;}
    ws.send(JSON.stringify(data));
  };
  const list=r=>[...r.players.values()].map(({id,name,vehicle,color,ready})=>({id,name,vehicle,color,ready}));
  const host=r=>r.players.keys().next().value;
  const broadcast=(r,msg,except)=>{for(const p of r.players.values()) if(p.ws!==except) send(p.ws,msg);};
  const publish=r=>broadcast(r,{type:'players',host:host(r),players:list(r)});
  wss.on('connection',ws=>{
    const id=`p${++serial}`;let current=null,tokens=120,last=Date.now(),lastPosition=0;
    ws.alive=true;ws.on('pong',()=>{ws.alive=true;});ws.on('error',()=>{});
    const error=message=>send(ws,{type:'error',message});
    ws.on('message',(raw,binary)=>{
      const now=Date.now();tokens=Math.min(120,tokens+(now-last)*.06);last=now;
      if(--tokens<0){ws.close(1008,'Message rate exceeded');return;}
      if(binary) return;
      let msg;try{msg=JSON.parse(raw.toString());}catch{return;}
      if(!msg || typeof msg!=='object' || Array.isArray(msg)) return;
      if(msg.type==='join') {
        if(current) return error('Already joined. Leave before choosing another lobby.');
        const code=text(msg.room,'NIGHT',32).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8)||'NIGHT';
        if(!rooms.has(code)&&rooms.size>=64) return error('The lobby server is busy. Try again later.');
        let r=rooms.get(code);
        if(r?.players.size>=4) return error('Lobby is full.');
        if(r && r.state.phase==='countdown') return error('This crew is racing. Join after the race.');
        if(!r){r={players:new Map(),state:{phase:'lobby'}};rooms.set(code,r);}
        current=code;r.players.set(id,{id,ws,name:text(msg.name,'Driver',14),vehicle:vehicle(msg.vehicle),color:color(msg.color),ready:false});
        send(ws,{type:'joined',id,room:code,host:host(r),state:r.state,players:list(r)});publish(r);return;
      }
      const r=rooms.get(current),p=r?.players.get(id);if(!p) return;
      if(msg.type==='setup') {
        if(r.state.phase==='countdown') return;
        p.vehicle=vehicle(msg.vehicle);p.color=color(msg.color);p.ready=msg.ready===true;publish(r);
      } else if(msg.type==='start') {
        if(host(r)!==id) return error('Only the crew host can start the race.');
        if(!mapNames.has(msg.map)||!modeNames.has(msg.mode)) return error('Choose an available map and mode.');
        if(r.state.phase==='countdown') return;
        r.state={phase:'countdown',mode:msg.mode,map:msg.map,seed:Date.now()};broadcast(r,{type:'start',state:r.state});
      } else if(msg.type==='position') {
        if(r.state.phase!=='countdown'||now-lastPosition<30) return;
        const data=cleanPosition(msg.data);if(!data) return;
        data.vehicle=p.vehicle;data.color=p.color;lastPosition=now;
        broadcast(r,{type:'position',id,data},ws);
      } else if(msg.type==='event' && msg.event?.type==='finish') {
        if(r.state.phase!=='countdown'||!number(msg.event.time,0,86400)) return;
        const event={type:'finish',title:text(msg.event.title,'FINISHED',64),time:msg.event.time};
        r.state={...r.state,phase:'result',result:{id,...event}};
        broadcast(r,{type:'event',id,event});
      }
    });
    ws.on('close',()=>{
      const r=rooms.get(current);if(!r) return;
      r.players.delete(id);
      if(!r.players.size)rooms.delete(current);else publish(r);
    });
  });
  const heartbeat=setInterval(()=>{
    for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}
  },30000);heartbeat.unref();
  wss.on('close',()=>clearInterval(heartbeat));
  return {wss,rooms};
}
