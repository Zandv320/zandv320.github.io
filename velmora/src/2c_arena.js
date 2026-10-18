/* ===================== Arena van Zilverbron (gladiatorenarena naast de stad) =====================
   Rond zandveld met getrapte stenen tribunes, een zuilengalerij, twee poorten, vaandels en fakkels.
   In het midden staat de kist met de AK-47 (zie 4c_arena.js voor de spelregels). */
const ARENA_H=FLAT[FLAT.length-1].h;
const arenaG=new THREE.Group();arenaG.position.set(ARENA.x,ARENA_H,ARENA.z);scene.add(arenaG);
{
  const stone=mat(0xb9ae98,{tex:'brick',rx:3,ry:1.2}),stoneD=mat(0x8f8676,{tex:'brick',rx:2,ry:1}),marble=mat(0xe2dccd,{flat:false,r:.6}),wood=mat(0x6a4a2a,{tex:'wood'});
  /* zandveld */
  {const sand=TEX.paint.clone();sand.needsUpdate=true;sand.repeat.set(6,6);const fl=mesh(new THREE.CircleGeometry(ARENA.r,64).rotateX(-Math.PI/2),new THREE.MeshToonMaterial({color:0xd9c08c,map:sand,gradientMap:RAMP}),0,.06,0,arenaG,false);void fl;
    /* bloedvlekken en strijdlijnen in het zand */for(let i=0;i<9;i++){const a=i*2.3,rr=4+(i*7)%15;const sp=mesh(new THREE.CircleGeometry(.6+(i%3)*.4,10).rotateX(-Math.PI/2),mat(0x6a2a1a,{r:1}),Math.cos(a)*rr,.08,Math.sin(a)*rr,arenaG,false);sp.scale.x=1.6}
    mesh(new THREE.RingGeometry(6,6.4,48).rotateX(-Math.PI/2),mat(0xb89a68),0,.09,0,arenaG,false)}
  PROC='arena';
  /* tribunes: drie getrapte ringen, met twee poortopeningen (noord/zuid) */
  const SEG=56,gapAt=(a)=>Math.abs(Math.sin(a))>.985&&Math.cos(a)>-.2?false:Math.abs(Math.cos(a))>.96;/* poorten op ±x */
  for(let i=0;i<SEG;i++){const a=i/SEG*Math.PI*2;const gate=Math.abs(Math.cos(a))>.965;
    for(let t=0;t<3;t++){const r=ARENA.r+1+t*1.6,h=1.3+t*1.3;if(gate&&t<2)continue;const b=mesh(new THREE.BoxGeometry(2*Math.PI*r/SEG+.08,h,1.7),t===2?stoneD:stone,Math.cos(a)*r,h/2,Math.sin(a)*r,arenaG);b.rotation.y=-a+Math.PI/2}
    /* buitenmuur */const rw=ARENA.r+6.2;if(!gate){const w=mesh(new THREE.BoxGeometry(2*Math.PI*rw/SEG+.1,7.5,1.2),stone,Math.cos(a)*rw,3.75,Math.sin(a)*rw,arenaG);w.rotation.y=-a+Math.PI/2;addCol(ARENA.x+Math.cos(a)*rw,ARENA.z+Math.sin(a)*rw,1.3)}
    /* lage borstwering aan de zandkant */const rb=ARENA.r+.3;if(!gate){const p=mesh(new THREE.BoxGeometry(2*Math.PI*rb/SEG+.06,1.1,.5),stoneD,Math.cos(a)*rb,.55,Math.sin(a)*rb,arenaG);p.rotation.y=-a+Math.PI/2;addCol(ARENA.x+Math.cos(a)*rb,ARENA.z+Math.sin(a)*rb,.7)}}
  /* zuilengalerij bovenop de muur */
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;if(Math.abs(Math.cos(a))>.965)continue;const r=ARENA.r+6.2;mesh(new THREE.CylinderGeometry(.35,.4,3.2,10),marble,Math.cos(a)*r,9.1,Math.sin(a)*r,arenaG);mesh(new THREE.BoxGeometry(1,.35,1),marble,Math.cos(a)*r,10.85,Math.sin(a)*r,arenaG)}
  {const ring=mesh(new THREE.TorusGeometry(ARENA.r+6.2,.3,8,64).rotateX(Math.PI/2),marble,0,11.2,0,arenaG);void ring}
  /* poorten: bogen met houten deuren open, vaandels en fakkels */
  for(const s of[-1,1]){const x=s*(ARENA.r+4.5);for(const dz of[-2.6,2.6]){mesh(new THREE.BoxGeometry(2.2,8,1.2),stone,x,4,dz,arenaG);mesh(new THREE.ConeGeometry(.9,1.6,4).rotateY(Math.PI/4),stoneD,x,8.8,dz,arenaG)}
    mesh(new THREE.BoxGeometry(2.4,1.2,6.4),stone,x,7.5,0,arenaG);const d1=mesh(new THREE.BoxGeometry(.25,5.5,2.2),wood,x+s*1.1,2.75,-2.9,arenaG);d1.rotation.y=s*.9;const d2=mesh(new THREE.BoxGeometry(.25,5.5,2.2),wood,x+s*1.1,2.75,2.9,arenaG);d2.rotation.y=-s*.9;
    for(const dz of[-2.6,2.6]){addCol(ARENA.x+x,ARENA.z+dz,1.3);addFlame(arenaG,x+s*1.4,6.2,dz,1.1,0xffa030);addLight(ARENA.x+x+s*1.4,ARENA_H+6.2,ARENA.z+dz,0xffa040,26,20)}
    flagPole(ARENA.x+x+s*3,ARENA.z-4.5,0x8a1f2a);flagPole(ARENA.x+x+s*3,ARENA.z+4.5,0x1f2a8a)}
  /* fakkels rond de borstwering */
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8;const r=ARENA.r+.3;mesh(new THREE.CylinderGeometry(.06,.08,1.6,6),wood,Math.cos(a)*r,1.8,Math.sin(a)*r,arenaG);addFlame(arenaG,Math.cos(a)*r,2.7,Math.sin(a)*r,.8);addLight(ARENA.x+Math.cos(a)*r,ARENA_H+2.7,ARENA.z+Math.sin(a)*r,0xffa040,18,14)}
  /* keizersloge aan de noordkant */
  {const lg=new THREE.Group();lg.position.set(0,4.2,-(ARENA.r+3));arenaG.add(lg);mesh(new THREE.BoxGeometry(7,.4,3.6),marble,0,0,0,lg);for(const sx of[-3,3])mesh(new THREE.CylinderGeometry(.22,.25,3,8),marble,sx,1.7,-1.2,lg);mesh(new THREE.BoxGeometry(7.6,.3,4),mat(0x8a1f2a,{r:.8}),0,3.3,-.2,lg);mesh(new THREE.BoxGeometry(2.2,1.2,1),mat(0xd9a441,{m:.9,r:.3}),0,.8,-.6,lg);
    const ban=mesh(new THREE.PlaneGeometry(2.6,3.2),mat(0x8a1f2a,{side:1}),0,-2,.3,lg);ban.userData.wave=1;flags.push(ban)}
  PROC=null;
}
/* de kist in het midden */
const arenaChest=(()=>{const g=new THREE.Group();g.position.set(ARENA.x,ARENA_H+.05,ARENA.z);scene.add(g);const wd=mat(0x6a4422,{tex:'wood',rx:2,ry:1}),gold=mat(0xd9a441,{m:.9,r:.3});
  mesh(new THREE.BoxGeometry(1.6,.9,1),wd,0,.45,0,g);for(const sx of[-.6,.6])mesh(new THREE.BoxGeometry(.12,.95,1.06),gold,sx,.47,0,g);
  const lid=new THREE.Group();lid.position.set(0,.9,-.5);g.add(lid);const top=mesh(new THREE.CylinderGeometry(.5,.5,1.6,12,1,false,0,Math.PI).rotateZ(Math.PI/2),wd,0,0,.5,lid);void top;for(const sx of[-.6,.6])mesh(new THREE.TorusGeometry(.5,.06,6,12,Math.PI).rotateY(Math.PI/2),gold,sx,0,.5,lid);
  mesh(new THREE.BoxGeometry(.3,.3,.12),gold,0,.75,.52,g);
  const glow=mesh(new THREE.CylinderGeometry(.6,.6,.05,16),new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:.0}),0,.95,0,g,false);
  mesh(new THREE.RingGeometry(1.3,1.5,32).rotateX(-Math.PI/2),mat(0xd9a441,{e:0xa07020,ei:.8,flat:false}),0,.02,0,g,false);
  addCol(ARENA.x,ARENA.z,1.1);addLight(ARENA.x,ARENA_H+2,ARENA.z,0xffd060,16,9,false);return{g,lid,glow}})();
