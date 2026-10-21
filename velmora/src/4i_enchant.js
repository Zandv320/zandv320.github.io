/* ===================== Enchanting =====================
   A crafting profession of its own in the crafting book (K). You learn it from Enchantress Ysolde in the Artisans' Yard;
   Archmage Sabine keeps a second altar in WindStorm.
   - Disenchant gear from your bag into Arcane Dust, Glimmering Essence and Radiant Shards (bag → item → Disenchant).
   - At an enchanting altar you enchant the weapon and armour you are wearing. One enchantment per item: a new one
     replaces the old. Every weapon enchantment has its own aura on the weapon (a glowing shell plus particles):
     fire, frost, lightning, venom, holy light and shadow, brighter with every rank. Other players see it too. */
const ENCH_TYPES={
  flame: {n:'Flametongue',col:0xff6a1a,col2:0xffd060,mod:'wdmg',v:.04,txt:r=>'+'+Math.round(.04*r*100)+'% weapon damage',cat:['Bloodroot','Fireblossom'],lv:0},
  frost: {n:'Frostbite',  col:0x6ad0ff,col2:0xe8f8ff,mod:'dr',v:.025,txt:r=>Math.round(.025*r*1000)/10+'% less damage taken',cat:['Moonbloom','Moonbloom'],lv:4},
  holy:  {n:'Dawnlight',  col:0xffd860,col2:0xfffbe0,mod:'hpp',v:.04,txt:r=>'+'+Math.round(.04*r*100)+'% health',cat:['Sunleaf','Sunleaf'],lv:8},
  venom: {n:'Venomfang',  col:0x5aff2a,col2:0xd8ff6a,mod:'exec',v:.06,txt:r=>'+'+Math.round(.06*r*100)+'% damage to enemies below 35% health',cat:['Spider Silk','Bloodroot'],lv:12},
  storm: {n:'Stormcaller',col:0x8aa8ff,col2:0xffffff,mod:'haste',v:.04,txt:r=>'+'+Math.round(.04*r*100)+'% attack speed',cat:['Silver Bar','Silver Bar'],lv:16},
  shadow:{n:'Nightshade', col:0xa04aff,col2:0x5a1aa8,mod:'crit',v:2,txt:r=>'+'+2*r+'% critical chance',cat:['Moonbloom','Bloodroot'],lv:20}};
const ENCH_ARM={
  borst:{n:'Vitality',mod:'hpp',v:.03,txt:r=>'+'+Math.round(.03*r*100)+'% health',lv:2},
  hoofd:{n:'Insight',mod:'crit',v:1.5,txt:r=>'+'+(1.5*r)+'% critical chance',lv:6},
  handen:{n:'Swiftness',mod:'haste',v:.025,txt:r=>'+'+(2.5*r)+'% attack speed',lv:10},
  benen:{n:'Warding',mod:'dr',v:.02,txt:r=>'+'+(2*r)+'% less damage taken',lv:14},
  voeten:{n:'Fleetfoot',mod:'speed',v:.03,txt:r=>'+'+(3*r)+'% movement speed',lv:18},
  ring:{n:'Might',mod:'wdmg',v:.02,txt:r=>'+'+(2*r)+'% weapon damage',lv:22}};
const ENCH_RANK=['','Lesser','Greater','Radiant'],ROMAN=['','I','II','III'];
/* every enchantment by id: 'flame2', 'arm_borst3' … */
const ENCH={};
for(const t in ENCH_TYPES)for(let r=1;r<=3;r++){const T=ENCH_TYPES[t];ENCH[t+r]={id:t+r,type:t,rank:r,slot:'wapen',n:T.n+' '+ROMAN[r],mods:{[T.mod]:T.v*r},txt:T.txt(r),col:T.col}}
for(const s in ENCH_ARM)for(let r=1;r<=3;r++){const A=ENCH_ARM[s];ENCH['arm_'+s+r]={id:'arm_'+s+r,rank:r,slot:s,n:A.n+' '+ROMAN[r],mods:{[A.mod]:A.v*r},txt:A.txt(r)}}
/* materials */
Object.assign(MATS,{
  'Arcane Dust':{m:'Q_Crystal5',t:'#c8b4ff',price:2,tag:'arcane'},
  'Glimmering Essence':{m:'KS_bottle',t:'#7ad8ff',price:9,r:1},
  'Radiant Shard':{m:'Q_Crystal5',t:'#ffd06a',price:26,r:3}});
LIFE.enchanting={n:'Enchanting',ic:'m:Q_Crystal5|#c8a0ff',kind:'craft',st:'altar',d:'Disenchant gear into arcane materials (bag → item → Disenchant), then enchant the weapon and armour you wear. Weapon enchantments make your weapon glow.'};
/* recipes: refining, then one recipe per enchantment and rank */
RECIPES.push({id:'essence',sk:'enchanting',st:'altar',out:'Glimmering Essence',q:1,in:[['Arcane Dust',5]],lv:14,t:2.2},
  {id:'shard',sk:'enchanting',st:'altar',out:'Radiant Shard',q:1,in:[['Glimmering Essence',4],['Moonpetal',1]],lv:36,t:2.8});
for(const t in ENCH_TYPES){const T=ENCH_TYPES[t];
  RECIPES.push({id:'en_'+t+1,sk:'enchanting',st:'altar',ench:t+1,out:'Enchant Weapon: '+T.n+' I',q:1,in:[['Arcane Dust',4],[T.cat[0],2]],lv:T.lv,t:3});
  RECIPES.push({id:'en_'+t+2,sk:'enchanting',st:'altar',ench:t+2,out:'Enchant Weapon: '+T.n+' II',q:1,in:[['Arcane Dust',6],['Glimmering Essence',2],[T.cat[1],3]],lv:T.lv+20,t:3.4});
  RECIPES.push({id:'en_'+t+3,sk:'enchanting',st:'altar',ench:t+3,out:'Enchant Weapon: '+T.n+' III',q:1,in:[['Glimmering Essence',4],['Radiant Shard',2],['Moonpetal',2]],lv:T.lv+40,t:3.8})}
for(const s in ENCH_ARM){const A=ENCH_ARM[s];const sl=SLOT_NL[s];
  RECIPES.push({id:'ea_'+s+1,sk:'enchanting',st:'altar',ench:'arm_'+s+1,out:'Enchant '+sl+': '+A.n+' I',q:1,in:[['Arcane Dust',3],['Herb Powder',1]],lv:A.lv,t:2.6});
  RECIPES.push({id:'ea_'+s+2,sk:'enchanting',st:'altar',ench:'arm_'+s+2,out:'Enchant '+sl+': '+A.n+' II',q:1,in:[['Arcane Dust',5],['Glimmering Essence',1]],lv:A.lv+20,t:3});
  RECIPES.push({id:'ea_'+s+3,sk:'enchanting',st:'altar',ench:'arm_'+s+3,out:'Enchant '+sl+': '+A.n+' III',q:1,in:[['Glimmering Essence',3],['Radiant Shard',1]],lv:A.lv+40,t:3.4})}
ST_HINT.altar='an enchanting altar (Artisans\' Yard or WindStorm)';
/* can this recipe be applied? (called from canCraft) */
function enchCheck(rc){const E=ENCH[rc.ench];const it=P.eq[E.slot];if(!it)return'Equip '+(E.slot==='wapen'?'a weapon':'a '+SLOT_NL[E.slot].toLowerCase()+' item')+' first';if(it.ench===E.id)return'Already enchanted with '+E.n;return''}
function applyEnchant(rc){const E=ENCH[rc.ench];const it=P.eq[E.slot];if(!it)return false;const old=it.ench&&ENCH[it.ench];it.ench=E.id;TMC=null;
  const f=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*f);rebuildMe();refreshChar&&!$('#pChar').hidden&&refreshChar();
  log('✦ '+esc(it.n)+' is now enchanted with <b>'+esc(E.n)+'</b>'+(old?' (replaces '+esc(old.n)+')':'')+'.','loot',true);
  if(E.type){banner(E.n,'Your weapon glows with power');const c=ENCH_TYPES[E.type].col;runeCircle(ME.pos.x,ME.pos.z,1.6,c,1.4);flash(ME.pos.x,ME.pos.y+1.4,ME.pos.z,c,3);for(let i=0;i<24;i++)emitP({x:ME.pos.x+FRN(-1,1),y:ME.pos.y+FRN(.4,2.4),z:ME.pos.z+FRN(-1,1),vy:FRN(1,3),life:1,size:.5,size1:.1,col:c,a:1,a1:0,cell:FXC.crit,must:1})}
  else runeCircle(ME.pos.x,ME.pos.z,1.2,0xc8a0ff,1);
  sfx('quest');questEvent('craft','ench',1);lifeXp('enchanting',35+E.rank*30+(rc.lv>=20?15:0));saveGame();return true}
/* ---- disenchanting: gear → arcane materials ---- */
function disenchantYield(it){const lv=it.il||1,r=it.r|0;if(r>=3)return[['Radiant Shard',r>=4?3:1+(lv>=18?1:0)],['Glimmering Essence',1]];if(r===2)return[['Glimmering Essence',1+(lv>=15?1:0)],['Arcane Dust',2]];return[['Arcane Dust',1+Math.floor(lv/6)+(r?1:0)]]}
function disenchant(i){const it=P.inv[i];if(!it||it.kind!=='gear')return;if(ME.dead)return;const Y=disenchantYield(it);P.inv[i]=null;
  for(const[n,q]of Y)if(!giveMat(n,q)){P.inv[i]=it;return}
  log('You disenchant ['+esc(it.n)+'] into '+Y.map(([n,q])=>q+'× '+n).join(', ')+'.','loot');const c=it.r>=3?0xffd06a:it.r===2?0x7ad8ff:0xc8b4ff;
  flash(ME.pos.x,ME.pos.y+1.2,ME.pos.z,c,2);for(let k=0;k<14;k++)emitP({x:ME.pos.x+FRN(-.5,.5),y:ME.pos.y+1.2,z:ME.pos.z+FRN(-.5,.5),vx:FRN(-2,2),vy:FRN(1,3),vz:FRN(-2,2),life:.8,size:.4,size1:.05,col:c,a:1,a1:0,cell:FXC.star,must:1});
  sfx('frost');lifeXp('enchanting',8+(it.r|0)*6);questEvent('dis','any',1);refreshBag();saveGame()}
/* ===================== the glow ===================== */
/* a shell around every part of the weapon, pushed out along the normals, bright at the rim (fresnel) and pulsing */
const ENCH_U={time:{value:0}};
function enchShellMat(col,push,int){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{time:ENCH_U.time,col:{value:new THREE.Color(col)},push:{value:push},gain:{value:int}},
  vertexShader:'uniform float time,push;varying vec3 vN,vV;varying float vY;void main(){float w=1.+.35*sin(time*4.+position.y*30.+position.x*17.);vec3 p=position+normal*push*w;vec4 mv=modelViewMatrix*vec4(p,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);vY=position.y;gl_Position=projectionMatrix*mv;}',
  fragmentShader:'uniform float time,gain;uniform vec3 col;varying vec3 vN,vV;varying float vY;void main(){float f=pow(1.-abs(dot(vN,vV)),1.6);float fl=.75+.25*sin(time*6.+vY*40.);gl_FragColor=vec4(col*(.18+f*1.5)*gain*fl,1.);}'})}
const _ev=new THREE.Vector3(),_ev2=new THREE.Vector3();
/* the glow of one hand: main hand (r.weapon, look.ench) or a weapon in the off hand (r.oweapon, look.ench2) */
function enchGlow(r,off){if(!r)return null;const key=off?'_eg2':'_eg';const id=r.o&&(off?r.o.ench2:r.o.ench),w=off?r.oweapon:r.weapon;const G=r[key];
  if(!w||!id||!ENCH[id]||!ENCH[id].type){if(G){for(const g of G.shells)g.parent&&g.parent.remove(g);r[key]=null}return null}
  if(G&&G.w===w&&G.id===id)return G;if(G)for(const g of G.shells)g.parent&&g.parent.remove(g);
  const E=ENCH[id],T=ENCH_TYPES[E.type];const shells=[],pts=[];w.updateMatrixWorld(true);
  w.traverse(m=>{if(!m.isMesh||m.userData.eglow||!m.geometry||!m.geometry.attributes.position)return;if(!m.geometry.attributes.normal)m.geometry.computeVertexNormals();m.getWorldScale(_ev);const ws=Math.max(1e-4,(_ev.x+_ev.y+_ev.z)/3);
    const g=new THREE.Mesh(m.geometry,enchShellMat(T.col,(.02+E.rank*.014)/ws,.6+E.rank*.32));g.userData.eglow=1;g.renderOrder=3;g.castShadow=false;g.receiveShadow=false;m.add(g);shells.push(g);
    const pa=m.geometry.attributes.position;for(let k=0;k<14;k++){const i=Math.floor(Math.random()*pa.count);pts.push([m,pa.getX(i),pa.getY(i),pa.getZ(i)])}});
  return r[key]={w,id,shells,pts,E,T,acc:0}}
/* particles that belong to each element */
function enchSpark(type,x,y,z,rank,T){const k=(.7+rank*.3)*1.45;
  if(type==='flame'){emitP({x,y,z,vx:FRN(-.3,.3),vy:FRN(1.2,2.6),vz:FRN(-.3,.3),life:FRN(.35,.6),size:.32*k,size1:.06,col:0xffd060,col1:0xff3a0a,a:1,a1:0,cell:FXC.fire,vrot:FRN(-3,3)});if(Math.random()<.2)emitP({x,y:y+.2,z,vy:1.4,life:.9,size:.25,size1:.6,col:0x3a2a20,a:.25,a1:0,cell:FXC.smoke2,add:false})}
  else if(type==='frost'){emitP({x,y,z,vx:FRN(-.4,.4),vy:FRN(-.6,.2),vz:FRN(-.4,.4),life:FRN(.6,1),size:.22*k,size1:.04,col:0xe8f8ff,col1:0x6ad0ff,a:1,a1:0,cell:FXC.star,vrot:FRN(-2,2)});if(Math.random()<.3)emitP({x,y,z,vy:-.3,life:.8,size:.3,size1:.7,col:0xbfe8ff,a:.25,a1:0,cell:FXC.soft})}
  else if(type==='storm'){emitP({x:x+FRN(-.08,.08),y:y+FRN(-.08,.08),z:z+FRN(-.08,.08),vx:FRN(-2.5,2.5),vy:FRN(-2.5,2.5),vz:FRN(-2.5,2.5),drag:6,life:FRN(.08,.18),size:.4*k,size1:.1,col:0xffffff,col1:T.col,a:1,a1:0,cell:FXC.zap,rot:Math.random()*6.3})}
  else if(type==='venom'){emitP({x,y,z,vx:FRN(-.15,.15),vy:FRN(-.2,.1),vz:FRN(-.15,.15),grav:5,life:FRN(.5,.8),size:.16*k,size1:.1,col:0xb8ff6a,col1:0x2a8a0a,a:1,a1:.2,cell:FXC.soft});if(Math.random()<.25)emitP({x,y,z,vy:.5,life:.9,size:.25,size1:.6,col:0x6aff3a,a:.3,a1:0,cell:FXC.smoke2})}
  else if(type==='holy'){emitP({x,y,z,vx:FRN(-.2,.2),vy:FRN(.4,1),vz:FRN(-.2,.2),life:FRN(.7,1.2),size:.26*k,size1:.04,col:0xfffbe0,col1:0xffc840,a:1,a1:0,cell:FXC.glint,vrot:FRN(-1,1)})}
  else if(type==='shadow'){emitP({x,y,z,vx:FRN(-.25,.25),vy:FRN(.2,.8),vz:FRN(-.25,.25),life:FRN(.6,1),size:.25,size1:.7*k,col:0x2a0a3a,a:.55,a1:0,cell:FXC.smoke2,add:false,vrot:FRN(-1,1)});if(Math.random()<.5)emitP({x,y,z,vy:FRN(.2,.6),life:.6,size:.18*k,size1:.03,col:0xc87aff,a:1,a1:0,cell:FXC.crit})}}
/* per frame for one rig (yourself or another player) */
function enchFx(r,dt){enchFxHand(r,dt,false);enchFxHand(r,dt,true)}
function enchFxHand(r,dt,off){const G=enchGlow(r,off);if(!G)return;G.w.getWorldPosition(_ev2);if(Math.abs(_ev2.x-camTarget.x)+Math.abs(_ev2.z-camTarget.z)>45)return;
  const rate=(GFX.q==='laag'?10:GFX.q==='middel'?20:30)*(.6+G.E.rank*.4);G.acc+=dt*rate;let n=Math.floor(G.acc);G.acc-=n;n=Math.min(n,6);
  for(let i=0;i<n;i++){const[m,x,y,z]=G.pts[Math.floor(Math.random()*G.pts.length)];_ev.set(x,y,z);m.localToWorld(_ev);enchSpark(G.E.type,_ev.x,_ev.y,_ev.z,G.E.rank,G.T)}}
function updEnchant(dt,t){ENCH_U.time.value=t}
/* small round icon for an enchantment recipe */
function enchIcon(id){const E=ENCH[id];const c=E.type?'#'+new THREE.Color(ENCH_TYPES[E.type].col).getHexString():'#c8a0ff';return['m:Q_Crystal5|'+c,E.rank>=3?'#6a5a2a':E.rank===2?'#2a4a6a':'#3a2a5a','#0e0a14']}
