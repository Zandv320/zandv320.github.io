/* ===================== The high abilities: what every class learns at level 30, 40 and 50 =====================
   Warrior: Thunder Clap, Execute, Avatar of the Rift.   Mage: Ice Barrier, Chain Lightning, Rift Collapse.
   Paladin: Consecration, Lay on Hands, Hammer of the Heavens.   Hunter: Frost Trap, Rapid Fire, Void Barrage.
   Talents in rows 6 and 7 (1b_talents.js, TAL_RIFT) strengthen them through the usual '<id>.dmg/.cd/...' keys. */
const VOIDC=0xc08aff,VOIDP=0xff6ad8;
/* a short-lived violet aura around you (Avatar of the Rift) */
function voidAuraFx(sec){ticker(Math.round(sec*4),.25,()=>{if(ME.dead)return;const x=ME.pos.x,y=ME.pos.y,z=ME.pos.z;
  for(let i=0;i<5;i++){const a=FRN(0,6.28),r=FRN(.4,1);emitP({x:x+Math.cos(a)*r,y:y+FRN(0,1.6),z:z+Math.sin(a)*r,vy:FRN(1,2.4),life:FRN(.5,.8),size:.4,size1:.1,col:i%2?VOIDC:VOIDP,a:1,a1:0,cell:FXC.wisp})}
  emitP({x,y:y+1,z,life:.3,size:2.4,size1:2.6,col:VOIDC,a:.14,a1:0,cell:FXC.halo,must:1})})}
function execHigh(a,tg){const id=a.id,x=ME.pos.x,y=ME.pos.y,z=ME.pos.z;
  /* ---- warrior ---- */
  if(id==='donder'){sfx('boom');shockwave(x,z,8,0x9ad0ff,.5);dustRing(x,z,8,18);flash(x,y+.4,z,0x9ad0ff,3,.25);fxEmit({k:'r',x,z,r:8,c:0x9ad0ff});
    for(const m of enemiesNear(x,z,8))dealDamage(m,hitDmg(1.3,id),{stun:1.5})}
  else if(id==='executie'){swingAnim(false);sfx('swing');setTimeout(()=>{if(tg.dead)return;dealDamage(tg,hitDmg(3.8,id));sfx('hit');const hy=tg.y+(tg.rig&&tg.rig.h||1.5)*.55;
      emitP({x:tg.x,y:hy,z:tg.z,life:.4,size:2.6,size1:4.4,col:0xff3a2a,a:1,a1:0,cell:FXC.crit,vrot:3,must:1});fxEmit({k:'sl',x:tg.x,y:hy,z:tg.z,r:ME.ry})},150);ME.swing=Math.max(ME.swing,.6)}
  else if(id==='avatar'){addTbuff('dmg',.3,15);addTbuff('dr',.25,15);addTbuff('haste',.2,15);voidAuraFx(15);shoutFx(x,y,z);beamFx(x,z,VOIDC,.9,1.1);fxEmit({k:'r',x,z,r:5,c:VOIDC});sfx('lvl');
    log('Avatar of the Rift: 30% more damage, 25% less damage taken and faster attacks for 15 seconds.','sys')}
  /* ---- mage ---- */
  else if(id==='ijsbarriere'){addTbuff('dr',.4,10);runeCircle(x,z,1.5,0xbfeaff,10);sfx('frost');emitP({x,y:y+1,z,life:.7,size:1,size1:4.2,col:0xbfeaff,a:.9,a1:0,cell:FXC.halo,must:1});
    ticker(20,.5,()=>{if(ME.dead)return;for(let i=0;i<3;i++){const a=FRN(0,6.28),b=FRN(-1,1.2);emitP({x:ME.pos.x+Math.cos(a)*1.2,y:ME.pos.y+1+b,z:ME.pos.z+Math.sin(a)*1.2,life:.6,size:.35,size1:.1,col:0xe8faff,a:.9,a1:0,cell:FXC.star})}});
    fxEmit({k:'r',x,z,r:4,c:0xbfeaff});for(const m of enemiesNear(x,z,4))dealDamage(m,hitDmg(.2,id),{root:2});log('Ice Barrier: 40% less damage taken for 10 seconds.','sys')}
  else if(id==='kettingblik'){swingAnim(true);sfx('frost');const n=5+TM('kettingblik.targets');const hit=new Set();let prev=null,cur=tg;
    for(let k=0;k<n&&cur;k++){hit.add(cur);const m=cur,mult=1.8*Math.pow(.85,k);const from=prev?new THREE.Vector3(prev.x,prev.y+1.2,prev.z):myHand();
      setTimeout(()=>{if(m.dead)return;proj('arcane',from,m,70,()=>{dealDamage(m,hitDmg(mult,id));flash(m.x,m.y+1.2,m.z,0xc8e0ff,1.8,.15);sparks(m.x,m.y+1.2,m.z,0xc8e0ff,8,5,.3,.3)});fxEmit({k:'p',t:'arcane',f:from.toArray(),m:m.id})},k*140);
      prev=m;cur=MONS.filter(o=>!o.dead&&!hit.has(o)&&Math.hypot(o.x-m.x,o.z-m.z)<10).sort((p,q)=>Math.hypot(p.x-m.x,p.z-m.z)-Math.hypot(q.x-m.x,q.z-m.z))[0]}}
  else if(id==='rifscheur'){swingAnim(true);sfx('frost');const tx=tg.x,tz=tg.z;runeCircle(tx,tz,2.6,VOIDP,1);decal(tx,tz,{cell:FXC.thinring,size:14,size1:4,col:VOIDC,life:.9,a:.9});fxEmit({k:'r',x:tx,z:tz,r:7,c:VOIDP});
    for(let i=0;i<24;i++){const a=FRN(0,6.28),r=FRN(3,7),ty=groundH(tx,tz);emitP({x:tx+Math.cos(a)*r,y:ty+FRN(.2,2),z:tz+Math.sin(a)*r,vx:-Math.cos(a)*r*1.1,vz:-Math.sin(a)*r*1.1,life:.8,size:.5,size1:.15,col:i%2?VOIDC:VOIDP,a:1,a1:0,cell:FXC.wisp})}
    setTimeout(()=>{const ty=groundH(tx,tz);boom(tx,ty+1.4,tz,5,.7);shockwave(tx,tz,7,VOIDP,.5);flash(tx,ty+1.4,tz,VOIDC,4,.3);sfx('boom');
      if(!tg.dead&&Math.hypot(tg.x-tx,tg.z-tz)<8)dealDamage(tg,hitDmg(4.2,id));for(const m of enemiesNear(tx,tz,7))if(m!==tg)dealDamage(m,hitDmg(2.2,id))},900)}
  /* ---- paladin ---- */
  else if(id==='wijding'){sfx('quest');runeCircle(x,z,3.2,HOLY,8.5);decal(x,z,{cell:FXC.thinring,size:14,size1:14,col:HOLY,life:8,a:.7});fxEmit({k:'r',x,z,r:7,c:HOLY});
    ticker(8,1,()=>{const gy=groundH(x,z);for(let i=0;i<10;i++){const a=FRN(0,6.28),r=FRN(.5,6.5);emitP({x:x+Math.cos(a)*r,y:gy+.15,z:z+Math.sin(a)*r,vy:FRN(1,2.5),life:FRN(.6,1),size:.35,size1:.08,col:i%2?HOLY:HOLY2,a:1,a1:0,cell:FXC.glint})}
      for(const m of enemiesNear(x,z,7))dealDamage(m,hitDmg(.45,id))})}
  else if(id==='handoplegging'){swingAnim(true);sfx('lvl');holyHeal(tg||healTarget(),6,true)}
  else if(id==='hemelhamer'){sfx('quest');const cx=tg.x,cz=tg.z;runeCircle(cx,cz,3,HOLY,4.5);fxEmit({k:'r',x:cx,z:cz,r:7,c:HOLY});
    ticker(8,.5,()=>{const bx=(tg.dead?cx:tg.x)+FRN(-2.5,2.5),bz=(tg.dead?cz:tg.z)+FRN(-2.5,2.5),by=groundH(bx,bz);const from=new THREE.Vector3(bx+FRN(-2,2),by+22,bz+FRN(-2,2));
      proj('holy',from,[bx,by,bz],44,()=>{projImpact('holy',bx,by+.6,bz);flash(bx,by+1,bz,HOLY,2.6,.22);shockwave(bx,bz,4,HOLY,.35);sfx('hit');for(const m of enemiesNear(bx,bz,4))dealDamage(m,hitDmg(.9,id))});fxEmit({k:'p',t:'holy',f:from.toArray(),x:bx,z:bz})})}
  /* ---- hunter ---- */
  else if(id==='ijsval'){sfx('swing');decal(x,z,{cell:FXC.thinring,size:3,size1:3,col:0xbfeaff,life:1.1,a:.9});runeCircle(x,z,1,0xbfeaff,1.1);
    setTimeout(()=>{sfx('frost');novaFx(x,z);fxEmit({k:'r',x,z,r:7,c:0x9ae0ff});for(const m of enemiesNear(x,z,7))dealDamage(m,hitDmg(.8,id),{root:5+TM('ijsval.root')})},1000)}
  else if(id==='snelvuur'){for(let k=0;k<8;k++)setTimeout(()=>{if(tg.dead||ME.dead)return;faceTo(tg.x,tg.z);swingAnim(true);sfx('bow');const f=myHand();proj('arrow',f,tg,64,()=>dealDamage(tg,hitDmg(.55,id)));fxEmit({k:'p',t:'arrow',f:f.toArray(),m:tg.id})},k*200)}
  else if(id==='riftsalvo'){swingAnim(true);sfx('bow');const tx=tg.x,tz=tg.z;runeCircle(tx,tz,2.8,VOIDC,3);
    for(let w=0;w<3;w++)setTimeout(()=>{if(ME.dead)return;rainFx(tx,tz);fxEmit({k:'r',x:tx,z:tz,r:7,c:VOIDC});for(let k=0;k<12;k++){const ax=tx+rand(-6,6),az=tz+rand(-6,6);proj('arcane',new THREE.Vector3(ax-2,groundH(ax,az)+18,az-2),[ax,groundH(ax,az),az],42+rand(0,10),null)}
      setTimeout(()=>{shockwave(tx,tz,7,VOIDC,.4);for(const m of enemiesNear(tx,tz,7))dealDamage(m,hitDmg(1.7,id))},450)},w*1000)}
  else return false;return true}
