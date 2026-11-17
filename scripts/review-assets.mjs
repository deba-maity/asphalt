import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5177',HMR_PORT:'24682'},stdio:'pipe',windowsHide:true});
const out=`artifacts/${process.argv[2]||'vehicle-review'}`;await mkdir(out,{recursive:true});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5177/scripts/asset-review.html')).ok)break;}catch{}await delay(100);}
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1100,height:750}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5177/scripts/asset-review.html');await page.waitForFunction(()=>window.ready);
 const results=[];
 for(const index of [0,2,4,7,12,18,22])for(const angle of [0,2.4]){
  results.push(await page.evaluate(([i,a])=>window.review.sample(i,1,a),[index,angle]));
  await page.screenshot({path:`${out}/${index}-${angle}.png`});
 }
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(`${out}/report.json`,JSON.stringify({scope:'Independent software-rendered vehicle assets; not native GPU performance',results},null,2));
 console.log('Inspected',results.length,'vehicle views:',out);
}finally{await browser?.close();server.kill();}
