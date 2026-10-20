
/* ===================== input ===================== */
const KEYS=new Set();let snapCam=true;
const cam={yaw:0,pitch:.42,dist:12,tdist:12,drag:0};const camTarget=new THREE.Vector3();
addEventListener('keydown',ev=>{if(document.activeElement&&(document.activeElement.tagName==='INPUT'))return;const k=ev.key.toLowerCase();
  if(S.mode!=='play')return;
  if(k==='enter'){ev.preventDefault();openChat();return}
  if(k==='tab'){ev.preventDefault();cycleTarget();return}
  if(k==='escape'){const open=panels.find(p=>!$('#'+p).hidden);if(open)closePanel(open);else if(ME.cast){ME.cast=null;$('#castbar').hidden=true}else if(ME.target)setTarget(null);else openPanel('pMenu');return}
  if(k>='1'&&k<='9'){useAbility(+k-1);return}if(k==='0'){useAbility(9);return}if(k==='n')return togglePanel('pTalent');
  if(k==='b'||k==='i')return togglePanel('pBag');if(k==='c')return togglePanel('pChar');if(k==='l')return togglePanel('pQuest');if(k==='m')return togglePanel('pMap');if(k==='r')return toggleMount();if(k==='z')return toggleSheath();
  if(k==='f')return interact();if(k==='k')return togglePanel('pLife');if(k===' '){ev.preventDefault();jump();return}
  KEYS.add(k)});
addEventListener('keyup',ev=>KEYS.delete(ev.key.toLowerCase()));addEventListener('blur',()=>KEYS.clear());
function jump(){if(ME.phy&&!ME.dead&&!ME.dash)ME.phy.jbuf=.14}
function dustFx(x,z,n=5,c=0xb8a890){const y=groundH(x,z)+.1;puff(x,y,z,c,Math.max(1,Math.round(n/3)),.5,.6,.7)}
function landFx(){dustFx(ME.pos.x,ME.pos.z,14);sfx('swing');if(ME.rig&&ME.rig.st)ME.rig.st.land=.22}
/* pointer: drag to orbit, click to select, pinch/wheel to zoom */
const ptrs=new Map();let pinch0=0;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',ev=>{canvas.setPointerCapture(ev.pointerId);ptrs.set(ev.pointerId,{x:ev.clientX,y:ev.clientY,sx:ev.clientX,sy:ev.clientY,t:performance.now(),btn:ev.button,moved:0});if(ptrs.size===2){const[a,b]=[...ptrs.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y)}ac();hideTip()});
canvas.addEventListener('pointermove',ev=>{const p=ptrs.get(ev.pointerId);if(!p)return;const dx=ev.clientX-p.x,dy=ev.clientY-p.y;p.x=ev.clientX;p.y=ev.clientY;p.moved+=Math.abs(dx)+Math.abs(dy);
  if(ptrs.size===2){const[a,b]=[...ptrs.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0){cam.tdist=clamp(cam.tdist*pinch0/d,4,26);pinch0=d}return}
  if(p.moved>4){cam.yaw-=dx*.0065;cam.pitch=clamp(cam.pitch+dy*.005,-.05,1.35);cam.drag=1.2;if(p.btn===2&&S.mode==='play'&&!ME.dead)ME.ry=cam.yaw+Math.PI}});
const endPtr=ev=>{const p=ptrs.get(ev.pointerId);ptrs.delete(ev.pointerId);if(ptrs.size<2)pinch0=0;if(p&&p.moved<10&&performance.now()-p.t<500&&S.mode==='play')pickAt(ev.clientX,ev.clientY,p.btn===2)};
canvas.addEventListener('pointerup',endPtr);canvas.addEventListener('pointercancel',ev=>{ptrs.delete(ev.pointerId)});
canvas.addEventListener('wheel',ev=>{ev.preventDefault();cam.tdist=clamp(cam.tdist*(1+Math.sign(ev.deltaY)*.12),4,26)},{passive:false});
const ray=new THREE.Raycaster(),_ndc=new THREE.Vector2();
function pickAt(cx,cy,right){_ndc.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(_ndc,camera);
  const objs=[];for(const m of MONS)if(Math.abs(m.x-ME.pos.x)<90&&Math.abs(m.z-ME.pos.z)<90)objs.push(m.rig.g);for(const n of NPCOBJ)objs.push(n.rig.g);for(const r of REMOTES.values())if(r.rig)objs.push(r.rig.g);for(const n of NODES)if(!n.down&&Math.abs(n.x-ME.pos.x)<40&&Math.abs(n.z-ME.pos.z)<40)objs.push(n.g);
  const hit=ray.intersectObjects(objs,true)[0];let e=null;if(hit){let o=hit.object;while(o&&!o.userData.ent)o=o.parent;e=o&&o.userData.ent}
  if(!e){/* forgiving pick for touch: nearest entity to the tap on screen */let bd=isTouch?48:26;for(const x of[...MONS,...NPCOBJ,...REMOTES.values()]){if(x.kind==='mon'&&x.dead&&!x.loot)continue;_v.set(x.x,(x.y||0)+1,x.z).project(camera);if(_v.z>1)continue;const sx=(_v.x*.5+.5)*innerWidth,sy=(-_v.y*.5+.5)*innerHeight,d=Math.hypot(sx-cx,sy-cy);if(d<bd){bd=d;e=x}}}
  if(!e||e==='me')return;
  if(e.kind==='node'){if(Math.hypot(e.x-ME.pos.x,e.z-ME.pos.z)<3.8)startGather(e);else toast('Walk up to '+e.name+'');return}
  if(e.kind==='mon'&&e.dead){if(e.loot){if(Math.hypot(e.x-ME.pos.x,e.z-ME.pos.z)<6)lootMon(e);else toast('Move closer to loot')}return}
  if(e.kind==='npc'){setTarget(e);if(Math.hypot(e.x-ME.pos.x,e.z-ME.pos.z)<6)openNpc(e);else toast('Walk up to '+e.n+' to talk');return}
  if((ME.target===e||right)&&isEnemy(e)){ME.auto=true;faceTo(e.x,e.z)}setTarget(e)}
function interact(){if(ME.dead)return;if(fishHook())return;if(arenaInteract())return;let best=null,bd=6;for(const m of MONS)if(m.dead&&m.loot){const d=Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z);if(d<bd){bd=d;best=m}}
  if(best)return lootMon(best);let bn=null;bd=6;for(const n of NPCOBJ){const d=Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z);if(d<bd){bd=d;bn=n}}if(bn){setTarget(bn);return openNpc(bn)}
  const skn=skinTarget();if(skn)return startSkin(skn);
  const nd=nearNode();if(nd)return startGather(nd);
  const stn=STATIONS.find(s=>Math.hypot(s.x-ME.pos.x,s.z-ME.pos.z)<(s.r||4.5));if(stn){lifeTab={fire:'cooking',cauldron:'alchemy',forge:'smithing',tannery:'leatherworking',loom:'tailoring',sawmill:'woodcutting'}[stn.k]||lifeTab;return openPanel('pLife')}
  if(Math.hypot(ME.pos.x-CAVE.x,ME.pos.z-CAVE.z-1)<6)return enterCave();if(ME.pos.x>1250&&Math.hypot(ME.pos.x-D2.exit.x,ME.pos.z-D2.exit.z)<6)return leaveCave();
  if(drakeInteract())return;
  if(atShore())return startFish();
  if(Math.hypot(ME.pos.x-CRYPT.x,ME.pos.z-CRYPT.z-1)<6)return enterDungeon();if(ME.pos.x>700&&Math.hypot(ME.pos.x-DUN_EXIT.x,ME.pos.z-DUN_EXIT.z)<6)return leaveDungeon();
  toast('There is nothing to do here')}
function enterDungeon(){teleport(DUN_ENTRY.x,DUN_ENTRY.z);ME.ry=Math.PI;cam.yaw=0;log('You descend into the Crypt of Kaal-Morath…','sys');if(P.level<7)log('Beware: this crypt is meant for heroes of level 8 or higher.','err')}
function leaveDungeon(){teleport(CRYPT.x,CRYPT.z+8);ME.ry=0;cam.yaw=Math.PI}
function enterCave(){teleport(D2.entry.x,D2.entry.z);ME.ry=Math.PI;cam.yaw=0;log('The heat hits you: you enter Ignaroth\'s Fire Cave…','sys');if(P.level<10)log('Beware: this cave is meant for heroes of level 10 or higher. Avoid the lava!','err')}
function leaveCave(){teleport(CAVE.x,CAVE.z+9);ME.ry=0;cam.yaw=Math.PI}
/* virtual joystick */
const joy={x:0,y:0,id:null,el:$('#joy'),knob:$('#joy i')};
joy.el.addEventListener('pointerdown',ev=>{ev.preventDefault();joy.id=ev.pointerId;joy.el.setPointerCapture(ev.pointerId);joyMove(ev);ac()});
joy.el.addEventListener('pointermove',ev=>{if(ev.pointerId===joy.id)joyMove(ev)});
const joyEnd=ev=>{if(ev.pointerId!==joy.id)return;joy.id=null;joy.x=joy.y=0;joy.knob.style.transform=''};joy.el.addEventListener('pointerup',joyEnd);joy.el.addEventListener('pointercancel',joyEnd);
function joyMove(ev){const r=joy.el.getBoundingClientRect(),R=r.width/2;let dx=ev.clientX-r.left-R,dy=ev.clientY-r.top-R;const L=Math.hypot(dx,dy);if(L>R){dx*=R/L;dy*=R/L}joy.x=dx/R;joy.y=-dy/R;joy.knob.style.transform='translate('+dx+'px,'+dy+'px)'}
function getInput(){let x=0,y=0;if(KEYS.has('w')||KEYS.has('arrowup'))y+=1;if(KEYS.has('s')||KEYS.has('arrowdown'))y-=1;if(KEYS.has('a')||KEYS.has('arrowleft'))x-=1;if(KEYS.has('d')||KEYS.has('arrowright'))x+=1;if(KEYS.has('q'))cam.yaw+=.035;if(KEYS.has('e'))cam.yaw-=.035;
  if(Math.abs(joy.x)+Math.abs(joy.y)>.12){x=joy.x;y=joy.y}const L=Math.hypot(x,y);if(L>1){x/=L;y/=L}return{x,y,L:Math.min(1,L)}}

/* ===================== update ===================== */
function updPlayer(dt){
  const inp=getInput();ME.gcd=Math.max(0,ME.gcd-dt);for(const k in ME.cds)ME.cds[k]=Math.max(0,ME.cds[k]-dt);ME.combat=Math.max(0,ME.combat-dt);ME.buff=Math.max(0,ME.buff-dt);ME.portalCd=Math.max(0,ME.portalCd-dt);
  if(ME.atk>=0){ME.atk+=dt*2.6;if(ME.atk>1)ME.atk=-1}
  /* ---- physics: velocity + acceleration, fixed 120 Hz steps, slopes, knockback, coyote jump ---- */
  let mvx=0,mvz=0,sp=0;const PHY=ME.phy||(ME.phy={vx:0,vz:0,acc:0,coyote:0,jbuf:0,turn:0,prevRy:ME.ry});
  if(ME.dash){const D=ME.dash;D.t0+=dt;const f=Math.min(1,D.t0/D.t);const p={x:lerp(D.sx,D.x,f),z:lerp(D.sz,D.z,f)};collide(p,.5);ME.pos.x=p.x;ME.pos.z=p.z;sp=12;PHY.vx=PHY.vz=0;if(!D.leap)chargeTrail(ME.pos.x,ME.pos.y,ME.pos.z);
    if(f>=1){ME.dash=null;if(D.land)D.land();if(D.tg&&!D.tg.dead){dealDamage(D.tg,hitDmg(.6),{stun:1.5});dustRing(D.tg.x,D.tg.z,2.5,10);chargeImpactFx(D.tg.x,D.tg.y,D.tg.z);fxEmit({k:'ci',x:D.tg.x,z:D.tg.z});sfx('hit');swingAnim(false)}}}
  else{
    const frozen=ME.stun>0||ME.root>0||ME.dead||!!ME.cast&&false;if(ME.stun>0)ME.stun=Math.max(0,ME.stun-dt);if(ME.root>0)ME.root=Math.max(0,ME.root-dt);
    let wx=0,wz=0;if(!frozen&&inp.L>.05){const fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw);wx=fx*inp.y+rx*inp.x;wz=fz*inp.y+rz*inp.x;const L=Math.hypot(wx,wz)||1;wx/=L;wz/=L;
      if(ME.cast&&inp.L>.3){ME.cast=null;$('#castbar').hidden=true;toast('Interrupted')}}
    const maxSp=7*(RACES[P.race].spd||1)*(1+TM('speed'))*(ME.mounted?MOUNT_SPD:1)*(frozen?0:inp.L)*(ME.cast?0:1);
    /* slope: slower uphill, faster downhill, slide on steep slopes */
    const gh0=groundH(ME.pos.x,ME.pos.z),ahead=groundH(ME.pos.x+wx*1.2,ME.pos.z+wz*1.2),slope=(ahead-gh0)/1.2;
    const slopeK=clamp(1-slope*.45,.55,1.25);
    const gx=(groundH(ME.pos.x+.5,ME.pos.z)-groundH(ME.pos.x-.5,ME.pos.z)),gz=(groundH(ME.pos.x,ME.pos.z+.5)-groundH(ME.pos.x,ME.pos.z-.5));const steep=Math.hypot(gx,gz);
    PHY.acc=0;let steps=0;PHY.accum=(PHY.accum||0)+dt;const h=1/120;
    while(PHY.accum>=h&&steps<8){PHY.accum-=h;steps++;
      const tx=wx*maxSp*slopeK,tz=wz*maxSp*slopeK;const onG=!ME.air;
      const accel=(onG?42:14)*(maxSp>0?1:0),decel=onG?34:4;
      const dvx=tx-PHY.vx,dvz=tz-PHY.vz,dl=Math.hypot(dvx,dvz);const rate=(maxSp>0?accel:decel)*h;
      if(dl<=rate){PHY.vx=tx;PHY.vz=tz}else{PHY.vx+=dvx/dl*rate;PHY.vz+=dvz/dl*rate}
      if(steep>1.15&&onG&&!ME.dead){PHY.vx-=gx/steep*7*h*(steep-1.15);PHY.vz-=gz/steep*7*h*(steep-1.15)}
      if(ME.kb){PHY.vx+=ME.kb.x;PHY.vz+=ME.kb.z;ME.kb=null}
      const p={x:ME.pos.x+PHY.vx*h,z:ME.pos.z+PHY.vz*h};collide(p,.55);
      const bx=(p.x-ME.pos.x)/h,bz=(p.z-ME.pos.z)/h;if(Math.hypot(bx-PHY.vx,bz-PHY.vz)>.5){PHY.vx=bx*.9;PHY.vz=bz*.9}
      ME.pos.x=p.x;ME.pos.z=p.z;
      /* vertical */
      const gh=groundH(ME.pos.x,ME.pos.z);
      if(ME.air||ME.pos.y>gh+.04){ME.vy-=(ME.vy<0?28:21)*h;ME.pos.y+=ME.vy*h;PHY.coyote=Math.max(0,PHY.coyote-h);if(ME.pos.y<=gh){ME.pos.y=gh;if(ME.vy<-9){landFx()}ME.vy=0;ME.air=false}}
      else{ME.pos.y=gh;PHY.coyote=.12}
      PHY.jbuf=Math.max(0,PHY.jbuf-h);if(PHY.jbuf>0&&PHY.coyote>0&&!ME.dead&&!frozen){PHY.jbuf=0;PHY.coyote=0;ME.vy=7.9;ME.air=true;ME.pos.y+=.01;dustFx(ME.pos.x,ME.pos.z,6)}}
    if(PHY.accum>h)PHY.accum=0;
    sp=Math.hypot(PHY.vx,PHY.vz);mvx=sp>.01?PHY.vx/sp:0;mvz=sp>.01?PHY.vz/sp:0;
    if(sp>.4&&!ME.dead&&!(ME.auto&&isEnemy(ME.target)&&maxSp===0)){ME.ry=ME.ry+angDiff(ME.ry,Math.atan2(mvx,mvz))*clamp(dt*12,0,1);if(cam.drag<=0&&isTouch&&Math.abs(inp.x)<.5&&inp.y>.3)cam.yaw+=angDiff(cam.yaw,ME.ry+Math.PI)*clamp(dt*1.2,0,1)}}
  if(!ME.dash&&sp<.4&&ME.auto&&isEnemy(ME.target))ME.ry+=angDiff(ME.ry,Math.atan2(ME.target.x-ME.pos.x,ME.target.z-ME.pos.z))*clamp(dt*10,0,1);
  PHY.turn=lerp(PHY.turn,angDiff(PHY.prevRy,ME.ry)/Math.max(dt,.001)/8,clamp(dt*8,0,1));PHY.prevRy=ME.ry;
  ME.spd=sp;if(ME.dash)ME.pos.y=groundH(ME.pos.x,ME.pos.z)+(ME.dash.leap?Math.sin(Math.min(1,ME.dash.t0/ME.dash.t)*Math.PI)*1.6:0);
  /* casting */
  if(ME.cast){const c=ME.cast;c.t+=dt;{const h=myHand();castFx(c,dt,h.x,h.y,h.z)}setBar($('#castbar'),c.t,c.dur,c.a.n);if(c.t>=c.dur){ME.cast=null;$('#castbar').hidden=true;if(!c.a.need||(c.tg&&!c.tg.dead&&distTo(c.tg)-c.tg.size*.6<=c.a.range+2)){if(c.tg)faceTo(c.tg.x,c.tg.z);execAbility(c.a,c.tg)}else toast('Target lost')}}
  /* auto attack */
  ME.swing-=dt;const tg=ME.target;
  if(ME.auto&&isEnemy(tg)&&!ME.dead&&!ME.cast&&!ME.dash&&ME.swing<=0){const C=CLASSES[P.cls];const ak=!!(P.eq.wapen&&P.eq.wapen.wt==='ak');const d=distTo(tg)-tg.size*.6;if(d<=(ak?AK_RANGE:C.range)){if(ME.mounted)dismount();ME.swing=ST.spd/(1+TM('haste')+tbuff('haste'));faceTo(tg.x,tg.z);ME.combat=6;
    if(ak)akShoot(tg);
    else if(P.cls==='krijger'){swingAnim(false);sfx('swing');setTimeout(()=>{if(!tg.dead){dealDamage(tg,hitDmg(1));sfx('hit')}},150);P.mp=Math.min(ST.maxmp,P.mp+6+TM('rage'))}
    else if(P.cls==='jager'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,48,()=>dealDamage(tg,hitDmg(1)));fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
    else{swingAnim(true);proj('arcane',myHand(),tg,24,()=>dealDamage(tg,hitDmg(.85)));fxEmit({k:'p',t:'arcane',f:myHand().toArray(),m:tg.id})}}}
  if(ME.target&&ME.target.kind==='mon'&&ME.target.dead&&!ME.target.loot)setTarget(null);
  /* regen */
  if(!ME.dead){const oc=ME.combat<=0;if(oc)P.hp=Math.min(ST.maxhp,P.hp+ST.maxhp*.07*dt);else if(TM('regen'))P.hp=Math.min(ST.maxhp,P.hp+ST.maxhp*TM('regen')*dt);const r=ST.res;P.mp=Math.min(ST.maxmp,P.mp+(r==='mana'?ST.maxmp*(oc?.08:.022):r==='energie'?(oc?25:10):(oc?25:9))*(1+TM('mregen'))*dt)}
  /* portals */
  updActivity(dt,ME.spd>.5||!!ME.dash);updNodes(dt);
  if(ME.pos.x>1250&&!ME.dead&&D2.cell(ME.pos.x,ME.pos.z)==='~'&&!ME.air){ME.lavaT=(ME.lavaT||0)-dt;if(ME.lavaT<=0){ME.lavaT=.5;const d=Math.round(ST.maxhp*.04);P.hp-=d;ME.combat=6;floatText('me','-'+d+' lava','hurt');if(P.hp<=0){P.hp=0;die()}}}
  drakeLava(dt);
  if(ME.portalCd<=0&&!ME.dead){if(drakePortals()){}else if(ME.pos.x<700&&Math.hypot(ME.pos.x-CAVE.x,ME.pos.z-(CAVE.z+.6))<2.6)enterCave();else if(ME.pos.x>1250&&Math.hypot(ME.pos.x-D2.exit.x,ME.pos.z-(D2.exit.z+1.4))<2)leaveCave();else if(ME.pos.x<700&&Math.hypot(ME.pos.x-CRYPT.x,ME.pos.z-(CRYPT.z+.5))<2.3)enterDungeon();else if(ME.pos.x>700&&Math.hypot(ME.pos.x-DUN_EXIT.x,ME.pos.z-(DUN_EXIT.z+1.4))<2)leaveDungeon()}
  /* visuals */
  const g=ME.rig.g;g.position.copy(ME.pos);if(ME.spin>0){ME.spin-=dt;g.rotation.y+=dt*22}else g.rotation.y=ME.ry;
  stablePets(dt);if(ME.mounted&&(!canRideHere()||ME.dead))dismount();const riding=riderFrame(ME,ME.rig,ME.mounted,ME.pos.x,ME.pos.y,ME.pos.z,ME.ry,sp/7,ME.air,dt);
  autoDraw();animRig(ME.rig,{sheath:!!(ME.sheathed||riding),mounted:riding,act:riding?null:actAnim(),spd:sp/7,atk:ME.atk,ranged:ME.atkRanged,cast:!!ME.cast,dead:ME.dead,air:ME.air,vy:ME.vy,hurt:ME.hurtT>0,turn:PHY.turn,combat:ME.combat>0||isEnemy(ME.target),combo:ME.combo||0,onStep:side=>{if(ME.pos.x<700||true){const px=ME.pos.x+Math.cos(ME.ry)*side*.16,pz=ME.pos.z-Math.sin(ME.ry)*side*.16;dustFx(px,pz,3);if(sp>3&&S.sound)tone(90+Math.random()*30,.06,.018,'triangle',.6)}}},dt);ME.hurtT=Math.max(0,(ME.hurtT||0)-dt)}
function swingAnim(r){ME.atk=0;ME.atkRanged=r;ME.ac=((ME.ac||0)+1)%100;if(!r){ME.combo=((ME.combo||0)+1)%3;swingFx(ME.pos.x,ME.pos.y,ME.pos.z,ME.ry,ME.combo)}}
function updMonsters(dt){const auth=isAuth()&&S.mode!=='menu';const pl=auth?players():null;const k=clamp(dt*10,0,1);
  for(const m of[...MONS]){
    if(auth){const near=pl.some(p=>Math.abs(p.x-m.x)<90&&Math.abs(p.z-m.z)<90);if(near||m.tgt||m.dead||m.evade)aiUpdate(m,dt,pl)}
    else{m.x=lerp(m.x,m.nx,k);m.z=lerp(m.z,m.nz,k);m.ry+=angDiff(m.ry,m.nry)*k;if(m.atk>=0){m.atk+=dt*2.2;if(m.atk>1)m.atk=-1}if(m.root>0)m.root-=dt;if(m.stun>0)m.stun-=dt}
    if(!MONMAP.has(m.id))continue;
    {const hov=(m.dead?0:(m.t.hover||0))+(m.flyH||0);m.yo=lerp(m.yo||0,hov,clamp(dt*(m.dead?4:2.5),0,1));m.y=groundH(m.x,m.z)+m.yo}const g=m.rig.g;g.position.set(m.x,m.y,m.z);g.rotation.y=m.ry;
    const mdx=Math.abs(m.x-camTarget.x),mdz=Math.abs(m.z-camTarget.z);const vr=camTarget.x>700?58:70;if(mdx<vr&&mdz<vr){g.visible=true;/* schaduw alleen dichtbij */const sh=mdx+mdz<40;if(m.shOn!==sh){m.shOn=sh;g.traverse(o=>{if(o.isMesh&&o.userData.cs0===undefined)o.userData.cs0=o.castShadow;if(o.isMesh)o.castShadow=sh&&o.userData.cs0})}m.vis=lerp(m.vis||0,m.mv*.5,clamp(dt*6,0,1));/* animatie-LOD: ver weg maar om de 3 frames bijwerken */m.adt=(m.adt||0)+dt;const farM=mdx+mdz>45;if(!farM||((FRAME+m.lodk)%3===0)){animRig(m.rig,{spd:m.vis,atk:m.atk,dead:m.dead,hurt:m.hurtT>0,wt:m.t.wt,ranged:!!m.t.ranged,combo:m.ac%3,combat:!!m.tgt},m.adt);m.adt=0}m.hurtT=Math.max(0,(m.hurtT||0)-dt)}else g.visible=false;
    if(m.spark){const p=m.spark.geometry.attributes.position;const t=performance.now()*.002;for(let i=0;i<m.spark.userData.n;i++){const a=t+i*.9;p.setXYZ(i,Math.cos(a)*(.6+i%3*.2),.3+((t*.5+i*.13)%1.4),Math.sin(a)*(.6+i%3*.2))}p.needsUpdate=true;m.spark.position.set(m.x,m.y,m.z)}}
  if(auth)for(let i=PENDING.length-1;i>=0;i--){PENDING[i].t-=dt;if(PENDING[i].t<=0){const f=PENDING[i].fn;PENDING.splice(i,1);f()}}}
function updRemotes(dt){const k=clamp(dt*10,0,1);for(const r of REMOTES.values()){if(!r.rig)continue;const far=Math.hypot(r.tx-r.x,r.tz-r.z)>30;r.x=far?r.tx:lerp(r.x,r.tx,k);r.y=far?r.ty:lerp(r.y,r.ty,k);r.z=far?r.tz:lerp(r.z,r.tz,k);r.ry+=angDiff(r.ry,r.try)*k;
  if(r.atk>=0){r.atk+=dt*2.6;if(r.atk>1)r.atk=-1}r.rig.g.position.set(r.x,r.y,r.z);r.rig.g.rotation.y=r.ry;const rid=riderFrame(r,r.rig,r.dead?null:r.mt,r.x,r.y,r.z,r.ry,r.mv/7,r.y>groundH(r.x,r.z)+.3,dt);const pry=r.pry??r.ry;r.turnR=lerp(r.turnR||0,angDiff(pry,r.ry)/Math.max(dt,.001)/8,clamp(dt*8,0,1));r.pry=r.ry;animRig(r.rig,{sheath:!!(r.sh||rid),mounted:rid,act:rid?null:(r.lf||null),spd:r.mv/7,atk:r.atk,ranged:r.atkRanged,cast:r.cs,dead:r.dead,combat:!!r.cb,combo:r.co|0,air:r.y>groundH(r.x,r.z)+.3,vy:(r.y-(r.py??r.y))/Math.max(dt,.001),hurt:false,turn:r.turnR,onStep:()=>{if(Math.abs(r.x-camTarget.x)<40)dustFx(r.x,r.z,2)}},dt);r.py=r.y}}
let lightT=0,dunF=0,drkF=0;const FOG_D3=new THREE.Color(0x3a1408),FOG_DRK=new THREE.Color(0xa07a64),DRK_SUN=new THREE.Color(0xff9a5a);
let lodAcc=-1;const _lodDir=new THREE.Vector3(),_lodF={x:0,z:1};
function updWorld(dt,t){
  /* lights pool */
  lightT-=dt;if(lightT<=0){lightT=.3;const c=camTarget;const near=LANCH.map(a=>({a,d:(a.x-c.x)**2+(a.z-c.z)**2})).filter(o=>o.d<70*70).sort((x,y)=>x.d-y.d).slice(0,pointPool.length);pointPool.forEach((l,i)=>{const o=near[i];l.userData.a=o?o.a:null;if(o){l.position.set(o.a.x,o.a.y,o.a.z);l.color.copy(o.a.color);l.distance=o.a.dist}})}
  for(const l of pointPool){const a=l.userData.a;l.intensity=a?a.int*(a.flick?.85+Math.sin(t*9+a.ph)*.08+Math.sin(t*23+a.ph*2)*.06:1)*(camTarget.x>700?1:.55+DAY.night*.9):0}
  for(const f of flames){const q=f.userData.fi||0;f.scale.y=1+Math.sin(t*14+q)*.15;f.scale.x=f.scale.z=1+Math.sin(t*11+q*2)*.08}
  /* dungeon ambience */
  const inD=camTarget.x>700;dunF=lerp(dunF,inD?1:0,clamp(dt*3,0,1));if(Math.abs(dunF-(inD?1:0))<.01)dunF=inD?1:0;
  updDayNight();WIND.value=t;
  scene.fog.color.copy(FOG_DAY).lerp(camTarget.x>1250?FOG_D2:FOG_DUN,dunF);scene.background.copy(scene.fog.color);scene.fog.near=lerp(lerp(70,40,DAY.night),6,dunF);scene.fog.far=lerp(lerp(340,220,DAY.night),58,dunF);hemi.intensity=lerp(DAY.hemiInt,.22,dunF);sun.intensity=lerp(DAY.sunInt,.12,dunF);sun.color.copy(DAY.sunCol);fill.intensity=lerp(.55*(1-DAY.night*.5),0,dunF);skyMat.uniforms.dun.value=dunF;clouds.visible=dunF<.99;
  {const inK=camTarget.x<-1000;drkF=lerp(drkF,inK?1:0,clamp(dt*2,0,1));if(Math.abs(drkF-(inK?1:0))<.005)drkF=inK?1:0;if(drkF>0){scene.fog.color.lerp(FOG_DRK,drkF*(.85-DAY.night*.4));scene.background.copy(scene.fog.color);scene.fog.near=lerp(scene.fog.near,28,drkF);scene.fog.far=lerp(scene.fog.far,250,drkF);sun.color.lerp(DRK_SUN,drkF*.55);hemi.intensity*=1-.08*drkF;skyMat.uniforms.dun.value=Math.max(skyMat.uniforms.dun.value,drkF*.3)}}
  sky.visible=dunF<.98;
  /* Vuurgrot en Hart van de Vulkaan: warm lavalicht */if(camTarget.x>1250&&dunF>0){scene.fog.color.lerp(FOG_D3,dunF);scene.background.copy(scene.fog.color);scene.fog.far=lerp(scene.fog.far,90,dunF);hemi.intensity=lerp(hemi.intensity,.8,dunF);fill.color.setHex(0xff7a3a);fill.intensity=.7*dunF;sun.intensity=lerp(sun.intensity,.35,dunF)}else fill.color.setHex(0x8fb4ff);if(isTouch&&GFX.q!=='hoog')scene.fog.far*=.85;clouds.children.forEach(c=>c.traverse(m=>{if(m.isMesh&&m.material.emissive)m.material.emissiveIntensity=.35*(1-DAY.night*.8)}));
  {const B=fireflies.userData.base,P2=fireflies.geometry.attributes.position;for(let i=0;i<B.length;i+=1){P2.setY(i,B[i][1]+Math.sin(t*1.3+i)*.35);P2.setX(i,B[i][0]+Math.sin(t*.7+i*2.1)*.6)}P2.needsUpdate=true;const E=embers.userData.base,P3=embers.geometry.attributes.position;for(let i=0;i<E.length;i++){P3.setY(i,.3+((E[i][1]+t*.9+i*.37)%6.5));P3.setX(i,E[i][0]+Math.sin(t*.8+i)*.4)}P3.needsUpdate=true}
  torchLight.intensity=dunF*26;torchLight.position.set(camTarget.x,camTarget.y+3.2,camTarget.z);
  sun.position.copy(camTarget).add(SUN_OFF);sun.target.position.copy(camTarget);sky.position.copy(camera.position);waterMat.uniforms.time.value=t;ambientFx(dt,camTarget.x,camTarget.z);drakeAmbient(dt);
  lodAcc+=dt;{camera.getWorldDirection(_lodDir);const fl=Math.hypot(_lodDir.x,_lodDir.z)||1;const fx=_lodDir.x/fl,fz=_lodDir.z/fl;const turned=fx*_lodF.x+fz*_lodF.z<.93;
    if(lodAcc>.3||lodAcc<0||turned){lodAcc=0;_lodF.x=fx;_lodF.z=fz;updEnvLod(camTarget.x,camTarget.z,(GFX.q==='hoog'?110:GFX.q==='middel'?80:50)*(isTouch?.75:1),camera.position.x,camera.position.z,fx,fz)}}
  clouds.children.forEach((c,i)=>{c.position.x+=dt*(1.5+i%3);if(c.position.x>520)c.position.x=-520});
  for(const f of flags)f.rotation.y=Math.sin(t*2+f.position.x)*.25;
  if(window.__mill)window.__mill.rotation.z+=dt*.7;if(window.__cportal)window.__cportal.material.opacity=.28+Math.sin(t*3)*.12;if(window.__dportal)window.__dportal.material.opacity=.3+Math.sin(t*3)*.12;if(window.__vportal)window.__vportal.material.opacity=.3+Math.sin(t*2.4)*.12;for(const l of D2.lava)l.material.color.setRGB(.85+Math.sin(t*1.5+l.position.x)*.15,.19+Math.sin(t*2+l.position.z)*.05,.02);if(window.__rune)window.__rune.rotation.y+=dt*.2;
  {const F=fountainDrops;for(let i=0;i<F.n;i++){const v=F.v[i];v.t+=dt;if(v.t>1.1)v.t=0;const r=v.t*v.s;F.p[i*3]=Math.cos(v.a)*r;F.p[i*3+1]=FOUNT_Y+v.t*3.2-v.t*v.t*6.5;F.p[i*3+2]=Math.sin(v.a)*r}F.g.attributes.position.needsUpdate=true}
  /* NPC's en wachters: alleen tekenen en animeren als ze dichtbij zijn (en niet als je in een kerker bent) */
  {const cx=camTarget.x,cz=camTarget.z;const near=(g)=>{const v=g.position.x<700===cx<700&&Math.abs(g.position.x-cx)<90&&Math.abs(g.position.z-cz)<90;if(g.visible!==v)g.visible=v;return v};
  for(const n of NPCOBJ)if(near(n.rig.g))animRig(n.rig,{spd:0,atk:-1,act:(NPC_GLTF[n.id]||{}).act||null},dt);for(const gr of GUARDS)if(near(gr.g))animRig(gr,{spd:0,atk:-1},dt)}}
function updCamera(dt){
  cam.dist=lerp(cam.dist,cam.tdist,clamp(dt*8,0,1));cam.drag=Math.max(0,cam.drag-dt);
  const tx=ME.pos.x,ty=ME.pos.y+1.7,tz=ME.pos.z;if(snapCam){camTarget.set(tx,ty,tz);snapCam=false}else camTarget.lerp(_v.set(tx,ty,tz),clamp(dt*14,0,1));
  const inD=camTarget.x>700;let dist=inD?Math.min(cam.dist,camTarget.x>1700?20:14):cam.dist;const cp=Math.cos(cam.pitch);
  {const ox=Math.sin(cam.yaw)*cp,oy=Math.sin(cam.pitch),oz=Math.cos(cam.yaw)*cp;let lim=dist;for(let f=.3;f<=1.001;f+=.1){const d=dist*f;if(camBlocked(camTarget.x+ox*d,camTarget.y+oy*d,camTarget.z+oz*d)){lim=Math.max(2.5,d-1.2);break}}cam.cdist=lerp(cam.cdist||lim,lim,clamp(dt*(lim<(cam.cdist||lim)?12:3),0,1));dist=Math.min(dist,cam.cdist)}
  camera.position.set(camTarget.x+Math.sin(cam.yaw)*cp*dist,camTarget.y+Math.sin(cam.pitch)*dist,camTarget.z+Math.cos(cam.yaw)*cp*dist);
  /* camera nooit onder het wateroppervlak of de grond */{const cx=camera.position.x,cz=camera.position.z;let minY=groundH(cx,cz)+.5;if(Math.hypot(cx-LAKE.x,cz-LAKE.z)<LAKE.r*1.3)minY=Math.max(minY,water.position.y+.7);if(camera.position.y<minY)camera.position.y=minY}
  const gh=groundH(camera.position.x,camera.position.z)+.6;if(camera.position.y<gh)camera.position.y=gh;camera.lookAt(camTarget)}
let uiT=0,saveT=0,mmT=0,buffT=0;
let mapT=0;function updHud(dt){if(isTouch&&(updHud._k=(updHud._k|0)+1)%10===0)syncPop();
  setBar($('#pHp'),P.hp,ST.maxhp);const mp=$('#pMp');const mc='bar '+RES_COL[ST.res];if(mp.className!==mc)mp.className=mc;setBar(mp,P.mp,ST.maxmp);if($('#pLvl').textContent!=String(P.level))$('#pLvl').textContent=P.level;
  setBar($('#xpbar'),P.xp,xpNeed(P.level),P.level>=MAXLVL?'Maximum level':'Experience '+P.xp+' / '+xpNeed(P.level));
  updTargetFrame();updBar();
  if(!$('#pMap').hidden){mapT-=dt;if(mapT<=0){mapT=1/30;drawBigMap()}}
  mmT-=dt;if(mmT<=0){mmT=.1;drawMini();netStatus();updZone();if(GROUP)refreshPartyBars()}
  buffT-=dt;if(buffT<=0){buffT=5;const before=JSON.stringify(P.buffs||{});const fr=P.hp/ST.maxhp;calcStats();if(JSON.stringify(P.buffs||{})!==before)P.hp=Math.round(ST.maxhp*fr);refreshBuffs();if(!$('#pLife').hidden){energyTick();const eb=$('#enBar');if(eb)setBar(eb,P.energy,maxEnergy(),'Energy '+Math.floor(P.energy)+' / '+maxEnergy())}}
  if(toastT>0){toastT-=dt;if(toastT<=0)$('#toast').style.opacity=0}if(bannerT>0){bannerT-=dt;if(bannerT<=0)$('#banner').style.opacity=0}}
function refreshPartyBars(){document.querySelectorAll('#party .pm').forEach(x=>{const r=REMOTES.get(x.dataset.id);if(!r)return;const i=x.querySelector('i');i.style.transform='scaleX('+clamp(r.hp/Math.max(1,r.mhp),0,1)+')';x.querySelector('.bar span').textContent=r.dead?'Dead':r.hp+'/'+r.mhp})}
function saveGame(now){if(!P||S.mode!=='play')return;P.x=ME.pos.x;P.z=ME.pos.z;P.ry=ME.ry;P.saved=Date.now();if(now||!saveGame.t){writeSave();saveGame.t=1;setTimeout(()=>{saveGame.t=0},1500)}}
addEventListener('pagehide',()=>saveGame(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame(true)});

/* ===================== menu & character creation ===================== */
const menu={sel:0,race:'mens',cls:'krijger',hair:0,creating:false,preview:null};
function charDesc(c){return'Level '+c.level+' '+RACES[c.race].n+' '+CLASSES[c.cls].n+' · '+zoneAt(c.x,c.z)}
function renderCharList(){const L=$('#charList');L.innerHTML='';if(!SAVE.chars.length){L.innerHTML='<p class="desc">You don\'t have a hero yet. Create one to enter Velmora.</p>'}
  SAVE.chars.forEach((c,i)=>{const b=document.createElement('button');b.className='citem'+(i===menu.sel?' sel':'');const cv=document.createElement('canvas');cv.width=cv.height=64;cv.className='cicon';drawPortrait(cv,{cls:c.cls,race:c.race,hair:c.hair});b.appendChild(cv);b.insertAdjacentHTML('beforeend','<span><b>'+esc(c.name)+'</b><small>'+esc(charDesc(c))+'</small></span>');b.onclick=()=>{menu.sel=i;renderCharList();updPreview()};b.ondblclick=()=>enterWorld();L.appendChild(b)});
  $('#bPlay').disabled=!SAVE.chars.length;$('#bDel').disabled=!SAVE.chars.length}
function updPreview(){let look;if(menu.creating)look=playerLook({race:menu.race,cls:menu.cls,hair:menu.hair,eq:newChar('Preview',menu.race,menu.cls,menu.hair).eq});else{const c=SAVE.chars[menu.sel];look=c?playerLook(c):null}
  if(menu.preview){scene.remove(menu.preview.g);menu.preview=null}if(!look)return;menu.preview=buildHumanoid(look);menu.preview.g.position.set(6,groundH(6,14),14);menu.preview.g.rotation.y=.5;scene.add(menu.preview.g)}
function buildCreate(){const ro=$('#raceOpts');ro.innerHTML='';for(const k in RACES){const b=document.createElement('button');b.className='opt'+(k===menu.race?' sel':'');b.textContent=RACES[k].n;b.onclick=()=>{menu.race=k;menu.hair=0;buildCreate();updPreview()};ro.appendChild(b)}
  const co=$('#clsOpts');co.innerHTML='';for(const k in CLASSES){const b=document.createElement('button');b.className='opt'+(k===menu.cls?' sel':'');b.textContent=CLASSES[k].n;b.style.color=k===menu.cls?CLASSES[k].col:'';b.onclick=()=>{menu.cls=k;buildCreate();updPreview()};co.appendChild(b)}
  const ho=$('#hairOpts');ho.innerHTML='';ho.hidden=!(RACES[menu.race].undead||RACES[menu.race].orc);if(!ho.hidden){const l=document.createElement('span');l.className='l';l.textContent=RACES[menu.race].orc?'Skin':'Eye glow';l.style.cssText='width:100%;display:block;margin:2px 0';ho.appendChild(l)}RACES[menu.race].hair.forEach((h,i)=>{const b=document.createElement('button');b.style.background='#'+new THREE.Color(h).getHexString();b.className=i===menu.hair?'sel':'';b.setAttribute('aria-label',(RACES[menu.race].undead?'Eye colour ':RACES[menu.race].orc?'Skin colour ':'Hair colour ')+(i+1));b.onclick=()=>{menu.hair=i;buildCreate();updPreview()};ho.appendChild(b)});
  $('#cDesc').innerHTML='<b style="color:var(--ink)">'+RACES[menu.race].n+':</b> '+esc(RACES[menu.race].desc)+'<br><b style="color:'+CLASSES[menu.cls].col+'">'+CLASSES[menu.cls].n+':</b> '+esc(CLASSES[menu.cls].desc)}
$('#bNew').onclick=()=>{if(SAVE.chars.length>=6)return alertMsg('You can have at most six heroes.');menu.creating=true;$('#sel').hidden=true;$('#create').hidden=false;buildCreate();updPreview();setTimeout(()=>{if(!isTouch)$('#nameIn').focus()},50)};
$('#bBack').onclick=()=>{menu.creating=false;$('#sel').hidden=false;$('#create').hidden=true;renderCharList();updPreview()};
function alertMsg(t){$('#cDesc').textContent=t}
$('#bCreate').onclick=()=>{const n=$('#nameIn').value.trim().replace(/\s+/g,' ');if(!/^[\p{L}][\p{L}\p{N} '\-]{1,13}$/u.test(n)){$('#cDesc').innerHTML='<span style="color:#ff6b6b">Choose a name of 2 to 14 characters that starts with a letter.</span>';return}
  if(SAVE.chars.some(c=>c.name.toLowerCase()===n.toLowerCase())){$('#cDesc').innerHTML='<span style="color:#ff6b6b">You already have a hero with that name.</span>';return}
  const c=newChar(n,menu.race,menu.cls,menu.hair);SAVE.chars.push(c);menu.sel=SAVE.chars.length-1;SAVE.last=c.id;writeSave();menu.creating=false;$('#create').hidden=true;$('#sel').hidden=false;$('#nameIn').value='';renderCharList();enterWorld()};
$('#nameIn').addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')$('#bCreate').click()});
let delArm=0;$('#bDel').onclick=()=>{const c=SAVE.chars[menu.sel];if(!c)return;if(delArm<performance.now()){delArm=performance.now()+3000;$('#bDel').textContent='Are you sure?';setTimeout(()=>$('#bDel').textContent='Delete',3000);return}SAVE.chars.splice(menu.sel,1);menu.sel=0;writeSave();$('#bDel').textContent='Delete';delArm=0;renderCharList();updPreview()};
$('#bPlay').onclick=()=>enterWorld();
function showMenu(){S.mode='menu';$('#menu').hidden=false;$('#hud').hidden=true;$('#touch').hidden=true;$('#death').hidden=true;hideTip();menu.creating=!SAVE.chars.length;$('#sel').hidden=menu.creating;$('#create').hidden=!menu.creating;if(menu.creating)buildCreate();
  const li=SAVE.chars.findIndex(c=>c.id===SAVE.last);menu.sel=li>=0?li:0;renderCharList();updPreview();if(ME.rig)ME.rig.g.visible=false;for(const p of panels)$('#'+p).hidden=true;platesEl.querySelectorAll('.plate').forEach(p=>p.style.display='none')}
function enterWorld(){const c=SAVE.chars[menu.sel];if(!c)return;P=c;SAVE.last=c.id;P.inv=P.inv||Array(BAG).fill(null);while(P.inv.length<BAG)P.inv.push(null);P.life=P.life||{};P.buffs=P.buffs||{};migrateItems();if(P.energy==null)P.energy=100;energyTick();ACT.cur=null;P.quests=P.quests||{};P.done=P.done||[];
  if(menu.preview){scene.remove(menu.preview.g);menu.preview=null}ME.lookKey='';calcStats();rebuildMe();ME.rig.g.visible=true;ME.dead=false;ME.cds={};ME.gcd=0;ME.cast=null;ME.auto=false;ME.target=null;ME.dash=null;
  const sx=isFinite(P.x)?P.x:0,sz=isFinite(P.z)?P.z:6;ME.pos.set(sx,groundH(sx,sz),sz);ME.ry=P.ry||Math.PI;cam.yaw=ME.ry+Math.PI;cam.pitch=.38;cam.tdist=cam.dist=12;snapCam=true;
  ensureMounts();ME.mounted=null;ME.sheathed=false;{const mb=$('#mountBtn');if(!mb.onclick){mb.innerHTML=MOUNT_SVG;mb.onclick=()=>{toggleMount();mb.blur()}}const sb=$('#sheathBtn');if(!sb.onclick){sb.innerHTML=SHEATH_SVG;sb.onclick=()=>{toggleSheath();sb.blur()}}}updMountBtn();updSheathBtn();S.mode='play';$('#menu').hidden=true;$('#hud').hidden=false;$('#touch').hidden=!isTouch;$('#pName').textContent=P.name;$('#pCls').textContent=RACES[P.race].n+' '+CLASSES[P.cls].n;drawPortrait($('#pPort'),{cls:P.cls,race:P.race,hair:P.hair});P.honor=P.honor||0;refreshPvpUi();refreshBuffs();
  logEl.innerHTML='';barEls.length=0;$('#abar').innerHTML='';buildBar();refreshTracker();refreshNpcMarks();refreshBag();refreshParty();zoneName='';updZone(true);
  log('Welcome to Velmora, '+P.name+'!','sys');if(!P.done.length&&!Object.keys(P.quests).length)log(isTouch?'Tip: walk up to people with a yellow ! and tap them for a quest.':'Tip: walk up to people with a yellow ! and click them (or press F) for a quest. Press Enter to chat.','sys');
  if(room&&room.connected())log('You are online: you see other players live. Click a player to invite them to your group.','sys');else log('You are still playing offline. As soon as you connect, other players will appear automatically.','sys');
  writeSave();lastPres=''}
function toMenu(){saveGame(true);if(GROUP)leaveGroup();S.mode='menu';lastPres='';ME.target=null;if(room&&room.connected())room.presence({in:0});showMenu();$('#tframe').hidden=true}

/* ===================== main loop ===================== */
const clock=new THREE.Clock();let menuT=0;
function resize(){renderer.setSize(innerWidth,innerHeight,false);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);gtao.setSize(innerWidth,innerHeight);smaa.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=camera.aspect<1?Math.min(80,2*Math.atan(Math.tan(31*Math.PI/180)/camera.aspect)*180/Math.PI):58;camera.updateProjectionMatrix();document.body.classList.toggle('portrait',innerHeight>innerWidth);if(typeof layoutTB==='function')layoutTB()}
addEventListener('resize',resize);resize();
flames.forEach((f,i)=>f.userData.fi=i);
let lastTick=performance.now();
setInterval(()=>{if(!document.hidden)return;const now=performance.now();const dt=Math.min(1,(now-lastTick)/1000);lastTick=now;try{updMonsters(dt);updProj(dt);if(isAuth())sendSnap();presSkip=99;presT=0;sendPresence(dt)}catch(e){}},500);
let FRAME=0;
function loop(){requestAnimationFrame(loop);const PF=window.__PROF,_t0=PF?performance.now():0;FRAME++;lastTick=performance.now();const rdt=clock.getDelta();const dt=Math.min(rdt,window.__MAXDT||.05);perfWatch(Math.min(rdt,.2));S.t+=dt;const t=S.t;const W=innerWidth,H=innerHeight;
  if(S.mode==='play'){updPlayer(dt);updArena(dt);updCamera(dt);updHud(dt);saveT-=dt;if(saveT<=0){saveT=10;saveGame(true)}}
  else{menuT+=dt;mmT-=dt;if(mmT<=0){mmT=1;netStatus()}const px=6,pz=14,py=groundH(px,pz);const a=.5+Math.sin(menuT*.15)*.35;const wide=innerWidth>760;camTarget.set(px+(wide?-2.2:0),py+(wide?1.3:1.6),pz);
    camera.position.set(px+Math.sin(a)*7.2,py+2.6,pz+Math.cos(a)*7.2);camera.lookAt(camTarget);if(menu.preview){menu.preview.g.rotation.y=a+Math.sin(menuT*.6)*.1;animRig(menu.preview,{spd:0,atk:-1},dt)}}
  updMonsters(dt);updRemotes(dt);updProj(dt);updFx(dt);updParticles(dt);updTrail(dt);updWorld(dt,t);updPerf(dt);
  if(isAuth()){snapAcc+=dt;if(snapAcc>=.1){snapAcc=0;sendSnap()}}sendPresence(dt);
  const _t1=PF?performance.now():0;if(!window.__NORENDER){if(isTouch&&(FRAME&1))renderer.shadowMap.needsUpdate=true;if(GFX.post)composer.render();else renderer.render(scene,camera)}const _t2=PF?performance.now():0;updPlates(W,H);updFloat(dt,W,H);
  if(PF){const _t3=performance.now();PF.n++;PF.upd+=_t1-_t0;PF.ren+=_t2-_t1;PF.ui+=_t3-_t2}}
let snapAcc=0;const perf={t:0,n:0};
/* dynamische resolutie op mobiel: eerst de renderresolutie omlaag (tot 60%), pas daarna de kwaliteit */
const DRS={t:0,n:0};
function dynRes(dt){if(!isTouch||S.mode!=='play'||S.noPerf)return;DRS.t+=dt;DRS.n++;if(DRS.t<2)return;const avg=DRS.t/DRS.n;DRS.t=DRS.n=0;const dpr=renderer.getPixelRatio()/GFX.rs;
  let rs=GFX.rs;if(avg>.036&&rs>.6)rs=Math.max(.6,rs-.1);else if(avg<.022&&rs<1)rs=Math.min(1,rs+.05);if(rs!==GFX.rs){GFX.rs=rs;renderer.setPixelRatio(dpr*rs);if(typeof resize==='function')resize()}}
function perfWatch(dt){dynRes(dt);if(S.mode!=='play'||S.noPerf||GFX.auto>=2||GFX.q==='laag'||(isTouch&&GFX.rs>.65))return;perf.t+=dt;perf.n++;if(perf.t>=5){const avg=perf.t/perf.n;perf.t=perf.n=0;if(avg>.042){GFX.q=GFX.q==='hoog'?'middel':'laag';GFX.auto++;applyGfx();$('#bGfx').textContent='Graphics: '+GFX_N[GFX.q];log('Graphics quality has been lowered to '+GFX_N[GFX.q].toLowerCase()+' for smoother play (adjustable in the menu).','sys')}}}
window.__V={get P(){return P},SHEATH,toggleSheath,MOUNTS,toggleMount,doMount,dismount,learnMount,mountDropFor,STABLE,refreshChar,CG,collide,PATHS,NPCS,pathDist,TOWN_GATES,TOWN_B,TOWN_SMOKE,TOWN_L,TOWN_T,TOWN_P,BOXES,migrateItems,giveMat,finishCraft,craftGear,finishSkin,STATIONS,CRAFT,ACT,refreshLife,lifeOf,skinTarget,startSkin,MICON,ACT_ANIM,get TOOL_CLIPS(){return TOOL_CLIPS},fxTest:(p,w)=>{if(w===1){novaFx(p.x,p.z);whirlFx(p.x,p.y,p.z)}else if(w===2){shoutFx(p.x,p.y,p.z);slamFx(p.x+3,p.y+1,p.z+2,0)}else{projImpact('fire',p.x+3,p.y+1,p.z+1);blinkFx(p.x-6,p.y,p.z-4,p.x-2,p.y,p.z+2);meteorWarnFx(p.x+6,p.z-4);for(let i=0;i<20;i++)projTrail('fire',{x:p.x-3+i*.15,y:p.y+1.5,z:p.z+3},.016);for(let i=0;i<30;i++)castFx({a:{ic:[0,'#ffb02e']},t:i*.03,dur:1},.04,p.x,p.y+1.4,p.z)}},PS:()=>[PS_ADD,PS_NRM,PS_BOOM],sky,buildMonster,buildHumanoid,playerLook,MON,NPCOBJ,animRig,hitDmg,monDmg,monHp,groundH,cam,killMon,dealDamage,myId,coneFx,breathFx,fireTele,DRK,D3,D3_HALL,DRK_GATE,DRK_ENTRY,VOLC,VOLC_DOOR,DRK_CAMP,makeLegendary,enterDrake,enterVolcano,leaveVolcano,leaveDrake,drkLava,dragonAI,DPOOLS,PERF,DUN_ENTRY,batchStatic,NODES,learnTalent,talentSkills,talentFree,TM,respecTalents,respecCost,bar,useAbility,execAbility:typeof execAbility!=='undefined'?execAbility:null,refreshTalent,openPanel,gainXp,TALENTS,animRig,ambientFx,lvlFx,buildBar,projImpact,projTrail,novaFx,whirlFx,hitFx,healFx,twirlFx,shoutFx,muzzleFx,updParticles,emitP,FXC,AMBIENT,refreshBag,log,ARENA,ARENA_ST,arenaInteract,hasAK,preloadModels,gltfCache,ENV_IM,ENV_LOD,HOUSES,composer,gtao,smaa,waterMat,buildMonster,buildGltfNpc,MON,DAY,get PH(){return PH},NODES,startGather,startFish,fishHook,ACT,startCraft,RECIPES,D2,enterCave,lifeOf,useConsumable,setPvp,pvpHostile,renderer,scene,camera,buildHumanoid,playerLook,proj,calcStats,makeGear,rebuildMe,get P(){return P},ME,MONS,MONMAP,REMOTES,S,get GROUP(){return GROUP},get room(){return room},useAbility,enterWorld,teleport,inviteToGroup,setTarget,lootMon,interact,openNpc,NPCOBJ,completeQuest,QUESTS,sendChat,cycleTarget,isAuth,cam};
loadSave();startNet();netStatus();$('#loadMsg').textContent='Loading character models';
Promise.all([preloadModels(),buildEnv(),buildDrakeEnv(),buildVisualEnv(),buildCraftEnv(),buildTown()]).then(()=>{try{ambientInit();if(!window.__NOBATCH)batchStatic()}catch(e){console.warn('batching failed',e)}showMenu();$('#loading').hidden=true;loop()});
