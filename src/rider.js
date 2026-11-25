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
  const rider={frame,group,lean:0,tuck:0,brace:0,footDown:1,arms:[],legs:[]};
  rider.hips=articulated(group,sphere,suit,[.25,.16,.23]);
  rider.torso=articulated(group,sphere,suit,[.255,.32,.145]);
  mesh(rider.torso,sphere,armor,[.20,.24,.05]).position.set(0,.025,.12);
  for (const side of [-1, 1]) {
    mesh(rider.torso, sphere, materials.chrome, [.075, .025, .058]).position.set(side*.159, .174, .102);
  }
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
  data.rider=rider;updateRider(data, 0, 0, false, false, 1/60);
}

export function updateRider(data, speed, steering, boosting, braking, dt) {
  const r = data.rider;
  if (!r) return;
  const pace = Math.abs(speed);
  const corner = -steering * Math.min(1, pace / 15);
  r.lean = damp(r.lean, corner, 7, dt);
  r.tuck = damp(r.tuck, (boosting ? .20 : .065) * Math.min(1, pace / 27), 5, dt);
  r.brace = damp(r.brace, braking ? Math.min(1, pace / 9) : 0, 9, dt);
  r.footDown = damp(r.footDown, 1 - THREE.MathUtils.smoothstep(pace, .65, 3.5), 9, dt);
  r.frame.rotation.x = -.038 * r.brace + .013 * Math.min(1, r.tuck * 5);
  r.frame.position.y = .64 - .029 * r.brace;
  const hipZ = data.spec.profile === "cruiser" ? .50 : .38;
  const hip = new THREE.Vector3(r.lean * .105 - r.footDown * .035, .70, hipZ + r.brace * .035);
  const shoulder = new THREE.Vector3(
    r.lean * .19, 1.10 - r.tuck * .63 + r.brace * .085, hipZ - .48 - r.tuck + r.brace * .11,
  );
  r.hips.position.copy(hip);
  r.torso.position.copy(hip).lerp(shoulder, .53);
  r.torso.quaternion.setFromUnitVectors(up, shoulder.clone().sub(hip).normalize());
  r.head.position.copy(shoulder).add(new THREE.Vector3(r.lean * .025, .23, -.12));
  r.head.rotation.set(-.12 + r.tuck * .28 - r.brace * .05, steering * .25, r.lean * .15);
  const inverseFrame = r.frame.quaternion.clone().invert();
  for (const arm of r.arms) {
    const start = shoulder.clone().add(new THREE.Vector3(arm.side * .22, -.04, 0));
    const hand = new THREE.Vector3(arm.side * .46, data.gripHeight - data.handlebars.position.y, .58)
      .applyQuaternion(data.handlebars.quaternion).add(data.handlebars.position)
      .sub(r.frame.position).applyQuaternion(inverseFrame);
    const elbow = start.clone().lerp(hand, .5).add(new THREE.Vector3(
      arm.side * (.07 + r.tuck * .18), -.11 + r.brace * .055, .06,
    ));
    link(arm.upper, start, elbow, .075);
    link(arm.lower, elbow, hand, .065);
    arm.elbow.position.copy(elbow);
    arm.glove.position.copy(hand);
  }
  for (const leg of r.legs) {
    const planted = leg.side < 0 ? r.footDown : 0;
    const inside = Math.max(0, r.lean * leg.side);
    const start = hip.clone().add(new THREE.Vector3(leg.side * .18, -.03, 0));
    const knee = new THREE.Vector3(leg.side * (.36 + inside * .16 + planted * .08), .38 - planted * .21, hipZ - .50 + planted * .16);
    const ankle = new THREE.Vector3(leg.side * (.36 + planted * .19), -.06 - planted * .45, hipZ - .12 - planted * .045);
    link(leg.upper, start, knee, .105);
    link(leg.lower, knee, ankle, .08);
    leg.knee.position.copy(knee);
    leg.boot.position.copy(ankle).add(new THREE.Vector3(0, -.02, -.10));
  }
}
