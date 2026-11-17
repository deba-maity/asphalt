import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5183',HMR_PORT:'24688'},stdio:'ignore',windowsHide:true});
let browser;
try {
  for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:5183')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5183/scripts/network-harness.html');await page.waitForFunction(()=>window.Network);
  const result=await page.evaluate(async()=>{
    const crew=[];
    const options={room:'BROWSER',name:'Driver',vehicle:'Apex GT',color:'#ff4b63'};
    const pause=ms=>new Promise(r=>setTimeout(r,ms));
    for(let i=0;i<4;i++){const client=new window.Network();await client.connect(options);crew.push(client);}
    await pause(50);
    if(!crew.every(c=>c.players.length===4&&c.host===crew[0].id))throw Error('Membership/host did not synchronize');
    const overflow=new window.Network();let full=false;
    try{await overflow.connect(options);}catch(error){full=/full/.test(error.message);}
    if(!full)throw Error('Full lobby did not reject the join promise');
    let starts=0;for(const c of crew)c.on=msg=>{if(msg.type==='start')starts++;};
    crew[0].send({type:'start',map:'coast',mode:'race'});await pause(100);
    if(starts!==4)throw Error(`Server start did not reach each client: ${starts}`);
    const before=crew[1].id;crew[0].close();await pause(100);
    if(crew[1].host!==before)throw Error('Host did not transfer after disconnect');
    for(const c of crew)c.close();overflow.close();
    const cancelled=new window.Network();
    const joining=cancelled.connect({...options,room:'CANCEL'});cancelled.close();
    let rejected=false;try{await joining;}catch{rejected=true;}
    if(!rejected)throw Error('Cancelled connection stayed unresolved');
    return {clients:4,full_lobby:'rejected',starts,host_transfer:'passed',cancelled_connect:'rejected'};
  });
  assert.deepEqual(errors,[]);console.log('BROWSER NETWORK PASS',JSON.stringify(result));
}finally{await browser?.close();server.kill();}
