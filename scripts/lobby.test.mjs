import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { installLobby, cleanPosition } from '../server/lobby.js';

async function fixture(t) {
  const http=createServer(),{wss,rooms}=installLobby(http),sockets=[];
  http.listen(0,'127.0.0.1');await once(http,'listening');
  const url=`ws://127.0.0.1:${http.address().port}/lobby`;
  t.after(async()=>{for(const ws of sockets)ws.terminate();for(const ws of wss.clients)ws.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>http.close(r));});
  async function client() {
    const ws=new WebSocket(url);sockets.push(ws);const messages=[];
    ws.on('message',data=>messages.push(JSON.parse(data)));ws.on('error',()=>{});
    await once(ws,'open');
    return {ws,messages,send:msg=>ws.send(JSON.stringify(msg)),
      async wait(type) {
        const start=Date.now();
        while(Date.now()-start<2000){const i=messages.findIndex(m=>m.type===type);if(i>=0)return messages.splice(i,1)[0];await new Promise(r=>setTimeout(r,5));}
        throw Error(`No ${type} message; got ${JSON.stringify(messages)}`);
      }};
  }
  return {client,url,rooms};
}
const join=(c,name='Driver')=>c.send({type:'join',room:'TEST',name,vehicle:'Apex GT',color:'#ff4b63'});

test('positions accept finite bounded values and sanitize style/identity fields',()=>{
  for(const data of [null,[],{x:NaN},{x:0,z:0,rotation:0,speed:Infinity},{x:1e8,z:0,rotation:0,speed:0}])assert.equal(cleanPosition(data),null);
  const result=cleanPosition({x:2,z:3,rotation:Math.PI*4,speed:20,color:'red;position:fixed',vehicle:{bad:true},next:-1,lap:1});
  assert.equal(result.color,'#ff4b63');assert.equal(result.vehicle,'Apex GT');assert.equal(result.next,0);assert(Math.abs(result.rotation)<1e-10);
});
test('malformed, scalar and binary packets do not crash the lobby',async t=>{
  const {client}=await fixture(t),c=await client();
  for(const raw of ['{','null','[]','4','"hello"'])c.ws.send(raw);
  c.ws.send(Buffer.from([0,1,2]));join(c);
  assert.equal((await c.wait('joined')).room,'TEST');
});
test('host controls start; position identity and result sender cannot be forged',async t=>{
  const {client}=await fixture(t),a=await client(),b=await client();
  join(a,'Host');const host=await a.wait('joined');join(b,'Guest');const guest=await b.wait('joined');
  assert.equal(guest.host,host.id);
  b.send({type:'start',map:'neon',mode:'race'});assert.match((await b.wait('error')).message,/host/);
  a.send({type:'start',map:'missing',mode:'race'});assert.match((await a.wait('error')).message,/available/);
  a.send({type:'start',map:'neon',mode:'race'});await a.wait('start');await b.wait('start');
  a.send({type:'position',id:guest.id,data:{x:1,z:2,rotation:0,speed:10,vehicle:'fake',color:'#ffffff'}});
  const position=await b.wait('position');assert.equal(position.id,host.id);assert.equal(position.data.vehicle,'Apex GT');assert.equal(position.data.color,'#ff4b63');
  b.send({type:'event',event:{type:'finish',id:host.id,title:'FINISHED',time:42}});
  const finish=await a.wait('event');assert.equal(finish.id,guest.id);assert.equal(finish.event.id,undefined);
});
test('full lobbies return an error; departing host transfers ownership and rooms are released',async t=>{
  const {client,rooms}=await fixture(t),crew=[];
  for(let i=0;i<4;i++){const c=await client();join(c);await c.wait('joined');crew.push(c);}
  const extra=await client();join(extra);assert.match((await extra.wait('error')).message,/full/);
  const newHost=[...rooms.get('TEST').players.keys()][1];
  crew[0].ws.close();await once(crew[0].ws,'close');
  await new Promise(r=>setTimeout(r,20));
  assert.equal(rooms.get('TEST').players.keys().next().value,newHost);
  for(const c of crew.slice(1)){c.ws.close();await once(c.ws,'close');}
  await new Promise(r=>setTimeout(r,20));assert.equal(rooms.size,0);
});
test('oversized packets and floods are closed within fixed resource limits',async t=>{
  const {client}=await fixture(t),large=await client();const closed=once(large.ws,'close');
  large.ws.send('x'.repeat(5000));assert.equal((await closed)[0],1009);
  const flood=await client(),limited=once(flood.ws,'close');
  for(let i=0;i<180;i++)flood.ws.send('{}');
  assert.equal((await limited)[0],1008);
});
test('browser connections from unrelated origins are rejected',async t=>{
  const {url}=await fixture(t);
  const ws=new WebSocket(url,{origin:'https://unrelated.invalid'});
  const error=await new Promise(resolve=>ws.on('error',resolve));
  assert.match(error.message,/401/);
});
