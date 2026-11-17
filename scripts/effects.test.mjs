import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Effects } from '../src/effects.js';
import { SkidTrails } from '../src/skid-trails.js';

test('continuous particle bursts reuse storage and fully expire after emission stops',()=>{
  const scene=new THREE.Scene(),effects=new Effects(scene),storage=effects.positions;
  const origin=new THREE.Vector3(2,1,3);
  for(let i=0;i<3600;i++){effects.emit(origin,0xffa050,20,4);effects.update(1/60);}
  assert.equal(effects.positions,storage);assert.equal(effects.pool.length,96);
  assert.equal(effects.geometry.attributes.position.count,96);
  assert([...effects.positions,...effects.sizes].every(Number.isFinite));
  for(let i=0;i<120;i++)effects.update(1/60);
  assert.equal(effects.group.visible,false);
  assert([...effects.alphas].every(a=>a===0));
  effects.dispose();assert.equal(scene.children.length,0);
});
test('tire marks are bounded, fade away, and never bridge a recovery teleport',()=>{
  const scene=new THREE.Scene(),trails=new SkidTrails(scene),mesh=new THREE.Group();
  mesh.userData.wheels=[-1,1].map(x=>({front:false,pivot:{position:new THREE.Vector3(x,.4,1.5)}}));
  const actor={mesh,onRoad:true},world={getRoadHeightAt:()=>0};
  for(let i=0;i<4000;i++){mesh.position.z=i*.2;trails.sample(actor,world,true);trails.update(1/60);}
  assert.equal(trails.geometry.attributes.position.count,384*6);
  const cursor=trails.cursor;mesh.position.x+=100;trails.sample(actor,world,true);
  assert.equal(trails.cursor,cursor,'No trail across a teleport');
  assert([...trails.positions].every(Number.isFinite));
  trails.sample(actor,world,false);
  for(let i=0;i<800;i++)trails.update(1/60);
  assert.equal(trails.mesh.visible,false);
  trails.dispose();assert.equal(scene.children.length,0);
});
