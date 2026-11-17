import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { consolidateVehicle } from './rendering.js';

let templates, loading;
export function loadTouring() {
  if (loading) return loading;
  const loader=new GLTFLoader();
  loading = Promise.all(['touring.glb','touring-low.glb'].map(file=>
    loader.loadAsync(`${import.meta.env.BASE_URL}assets/touring/${file}`))).then(results => {
    templates=results.map(gltf=>gltf.scene);
    for(const template of templates) {
      consolidateVehicle(template);
      template.traverse(o => {
        if (!o.isMesh) return;
        delete o.geometry.userData.disposeWithActor;
        o.userData.vehiclePart = true;
        o.material.userData.sharedVehicle = true;
      });
    }
  });
  return loading;
}

export function createTouring(root, data, paint) {
  if (!templates) return false;
  const detail=new THREE.LOD();root.add(detail);
  data.headLights=[];data.brakeLights=[];data.bodies=[];
  const materials=new Map();
  templates.forEach((template,level)=>{
    const model=template.clone(true);
    detail.addLevel(model,level===0?0:28,.15);
    const body=model.getObjectByName('Chassis');data.bodies.push(body);
    if(level===0){data.body=body;data.bodyRest=body.position.y;}
    model.traverse(o=>{
      if(!o.isMesh)return;
      const name=o.material.name;
      if(name==='NS_paint')o.material=paint;
      else if(name==='NS_taillamp'||name==='NS_headlamp'){
        if(!materials.has(name)){
          const material=o.material.clone();material.userData={disposeWithActor:true};
          materials.set(name,material);
          (name==='NS_taillamp'?data.brakeLights:data.headLights).push(material);
        }
        o.material=materials.get(name);
      }
    });
    for(const name of ['Wheel_FL','Wheel_FR','Wheel_RL','Wheel_RR']){
      const pivot=model.getObjectByName(name),spin=new THREE.Group();
      for(const child of [...pivot.children])if(!child.name.endsWith('_Brake'))spin.add(child);
      pivot.add(spin);
      data.wheels.push({pivot,spin,front:name.includes('_F'),radius:.37186677,lod:level});
    }
  });
  data.detail=detail;
  data.asset='Mike Pan touring adaptation';
  return true;
}
