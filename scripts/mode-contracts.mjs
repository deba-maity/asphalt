// Deterministic progression fixtures, not a claim of completing human races.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
const url='http://127.0.0.1:5191';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5191',HMR_PORT:'24696',VITE_CACHE_DIR:'node_modules/.vite-modes'},stdio:'ignore',windowsHide:true});
let browser;
try {
  let ready=false;
  for(let i=0;i<150;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await delay(100);}
  assert(ready);
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:600}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url);await page.waitForFunction(()=>window.__nightshift,null,{timeout:90000});
  const result=await page.evaluate(async()=>{
    const {maps,modes,vehicles}=await import('/src/data.js');
    const {driveStep}=await import('/src/driving.js');
    const {Raycaster, Vector3}=await import('/node_modules/three/build/three.module.js');
    const {game:g,ui}=window.__nightshift;const results=[];
    const check=(condition,label)=>{if(!condition)throw Error(label);};
    g.clearPreview();g.mountPreview=()=>{};g.frame=()=>{};g.audio.setEnabled(false);
    for(const map of maps)for(const mode of modes){
      ui.map=map;ui.mode=mode;ui.start();g.phase='play';g.elapsed=30;
      const competitive=['race','sprint'].includes(mode.id),required=mode.id==='race'?3:1;
      check(g.actors.length===(competitive?6:1),`${mode.id}: intended starting field`);
      if (competitive) {
        for (const rival of g.actors.slice(1)) {
          const start = rival.mesh.position.clone();
          check(g.world.constrainToRoad(rival), 'Starting grid fits on the asphalt');
          const reference = {speed: 0, heading: 0, boost: 100};
          for (let tick = 0; tick < 60; tick++) {
            driveStep(reference, {gas: 1}, rival.spec, 1/60);
            const previous = rival.mesh.position.clone();
            g.updateAI(rival, 1/60);
            check(rival.speed <= reference.speed + 1e-8, 'Rival launch respects the car acceleration');
            check(previous.distanceTo(rival.mesh.position) <= rival.speed / 60 + 1e-6,
              'Rivals make no recovery jumps off the line');
          }
          check(rival.mesh.position.distanceTo(start) > 4, 'Rival moves off the grid');
        }
      }
      if(mode.id==='escape'){
        g.elapsed=90;g.updatePoliceHeat();g.updatePoliceHeat();
        check(g.actors.filter(a=>a.police).length===5,'Pursuit has five bounded police actors at full heat');
      }
      const p=g.player;
      if (mode.id === 'time') {
        const world = g.world, pos = p.mesh.position, start = pos.clone();
        for (const path of [world.samples, ...world.shortcutRoads.map(s => s.points)]) {
          for (const point of path) {
            pos.copy(point);
            check(world.constrainToRoad(p) && pos.equals(point), 'Main course and shortcuts stay open');
          }
        }
        // Beyond the overlapping return lane near the start of Dockyard.
        const middle = world.route[1].clone().lerp(world.route[2], .5);
        const forward = world.route[1].clone().sub(world.route[0]).normalize();
        for (const side of [-1, 1]) {
          const normal = forward.clone().set(-forward.z * side, 0, forward.x * side);
          pos.copy(middle).addScaledVector(normal, 18);
          p.velocityX = normal.x * 8 + forward.x * 6;
          p.velocityZ = normal.z * 8 + forward.z * 6;
          check(!world.constrainToRoad(p), 'Shoulder is off the asphalt');
          check(Math.abs(pos.distanceTo(middle) - 13.5) < 1e-6, 'Shoulder ends three metres past the asphalt');
          check(Math.hypot(p.velocityX - forward.x * 6, p.velocityZ - forward.z * 6) < 1e-6,
            'Sliding along the edge preserves forward motion');
          pos.addScaledVector(normal, -4);
          check(world.constrainToRoad(p), 'Driver can turn back onto the road');
        }
        const initialGate = p.next, initialHeading = p.mesh.rotation.y;
        const gate = world.route[initialGate];
        p.mesh.rotation.y = Math.atan2(gate.x - pos.x, gate.z - pos.z);
        check(g.routeCue().label === 'WRONG WAY', 'Head-up guidance warns when driving away');
        for (const road of world.shortcutRoads) {
          const entry = world.authorSegmentToRouteIndex(road.from);
          const afterEntry = (entry + 1) % world.route.length;
          const exit = world.authorSegmentToRouteIndex(road.to);
          p.next = afterEntry; p.cut = null;
          pos.copy(world.route[exit]); g.checkProgress(p);
          check(p.next === afterEntry && !p.cut, 'Jumping directly to a shortcut exit does not score');
          for (const point of road.points) { pos.copy(point); g.checkProgress(p); }
          check(!p.cut && p.next === (exit + 1) % world.route.length, 'Ordered route credited: ' + road.label);
          // Cast onto the actual rendered road triangles at both shoulders and the centre.
          const surfaces = world.group.children.filter((mesh) => mesh.material === world.roadMat);
          const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0), 0, 4);
          for (let i = 1; i < road.points.length; i++) {
            const a = road.points[i-1], b = road.points[i];
            const side = b.clone().sub(a).normalize();
            for (const offset of [-7, 0, 7]) {
              const mid = a.clone().lerp(b, .5);
              mid.x += side.z * offset; mid.z -= side.x * offset;
              const surface = (road.heightProfile[i-1] + road.heightProfile[i]) / 2;
              ray.ray.origin.set(mid.x, surface + 2, mid.z);
              check(ray.intersectObjects(surfaces, false).some(hit => Math.abs(hit.point.y - surface) < .3),
                road.label + ': rendered asphalt spans the full ramp width at segment ' + i);
            }
          }
          if (road.elevated) {
            let height = world.roadSurfaceY;
            for (let i = 1; i < road.points.length; i++) {
              for (let j = 1; j <= 16; j++) {
                const pt = road.points[i - 1].clone().lerp(road.points[i], j / 16);
                const next = world.getRoadHeightAt(pt.x, pt.z, height);
                check(Math.abs(next - height) < .9, 'Raised shortcut stays continuous: ' + road.label);
                height = next;
              }
              check(Math.abs(height - road.heightProfile[i]) < .15, 'Player rides the visible deck: ' + road.label);
            }
          }
        }
        const crossings = {neon:[[5,6],[18,19]], coast:[[5,6]], dock:[[3,5]], mesa:[[7,8]]};
        const decks = world.group.children.filter((m) => m.material?.color?.getHex() === 0x343d44);
        const down = new Raycaster(new Vector3(), new Vector3(0,-1,0), 0, 20);
        for (const [a,b] of crossings[map.id]) {
          const center = Math.round((a+b)/2 * world.samples.length/world.controlRoute.length);
          const mid = world.samples[center];
          const tangent = world.samples[center+1].clone().sub(world.samples[center-1]).normalize();
          for (const offset of [-55,-34,-16,0,16,34,55]) {
            down.ray.origin.set(mid.x + tangent.z*offset, 14, mid.z - tangent.x*offset);
            const height = 7.95 - Math.max(0, Math.abs(offset)-22)*7.9/38;
            check(down.intersectObjects(decks,false).some(hit => Math.abs(hit.point.y-height)<.15),
              'Flyover spans the spline and both sloping approaches: ' + map.id + ' / ' + offset);
          }
        }
        p.next = initialGate; p.cut = null; p.mesh.rotation.y = initialHeading;
        pos.copy(start);
      }
      g.checkProgress(p);check(p.lap===0,'Starting on the line does not finish a lap');
      const laps=mode.id==='cruise'?2:required;
      for(let lap=0;lap<laps;lap++){
        // Place at each gate to isolate progression from driving skill.
        for(let gate=0;gate<g.world.route.length;gate++){
          p.mesh.position.copy(g.world.route[p.next]);g.checkProgress(p);
        }
        check(p.lap===lap+1,'Each circuit counts exactly once');
        check(g.phase===(mode.id!=='cruise' && lap===required-1?'finished':'play'),`${mode.id}: correct finish lap`);
      }
      ui.updateHUD(g.hudState());
      if(mode.id==='cruise')check(document.querySelector('#position').textContent==='FREE DRIVE' && g.hudState().wanted===0,'Free Drive has no race or pursuit prompt');
      if(mode.id==='sprint')check(document.querySelector('#position').textContent.includes('LAP 1 / 1'),'Sprint shows one lap');
      if(competitive){
        ui.start();g.phase='play';const rival=g.actors[1];
        rival.lap=required-1;rival.next=0;rival.mesh.position.copy(g.world.route[0]);
        g.updateAI(rival,1/60);
        check(g.phase==='finished' && document.querySelector('.result h1').textContent.includes('RIVAL'),'A rival can win a competitive mode');
      }
      results.push({map:map.id,mode:mode.id,finish:mode.id==='cruise'?'open-ended':required});
    }
    const speeds=[];
    const original=Object.getOwnPropertyDescriptor(navigator,'getGamepads');
    try {
      for(const throttle of [.25,1]){
        ui.map=maps[0];ui.mode=modes.find(m=>m.id==='time');ui.vehicle=vehicles[0];ui.start();g.phase='play';
        const pad={axes:[0,0],buttons:Array.from({length:17},()=>({value:0,pressed:false}))};pad.buttons[7].value=throttle;
        Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[pad]});
        for(let i=0;i<60;i++)g.updatePlayer(1/60);
        speeds.push(g.player.speed);
      }
      check(speeds[0]>0 && speeds[1]>speeds[0]*1.5,'Analog trigger retains partial throttle');
    } finally {if(original)Object.defineProperty(navigator,'getGamepads',original);else delete navigator.getGamepads;}
    ui.exitToHome();return {cases:results,analog_trigger_speeds:speeds,scope:'Gate-placement progression fixtures and synthetic gamepad; not physical device acceptance'};
  });
  assert.deepEqual(errors,[]);console.log('MODE CONTRACTS PASS',JSON.stringify(result));
} finally {await browser?.close();server.kill();}
