/* ===================== Arena van Zilverbron (gladiatorenarena naast de stad) =====================
   Rond zandveld met getrapte stenen tribunes, een zuilengalerij, twee poorten, vaandels en fakkels.
   In het midden staat de kist met de AK-47 (zie 4c_arena.js voor de spelregels). */
const ARENA_H=FLAT[FLAT.length-1].h;
/* colosseum model at scale ARENA_S: pit half-axes (x, z), half-width of the gate tunnels along x */
const ARENA_S=17,ARENA_RX=.6*1.735*ARENA_S,ARENA_RZ=.6*1.9*ARENA_S,ARENA_GW=.19*ARENA_S;
const arenaG=new THREE.Group();arenaG.position.set(ARENA.x,ARENA_H,ARENA.z);scene.add(arenaG);
{
  const stone=mat(0xb9ae98,{tex:'brick',rx:3,ry:1.2}),stoneD=mat(0x8f8676,{tex:'brick',rx:2,ry:1}),marble=mat(0xe2dccd,{flat:false,r:.6}),wood=mat(0x6a4a2a,{tex:'wood'});
  /* zandveld */
  {const sand=TEX.paint.clone();sand.needsUpdate=true;sand.repeat.set(6,6);const fl=mesh(new THREE.CircleGeometry(1,64).rotateX(-Math.PI/2).scale(ARENA_RX,1,ARENA_RZ),new THREE.MeshToonMaterial({color:0xd9c08c,map:sand,gradientMap:RAMP}),0,.12,0,arenaG,false);void fl;
    /* bloedvlekken en strijdlijnen in het zand */for(let i=0;i<9;i++){const a=i*2.3,rr=4+(i*7)%15;const sp=mesh(new THREE.CircleGeometry(.6+(i%3)*.4,10).rotateX(-Math.PI/2),mat(0x6a2a1a,{r:1}),Math.cos(a)*rr,.14,Math.sin(a)*rr,arenaG,false);sp.scale.x=1.6}
    mesh(new THREE.RingGeometry(6,6.4,48).rotateX(-Math.PI/2),mat(0xb89a68),0,.15,0,arenaG,false)}
  /* the building itself is a downloaded colosseum (2e_visual.js); here: colliders, torches, a simple fallback */
  PROC='arena';const SEG=72;
  for(let i=0;i<SEG;i++){const a=(i+.5)/SEG*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
    /* pit wall (podium) and the outer wall, both open where the two gate tunnels run along x */
    const px=c*ARENA_RX*1.035,pz=sn*ARENA_RZ*1.035;if(Math.abs(pz)>ARENA_GW+.6){addCol(ARENA.x+px,ARENA.z+pz,.8);const b=mesh(new THREE.BoxGeometry(2,1.2,.6),stone,px,.6,pz,arenaG);b.rotation.y=-a+Math.PI/2}
    const ox=c*ARENA_RX*1.62,oz=sn*ARENA_RZ*1.62;if(Math.abs(oz)>ARENA_GW+.6){addCol(ARENA.x+ox,ARENA.z+oz,1.4);const w=mesh(new THREE.BoxGeometry(3,6,1.2),stone,ox,3,oz,arenaG);w.rotation.y=-a+Math.PI/2}}
  /* gate tunnels: side walls (colliders) */
  for(const s2 of[-1,1])for(const sz of[-1,1])for(let x=ARENA_RX*.95;x<ARENA_RX*1.68;x+=1.2)addCol(ARENA.x+s2*x,ARENA.z+sz*(ARENA_GW+.7),.75);
  PROC=null;
  /* torches around the pit and at the gates */
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2+Math.PI/10;const x=Math.cos(a)*ARENA_RX*.97,z=Math.sin(a)*ARENA_RZ*.97;mesh(new THREE.CylinderGeometry(.06,.08,1.6,6),wood,x,.8,z,arenaG);addFlame(arenaG,x,1.75,z,.8);addLight(ARENA.x+x,ARENA_H+1.9,ARENA.z+z,0xffa040,18,14)}
  for(const s2 of[-1,1]){for(const dz of[-ARENA_GW-.5,ARENA_GW+.5]){const x=s2*(ARENA_RX*1.7);addFlame(arenaG,x,3.4,dz,1,0xffa030);addLight(ARENA.x+x,ARENA_H+3.6,ARENA.z+dz,0xffa040,26,18)}
    flagPole(ARENA.x+s2*(ARENA_RX*1.72+3),ARENA.z-ARENA_GW-2.2,0x8a1f2a);flagPole(ARENA.x+s2*(ARENA_RX*1.72+3),ARENA.z+ARENA_GW+2.2,0x1f2a8a)}
}
/* de kist in het midden */
const arenaChest=(()=>{const g=new THREE.Group();g.position.set(ARENA.x,ARENA_H+.05,ARENA.z);scene.add(g);const wd=mat(0x6a4422,{tex:'wood',rx:2,ry:1}),gold=mat(0xd9a441,{m:.9,r:.3});
  mesh(new THREE.BoxGeometry(1.6,.9,1),wd,0,.45,0,g);for(const sx of[-.6,.6])mesh(new THREE.BoxGeometry(.12,.95,1.06),gold,sx,.47,0,g);
  const lid=new THREE.Group();lid.position.set(0,.9,-.5);g.add(lid);const top=mesh(new THREE.CylinderGeometry(.5,.5,1.6,12,1,false,0,Math.PI).rotateZ(Math.PI/2),wd,0,0,.5,lid);void top;for(const sx of[-.6,.6])mesh(new THREE.TorusGeometry(.5,.06,6,12,Math.PI).rotateY(Math.PI/2),gold,sx,0,.5,lid);
  mesh(new THREE.BoxGeometry(.3,.3,.12),gold,0,.75,.52,g);
  const glow=mesh(new THREE.CylinderGeometry(.6,.6,.05,16),new THREE.MeshBasicMaterial({color:0xffd060,transparent:true,opacity:.0}),0,.95,0,g,false);
  mesh(new THREE.RingGeometry(1.3,1.5,32).rotateX(-Math.PI/2),mat(0xd9a441,{e:0xa07020,ei:.8,flat:false}),0,.02,0,g,false);
  addCol(ARENA.x,ARENA.z,1.1);addLight(ARENA.x,ARENA_H+2,ARENA.z,0xffd060,16,9,false);return{g,lid,glow}})();
