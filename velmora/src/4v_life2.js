/* ===================== Life skills, part two: the Voidmaster rank, Carpentry, Jewelcrafting, the Nether =====================
   - A new rank above Grandmaster for every profession: Voidmaster (skill 70–79), with tier VII gear (Abyssal,
     Shadowscale, Shadowweave), new gathering in the far Rift (Abyssal Ore, Ghostwood, Nethercap) and raid hides.
   - Carpentry (Carpenter's Bench, Artisans' Yard): furniture for your house, cheaper than Orla's and some you can only
     make yourself.
   - Jewelcrafting (Jeweler's Bench, Artisans' Yard): rough gems come from mining; cut them, set them in rings, or
     socket them into any piece of gear you wear (bag → gem → Socket into…). One gem per item.
   - Void fishing at the rim of the Rift's islands, new meals and flasks.
   - Nether enchantments: four new weapon enchantments with their own aura and a fourth rank (Nether) for every
     enchantment, from Nether Dust, Void Essence and Rift Shards (disenchant gear from the Rift and beyond).
   All models are from packs already in the game (Kenney, KayKit, Quaternius, the Rift crystals). */
RANKS.push('Voidmaster');
LIFE.carpentry={n:'Carpentry',ic:'m:KT_saw',kind:'craft',st:'bench',d:'Build furniture for your house at the Carpenter\'s Bench. Some pieces can only be made, never bought.'};
LIFE.jewelcrafting={n:'Jewelcrafting',ic:'m:Q_Crystal5|#ff5a7a',kind:'craft',st:'jeweler',d:'Cut the rough gems you find while mining, set them in rings, and socket them into your gear.'};
ST_HINT.bench='the Carpenter\'s Bench (Artisans\' Yard)';ST_HINT.jeweler='the Jeweler\'s Bench (Artisans\' Yard)';
STATIONS.push({k:'bench',x:CRAFT.x-6,z:CRAFT.z+10,n:'Carpenter\'s Bench',r:4},{k:'jeweler',x:CRAFT.x+7,z:CRAFT.z+12,n:'Jeweler\'s Bench',r:4});
CRAFT_ANIM.carpentry=CRAFT_ANIM.carpentry||CRAFT_ANIM.smithing||'grind';CRAFT_ANIM.jewelcrafting=CRAFT_ANIM.jewelcrafting||'grind';
/* ---- materials ---- */
const GEMS={Garnet:{c:'#d8304a',lv:0,ore:'Iron Ore',mods:{hpp:.03},txt:'+3% health'},Topaz:{c:'#ffc040',lv:10,ore:'Silver Ore',mods:{crit:1.5},txt:'+1.5% critical chance'},
  Ruby:{c:'#ff3a2a',lv:22,ore:'Emberstone',mods:{wdmg:.03},txt:'+3% damage'},Emerald:{c:'#3ad87a',lv:34,ore:'Mithril Ore',mods:{haste:.03},txt:'+3% attack speed'},
  Amethyst:{c:'#b06aff',lv:46,ore:'Riftstone Ore',mods:{dr:.03},txt:'3% less damage taken'},Voidstone:{c:'#ff4ab8',lv:58,ore:'Voidcrystal',mods:{critdmg:.1},txt:'+10% critical damage'},
  Starheart:{c:'#aef4ff',lv:72,ore:'Abyssal Ore',mods:{wdmg:.04,hpp:.04},txt:'+4% damage and +4% health'}};
for(const g in GEMS){const G=GEMS[g];const r=Math.min(4,1+Math.floor(G.lv/18));MATS['Rough '+g]={m:'Q_Mineral',t:G.c,price:4+G.lv,r:Math.max(0,r-1)};MATS[g]={m:'Q_Crystal5',t:G.c,price:12+G.lv*3,r,gem:G}}
Object.assign(MATS,{
  'Abyssal Ore':{m:'Q_Mineral',t:'#5ad8c8',price:30,r:4,tag:'ore'},'Abyssal Bar':{m:'Q_Gold_Ingots',t:'=#6ae8d8',price:130,r:4},
  'Ghostwood':{m:'KS_resource-wood',t:'#c8e8f0',price:28,r:4,tag:'wood'},'Nethercap':{m:'KN_flower_redB',t:'#5affd8',price:30,tag:'herb',r:4},
  'Abyssal Hide':{m:'Q_Bag',t:'#1a3a3a',price:28,r:4},'Shadowscale Leather':{m:'Q_Bags',t:'#2a5a5a',price:128,r:4},
  'Shadowsilk Thread':{m:'KT_rope_bundle_A',t:'#8ad8d0',price:28,r:4},'Shadowweave Cloth':{m:'Q_Bag',t:'#6ac8c0',price:128,r:4},
  'Voidfin':{m:'KS_fish',t:'#8a6ad8',price:18,tag:'fish',r:2},'Starscale Eel':{m:'KS_fish',t:'#aef4ff',price:24,tag:'fish',r:3},'Glimmer Ray':{m:'KS_fish',t:'#ff8ad8',price:32,tag:'fish',r:3},
  'Riftlurker':{m:'KS_fish',t:'#3a2a6a',price:60,tag:'fish',r:4},'Abyssal Leviathan Fry':{m:'KS_fish',t:'#5affd8',price:180,tag:'fish',r:4},
  'Voidfin Fillet':{m:'KF_fish',t:'#a88ae8',price:70,r:3,food:{hp:.2,pow:.14,dur:1800,d:'+20% health and +14% power'}},
  'Starscale Sushi':{m:'KF_fish',t:'#aef4ff',price:100,r:4,food:{hp:.22,pow:.2,dur:2400,d:'+22% health and +20% power'}},
  'Abyssal Banquet':{m:'KF_pot-stew',t:'#5ad8c8',price:150,r:4,food:{hp:.27,pow:.23,dur:3600,d:'+27% health and +23% power'}},
  'Elixir of the Deep':{m:'KS_bottle-large',t:'#ff8ad8',price:110,r:4,elixir:{dmg:.22,arm:.36,dur:2400,d:'+22% damage and +36% armour'}},
  'Flask of the Abyss':{m:'KS_bottle-large',t:'#5affd8',price:160,r:4,elixir:{dmg:.26,arm:.38,dur:3600,d:'+26% damage and +38% armour for an hour'}},
  'Nether Dust':{m:'Q_Crystal5',t:'#9a6aff',price:8,r:2},'Void Essence':{m:'KS_bottle',t:'#c06aff',price:40,r:3},'Rift Shard':{m:'Q_Crystal5',t:'#ff5ab8',price:110,r:4}});
/* ---- gathering in the far Rift ---- */
NODE_REQ['Abyssal Ore']=64;NODE_REQ['Ghostwood']=64;NODE_REQ['Nethercap']=64;Object.assign(NODE_COL,{'Abyssal Ore':0x5ad8c8,'Ghostwood':0xc8e8f0,'Nethercap':0x5affd8});
{const r=mulberry(7373);const okR=(x,z)=>{const s=riftIsle(x,z);return!!s&&s.d<s.R-4&&!riftBridge(x,z)&&Math.hypot(x-RW.x,z-RW.z)>55&&Math.hypot(x-SANCTUM_GATE.x,z-SANCTUM_GATE.z)>18&&Math.hypot(x-CITADEL_GATE.x,z-CITADEL_GATE.z)>20&&!NODES.some(n=>Math.abs(n.x-x)<5&&Math.abs(n.z-z)<5)};
  const add=(type,item,count,ids)=>{for(const id of ids){const I=RISLE[id];for(let i=0,t=0;i<count&&t<600;t++){const a=r()*6.28,d=Math.sqrt(r())*I.r,x=I.x+Math.cos(a)*d,z=I.z+Math.sin(a)*d;if(!okR(x,z))continue;lifeNode(type,item,x,z);i++}}};
  add('erts','Abyssal Ore',3,['t1','r2']);add('hout','Ghostwood',4,['g2']);add('hout','Ghostwood',2,['t1']);add('kruid','Nethercap',3,['g2','t1']);add('kruid','Nethercap',2,['r2']);
  for(const I of RIFT_ISLES)if(I.islet&&r()<.45)lifeNode('erts','Abyssal Ore',I.x+(r()-.5)*I.r*.5,I.z+(r()-.5)*I.r*.5)}
/* the same simple stand-in as 4b_life gives every node, until buildCraftEnv puts the models in */
function lifeNode(type,item,x,z){const n={id:'n'+NODES.length,type,item,x,z};NODES.push(n);const g=new THREE.Group();const y=groundH(x,z);g.position.set(x,y,z);g.rotation.y=hash(x|0,z|0)*6;scene.add(g);n.g=g;n.y=y;n.kind='node';n.rig={h:.8};
  n.name=type==='kruid'?item:type==='erts'?item.replace(/ Ore$/,'')+' Vein':item+' Trunk';
  if(type==='hout'){const l=mesh(new THREE.CylinderGeometry(.42,.5,4.2,12),mat(0xc8d8e0,{flat:false}),0,.42,0,g);l.rotation.z=Math.PI/2;addCol(x,z,1)}
  else if(type==='erts'){mesh(new THREE.DodecahedronGeometry(1.1,1),mat(0x4a5a5a),0,.5,0,g).scale.set(1.2,.8,1);addCol(x,z,1.2)}
  else{const c=NODE_COL[item]||0xffffff;mesh(new THREE.SphereGeometry(.38,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x2a5a4a,{flat:false}),0,0,0,g);mesh(new THREE.SphereGeometry(.12,8,6),mat(c,{e:c,ei:1.2,flat:false}),0,.5,0,g,false)}
  g.traverse(o=>{if(o.isMesh)o.userData.ent=n});g.userData.ent=n;return n}
/* extra finds while gathering: rough gems from ore (more with skill), Nethercap seeds… */
function lifeBonus(n,got,L){if(n.type!=='erts')return;for(const g in GEMS){const G=GEMS[g];if(G.ore!==n.item)continue;if(Math.random()<.12+L.lv*.003)got.push(['Rough '+g,1])}}
/* skins from the raid and the far Rift */
Object.assign(SKIN,{dreadlord:{it:'Abyssal Hide',lv:60,n:2},grakkus:{it:'Abyssal Hide',lv:60,n:6},ghorzul:{it:'Abyssal Hide',lv:60,n:6},vorthax:{it:'Abyssal Hide',lv:60,n:10},xalthuun:{it:'Wyrm Scale',lv:50,n:8,x:['Abyssal Hide',64]},
  sareth:{it:'Shadowsilk Thread',lv:60,n:6},voidchanter:{it:'Shadowsilk Thread',lv:60},nyxathar:{it:'Shadowsilk Thread',lv:60,n:5}});
if(SKIN.voidhorror)SKIN.voidhorror.x=['Shadowsilk Thread',64];
/* ---- void fishing: from the rim of an island, a line down into the void ---- */
const RIFT_FISH=[['Voidfin',44],['Starscale Eel',30],['Glimmer Ray',18],['Riftlurker',6],['Abyssal Leviathan Fry',2]];
function riftShore(){const x=ME.pos.x,z=ME.pos.z;if(!riftWalk(x,z,.3)||riftBridge(x,z))return null;
  for(let k=0;k<16;k++){const a=k/16*6.283;const ox=x+Math.sin(a)*5,oz=z+Math.cos(a)*5;if(!riftWalk(ox,oz,0)&&!riftWalk(x+Math.sin(a)*8,z+Math.cos(a)*8,0))return{x:x+Math.sin(a)*30,z:z+Math.cos(a)*30,r:1,wl:groundH(x,z)-3.5,rift:1}}return null}
/* ---- recipes ---- */
const R7=(id,sk,st,out,ins,lv,t,x)=>RECIPES.push({id,sk,st,out,q:1,in:ins,lv,t,...(x||{})});
R7('abyssbar','smithing','forge','Abyssal Bar',[['Abyssal Ore',3],['Voidforged Bar',1]],70,3.4);
R7('shadowleather','leatherworking','tannery','Shadowscale Leather',[['Abyssal Hide',2],['Wyrmscale Leather',1]],70,3.4);
R7('shadowweave','tailoring','loom','Shadowweave Cloth',[['Shadowsilk Thread',3],['Nethersilk Cloth',1]],70,3.4);
R7('ghostplanks','woodcutting','sawmill','Planks',[['Ghostwood',1]],64,2.4,{q:6});
R7('voidfillet','cooking','fire','Voidfin Fillet',[['Voidfin',2],['Voidbloom',1]],50,3.2);
R7('starsushi','cooking','fire','Starscale Sushi',[['Starscale Eel',2],['Starpetal',1],['Herb Powder',1]],64,3.4);
R7('abyssfeast','cooking','fire','Abyssal Banquet',[['Riftlurker',1],['Raw Meat',3],['Nethercap',2]],74,3.8);
R7('deepelix','alchemy','cauldron','Elixir of the Deep',[['Glimmer Ray',1],['Nethercap',1],['Herb Powder',1]],66,3.6);
R7('abyssflask','alchemy','cauldron','Flask of the Abyss',[['Nethercap',3],['Abyssal Ore',1],['Void Essence',1]],74,4);
R7('ring6','smithing','forge','Abyssal Seal',[['Abyssal Bar',3],['Nethercap',2]],76,4.6,{gear:{slot:'ring',cls:null,il:58,tier:6}});
/* tier VII gear, the same way 1_core makes the other tiers */
const T7={smithing:{lv:72,il:56,pre:'Abyssal',mat:'Abyssal Bar',x:['Voidforged Bar',2],w:['Ghostwood',3]},leatherworking:{lv:72,il:56,pre:'Shadowscale',mat:'Shadowscale Leather',x:['Wyrmscale Leather',2],w:['Ghostwood',3]},
  tailoring:{lv:72,il:56,pre:'Shadowweave',mat:'Shadowweave Cloth',x:['Nethersilk Cloth',2],w:['Ghostwood',3]}};
TIER_N.push('Tier VII · Abyssal');
for(const sk in T7){const S0=GEAR_SETS[sk],T=T7[sk],ti=6;S0.tiers.push(T);for(const S of[S0,...(S0.alt?[{...S0,...S0.alt,suf:'p'}]:[])])
  for(const slot in GEAR_SLOT){const[q,dl]=GEAR_SLOT[slot];const big=slot==='borst'||slot==='benen'||slot==='wapen';const wl=slot==='wapen'?S.weap:[[GEAR_BASE[S.cls][slot],null]];
    wl.forEach(([bn,wt],wi)=>{const ins=[[T.mat,q]];if(big)ins.push([T.x[0],T.x[1]]);if(slot==='wapen')ins.push([T.w[0],T.w[1]]);if(slot==='wapen'&&sk==='tailoring')ins.push(['Nethercap',2]);
      RECIPES.push({id:sk+ti+slot+(wi||'')+(S.suf||''),sk,st:LIFE[sk].st,gear:{slot,cls:S.cls,il:T.il,wt,tier:ti},out:T.pre+' '+bn,q:1,in:ins,lv:Math.min(79,T.lv+dl+(wi?1:0)),t:5.6})})}}
/* jewelcrafting: cut gems, then rings with a gem already set */
for(const g in GEMS){const G=GEMS[g];R7('jc_'+g.toLowerCase(),'jewelcrafting','jeweler',g,[['Rough '+g,1]].concat(G.lv>=46?[['Void Essence',1]]:G.lv>=22?[['Herb Powder',1]]:[]),G.lv,2.4)}
const JRINGS=[['Garnet','Garnet Band',8,['Iron Bar',2],5],['Topaz','Topaz Loop',18,['Silver Bar',2],12],['Ruby','Ruby Signet',30,['Emberstone Bar',2],18],['Emerald','Emerald Circlet',42,['Mithril Bar',2],26],
  ['Amethyst','Amethyst Seal',54,['Riftsteel Bar',2],38],['Voidstone','Voidstone Ring',66,['Voidforged Bar',2],50],['Starheart','Starheart Band',78,['Abyssal Bar',2],60]];
JRINGS.forEach(([g,n,lv,bar,il],ti)=>R7('jr_'+g.toLowerCase(),'jewelcrafting','jeweler',n,[[g,1],bar],lv,4,{gear:{slot:'ring',cls:null,il,tier:Math.min(6,ti)},gemIn:g}));
/* carpentry: furniture for your house (into your furniture store, P.furn) */
Object.assign(FURN,{
  riftthrone:{n:'Riftwood Throne',m:'K_armchair',s:1.05,r:.9,cat:'Living',tint:0x7a4ac8,glowc:0x8a4aff,craft:1},
  crystallamp:{n:'Voidcrystal Lamp',m:'../rift/Crystal_8',env:1,s:.14,r:.4,cat:'Decor',tint:0xffb0e8,glowc:0xff4ab0,craft:1,glow:1},
  starchandelier:{n:'Starlit Chandelier',m:'Q_Chandelier',s:1.6,r:0,cat:'Decor',tint:0xaef4ff,glowc:0x6ad8ff,craft:1,glow:1,hang:3.6},
  elderbookcase:{n:'Elderwood Bookcase',m:'Q_ShelfLarge',s:.62,r:1,cat:'Storage',tint:0xd8b884,craft:1},
  dragonrack:{n:'Dragonbone Weapon Rack',m:'H_weaponrack',env:1,s:3.2,r:.7,cat:'Decor',tint:0xe8dcc0,glowc:0xff6a20,craft:1},
  ghostbed:{n:'Ghostwood Bed',m:'Q_BedKing',s:.85,r:1.6,cat:'Bedroom',tint:0xc8e8f0,glowc:0x5ad8c8,craft:1},
  abyssrug:{n:'Abyssal Rug',m:'K_rug_oval_A',s:1.1,r:0,cat:'Decor',tint:0x3a2a6a,craft:1},
  gemcase:{n:'Gem Display Case',m:'Q_Column',s:.7,r:.6,cat:'Decor',tint:0xe8e0ff,glowc:0xff5a7a,craft:1}});
const CP=[['chair','Wooden Chair',0,[['Planks',2]]],['stool','Stool',0,[['Planks',1]]],['tablesmall','Small Table',3,[['Planks',3]]],['table','Table',6,[['Planks',5]]],
  ['shelf','Wall Shelf',8,[['Planks',3],['Iron Bar',1]]],['cabinetsmall','Small Cabinet',10,[['Planks',4],['Iron Bar',1]]],['chair2','High-backed Chair',12,[['Planks',3],['Sturdy Wood',1]]],
  ['cabinet','Cabinet',15,[['Planks',6],['Sturdy Wood',2]]],['bedsingle','Single Bed',16,[['Planks',6],['Linen',2]]],['shelfbooks','Bookshelf',18,[['Planks',6],['Sturdy Wood',2]]],
  ['bed','Double Bed',22,[['Planks',8],['Linen',3],['Leather',1]]],['armchair','Armchair',24,[['Planks',4],['Thick Leather',2]]],['couch','Couch',28,[['Planks',6],['Thick Leather',3]]],
  ['weaponrack','Weapon Rack',30,[['Ashwood',3],['Iron Bar',2]]],['dragonrack','Dragonbone Weapon Rack',34,[['Ashwood',4],['Drake Scale',3],['Emberstone Bar',1]]],
  ['chest','Treasure Chest',36,[['Elderwood',3],['Silver Bar',2]]],['tableround','Banquet Table',40,[['Elderwood',5]]],['elderbookcase','Elderwood Bookcase',44,[['Elderwood',6],['Moonsilk Cloth',1]]],
  ['bedking','Royal Bed',50,[['Voidwood',4],['Moonsilk Cloth',3]]],['abyssrug','Abyssal Rug',54,[['Voidhide Leather',2],['Starweave Cloth',1]]],['crystallamp','Voidcrystal Lamp',58,[['Voidcrystal',2],['Voidwood',2]]],
  ['riftthrone','Riftwood Throne',62,[['Voidwood',6],['Wyrmscale Leather',2],['Voidcrystal',1]]],['gemcase','Gem Display Case',66,[['Voidwood',3],['Amethyst',1],['Voidstone',1]]],
  ['starchandelier','Starlit Chandelier',70,[['Abyssal Bar',2],['Starpetal',3],['Voidcrystal',2]]],['ghostbed','Ghostwood Bed',74,[['Ghostwood',6],['Shadowweave Cloth',2]]]];
for(const[k,n,lv,ins]of CP){R7('cp_'+k,'carpentry','bench',n,ins,lv,2.6+lv*.03,{furn:k});if(!MATS[n])MATS[n]={m:'KS_resource-planks',t:FURN[k]&&FURN[k].tint?'#'+new THREE.Color(FURN[k].tint).getHexString():'#c89a6a',price:0,r:FURN[k]&&FURN[k].craft?3:0,furnOnly:1}}
function finishFurn(rc){P.furn=P.furn||{};P.furn[rc.furn]=(P.furn[rc.furn]||0)+1;log('You build: <b>'+esc(rc.out)+'</b>. It is waiting in your house\'s store (press H inside your house to place it).','loot',true);floatText('me',rc.out,'heal');
  questEvent('craft',rc.id,1);lifeXp('carpentry',18+rc.lv*2.2);craftDoneFx(rc);sfx('loot');refreshBag();if(!$('#pLife').hidden)refreshLife();saveGame()}
/* ---- sockets ---- */
function socketGem(bi,slot){const g=P.inv[bi];const it=P.eq[slot];if(!g||!it||!MATS[g.n]||!MATS[g.n].gem)return;const old=it.gem;it.gem=g.n;g.q=(g.q||1)-1;if(g.q<=0)P.inv[bi]=null;TMC=null;
  const f=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*f);log('✦ You set a '+esc(g.n)+' in ['+esc(it.n)+']'+(old?' (the '+esc(old)+' shatters)':'')+': '+esc(MATS[g.n].gem.txt)+'.','loot',true);
  const c=new THREE.Color(MATS[g.n].t).getHex();flash(ME.pos.x,ME.pos.y+1.3,ME.pos.z,c,2);sparks(ME.pos.x,ME.pos.y+1.3,ME.pos.z,c,16,3,.3,.4);sfx('quest');lifeXp('jewelcrafting',25);refreshBag();if(!$('#pChar').hidden)refreshChar();saveGame()}
function gemMods(TMC){if(!P||!P.eq)return;for(const s of SLOTS){const it=P.eq[s];const G=it&&it.gem&&MATS[it.gem]&&MATS[it.gem].gem;if(G)for(const k in G.mods)TMC[k]=(TMC[k]||0)+G.mods[k]}}
function gemHtml(it){const G=it.gem&&MATS[it.gem]&&MATS[it.gem].gem;return G?'<div class="tench" style="color:'+MATS[it.gem].t+'">◆ Socket: '+esc(it.gem)+' — '+esc(G.txt)+'</div>':'<div class="tench" style="color:#8a8070">◇ Empty socket</div>'}
/* ---- Nether enchantments ---- */
ENCH_RANK.push('Nether');ROMAN.push('IV');
Object.assign(ENCH_TYPES,{
  voidrend:{n:'Voidrend',col:0x9a3aff,col2:0x1a0a2a,mod:'critdmg',v:.08,txt:r=>'+'+Math.round(.08*r*100)+'% critical damage',cat:['Voidbloom','Voidcrystal'],lv:50,nether:1},
  starfire:{n:'Starfire',col:0x6ae8ff,col2:0xffffff,mod:'powp',v:.04,txt:r=>'+'+Math.round(.04*r*100)+'% power',cat:['Starpetal','Starpetal'],lv:54,nether:1},
  riftlash:{n:'Riftlash',col:0xff4ab8,col2:0xffb0e8,mod:'cdall',v:.03,txt:r=>'all abilities ready '+Math.round(.03*r*100)+'% sooner',cat:['Riftstone Ore','Voidbloom'],lv:58,nether:1},
  soulwell:{n:'Soulwell',col:0x3affc8,col2:0xc8fff0,mod:'mregen',v:.08,txt:r=>Math.round(.08*r*100)+'% faster mana, energy or focus',cat:['Voidbloom','Starpetal'],lv:62,nether:1}});
for(const t in ENCH_TYPES){const T=ENCH_TYPES[t];for(let r=T.nether?1:4;r<=4;r++)ENCH[t+r]={id:t+r,type:t,rank:r,slot:'wapen',n:T.n+' '+ROMAN[r],mods:{[T.mod]:T.v*r},txt:T.txt(r),col:T.col}}
for(const s in ENCH_ARM){const A=ENCH_ARM[s];ENCH['arm_'+s+4]={id:'arm_'+s+4,rank:4,slot:s,n:A.n+' '+ROMAN[4],mods:{[A.mod]:A.v*4},txt:A.txt(4)}}
R7('voidessence','enchanting','altar','Void Essence',[['Nether Dust',5]],50,2.6);R7('riftshard','enchanting','altar','Rift Shard',[['Void Essence',4],['Voidcrystal',1]],62,3.2);
{let i=0;for(const t in ENCH_TYPES){const T=ENCH_TYPES[t];
  if(T.nether){const L=[T.lv,T.lv+6,T.lv+12,Math.min(79,T.lv+16)];const IN=[[['Nether Dust',6],[T.cat[0],2]],[['Void Essence',2],['Nether Dust',4],[T.cat[1],2]],[['Void Essence',4],['Rift Shard',1],[T.cat[1],2]],[['Rift Shard',3],['Void Essence',3],['Nethercap',3]]];
    for(let r=1;r<=4;r++)RECIPES.push({id:'en_'+t+r,sk:'enchanting',st:'altar',ench:t+r,out:'Enchant Weapon: '+T.n+' '+ROMAN[r],q:1,in:IN[r-1],lv:L[r-1],t:3+r*.4})}
  else RECIPES.push({id:'en_'+t+4,sk:'enchanting',st:'altar',ench:t+4,out:'Enchant Weapon: '+T.n+' IV',q:1,in:[['Rift Shard',2],['Void Essence',3],['Nethercap',2]],lv:70+(i++),t:4.2})}}
{let i=0;for(const s in ENCH_ARM){const A=ENCH_ARM[s];RECIPES.push({id:'ea_'+s+4,sk:'enchanting',st:'altar',ench:'arm_'+s+4,out:'Enchant '+SLOT_NL[s]+': '+A.n+' IV',q:1,in:[['Rift Shard',1],['Void Essence',3],['Nether Dust',4]],lv:70+(i++),t:3.8})}}
/* the auras of the Nether enchantments */
function enchSparkNether(type,x,y,z,rank,T){const k=(.7+rank*.3)*1.45;
  if(type==='voidrend'){emitP({x,y,z,vx:FRN(-.3,.3),vy:FRN(-.2,.6),vz:FRN(-.3,.3),life:FRN(.5,.9),size:.3,size1:.8*k,col:0x12061e,a:.6,a1:0,cell:FXC.smoke2,add:false,vrot:FRN(-2,2)});if(Math.random()<.6)emitP({x,y,z,vx:FRN(-.6,.6),vy:FRN(-.6,.6),vz:FRN(-.6,.6),drag:3,life:.5,size:.2*k,size1:.02,col:0xc06aff,a:1,a1:0,cell:FXC.crit})}
  else if(type==='starfire'){emitP({x,y,z,vx:FRN(-.4,.4),vy:FRN(.6,1.6),vz:FRN(-.4,.4),life:FRN(.5,.9),size:.24*k,size1:.03,col:0xffffff,col1:0x6ae8ff,a:1,a1:0,cell:FXC.star,vrot:FRN(-3,3)});if(Math.random()<.3)emitP({x,y,z,life:.3,size:.5*k,size1:.1,col:0x6ae8ff,a:.7,a1:0,cell:FXC.glint})}
  else if(type==='riftlash'){emitP({x:x+FRN(-.06,.06),y:y+FRN(-.06,.06),z:z+FRN(-.06,.06),vx:FRN(-2,2),vy:FRN(-2,2),vz:FRN(-2,2),drag:5,life:FRN(.1,.22),size:.42*k,size1:.08,col:0xffb0e8,col1:0xff2a9a,a:1,a1:0,cell:FXC.zap,rot:Math.random()*6.3});if(Math.random()<.25)emitP({x,y,z,vy:.4,life:.7,size:.3,size1:.8,col:0xff4ab8,a:.3,a1:0,cell:FXC.soft})}
  else if(type==='soulwell'){const a=FRN(0,6.28);emitP({x:x+Math.cos(a)*.15,y,z:z+Math.sin(a)*.15,vx:Math.cos(a)*.3,vy:FRN(.5,1.2),vz:Math.sin(a)*.3,life:FRN(.7,1.1),size:.22*k,size1:.06,col:0xc8fff0,col1:0x3affc8,a:1,a1:0,cell:FXC.wisp,vrot:FRN(-2,2)})}
  else return false;return true}
/* ---- the two new benches (models from Kenney Survival, KayKit and the Rift crystals) ---- */
async function buildLife2(){if(window.__NOGLTF)return;const jobs=[];const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  const B=STATIONS.find(s=>s.k==='bench'),J=STATIONS.find(s=>s.k==='jeweler');
  jobs.push(put('KS_workbench',B.x,B.z,Math.PI,[3.2,3.2,3.2]));jobs.push(put('KT_saw',B.x-.6,B.z+.2,.4,.9,1.45));jobs.push(put('KT_hammer',B.x+.7,B.z+.1,1.2,.8,1.45));jobs.push(put('H_resource_lumber',B.x+2.8,B.z-.6,.3,2.2));jobs.push(put('KS_resource-planks',B.x-2.6,B.z+.4,1.1,1.6));
  addCol(B.x,B.z,1.4);addCol(B.x+2.8,B.z-.6,1);
  jobs.push(put('KS_workbench-anvil',J.x,J.z,Math.PI,[2.6,2.6,2.6]));jobs.push(put('KT_tongs',J.x+.5,J.z+.2,.8,.7,1.25));jobs.push(put('KT_lantern',J.x-.7,J.z,0,.7,1.25));
  jobs.push(riftInst('../rift/Crystal_8',[{x:J.x-.1,z:J.z+.1,y:groundH(J.x,J.z)+1.3,ry:.5,s:.07},{x:J.x+1.6,z:J.z-.5,y:groundH(J.x,J.z),ry:1.5,s:.14}],{col:0xff8aa8,glow:0xff2a5a,gi:1,cast:false}));
  addCol(J.x,J.z,1.3);addLight(J.x,groundH(J.x,J.z)+2,J.z,0xff8aa8,10,8);
  await Promise.all(jobs)}
LIFE_HINTS.mining+=' · Abyssal Ore (Voidmaster) on the Throne of the Void and the far islets. Every vein can hold a rough gem for jewelcrafting.';
LIFE_HINTS.woodcutting+=' · Ghostwood (Voidmaster) in the Twisted Grove and on the Throne of the Void.';
LIFE_HINTS.herbalism+=' · Nethercap (Voidmaster) in the Twisted Grove, the Voidspire Ruins and on the Throne.';
LIFE_HINTS.skinning+=' Voidmaster: Abyssal Hide and Shadowsilk from the masters of the Sanctum and the Void Citadel.';
LIFE_HINTS.fishing='Stand on the shore of a lake and press F. Strike when the marker is inside the green zone. From Master fishing on you can also fish into the void at the rim of a Rift island.';
LIFE_HINTS.enchanting+=' Gear from the Nether Rift and beyond gives Nether Dust, Void Essence and Rift Shards: the stuff of the Nether enchantments and of every rank IV.';
LIFE_HINTS.carpentry='Make furniture at the Carpenter\'s Bench in the Artisans\' Yard. It goes straight into your house\'s store: press H inside your house to place it. The rarest pieces can only be made, never bought.';
LIFE_HINTS.jewelcrafting='Rough gems turn up while mining (each ore its own gem). Cut them at the Jeweler\'s Bench, set them in rings, or socket them into gear you wear: open your bag, click a cut gem and choose Socket into…';
/* two quests to start the new professions */
QUESTS.push({id:'cp1',n:'A Chair of Your Own',giver:'orla',lvl:2,txt:'Every house starts with somewhere to sit. Saw some Planks at the sawmill, then build a Wooden Chair at the Carpenter\'s Bench here in the Artisans\' Yard. It will wait in your house\'s store until you place it.',obj:{craft:'cp_chair',n:1,lbl:'Wooden Chair built'},xp:240,gold:10,life:{carpentry:120},done:'Sturdy! Keep at it and one day you will build a throne.'},
  {id:'jc1',n:'Cut and Polish',giver:'ysolde',lvl:4,txt:'Ore veins hide more than ore. Mine Iron until you find a Rough Garnet, then cut it at the Jeweler\'s Bench. A cut gem can be set into anything you wear.',obj:{craft:'jc_garnet',n:1,lbl:'Garnet cut'},xp:320,gold:12,life:{jewelcrafting:120,mining:60},done:'Look how it catches the light. Now open your bag, click the gem, and set it into your gear.'});
