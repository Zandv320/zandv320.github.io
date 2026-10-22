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
const DK_S=2.4,DK_LIFT=36.5*.01*7.3188*DK_S;
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
const DK_T={spread:1.42,up:.8,stand:.62};
function dkBuild(id){const d=MOUNTS[id];const g=new THREE.Group();const piv=new THREE.Group();piv.rotation.order='YXZ';g.add(piv);
  const D={id,g,piv,ready:false,pitch:0,roll:0,vy:0,py:null,pry:null,airK:0,gl:0,gt:0,dv:0,tk:0,fs:0,t:Math.random()*10};
  dkLoad().then(src=>{if(!src||D.gone)return;const m=SkeletonUtils.clone(src.scene);m.scale.setScalar(DK_S);piv.add(m);D.m=m;
    m.traverse(o=>{if(o.isMesh){o.material=dkMat(o.material,d.dk);o.castShadow=true;o.frustumCulled=false}});
    const find=p=>{let b=null;m.traverse(o=>{if(!b&&o.isBone&&o.name.startsWith(p))b=o});return b};
    D.seat=find('spine_07');D.tail=find('tail_26');D.sp=find('spine_04');D.neck=find('neck_03');D.head=find('head');
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
  /* glide while cruising: a few beats, then a few seconds on spread wings */
  if(air&&!hover&&!climb&&!dive&&!D.tk){D.gt+=dt;const c=D.gt%7.5;D.gl=lerp(D.gl,c>3.2?1:0,clamp(dt*2.2,0,1))}else{D.gt=0;D.gl=lerp(D.gl,0,clamp(dt*4,0,1))}
  D.dv=lerp(D.dv,dive?1:0,clamp(dt*3,0,1));
  const fts=D.tk?3:hover?2.5:climb?2.2:1.55;D.aFly.timeScale=lerp(D.aFly.timeScale,fts,clamp(dt*3,0,1));
  const wFlyAll=A,wGl=D.gl*(1-D.dv),wDv=D.dv;
  D.aFly.setEffectiveWeight(wFlyAll*(1-wGl-wDv*(1-wGl)));D.aGlide.setEffectiveWeight(wFlyAll*wGl);D.aDive.setEffectiveWeight(wFlyAll*wDv*(1-wGl));
  const run=clamp((spd-.05)*1.3,0,1)*(1-A);D.aRun.timeScale=.45+spd*.55;D.aRun.setEffectiveWeight(run);D.aIdle.setEffectiveWeight((1-A)*(1-clamp((spd-.05)*1.3,0,1)));
  D.mixer.update(dt);
  /* idle on the ground: slow breathing and a look around */
  if(A<.5&&spd<.1){const b=Math.sin(D.t*1.5);if(D.sp)D.sp.rotateX(b*.025);if(D.neck)D.neck.rotateY(Math.sin(D.t*.37)*.18);if(D.head)D.head.rotateX(Math.sin(D.t*.6)*.06)}
  /* body attitude: nose up when climbing or hovering, down in a dive, banking into turns */
  const tp=air?(hover?-.32:climb?-.22*clamp(D.vy/6,0,1)-.05:dive?.42:-.04):0,tr=air&&!hover?clamp(-yr*.42,-.6,.6):0;
  D.pitch=lerp(D.pitch,tp,clamp(dt*2.5,0,1));D.roll=lerp(D.roll,tr,clamp(dt*2.5,0,1));
  /* the flight clip carries the body ~36 units up in its own space: take that out so the drake flies where the rider is */
  D.piv.position.y=A*1.2;D.m.position.y=-A*DK_LIFT;D.piv.rotation.x=D.pitch;D.piv.rotation.z=D.roll;
  /* a faint trail of light from the tail */
  if(A>.6&&D.tail&&(spd>.3||dive)){D.fs-=dt;if(D.fs<=0){D.fs=.03;D.tail.getWorldPosition(_dkV);emitP({x:_dkV.x,y:_dkV.y,z:_dkV.z,vy:.1,life:.9,size:.55,size1:.05,col:DK_PAL[MOUNTS[D.id].dk].trail,a:.55,a1:0,cell:FXC.glint})}}
  if(!D.seat)return null;D.seat.getWorldPosition(_dkV);return _dkV}
function dkDrop(D){if(!D)return;D.gone=true;scene.remove(D.g);if(D.mixer)D.mixer.stopAllAction()}
