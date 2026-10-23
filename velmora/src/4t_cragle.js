/* ===================== The Riftwing: the flying mount of the Void Citadel =====================
   Model: "Cragle" by ChamberSu (CC-BY 4.0, Sketchfab): a wyvern-like beast whose wings are its forelegs. It came with
   only two idle loops (the neck), so everything else is done here by hand:
   - standing: the idle loop (it stands on its hind legs and folded wings, and breathes and looks around);
   - moving or in the air: it blends to its spread-winged rest pose, leans forward into flight and beats its wings
     (upper arm, forearm and hand each a little later than the one before, so the wing ripples). When you move on the
     ground it skims a little above it instead of walking, the way a creature of the Void would.
   The texture is very dark; it is brightened here and glows faintly, so it reads at night and in the Rift. */
const CRG={p:null,src:null,s:1,y0:0,bind:new Map()};
const CRG_H=5.6,CRG_PIV=2.9;
function crLoad(){if(CRG.p)return CRG.p;
  CRG.p=new Promise(res=>gltfLoader().load(MODEL_BASE+'mount/cragle.glb',g=>{CRG.src=g;const o=g.scene;o.updateMatrixWorld(true);
    o.traverse(b=>{if(b.isBone)CRG.bind.set(b.name,{q:b.quaternion.clone(),p:b.position.clone()})});
    const bb=new THREE.Box3();o.traverse(m=>{if(m.isSkinnedMesh){m.computeBoundingBox();bb.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld))}});
    const sz=bb.getSize(new THREE.Vector3()),c=bb.getCenter(new THREE.Vector3());CRG.s=CRG_H/sz.y;CRG.y0=bb.min.y;CRG.cx=c.x;CRG.cz=c.z;
    const mats=new Map();o.traverse(m=>{if(!m.isMesh)return;const sm=m.material;let tm=mats.get(sm);
      if(!tm){if(sm.map)sm.map.colorSpace=THREE.SRGBColorSpace;const body=/body/i.test(sm.name);
        tm=new THREE.MeshToonMaterial({map:sm.map||null,gradientMap:RAMP,color:body?new THREE.Color(5.2,5.2,5.6):new THREE.Color(1,1,1),emissiveMap:body?sm.map:null,emissive:body?new THREE.Color(.9,1,1.6):new THREE.Color(.5,.4,.1),emissiveIntensity:body?1.1:.6});mats.set(sm,tm)}
      m.material=tm;m.castShadow=true;m.frustumCulled=false});
    res(g)},undefined,e=>{console.warn('riftwing model',e);res(null)}));return CRG.p}
function crBuild(id){const g=new THREE.Group();const piv=new THREE.Group();piv.rotation.order='YXZ';g.add(piv);
  const C={id,g,piv,ready:false,pitch:0,roll:0,vy:0,py:null,pry:null,A:0,ph:0,amp:.5,gl:0,gt:0,tk:0,fs:0,t:Math.random()*10};
  crLoad().then(src=>{if(!src||C.gone)return;const m=SkeletonUtils.clone(src.scene);m.scale.setScalar(CRG.s);m.position.set(-CRG.cx*CRG.s,-CRG.y0*CRG.s-CRG_PIV,-CRG.cz*CRG.s);piv.add(m);C.m=m;
    m.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});
    C.E=[];m.traverse(b=>{if(b.isBone){const B=CRG.bind.get(b.name);C.E.push({b,q:b.quaternion.clone(),p:b.position.clone(),bq:B?B.q:b.quaternion.clone(),bp:B?B.p:b.position.clone()})}});
    const f=n=>{let r=null;m.traverse(o=>{if(!r&&o.isBone&&o.name===n)r=o});return r};
    C.arm={L:[f('upper_armL_021'),f('forearmL_022'),f('handL_023')],R:[f('upper_armR_044'),f('forearmR_045'),f('handR_046')]};
    C.seat=f('spine001_03')||f('spine002_04');C.tail=f('tail007_087');C.neck=[f('spine004_07'),f('spine008_08'),f('spine005_010')].filter(Boolean);
    C.mixer=new THREE.AnimationMixer(m);const idle=src.animations.find(a=>a.name==='Idle')||src.animations[0];if(idle){const a=C.mixer.clipAction(idle);a.play();a.time=Math.random()*idle.duration}C.mixer.update(0);
    for(const e of C.E){e.q.copy(e.b.quaternion);e.p.copy(e.b.position)}
    C.ready=true});
  return C}
const _crQ=new THREE.Quaternion(),_crV=new THREE.Vector3(),_crU=new THREE.Vector3(),_crZ=new THREE.Vector3(0,0,1);
function crFrame(C,x,y,z,ry,spd,air,dt){const g=C.g;g.position.set(x,y,z);g.rotation.y=ry;C.t+=dt;
  if(C.py==null){C.py=y;C.pry=ry}const vy=dt>0?(y-C.py)/dt:0;C.py=y;C.vy=lerp(C.vy,clamp(vy,-30,30),clamp(dt*6,0,1));const yr=dt>0?angDiff(C.pry,ry)/dt:0;C.pry=ry;
  const moving=spd>.12,wasA=C.A>.5;C.A=clamp(C.A+((air||moving)?dt*2.4:-dt*2.2),0,1);const A=C.A;
  if(!C.ready)return null;
  if(A>.5&&!wasA){C.tk=.8;dustFx(x,z,10)}if(A<.5&&wasA)dustFx(x,z,8);C.tk=Math.max(0,C.tk-dt);
  const hover=air&&spd<.12,climb=C.vy>1.2,dive=C.vy<-4.5,skim=!air&&moving;
  /* glide while cruising high: three beats, then a stretch on spread wings */
  if(air&&!hover&&!climb&&!dive&&!C.tk){C.gt+=dt;const c=C.gt%5.2;C.gl=lerp(C.gl,c>3.1?1:0,clamp(dt*2.4,0,1))}else{C.gt=0;C.gl=lerp(C.gl,0,clamp(dt*4,0,1))}
  const freq=C.tk?2.6:hover?2.1:climb?2:skim?1.7:1.35;C.ph+=dt*freq*6.283*(1-C.gl*.85);
  C.amp=lerp(C.amp,C.tk?.85:hover?.72:dive?.12:skim?.5:.6,clamp(dt*3,0,1));
  /* idle loop first (undo last frame's hand-made pose so the mixer starts clean), then blend toward the spread pose */
  for(const e of C.E){e.b.quaternion.copy(e.q);e.b.position.copy(e.p)}C.mixer.update(dt);for(const e of C.E){e.q.copy(e.b.quaternion);e.p.copy(e.b.position)}
  if(A>.001)for(const e of C.E){e.b.quaternion.slerp(e.bq,A);e.b.position.lerp(e.bp,A)}
  if(A>.01){const w=A*(1-C.gl*.8),ph=C.ph;const k=[1,.55,.35],lag=[0,.7,1.3];
    for(let i=0;i<3;i++){const a=C.amp*k[i]*Math.sin(ph-lag[i])*w+(i===0?.12*A*C.gl:0);const L=C.arm.L[i],R=C.arm.R[i];
      if(L)L.quaternion.multiply(_crQ.setFromAxisAngle(_crZ,a));if(R)R.quaternion.multiply(_crQ.setFromAxisAngle(_crZ,-a))}}
  /* body attitude: leaning into flight, nose up when hovering or climbing, down in a dive, banking into turns */
  const tp=A*(hover?.2:climb?.45:dive?1.05:skim?.45:.8),tr=air&&!hover?clamp(-yr*.4,-.6,.6):0;
  C.pitch=lerp(C.pitch,tp,clamp(dt*2.5,0,1));C.roll=lerp(C.roll,tr,clamp(dt*2.5,0,1));
  /* each wingbeat lifts the body a little; skimming over the ground it floats a metre up */
  const bob=A*Math.sin(C.ph+1.4)*.18*C.amp;C.piv.position.y=CRG_PIV+(skim?A*1.1:A*.4)+bob;C.piv.rotation.x=C.pitch;C.piv.rotation.z=C.roll;
  if(A>.6&&C.tail&&spd>.3){C.fs-=dt;if(C.fs<=0){C.fs=.035;C.tail.getWorldPosition(_crV);emitP({x:_crV.x,y:_crV.y,z:_crV.z,vy:.1,life:.9,size:.5,size1:.05,col:0x8ac8ff,a:.55,a1:0,cell:FXC.glint})}}
  if(!C.seat)return null;C.seat.getWorldPosition(_crV);C.piv.getWorldQuaternion(_crQ);_crU.set(0,1,0).applyQuaternion(_crQ);_crV.addScaledVector(_crU,.15);return _crV}
function crDrop(C){if(!C)return;C.gone=true;scene.remove(C.g);if(C.mixer)C.mixer.stopAllAction()}
