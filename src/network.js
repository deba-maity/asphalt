export class Network {
  constructor() { this.ws=null;this.id=null;this.players=[];this.room=null;this.host=null;this.on=()=>{}; }
  connect({room,name,vehicle,color}) {
    this.close();
    return new Promise((resolve,reject)=>{
      const protocol=location.protocol==='https:'?'wss':'ws';
      const ws=new WebSocket(`${protocol}://${location.host}/lobby`);this.ws=ws;
      let joined=false,settled=false;
      const timeout=setTimeout(()=>fail(new Error('The lobby did not respond. Try connecting again.')),10000);
      const fail=error=>{if(settled)return;settled=true;clearTimeout(timeout);reject(error);ws.close();};
      ws.onopen=()=>{if(this.ws===ws) this.send({type:'join',room,name,vehicle,color});};
      ws.onmessage=e=>{
        if(this.ws!==ws)return;
        let msg;try{msg=JSON.parse(e.data);}catch{return;}
        if(!msg || typeof msg!=='object')return;
        if(msg.type==='error'&&!joined){fail(new Error(String(msg.message||'Could not join the lobby.')));return;}
        if(msg.type==='joined'){
          joined=true;settled=true;clearTimeout(timeout);
          this.id=msg.id;this.room=msg.room;this.host=msg.host;this.players=msg.players;resolve(msg);
        } else {
          if(msg.type==='players'){this.players=msg.players;this.host=msg.host;}
          this.on(msg);
        }
      };
      ws.onerror=()=>fail(new Error('Could not reach the lobby server.'));
      ws.onclose=()=>{
        clearTimeout(timeout);
        if(!settled)fail(new Error('The lobby connection closed before joining.'));
        if(this.ws===ws){this.ws=null;this.on({type:'closed'});}
      };
    });
  }
  send(msg) { if(this.ws?.readyState===WebSocket.OPEN && this.ws.bufferedAmount<65536) this.ws.send(JSON.stringify(msg)); }
  updateSetup(data) { this.send({type:'setup',...data}); }
  position(data) { this.send({type:'position',data}); }
  close() { const ws=this.ws;this.ws=null;ws?.close();this.id=null;this.host=null;this.players=[];this.room=null; }
}
