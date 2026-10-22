/* ===================== The world reacts to you =====================
   - Grass, flowers and ferns bend away from the hero, other players, villagers and animals walking through them
     (the old grass tufts too).
   - Water: every step in a lake or river makes a ring and a splash, standing still makes slow ripples, and now and
     then a fish jumps out of the lake.
   - Paths, sand and town streets: footprints that fade after a while (in the rain they appear everywhere, in the mud)
     and a puff of dust on dry ground.
   - Chopping, mining or fighting scares the birds: the flocks nearby take off, and a tree you chop shakes a few birds
     out of its crown. Butterflies flutter away when you walk into them. */
const RX={acc:0,gatherId:null,stand:0};
/* the water surface under a spot, or null */
function waterAt(x,z){
  if(x<700&&x>-260){const d=Math.hypot(x-LAKE.x,z-LAKE.z);if(d<LAKE.r*1.3){const wy=water.position.y;return groundH(x,z)<wy-.03?wy:null}return null}
  if(x<-2600){for(const l of ELV_LAKES){if(Math.hypot(x-l.x,z-l.z)<l.r*1.3){const wy=l.wl??-1;return groundH(x,z)<wy-.03?wy:null}}const[rd,wy,rw]=elvRiver(x,z);if(rd<rw+.5&&groundH(x,z)<wy-.03)return wy}
  return null}
/* what the ground is like: 'water', 'path' (roads, streets, sand), 'grass' */
function groundKind(x,z){if(waterAt(x,z)!=null)return'water';if(x>700)return'stone';
  if(x<-2600){if(elvPathDist(x,z)<2.6||Math.hypot(x-WS.x,z-WS.z)<WS.R)return'path';return plBiome(x,z)==='shore'?'path':'grass'}
  if(x<-1000)return'path';if(Math.hypot(x,z)<TOWN.wall||pathDist(x,z)<2.6)return'path';const b=plBiome(x,z);return b==='shore'?'path':'grass'}
function splashFx(x,y,z,big){decal(x,z,{y:y-.03,cell:FXC.ring,size:big?.5:.3,size1:big?2.2:1.3,life:big?1.1:.8,col:0xe8f6ff,a:big?.7:.5});
  for(let i=0;i<(big?9:5);i++){const a=Math.random()*6.283,s=Math.random()*1.4+.6;emitP({x,y:y+.05,z,vx:Math.cos(a)*s,vy:2+Math.random()*2.2,vz:Math.sin(a)*s,grav:9,life:.45,size:.16,size1:.05,col:0xe6f4ff,a:.9,a1:0,cell:FXC.glint})}}
/* one step of a walker (the hero or another player): water, footprints, dust */
function lwStep(x,z,ry,sp,me){const k=groundKind(x,z);
  if(k==='water'){const wy=waterAt(x,z);splashFx(x,wy,z,sp>4);if(me&&S.sound)tone(220+Math.random()*80,.08,.02,'sine',.5);return}
  if(k==='stone')return;
  const wet=WX.cur.rain>.3&&x<700;
  if(k==='path'||wet){decal(x,z,{cell:FXC.soft,size:.24,ar:1.6,rot:ry,life:wet?14:9,hold:.75,col:wet?0x221810:0x2e2216,a:wet?.6:.45,add:false})}
  if(k==='path'&&!wet)dustFx(x,z,sp>4?4:2);else if(k==='grass'&&sp>4&&Math.random()<.35)emitP({x,y:groundH(x,z)+.15,z,vx:(Math.random()-.5),vy:1.2,vz:(Math.random()-.5),grav:6,life:.5,size:.12,size1:.06,col:0x6aa040,a:.8,a1:0,cell:FXC.glint,add:false})}
/* who pushes the grass: the hero first, then the nearest other walkers */
const _rxL=[];
function rxPushers(){const P=LW_P.value,me=ME.pos;P[0].set(me.x,me.y,me.z,ME.mounted?1.5:.95);_rxL.length=0;const cx=camTarget.x,cz=camTarget.z;
  for(const r of REMOTES.values())if(!r.dead&&Math.abs(r.x-cx)<25&&Math.abs(r.z-cz)<25)_rxL.push([Math.hypot(r.x-cx,r.z-cz),r.x,r.y||groundH(r.x,r.z),r.z,.9]);
  for(const v of VL.list)if(!v.gone&&Math.abs(v.x-cx)<25&&Math.abs(v.z-cz)<25)_rxL.push([Math.hypot(v.x-cx,v.z-cz),v.x,groundH(v.x,v.z),v.z,.85]);
  for(const c of CR)if(c.g.visible&&!c.T.fish&&c.T.h>.3&&Math.abs(c.x-cx)<25&&Math.abs(c.z-cz)<25)_rxL.push([Math.hypot(c.x-cx,c.z-cz),c.x,c.y,c.z,c.T.h*.7]);
  for(const m of MONS)if(!m.dead&&Math.abs(m.x-cx)<20&&Math.abs(m.z-cz)<20)_rxL.push([Math.hypot(m.x-cx,m.z-cz),m.x,m.y,m.z,1]);
  _rxL.sort((a,b)=>a[0]-b[0]);for(let i=1;i<4;i++){const e=_rxL[i-1];if(e)P[i].set(e[1],e[2],e[3],e[4]);else P[i].set(0,-999,0,0)}}
/* the old grass tufts bend too */
{const g=grassIM.material,prev=g.onBeforeCompile;g.onBeforeCompile=(sh,r)=>{prev(sh,r);lwPushShader(sh)};g.customProgramCacheKey=()=>'grasspush';g.needsUpdate=true}
function rxUpdate(dt){if(S.mode!=='play')return;rxPushers();const me=ME.pos,t=LW.t;
  /* ripples around the hero standing in water */const wy=waterAt(me.x,me.z);if(wy!=null&&!ME.dead){RX.stand-=dt;if(RX.stand<=0){RX.stand=1.1+Math.random()*.6;decal(me.x,me.z,{y:wy-.03,cell:FXC.ring,size:.6,size1:2.4,life:1.6,col:0xe8f6ff,a:.35})}}
  /* jumping fish */for(const c of CR){if(!c.T.fish||!c.g.visible)continue;if(c.jt==null&&Math.random()<dt*.025&&Math.hypot(c.x-me.x,c.z-me.z)<45){c.jt=0;splashFx(c.x,c.water.y,c.z,false)}
    if(c.jt!=null){c.jt+=dt;const k=c.jt/.85;if(k>=1){c.jt=null;c.g.rotation.x=0;splashFx(c.x+Math.sin(c.ry)*1.2,c.water.y,c.z+Math.cos(c.ry)*1.2,true);if(S.sound&&Math.hypot(c.x-me.x,c.z-me.z)<25)tone(300,.07,.02,'sine',.4)}
      else{c.y=c.water.y-.1+Math.sin(Math.PI*k)*.9;c.x+=Math.sin(c.ry)*dt*1.4;c.z+=Math.cos(c.ry)*dt*1.4;c.g.position.set(c.x,c.y,c.z);c.g.rotation.x=-Math.cos(Math.PI*k)*.9}}}
  /* chopping, mining and fighting scare the birds */const A=ACT.cur;const noisy=(A&&A.k==='gather'&&(A.anim==='chop'||A.anim==='mine'))||(ME.atk>=0)||ME.combat>5.5;
  if(noisy)for(const b of BD.list)if(b.flock&&!b.flock.off&&Math.hypot(b.x-me.x,b.z-me.z)<26)b.flock.off=1;
  if(A&&A.k==='gather'&&A.anim==='chop'&&RX.gatherId!==A&&BD.ok){RX.gatherId=A;const n=A.n;if(n&&DAY.night<.6&&Math.random()<.75){const F={off:1};const kind=Math.random()<.4?'crow':'sparrow';for(let i=0;i<2+Math.floor(Math.random()*3);i++){const a=Math.random()*6.283;
      const b={k:kind,g:bdMesh(kind),x:n.x+Math.cos(a)*.8,z:n.z+Math.sin(a)*.8,y:groundH(n.x,n.z)+4.5+Math.random()*2,ry:a,st:'off',tm:0,flock:F,vx:Math.cos(a)*(3+Math.random()*3),vz:Math.sin(a)*(3+Math.random()*3),vy:1.5+Math.random()*2,hop:0};BD.list.push(b)}
    for(let i=0;i<10;i++)emitP({x:n.x+(Math.random()-.5)*3,y:groundH(n.x,n.z)+4+Math.random()*3,z:n.z+(Math.random()-.5)*3,vx:(Math.random()-.5)*1.5,vy:-.6,vz:(Math.random()-.5)*1.5,grav:1.2,life:1.6,size:.22,size1:.12,col:Math.random()<.5?0x5a8a30:0x86a840,a:1,a1:0,cell:FXC.glint,add:false})}}
  if(!A)RX.gatherId=null;
  /* butterflies flutter away from you */for(const b of BF){if(b.x==null)continue;const dx=b.x-me.x,dz=b.z-me.z,d=Math.hypot(dx,dz);if(d<2.4){b.ax+=dx/(d+.01)*dt*5;b.az+=dz/(d+.01)*dt*5;b.ph+=dt*2}}}
