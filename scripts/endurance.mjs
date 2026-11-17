// Frozen, real-time, headless integration stress. Simulation is explicitly
// stepped by the fixture; software rendering occurs at checkpoints only.
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp,mkdir,readFile,readdir,writeFile,access,symlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seconds=Number(process.argv[2]||3600),label=process.argv[3]||new Date().toISOString().replace(/[:.]/g,'-');
if(!Number.isInteger(seconds)||seconds<60||seconds>10800||!/^[\w-]+$/.test(label))throw Error('Usage: node scripts/endurance.mjs SECONDS LABEL');
const port=Number(process.env.ENDURANCE_PORT||5181);
if(!Number.isInteger(port)||port<1024||port>45000)throw Error('Invalid endurance port');
const url=`http://127.0.0.1:${port}`;
const output=path.join(root,'artifacts/endurance',label),snapshot=path.join(output,'source');
try{await access(output);throw Error('Choose a new label; previous evidence is preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
await mkdir(snapshot,{recursive:true});
const files={};
async function copy(relative){
  const source=path.join(root,relative),target=path.join(snapshot,relative);
  const stat=await import('node:fs/promises').then(fs=>fs.stat(source));
  if(stat.isDirectory()){await mkdir(target,{recursive:true});for(const name of await readdir(source))await copy(path.join(relative,name));return;}
  const data=await readFile(source);files[relative.replaceAll('\\','/')]=createHash('sha256').update(data).digest('hex');
  await cp(source,target);
}
for(const name of ['src','server','public','server.js','vite.config.js','index.html','package.json','package-lock.json'])await copy(name);
await symlink(path.join(root,'node_modules'),path.join(snapshot,'node_modules'),process.platform==='win32'?'junction':'dir');
const manifest={label,requested_seconds:seconds,source_files:files,scope:'Frozen source; explicitly stepped headless simulation; software graphics at checkpoints; not native GPU/FPS/temperature or subjective play testing'};
await writeFile(path.join(output,'source.json'),JSON.stringify(manifest,null,2));
const server=spawn(process.execPath,['server.js'],{cwd:snapshot,env:{...process.env,PORT:String(port),HMR_PORT:String(port+19505),VITE_CACHE_DIR:path.join(root,`node_modules/.vite-endurance-${port}`)},stdio:'ignore',windowsHide:true});
let browser,report={...manifest,records:[],errors:[],result:'running'};
const save=()=>writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
try {
  let ready=false;
  for(let i=0;i<300;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(100);}
  if(!ready)throw Error('Frozen server did not start');
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:600}});
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(url,{timeout:90000});
  await page.waitForFunction(()=>window.__nightshift,null,{timeout:90000});
  await page.evaluate(async()=>{
    const {maps,modes,vehicles}=await import('/src/data.js');
    const {game:g,ui}=window.__nightshift;
    g.audio.setEnabled(false);g.clearPreview();
    window.soak={matches:0,steps:0,frames:0,pauseChecks:0,models:new Set(),maps:new Set(),
      restart(){
        const index=this.matches++;
        ui.map=maps[index%maps.length];ui.vehicle=vehicles[index%vehicles.length];ui.color=ui.vehicle.color;
        ui.mode=modes.find(m=>m.id===(index%3===0?'race':'time'));ui.start();
        cancelAnimationFrame(g.animationFrame);g.phase='play';g.callbacks.countdown('');
        this.models.add(ui.vehicle.name);this.maps.add(ui.map.id);
      },
      advance(){
        if(!g.running||g.phase==='finished')this.restart();
        g.player.health=100;g.player.boost=Math.max(30,g.player.boost);
        for(let i=0;i<60;i++){
          if(!g.running||g.phase==='finished')break;
          const p=g.player,target=g.world.route[p.next],dx=target.x-p.mesh.position.x,dz=target.z-p.mesh.position.z;
          const wanted=Math.atan2(-dx,-dz),difference=Math.atan2(Math.sin(wanted-p.mesh.rotation.y),Math.cos(wanted-p.mesh.rotation.y));
          const cycle=Math.floor(this.steps/60)%30;
          g.keys={KeyW:true,KeyA:difference>.08,KeyD:difference<-.08,Space:cycle===22,ShiftLeft:cycle===12,KeyF:cycle===15,KeyR:cycle===18};
          g.simulate(1/60);this.steps++;
          if(![p.speed,p.health,p.boost,p.mesh.position.x,p.mesh.position.y,p.mesh.position.z].every(Number.isFinite))throw Error('Invalid player state');
          for(const actor of g.actors)actor.mesh.traverse(o=>{if(!o.position.toArray().every(Number.isFinite)||!o.quaternion.toArray().every(Number.isFinite))throw Error('Invalid animated transform');});
        }
        if(g.effects.pool.length!==96||g.skids.life.length!==384)throw Error('Effect storage changed size');
        if(g.projectiles.length>100||g.actors.length>32)throw Error('Unbounded actors/projectiles');
      },
      record(){
        if(!g.running)this.restart();
        g.world.update(0,g.time,g.player.mesh.position,210);g.updateCamera(1/30);g.renderScene();this.frames++;
        const info=g.renderer.info;
        if(info.memory.geometries>350||info.memory.textures>128||info.programs.length>80)throw Error('Rendering resource bound exceeded');
        return {matches:this.matches,steps:this.steps,simulation_seconds:this.steps/60,checkpoint_renders:this.frames,pause_checks:this.pauseChecks,
          models:[...this.models],maps:[...this.maps],geometries:info.memory.geometries,textures:info.memory.textures,programs:info.programs.length,
          calls:info.render.calls,triangles:info.render.triangles,actors:g.actors.length,projectiles:g.projectiles.length};
      }};
    window.soak.restart();
  });
  const started=Date.now();let nextReport=0,nextMatch=120,nextPause=45;
  report.start_utc=new Date(started).toISOString();await save();
  console.log('ENDURANCE START',seconds,'seconds;',report.start_utc,output);
  while((Date.now()-started)/1000<seconds){
    const tick=Date.now(),elapsed=(tick-started)/1000;
    if(elapsed>=nextMatch){await page.evaluate(()=>window.soak.restart());nextMatch=elapsed+120;}
    await page.evaluate(()=>window.soak.advance());
    if(elapsed>=nextPause){
      const before=await page.evaluate(()=>{const g=window.__nightshift.game;g.togglePause();return {time:g.time,frame:g.renderer.info.render.frame};});
      await delay(300);
      const valid=await page.evaluate(before=>{
        const g=window.__nightshift.game;
        const valid=g.paused && before.time===g.time && before.frame===g.renderer.info.render.frame && g.audio.context?.state==='suspended';
        g.togglePause();cancelAnimationFrame(g.animationFrame);window.soak.pauseChecks++;return valid;
      },before);
      if(!valid)throw Error('Pause advanced simulation, graphics or audio');nextPause=elapsed+45;
    }
    if(elapsed>=nextReport){
      const record=await page.evaluate(()=>window.soak.record());record.wall_seconds=elapsed;report.records.push(record);await save();
      console.log('ENDURANCE',JSON.stringify(record));nextReport=elapsed+60;
    }
    if(report.errors.length)throw Error(report.errors.join('\n'));
    await delay(Math.max(0,1000-(Date.now()-tick)));
  }
  report.final=await page.evaluate(()=>window.soak.record());
  report.elapsed_seconds=(Date.now()-started)/1000;report.end_utc=new Date().toISOString();report.result='passed';await save();
  console.log('ENDURANCE PASS',report.elapsed_seconds,JSON.stringify(report.final));
}catch(error){report.result='failed';report.errors.push(error.message);report.end_utc=new Date().toISOString();await save();throw error;}
finally{await browser?.close();server.kill();}
