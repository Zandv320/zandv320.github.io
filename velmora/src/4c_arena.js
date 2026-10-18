/* ===================== Arena: spelregels =====================
   - Wie de arena betreedt krijgt automatisch de PvP-vlag; bij het verlaten gaat die weer uit als hij uit stond.
   - In het midden staat een kist met de AK-47. Openen (F) geeft het wapen; de kist blijft dicht zolang iemand de AK heeft
     en gaat weer open zodra de drager sterft of de arena verlaat (dan wordt de AK ingenomen), of na 2 minuten.
   - De AK-47 is voor elke klasse, schiet 8 kogels per seconde en doet zware schade, maar werkt alleen in de arena. */
const ARENA_ST={open:true,closedT:0,lid:0,inside:false,prevPvp:null,holder:null};
const AK_RANGE=32,AK_RESPAWN=120;
function inArena(x,z){return Math.hypot(x-ARENA.x,z-ARENA.z)<ARENA.r+6}
function hasAK(){return !!(P&&((P.eq.wapen&&P.eq.wapen.wt==='ak')||P.inv.some(i=>i&&i.wt==='ak')))}
function makeAK(){return{id:uid(),kind:'gear',s:'wapen',r:3,il:15,req:1,cls:'alle',n:'AK-47',wt:'ak',min:48,max:70,spd:.125,pow:0,sta:0,arm:0,price:0,arena:1,vis:{c:0x1d1d1d},desc:'A weapon from another world. Only usable in the arena.'}}
function removeAK(reason){if(!P)return false;let had=false;if(P.eq.wapen&&P.eq.wapen.wt==='ak'){delete P.eq.wapen;had=true}for(let i=0;i<P.inv.length;i++)if(P.inv[i]&&P.inv[i].wt==='ak'){P.inv[i]=null;had=true}
  if(had){calcStats();rebuildMe();refreshBag();refreshChar();if(reason)log(reason,'sys');netEmit('arena',{k:'drop'});arenaSetOpen(true)}return had}
function arenaSetOpen(open){ARENA_ST.open=open;ARENA_ST.closedT=open?0:AK_RESPAWN;if(open)ARENA_ST.holder=null}
/* interactie met de kist (aangeroepen vanuit interact()) */
function arenaInteract(){if(!P||ME.dead)return false;if(Math.hypot(ME.pos.x-ARENA.x,ME.pos.z-ARENA.z)>3.8)return false;
  if(!ARENA_ST.open){toast('The chest is empty. Someone already has the AK-47…');return true}
  if(hasAK()){toast('You already have the AK-47');return true}
  const ak=makeAK();const slot=P.inv.indexOf(null);if(slot<0){toast('Your bag is full');return true}
  /* direct in de hand: het oude wapen gaat naar de rugzak */const old=P.eq.wapen||null;P.eq.wapen=ak;if(old)P.inv[slot]=old;
  calcStats();rebuildMe();refreshBag();refreshChar();sfx('loot');burst(ARENA.x,ARENA_H+1.2,ARENA.z,0xffd060,30,5);beamFx(ARENA.x,ARENA.z,0xffd060,1.6,1.5);
  log('⚔ You grabbed the AK-47! Everyone in the arena is now a target.','err');ARENA_ST.holder=myId();arenaSetOpen(false);
  netEmit('arena',{k:'open',n:P.name});return true}
/* per frame */
function updArena(dt){if(!P||S.mode!=='play')return;
  const inside=inArena(ME.pos.x,ME.pos.z)&&ME.pos.x<700;
  if(inside&&!ARENA_ST.inside){ARENA_ST.inside=true;ARENA_ST.prevPvp=!!P.pvp;if(!P.pvp){P.pvp=true;refreshPvpUi();lastPres='';log('⚔ You enter the Arena: PvP is now on automatically.','err')}else log('You enter the Arena. Fight!','sys');sfx('swing')}
  else if(!inside&&ARENA_ST.inside){ARENA_ST.inside=false;
    if(ARENA_ST.prevPvp===false&&P.pvp){if(ME.combat>0){ARENA_ST.pendingOff=true}else{P.pvp=false;refreshPvpUi();lastPres='';log('You leave the Arena. PvP is off again.','sys')}}}
  if(ARENA_ST.pendingOff&&ME.combat<=0&&!ARENA_ST.inside){ARENA_ST.pendingOff=false;if(P.pvp&&ARENA_ST.prevPvp===false){P.pvp=false;refreshPvpUi();lastPres='';log('PvP is off again.','sys')}}
  if(ME.dead&&hasAK())removeAK('Your AK-47 stays behind in the arena.');
  if(!inside&&hasAK())removeAK('The arena guards confiscate the AK-47: that weapon stays in the arena.');
  /* kist: dicht zolang iemand de AK heeft; andere spelers met een AK in hun look sluiten hem ook */
  if(ARENA_ST.open){for(const r of REMOTES.values()){if(r.rig&&r.rig.wt==='ak'){ARENA_ST.holder=r.id;arenaSetOpen(false);break}}}
  else{ARENA_ST.closedT-=dt;const h=ARENA_ST.holder&&ARENA_ST.holder!==myId()?REMOTES.get(ARENA_ST.holder):null;if(ARENA_ST.holder&&ARENA_ST.holder!==myId()&&(!h||(h.rig&&h.rig.wt&&h.rig.wt!=='ak'&&h.rig.ready)))ARENA_ST.closedT=Math.min(ARENA_ST.closedT,3);if(ARENA_ST.closedT<=0)arenaSetOpen(true)}
  /* deksel en gloed */
  const tgt=ARENA_ST.open?0:-1.9;ARENA_ST.lid=lerp(ARENA_ST.lid,tgt,clamp(dt*4,0,1));arenaChest.lid.rotation.x=ARENA_ST.lid;
  const near=Math.hypot(ME.pos.x-ARENA.x,ME.pos.z-ARENA.z)<10;arenaChest.glow.material.opacity=ARENA_ST.open?.25+Math.sin(S.t*3)*.1:0;arenaChest.glow.rotation.y+=dt;
  if(near&&ARENA_ST.open&&Math.floor(S.t)!==Math.floor(S.t-dt)&&Math.hypot(ME.pos.x-ARENA.x,ME.pos.z-ARENA.z)<3.5)toast('Press F to open the chest')}
/* netwerk: iemand anders opent of verliest de kist */
function arenaNet(peer,d){if(!d)return;if(d.k==='open'){ARENA_ST.holder=peer;arenaSetOpen(false);log(esc(String(d.n||'Someone').slice(0,14))+' grabbed the AK-47 from the arena chest!','err',true);if(ARENA_ST.inside)sfx('hit')}
  else if(d.k==='drop'){if(ARENA_ST.holder===peer||!ARENA_ST.holder)arenaSetOpen(true)}}
/* schieten met de AK (aangeroepen vanuit de auto-aanval) */
function akShoot(tg){swingAnim(true);sfx('bow');const from=myHand();from.y+=.1;muzzleFx(from,Math.sin(ME.ry),Math.cos(ME.ry));proj('kogel',from,tg,95,()=>dealDamage(tg,hitDmg(1)));fxEmit({k:'p',t:'kogel',f:from.toArray(),m:tg.kind==='mon'?tg.id:undefined,p:tg.kind==='pl'?tg.id:undefined});
  burst(from.x,from.y,from.z,0xffe080,3,1.5,.12,.1)}
