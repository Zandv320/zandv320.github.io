/* ===================== The Paladin: abilities, heals and the Light =====================
   Base abilities: Crusader Strike, Judgement, Flash of Light, Divine Shield.
   Talent abilities: Holy Light and Light of Dawn (Holy), Avenger's Shield and Guardian of Ancient Kings (Protection),
   Divine Storm and Avenging Wrath (Retribution).
   Heals go to your friendly target: a group member or any other player you clicked (not one you're fighting in PvP);
   without one, you heal yourself. A heal on another player is sent over the network ('pheal'); they apply it. */
const HOLY=0xffe08a,HOLY2=0xfff6d0;
/* the friendly target of a heal: a living player you have selected who isn't hostile, else yourself */
function healTarget(){const t=ME.target;if(t&&t.kind==='pl'&&!t.dead&&!pvpHostile(t))return t;return'me'}
function healAmount(mult){let n=(ST.pow*1.7+P.level*9+22)*mult*(1+TM('heal')+tbuff('heal'));const crit=Math.random()*100<ST.crit+tbuff('crit');if(crit)n*=1.5;return[Math.round(n),crit]}
function healPos(t){return t==='me'?{x:ME.pos.x,y:ME.pos.y,z:ME.pos.z}:{x:t.x,y:t.y||groundH(t.x,t.z),z:t.z}}
/* heal one target, with the light falling on them */
function holyHeal(t,mult,big){const[n,crit]=healAmount(mult);const p=healPos(t);
  healFx(p.x,p.y,p.z,big?0xfff2b0:0xffe9a0);flash(p.x,p.y+1.2,p.z,HOLY,big?2.4:1.6,.25);if(big)beamFx(p.x,p.z,HOLY,.7,.9);
  for(let i=0;i<(big?18:10);i++){const a=FRN(0,6.28),r=FRN(.2,.8);emitP({x:p.x+Math.cos(a)*r,y:p.y+FRN(.1,1.8),z:p.z+Math.sin(a)*r,vy:FRN(1,2.4),life:FRN(.6,1.1),size:.22,size1:.05,col:Math.random()<.5?HOLY:HOLY2,a:1,a1:0,cell:FXC.glint})}
  if(t==='me'){heal(n);if(crit)floatText('me','Critical heal!','heal')}else{netEmit('pheal',{to:t.id,h:n,n:P.name,c:crit?1:0});floatText(t,'+'+n+(crit?'!':''),'heal')}
  fxEmit({k:'hl',x:p.x,z:p.z,big:big?1:0});ME.combat=Math.max(ME.combat,3)}
/* a heal sent by another paladin */
function receiveHeal(d,from){if(S.mode!=='play'||!P||ME.dead)return;const n=clamp(Math.round(+d.h||0),0,8000);if(!n)return;heal(n);const nm=String(d.n||'A paladin').slice(0,14);if(d.c)floatText('me','Critical heal!','heal');
  if(!receiveHeal.t||performance.now()-receiveHeal.t>4000){receiveHeal.t=performance.now();log(esc(nm)+' heals you for '+n+'.','grp')}}
/* group members (players) around a point */
function groupNear(x,z,r){const out=[];if(GROUP)for(const id of GROUP.members){if(id===myId())continue;const p=REMOTES.get(id);if(p&&!p.dead&&Math.hypot(p.x-x,p.z-z)<r)out.push(p)}return out}
/* golden wings for Avenging Wrath and the guardian king of Protection: particles, no extra models */
function wingsFx(sec){const t0=performance.now();ticker(Math.round(sec*6),1/6,()=>{if(ME.dead)return;const x=ME.pos.x,y=ME.pos.y,z=ME.pos.z,f=ME.ry;const bx=-Math.sin(f)*.35,bz=-Math.cos(f)*.35,rx=Math.cos(f),rz=-Math.sin(f);
  for(const sd of[-1,1])for(let k=0;k<5;k++){const u=k/4;const sx=x+bx+rx*sd*(.3+u*1.3),sz=z+bz+rz*sd*(.3+u*1.3),sy=y+1.5+Math.sin(u*2.6)*.7-u*.3;
    emitP({x:sx,y:sy,z:sz,vy:-.2,life:.45,size:.5-u*.15,size1:.1,col:k%2?HOLY:HOLY2,a:.9,a1:0,cell:FXC.glint})}})}
function guardianFx(sec){ticker(Math.round(sec*3),1/3,()=>{if(ME.dead)return;const x=ME.pos.x,y=ME.pos.y,z=ME.pos.z;runeCircle(x,z,1.6,HOLY,.6);
  for(let i=0;i<8;i++){const a=i/8*6.28+performance.now()*.002;emitP({x:x+Math.cos(a)*1.3,y:y+.2,z:z+Math.sin(a)*1.3,vy:FRN(1.5,3),life:.8,size:.3,size1:.06,col:HOLY,a:1,a1:0,cell:FXC.glint})}})}
function bubbleFx(sec){ticker(Math.round(sec*4),.25,()=>{if(ME.dead)return;const x=ME.pos.x,y=ME.pos.y+1,z=ME.pos.z;for(let i=0;i<6;i++){const a=FRN(0,6.28),b=FRN(-1.2,1.2);emitP({x:x+Math.cos(a)*Math.cos(b)*1.3,y:y+Math.sin(b)*1.3,z:z+Math.sin(a)*Math.cos(b)*1.3,life:.5,size:.35,size1:.1,col:HOLY2,a:.8,a1:0,cell:FXC.glint})}
  emitP({x,y,z,life:.3,size:2.8,size1:2.9,col:0xfff0b0,a:.12,a1:0,cell:FXC.halo,must:1})})}
/* ---- the abilities ---- */
function execPaladin(a,tg){const id=a.id,x=ME.pos.x,y=ME.pos.y,z=ME.pos.z;
  if(id==='kruis'){swingAnim(false);sfx('swing');setTimeout(()=>{if(tg.dead)return;const hy=tg.y+(tg.rig&&tg.rig.h||1.5)*.55;dealDamage(tg,hitDmg(1.4,id));sfx('hit');flash(tg.x,hy,tg.z,HOLY,1.8,.18);
      for(let i=0;i<10;i++)emitP({x:tg.x,y:hy,z:tg.z,vx:FRN(-3,3),vy:FRN(0,3),vz:FRN(-3,3),drag:2,life:.5,size:.3,size1:.05,col:HOLY,a:1,a1:0,cell:FXC.glint});
      P.mp=Math.min(ST.maxmp,P.mp+ST.maxmp*.02);fxEmit({k:'sl',x:tg.x,y:hy,z:tg.z,r:ME.ry})},140);ME.swing=Math.max(ME.swing,.6)}
  else if(id==='oordeel'){swingAnim(true);sfx('quest');const from=myHand();proj('holy',from,tg,30,()=>{dealDamage(tg,hitDmg(1.6,id));projImpact('holy',tg.x,tg.y+1.1,tg.z);flash(tg.x,tg.y+1.2,tg.z,HOLY,2.6,.3);runeCircle(tg.x,tg.z,1.4,HOLY,.8)});fxEmit({k:'p',t:'holy',f:from.toArray(),m:tg.id})}
  else if(id==='flits_licht'){swingAnim(true);sfx('quest');holyHeal(tg||healTarget(),1,false)}
  else if(id==='heiliglicht'){swingAnim(true);sfx('lvl');holyHeal(tg||healTarget(),2.7,true)}
  else if(id==='dageraad'){swingAnim(true);sfx('lvl');shockwave(x,z,18,HOLY,.8);runeCircle(x,z,3,HOLY,1.2);fxEmit({k:'r',x,z,r:18,c:HOLY});holyHeal('me',1.5,false);for(const p of groupNear(x,z,18))holyHeal(p,1.5,false)}
  else if(id==='godschild'){addTbuff('immune',1,8);bubbleFx(8);sfx('frost');log('Divine Shield: you are immune to all damage for 8 seconds.','sys')}
  else if(id==='wraakschild'){swingAnim(true);sfx('swing');const hit=[tg];for(const m of MONS){if(hit.length>=3)break;if(m!==tg&&!m.dead&&Math.hypot(m.x-tg.x,m.z-tg.z)<10)hit.push(m)}
    let from=myHand();hit.forEach((m,k)=>{const f=from.clone();setTimeout(()=>{if(m.dead||ME.dead)return;proj('holy',f,m,34,()=>{dealDamage(m,hitDmg(1.5,id),{stun:1.5,taunt:1});flash(m.x,m.y+1.2,m.z,HOLY,2,.2);sparks(m.x,m.y+1.2,m.z,HOLY,10,5,.3,.4)});fxEmit({k:'p',t:'holy',f:f.toArray(),m:m.id})},k*220);from=new THREE.Vector3(m.x,(m.y||0)+1.2,m.z)})}
  else if(id==='oudekoningen'){addTbuff('dr',.6,10);guardianFx(10);beamFx(x,z,HOLY,1,1.4);sfx('quest');log('Guardian of Ancient Kings: 60% less damage for 10 seconds.','sys')}
  else if(id==='goddelijkestorm'){ME.spin=.6;sfx('swing');whirlFx(x,y,z);shockwave(x,z,7,HOLY,.5);fxEmit({k:'r',x,z,r:7,c:HOLY});let tot=0;
    for(const m of enemiesNear(x,z,7)){const d=hitDmg(1.3,id);tot+=d;dealDamage(m,d)}for(let i=0;i<24;i++){const a=i/24*6.28;emitP({x:x+Math.cos(a)*2,y:y+1,z:z+Math.sin(a)*2,vx:Math.cos(a)*6,vz:Math.sin(a)*6,drag:2,life:.5,size:.4,size1:.1,col:HOLY,a:1,a1:0,cell:FXC.glint})}
    if(tot)heal(tot*.15)}
  else if(id==='wraak'){addTbuff('dmg',.3,20);addTbuff('heal',.3,20);wingsFx(20);flash(x,y+1.5,z,HOLY,4,.4);beamFx(x,z,HOLY,1.2,1.6);sfx('lvl');log('Avenging Wrath: +30% damage and healing for 20 seconds.','sys')}
  else return false;return true}
