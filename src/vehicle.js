import * as THREE from 'three';

const geo = {
  box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(1, 20, 14),
  tire: new THREE.CylinderGeometry(1, 1, 1, 18), rim: new THREE.CylinderGeometry(.66, .66, 1.025, 18),
  disc: new THREE.CylinderGeometry(.72, .72, .05, 18), torus: new THREE.TorusGeometry(1, .075, 7, 18),
  exhaust: new THREE.CylinderGeometry(.13, .17, .45, 10), flame: new THREE.ConeGeometry(.18, .72, 10)
};
const shared = {
  tire: new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: .58, metalness: .08 }),
  rim: new THREE.MeshStandardMaterial({ color: 0xc7d7e6, roughness: .18, metalness: .95 }),
  brake: new THREE.MeshStandardMaterial({ color: 0xff633a, emissive: 0xde1e12, emissiveIntensity: .6, roughness: .28, metalness: .45 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x172b43, metalness: .18, roughness: .04, transmission: .1, transparent: true, opacity: .88 }),
  carbon: new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: .28, metalness: .6 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xaabfd4, roughness: .12, metalness: 1 }),
  white: new THREE.MeshBasicMaterial({ color: 0xcff9ff }),
  red: new THREE.MeshBasicMaterial({ color: 0xff173e })
};

function part(parent, geometry, material, position, scale = [1,1,1], rotation) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function tube(parent, position, scale, material = shared.chrome, rotation = [0,0,0]) { return part(parent, geo.tire, material, position, scale, rotation); }
function paintMaterial(color) { return new THREE.MeshPhysicalMaterial({ color, metalness: .82, roughness: .18, clearcoat: .8, clearcoatRoughness: .16, emissive: color, emissiveIntensity: .035 }); }

function createWheel(parent, x, z, radius, data, front = false) {
  const pivot = new THREE.Group(); pivot.position.set(x, radius, z); parent.add(pivot);
  const spin = new THREE.Group(); pivot.add(spin);
  const tire = part(spin, geo.tire, shared.tire, [0,0,0], [radius,.34,radius], [0,0,Math.PI/2]);
  part(spin, geo.rim, shared.rim, [0,0,0], [radius*.68,.37,radius*.68], [0,0,Math.PI/2]);
  part(spin, geo.disc, shared.brake, [x > 0 ? -.385 : .385,0,0], [radius*.62,.7,radius*.62], [0,0,Math.PI/2]);
  part(parent, geo.torus, shared.carbon, [x, radius+.04,z], [radius*1.16,radius*1.16,1], [0,Math.PI/2,0]);
  data.wheels.push({ pivot, spin, tire, front });
}

function addLights(root, width, rear, data, kind = 'car') {
  const z = rear ? 2.42 : -2.42; const material = (rear ? shared.red : shared.white).clone();
  if (kind === 'bike') part(root, geo.box, material, [0,.86,z], [rear?.66:.5,.12,.09]);
  else { part(root, geo.box, material, [-width*.28,.74,z], [width*.32,.16,.10]); part(root, geo.box, material, [width*.28,.74,z], [width*.32,.16,.10]); }
  (rear ? data.brakeLights : data.headLights).push(material);
}
function addNitro(root, data, x, z) { const flame=part(root,geo.flame,new THREE.MeshBasicMaterial({color:0x45ddff,transparent:true,opacity:.86,depthWrite:false}),[x,.44,z],[1,1,1],[Math.PI/2,0,0]);flame.visible=false;data.flames.push(flame); }

function buildCar(root, spec, paint, data, police) {
  const profiles = { coupe:{w:2.18,l:4.75,h:.70,roof:.56,rear:.08,wing:true}, muscle:{w:2.34,l:4.98,h:.78,roof:.55,rear:.28,wing:false}, super:{w:2.28,l:4.88,h:.58,roof:.45,rear:-.08,wing:true}, hyper:{w:2.38,l:5.08,h:.50,roof:.40,rear:-.2,wing:true}, rally:{w:2.24,l:4.68,h:.93,roof:.55,rear:.10,wing:true} };
  const c=profiles[spec.profile]||profiles.coupe,r=spec.profile==='rally'?.57:.51,body=new THREE.Group();body.position.y=c.h+.05;root.add(body);
  // Curved layered panels, canopy, skirts and aero are intentionally visible from the chase view.
  part(body,geo.sphere,paint,[0,-.08,c.rear],[c.w*.52,c.h*.66,c.l*.48]);part(body,geo.box,paint,[0,-.14,-c.l*.15],[c.w*.88,c.h*.68,c.l*.48]);part(body,geo.box,shared.carbon,[0,-.36,-c.l*.43],[c.w*.92,.16,.46]);part(body,geo.box,shared.carbon,[0,-.28,c.l*.44],[c.w*.9,.22,.30]);
  part(body,geo.sphere,shared.glass,[0,c.roof,c.l*.05],[c.w*.36,c.h*.56,c.l*.27]);part(body,geo.box,paint,[0,.14,-c.l*.22],[c.w*.64,.08,c.l*.28],[-.08,0,0]);part(body,geo.box,shared.carbon,[-c.w*.48,-.19,.05],[.08,.18,c.l*.66]);part(body,geo.box,shared.carbon,[c.w*.48,-.19,.05],[.08,.18,c.l*.66]);
  part(body,geo.sphere,shared.carbon,[-c.w*.55,c.roof*.8,-.12],[.17,.09,.18]);part(body,geo.sphere,shared.carbon,[c.w*.55,c.roof*.8,-.12],[.17,.09,.18]);
  if(c.wing){part(body,geo.box,shared.carbon,[0,.7,c.l*.42],[c.w*.56,.08,.25]);part(body,geo.box,shared.carbon,[-c.w*.35,.48,c.l*.42],[.06,.34,.06]);part(body,geo.box,shared.carbon,[c.w*.35,.48,c.l*.42],[.06,.34,.06]);}
  for(const x of[-c.w*.45,c.w*.45])createWheel(root,x,-c.l*.28,r,data,true);for(const x of[-c.w*.45,c.w*.45])createWheel(root,x,c.l*.30,r,data,false);
  addLights(body,c.w,false,data);addLights(body,c.w,true,data);for(const x of[-c.w*.25,c.w*.25]){tube(body,[x,.03,c.l*.51],[.13,.13,.42],shared.chrome,[Math.PI/2,0,0]);addNitro(root,data,x,c.l*.59);}if(police)addPoliceBar(root,data,c.w);
}

function buildBike(root, spec, paint, data, police) {
  const profile=spec.profile||'sport',r=profile==='dirt'?.55:.47,frame=new THREE.Group();frame.position.y=.58;root.add(frame);
  part(frame,geo.sphere,paint,[0,.20,-.15],[.58,.38,.72]);part(frame,geo.sphere,paint,[0,.13,-.58],[.52,.28,.58]);part(frame,geo.box,shared.carbon,[0,.18,.58],[.50,.13,.78]);part(frame,geo.box,shared.carbon,[0,.02,.05],[.18,.16,1.75],[.18,0,0]);part(frame,geo.sphere,shared.glass,[0,.48,-.72],[.40,.28,.28]);
  const fork=new THREE.Group();fork.position.set(0,.25,-1.17);fork.rotation.x=profile==='cruiser'?-.18:-.34;root.add(fork);tube(fork,[-.18,0,0],[.07,.07,1.22]);tube(fork,[.18,0,0],[.07,.07,1.22]);part(fork,geo.box,shared.chrome,[0,.53,-.03],[1.0,.07,.08]);data.handlebars=fork;
  const front=createBikeWheel(root,0,-1.26,r,data,true);data.frontFork=front;createBikeWheel(root,0,.66,r,data,false);part(frame,geo.box,shared.red,[0,.33,1.08],[.45,.09,.08]);addLights(frame,.8,false,data,'bike');addLights(frame,.8,true,data,'bike');tube(frame,[.34,.06,.92],[.12,.12,.52],shared.chrome,[Math.PI/2,0,0]);addNitro(root,data,.25,1.15);if(police)addPoliceBar(root,data,.8);
}
function createBikeWheel(parent,x,z,r,data,front){const pivot=new THREE.Group();pivot.position.set(x,r,z);parent.add(pivot);const spin=new THREE.Group();pivot.add(spin);part(spin,geo.tire,shared.tire,[0,0,0],[r,.16,r],[0,0,Math.PI/2]);part(spin,geo.rim,shared.rim,[0,0,0],[r*.64,.18,r*.64],[0,0,Math.PI/2]);data.wheels.push({pivot,spin,front});return pivot;}

function buildInterceptor(root, spec, paint, data, police) { const w=2.55,l=5.25,r=.59,body=new THREE.Group();body.position.y=.74;root.add(body);part(body,geo.box,paint,[0,0,0],[w,.68,l]);part(body,geo.sphere,paint,[0,.31,.25],[w*.48,.55,l*.38]);part(body,geo.box,shared.carbon,[0,.18,-l*.48],[w*.95,.20,.36]);part(body,geo.box,shared.carbon,[0,.1,l*.50],[w*.98,.22,.25]);part(body,geo.box,shared.glass,[0,.64,.22],[w*.68,.38,1.75]);for(const x of[-w*.45,w*.45]){createWheel(root,x,-l*.29,r,data,true);createWheel(root,x,l*.29,r,data,false);}addLights(body,w,false,data);addLights(body,w,true,data);tube(body,[-w*.42,.15,-l*.56],[.07,.07,.85],shared.chrome,[Math.PI/2,0,0]);tube(body,[w*.42,.15,-l*.56],[.07,.07,.85],shared.chrome,[Math.PI/2,0,0]);addNitro(root,data,-.42,l*.6);addNitro(root,data,.42,l*.6);if(police||spec.kind==='heavy')addPoliceBar(root,data,w); }
function addPoliceBar(root,data,w){const bar=new THREE.Group();bar.position.set(0,1.55,.08);root.add(bar);const blue=new THREE.MeshBasicMaterial({color:0x1b7cff}),red=new THREE.MeshBasicMaterial({color:0xff1945});part(bar,geo.box,blue,[-w*.17,0,0],[w*.32,.12,.30]);part(bar,geo.box,red,[w*.17,0,0],[w*.32,.12,.30]);data.police=[blue,red];}

export function createVehicle(spec, color=spec.color||'#ff4b63', police=false) { const root=new THREE.Group(),data={spec,wheels:[],flames:[],headLights:[],brakeLights:[],police:null,paint:null,handlebars:null,frontFork:null};root.userData=data;const paint=paintMaterial(color);data.paint=paint;if(spec.kind==='bike')buildBike(root,spec,paint,data,police);else if(spec.kind==='heavy')buildInterceptor(root,spec,paint,data,police);else buildCar(root,spec,paint,data,police);root.userData.radius=spec.kind==='bike'?1.45:2.8;return root; }
export function animateVehicle(vehicle,speed,boosting,time,steering=0,braking=false,drifting=false){const d=vehicle.userData,spin=speed*.095;for(const wheel of d.wheels){wheel.spin.rotation.x-=spin;if(wheel.front)wheel.pivot.rotation.y=THREE.MathUtils.lerp(wheel.pivot.rotation.y,steering*.48,.2);}if(d.handlebars)d.handlebars.rotation.y=steering*.45;if(d.frontFork)d.frontFork.rotation.y=steering*.36;vehicle.rotation.z=THREE.MathUtils.lerp(vehicle.rotation.z,d.spec.kind==='bike'?-steering*.31:-steering*.10,.11);for(const light of d.headLights)light.color.setHex(0xd9f9ff);for(const light of d.brakeLights)light.color.setHex(braking?0xffeced:0xff2340);for(const flame of d.flames){flame.visible=boosting;flame.scale.setScalar(boosting?(.75+Math.sin(time*38)*.27):.01);}if(d.police)d.police.forEach((m,i)=>m.color.setHex((Math.floor(time*8+i)%2)?(i?0xff163c:0x1678ff):0x07111f));vehicle.userData.drifting=drifting;}
export function setVehicleColor(vehicle,color){const paint=vehicle.userData.paint;if(paint){paint.color.set(color);paint.emissive.set(color);}}
