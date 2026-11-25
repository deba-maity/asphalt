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
  mesh.userData.wheels=[-1,1].map(x=>{
    const pivot = new THREE.Group();
    pivot.position.set(x,.4,1.5);
    mesh.add(pivot);
    return {front:false,pivot,radius:.4};
  });
  const actor={mesh,onRoad:true},world={roadSurfaceY:0};
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

test('drift smoke follows the two rear contact patches while boost leaves from the nozzles',()=>{
  const scene = new THREE.Scene(), mesh = new THREE.Group(), effects = new Effects(scene);
  scene.add(mesh);
  mesh.position.set(6,3,2);
  mesh.rotation.y = Math.PI/2;
  const socket = (x,z) => {
    const node = new THREE.Group(); node.position.set(x,.4,z); mesh.add(node); return node;
  };
  mesh.userData.wheels = [
    {front:true, pivot:socket(-1,-1), radius:.4},
    {front:false, pivot:socket(-1,1), radius:.4},
    {front:false, pivot:socket(1,1), radius:.4},
    {front:false, pivot:socket(1,1), radius:.4, lod:1}
  ];
  mesh.userData.flames = [socket(-.5,2),socket(.5,2)];
  const actor = {mesh,spec:{kind:'car'},velocityX:4,velocityZ:8};
  effects.tireSpray(actor,'mesa',true,false);
  assert.equal(effects.cursor,2);
  const near = (value,target) => assert.ok(Math.abs(value-target)<.08);
  near(effects.positions[0],7); near(effects.positions[2],3);
  near(effects.positions[3],7); near(effects.positions[5],1);
  assert.equal(effects.styles[0]>0 && effects.styles[1]>0,true);
  effects.exhaust(actor,false);
  assert.equal(effects.cursor,4);
  near(effects.positions[6],8); near(effects.positions[8],2.5);
  assert.equal(effects.styles[2],0);
  effects.dispose();
});
