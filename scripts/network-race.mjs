// Two real browser clients and the real relay, with explicit simulation steps.
// Rendering is covered separately; this fixture creates no desktop window.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
const url='http://127.0.0.1:5189';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5189',HMR_PORT:'24694',VITE_CACHE_DIR:'node_modules/.vite-network-race'},stdio:'ignore',windowsHide:true});
let browser;
try {
  let ready=false;
  for(let i=0;i<150;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(100);}
  assert(ready,'LAN integration server starts');
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const pages=[],errors=[];
  for(let index=0;index<2;index++){
    const page=await browser.newPage({viewport:{width:960,height:600}});pages.push(page);
    page.setDefaultTimeout(90000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto(url);await page.waitForFunction(()=>window.__nightshift);
    await page.evaluate(async index=>{
      const {game:g,ui}=window.__nightshift;
      g.clearPreview();g.mountPreview=()=>{};g.audio.setEnabled(false);
      g.frame=()=>{}; // Every step below is explicit; no rendering benchmark.
      ui.showLobby();
      document.querySelector('#driver-name').value=`Driver ${index+1}`;
      document.querySelector('#room-code').value='RACETEST';
      await ui.joinLobby();
    },index);
  }
  const [host,guest]=pages;
  await host.waitForFunction(()=>window.__nightshift.network.players.length===2);
  assert(await guest.locator('[data-action="lobby-start"]').isDisabled(),'Only the host starts');
  await host.locator('[data-action="lobby-start"]').click();
  for(const page of pages)await page.waitForFunction(()=>window.__nightshift.game.running);
  const ids=await Promise.all(pages.map(p=>p.evaluate(()=>window.__nightshift.network.id)));
  async function stepPeers(){
    for(let tick=0;tick<8;tick++){
      for(const page of pages)await page.evaluate(()=>{
        const g=window.__nightshift.game;g.phase='play';g.keys.KeyW=true;
        for(let step=0;step<6;step++)g.simulate(1/60);
      });
      await delay(70); // Relay position pacing uses real wall time.
    }
  }
  await stepPeers();
  for(let index=0;index<pages.length;index++){
    const peer=await pages[index].evaluate(id=>{
      const g=window.__nightshift.game,a=g.remotes.get(id);
      return {remote:g.remotes.size,target:!!a?.target,speed:a?.target?.speed};
    },ids[1-index]);
    assert.equal(peer.remote,1);assert(peer.target && peer.speed>0,'Peers receive moving positions');
  }
  // Represent the end of a long first race, then use normal result/rematch UI.
  for(const page of pages)await page.evaluate(()=>{
    const g=window.__nightshift.game;g.elapsed=180;g.time=180;g.lastNetwork=179.9;
  });
  await host.evaluate(()=>window.__nightshift.game.finish('FIRST PLACE'));
  await guest.waitForFunction(()=>window.__nightshift.game.phase==='finished');
  await guest.locator('[data-action="rematch"]').click();
  assert(await guest.locator('.result').isVisible(),'Waiting guest retains the result and home button');
  await host.locator('[data-action="rematch"]').click();
  for(const page of pages)await page.waitForFunction(()=>window.__nightshift.game.phase==='countdown' && window.__nightshift.game.time<1);
  await stepPeers();
  for(let index=0;index<pages.length;index++){
    assert(await pages[index].evaluate(id=>!!window.__nightshift.game.remotes.get(id)?.target,ids[1-index]),'Rematch sends positions without waiting for the previous elapsed time');
  }
  await host.evaluate(()=>window.__nightshift.ui.exitToHome());
  await guest.waitForFunction(()=>window.__nightshift.network.host===window.__nightshift.network.id && window.__nightshift.game.remotes.size===0);
  assert.deepEqual(errors,[]);
  console.log('NETWORK RACE PASS: two game clients, start, moving peers, finish, guest wait, rematch positions, host transfer and remote disposal');
} finally {await browser?.close();server.kill();}
