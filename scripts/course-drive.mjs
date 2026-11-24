// Drive a complete time trial using the regular throttle and steering inputs on each circuit.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
const url='http://127.0.0.1:5194';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5194',HMR_PORT:'24699',VITE_CACHE_DIR:'node_modules/.vite-drive'},stdio:'ignore',windowsHide:true});
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
  const result = await page.evaluate(async ({ modeId, district, trailing }) => {
    if (!['time', 'sprint', 'race'].includes(modeId)) throw Error('Choose time, sprint or race');
    const { maps, modes, vehicles } = await import('/src/data.js');
    const { game, ui } = window.__nightshift;
    game.clearPreview(); game.mountPreview = () => {}; game.frame = () => {}; game.audio.setEnabled(false);
    const laps = [];
    const goal = modeId === 'race' ? 3 : 1;
    for (const map of maps.filter((m) => !district || m.id === district)) {
      ui.map = map; ui.vehicle = vehicles[0]; ui.mode = modes.find((m) => m.id === modeId);
      ui.start(); game.phase = 'play';
      const world = game.world, player = game.player, points = [];
      const samplesPerJunction = world.samples.length / world.controlRoute.length;
      for (let i = 0; i < world.controlRoute.length; i++) {
        const shortcut = !trailing && modeId !== 'time' && world.shortcutRoads.find((road) => road.from === i);
        if (shortcut) {
          for (let j = 1; j < shortcut.points.length; j++) {
            const a = shortcut.points[j-1], b = shortcut.points[j];
            const count = Math.max(1, Math.ceil(a.distanceTo(b) / 7));
            for (let k = 0; k < count; k++) points.push(a.clone().lerp(b, k / count));
          }
          i = shortcut.to - 1;
        } else {
          points.push(...world.samples.slice(i * samplesPerJunction, (i + 1) * samplesPerJunction));
        }
      }
      let nearest = 0, ticks = 0, stalled = 0, lastGate, cornerCalls = 0, brakeCalls = 0;
      for (; ticks < 36000 * goal && game.phase === 'play'; ticks++) {
        const pos = player.mesh.position;
        let best = Infinity, found = nearest;
        for (let delta = -2; delta <= 6; delta++) {
          const i = (nearest + delta + points.length) % points.length;
          const distance = pos.distanceToSquared(points[i]);
          if (distance < best) { best = distance; found = i; }
        }
        nearest = found;
        let look = nearest, length = 0;
        while (length < Math.max(12, player.speed * .65)) {
          const next = (look + 1) % points.length;
          length += points[look].distanceTo(points[next]); look = next;
        }
        const target = points[look];
        const yaw = Math.atan2(pos.x - target.x, pos.z - target.z);
        const error = Math.atan2(Math.sin(yaw - player.mesh.rotation.y), Math.cos(yaw - player.mesh.rotation.y));
        const fast = !trailing && modeId !== 'time';
        const speed = Math.abs(error) > .45 ? 9 : trailing ? 12 : fast ? 47 : 23;
        game.keys = { KeyW: player.speed < speed, KeyS: player.speed > speed + 1, KeyA: error > .035, KeyD: error < -.035, ShiftLeft: fast && Math.abs(error) < .10 && player.speed > 24 };
        game.simulate(1 / 60);
        if (ticks % 45 === 0 && game.phase === 'play') {
          const cue = game.routeCue();
          if (cue.apex) cornerCalls++;
          if (cue.braking) brakeCalls++;
        }
        stalled = player.next === lastGate ? stalled + 1 : 0;
        lastGate = player.next;
        if (stalled > 90 * 60) {
          const nearby = game.actors.filter((a) => a !== player && a.mesh.position.distanceTo(pos) < 14);
          const obstacles = world.destructibles.filter((o) => o.userData.alive && o.position.distanceTo(pos) < 12);
          throw Error(JSON.stringify({map:map.id,modeId,gate:player.next,lap:player.lap,speed:player.speed,
            pos:pos.toArray(),nearest,look,target:target.toArray(),yaw:player.mesh.rotation.y,error,
            cut:player.cut?.road.label, onRoad:player.onRoad, velocity:[player.velocityX,player.velocityZ],
            closestRoads:[world.samples,...world.shortcutRoads.map(r=>r.points)].map(points=>Math.min(...points.map(p=>p.distanceTo(pos)))),
            nearby:nearby.map(a=>[a.name,a.next,a.speed,a.mesh.position.toArray()]),obstacles:obstacles.map(o=>o.position.toArray())}));
        }
      }
      if (player.lap !== goal || game.phase !== 'finished') {
        throw Error(map.id + ': stopped at gate ' + player.next + ', sample ' + nearest + ', position ' + player.mesh.position.toArray() + ', elapsed ' + game.elapsed + ', result ' + document.querySelector('.result h1')?.textContent);
      }
      const field = game.actors.filter((a) => a.role === 'race');
      if (field.some((a) => a.lap === 0 && a.next === 1)) throw Error('Rival stuck at the starting grid');
      let place = null;
      if (field.length) {
        const classified = [...document.querySelectorAll('.classification li')];
        place = classified.findIndex((row) => row.classList.contains('your-finish')) + 1;
        const finished = field.filter(a => a.finishedAt != null && a.finishedAt < player.finishedAt).length;
        if (place !== finished + 1 || (trailing && place <= 1)) throw Error('Incorrect earned place: ' + map.id + ' ' + place);
      }
      if (!cornerCalls) throw Error(map.id + ' completed without any advance corner guidance');
      laps.push({ map: map.id, cornerCalls, brakeCalls, place, rivals: field.map((a) => [a.lap, a.next]), mode: modeId, laps: player.lap, seconds: Math.round(ticks / 60), gatesPerLap: world.route.length });
      if (modeId === 'time') {
        ui.start();
        const replay = game.pace.reference;
        if (!replay || replay.frames.length < 100 || replay.splits[0] !== replay.duration) throw Error('Driven time trial missing replay or finish split');
        game.phase = 'play'; game.keys = {};
        for (let step = 0; step < 180; step++) game.simulate(1/60);
        if (!game.ghost.visible || game.actors.length !== 1 || game.ghost.position.distanceTo(game.player.mesh.position) < 4)
          throw Error('The saved pace did not drive away on the rematch');
        ui.updateHUD(game.hudState());
        if (!document.querySelector('#pace-note').textContent.includes('PACE')) throw Error('Replay pace missing from HUD');
      }
    }
    if (!laps.length) throw Error('District did not match a course');
    return laps;
  }, {modeId: process.argv[2] || "time", district: process.argv[3] === "all" ? undefined : process.argv[3], trailing: process.argv[4] === "trailing"});
  assert.deepEqual(errors, []); console.log('DRIVEN LAPS', JSON.stringify(result));
} finally { await browser?.close(); server.kill(); }
