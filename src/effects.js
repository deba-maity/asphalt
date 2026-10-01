import * as THREE from 'three';

function particleTexture() {
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');const g=ctx.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(255,255,255,.78)');g.addColorStop(.22,'rgba(120,225,255,.42)');g.addColorStop(1,'rgba(70,130,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}

export class Effects {
  constructor(scene) { this.group=new THREE.Group();scene.add(this.group);this.pool=[];this.texture=particleTexture();for(let i=0;i<64;i++){const material=new THREE.SpriteMaterial({map:this.texture,transparent:true,depthWrite:false,opacity:0,blending:THREE.AdditiveBlending,color:0xaadfff});const sprite=new THREE.Sprite(material);sprite.visible=false;this.group.add(sprite);this.pool.push({sprite,life:0,velocity:new THREE.Vector3()});}this.cursor=0; }
  emit(origin,color,count=1,velocity=1,options={}) { const spread=options.spread??.7,baseScale=options.scale??.25,scaleJitter=options.scaleJitter??.34,lifeBase=options.life??.3,lifeJitter=options.lifeJitter??.45,lift=options.lift??.3,growth=options.growth??1.8,opacity=options.opacity??1,gravity=options.gravity??2.5;for(let i=0;i<count;i++){const p=this.pool[this.cursor++%this.pool.length],a=Math.random()*Math.PI*2;p.life=lifeBase+Math.random()*lifeJitter;p.max=p.life;p.growth=growth;p.opacity=opacity;p.gravity=gravity;p.sprite.visible=true;p.sprite.position.copy(origin);p.sprite.position.x+=(Math.random()-.5)*spread;p.sprite.position.z+=(Math.random()-.5)*spread;p.sprite.scale.setScalar(baseScale+Math.random()*scaleJitter);p.sprite.material.color.set(color);p.velocity.set(Math.cos(a)*velocity*(.3+Math.random()),lift+Math.random()*velocity*.3,Math.sin(a)*velocity*(.3+Math.random()));} }
  update(dt) { for(const p of this.pool){if(p.life<=0)continue;p.life-=dt;if(p.life<=0){p.sprite.visible=false;continue;}p.sprite.position.addScaledVector(p.velocity,dt);p.velocity.y-=(p.gravity??2.5)*dt;p.velocity.multiplyScalar(.97);p.sprite.material.opacity=Math.min(p.opacity??1,p.life/p.max*1.25*(p.opacity??1));p.sprite.scale.multiplyScalar(1+dt*(p.growth??1.8));} }
  dispose(){this.group.removeFromParent();this.group.traverse(o=>o.material?.dispose?.());this.texture?.dispose();}
}
