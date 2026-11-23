import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
const url = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:5185/');
const server=process.env.TEST_BASE_URL ? null : spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','5185','--strictPort'],{stdio:'ignore',windowsHide:true});
let browser;
try{
  let ready=false;
  for(let i=0;i<150;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(100);}
  assert(ready,'Production preview starts');
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],failed=[];
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});
  await page.goto(url.href);
  await page.getByRole('button',{name:'HIT THE STREETS'}).waitFor();
  assert.equal(await page.evaluate(()=>typeof window.__nightshift),'undefined','Development control hooks are absent from production');
  await page.getByRole('button',{name:'HIT THE STREETS'}).click();
  await page.locator('[data-action="choose-mode"]').first().click();
  await page.locator('[data-action="choose-map"]').first().click();
  await page.locator('[data-action="start"]').click();
  await page.waitForFunction(()=>document.querySelector('#countdown')?.textContent==='');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => Number(document.querySelector('#speed').textContent) >= 25);
  await page.keyboard.up('ArrowUp');
  if (process.env.RACE_SCREENSHOT) await page.screenshot({path: process.env.RACE_SCREENSHOT});
  await page.getByRole('button',{name:'Pause race'}).click();
  const checkpoint = await page.locator('#checkpoint').innerText();
  await page.getByRole('button',{name:'RETURN TO LAST GATE'}).click();
  await page.waitForFunction(() => Number(document.querySelector('#speed').textContent) < 3);
  assert.equal(await page.locator('#checkpoint').innerText(), checkpoint);
  await page.getByRole('button',{name:'Pause race'}).click();
  await page.getByRole('button',{name:'QUIT TO MENU'}).click();
  await page.getByRole('button',{name:'HIT THE STREETS'}).waitFor();
  await page.getByRole('button',{name:/settings/i}).click();
  const credit=await page.locator('a[href="credits.html"]').getAttribute('href');assert.equal(credit,'credits.html');
  assert((await fetch(new URL('assets/touring/LICENSE.txt', url))).ok);
  assert.deepEqual(failed,[]);assert.deepEqual(errors,[]);await page.close();
  const blocked=await browser.newPage({viewport:{width:960,height:600}});
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage is disabled','SecurityError');}}));
  await blocked.goto(url.href);
  await blocked.getByRole('button',{name:'HIT THE STREETS'}).waitFor({timeout:90000});
  await blocked.getByRole('button',{name:/settings/i}).click();
  await blocked.locator('#quality-mode').selectOption('balanced');
  assert.equal(await blocked.locator('#quality-mode').inputValue(),'balanced');
  await blocked.close();
  const noGraphics = await browser.newPage();
  await noGraphics.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl2') return null;
      return getContext.call(this, type, ...args);
    };
  });
  await noGraphics.goto(url.href);
  const failure = noGraphics.getByRole('alert');
  await failure.waitFor();
  assert.match(await failure.innerText(), /WebGL 2 and hardware acceleration/i);
  await Promise.all([
    noGraphics.waitForEvent('domcontentloaded'),
    failure.getByRole('button', {name: 'RETRY'}).click()
  ]);
  await failure.waitFor();
  console.log('PRODUCTION PASS: bundled assets, menu/race/pause/return, credits, private debug hooks, blocked storage and unavailable WebGL');
}finally{await browser?.close();server?.kill();}
