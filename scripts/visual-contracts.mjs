import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const server=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'5179',HMR_PORT:'24684'},stdio:'ignore',windowsHide:true});
let browser;
try {
  for(let i=0;i<150;i++){try{if((await fetch('http://127.0.0.1:5179')).ok)break;}catch{}await delay(100);}
  browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:640,height:400}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('http://127.0.0.1:5179/scripts/asset-review.html');
  await page.waitForFunction(()=>window.ready,null,{timeout:90000});
  const report=await page.evaluate(async()=>{
    const THREE=await import('/node_modules/three/build/three.module.js');
    const {createVehicle,animateVehicle,alignVehicleToSurface,disposeVehicle}=await import('/src/vehicle.js');
    const {vehicles}=await import('/src/data.js');
    const {Effects}=await import('/src/effects.js');const {SkidTrails}=await import('/src/skid-trails.js');
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,1.6,.1,200);
    const renderer=new THREE.WebGLRenderer();renderer.setSize(480,300);
    scene.add(new THREE.HemisphereLight(0xffffff,0x333333,2));
    const results=[];
    for(const spec of vehicles) {
      const model=createVehicle(spec,spec.color);scene.add(model);
      let handError=0;
      for(let i=0;i<180;i++){
        animateVehicle(model,35,true,i/60,Math.sin(i/45)*.6,i>140,true,1/60);
        model.updateMatrixWorld(true);
        const data=model.userData;
        if(data.rider)for(const arm of data.rider.arms){
          const expected=new THREE.Vector3(arm.side*.46,data.gripHeight-data.handlebars.position.y,.58);
          data.handlebars.localToWorld(expected);
          handError=Math.max(handError,expected.distanceTo(arm.glove.getWorldPosition(new THREE.Vector3())));
        }
        model.traverse(o=>{if(!o.matrixWorld.elements.every(Number.isFinite))throw Error(`Invalid pose: ${spec.name}`);});
        if(data.bodies && data.bodies[0].quaternion.angleTo(data.bodies[1].quaternion)>.00001)throw Error('Detail levels disagree on suspension pose');
      }
      if(handError>.00001)throw Error(`Rider hands detach: ${spec.name} / ${handError}`);
      const data = model.userData;
      if (data.rider) {
        for(let i=0;i<75;i++) animateVehicle(model, 0, false, i/60, 0, false, false, 1/60);
        model.updateMatrixWorld(true);
        const foot = data.rider.legs[0].boot.getWorldPosition(new THREE.Vector3());
        if (data.rider.footDown < .99 || foot.y > .22) throw Error("Stopped rider cannot reach the ground: "+spec.name);
        for(let i=0;i<120;i++) animateVehicle(model, 29, false, i/60, -.85, true, false, 1/60);
        const braced = data.rider.torso.position.y;
        if (data.leanRig.rotation.z >= -.30 || data.rider.lean <= .68 || data.rider.footDown > .02)
          throw Error("Right turn must bank and move the rider toward the right: "+spec.name);
        for(let i=0;i<90;i++) animateVehicle(model, 42, true, i/60, 0, false, false, 1/60);
        if (braced - data.rider.torso.position.y < .06) throw Error("Rider braking and nitro poses overlap: "+spec.name);
      }
      if (data.activeWing) {
        for(let i=0;i<90;i++) animateVehicle(model, 40, false, i/60, 0, true, false, 1/60);
        if (data.activeWing.rotation.x > -.48) throw Error("Airbrake did not deploy: "+spec.name);
        for(let i=0;i<90;i++) animateVehicle(model, 40, false, i/60, 0, false, false, 1/60);
        if (data.activeWing.rotation.x < -.06) throw Error("Airbrake did not retract: "+spec.name);
      }
      model.rotation.y = .94;
      alignVehicleToSurface(model, 4.3, -.12, .15);
      model.updateMatrixWorld(true);
      const up = new THREE.Vector3(0,1,0).applyQuaternion(data.roadRig.getWorldQuaternion(new THREE.Quaternion()));
      if (up.distanceTo(new THREE.Vector3(.12,1,-.15).normalize())>.00001) throw Error("Ramp alignment changed with vehicle heading: "+spec.name);
      alignVehicleToSurface(model, 0);
      const bounds=new THREE.Box3().setFromObject(model);
      if(bounds.getSize(new THREE.Vector3()).length()>12)throw Error(`Exploded model: ${spec.name}`);
      results.push({name:spec.name,handError,wheels:model.userData.wheels.length});
      disposeVehicle(model);
    }
    const {Game} = await import('/src/game.js');
    const chase = {
      player: {mesh:new THREE.Group(), speed:48}, phase:"play", reducedMotion:false, shake:0,
      camera:new THREE.PerspectiveCamera(60,16/9,.1,550), cameraAnchor:new THREE.Vector3(),
      cameraVelocity:new THREE.Vector3(), cameraLook:new THREE.Vector3(), cameraReady:false,
    };
    for(let tick=0;tick<180;tick++){
      chase.player.mesh.position.z-=48/60;
      Game.prototype.updateCamera.call(chase,1/60);
    }
    const boom = chase.camera.position.z - chase.player.mesh.position.z;
    if(boom<7 || boom>9) throw Error("Chase camera loses the moving car: "+boom);
    chase.player.mesh.position.x+=16;
    Game.prototype.updateCamera.call(chase,1/60);
    if(Math.abs(chase.camera.position.x-chase.player.mesh.position.x)>.01) throw Error("Camera glides across a respawn");
    const streetCar=createVehicle(vehicles.find(v=>v.id==="car3"));
    scene.add(streetCar);
    camera.position.set(5,3,-8);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const closeStreet=renderer.info.render.triangles;
    camera.position.set(24,10,-60);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const farStreet=renderer.info.render.triangles;
    if(farStreet>=closeStreet*.23 || renderer.info.render.calls>10) throw Error("Distant street car still draws its close wheel assemblies");
    disposeVehicle(streetCar);
    const car=createVehicle(vehicles[0]);scene.add(car);scene.updateMatrixWorld(true);
    camera.position.set(5,3,-8);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const near=renderer.info.render.triangles;
    camera.position.set(24,10,-48);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const far=renderer.info.render.triangles;
    if(far>=near*.5)throw Error(`Distance mesh budget not reduced: ${near}/${far}`);
    const effects=new Effects(scene),skids=new SkidTrails(scene);
    effects.emit(new THREE.Vector3(0,1,0),0xffaa33,60,2);effects.update(.05);
    const actor={mesh:car,onRoad:true},world={roadSurfaceY:0};
    skids.sample(actor,world,true);car.position.z+=.5;skids.sample(actor,world,true);skids.update(.01);
    camera.position.set(5,3,-8);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const shaders=renderer.info.programs.length;
    effects.dispose();skids.dispose();disposeVehicle(car);renderer.dispose();renderer.forceContextLoss();
    return {fleet:results,triangles:{near,far,closeStreet,farStreet},shaders,scope:'Software-rendered asset contracts; no desktop window, native GPU or driving acceptance'};
  });
  assert.deepEqual(errors,[],'No shader or browser errors');
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/visual-contracts.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',fleet:report.fleet.length,triangles:report.triangles,shaders:report.shaders}));
} finally {await browser?.close();server.kill();}
