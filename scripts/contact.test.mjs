import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { modelFootprint, bodyContact, followingSpeed } from "../src/contact.js";

function vehicle(width, length, height = 1.5) {
  const car = new Group();
  const body = new Mesh(new BoxGeometry(width, height, length), new MeshBasicMaterial());
  body.position.y = height / 2;
  car.add(body);
  const shadow = new Mesh(new BoxGeometry(width + 2, .01, length + 2), new MeshBasicMaterial({transparent:true}));
  car.add(shadow);
  car.userData.footprint = modelFootprint(car);
  return car;
}

test("paint clearance, bumper contact and lane traffic use solid body dimensions", () => {
  const car = vehicle(2, 4.8), bus = vehicle(2.24, 7.8, 2.35);
  bus.position.x = 2.13;
  assert.equal(bodyContact(car,bus), null);
  bus.position.x = 2.10;
  const scrape = bodyContact(car,bus);
  assert.ok(scrape.nx < -.99 && Math.abs(scrape.depth - .02) < .001);
  assert.ok(Math.abs(scrape.x - .99) < .001);
  bus.position.set(0,0,6.11);
  const bumper = bodyContact(car,bus);
  assert.ok(bumper.nz < -.99 && bumper.depth > .18);
  bus.position.z = 6.31;
  assert.equal(bodyContact(car,bus), null);
  bus.scale.setScalar(.72);
  bus.position.set(1.82,0,0);
  assert.equal(bodyContact(car,bus), null);
  bus.position.x -= .04;
  assert.ok(bodyContact(car,bus));
});

test("a corner, an upper carriageway and a rotated long vehicle keep separate outlines", () => {
  const car = vehicle(2, 4.8), bus = vehicle(2.24,7.8,2.35);
  bus.rotation.y = Math.PI / 2;
  bus.position.set(4.88,0,3.50);
  assert.ok(bodyContact(car,bus));
  bus.position.x += .04;
  assert.equal(bodyContact(car,bus), null);
  bus.position.set(1.9,0,0);
  assert.ok(bodyContact(car,bus));
  bus.position.y = 6.65;
  assert.equal(bodyContact(car,bus), null);
  bus.rotation.y = Math.PI / 4;
  bus.position.set(4.30,0,-4.30);
  assert.equal(bodyContact(car,bus), null);
});

test("separate fixtures on a roadside barrier leave their actual opening passable", () => {
  const bike = vehicle(.8,2.3), barrier = new Group();
  for (const x of [-1.5,1.5]) {
    const post = new Mesh(new BoxGeometry(.45,2,.4),new MeshBasicMaterial());
    post.position.set(x,1,0); barrier.add(post);
  }
  const shapes = barrier.children.map(post => modelFootprint(post,barrier));
  assert.ok(shapes.every(shape => bodyContact(bike,barrier,shape) === null));
  bike.position.x = 1.35;
  assert.ok(bodyContact(bike,barrier,shapes[1]));
});

test("street traffic yields to a stopped bumper and keeps moving in other lanes and on other decks", () => {
  const driver = {mesh: vehicle(1.8,4), speed: 10}, stopped = {mesh: vehicle(2,4.6), speed:0};
  stopped.mesh.position.z = -9;
  const slowing = followingSpeed(driver, [driver,stopped]);
  assert.ok(slowing > 0 && slowing < driver.speed);
  stopped.mesh.position.z = -5.3;
  assert.equal(followingSpeed(driver,[stopped]), 0);
  assert.equal(bodyContact(driver.mesh,stopped.mesh), null);
  stopped.mesh.position.x = 3.2;
  assert.equal(followingSpeed(driver,[stopped]), Infinity);
  stopped.mesh.position.set(0,6.65,-5.3);
  assert.equal(followingSpeed(driver,[stopped]), Infinity);
});
