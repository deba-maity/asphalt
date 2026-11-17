import * as THREE from 'three';
import { damp } from './timing.js';

const sphere=new THREE.SphereGeometry(1,16,10);
const limb=new THREE.CylinderGeometry(.88,1,1,12);
const visor=new THREE.SphereGeometry(1,20,10,Math.PI*1.05,Math.PI*.9,Math.PI*.31,Math.PI*.26);
const up=new THREE.Vector3(0,1,0);
function mesh(parent,geometry,material,scale) {
  const result=new THREE.Mesh(geometry,material);result.scale.set(...scale);
  result.userData.vehiclePart=true;parent.add(result);return result;
}
function articulated(parent,geometry,material,scale) {
  const joint=new THREE.Group();parent.add(joint);
  mesh(joint,geometry,material,scale);return joint;
}
function link(object,a,b,radius) {
  object.position.copy(a).add(b).multiplyScalar(.5);
  const direction=b.clone().sub(a);
  object.quaternion.setFromUnitVectors(up,direction.clone().normalize());
  object.scale.set(radius,direction.length(),radius);
}

export function createRider(frame,data,materials) {
  const group=new THREE.Group();frame.add(group);
  const {riderSuit:suit,riderArmor:armor,glass,rubber}=materials;
  const rider={frame,group,lean:0,tuck:0,arms:[],legs:[]};
  rider.hips=articulated(group,sphere,suit,[.25,.16,.23]);
  rider.torso=articulated(group,sphere,suit,[.255,.32,.145]);
  mesh(rider.torso,sphere,armor,[.20,.24,.05]).position.set(0,.025,.12);
  rider.head=new THREE.Group();group.add(rider.head);
  mesh(rider.head,sphere,armor,[.205,.23,.235]);
  mesh(rider.head,visor,glass,[.21,.235,.242]).position.z=-.006;
  mesh(rider.head,sphere,armor,[.18,.085,.17]).position.set(0,-.13,-.10);
  for(const side of [-1,1]) {
    const arm={side,upper:articulated(group,limb,suit,[1,1,1]),lower:articulated(group,limb,suit,[1,1,1]),
      elbow:articulated(group,sphere,armor,[.085,.09,.09]),glove:articulated(group,sphere,rubber,[.09,.07,.10])};
    rider.arms.push(arm);
    const leg={side,upper:articulated(group,limb,suit,[1,1,1]),lower:articulated(group,limb,suit,[1,1,1]),
      knee:articulated(group,sphere,armor,[.105,.115,.10]),boot:articulated(group,sphere,rubber,[.115,.10,.22])};
    rider.legs.push(leg);
  }
  data.rider=rider;updateRider(data,0,0,false,1/60);
}

export function updateRider(data,speed,steering,boosting,dt) {
  const r=data.rider;if(!r)return;
  r.lean=damp(r.lean,steering*Math.min(1,Math.abs(speed)/15),7,dt);
  r.tuck=damp(r.tuck,(boosting?.12:.04)*Math.min(1,Math.abs(speed)/30),5,dt);
  const hipZ=data.spec.profile==='cruiser'?.50:.38;
  const hip=new THREE.Vector3(r.lean*.035,.70,hipZ);
  const shoulder=new THREE.Vector3(r.lean*.13,1.10-r.tuck*.45,hipZ-.48-r.tuck);
  r.hips.position.copy(hip);
  r.torso.position.copy(hip).lerp(shoulder,.53);
  r.torso.quaternion.setFromUnitVectors(up,shoulder.clone().sub(hip).normalize());
  r.head.position.copy(shoulder).add(new THREE.Vector3(r.lean*.02,.23,-.12));
  r.head.rotation.set(-.12-r.tuck*.3,steering*.16,-r.lean*.10);
  for(const arm of r.arms) {
    const start=shoulder.clone().add(new THREE.Vector3(arm.side*.22,-.04,0));
    const hand=new THREE.Vector3(arm.side*.46,data.gripHeight-data.handlebars.position.y,.58)
      .applyQuaternion(data.handlebars.quaternion).add(data.handlebars.position).sub(r.frame.position);
    const elbow=start.clone().lerp(hand,.5).add(new THREE.Vector3(arm.side*.07,-.11,.06));
    link(arm.upper,start,elbow,.075);link(arm.lower,elbow,hand,.065);
    arm.elbow.position.copy(elbow);arm.glove.position.copy(hand);
  }
  for(const leg of r.legs) {
    const start=hip.clone().add(new THREE.Vector3(leg.side*.18,-.03,0));
    const knee=new THREE.Vector3(leg.side*(.36+Math.max(0,r.lean*leg.side)*.04),.38,hipZ-.50);
    const ankle=new THREE.Vector3(leg.side*.36,-.06,hipZ-.12);
    link(leg.upper,start,knee,.105);link(leg.lower,knee,ankle,.08);
    leg.knee.position.copy(knee);leg.boot.position.copy(ankle).add(new THREE.Vector3(0,-.02,-.10));
  }
}
