import * as THREE from 'three';

function particleTexture() {
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');const g=ctx.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(180,225,255,.85)');g.addColorStop(1,'rgba(120,180,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export class Effects {
  constructor(scene) { this.group=new THREE.Group();scene.add(this.group);this.pool=[];this.texture=particleTexture();for(let i=0;i<64;i++){const material=new THREE.SpriteMaterial({map:this.texture,transparent:true,depthWrite:false,opacity:0,blending:THREE.AdditiveBlending,color:0xaadfff});const sprite=new THREE.Sprite(material);sprite.visible=false;this.group.add(sprite);this.pool.push({sprite,life:0,velocity:new THREE.Vector3()});}this.cursor=0; }
  emit(origin,color,count=1,velocity=1) { for(let i=0;i<count;i++){const p=this.pool[this.cursor++%this.pool.length],a=Math.random()*Math.PI*2;p.life=.3+Math.random()*.45;p.max=p.life;p.sprite.visible=true;p.sprite.position.copy(origin);p.sprite.position.x+=(Math.random()-.5)*.7;p.sprite.position.z+=(Math.random()-.5)*.7;p.sprite.scale.setScalar(.25+Math.random()*.34);p.sprite.material.color.set(color);p.velocity.set(Math.cos(a)*velocity*(.3+Math.random()),.3+Math.random()*velocity*.3,Math.sin(a)*velocity*(.3+Math.random()));} }
  update(dt) { for(const p of this.pool){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.sprite.visible=false;continue;}p.sprite.position.addScaledVector(p.velocity,dt);p.velocity.y-=2.5*dt;p.velocity.multiplyScalar(.97);p.sprite.material.opacity=Math.min(1,p.life/p.max*1.5);p.sprite.scale.multiplyScalar(1+dt*1.8);} }
  dispose(){this.group.removeFromParent();this.group.traverse(o=>o.material?.dispose?.());this.texture?.dispose();}
}
