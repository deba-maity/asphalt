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
  await host.locator('#lobby-map').selectOption('coast');
  await host.locator('#lobby-mode').selectOption('sprint');
  assert.equal(await guest.locator('#lobby-map').count(),0,'Only the host configures the race');
  await guest.locator('[data-action="garage"]').click();
  await guest.locator('[data-action="choose-vehicle"]').nth(1).click();
  await guest.getByRole('button',{name:/RETURN TO CREW/}).click();
  await guest.locator('#player-slots').waitFor();
  assert.equal(await guest.evaluate(()=>window.__nightshift.network.players.length),2,'Garage return preserves the crew');
  assert.equal(await host.locator('#lobby-map').inputValue(),'coast');
  assert.equal(await host.locator('#lobby-mode').inputValue(),'sprint');
  await host.setViewportSize({width:390,height:844});
  assert(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Crew setup fits a portrait phone viewport');
  await host.setViewportSize({width:960,height:600});
  await host.locator('[data-action="lobby-start"]').click();
  for(const page of pages)await page.waitForFunction(()=>window.__nightshift.game.running);
  for(const page of pages)assert(await page.evaluate(()=>{
    const c=window.__nightshift.game.config;return c.map.id==='coast'&&c.mode.id==='sprint';
  }),'Crew uses the host-selected map and mode');
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
  const expectedSurface = await host.evaluate(() => {
    const g = window.__nightshift.game, w = g.world, p = g.player;
    const index = w.shortcutRoads.findIndex(road => road.elevated), road = w.shortcutRoads[index];
    p.mesh.position.copy(road.points[9]); p.roadBranch = road; p.cut = {road,gate:10};
    p.speed = p.velocityX = p.velocityZ = 0; g.keys = {};
    for (let i=0;i<8;i++) g.simulate(1/60);
    return index + 1;
  });
  await guest.waitForFunction(([id, surface]) => window.__nightshift.game.remotes.get(id)?.target?.surface === surface,[ids[0],expectedSurface]);
  assert(await guest.evaluate(id => {
    const g = window.__nightshift.game, remote = g.remotes.get(id);
    remote.mesh.position.copy(remote.target.position); g.updateRemote(remote,1/60);
    return remote.surfaceY > 4.5;
  },ids[0]),'A remote peer renders on the ramp selected by the driver');
  // Represent the end of a long first race, then use normal result/rematch UI.
  for(const page of pages)await page.evaluate(()=>{
    const g=window.__nightshift.game;g.elapsed=180;g.time=180;g.lastNetwork=179.9;
  });
  await guest.evaluate(()=>{
    const g=window.__nightshift.game;if(!g.paused)g.togglePause();
  });
  assert(await guest.locator('.pause-overlay').isVisible(),'Guest is paused before the remote finish');
  await host.evaluate(()=>window.__nightshift.game.finish('FIRST PLACE'));
  await guest.waitForFunction(()=>window.__nightshift.game.phase==='finished');
  assert.equal(await guest.locator('.pause-overlay').count(),0,'Remote result replaces the pause panel');
  assert.match(await guest.locator('.result h1').innerText(), /WINS$/, 'Guest sees the winning driver instead of claiming first place');
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
  await guest.evaluate(()=>{
    const {game:g,ui}=window.__nightshift;g.stop();ui.showJoinedLobby();
  });
  assert.equal(await guest.locator('#lobby-map').count(),1,'The new host receives setup controls');
  await guest.locator('.back').click();
  assert(await guest.getByRole('button',{name:'HIT THE STREETS'}).isVisible(),'Lobby back returns home');
  assert(await guest.evaluate(()=>!window.__nightshift.network.ws && !window.__nightshift.ui.networked),'Leaving the lobby disconnects');
  assert.deepEqual(errors,[]);
  console.log('NETWORK RACE PASS: host route/mode, garage return, two game clients, moving peers, finish while paused, guest wait, rematch positions, host transfer and remote disposal');
} finally {await browser?.close();server.kill();}
