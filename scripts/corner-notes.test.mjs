import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { maps, vehicles } from "../src/data.js";
import { sampleHybridClosedRoute } from "../src/course-shape.js";
import { courseCorners, approachingCorner } from "../src/corner-notes.js";

test("each circuit warns about upcoming corners before the driver crosses a gate", () => {
  for (const map of maps) {
    const control = map.route.map(([x,z]) => new THREE.Vector3(x,0,z));
    const samples = sampleHybridClosedRoute(control, map.id === "neon" ? 22 : 18, map.straightSegments);
    const distances=[0];
    samples.forEach((p,i)=>distances.push(distances.at(-1)+p.distanceTo(samples[(i+1)%samples.length])));
    const notes=courseCorners(samples,distances,control.length);
    assert.ok(notes.length >= 3, map.id);
    const severe=notes.find(n=>n.angle>1.2);
    assert.ok(severe, map.id);
    const cue=approachingCorner(notes,severe.distance-9,distances.at(-1),40,vehicles[0]);
    assert.equal(cue.bend,severe);
    assert.equal(cue.distance,9);
    assert.ok(cue.braking);
    assert.equal(approachingCorner(notes,severe.distance-9,distances.at(-1),0,vehicles[0]).braking,false);
  }
});

test("upcoming turn directions match a driven left and right and wrap over the lap seam", () => {
  const right = {distance:12,label:"TURN RIGHT",angle:1.5,radius:24};
  const left = {distance:350,label:"TURN LEFT",angle:1.2,radius:33};
  assert.equal(approachingCorner([left,right],992,1000,20,vehicles[0]).bend,right);
  assert.equal(approachingCorner([left,right],250,1000,4,vehicles[0]), null);
  const route = [[0,0],[0,-100],[-100,-100],[-100,0]].map(([x,z])=>new THREE.Vector3(x,0,z));
  function turns(controls) {
    const points=sampleHybridClosedRoute(controls,18,[0,1,2,3]);
    const dist=[0];
    points.forEach((p,i)=>dist.push(dist.at(-1)+p.distanceTo(points[(i+1)%points.length])));
    return courseCorners(points,dist,controls.length);
  }
  assert.ok(turns(route).every(note=>note.label.endsWith("LEFT")));
  assert.ok(turns([...route].reverse()).every(note=>note.label.endsWith("RIGHT")));
});
