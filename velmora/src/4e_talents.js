/* ===================== Talenten: punten, bonussen en de nieuwe vaardigheden ===================== */
let TMC=null;/* cache van alle mod-sommen */
function talentTrees(){return P?TALENTS[P.cls]||[]:[]}
function talentRank(id){return (P&&P.talents&&P.talents[id])|0}
function talentPoints(){return P?Math.max(0,P.level-1):0}
function treeSpent(tr){return tr.nodes.reduce((s,n)=>s+talentRank(n.id),0)}
function talentSpent(){return talentTrees().reduce((s,t)=>s+treeSpent(t),0)}
function talentFree(){return talentPoints()-talentSpent()}
function talentNode(id){for(const t of talentTrees())for(const n of t.nodes)if(n.id===id)return{tree:t,node:n};return null}
function TM(k){if(!TMC){TMC={};for(const t of talentTrees())for(const n of t.nodes){const r=talentRank(n.id);if(!r||!n.mod)continue;for(const key in n.mod)TMC[key]=(TMC[key]||0)+n.mod[key]*r}}return TMC[k]||0}
function canLearn(id){const f=talentNode(id);if(!f)return false;const r=talentRank(id);if(r>=f.node.max)return false;if(talentFree()<=0)return false;return treeSpent(f.tree)>=TIER_REQ[f.node.t]}
function learnTalent(id){if(!canLearn(id))return false;P.talents=P.talents||{};P.talents[id]=talentRank(id)+1;TMC=null;const f=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*f);buildBar(true);
  const fnd=talentNode(id);if(fnd.node.skill)log('Nieuwe vaardigheid geleerd: '+fnd.node.skill.n,'sys');sfx('loot');healFx&&emitP({x:ME.pos.x,y:ME.pos.y+1.6,z:ME.pos.z,life:.6,size:.4,size1:1.6,col:0xffe08a,a:1,a1:0,cell:FXC.crit,must:1});saveGame(true);return true}
function respecCost(){return Math.max(5,Math.round(P.level*P.level*.6))}
function respecTalents(){const c=respecCost();if(P.gold<c)return toast('Je hebt '+c+' goud nodig');if(!talentSpent())return toast('Je hebt nog geen talenten gekozen');P.gold-=c;P.talents={};TMC=null;calcStats();P.hp=Math.min(P.hp,ST.maxhp);buildBar(true);log('Je talenten zijn opnieuw beschikbaar (−'+c+' goud).','sys');sfx('quest');saveGame(true);return true}
/* vaardigheden die je via talenten hebt geleerd */
function talentSkills(){const out=[];for(const t of talentTrees())for(const n of t.nodes)if(n.skill&&talentRank(n.id))out.push({lvl:1,...n.skill,talent:1});return out}
/* afgeleide waarden voor vaardigheden */
function abCost(a){return Math.max(0,Math.round((a.cost||0)*(1-TM('costall'))-TM(a.id+'.cost')))}
function abCd(a){return Math.max(0,(a.cd||0)*(1-TM('cdall'))-TM(a.id+'.cd'))}
function abCast(a){return a.cast?Math.max(.3,a.cast-TM(a.id+'.cast')):0}
/* tijdelijke buffs uit vaardigheden: {key:{v,until}} */
function tbuff(k){const b=ME.tb&&ME.tb[k];if(!b)return 0;if(performance.now()>b.until){delete ME.tb[k];return 0}return b.v}
function addTbuff(k,v,sec){ME.tb=ME.tb||{};ME.tb[k]={v,until:performance.now()+sec*1000}}
/* herhaalde effecten (sneeuwstorm, gif, valk) */
function ticker(n,iv,fn){let i=0;const h=setInterval(()=>{if(!P||S.mode!=='play'||i>=n){clearInterval(h);return}fn(i++)},iv*1000);return h}
/* ---------- de nieuwe vaardigheden ---------- */
function execTalentSkill(a,tg){const id=a.id,x=ME.pos.x,y=ME.pos.y,z=ME.pos.z;
  if(id==='doodsslag'){swingAnim(false);sfx('swing');setTimeout(()=>{if(!tg.dead){dealDamage(tg,hitDmg(2.5,id));sfx('hit');emitP({x:tg.x,y:tg.y+1.2,z:tg.z,life:.35,size:2.6,size1:4,col:0xff4a2a,a:1,a1:0,cell:FXC.crit,vrot:3,must:1})}},150)}
  else if(id==='klievstorm'){ME.spin=4;sfx('swing');ticker(8,.5,()=>{if(ME.dead)return;whirlFx(ME.pos.x,ME.pos.y,ME.pos.z);fxEmit({k:'r',x:ME.pos.x,z:ME.pos.z,r:6,c:0xdde6ff});for(const m of enemiesNear(ME.pos.x,ME.pos.z,6))dealDamage(m,hitDmg(.7,id));sfx('swing')})}
  else if(id==='razsprong'){const dx=tg.x-x,dz=tg.z-z,L=Math.hypot(dx,dz)||1;const tx=tg.x-dx/L*1.4,tz=tg.z-dz/L*1.4;ME.dash={x:tx,z:tz,t:.6,t0:0,sx:x,sz:z,leap:1,land:()=>{dustRing(ME.pos.x,ME.pos.z,5,16);shockwave(ME.pos.x,ME.pos.z,5,0xffb070,.5);sfx('boom');fxEmit({k:'r',x:ME.pos.x,z:ME.pos.z,r:5,c:0xffb070});for(const m of enemiesNear(ME.pos.x,ME.pos.z,5))dealDamage(m,hitDmg(1.2,id))}};ME.vy=9;ME.air=true;sfx('swing')}
  else if(id==='roekeloos'){addTbuff('crit',30,10);addTbuff('haste',.2,10);shoutFx(x,y,z);sfx('quest');emitP({x,y:y+1,z,life:.6,size:1,size1:5,col:0xff3a2a,a:.8,a1:0,cell:FXC.halo,must:1});log('Roekeloosheid! 10 seconden +30% kritieke kans.','sys')}
  else if(id==='schildslag'){swingAnim(false);sfx('hit');setTimeout(()=>{if(!tg.dead){dealDamage(tg,hitDmg(1.4,id),{stun:2});emitP({x:tg.x,y:tg.y+1.6,z:tg.z,life:2,size:1,size1:1,col:0xffe08a,a:1,a1:0,cell:FXC.twirl2,vrot:6,must:1})}},120)}
  else if(id==='onbreekbaar'){addTbuff('dr',.5,8);runeCircle(x,z,1.4,0x7ae0ff,8);emitP({x,y:y+1,z,life:.7,size:1,size1:4.4,col:0x7ae0ff,a:.9,a1:0,cell:FXC.halo,must:1});sfx('frost');log('Onbreekbaar: 8 seconden 50% minder schade.','sys')}
  else if(id==='vlammenzee'){swingAnim(true);sfx('fire');const tx=tg.x,tz=tg.z;runeCircle(tx,tz,2.2,0xff6a20,.8);setTimeout(()=>{const ty=groundH(tx,tz);projImpact('fire',tx,ty+.8,tz);boom(tx,ty+1.6,tz,5,.7);shockwave(tx,tz,6,0xff7a30,.5);for(let i=0;i<20;i++)emitP({x:tx+FRN(-2,2),y:ty+.3,z:tz+FRN(-2,2),vy:FRN(4,9),life:FRN(.4,.7),size:1.6,size1:.4,col:0xffd060,col1:0xff3010,a:1,a1:0,cell:FXC.fire});sfx('boom');fxEmit({k:'r',x:tx,z:tz,r:6,c:0xff7a30});for(const m of enemiesNear(tx,tz,6))dealDamage(m,hitDmg(1.8,id))},250)}
  else if(id==='drakenadem'){sfx('fire');swingAnim(true);const fx=Math.sin(ME.ry),fz=Math.cos(ME.ry);for(let i=0;i<40;i++){const d=FRN(.5,10),sp=FRN(-.55,.55)*d*.6;const px=x+fx*d+fz*sp,pz=z+fz*d-fx*sp;emitP({x:x+fx*.8,y:y+1.3,z:z+fz*.8,vx:(px-x)*1.6,vy:FRN(-.5,1.5),vz:(pz-z)*1.6,drag:1.4,life:FRN(.5,.8),size:1.2,size1:3,col:0xffe080,col1:0xff2a08,a:1,a1:0,cell:FXC.fire,vrot:FRN(-3,3)})}
    fxEmit({k:'r',x:x+fx*5,z:z+fz*5,r:5,c:0xff5a1a});for(const m of enemiesNear(x,z,10)){const ax=m.x-x,az=m.z-z,L=Math.hypot(ax,az)||1;if((ax*fx+az*fz)/L>.6)dealDamage(m,hitDmg(2.2,id))}}
  else if(id==='ijslans'){swingAnim(true);sfx('frost');proj('frost',myHand(),tg,40,()=>{const frozen=tg.root>0||tg.stun>0;dealDamage(tg,hitDmg(1.4*(frozen?2:1),id));if(frozen)sparks(tg.x,tg.y+1,tg.z,0xc8f0ff,16,6,.5,.6)});fxEmit({k:'p',t:'frost',f:myHand().toArray(),m:tg.id})}
  else if(id==='sneeuwstorm'){sfx('frost');const tx=tg.x,tz=tg.z;runeCircle(tx,tz,3,0x9ae0ff,8.5);ticker(8,1,()=>{const ty=groundH(tx,tz);for(let i=0;i<24;i++)emitP({x:tx+FRN(-6,6),y:ty+FRN(6,9),z:tz+FRN(-6,6),vx:FRN(-1,1),vy:-FRN(7,11),vz:FRN(-1,1),life:FRN(.7,1),size:FRN(.4,.8),size1:.3,col:0xe8faff,a:1,a1:.4,cell:FXC.star,vrot:FRN(-4,4)});
    for(let i=0;i<4;i++)emitP({x:tx+FRN(-5,5),y:ty+.6,z:tz+FRN(-5,5),vx:FRN(-2,2),vz:FRN(-2,2),drag:1,life:1.4,size:2,size1:4,col:0xd8f2ff,a:.35,a1:0,cell:FXC.smoke2,add:false});fxEmit({k:'r',x:tx,z:tz,r:7,c:0xb0e8ff});for(const m of enemiesNear(tx,tz,7))dealDamage(m,hitDmg(.6,id),{root:1.2})})}
  else if(id==='arcraket'){sfx('frost');for(let k=0;k<5;k++)setTimeout(()=>{if(tg.dead||ME.dead)return;swingAnim(true);const f=myHand();f.x+=FRN(-.3,.3);f.y+=FRN(-.2,.3);proj('arcane',f,tg,30,()=>dealDamage(tg,hitDmg(.55,id)));fxEmit({k:'p',t:'arcane',f:f.toArray(),m:tg.id})},k*190)}
  else if(id==='arckracht'){addTbuff('dmg',.35,12);twirlFx(x,y+1,z,0xff9aff);runeCircle(x,z,1.6,0xd9a8ff,12);sfx('lvl');log('Arcane Kracht: 12 seconden 35% meer schade.','sys')}
  else if(id==='dodelijk'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,70,()=>{dealDamage(tg,hitDmg(3.2,id));flash(tg.x,tg.y+1,tg.z,0xffd060,2.2)});fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
  else if(id==='genadeschot'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,70,()=>{dealDamage(tg,hitDmg(4,id));emitP({x:tg.x,y:tg.y+1.3,z:tg.z,life:.6,size:2,size1:4,col:0xffe0a0,a:1,a1:0,cell:FXC.crit,vrot:2,must:1})});fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
  else if(id==='explosief'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,50,()=>{const tx=tg.x,tz=tg.z;projImpact('fire',tx,tg.y+1,tz);boom(tx,tg.y+1.2,tz,3.4,.6);sfx('boom');dealDamage(tg,hitDmg(1.8,id));for(const m of enemiesNear(tx,tz,5))if(m!==tg)dealDamage(m,hitDmg(.9,id))});fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
  else if(id==='gifpijl'){swingAnim(true);sfx('bow');proj('arrow',myHand(),tg,50,()=>{ticker(12,1,()=>{if(tg.dead)return;dealDamage(tg,hitDmg(.25,id));for(let i=0;i<4;i++)emitP({x:tg.x+FRN(-.4,.4),y:tg.y+FRN(.6,1.6),z:tg.z+FRN(-.4,.4),vy:FRN(.6,1.4),life:.7,size:.5,size1:.15,col:0x9aff5a,col1:0x2a8a0a,a:1,a1:0,cell:FXC.soft})})});fxEmit({k:'p',t:'arrow',f:myHand().toArray(),m:tg.id})}
  else if(id==='wortels'){sfx('frost');runeCircle(x,z,3,0x7ad05a,1.2);decal(x,z,{cell:FXC.thinring,size:16,size1:16,col:0x7ad05a,life:1,a:.8});fxEmit({k:'r',x,z,r:8,c:0x7ad05a});
    for(const m of enemiesNear(x,z,8)){dealDamage(m,hitDmg(.6,id),{root:5});for(let i=0;i<10;i++)emitP({x:m.x+FRN(-.6,.6),y:m.y+FRN(0,.4),z:m.z+FRN(-.6,.6),vy:FRN(1.5,3),drag:2,life:FRN(.6,1),size:.7,size1:.3,col:0x8ae05a,col1:0x2a6a0a,a:1,a1:0,cell:FXC.wisp,vrot:FRN(-2,2)})}}
  else if(id==='valk'){sfx('bow');log('Je valk stort zich op je doelwit!','sys');ticker(8,1,()=>{if(tg.dead||ME.dead)return;const from=new THREE.Vector3(tg.x+FRN(-4,4),tg.y+14,tg.z+FRN(-4,4));proj('holy',from,tg,38,()=>{dealDamage(tg,hitDmg(.6,id));for(let i=0;i<5;i++)emitP({x:tg.x,y:tg.y+1.4,z:tg.z,vx:FRN(-2,2),vy:FRN(0,2),vz:FRN(-2,2),grav:3,drag:1,life:FRN(.6,1),size:.35,size1:.25,col:0xe8d0a0,a:1,a1:0,cell:FXC.trace,vrot:FRN(-5,5),add:false})});fxEmit({k:'p',t:'holy',f:from.toArray(),m:tg.id})})}
  else return false;return true}
