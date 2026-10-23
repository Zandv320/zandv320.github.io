/* ===================== Drakes: the flying mounts =====================
   Model: "Animated Dragon Three Motion Loops" by LasquetiSpice (CC-BY 4.0, Sketchfab), plus the run cycle from the same
   artist's "Animated Dragon Runs Slow Motion Loop" (same rig). Combined into models/mount/drake.glb: one wingbeat cut
   from the flight loop, one stride from the run, textures shrunk to 1024.
   Every drake is that one model with its own palette, painted in the shader: the texture's light and shade stay, the
   colours come from the palette, the dark creases between the scales glow (slowly pulsing), and the wing membranes get
   their own colour with a soft glow and, for the Nether Drake, twinkling specks of light.
   It flies level like a big bird: slow heavy wingbeats, glides in between, hovers nose-up with fast beats when you
   stand still in the air, dives with raised wings, banks into turns and leaves a faint trail of light from its tail.
   On the ground it walks on its four limbs (the wings are its forelegs) and breathes and looks around when idle.
   The rider sits on a fixed seat at the base of the neck, leaning with the drake. */
const DK_S=3.25,DK_LIFT=36.5*.01*7.3188*DK_S;
const DK_PAL={
  nether:{c0:0x05011a,c1:0x3a0e90,m0:0x0e0328,m1:0x4c1cbc,v:0x5ff0e0,vi:1.5,mi:.85,star:1,trail:0x7ff8ff},
  ember: {c0:0x2a0a04,c1:0xd2582c,m0:0x3a0a04,m1:0xe2562a,v:0xffa030,vi:1.3,mi:.45,star:0,trail:0xffa040},
  frost: {c0:0x1c3456,c1:0xd2ecff,m0:0x2c5c8e,m1:0xa6dcff,v:0x8ef0ff,vi:.8,mi:.45,star:.35,trail:0xbff4ff},
  shadow:{c0:0x08060c,c1:0x3e3450,m0:0x120c1a,m1:0x4e2c74,v:0xb06aff,vi:1,mi:.4,star:.25,trail:0xb070ff}};
const DK={p:null,src:null,mats:{},U:{uT:{value:0}}};
function dkLoad(){if(DK.p)return DK.p;
  DK.p=new Promise(res=>gltfLoader().load(MODEL_BASE+'mount/drake.glb',g=>{DK.src=g;
    g.scene.traverse(o=>{if(!o.isMesh)return;o.frustumCulled=false;o.castShadow=true;
      /* which vertices are wing membrane: the ones carried by the finger and membrane bones */
      const geo=o.geometry;if(geo.getAttribute('memb'))return;const si=geo.getAttribute('skinIndex'),sw=geo.getAttribute('skinWeight'),bones=o.skeleton.bones;
      const isM=bones.map(b=>/finger|wingFlap|handMid/.test(b.name));const a=new Float32Array(si.count);
      const G=['getX','getY','getZ','getW'];for(let i=0;i<si.count;i++){let w=0;for(const f of G){if(isM[si[f](i)])w+=sw[f](i)}a[i]=w}
      geo.setAttribute('memb',new THREE.BufferAttribute(a,1))});
    res(g)},undefined,e=>{console.warn('drake model',e);res(null)}));return DK.p}
const DK_VS=`attribute float memb;\nvarying float vMemb;\n`;
const DK_FS=`uniform vec3 dC0,dC1,dM0,dM1,dV;uniform float dVI,dMI,dStar,dSat,uT;varying float vMemb;\n`;
function dkMat(src,key){let m=DK.mats[key];if(m)return m;const P=DK_PAL[key];m=src.clone();m.name='drake_'+key;m.metalness=0;m.roughness=.82;m.metalnessMap=null;m.roughnessMap=null;if(m.specularIntensity!=null)m.specularIntensity=.35;m.envMapIntensity=.35;
  const U={dC0:{value:new THREE.Color(P.c0)},dC1:{value:new THREE.Color(P.c1)},dM0:{value:new THREE.Color(P.m0)},dM1:{value:new THREE.Color(P.m1)},dV:{value:new THREE.Color(P.v)},dVI:{value:P.vi},dMI:{value:P.mi},dStar:{value:P.star},dSat:{value:P.sat||1.6},uT:DK.U.uT};
  m.userData.U=U;m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,U);
    sh.vertexShader=DK_VS+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMemb=smoothstep(.35,.85,memb);');
    sh.fragmentShader=DK_FS+sh.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float dL=dot(diffuseColor.rgb,vec3(.3,.59,.11));
      /* local contrast: how much darker this texel is than its surroundings (scale grooves, wing veins) */
      vec2 dO=vec2(5./1024.,0.);vec3 dW=vec3(.3,.59,.11);
      float dN=(dot(texture2D(map,vMapUv+dO).rgb,dW)+dot(texture2D(map,vMapUv-dO).rgb,dW)+dot(texture2D(map,vMapUv+dO.yx).rgb,dW)+dot(texture2D(map,vMapUv-dO.yx).rgb,dW))*.25;
      float dCr=smoothstep(.012,.045,dN-dL);
      float dHot=smoothstep(.22,.4,diffuseColor.r)*smoothstep(1.6,2.6,diffuseColor.r/(diffuseColor.b+.02));
      vec3 dBody=mix(dC0,dC1,smoothstep(0.,.36,dL));vec3 dMem=mix(dM0,dM1,smoothstep(.01,.16,dL));diffuseColor.rgb=mix(dBody,dMem,vMemb);`)
      .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      {float dP=.6+.4*sin(uT*2.1-vMapUv.y*14.+vMapUv.x*3.);
       vec3 dE=dV*dCr*dP*dVI*(1.-vMemb*.4);
       dE+=vMemb*dM1*(.04+.22*smoothstep(.03,.14,dL))*dMI;
       dE+=dV*dHot*3.;
       vec2 dG=floor(vMapUv*420.);float dH=fract(sin(dot(dG,vec2(12.9898,78.233)))*43758.5453);
       dE+=vMemb*vec3(1.)*step(.9965,dH)*(.55+.45*sin(uT*3.+dH*60.))*2.2*dStar;
       totalEmissiveRadiance+=dE;}`)
      /* the scene's light is tuned for the toon-shaded world and washes out a lit PBR surface: give the colour back */
      .replace('#include <opaque_fragment>','outgoingLight=max(mix(vec3(dot(outgoingLight,vec3(.3,.59,.11))),outgoingLight,dSat),0.);\n#include <opaque_fragment>')};
  m.customProgramCacheKey=function(){return THREE.Material.prototype.customProgramCacheKey.call(this)+'|dk'};DK.mats[key]=m;return m}
const _dkV=new THREE.Vector3(),_dkQ=new THREE.Quaternion();
/* the frames used as poses: wings spread wide (glide), wings raised (dive), and a standing step of the run */
const DK_T={spread:.9,up:1.6,stand:.62};
function dkBuild(id){const d=MOUNTS[id];const g=new THREE.Group();const piv=new THREE.Group();piv.rotation.order='YXZ';g.add(piv);
  const D={id,g,piv,ready:false,pitch:0,roll:0,vy:0,py:null,pry:null,airK:0,gl:0,gt:0,dv:0,tk:0,fs:0,t:Math.random()*10};
  dkLoad().then(src=>{if(!src||D.gone)return;const m=SkeletonUtils.clone(src.scene);m.scale.setScalar(DK_S);piv.add(m);D.m=m;
    m.traverse(o=>{if(o.isMesh){o.material=dkMat(o.material,d.dk);o.castShadow=true;o.frustumCulled=false}});
    const find=p=>{let b=null;m.traverse(o=>{if(!b&&o.isBone&&o.name.startsWith(p))b=o});return b};
    D.seat=find('spine_07');D.tail=find('tail_26');
    /* bones moved by hand on top of the clips (see dkProc) */
    const grp=(pre,from,to)=>{const L=[];for(let i=from;i<=to;i++){const b=find(pre+String(i).padStart(2,'0'));if(b)L.push(b)}return L};
    D.pb={spine:grp('spine_',3,5),neck:grp('neck_',2,7),head:[find('head')].filter(Boolean),tail:grp('tail_',3,24)};
    D.pbAll=[...D.pb.spine,...D.pb.neck,...D.pb.head,...D.pb.tail].map(b=>({b,q:b.quaternion.clone()}));
    D.look={y:0,p:0,ty:0,tp:0,next:2};
    const cl=n=>src.animations.find(a=>a.name===n);const fly=cl('Fly'),run=cl('Run');D.mixer=new THREE.AnimationMixer(m);
    const act=(c,t,ts)=>{const a=D.mixer.clipAction(c);a.play();a.time=t;a.timeScale=ts;a.setEffectiveWeight(0);return a};
    D.aFly=act(fly,0,1);D.aGlide=act(fly.clone(),DK_T.spread,0);D.aDive=act(fly.clone(),DK_T.up,0);D.aRun=act(run,0,1);D.aIdle=act(run.clone(),DK_T.stand,0);D.aIdle.setEffectiveWeight(1);D.mixer.update(0);
    D.ready=true});
  return D}
/* per frame: place the drake and pose it; returns the seat (world) for the rider */
function dkFrame(D,x,y,z,ry,spd,air,dt){const g=D.g;D.spd=spd;g.position.set(x,y,z);g.rotation.y=ry;D.t+=dt;DK.U.uT.value=performance.now()*.001;
  if(D.py==null){D.py=y;D.pry=ry}const vy=dt>0?(y-D.py)/dt:0;D.py=y;D.vy=lerp(D.vy,clamp(vy,-30,30),clamp(dt*6,0,1));const yr=dt>0?angDiff(D.pry,ry)/dt:0;D.pry=ry;
  const wasAir=D.airK>.5;D.airK=clamp(D.airK+(air?dt*2.2:-dt*3),0,1);const A=D.airK;
  if(!D.ready){return null}
  /* take-off: a couple of fast, deep beats; landing: a thump of dust */
  if(air&&!wasAir&&A>.5){D.tk=.9}if(!air&&wasAir&&A<.5){dustFx(x,z,12)}D.tk=Math.max(0,D.tk-dt);
  const hover=air&&spd<.12,climb=D.vy>1.2,dive=D.vy<-4.5;
  /* glide while cruising: two full wingbeats, then a stretch on spread wings */
  const beat=3.3/1.55;
  if(air&&!hover&&!climb&&!dive&&!D.tk){D.gt+=dt;const c=D.gt%(beat*2+2.6);D.gl=lerp(D.gl,c>beat*2?1:0,clamp(dt*2.4,0,1))}else{D.gt=0;D.gl=lerp(D.gl,0,clamp(dt*4,0,1))}
  D.dv=lerp(D.dv,dive?1:0,clamp(dt*3,0,1));
  const fts=D.tk?3:hover?2.5:climb?2.2:1.55;D.aFly.timeScale=lerp(D.aFly.timeScale,fts,clamp(dt*3,0,1));
  /* held poses still move a little: the wings flex on the air while gliding and flutter in a dive */
  D.aGlide.time=DK_T.spread+Math.sin(D.t*2.1)*.07;D.aDive.time=DK_T.up+Math.sin(D.t*10)*.03;
  const wGl=D.gl*(1-D.dv),wDv=D.dv*(1-wGl);
  D.aFly.setEffectiveWeight(A*(1-wGl-wDv));D.aGlide.setEffectiveWeight(A*wGl);D.aDive.setEffectiveWeight(A*wDv);
  const rk=clamp((spd-.05)*1.3,0,1);D.aRun.timeScale=.45+spd*.55;D.aRun.setEffectiveWeight(rk*(1-A));D.aIdle.setEffectiveWeight((1-A)*(1-rk));
  /* the mixer only writes a bone when its blended value changes, so on a held pose the hand-made offsets below would
     pile up frame after frame (that made the head spin): undo them first, let the mixer pose, then add them again */
  for(const e of D.pbAll)e.b.quaternion.copy(e.q);
  D.mixer.update(dt);
  for(const e of D.pbAll)e.q.copy(e.b.quaternion);
  dkProc(D,dt,A,rk,wGl);
  /* body attitude: nose up when climbing or hovering, down in a dive, banking into turns */
  const tp=air?(hover?-.32:climb?-.22*clamp(D.vy/6,0,1)-.05:dive?.42:-.04):0,tr=air&&!hover?clamp(-yr*.42,-.6,.6):0;
  D.pitch=lerp(D.pitch,tp,clamp(dt*2.5,0,1));D.roll=lerp(D.roll,tr,clamp(dt*2.5,0,1));
  /* the flight clip carries the body ~36 units up in its own space: take that out so the drake flies where the rider is */
  D.piv.position.y=A*1.2*DK_S/2.4;D.m.position.y=-A*DK_LIFT;D.piv.rotation.x=D.pitch;D.piv.rotation.z=D.roll;
  /* a faint trail of light from the tail */
  if(A>.6&&D.tail&&(spd>.3||dive)){D.fs-=dt;if(D.fs<=0){D.fs=.03;D.tail.getWorldPosition(_dkV);emitP({x:_dkV.x,y:_dkV.y,z:_dkV.z,vy:.1,life:.9,size:.55,size1:.05,col:DK_PAL[MOUNTS[D.id].dk].trail,a:.55,a1:0,cell:FXC.glint})}}
  if(!D.seat)return null;D.seat.getWorldPosition(_dkV);return _dkV}
/* hand-made motion on top of the clips, as rotations about the drake's own axes (up = turn, side = nod), spread over
   a chain of bones so the neck and tail bend smoothly */
const _pAx=new THREE.Vector3(),_pQ=new THREE.Quaternion(),_pP=new THREE.Quaternion(),_pUp=new THREE.Vector3(),_pSide=new THREE.Vector3();
function dkTurn(b,axisW,ang){if(!ang)return;b.parent.getWorldQuaternion(_pP);_pAx.copy(axisW).applyQuaternion(_pP.invert());_pQ.setFromAxisAngle(_pAx,ang);b.quaternion.premultiply(_pQ)}
function dkProc(D,dt,A,rk,wGl){const t=D.t,P=D.pb;D.piv.getWorldQuaternion(_pQ);_pUp.set(0,1,0).applyQuaternion(_pQ);_pSide.set(1,0,0).applyQuaternion(_pQ);
  const idle=(1-A)*(1-rk);
  /* standing: slow breaths and an unhurried look around (a new spot every few seconds, sometimes straight ahead) */
  const L=D.look;L.next-=dt;if(L.next<=0){L.next=2.5+Math.random()*4;const r=Math.random();L.ty=r<.3?0:(Math.random()*2-1)*.75;L.tp=(Math.random()*2-1)*.18}
  const k=1-Math.exp(-dt*1.6);L.y+=(L.ty-L.y)*k;L.p+=(L.tp-L.p)*k;
  if(idle>.01){const br=Math.sin(t*1.35)*.016*idle;for(const b of P.spine)dkTurn(b,_pSide,br);
    const n=P.neck.length||1;for(const b of P.neck){dkTurn(b,_pUp,L.y*idle/n);dkTurn(b,_pSide,L.p*idle*.5/n)}
    for(const b of P.head){dkTurn(b,_pUp,L.y*idle*.25);dkTurn(b,_pSide,(L.p*.5-br*2)*idle)}}
  /* gliding: the neck sways a touch and the head keeps looking ahead */
  const g=wGl*A;if(g>.01){const n=P.neck.length||1;for(const b of P.neck)dkTurn(b,_pUp,Math.sin(t*.55)*.16*g/n)}
  /* the tail always swings in a slow wave running down its length: bigger when standing or gliding */
  const amp=.022*idle+.016*g+.006*A*(1-wGl)+.01*rk*(1-A);if(amp>.0005)P.tail.forEach((b,i)=>dkTurn(b,_pUp,Math.sin(t*1.15-i*.33)*amp))}
function dkDrop(D){if(!D)return;D.gone=true;scene.remove(D.g);if(D.mixer)D.mixer.stopAllAction()}
