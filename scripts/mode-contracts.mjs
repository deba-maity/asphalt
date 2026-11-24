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
    const renderFrame=g.frame.bind(g);
    g.clearPreview();g.mountPreview=()=>{};g.frame=()=>{};g.audio.setEnabled(false);
    // A scale reduction on slow hardware must leave the finished WebGL image on screen.
    ui.map=maps[0]; ui.mode=modes[0]; ui.start();
    g.phase='play'; g.applyQuality('battery');
    const gl=g.renderer.getContext();
    const initialWidth=gl.drawingBufferWidth;
    const initialScale=g.renderScale;
    function checkRaceImage(message) {
      const sample=new Uint8Array(4*4*4);
      gl.readPixels(Math.floor(gl.drawingBufferWidth/2), Math.floor(gl.drawingBufferHeight/2),
        4,4,gl.RGBA,gl.UNSIGNED_BYTE,sample);
      check(sample.some((value,index)=>index%4!==3 && value>0),message);
    }
    function drawAndCheck(stamp) {
      renderFrame(stamp);
      cancelAnimationFrame(g.animationFrame);
      checkRaceImage('An adaptive render-scale change cleared the finished race image');
    }
    g.qualityTimer=3; g.frameCost=100;
    const stamp=performance.now();
    drawAndCheck(stamp);
    check(g.renderScale<initialScale,'The slow frame requests a lower resolution');
    drawAndCheck(stamp+100);
    check(gl.drawingBufferWidth<initialWidth,'The next race frame uses the smaller drawing buffer');
    g.togglePause();
    g.resize();
    checkRaceImage('The paused race stays visible when the viewport resizes');
    ui.exitToHome();
    for(const map of maps)for(const mode of modes){
      ui.map=map;ui.mode=mode;ui.start();g.phase='play';g.elapsed=30;
      const competitive=['race','sprint'].includes(mode.id),required=mode.id==='race'?3:1;
      check(g.actors.length===(competitive?6:1),`${mode.id}: intended starting field`);
      if (competitive) {
        g.elapsed = 0;
        const referenceLaunch = { speed: 0, heading: g.player.heading, boost: 100 };
        // A driver reacting half a second after GO still has an open lane.
        for (let tick = 0; tick < 150; tick++) {
          g.keys.ArrowUp = tick >= 30;
          driveStep(referenceLaunch, { gas: g.keys.ArrowUp ? 1 : 0 }, g.player.spec, 1 / 60);
          g.simulate(1 / 60);
          check(Math.abs(g.player.speed - referenceLaunch.speed) < .001,
            map.name + ': the entire grid leaves room for a delayed player launch');
        }
        g.keys.ArrowUp = false;
        ui.start(); g.phase = 'play'; g.elapsed = 0;
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
        g.updatePoliceHeat(90);g.updatePoliceHeat();
        const police=g.actors.filter(a=>a.police);
        check(police.length===5,'Pursuit has five bounded police actors at full heat');
        const probe={role:'race',mesh:{position:new Vector3()}};
        let farthestOutsideShoulder=0;
        for(let frame=0;frame<900;frame++) {
          for(const car of police) {
            g.updateAI(car,1/60);
            probe.mesh.position.copy(car.mesh.position);
            g.world.constrainToRoad(probe);
            farthestOutsideShoulder=Math.max(farthestOutsideShoulder,
              Math.hypot(probe.mesh.position.x-car.mesh.position.x,probe.mesh.position.z-car.mesh.position.z));
          }
        }
        check(farthestOutsideShoulder<.05,map.id+': a pursuit car left the drivable shoulder by '+farthestOutsideShoulder.toFixed(1)+'m');
        check(g.pursuitContact,'A parked player can be reached on the same road');
        const hero=g.player, cop=police[0], start=hero.mesh.position.clone(), height=hero.surfaceY;
        hero.mesh.position.copy(cop.mesh.position);
        hero.mesh.position.y+=3.5; hero.surfaceY=cop.surfaceY+3.5;
        g.pursuitContact=false;
        g.updateAI(cop,1/60);
        check(!g.pursuitContact,'A unit below a flyover cannot damage the player above it');
        g.fireProjectile(hero, 'rocket');
        const shot = g.projectiles.at(-1);
        check(Math.abs(shot.mesh.position.y - hero.surfaceY - 1.35) < .001, 'The shot starts on the driver’s deck');
        shot.mesh.position.set(cop.mesh.position.x, hero.surfaceY + 1.35, cop.mesh.position.z);
        check(!g.hitProjectileActor(shot), 'A projectile on the flyover passes over a street patrol');
        hero.mesh.position.copy(cop.mesh.position); hero.surfaceY=cop.surfaceY;
        g.updateAI(cop,1/60);
        check(g.pursuitContact,'The same unit makes contact on the same deck');
        for (let hit = 0; hit < 2; hit++) {
          shot.mesh.position.set(cop.mesh.position.x, cop.surfaceY + 1, cop.mesh.position.z);
          check(g.hitProjectileActor(shot), 'The same-deck shot reaches the patrol');
        }
        g.pursuitContact = false;
        g.updateAI(cop, 1/60);
        check(cop.disabledFor > 0 && !g.pursuitContact, 'A disabled patrol withdraws from contact');
        for (const car of police) car.pursuitGap = 100 + 12 * car.patrolSlot;
        g.updatePoliceHeat(6);
        check(g.heat === 4 && g.pursuit.breakaways === 1 && police.at(-1).mesh.parent === null, 'Keeping a lead recalls the most distant unit');
        hero.mesh.position.copy(start); hero.surfaceY=height;
      }
      const p=g.player;
      ui.updateHUD(g.hudState());
      if(mode.id==='sprint')check(document.querySelector('#position').textContent.includes('LAP 1 / 1'),'Sprint shows one lap');
      if (mode.id === 'time') {
        const world = g.world, pos = p.mesh.position, start = pos.clone();
        world.group.updateMatrixWorld(true);
        const rails = world.group.children.filter(o => o.name === 'Bridge guardrail');
        const roofs = world.group.children.filter(o => o.name === 'Underpass roof');
        const seenRoofs = new Set();
        check(rails.length >= 2 && roofs.length, map.id + ' has rendered roadside structures');
        for (let i = 0; i < world.samples.length; i++) {
          const at = world.samples[i], next = world.samples[(i+1) % world.samples.length];
          const across = new Vector3(next.z-at.z,0,at.x-next.x).normalize();
          const ceiling = new Raycaster(new Vector3(at.x,1,at.z),new Vector3(0,1,0),.1,15);
          for (const hit of ceiling.intersectObjects(roofs,false)) {
            check(Math.abs(hit.point.y-10.8)<.01,'Visible underside has driving clearance');
            seenRoofs.add(hit.object);
          }
          for (const offset of [-5.3,0,5.3]) {
            const lane = at.clone().addScaledVector(across,offset); lane.y=3;
            const ray = new Raycaster(lane,new Vector3(0,-1,0),0,2.5);
            check(!ray.intersectObjects(rails,false).length,map.id+' guardrail crosses active lane at '+i+', offset '+offset);
          }
        }
        check(seenRoofs.size === roofs.length,map.id+' underpasses cover the actual road');
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
        if (map.id === "dock") {
          pos.set(-196.73, world.roadSurfaceY, -61.27); p.roadBranch = null;
          world.constrainToRoad(p);
          check(!p.roadBranch && Math.abs(pos.z + 82) <= 13.51, "Dockyard's back-road shoulder cannot trap the driver beside Container Cut");
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
          const mid = road.points[4].clone().lerp(road.points[5], .5);
          const probeActor = { mesh: {position: mid}, cut: {road, gate: 5} };
          const groundProgress = world.lapFraction(probeActor);
          mid.y += 6;
          check(Math.abs(world.lapFraction(probeActor) - groundProgress) < 1e-10, 'Timing progress is independent of deck height');
          if (road.elevated) {
            const a = road.points[1], b = road.points[2];
            probeActor.mesh.position = a.clone().lerp(b, .5);
            probeActor.mesh.rotation = {y: Math.atan2(a.x - b.x, a.z - b.z)};
            probeActor.surfaceY = (road.heightProfile[1] + road.heightProfile[2]) / 2;
            probeActor.roadBranch = road;
            g.fireProjectile(probeActor, 'bullet');
            const bullet = g.projectiles.at(-1);
            check(bullet.dir.y > 0 && bullet.mesh.position.y > probeActor.surfaceY + .9, 'An uphill shot follows the initial ramp slope');
          }
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
          if (competitive) g.elapsed+=1;
          const target = g.world.gatePosition(p.next);
          const forward = g.world.timingLines.get(p.next)?.forward ?? g.world.finishForward;
          p.mesh.position.copy(target);
          g.checkProgress(p, target.x - forward.x, target.z - forward.z);
          g.resolveRaceFinish();
        }
        check(p.lap===lap+1,'Each circuit counts exactly once');
        check(g.phase===(mode.id!=='cruise' && lap===required-1?'finished':'play'),`${mode.id}: correct finish lap`);
      }
      ui.updateHUD(g.hudState());
      if(mode.id==='cruise')check(document.querySelector('#position').textContent==='FREE DRIVE' && g.hudState().wanted===0,'Free Drive has no race or pursuit prompt');
      if(competitive){
        for (const gate of g.raceTiming.gates.slice(0,2)) {
          const {point,forward} = g.world.timingLines.get(gate);
          const before = point.clone().addScaledVector(forward,-1);
          const past = point.clone().addScaledVector(forward,1);
          check(Math.abs(g.world.timingFraction(gate,before.x,before.z,past)-.5) < 1e-8, 'Sector time interpolates the physical stripe');
          check(g.world.timingFraction(gate,past.x,past.z,before) === null, 'Reversing over a timing stripe does not earn a split');
        }
        check(document.querySelectorAll('.sector-sheet tbody tr').length===required,'A whole race has a timing row for every lap');
        check(document.querySelector('.result > span').textContent.includes('NEW BEST'),'Finishing establishes a solo reference time');
        ui.start();g.phase='play';const rival=g.actors[1];
        const line = g.world.finishLine, direction = g.world.finishForward;
        rival.lap = required - 1; rival.next = 0;
        rival.mesh.position.copy(line).addScaledVector(direction, -.05);
        rival.mesh.rotation.y = Math.atan2(-direction.x, -direction.z);
        rival.speed = 24; rival.velocityX = direction.x * 24; rival.velocityZ = direction.z * 24;
        g.elapsed = 40; g.updateAI(rival, 1/60);
        check(g.phase === 'play' && rival.finishedAt != null, 'Rivals can finish without ending the solo race');
        const player = g.player;
        player.lap = required - 1; player.next = 0; g.elapsed = 43;
        player.mesh.position.copy(line).addScaledVector(direction, -.25);
        g.checkProgress(player, player.mesh.position.x - direction.x, player.mesh.position.z - direction.z);
        check(player.next === 0 && player.finishedAt == null, 'The race stays live until the stripe is crossed');
        player.mesh.position.copy(line).addScaledVector(direction, .25);
        g.checkProgress(player, line.x - direction.x, line.z - direction.z);
        g.resolveRaceFinish();
        check(g.phase === 'finished' && document.querySelector('.result h1').textContent === 'SECOND PLACE', 'Player earns second place at the stripe');
        check(document.querySelector('.classification .your-finish').textContent.includes('+3.'), 'Standings show the gap to the winner');
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
      const pad = index => ({index, axes:[0,0], buttons:Array.from({length:17},()=>({value:0,pressed:false}))});
      const idle = pad(0), steering = pad(1);
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[idle,steering]});
      steering.buttons[14].pressed = true;
      g.keys = {}; g.player.steerInput = 0; g.updatePlayer(1/60);
      check(g.player.steerInput < 0 && g.readGamepad() === steering, 'The active controller can steer left on its D-pad');
      steering.buttons[14].pressed = false; steering.buttons[15].pressed = true;
      g.player.steerInput = 0; g.updatePlayer(1/60);
      check(g.player.steerInput > 0, 'D-pad right steers in the opposite direction');
      Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{throw new DOMException('Unavailable','SecurityError');}});
      g.keys = {ArrowLeft:true}; g.player.steerInput = 0; g.updatePlayer(1/60);
      check(g.player.steerInput < 0, 'Keyboard steering works when the browser restricts controller access');
    } finally {if(original)Object.defineProperty(navigator,'getGamepads',original);else delete navigator.getGamepads;}
    ui.exitToHome();return {cases:results,analog_trigger_speeds:speeds,scope:'Gate-placement progression fixtures and synthetic gamepad; not physical device acceptance'};
  });
  assert.deepEqual(errors,[]);console.log('MODE CONTRACTS PASS',JSON.stringify(result));
} finally {await browser?.close();server.kill();}
