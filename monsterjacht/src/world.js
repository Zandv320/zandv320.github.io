/* Het eiland: grond, water, zones, natuurprops (Gobkit Nature Kit, CC0) en obstakels. */
import * as THREE from 'three';
import {laad,bbox,maakToon} from './assets.js';

export const EILAND_R=92;
export const ZONE_KLEUR={weide:'#7fd65c',strand:'#f2dc9a',rots:'#b4a48a',bos:'#4fa84a',top:'#8d79b8',kamp:'#9be07a'};

export function zoneOp(x,z){
  const r=Math.hypot(x,z);if(r<17)return'kamp';
  const a=Math.atan2(x,-z);const d=a*180/Math.PI;
  if(d>-45&&d<=45)return'weide';if(d>45&&d<=135)return'strand';
  if(d>135||d<=-135)return r>62?'top':'rots';return'bos';
}

/* Eenvoudige, deterministische ruis zodat het eiland bij iedereen hetzelfde is. */
let seed=1337;export function rnd(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646}

export class Wereld{
  constructor(scene){this.scene=scene;this.obstakels=[];this.graspatches=[];this.wolken=[];this.props=[];}

  async bouw(){
    const s=this.scene;
    // Grond: vlak met zachte strandhelling naar het water
    const N=120,W=240;const g=new THREE.PlaneGeometry(W,W,N,N);g.rotateX(-Math.PI/2);
    const pos=g.attributes.position,col=new Float32Array(pos.count*3);const c=new THREE.Color();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);
      let y=0;if(r>EILAND_R)y=-(r-EILAND_R)*0.45;if(r>EILAND_R+8)y=-3.6-(r-EILAND_R-8)*0.1;
      pos.setY(i,y);
      let zone=r>EILAND_R-6?'strand':zoneOp(x,z);
      c.set(ZONE_KLEUR[zone]);
      // zachte overgangen en wat variatie
      const v=(Math.sin(x*0.35)*Math.cos(z*0.31)+Math.sin(x*0.07+z*0.11))*0.035;c.offsetHSL(0,0,v);
      if(r>EILAND_R+4)c.set('#d9c58a');
      col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    }
    g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeVertexNormals();
    const grond=new THREE.Mesh(g,new THREE.MeshToonMaterial({vertexColors:true}));grond.receiveShadow=true;grond.name='grond';s.add(grond);this.grond=grond;

    // Water
    const water=new THREE.Mesh(new THREE.CircleGeometry(400,64),new THREE.MeshToonMaterial({color:'#4fb3ff',transparent:true,opacity:0.85}));
    water.rotation.x=-Math.PI/2;water.position.y=-0.9;s.add(water);this.water=water;

    // Natuurprops laden
    const namen=['TreeHigh001','TreeHigh002','TreeHigh003','TreeMed001','TreeMed002','TreeMed003','TreeLow001','TreeLow002','TreeLow003','TreeLow004','Bush001','Bush002','Rock001','Rock002','Rock003','Grass001','Grass002','Grass003','Reed001','Reed002','Cloud001','Cloud002','Cloud003','Mountain001','Mountain002','Mountain003','MountainFar001','MountainFar002','MountainFar003','Hill001','Hill002','Hill003','HillSand001','Stalactite001','Stalactite002','Cliff001','Cliff002'];
    const lib={};
    await Promise.all(namen.map(async n=>{const g=await laad('models/nature/'+n+'.glb');const m=g.scene;const b=bbox(m);const sz=b.getSize(new THREE.Vector3());
      lib[n]={scene:m,h:sz.y,w:Math.max(sz.x,sz.z),minY:b.min.y,cx:(b.min.x+b.max.x)/2,cz:(b.min.z+b.max.z)/2}}));
    this.lib=lib;

    const instanties={};const tmp=new THREE.Object3D();
    const plaats=(n,x,z,hoogte,rotY,obst,y=0,los=false)=>{
      const L=lib[n];const k=hoogte/L.h;
      tmp.position.set(x-L.cx*k,y-L.minY*k,z-L.cz*k);tmp.rotation.set(0,rotY,0);tmp.scale.setScalar(k);tmp.updateMatrix();
      if(obst)this.obstakels.push({x,z,r:obst});
      if(los){const m=L.scene.clone(true);m.position.copy(tmp.position);m.rotation.y=rotY;m.scale.setScalar(k);s.add(m);this.props.push(m);return m}
      (instanties[n]=instanties[n]||[]).push(tmp.matrix.clone());return null;
    };
    this.bouwInstanties=()=>{
      for(const n of Object.keys(instanties)){const L=lib[n];const mats=instanties[n];L.scene.updateMatrixWorld(true);
        L.scene.traverse(o=>{if(!o.isMesh)return;const im=new THREE.InstancedMesh(o.geometry,o.material,mats.length);const lokaal=o.matrixWorld.clone();const m=new THREE.Matrix4();
          mats.forEach((M,i)=>{m.multiplyMatrices(M,lokaal);im.setMatrixAt(i,m)});im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;s.add(im);this.props.push(im)})}
    };
    this.plaats=plaats;
    const pick=a=>a[Math.floor(rnd()*a.length)];

    // Verre bergen en heuvels in het water rond het eiland
    for(let i=0;i<14;i++){const a=i/14*Math.PI*2+rnd()*0.3;const r=118+rnd()*30;plaats(pick(['MountainFar001','MountainFar002','MountainFar003','Mountain001','Mountain002','Mountain003']),Math.sin(a)*r,-Math.cos(a)*r,18+rnd()*22,rnd()*6.28,0,-3)}
    // Heuvels aan de rand van het eiland (niet beloopbaar: obstakel)
    for(let i=0;i<10;i++){const a=rnd()*Math.PI*2;const r=76+rnd()*8;const zone=zoneOp(Math.sin(a)*r,-Math.cos(a)*r);if(zone==='strand')continue;plaats(pick(['Hill001','Hill002','Hill003']),Math.sin(a)*r,-Math.cos(a)*r,5+rnd()*4,rnd()*6.28,7)}
    // Schemertop: rotsen en stalactieten als 'bergtoppen' in het zuiden
    for(let i=0;i<9;i++){const x=(rnd()-0.5)*40,z=66+rnd()*20;plaats(pick(['Stalactite001','Stalactite002','Cliff001','Cliff002']),x,z,5+rnd()*7,rnd()*6.28,2.2)}

    // Bomen per zone
    const bomen={weide:['TreeLow001','TreeLow002','TreeMed001'],bos:['TreeHigh001','TreeHigh002','TreeHigh003','TreeMed002','TreeMed003'],rots:['TreeLow003','TreeLow004'],top:['TreeHigh003'],strand:['TreeLow004'],kamp:['TreeMed001']};
    const dicht={weide:55,bos:150,rots:40,top:16,strand:14,kamp:0};
    for(const zone of Object.keys(dicht)){let n=0,tries=0;while(n<dicht[zone]&&tries<4000){tries++;
      const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*(EILAND_R-8);const x=Math.sin(a)*r,z=-Math.cos(a)*r;
      if(zoneOp(x,z)!==zone||Math.hypot(x,z)<20)continue;if(this.botst(x,z,2.2))continue;
      const t=pick(bomen[zone]);const h=zone==='bos'?6+rnd()*5:3+rnd()*3;plaats(t,x,z,h,rnd()*6.28,0.7);n++}}
    // Struiken en rotsen
    for(let i=0;i<120;i++){const a=rnd()*Math.PI*2,r=Math.sqrt(rnd())*(EILAND_R-6);const x=Math.sin(a)*r,z=-Math.cos(a)*r;if(Math.hypot(x,z)<14||this.botst(x,z,1.5))continue;
      const zone=zoneOp(x,z);if(zone==='strand'||zone==='rots'||zone==='top'){plaats(pick(['Rock001','Rock002','Rock003']),x,z,0.8+rnd()*1.6,rnd()*6.28,1.0)}else plaats(pick(['Bush001','Bush002']),x,z,0.9+rnd()*0.9,rnd()*6.28,0.8)}
    // Riet langs de kust
    for(let i=0;i<60;i++){const a=rnd()*Math.PI*2,r=EILAND_R-4+rnd()*5;plaats(pick(['Reed001','Reed002']),Math.sin(a)*r,-Math.cos(a)*r,1.2+rnd()*0.8,rnd()*6.28,0)}
    // Wolken
    for(let i=0;i<16;i++){const m=plaats(pick(['Cloud001','Cloud002','Cloud003']),(rnd()-0.5)*220,(rnd()-0.5)*220,4+rnd()*5,rnd()*6.28,0,18+rnd()*14,true);m.userData.v=0.4+rnd()*0.6;this.wolken.push(m)}

    // Hoog gras: patches waar wilde monsters leven
    const patchesPerZone={weide:6,strand:5,bos:6,rots:5,top:3};
    for(const zone of Object.keys(patchesPerZone)){let n=0,tries=0;while(n<patchesPerZone[zone]&&tries<3000){tries++;
      const a=rnd()*Math.PI*2,r=22+Math.sqrt(rnd())*(EILAND_R-32);const x=Math.sin(a)*r,z=-Math.cos(a)*r;
      if(zoneOp(x,z)!==zone)continue;const pr=6+rnd()*4;
      if(this.graspatches.some(p=>Math.hypot(p.x-x,p.z-z)<p.r+pr+4))continue;
      this.graspatches.push({x,z,r:pr,zone});n++;
      // polletjes
      const k=Math.round(pr*pr*0.32);for(let j=0;j<k;j++){const aa=rnd()*6.28,rr=Math.sqrt(rnd())*pr;const gx=x+Math.sin(aa)*rr,gz=z+Math.cos(aa)*rr;if(this.botst(gx,gz,0.9))continue;plaats(pick(['Grass001','Grass002','Grass003']),gx,gz,0.5+rnd()*0.35,rnd()*6.28,0)}
    }}

    // Rustplek in het kamp: grote boom met een kring van rotsen en bloemen
    plaats('TreeHigh001',0,-2,11,0.3,1.2);
    for(let i=0;i<10;i++){const a=i/10*6.283;plaats(pick(['Rock001','Rock002']),Math.sin(a)*6,Math.cos(a)*6-2,0.7,a,0.6)}
    for(let i=0;i<24;i++){const a=rnd()*6.283,r=2+rnd()*3;plaats(pick(['Grass001','Grass002']),Math.sin(a)*r,Math.cos(a)*r-2,0.5,rnd()*6.28,0)}
    // Gloeiende genezingskring
    const ring=new THREE.Mesh(new THREE.RingGeometry(3.4,4.4,48),new THREE.MeshBasicMaterial({color:'#9bffb0',transparent:true,opacity:0.55,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.set(0,0.03,-2);s.add(ring);this.ring=ring;
    this.bouwInstanties();
    grond.material.userData.outlineParameters={visible:false};water.material.userData.outlineParameters={visible:false};ring.material.userData.outlineParameters={visible:false};
  }

  botst(x,z,r){return this.obstakels.some(o=>Math.hypot(o.x-x,o.z-z)<o.r+r)}

  /* Duwt een positie uit obstakels en houdt hem op het eiland. */
  corrigeer(p,r=0.5){
    for(const o of this.obstakels){const dx=p.x-o.x,dz=p.z-o.z;const d=Math.hypot(dx,dz),m=o.r+r;if(d<m&&d>1e-4){p.x=o.x+dx/d*m;p.z=o.z+dz/d*m}}
    const d=Math.hypot(p.x,p.z);if(d>EILAND_R+1){p.x*=(EILAND_R+1)/d;p.z*=(EILAND_R+1)/d}
  }
  hoogte(x,z){const r=Math.hypot(x,z);if(r<=EILAND_R)return 0;return-(r-EILAND_R)*0.45}
  update(dt,t){
    for(const w of this.wolken){w.position.x+=w.userData.v*dt;if(w.position.x>130)w.position.x=-130}
    if(this.ring){this.ring.material.opacity=0.4+Math.sin(t*2)*0.2;this.ring.rotation.z=t*0.2}
  }
}
