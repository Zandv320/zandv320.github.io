/* ===================== Weather and sound =====================
   Weather: clear, cloudy, windy, rain, thunderstorm and morning fog. The schedule comes from the real clock (7-minute
   slots), so every player sees the same weather at the same time. It changes gradually: clouds darken the sky and the
   sun, rain falls around the camera (streaks drawn on the GPU) with splashes on the ground, storms bring lightning
   bolts with thunder, fog closes in at dawn, and the wind makes the grass and flowers sway harder. Dungeons have none.
   Sound (fx/sound, downloaded from OpenGameArt, see LICENSE.txt there): birdsong by day, crickets at night, rain, wind,
   rivers and waterfalls in Elvia, hammering at the forges, the church bell every three hours, frogs at the shore,
   barking dogs, owls in the forest at night and thunder. Everything follows the Sound on/off setting. */
const WX={cur:{cloud:0,rain:0,storm:0,fog:0,wind:.2},type:'clear',slot:-1,force:null,flash:0,bolt:null,ph:0,next:5};
const WX_T={clear:{cloud:0,rain:0,storm:0,fog:0,wind:.2},cloudy:{cloud:.6,rain:0,storm:0,fog:.1,wind:.45},windy:{cloud:.3,rain:0,storm:0,fog:0,wind:1},
  rain:{cloud:.85,rain:.75,storm:0,fog:.3,wind:.5},storm:{cloud:1,rain:1,storm:1,fog:.35,wind:1},fog:{cloud:.35,rain:0,storm:0,fog:1,wind:.05}};
function wxPick(slot){const r=mulberry(slot*7919+13)();const ph=((slot*420)%DAY_LEN)/DAY_LEN;const dawn=ph>.9||ph<.14;
  if(dawn&&r<.35)return'fog';if(r<.42)return'clear';if(r<.62)return'cloudy';if(r<.7)return'windy';if(r<.88)return'rain';if(r<.95)return'storm';return dawn?'fog':'cloudy'}
/* rain streaks: a box of line segments that follows the camera; the shader moves and wraps them */
const RAIN_U={uT:{value:0},uC:{value:new THREE.Vector3()},uI:{value:0},uW:{value:new THREE.Vector2(.15,.05)}};
const rainLines=(()=>{const N=4200,B=26,H=26;const p=new Float32Array(N*2*3),e=new Float32Array(N*2);
  for(let i=0;i<N;i++){const x=(Math.random()*2-1)*B,y=Math.random()*H,z=(Math.random()*2-1)*B;for(let k=0;k<2;k++){p.set([x,y,z],(i*2+k)*3);e[i*2+k]=k}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('e',new THREE.BufferAttribute(e,1));
  const m=new THREE.ShaderMaterial({uniforms:RAIN_U,transparent:true,depthWrite:false,
    vertexShader:`uniform float uT,uI;uniform vec3 uC;uniform vec2 uW;attribute float e;varying float vA;
void main(){vec3 p=position;float sp=17.+fract(p.x*7.13)*5.;p.y=mod(p.y-uT*sp,${H}.);p.xz+=uW*(${H}.-p.y);vec2 w=mod(p.xz-uC.xz+${B}.,${2*B}.)-${B}.;
vec3 wp=vec3(uC.x+w.x,uC.y-8.+p.y,uC.z+w.y);vec3 d=normalize(vec3(uW.x*sp,-sp,uW.y*sp));wp-=d*e*1.1;
float far=length(w)/${B}.;vA=uI*(1.-smoothstep(.55,1.,far))*(e>.5?.2:.8)*step(fract(p.z*3.71),uI*1.3);
gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,
    fragmentShader:'varying float vA;void main(){gl_FragColor=vec4(.78,.84,.95,vA);}'});
  const L=new THREE.LineSegments(g,m);L.frustumCulled=false;L.visible=false;L.renderOrder=5;scene.add(L);return L})();
/* a lightning bolt: a jagged ribbon from the clouds to the ground, a few kilometres per hour of flicker */
function wxBolt(ang){const a=ang??Math.random()*6.283,r=50+Math.random()*55;const x=camTarget.x+Math.cos(a)*r,z=camTarget.z+Math.sin(a)*r;const y0=groundH(x,z);
  const pts=[];let px=x,pz=z;for(let i=0;i<=14;i++){const y=y0+95*(1-i/14);pts.push([px,y,pz]);px+=(Math.random()-.5)*9;pz+=(Math.random()-.5)*9}
  const pos=[];const w=1.5;for(let i=0;i<pts.length-1;i++){const[a1,b1,c1]=pts[i],[a2,b2,c2]=pts[i+1];pos.push(a1-w,b1,c1,a1+w,b1,c1,a2+w,b2,c2,a1-w,b1,c1,a2+w,b2,c2,a2-w,b2,c2,a1,b1,c1-w,a1,b1,c1+w,a2,b2,c2+w,a1,b1,c1-w,a2,b2,c2+w,a2,b2,c2-w)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xdfe8ff,transparent:true,opacity:1,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide}));scene.add(m);
  if(WX.bolt){scene.remove(WX.bolt.m);WX.bolt.m.geometry.dispose()}WX.bolt={m,t:.32};WX.flash=1;
  const d=Math.hypot(x-camTarget.x,z-camTarget.z);setTimeout(()=>ambShot('thunder',x,y0+30,z,1,600,.85+Math.random()*.3),300+d/340*1000*.6)}
let _wxAcc=0;
function wxUpdate(dt){const outdoor=camTarget.x<700&&camTarget.x>-5000;const slot=Math.floor(Date.now()/1000/420);if(slot!==WX.slot){WX.slot=slot;WX.type=wxPick(slot)}
  let tgt=WX_T[WX.force||WX.type];if(!outdoor)tgt=WX_T.clear;else if(camTarget.x<-1000&&camTarget.x>-2600&&tgt.rain)tgt=WX_T.windy;
  const C=WX.cur,k=WX.snap?1:clamp(dt/18,0,1);WX.snap=0;for(const n in C)C[n]+=(tgt[n]-C[n])*k*(n==='fog'?.6:1);if(!outdoor){for(const n in C)C[n]=0}
  /* light and fog */const cl=C.cloud,fg=C.fog,rn=C.rain;sun.intensity*=1-.8*cl;fill.intensity*=1-.5*cl;hemi.intensity*=1-.3*cl;
  const grey=_wxc.setRGB(.55,.58,.62);if(cl>0){scene.fog.color.lerp(grey.multiplyScalar(1-.5*DAY.night),cl*.55);skyMat.uniforms.top.value.lerp(_wxc2.setRGB(.36,.4,.46).multiplyScalar(1-.75*DAY.night),cl*.75);skyMat.uniforms.hor.value.lerp(_wxc2.setRGB(.6,.63,.68).multiplyScalar(1-.75*DAY.night),cl*.7)}
  if(fg>0){scene.fog.color.lerp(_wxc.setRGB(.8,.82,.84).multiplyScalar(1-.6*DAY.night),fg*.6);scene.fog.near=lerp(scene.fog.near,4,fg*.85);scene.fog.far=lerp(scene.fog.far,TD.on?95:70,fg*.85)}
  if(rn>0){scene.fog.near=lerp(scene.fog.near,12,rn*.5);scene.fog.far=lerp(scene.fog.far,TD.on?120:150,rn*.6)}
  scene.background.copy(scene.fog.color);
  for(const c of clouds.children)c.traverse(m=>{if(m.isMesh){m.material.color.setScalar(1-.6*cl);m.material.emissiveIntensity*=1-.7*cl}});
  /* lightning */if(WX.flash>0){WX.flash-=dt*4;const f=Math.max(0,WX.flash)*(.6+.4*Math.sin(LW.t*60));hemi.intensity+=f*2.2;skyMat.uniforms.top.value.lerp(_wxc.setRGB(.85,.88,1),f*.6);skyMat.uniforms.hor.value.lerp(_wxc.setRGB(.9,.92,1),f*.6)}
  if(WX.bolt){WX.bolt.t-=dt;WX.bolt.m.material.opacity=WX.bolt.t>0?(.5+.5*Math.sin(LW.t*70))*Math.min(1,WX.bolt.t*6):0;if(WX.bolt.t<=0){scene.remove(WX.bolt.m);WX.bolt.m.geometry.dispose();WX.bolt=null}}
  if(C.storm>.6){WX.next-=dt;if(WX.next<=0){WX.next=6+Math.random()*16;wxBolt()}}
  /* wind: the grass shader's clock runs faster in a gale */WX.ph+=dt*(1+C.wind*1.8+C.storm*.8);WIND.value=WX.ph;
  /* rain */const rv=rn>.02;rainLines.visible=rv;if(rv){const q=lwQ();RAIN_U.uI.value=rn*[.45,.75,1][q]*(isTouch?.7:1);RAIN_U.uT.value+=dt;RAIN_U.uC.value.set(TD.on?camTarget.x:camera.position.x,TD.on?camTarget.y+10:camera.position.y,TD.on?camTarget.z:camera.position.z);
    const a=LW.t*.1;RAIN_U.uW.value.set(Math.cos(a)*.08*(1+C.wind),Math.sin(a)*.08*(1+C.wind));
    _wxAcc+=dt*rn*[10,18,28][q];while(_wxAcc>1){_wxAcc--;const r=Math.random()*12,an=Math.random()*6.283;const x=camTarget.x+Math.cos(an)*r,z=camTarget.z+Math.sin(an)*r;
      emitP({x,y:groundH(x,z)+.04,z,vy:.6,life:.22,size:.16,size1:.04,col:0xcfe0ff,a:.7,a1:0,cell:FXC.glint})}}}
const _wxc=new THREE.Color(),_wxc2=new THREE.Color();

/* ====================== sound ====================== */
const AMB={buf:{},loops:{},load:null,bellH:-1,t:{hammer:0,frog:3,dog:20,owl:15}};
const AMB_URL=new URL('fx/sound/',location.href).href;
const AMB_FILES=['amb_birds','amb_birds2','amb_crickets','amb_rain','amb_wind','amb_stream','amb_waterfall','thunder','hammer1','hammer2','bell','bell2','frog1','frog2','frog3','frog4','dog','owl'];
function ambLoad(){if(AMB.load)return AMB.load;const a=ac();if(!a)return null;AMB.load=Promise.all(AMB_FILES.map(n=>fetch(AMB_URL+n+'.mp3').then(r=>r.arrayBuffer()).then(b=>new Promise(res=>a.decodeAudioData(b,res,()=>res(null)))).then(buf=>{AMB.buf[n]=buf}).catch(()=>{})));
  AMB.out=a.createGain();AMB.out.gain.value=0;AMB.out.connect(a.destination);return AMB.load}
function ambLoop(n){const L=AMB.loops[n];if(L)return L;const a=AC,b=AMB.buf[n];if(!a||!b)return null;const s=a.createBufferSource();s.buffer=b;s.loop=true;s.loopStart=.05;s.loopEnd=b.duration-.05;const g=a.createGain();g.gain.value=0;s.connect(g);g.connect(AMB.out);s.start(0,Math.random()*b.duration*.8);return AMB.loops[n]={s,g,v:0}}
/* a sound from a place: louder when close, panned left/right from the camera */
const _ambV=new THREE.Vector3(),_ambR=new THREE.Vector3();
function ambShot(n,x,y,z,vol=1,maxD=40,rate=1){const a=AC,b=AMB.buf[n];if(!a||!b||!S.sound||!AMB.out)return;const d=camera.position.distanceTo(_ambV.set(x,y,z));if(d>maxD)return;
  const g=a.createGain();g.gain.value=vol*Math.pow(1-d/maxD,1.6);const s=a.createBufferSource();s.buffer=b;s.playbackRate.value=rate;
  let node=g;if(a.createStereoPanner){const p=a.createStereoPanner();_ambR.set(1,0,0).applyQuaternion(camera.quaternion);_ambV.sub(camera.position).normalize();p.pan.value=clamp(_ambV.dot(_ambR),-1,1)*.8;g.connect(p);node=p}
  s.connect(g);node.connect(AMB.out);s.start()}
const AMB_FORGES=[];
function ambUpdate(dt){const a=AC;if(!a||!S.sound&&!AMB.out)return;if(!AMB.load){if(S.sound)ambLoad();return}if(!AMB.out)return;
  const now=a.currentTime;AMB.out.gain.setTargetAtTime(S.sound&&!document.hidden?1:0,now,.3);
  const x=camTarget.x,z=camTarget.z,inR=x<-5000,out=x<700&&!inR,day=1-DAY.night,C=WX.cur;const inElv2=x<-2600&&!inR,inDrk2=x<-1000&&!inElv2,green=out&&!inDrk2;
  const forest=green&&(inForest(x,z)||inElv2);
  /* nearest river or waterfall in Elvia */let riv=0,fall=0;if(inElv2){const[rd,,rw]=elvRiver(x,z);riv=clamp(1-(rd-rw)/22,0,1);for(const f of ELV_FALLS){const d=Math.hypot(f.x-x,f.z-z);fall=Math.max(fall,clamp(1-d/55,0,1))}}
  const want={amb_birds:green?.5*day*(1-C.rain*.9)*(1-C.storm):0,amb_birds2:forest?.4*day*(1-C.rain):0,amb_crickets:green?.42*DAY.night*(1-C.rain*.8):0,
    amb_rain:out?C.rain*.75:0,amb_wind:inR?.4:out?Math.max(C.wind*.45-.08,inDrk2?.3:0,C.storm*.55):0,amb_stream:riv*.55*(1-fall*.5),amb_waterfall:fall*.8};
  for(const n in want){const L=want[n]>.002||AMB.loops[n]?ambLoop(n):null;if(!L)continue;if(Math.abs(L.v-want[n])>.005){L.v=want[n];L.g.gain.setTargetAtTime(want[n],now,1.2)}}
  if(!out)return;const T=AMB.t;
  /* forges: the smith at the Artisans' Yard and the smithies in the towns */if(!AMB_FORGES.length){AMB_FORGES.push({x:-113.2,z:-10.4});for(const b of TOWN_B)if(/blacksmith/.test(b.m))AMB_FORGES.push({x:b.x,z:b.z});for(const b of WS_B)if(/blacksmith/.test(b.m))AMB_FORGES.push({x:b.x,z:b.z})}
  T.hammer-=dt;if(T.hammer<=0&&day>.3){T.hammer=1+Math.random()*.7;for(const f of AMB_FORGES)if(Math.hypot(f.x-x,f.z-z)<34){ambShot(Math.random()<.6?'hammer1':'hammer2',f.x,groundH(f.x,f.z)+1,f.z,.55,34,.95+Math.random()*.1);break}}
  /* frogs at the water's edge in the evening and at night */T.frog-=dt;if(T.frog<=0){T.frog=1.5+Math.random()*4;const fr=CR.filter(c=>c.type==='frog'&&Math.hypot(c.x-x,c.z-z)<30);
    if(fr.length&&(DAY.night>.2||Math.random()<.3)){const f=fr[Math.floor(Math.random()*fr.length)];ambShot('frog'+(1+Math.floor(Math.random()*4)),f.x,f.y,f.z,.5,30,.9+Math.random()*.25);if(f.st!=='flee'&&Math.random()<.4)f.tm=0}}
  /* dogs */T.dog-=dt;if(T.dog<=0){T.dog=18+Math.random()*40;const dg=CR.filter(c=>c.T.dog&&c.g.visible&&Math.hypot(c.x-x,c.z-z)<35);if(dg.length){const d=dg[Math.floor(Math.random()*dg.length)];ambShot('dog',d.x,d.y+.5,d.z,.5,35,d.type==='husky'?.85:1.1)}}
  /* owls in the forest at night */T.owl-=dt;if(T.owl<=0){T.owl=20+Math.random()*35;if(DAY.night>.6&&forest){const an=Math.random()*6.283;ambShot('owl',x+Math.cos(an)*25,12,z+Math.sin(an)*25,.45,60,.9+Math.random()*.15)}}
  /* the church bell: once every three in-game hours, three times at noon and at six in the evening */const hr=Math.floor(((DAY.phase*24+6)%24));
  if(AMB.bellH<0)AMB.bellH=hr;if(hr!==AMB.bellH){AMB.bellH=hr;if(hr%3===0){const ch=[];for(const b of TOWN_B)if(/church/.test(b.m))ch.push(b);for(const b of WS_B)if(/church/.test(b.m))ch.push(b);
    const n=hr===12||hr===18?3:1;for(const c of ch)for(let i=0;i<n;i++)setTimeout(()=>ambShot(i%2?'bell2':'bell',c.x,groundH(c.x,c.z)+14,c.z,.9,170),i*2300)}}}
