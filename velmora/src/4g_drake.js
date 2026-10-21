/* ===================== Drakenrijk: spelregels, Vyraxion en legendarische buit ===================== */

/* ---------- legendarische (oranje) uitrusting ----------
   Elk stuk heeft een vaste naam, hoge waarden en een eigen bonus (mods, dezelfde sleutels als talenten; zie 1b_talents.js).
   NIEUW LEGENDARISCH ITEM: voeg een regel toe aan LEGENDS[klasse]; s=slot, wt=wapentype, c=kleur, mods=bonussen, leg=tekst. */
const LEGENDS={
  krijger:[
    {s:'wapen',wt:'bijl',n:'Ash Queen\'s Bane, Slayer of Dragons',c:0x7a1a10,mods:{critdmg:.25,'slag.dmg':.2,wdmg:.05},leg:'Legendary: critical hits deal 25% extra damage, Heroic Strike +20% and +5% weapon damage.'},
    {s:'borst',n:'Scale Harness of Vyraxion',c:0x8e1c12,mods:{dr:.06,hpp:.08},leg:'Legendary: you take 6% less damage and have 8% more health.'},
    {s:'hoofd',n:'Horned Helm of the Ash Queen',c:0x5a1a10,mods:{crit:5,rage:3},leg:'Legendary: +5% critical chance and your attacks grant 3 extra energy.'},
    {s:'handen',n:'Claws of the Dragon Brood',c:0x6a2a14,mods:{haste:.08,'werv.dmg':.2},leg:'Legendary: +8% attack speed and Whirlwind deals 20% more damage.'}],
  magier:[
    {s:'wapen',wt:'staf',n:'Vyraxion\'s Flameheart',c:0xc0441e,mods:{'vuur.dmg':.25,'meteoor.dmg':.2,crit:4},leg:'Legendary: Firebolt +25%, Meteor +20% damage and +4% critical chance.'},
    {s:'borst',n:'Robe of Glowing Scales',c:0x8e2a12,mods:{mpp:.15,mregen:.25,hpp:.05},leg:'Legendary: 15% more mana, 25% faster mana regeneration and 5% more health.'},
    {s:'hoofd',n:'Crown of Smouldering Ash',c:0x3a1a14,mods:{cdall:.1,critdmg:.15},leg:'Legendary: all cooldowns 10% shorter and critical hits +15% damage.'},
    {s:'handen',n:'Sparkgrips',c:0xd85a1a,mods:{costall:.1,'vuur.cast':.25},leg:'Legendary: abilities cost 10% less and Firebolt is 0.25 s faster.'}],
  paladijn:[
    {s:'wapen',wt:'bijl',n:'Dawnbreaker, Hammer of the Ash Queen\'s Bane',c:0xffd870,mods:{'kruis.dmg':.25,'goddelijkestorm.dmg':.2,wdmg:.05},leg:'Legendary: Crusader Strike +25%, Divine Storm +20% damage and +5% weapon damage.'},
    {s:'borst',n:'Dragonforged Aegis of Light',c:0xf4ead0,mods:{dr:.05,hpp:.08,heal:.05},leg:'Legendary: you take 5% less damage, have 8% more health and heal 5% more.'},
    {s:'hoofd',n:'Crown of the Dawn',c:0xfff0c0,mods:{heal:.10,mpp:.08},leg:'Legendary: your heals restore 10% more and you have 8% more mana.'},
    {s:'handen',n:'Gauntlets of the Sun King',c:0xe8c060,mods:{'oordeel.dmg':.25,haste:.06},leg:'Legendary: Judgement +25% damage and +6% attack speed.'}],
  jager:[
    {s:'wapen',wt:'boog',n:'Dragonstring, Bow of the Ash Queen',c:0x6a1a10,mods:{'schot.dmg':.25,haste:.08,crit:3},leg:'Legendary: Aimed Shot +25% damage, +8% attack speed and +3% critical chance.'},
    {s:'borst',n:'Coat of Dragonhide',c:0x7a3018,mods:{dodge:.06,speed:.06,hpp:.05},leg:'Legendary: 6% chance to dodge attacks, 6% faster movement and 5% more health.'},
    {s:'hoofd',n:'Hood of the Dragon\'s Eye',c:0x4a1a10,mods:{crit:6,exec:.15},leg:'Legendary: +6% critical chance and 15% more damage against enemies below 35% health.'},
    {s:'handen',n:'Gloves of the Falconer',c:0x8a4a1a,mods:{'multi.dmg':.25,'regen.dmg':.2},leg:'Legendary: Multi-Shot +25% and Arrow Rain +20% damage.'}]};
function makeLegendary(cls,slot){const L=LEGENDS[cls]||LEGENDS.krijger;const d=slot?(L.find(x=>x.s===slot)||L[0]):(Math.random()<.4?L[0]:pick(L.slice(1)));
  const it=makeGear(d.s,24,4,cls);it.n=d.n;it.mods={...d.mods};it.leg=d.leg;it.vis={c:d.c};if(d.s==='wapen'){it.wt=d.wt;it.spd=CLASSES[cls].spd}
  it.pow=Math.round((it.pow||0)*1.2+8);it.sta=Math.round((it.sta||0)*1.2+8);it.req=19;it.price=Math.round(it.price*2);return it}

/* ---------- reizen ---------- */
function enterDrake(){teleport(DRK_ENTRY.x,DRK_ENTRY.z);ME.ry=Math.PI/2;cam.yaw=-Math.PI/2;log('Hot wind and the smell of sulphur: you enter the Dragon Realm…','sys');if(P.level<13)log('Beware: the Dragon Realm is meant for heroes of level 13 or higher.','err')}
function leaveDrake(){teleport(DRK_GATE.x-9,DRK_GATE.z);ME.ry=-Math.PI/2;cam.yaw=Math.PI/2}
function enterVolcano(){teleport(D3.entry.x,D3.entry.z);ME.ry=Math.PI;cam.yaw=0;log('The heat is suffocating. Deep in the volcano, Vyraxion the Ash Queen slumbers…','sys');if(P.level<18)log('Beware: the Heart of the Volcano is meant for heroes of level 18 or higher.','err')}
function leaveVolcano(){teleport(VOLC_DOOR.x-7,VOLC_DOOR.z);ME.ry=-Math.PI/2;cam.yaw=Math.PI/2}
/* automatisch door een poort lopen (aangeroepen vanuit de lus) */
function drakePortals(){const x=ME.pos.x,z=ME.pos.z;if(hollowPortals(x,z))return true;
  if(inDrk(x)&&Math.hypot(x-DRK_ARCH.elvia.x,z-DRK_ARCH.elvia.z)<2.4){enterElvia();return true}if(inElv(x)&&Math.hypot(x-ELV_EXIT.x,z-ELV_EXIT.z)<2.4){leaveElvia();return true}
  if(x<700&&x>-1000&&Math.hypot(x-DRK_GATE.x,z-DRK_GATE.z)<2.4){enterDrake();return true}
  if(inDrk(x)){if(Math.hypot(x-DRK_EXIT.x,z-DRK_EXIT.z)<2.4){leaveDrake();return true}if(Math.hypot(x-VOLC_DOOR.x,z-VOLC_DOOR.z)<2.2){enterVolcano();return true}}
  if(x>1700&&Math.hypot(x-D3.exit.x,z-(D3.exit.z+1.4))<2){leaveVolcano();return true}
  return false}
/* met F (of Actie) */
function drakeInteract(){const x=ME.pos.x,z=ME.pos.z;if(hollowInteract(x,z))return true;
  {const w=nearWaystone();if(w){useWaystone(w);return true}}if(inDrk(x)&&Math.hypot(x-DRK_ARCH.elvia.x,z-DRK_ARCH.elvia.z)<7){enterElvia();return true}if(inElv(x)&&Math.hypot(x-ELV_EXIT.x,z-ELV_EXIT.z)<7){leaveElvia();return true}
  if(x<700&&x>-1000&&Math.hypot(x-DRK_GATE.x,z-DRK_GATE.z)<7){enterDrake();return true}
  if(inDrk(x)){if(Math.hypot(x-DRK_EXIT.x,z-DRK_EXIT.z)<7){leaveDrake();return true}if(Math.hypot(x-VOLC_DOOR.x,z-VOLC_DOOR.z)<7){enterVolcano();return true}}
  if(x>1700&&Math.hypot(x-D3.exit.x,z-D3.exit.z)<6){leaveVolcano();return true}
  return false}
function drakeRespawn(){const x=ME.pos.x;if(x>1700&&x<2200){teleport(D3.entry.x,D3.entry.z);return true}if(inDrk(x)){teleport(DRK_CAMP.x-4+rand(-2,2),DRK_CAMP.z-8+rand(-2,2));return true}return false}

/* ---------- lava ---------- */
const DPOOLS=[];/* lavaplassen van Vyraxion: {x,z,r,t,m} */
function onLava(x,z){if(inDrk(x))return drkLava(x,z);if(x>1700&&x<2200){if(D3.cell(x,z)==='~')return true;for(const p of DPOOLS)if(Math.hypot(x-p.x,z-p.z)<p.r*.9)return true}return false}
function drakeLava(dt){if(ME.dead||ME.air||!P)return;const x=ME.pos.x,z=ME.pos.z;if(!(inDrk(x)||x>1700))return;if(!onLava(x,z)){ME.dlavaT=0;return}
  ME.dlavaT=(ME.dlavaT||0)-dt;if(ME.dlavaT<=0){ME.dlavaT=.5;const d=Math.round(ST.maxhp*.05);P.hp-=d;ME.combat=6;floatText('me','-'+d+' lava','hurt');sparks(x,ME.pos.y+.3,z,0xff7a20,6,3,.3,.4);if(P.hp<=0){P.hp=0;die()}}}
function lavaPool(x,z,r,life){const m=new THREE.Mesh(new THREE.CircleGeometry(r,26).rotateX(-Math.PI/2),LAVA_MAT);m.position.set(x,groundH(x,z)+.08,z);m.scale.setScalar(.05);scene.add(m);DPOOLS.push({x,z,r,t:life,m})}
function updPools(dt){for(let i=DPOOLS.length-1;i>=0;i--){const p=DPOOLS[i];p.t-=dt;const s=p.t<1?Math.max(.01,p.t):Math.min(1,p.m.scale.x+dt*3);p.m.scale.setScalar(s);if(Math.random()<dt*4)emitP({x:p.x+FRN(-p.r,p.r)*.6,y:p.m.position.y+.2,z:p.z+FRN(-p.r,p.r)*.6,vy:FRN(1,3),life:.6,size:.5,size1:.1,col:0xffa030,a:1,a1:0,cell:FXC.glint});if(p.t<=0){scene.remove(p.m);p.m.geometry.dispose();DPOOLS.splice(i,1)}}}
function clearPools(){for(const p of DPOOLS){scene.remove(p.m);p.m.geometry.dispose()}DPOOLS.length=0}

/* ---------- telegrafen en drakenvuur (lokaal én via het netwerk) ---------- */
function fireTele(x,z,r,dur){const y=groundH(x,z);const m=new THREE.Mesh(fxGeo.disc,new THREE.MeshBasicMaterial({color:0xff5a10,transparent:true,opacity:.2,depthWrite:false}));const rr=new THREE.Mesh(fxGeo.ring,addMat(0xff8a30));m.position.set(x,y+.12,z);rr.position.copy(m.position);rr.scale.setScalar(r);scene.add(m,rr);
  FX.push({m,t:0,dur,up:f=>{m.scale.setScalar(r*f);m.material.opacity=.15+f*.35;if(f>=1)scene.remove(rr)},end:()=>{scene.remove(rr);boom(x,y+1.2,z,r*1.2,.7);for(let i=0;i<14;i++)emitP({x:x+FRN(-r,r)*.6,y:y+.4,z:z+FRN(-r,r)*.6,vy:FRN(3,8),life:FRN(.4,.7),size:1.4,size1:.4,col:0xffd060,col1:0xff3010,a:1,a1:0,cell:FXC.fire,must:1});shockwave(x,z,r,0xff7a30,.45);sfx('boom')}})}
function coneFx(x,z,ry,len,half,dur){const g=new THREE.CircleGeometry(len,28,ry-Math.PI/2-half,half*2).rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xff4a10,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,groundH(x,z)+.14,z);scene.add(m);
  FX.push({m,t:0,dur,up:f=>{m.material.opacity=.12+f*.4*(.7+.3*Math.sin(f*40))},end:()=>{g.dispose()}})}
function breathFx(x,y,z,ry,len,dur=1.1){const o=new THREE.Object3D();scene.add(o);const dx=Math.sin(ry),dz=Math.cos(ry);sfx('fire');
  FX.push({m:o,t:0,dur,up:(f,dt)=>{for(let i=0;i<7;i++){const sp=FRN(-.45,.45),sp2=FRN(14,24);const vx=(dx*Math.cos(sp)-dz*Math.sin(sp))*sp2,vz=(dz*Math.cos(sp)+dx*Math.sin(sp))*sp2;
    emitP({x:x+dx*2.4,y:y,z:z+dz*2.4,vx,vy:FRN(-3,.5),vz,drag:.9,life:FRN(.5,.75)*len/16,size:1.6,size1:4.6,col:0xffe080,col1:0xff2a08,a:1,a1:0,cell:FXC.fire,vrot:FRN(-3,3),must:i<3})}
    if(Math.random()<.4)emitP({x:x+dx*(4+Math.random()*len),y:groundH(x,z)+.5,z:z+dz*(4+Math.random()*len),vy:2,life:1.2,size:2,size1:5,col:0x2a201a,a:.35,a1:0,cell:FXC.smoke2,add:false})}})}

/* ---------- Vyraxion de Asvorst ----------
   Fase 1 (100–66%): beten, staartzwiep naar wie achter haar staat en om de ~12 s vuuradem in een kegel (rood vlak: ga opzij!).
   Fase 2 (bij 66% en 33%): ze stijgt op, cirkelt door de hal en laat vuurballen regenen (oranje cirkels) en roept haar broed.
       Na de vlucht landt ze met een schokgolf.
   Fase 3 (onder 33%): lava-plassen onder je voeten, snellere adem; onder 15% razernij met vuurpulsen door de hele hal.
   Zwaar maar solo te doen op niveau 20 met goede uitrusting en drankjes. */
const VYR_LINES={hi:'Who dares approach my hoard? Your ashes will warm my nest!',fly:'Burn, puny creatures! Burn beneath my wings!',sum:'My brood, devour them!',land:'You\'re still not charred?!',lava:'The mountain itself stands at my side!',enr:'ENOUGH! THE WHOLE REALM WILL BURN!',bolt:'fire',add:'broedling',tele:'Burn!'};
function dSay(k,m){const t=VYR_LINES[k];netEmit('bossmsg',{t,b:'vyraxion'});bossSay(t,'vyraxion')}
function dFx(o){fxEmit(o)}
function inCone(px,pz,m,len,half){const dx=px-m.x,dz=pz-m.z,d=Math.hypot(dx,dz);if(d>len||d<.01)return d<2.5;const a=Math.atan2(dx,dz);return Math.abs(angDiff(a,m.ry))<half}
function dragonAI(m,dt,pl){const t=m.t,H=D3_HALL;const D=m.dr||(m.dr={breath:9,tail:5,fly:0,fb:0,lava:8,inferno:6,flights:0,busy:0,ang:0,sum:0});
  const alive=pl.filter(p=>!p.dead&&p.x>1700&&Math.hypot(p.x-m.x,p.z-m.z)<80);if(!alive.length)return false;
  const f=m.hp/m.mhp,base=monDmg(t,m.lvl)*(t.dmgM||1);const tp=alive.find(p=>p.id===m.tgt)||alive[0];
  /* opstijgen bij 66% en 33% */
  if(!D.fly&&D.busy<=0&&((D.flights===0&&f<.66)||(D.flights===1&&f<.33))){D.flights++;D.fly=D.flights===1?16:13;D.fb=1.2;D.ang=Math.atan2(m.z-H.z,m.x-H.x);dSay('fly');
    const n=D.flights+1;for(let i=0;i<n;i++){const a=rand(0,6.28);const id='a'+(addN++)+'_'+Math.floor(Math.random()*1e4);const x=H.x+Math.cos(a)*10,z=H.z+Math.sin(a)*6;const ad=makeMon({id,type:'broedling',lvl:19,x,z});const pp=pick(alive);ad.tgt=pp.id;ad.threat[pp.id]=5;burst(x,1,z,0xff7a30,30,4)}
    setTimeout(()=>{if(!m.dead)dSay('sum',m)},1800)}
  if(D.fly>0){D.fly-=dt;m.flyH=lerp(m.flyH||0,9,clamp(dt*1.5,0,1));D.ang+=dt*.38;const tx=H.x+Math.cos(D.ang)*22,tz=H.z+Math.sin(D.ang)*11;const dx=tx-m.x,dz=tz-m.z,L=Math.hypot(dx,dz);
    if(L>.05){const st=Math.min(L,10*dt);m.x+=dx/L*st;m.z+=dz/L*st;m.ry=Math.atan2(dx,dz)}m.nx=m.x;m.nz=m.z;m.nry=m.ry;m.mv=1.2;
    D.fb-=dt;if(D.fb<=0){D.fb=D.flights===1?2.3:1.9;const spots=alive.map(p=>[p.x+rand(-1.5,1.5),p.z+rand(-1.5,1.5)]);spots.push([H.x+rand(-18,18),H.z+rand(-9,9)]);
      for(const[x,z]of spots){fireTele(x,z,3.6,1.6);dFx({k:'ft',x,z,r:3.6,d:1.6});PENDING.push({t:1.6,fn:()=>{for(const p of players())if(!p.dead&&Math.hypot(p.x-x,p.z-z)<3.6)hitPlayer(p.id,base*2.6,m)}})}
      const from=new THREE.Vector3(m.x,m.y+3,m.z);const tgtE=tp.me?'me':REMOTES.get(tp.id);if(tgtE)proj('fire',from,tgtE,24,null)}
    if(D.fly<=0){D.fly=0;D.busy=1.7;const x=m.x,z=m.z;fireTele(x,z,9,1.5);dFx({k:'ft',x,z,r:9,d:1.5});PENDING.push({t:1.5,fn:()=>{if(m.dead)return;dustRing(x,z,8,20,0x5a3020);for(const p of players())if(!p.dead&&Math.hypot(p.x-x,p.z-z)<9)hitPlayer(p.id,base*2.6,m)}});setTimeout(()=>{if(!m.dead)dSay('land',m)},1600)}
    return true}
  m.flyH=lerp(m.flyH||0,0,clamp(dt*2.2,0,1));if(m.flyH<.05)m.flyH=0;
  if(D.busy>0){D.busy-=dt;m.mv=0;return true}
  /* vuuradem */
  D.breath-=dt;if(D.breath<=0&&Math.hypot(tp.x-m.x,tp.z-m.z)<20){D.breath=f<.15?7:f<.33?9.5:12.5;D.busy=2.9;m.ry=m.nry=Math.atan2(tp.x-m.x,tp.z-m.z);const x=m.x,z=m.z,ry=m.ry,len=17,half=.52;
    coneFx(x,z,ry,len,half,1.7);dFx({k:'cone',x,z,ry,l:len,h:half,d:1.7});
    PENDING.push({t:1.7,fn:()=>{if(m.dead)return;m.ac=(m.ac+1)%100;m.atk=0;breathFx(x,(m.y||0)+3.2,z,ry,len);dFx({k:'br',x,y:(m.y||0)+3.2,z,ry,l:len});for(const p of players())if(!p.dead&&inCone(p.x,p.z,{x,z,ry},len,half))hitPlayer(p.id,base*4.5,m)}});return true}
  /* staartzwiep: wie achter haar staat */
  D.tail-=dt;if(D.tail<=0){const behind=alive.filter(p=>{const d=Math.hypot(p.x-m.x,p.z-m.z);if(d>10)return false;const a=Math.atan2(p.x-m.x,p.z-m.z);return Math.abs(angDiff(a,m.ry))>2.1});
    if(behind.length){D.tail=6;m.ac=(m.ac+1)%100;m.atk=0;const bx=m.x-Math.sin(m.ry)*5,bz=m.z-Math.cos(m.ry)*5;dustRing(bx,bz,5,14,0x6a4030);dFx({k:'r',x:bx,z:bz,r:5,c:0xff8040});for(const p of behind)hitPlayer(p.id,base*2.2,m)}else D.tail=1}
  /* fase 3: lava onder je voeten */
  if(f<.33){D.lava-=dt;if(D.lava<=0){D.lava=f<.15?7.5:10;if(!D.lsay){D.lsay=1;dSay('lava',m)}for(const p of alive){const x=p.x,z=p.z;fireTele(x,z,3.4,1.4);dFx({k:'ft',x,z,r:3.4,d:1.4});PENDING.push({t:1.4,fn:()=>{if(m.dead)return;lavaPool(x,z,3.4,14);dFx({k:'lp',x,z,r:3.4,t:14})}})}}}
  /* razernij onder 15% */
  if(f<.15){if(!m.bt.enr){m.bt.enr=1;dSay('enr',m)}D.inferno-=dt;if(D.inferno<=0){D.inferno=8;shockwave(m.x,m.z,30,0xff5a10,.8);dFx({k:'r',x:m.x,z:m.z,r:12,c:0xff6020});for(const p of alive)hitPlayer(p.id,base*1.0,m)}m.atkT=Math.min(m.atkT,1.6)}
  return false}
function dragonReset(m){m.dr=null;m.flyH=0;clearPools()}

/* ---------- netwerk-effecten van de draak ---------- */
function drakeFxNet(d){if(d.k==='ft'){fireTele(+d.x,+d.z,clamp(+d.r,1,12),clamp(+d.d,.2,4));return true}
  if(d.k==='cone'){coneFx(+d.x,+d.z,+d.ry,clamp(+d.l,2,30),clamp(+d.h,.1,1.5),clamp(+d.d,.2,4));return true}
  if(d.k==='br'){breathFx(+d.x,+d.y,+d.z,+d.ry,clamp(+d.l,2,30));return true}
  if(d.k==='lp'){lavaPool(+d.x,+d.z,clamp(+d.r,1,8),clamp(+d.t,1,30));return true}
  return false}

/* ---------- sfeer: as, vonken, rook uit de krater en legendarische gloed ---------- */
let drkAmbT=0;
function drakeAmbient(dt){updPools(dt);updDrakeWorld(dt);drkAmbT+=dt;if(drkAmbT<.1)return;const st=drkAmbT;drkAmbT=0;const c=camTarget;const q=GFX.q==='laag'?.35:GFX.q==='middel'?.7:1;
  if(inDrk(c.x)){
    for(let i=0;i<Math.round(6*q);i++){const x=c.x+FRN(-30,30),z=c.z+FRN(-30,30);emitP({x,y:c.y+FRN(8,16),z,vx:FRN(-.6,.6)+.8,vy:-FRN(.8,1.6),vz:FRN(-.6,.6),life:FRN(4,6),size:FRN(.12,.25),size1:.1,col:0x9a9088,a:.8,a1:0,cell:FXC.soft,add:false})}
    if(Math.random()<.6*q){const x=c.x+FRN(-25,25),z=c.z+FRN(-25,25);emitP({x,y:groundH(x,z)+.3,z,vx:FRN(-.4,.4),vy:FRN(1.5,3.5),vz:FRN(-.4,.4),life:FRN(1.5,2.5),size:.18,size1:.05,col:0xffa040,a:1,a1:0,cell:FXC.glint})}
    const dv=Math.hypot(c.x-VOLC.x,c.z-VOLC.z);if(dv<260){const rimH=VOLC.h*Math.pow(1-VOLC.cr/VOLC.r,1.25)+2;for(let i=0;i<Math.round(2*q)+1;i++)emitP({x:VOLC.x+FRN(-6,6),y:rimH-2,z:VOLC.z+FRN(-6,6),vx:FRN(-.5,.5)+1.2,vy:FRN(4,7),vz:FRN(-.5,.5),drag:.15,life:FRN(6,9),size:FRN(6,10),size1:FRN(18,28),col:0x3a302c,col1:0x6a605a,a:.55,a1:0,cell:FXC.smoke2,add:false,must:1});
      if(Math.random()<.5)emitP({x:VOLC.x+FRN(-5,5),y:rimH-4,z:VOLC.z+FRN(-5,5),vy:FRN(6,12),vx:FRN(-2,2),vz:FRN(-2,2),grav:6,life:FRN(1.2,2),size:.6,size1:.2,col:0xffb040,a:1,a1:0,cell:FXC.glint,must:1})}}
  else if(c.x>1700&&c.x<2200&&Math.random()<.7*q){const x=c.x+FRN(-20,20),z=c.z+FRN(-20,20);emitP({x,y:.3,z,vy:FRN(1,3),life:FRN(1.5,2.5),size:.16,size1:.05,col:0xffa040,a:1,a1:0,cell:FXC.glint})}
  /* legendarisch wapen: vonken bij de hand */
  if(P&&P.eq&&P.eq.wapen&&P.eq.wapen.r>=4&&!ME.dead){const h=myHand();emitP({x:h.x+FRN(-.15,.15),y:h.y+FRN(-.1,.4),z:h.z+FRN(-.15,.15),vy:FRN(.4,1.2),life:FRN(.4,.7),size:.22,size1:.05,col:0xffa030,col1:0xff4010,a:1,a1:0,cell:FXC.glint})}
  for(const r of REMOTES.values())if(r.rig&&r.wr>=4&&Math.abs(r.x-c.x)<40&&Math.abs(r.z-c.z)<40)emitP({x:r.x+Math.sin(r.ry)*.5,y:r.y+1.4,z:r.z+Math.cos(r.ry)*.5,vy:FRN(.4,1.2),life:.5,size:.2,size1:.05,col:0xffa030,a:1,a1:0,cell:FXC.glint})}
