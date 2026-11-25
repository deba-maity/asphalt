import * as THREE from "three";

// Unit wheel with its axle along X. Scale X by tyre width and Y/Z by
// rolling radius so vans and sports cars retain the same mounting points.
function lathe(section, sides = 32) {
  const curve = section.map(([axle, radius]) => new THREE.Vector2(radius, axle));
  return new THREE.LatheGeometry(curve, sides).rotateZ(-Math.PI / 2);
}

function forgedSpokes() {
  const points = [], indices = [];
  function web(angle, foot, toe, sweep, innerWidth, outerWidth) {
    const first = points.length / 3;
    for (const depth of [-.040, .018]) {
      for (const [r, turn] of [[foot,-innerWidth],[toe,sweep-outerWidth],[toe,sweep+outerWidth],[foot,innerWidth]]) {
        const theta=angle+turn;
        points.push(depth+.040*(1-r),r*Math.cos(theta),r*Math.sin(theta));
      }
    }
    for (const quad of [[4,5,6,7],[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) {
      const [a,b,c,d]=quad.map(i=>first+i);
      indices.push(a,b,c,a,c,d);
    }
  }
  for (let i=0;i<5;i++) {
    const angle=i*2*Math.PI/5;
    web(angle,.16,.44,.05,.22,.12);
    for (const side of [-1,1]) web(angle+.05,.41,.727,side*.14,.105,.045);
  }
  const mesh=new THREE.BufferGeometry();
  mesh.setAttribute("position",new THREE.Float32BufferAttribute(points,3));
  mesh.setAttribute("uv",new THREE.Float32BufferAttribute(new Array(points.length/3*2).fill(0),2));
  mesh.setIndex(indices);mesh.computeVertexNormals();
  return mesh;
}

export const wheelArt = {
  tyre: lathe([[-.47,.705],[-.505,.752],[-.51,.84],[-.462,.947],[-.36,.992],[-.27,1.0],[.27,1.0],[.36,.992],[.462,.947],[.51,.84],[.505,.752],[.47,.705],[-.47,.705]]),
  barrel: lathe([[-.485,.733],[-.49,.766],[-.43,.772],[.43,.772],[.49,.766],[.485,.733],[.42,.703],[-.42,.703],[-.485,.733]]),
  rotor: lathe([[-.019,.153],[-.019,.605],[.019,.605],[.019,.153],[-.019,.153]]),
  spokes: forgedSpokes(),
};
