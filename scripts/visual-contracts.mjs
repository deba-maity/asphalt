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
    const {createVehicle,animateVehicle,disposeVehicle}=await import('/src/vehicle.js');
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
      const bounds=new THREE.Box3().setFromObject(model);
      if(bounds.getSize(new THREE.Vector3()).length()>12)throw Error(`Exploded model: ${spec.name}`);
      results.push({name:spec.name,handError,wheels:model.userData.wheels.length});
      disposeVehicle(model);
    }
    const car=createVehicle(vehicles[0]);scene.add(car);scene.updateMatrixWorld(true);
    camera.position.set(5,3,-8);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const near=renderer.info.render.triangles;
    camera.position.set(24,10,-48);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const far=renderer.info.render.triangles;
    if(far>=near*.5)throw Error(`Distance mesh budget not reduced: ${near}/${far}`);
    const effects=new Effects(scene),skids=new SkidTrails(scene);
    effects.emit(new THREE.Vector3(0,1,0),0xffaa33,60,2);effects.update(.05);
    const actor={mesh:car,onRoad:true},world={getRoadHeightAt:()=>0};
    skids.sample(actor,world,true);car.position.z+=.5;skids.sample(actor,world,true);skids.update(.01);
    camera.position.set(5,3,-8);camera.lookAt(0,.6,0);renderer.render(scene,camera);
    const shaders=renderer.info.programs.length;
    effects.dispose();skids.dispose();disposeVehicle(car);renderer.dispose();renderer.forceContextLoss();
    return {fleet:results,triangles:{near,far},shaders,scope:'Software-rendered asset contracts; no desktop window, native GPU or driving acceptance'};
  });
  assert.deepEqual(errors,[],'No shader or browser errors');
  await mkdir('artifacts',{recursive:true});await writeFile('artifacts/visual-contracts.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({result:'PASS',fleet:report.fleet.length,triangles:report.triangles,shaders:report.shaders}));
} finally {await browser?.close();server.kill();}
