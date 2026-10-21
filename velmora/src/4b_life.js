/* ===================== life skills: gathering, skinning, fishing and crafting =====================
   Gathering nodes, stations and tools are downloaded models (Kenney, Quaternius, KayKit); the work animations come from
   KayKit Character Animations (Rig_Medium) and are played on the player while an activity runs. */
const NODES=[];
{const r=mulberry(9091);
  const bad=(x,z)=>pathDist(x,z)<3.5||Math.hypot(x,z)<TOWN.wall+8||Math.hypot(x-ARENA.x,z-ARENA.z)<36||Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.1||Math.hypot(x-CAMP.x,z-CAMP.z)<28||Math.hypot(x-CRYPT.x,z-CRYPT.z)<22||Math.hypot(x-CAVE.x,z-CAVE.z)<20||Math.hypot(x-CRAFT.x,z-CRAFT.z)<CRAFT.r+6;
  const place=(type,item,count,cx,cz,rad,ok)=>{for(let i=0,t=0;i<count&&t<900;t++){const a=r()*6.28,d=Math.sqrt(r())*rad,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(Math.abs(x)>240||Math.abs(z)>245)continue;if(bad(x,z))continue;if(ok&&!ok(x,z))continue;NODES.push({id:'n'+NODES.length,type,item,x,z});i++}};
  place('hout','Wood',12,-60,-62,90,(x,z)=>z<-50&&z>-90);place('hout','Wood',6,-130,30,45);place('hout','Wood',5,60,-60,40,inForest);
  place('erts','Iron Ore',8,-140,-150,45);place('erts','Iron Ore',7,175,-150,40);place('erts','Silver Ore',5,215,-205,30);place('erts','Iron Ore',4,120,40,40);place('erts','Silver Ore',4,-190,-170,35);
  place('kruid','Sunleaf',14,30,90,80,(x,z)=>!inForest(x,z));place('kruid','Sunleaf',5,-80,20,40);
  place('kruid','Moonbloom',10,-40,-120,70,inForest);place('kruid','Bloodroot',7,-130,-200,40,(x,z)=>inForest(x,z)||Math.hypot(x-CRYPT.x,z-CRYPT.z)<70);
  place('kruid','Flax',10,70,120,45,(x,z)=>!inForest(x,z)&&!(Math.abs(x-FARM.x)<56&&Math.abs(z-FARM.z)<44));place('kruid','Flax',6,-95,60,30,(x,z)=>!inForest(x,z));
  /* Dragon Realm: Emberstone, Ashwood and Fireblossom between the camp and the volcano */
  const placeR=(type,item,count)=>{for(let i=0,t=0;i<count&&t<900;t++){const a=r()*6.28,d=VOLC.r+12+r()*70,x=DRK.x+Math.cos(a)*d,z=DRK.z+Math.sin(a)*d;
    if(drkLava(x,z)||Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)<38||Math.hypot(x-DRK_ENTRY.x,z-DRK_ENTRY.z)<20||Math.hypot(x-VOLC_DOOR.x,z-VOLC_DOOR.z)<14)continue;NODES.push({id:'n'+NODES.length,type,item,x,z});i++}};
  placeR('erts','Emberstone',14);placeR('hout','Ashwood',10);placeR('kruid','Fireblossom',12);
  /* the Woods of Elvia: Mithril in the highlands and Thornwood, Elderwood in the deep forest, Moonpetal by the lakes */
  const okE=(x,z)=>Math.hypot(x-WS.x,z-WS.z)>WS.R+24&&!ELV_LAKES.some(l=>Math.hypot(x-l.x,z-l.z)<l.r*1.12)&&elvRiver(x,z)[0]>7&&elvPathDist(x,z)>4&&Math.max(Math.abs(x-ELV.x),Math.abs(z-ELV.z))<410&&Math.hypot(x-ELV_CAMP.x,z-ELV_CAMP.z)>30;
  const placeE=(type,item,count,cx,cz,rad,ok)=>{for(let i=0,t=0;i<count&&t<1500;t++){const a=r()*6.28,d=Math.sqrt(r())*rad,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(!okE(x,z)||(ok&&!ok(x,z)))continue;NODES.push({id:'n'+NODES.length,type,item,x,z});i++}};
  const hiE=(x,z)=>(z-ELV.z)<elvCliff(x-ELV.x)-12;
  placeE('erts','Mithril Ore',10,ELV.x+40,ELV.z-310,110,hiE);placeE('erts','Mithril Ore',6,ELV.x+330,ELV.z+150,70);
  placeE('hout','Elderwood',10,ELV.x-260,ELV.z-20,120);placeE('hout','Elderwood',6,ELV.x+300,ELV.z+60,80);
  for(const l of ELV_LAKES)placeE('kruid','Moonpetal',l.r>60?6:4,l.x,l.z,l.r*1.6)}
const NODE_N={hout:'Fallen Trunk',erts:'Ore Vein',kruid:''};
const NODE_SK={hout:'woodcutting',erts:'mining',kruid:'herbalism'};
const NODE_REQ={'Silver Ore':10,'Emberstone':20,'Ashwood':20,'Moonbloom':5,'Bloodroot':10,'Fireblossom':20,'Mithril Ore':30,'Elderwood':30,'Moonpetal':30};
const NODE_COL={'Iron Ore':0xc8783a,'Silver Ore':0xdfe8f2,'Emberstone':0xff5a1a,'Sunleaf':0xffd94a,'Moonbloom':0x7ab8ff,'Bloodroot':0xe04040,'Flax':0xc8e0a0,'Fireblossom':0xff7a20};
for(const n of NODES){const g=new THREE.Group();const y=groundH(n.x,n.z);g.position.set(n.x,y,n.z);g.rotation.y=hash(n.x|0,n.z|0)*6;scene.add(g);n.g=g;n.y=y;n.kind='node';n.rig={h:.8};
  n.name=n.type==='kruid'?n.item:n.type==='erts'?n.item.replace(/ Ore$/,'')+' Vein':n.item==='Ashwood'?'Ashwood Trunk':NODE_N[n.type];
  /* eenvoudige vervanging tot de modellen geladen zijn (buildCraftEnv vervangt de inhoud) */
  if(n.type==='hout'){const l=mesh(new THREE.CylinderGeometry(.42,.5,4.2,12),mat(n.item==='Ashwood'?0x3a302c:0x6a4a2c,{flat:false}),0,.42,0,g);l.rotation.z=Math.PI/2;addCol(n.x,n.z,1)}
  else if(n.type==='erts'){mesh(new THREE.DodecahedronGeometry(1.1,1),mat(0x6a6660),0,.5,0,g).scale.set(1.2,.8,1);addCol(n.x,n.z,1.2)}
  else{const c=NODE_COL[n.item]||0xffffff;mesh(new THREE.SphereGeometry(.38,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x3f7a2a,{flat:false}),0,0,0,g);mesh(new THREE.SphereGeometry(.12,8,6),mat(c,{e:c,ei:1.2,flat:false}),0,.5,0,g,false)}
  g.traverse(o=>{if(o.isMesh)o.userData.ent=n});g.userData.ent=n}
/* ---- skills and save migration ---- */
function migrateLife(){if(!P)return;const L=P.life=P.life||{};for(const o in LIFE_OLD){if(!L[o])continue;for(const k of LIFE_OLD[o])if(!L[k]||L[k].lv<L[o].lv)L[k]={lv:L[o].lv,xp:L[o].xp};delete L[o]}}
/* oude Nederlandse voorwerpnamen (opgeslagen in savegames) naar het Engels */
const GEAR_OLD=[["Gewaad van Gloeiende Schubben", "Robe of Glowing Scales"], ["Handschoenen van de Valkenier", "Gloves of the Falconer"], ["Asvorst, Slachter der Draken", "Ash Queen's Bane, Slayer of Dragons"], ["Drakenpees, Boog der Asvorst", "Dragonstring, Bow of the Ash Queen"], ["Schaduwboog van Kaal-Morath", "Shadowbow of Kaal-Morath"], ["Schubbenharnas van Vyraxion", "Scale Harness of Vyraxion"], ["Klauwen van het Drakenbroed", "Claws of the Dragon Brood"], ["Fluisterende Schedelstaf", "Whispering Skullstaff"], ["Hoornhelm van de Asvorst", "Horned Helm of the Ash Queen"], ["Staf der Eeuwige Nacht", "Staff of Eternal Night"], ["Kroon van Smeulende As", "Crown of Smouldering Ash"], ["Grafwachters Langboog", "Gravewarden's Longbow"], ["Vyraxions Vlammenhart", "Vyraxion's Flameheart"], ["Kap van het Drakenoog", "Hood of the Dragon's Eye"], ["Grafbijl van Morath", "Grave Axe of Morath"], ["Jas van Drakenhuid", "Coat of Dragonhide"], ["Gebroken hoektand", "Broken Fang"], ["Stoffig perkament", "Dusty Parchment"], ["Versleten zwaard", "Worn Sword"], ["Leerlingengewaad", "Apprentice Robe"], ["Leerlingentuniek", "Apprentice Tunic"], ["Gestolen zakdoek", "Stolen Handkerchief"], ["Eenvoudige boog", "Simple Bow"], ["van de Adelaar", "of the Eagle"], ["Leerlingenstaf", "Apprentice Staff"], ["Leerlingenhemd", "Apprentice Shirt"], ["Grisks oorring", "Grisk's Earring"], ["van de Tijger", "of the Tiger"], ["van het Licht", "of the Light"], ["Kroonsplijter", "Crownsplitter"], ["Kroonsplinter", "Crown Shard"], ["Chitineschild", "Chitin Plate"], ["Roestige gesp", "Rusty Buckle"], ["Handschoenen", "Gloves"], ["Knekelbreker", "Bonebreaker"], ["Vonkengrepen", "Sparkgrips"], ["Everslagtand", "Boar Tusk"], ["Dobbelstenen", "Dice"], ["Vergeeld bot", "Yellowed Bone"], ["Sterrenstof", "Stardust"], ["Valkenveren", "Falconfeather"], ["van de Beer", "of the Bear"], ["van de Wolf", "of the Wolf"], ["Botsplinter", "Bone Splinter"], ["Wolfsleren", "Wolfhide"], ["Borstplaat", "Breastplate"], ["Beenplaten", "Legplates"], ["Strijdbijl", "Battleaxe"], ["van de Uil", "of the Owl"], ["Zielenvlam", "Soulflame"], ["Knekelpees", "Bonestring"], ["Gehavende", "Battered"], ["Toverstaf", "Wand"], ["Zegelring", "Signet Ring"], ["Schubben", "Scaled"], ["Puntmuts", "Pointed Hat"], ["Sandalen", "Sandals"], ["Langboog", "Longbow"], ["Gifklier", "Venom Gland"], ["IJzeren", "Iron"], ["Laarzen", "Boots"], ["Stalen", "Steel"], ["Maliën", "Chainmail"], ["Zijden", "Silk"], ["Linnen", "Linen"], ["Gewaad", "Robe"], ["Tuniek", "Tunic"], ["Zwaard", "Sword"], ["Rommel", "Junk"], ["Runen", "Runic"], ["Leren", "Leather"], ["Broek", "Trousers"], ["Staf", "Staff"], ["Boog", "Bow"], ["Kap", "Hood"]];
const _GO=GEAR_OLD.map(([a,b])=>[new RegExp('(?<![A-Za-zÀ-ÿ])'+a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-zÀ-ÿ])','i'),b]);
function enName(n){if(!n||!/[a-z]/i.test(n))return n;let o=n;for(const[re,b]of _GO)o=o.replace(re,b);return o!==n?o[0].toUpperCase()+o.slice(1):n}
function migrateItems(){if(!P)return;if(!P.ckGiven){P.ckGiven=1;if(!P.eq.rug)P.eq.rug=starterCloak(P.cls)}const gfix=it=>{if(!it)return;if(it.kind==='potion')it.n=it.pt==='mana'?'Power Potion':'Healing Potion';else if(it.kind==='gear'||it.kind==='junk'||it.kind==='quest')it.n=enName(it.n)};P.inv.forEach(gfix);for(const s in P.eq)gfix(P.eq[s]);if(P.bank)P.bank.forEach(gfix);
  const fix=it=>{if(it&&(it.kind==='mat'||it.kind==='junk')&&MAT_OLD[it.n]){it.n=MAT_OLD[it.n];it.kind='mat';const M=MATS[it.n]||{};it.price=M.price||1;it.r=M.r||0}};
  P.inv.forEach(fix);if(P.bank)P.bank.forEach(fix);
  /* stapels die nu dezelfde naam hebben samenvoegen */for(let i=0;i<P.inv.length;i++){const a=P.inv[i];if(!a||a.kind!=='mat')continue;for(let j=i+1;j<P.inv.length;j++){const b=P.inv[j];if(b&&b.kind==='mat'&&b.n===a.n){a.q+=b.q;P.inv[j]=null}}}
  if(P.buffs)for(const k in P.buffs){const b=P.buffs[k];if(b&&MAT_OLD[b.n])b.n=MAT_OLD[b.n]}migrateLife()}
function lifeOf(k){P.life=P.life||{};return P.life[k]||(P.life[k]={lv:0,xp:0})}
function lifeXp(k,n){if(!LIFE[k])return;const L=lifeOf(k);L.xp+=Math.round(n);let up=false;while(L.lv<69&&L.xp>=lifeNeed(L.lv)){L.xp-=lifeNeed(L.lv);L.lv++;up=true}if(up){log('✦ '+LIFE[k].n+': you are now '+rankOf(L.lv)+'!','sys');floatText('me',LIFE[k].n+' '+rankOf(L.lv),'xp');sfx('quest');if(L.lv%10===0)banner(LIFE[k].n+': '+RANKS[Math.min(6,L.lv/10)],'New rank reached')}if(!$('#pLife').hidden)refreshLife()}
function energyTick(){if(!P)return;const now=Date.now();P.energyT=P.energyT||now;const gain=Math.floor((now-P.energyT)/6000);if(gain>0){P.energy=Math.min(maxEnergy(),(P.energy??100)+gain);P.energyT+=gain*6000}if(P.energy>=maxEnergy())P.energyT=now}
const maxEnergy=()=>100+Math.floor(Object.values(P.life||{}).reduce((s,l)=>s+l.lv,0)/5);
function useEnergy(n){energyTick();if((P.energy??100)<n){toast('Not enough energy (it recharges on its own)');return false}P.energy-=n;return true}
function questEvent(kind,key,q=1){for(const qq of QUESTS){const st=P.quests[qq.id];if(!st||st.n>=qq.obj.n)continue;const o=qq.obj;if((kind==='gather'&&o.gather===key)||(kind==='fish'&&o.fish)||(kind==='craft'&&o.craft===key)||(kind==='skin'&&o.skin)||(kind==='dis'&&o.dis)){st.n=Math.min(o.n,st.n+q);log(o.lbl+': '+st.n+'/'+o.n,'sys');if(st.n>=o.n){log('Quest complete: '+qq.n+' — return to '+npcName(qq.giver),'sys');sfx('quest')}refreshTracker();refreshNpcMarks()}}}
function giveMat(n,q){const it=matItem(n,q);if(!addItem(it)){toast('Your bag is full');return false}log('You receive: <span style="color:'+rarCol(it)+'">['+esc(n)+']</span>'+(q>1?' x'+q:''),'loot',true);return true}
/* ---- activities: one at a time; the player plays the matching work animation with a tool in hand ---- */
const ACT={cur:null,post:null};
function actAnim(){const A=ACT.cur;if(A)return A.anim||null;const p=ACT.post;if(p&&p.t>0)return p.anim;return null}
function nearNode(rad=3.6){let b=null,bd=rad;for(const n of NODES){if(n.down)continue;const d=Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z);if(d<bd){bd=d;b=n}}return b}
function startGather(n){if(ME.mounted)dismount();if(ME.dead||ME.cast||ACT.cur)return;if(Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z)>3.8)return toast('Move closer');if(n.down)return toast('There is nothing left to gather here');
  const sk=NODE_SK[n.type],need=NODE_REQ[n.item]||0,L=lifeOf(sk);if(L.lv<need)return toast(LIFE[sk].n+' '+rankOf(need)+' required');if(!useEnergy(1))return;needToolClips();
  const dur=Math.max(1.6,4-L.lv*.035);faceTo(n.x,n.z);ACT.cur={k:'gather',n,sk,t:0,dur,anim:n.type==='hout'?'chop':n.type==='erts'?'mine':'herb',fx:.6,lbl:n.type==='hout'?'Chopping…':n.type==='erts'?'Mining…':'Picking '+n.item+'…'};$('#castbar').hidden=false}
function finishGather(n,sk){const L=lifeOf(sk);let q=1+(Math.random()<.25+L.lv*.012?1:0);const got=[[n.item,q]];
  if(n.item==='Wood'&&Math.random()<.08+L.lv*.004)got.push(['Sturdy Wood',1]);if(n.item==='Iron Ore'&&L.lv>=10&&Math.random()<.08+L.lv*.003)got.push(['Silver Ore',1]);
  if(n.type==='kruid'&&n.item!=='Flax'&&Math.random()<.06+L.lv*.003)got.push(['Flax',1+(Math.random()<.4?1:0)]);if(n.item==='Sunleaf'&&L.lv>=5&&Math.random()<.05)got.push(['Moonbloom',1]);
  for(const[it,qq]of got){if(giveMat(it,qq))questEvent('gather',it,qq)}lifeXp(sk,n.type==='erts'&&n.item!=='Iron Ore'||n.item==='Ashwood'||n.item==='Fireblossom'?20:13);
  n.down=1;n.downT=50;n.g.visible=false;const col=n.type==='kruid'?0xffe08a:n.type==='erts'?(NODE_COL[n.item]||0xd8c8a0):0xd8b080;burst(n.x,n.y+.6,n.z,col,16,2.8);sfx('loot');refreshBag();saveGame()}
/* ---- skinning: beasts you looted can be skinned once ---- */
function skinTarget(rad=5){let b=null,bd=rad;for(const m of MONS){if(!m.dead||m.loot||m.skinned||!SKIN[m.type])continue;const d=Math.hypot(m.x-ME.pos.x,m.z-ME.pos.z);if(d<bd){bd=d;b=m}}return b}
function startSkin(m){if(ME.mounted)dismount();if(ME.dead||ME.cast||ACT.cur)return;const S=SKIN[m.type],L=lifeOf('skinning');if(L.lv<S.lv)return toast('Skinning '+rankOf(S.lv)+' required');if(!useEnergy(1))return;needToolClips();
  faceTo(m.x,m.z);ACT.cur={k:'skin',m,t:0,dur:Math.max(1.6,3.4-L.lv*.03),anim:'skin',fx:.5,lbl:'Skinning…'};$('#castbar').hidden=false}
function finishSkin(m){if(m.skinned||!m.dead)return;m.skinned=true;const S=SKIN[m.type],L=lifeOf('skinning');const q=(S.n||1)+(Math.random()<.2+L.lv*.012?1:0);
  if(giveMat(S.it,q))questEvent('skin',S.it,q);if(S.x&&L.lv>=S.x[1]&&Math.random()<.25+L.lv*.006)giveMat(S.x[0],1);lifeXp('skinning',S.lv>=20?22:S.lv>=10?17:13);
  burst(m.x,m.y+.4,m.z,0xb08a60,14,2.2);sfx('loot');refreshBag();saveGame()}
/* ---- fishing (timing mini-game) ---- */
/* aan de oever: zelf (bijna) droog staan en een paar meter verderop diep water */
/* the lake you stand at: Mirror Lake (water at -0.7) or one of the lakes of Elvia */
function shoreLake(){const all=[{x:LAKE.x,z:LAKE.z,r:LAKE.r,wl:-.7,home:1},...(inElv(ME.pos.x)?ELV_LAKES:[])];
  for(const L of all){const d=Math.hypot(ME.pos.x-L.x,ME.pos.z-L.z);if(d>L.r*1.45||d<L.r*.45)continue;const a=Math.atan2(L.x-ME.pos.x,L.z-ME.pos.z);if(groundH(ME.pos.x,ME.pos.z)>L.wl-.45&&groundH(ME.pos.x+Math.sin(a)*6,ME.pos.z+Math.cos(a)*6)<L.wl-.25)return L}return null}
function atShore(){return!!shoreLake()}
let bobber=null,fishLine=null;
function startFish(){if(ME.mounted)dismount();if(ME.dead||ACT.cur||ME.cast)return;const LK=shoreLake();if(!LK)return toast(inElv(ME.pos.x)?'Stand on the shore of a lake to fish':'Stand on the shore of Mirror Lake to fish');if(!useEnergy(1))return;needToolClips();
  const a=Math.atan2(LK.x-ME.pos.x,LK.z-ME.pos.z);ME.ry=a;const bx=ME.pos.x+Math.sin(a)*7,bz=ME.pos.z+Math.cos(a)*7;
  if(!bobber){bobber=new THREE.Group();scene.add(bobber);loadEnv('Q_Lure_1').then(g=>{if(!g)return;const o=envClone(g);const s=.42/Math.max(...o.userData.size);o.scale.setScalar(s);o.position.y=-.08;bobber.add(o)})}
  if(!fishLine){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));fishLine=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xe8e8e8,transparent:true,opacity:.7}));fishLine.frustumCulled=false;scene.add(fishLine)}
  bobber.position.set(bx,LK.wl+.08,bz);bobber.visible=false;fishLine.visible=false;const L=lifeOf('fishing');ACT.cur={k:'fish',t:0,wait:rand(4,10)*Math.max(.45,1-L.lv*.01),phase:'cast',lbl:'Casting…',bx,bz,anim:'fishcast'};log('You cast your line…','sys')}
function fishBite(){const A=ACT.cur;A.phase='bite';A.t=0;A.anim='fishbite';sfx('hit');sfx('loot');ringFx(A.bx,A.bz,2,0xffffff,.5,-.7);burst(A.bx,-.4,A.bz,0xcfefff,16,2.5);
  const L=lifeOf('fishing');A.zone=[rand(.2,.6),.2+L.lv*.003];A.m=0;A.dir=1;$('#fishBar').hidden=false;$('#fishZone').style.left=(A.zone[0]*100)+'%';$('#fishZone').style.width=(A.zone[1]*100)+'%';toast('A bite! Press F / Action inside the green zone')}
function fishHook(){const A=ACT.cur;if(!A||A.k!=='fish'||A.phase!=='bite')return false;const[z0,w]=A.zone;const inZ=A.m>=z0&&A.m<=z0+w;const perfect=Math.abs(A.m-(z0+w/2))<w*.18;const bx=A.bx,bz=A.bz;endFish();
  if(!inZ){log('The fish got away…','err');lifeXp('fishing',4);return true}
  const L=lifeOf('fishing');const roll=(inElv(ME.pos.x)?ELV_FISH:FISH).map(([n,wt],i)=>[n,wt*(i>=3?(1+L.lv*.04)*(perfect?2:1):1)]);let tot=roll.reduce((s,f)=>s+f[1],0),r=Math.random()*tot,got='Perch';for(const[n,wt]of roll){if((r-=wt)<=0){got=n;break}}
  if(giveMat(got,1)){questEvent('fish',got,1);floatText('me',(perfect?'Perfect! ':'')+got,MATS[got].r>=2?'gold':'heal')}lifeXp('fishing',perfect?32:24);sfx('quest');
  ACT.post={anim:'fishcatch',t:1.5};flyFish(got,bx,bz);refreshBag();saveGame();return true}
function endFish(){ACT.cur=null;$('#fishBar').hidden=true;$('#castbar').hidden=true;if(bobber)bobber.visible=false;if(fishLine)fishLine.visible=false}
/* de gevangen vis zwiept in een boog uit het water naar de speler */
const FLY=[];
function flyFish(name,bx,bz){const M=MATS[name]||{};loadEnv('KS_fish-large').then(g=>{if(!g)return;const o=envClone(g);const s=.7/Math.max(...o.userData.size);o.scale.setScalar(s);if(M.t)o.traverse(x=>{if(x.isMesh){x.material=x.material.clone();x.material.color.multiply(new THREE.Color(M.t))}});
  scene.add(o);FLY.push({o,t:0,x0:bx,z0:bz,y0:-.6})})}
function updFly(dt){for(let i=FLY.length-1;i>=0;i--){const f=FLY[i];f.t+=dt;const k=Math.min(1,f.t/.8);const tx=ME.pos.x,tz=ME.pos.z,ty=ME.pos.y+1.4;f.o.position.set(lerp(f.x0,tx,k),lerp(f.y0,ty,k)+Math.sin(k*Math.PI)*3,lerp(f.z0,tz,k));f.o.rotation.z+=dt*12;
  if(k>=1){scene.remove(f.o);FLY.splice(i,1);emitP({x:tx,y:ty,z:tz,life:.3,size:1.4,size1:.2,col:0xcfefff,a:1,a1:0,cell:FXC.star,must:1})}}}
/* ---- crafting ---- */
const ST_HINT={forge:'the Forge in the Artisans\' Yard (west of town)',tannery:'the Tannery in the Artisans\' Yard',loom:'the Tailor\'s Table in the Artisans\' Yard',sawmill:'the Sawmill in the Artisans\' Yard',fire:'a cooking fire (fountain, Artisans\' Yard, bandit camp or Ashen Hills)',cauldron:'Mirla\'s alchemy cauldron in Silverbrook'};
const CRAFT_ANIM={smithing:'forge',leatherworking:'tan',tailoring:'sew',cooking:'cook',alchemy:'brew',woodcutting:'saw',herbalism:'grind'};
function nearStation(k){return STATIONS.some(s=>s.k===k&&Math.hypot(s.x-ME.pos.x,s.z-ME.pos.z)<(s.r||5))}
function invCount(name,tag){return P.inv.reduce((s,x)=>s+(x&&x.kind==='mat'&&(x.n===name||(tag&&MATS[x.n]&&MATS[x.n].tag===tag))?(x.q||1):0),0)}
function invTake(name,tag,n){for(let i=0;i<P.inv.length&&n>0;i++){const x=P.inv[i];if(!x||x.kind!=='mat'||!(x.n===name||(tag&&MATS[x.n]&&MATS[x.n].tag===tag)))continue;const k=Math.min(n,x.q||1);x.q=(x.q||1)-k;n-=k;if(x.q<=0)P.inv[i]=null}}
const TAG_N={wood:'wood',herb:'herbs',fish:'fish',ore:'ore'};
function canCraft(rc){const L=lifeOf(rc.sk);if(L.lv<rc.lv)return LIFE[rc.sk].n+' '+rankOf(rc.lv)+' required';if(rc.st&&!nearStation(rc.st))return'Go to '+ST_HINT[rc.st];if(rc.ench){const w=enchCheck(rc);if(w)return w}for(const[n,q,tag]of rc.in)if(invCount(n,tag)<q)return'Not enough '+(tag?TAG_N[tag]:n);if(rc.gear&&P.inv.indexOf(null)<0)return'Your bag is full';return''}
function startCraft(rc,times=1){if(ME.mounted)dismount();if(ACT.cur||ME.cast||ME.dead)return;const why=canCraft(rc);if(why)return toast(why);if(!useEnergy(rc.gear?2:1))return;needToolClips();
  if(rc.st){const s=STATIONS.filter(s=>s.k===rc.st).sort((a,b)=>Math.hypot(a.x-ME.pos.x,a.z-ME.pos.z)-Math.hypot(b.x-ME.pos.x,b.z-ME.pos.z))[0];if(s)faceTo(s.x,s.z)}
  ACT.cur={k:'craft',rc,t:0,dur:Math.max(1,rc.t-lifeOf(rc.sk).lv*.015),left:times-1,anim:CRAFT_ANIM[rc.sk]||'grind',fx:.5,lbl:(rc.gear?'Crafting ':'Making ')+rc.out+'…'};$('#castbar').hidden=false}
/* gecrafte uitrusting: meestal groen, soms blauw, zelden paars (meesterwerk); hoger ambacht dan het recept vereist = betere kansen */
function craftOdds(rc){const over=Math.max(0,lifeOf(rc.sk).lv-rc.lv);return{blue:Math.min(.6,.22+over*.02),epic:Math.min(.1,.03+over*.003)}}
function craftGear(rc){const G=rc.gear,o=craftOdds(rc);const roll=Math.random();const r=roll<o.epic?3:roll<o.epic+o.blue?2:1;const cls=G.cls||P.cls;
  const it=makeGear(G.slot,G.il,r,cls);if(G.wt){it.wt=G.wt;it.spd=CLASSES[cls].spd}const sf=(it.n.match(/\s((?:of|van) .+)$/)||[])[1];
  it.n=(r>=3?'Masterwork ':'')+rc.out+(r>=2&&sf?' '+sf:'');it.crafted=P.name;it.req=Math.max(1,G.il-1);it.price=Math.round(it.price*1.1);return it}
function finishCraft(rc){const why=canCraft(rc);if(why){toast(why);return false}for(const[n,q,tag]of rc.in)invTake(n,tag,q);const L=lifeOf(rc.sk);
  if(rc.ench){applyEnchant(rc);return true}
  if(rc.gear){const it=craftGear(rc);addItem(it);log('You craft: <span style="color:'+rarCol(it)+'">['+esc(it.n)+']</span>','loot',true);floatText('me',it.n,it.r>=3?'gold':'heal');
    if(it.r>=3){banner('Masterwork!',it.n);lvlFx(ME.pos.x,ME.pos.y,ME.pos.z)}questEvent('craft','gear'+(rc.gear.tier+1),1);questEvent('craft',rc.id,1);lifeXp(rc.sk,[60,110,160,220][rc.gear.tier])}
  else{const q=rc.q+(Math.random()<L.lv*.012?1:0);if(rc.potion){addItem(potion(rc.potion,q));log('You make: ['+rc.out+'] x'+q,'loot')}else giveMat(rc.out,q);questEvent('craft',rc.id,1);lifeXp(rc.sk,rc.lv>=20?24:rc.lv>=8?20:15)}
  craftDoneFx(rc);sfx('loot');refreshBag();if(!$('#pLife').hidden)refreshLife();saveGame();return true}
function craftDoneFx(rc){const x=ME.pos.x+Math.sin(ME.ry)*1.1,z=ME.pos.z+Math.cos(ME.ry)*1.1,y=ME.pos.y+1;
  if(rc.gear){flash(x,y,z,rc.gear.tier===2?0xff8040:0xffe0a0,2.2);sparks(x,y,z,0xffd070,18,4,.4,.6);runeCircle(ME.pos.x,ME.pos.z,1.2,0xffd070,1)}else emitP({x,y,z,life:.4,size:.4,size1:1.6,col:0xffffff,a:.9,a1:0,cell:FXC.twirl2,must:1})}
/* tijdens het werk: deeltjes die bij het gereedschap passen */
function actFx(A){const tx=A.n?A.n.x:A.m?A.m.x:ME.pos.x+Math.sin(ME.ry)*1.1,tz=A.n?A.n.z:A.m?A.m.z:ME.pos.z+Math.cos(ME.ry)*1.1,ty=groundH(tx,tz);
  if(A.anim==='mine'){const c=NODE_COL[A.n.item]||0xffd080;sparks(tx,ty+.9,tz,c,10,4,.35,.4);puff(tx,ty+.6,tz,0x9a948a,2,.8,.7);sfx('hit')}
  else if(A.anim==='chop'){for(let i=0;i<6;i++)emitP({x:tx,y:ty+.6,z:tz,vx:FRN(-3,3),vy:FRN(2,4),vz:FRN(-3,3),grav:12,life:FRN(.4,.7),size:.25,size1:.2,col:0xd8b080,a:1,a1:.6,cell:FXC.dirt,add:false,vrot:FRN(-8,8)});sfx('hit')}
  else if(A.anim==='herb'){for(let i=0;i<4;i++)emitP({x:tx+FRN(-.3,.3),y:ty+.4,z:tz+FRN(-.3,.3),vy:FRN(.5,1.5),life:FRN(.6,1),size:.35,size1:.1,col:NODE_COL[A.n.item]||0x9ad06a,a:1,a1:0,cell:FXC.leaf??FXC.star,fade:.1})}
  else if(A.anim==='skin'){puff(tx,ty+.3,tz,0xb09070,2,.6,.6)}
  else if(A.anim==='forge'){sparks(tx,ty+1,tz,0xffb040,14,5,.35,.5);flash(tx,ty+1,tz,0xffa040,.9,.1);sfx('hit')}
  else if(A.anim==='saw'){for(let i=0;i<5;i++)emitP({x:tx,y:ty+.9,z:tz,vx:FRN(-1,1),vy:FRN(0,1),vz:FRN(-1,1),grav:4,life:FRN(.5,.9),size:.18,size1:.1,col:0xe8c890,a:1,a1:0,cell:FXC.dirt,add:false})}
  else if(A.anim==='cook'||A.anim==='brew'){const c=A.anim==='brew'?pick([0x7aff6a,0xc08aff,0x6ab8ff]):0xf0f0f0;for(let i=0;i<3;i++)emitP({x:tx+FRN(-.3,.3),y:ty+1,z:tz+FRN(-.3,.3),vy:FRN(.6,1.2),drag:.5,life:FRN(.8,1.3),size:.5,size1:1.4,col:c,a:A.anim==='brew'?.8:.35,a1:0,cell:A.anim==='brew'?FXC.soft:FXC.smoke,add:A.anim==='brew'})}
  else if(A.anim==='tan'||A.anim==='sew'||A.anim==='grind'){emitP({x:tx,y:ty+1,z:tz,life:.4,size:.3,size1:.8,col:0xfff0d0,a:.7,a1:0,cell:FXC.glint})}}
function updActivity(dt,moving){if(ACT.post&&ACT.post.t>0)ACT.post.t-=dt;updFly(dt);const A=ACT.cur;if(!A)return;
  if(moving&&!(A.k==='fish'&&A.phase==='bite')){toast('Interrupted');if(A.k==='fish')endFish();ACT.cur=null;$('#castbar').hidden=true;return}
  A.t+=dt;if(A.fx!=null){A.fx-=dt;if(A.fx<=0){A.fx=A.anim==='mine'?1.24:A.anim==='chop'?.66:A.anim==='forge'?.9:.7;actFx(A)}}
  if(A.k==='gather'){setBar($('#castbar'),A.t,A.dur,A.lbl);if(A.t>=A.dur){ACT.cur=null;$('#castbar').hidden=true;finishGather(A.n,A.sk)}}
  else if(A.k==='skin'){setBar($('#castbar'),A.t,A.dur,A.lbl);if(A.t>=A.dur){ACT.cur=null;$('#castbar').hidden=true;finishSkin(A.m)}}
  else if(A.k==='craft'){setBar($('#castbar'),A.t,A.dur,A.lbl+(A.left?' ('+(A.left+1)+')':''));if(A.t>=A.dur){const rc=A.rc,left=A.left;ACT.cur=null;$('#castbar').hidden=true;if(finishCraft(rc)&&left>0&&!canCraft(rc)&&useEnergy(rc.gear?2:1)){ACT.cur={...A,t:0,left:left-1};$('#castbar').hidden=false}}}
  else if(A.k==='fish'){const now=performance.now();
    if(A.phase==='cast'){setBar($('#castbar'),A.t,1.5,A.lbl);if(A.t>=1.5){A.phase='wait';A.t=0;A.anim='fishidle';bobber.visible=true;fishLine.visible=true;ringFx(A.bx,A.bz,1.5,0xffffff,.6,-.7);sfx('swing')}}
    else if(A.phase==='wait'){bobber.position.y=-.62+Math.sin(now*.004)*.03;setBar($('#castbar'),A.t,A.wait,'Waiting for a bite…');$('#castbar').hidden=false;if(A.t>=A.wait){$('#castbar').hidden=true;fishBite()}}
    else{bobber.position.y=-.62+Math.sin(now*.03)*.08;A.m+=A.dir*dt*(1.1+A.t*.25);if(A.m>1){A.m=1;A.dir=-1}if(A.m<0){A.m=0;A.dir=1}$('#fishMark').style.left=(A.m*100)+'%';if(A.t>3.2){endFish();log('The fish got away…','err')}}
    if(fishLine&&fishLine.visible){const tip=rodTip();const p=fishLine.geometry.attributes.position;p.setXYZ(0,tip.x,tip.y,tip.z);p.setXYZ(1,bobber.position.x,bobber.position.y+.05,bobber.position.z);p.needsUpdate=true}}}
const _tip=new THREE.Vector3();
function rodTip(){const t=ME.rig&&ME.rig.tool;if(t){t.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(t);_tip.set((b.min.x+b.max.x)/2,b.max.y,(b.min.z+b.max.z)/2);return _tip}return _tip.set(ME.pos.x+Math.sin(ME.ry)*1.6,ME.pos.y+2.6,ME.pos.z+Math.cos(ME.ry)*1.6)}
function updNodes(dt){const cx=camTarget.x,cz=camTarget.z;for(const n of NODES){if(n.down){n.downT-=dt;if(n.downT<=0)n.down=0}
  /* verzamelpunten ver weg niet tekenen */const vis=!n.down&&Math.abs(n.x-cx)<85&&Math.abs(n.z-cz)<85;if(n.g.visible!==vis)n.g.visible=vis}}
/* ---- food & elixirs ---- */
function useConsumable(i){const it=P.inv[i];if(!it)return;const M=MATS[it.n]||{};const slot=M.food?'food':M.elixir?'elixir':null;if(!slot)return;P.buffs=P.buffs||{};const f=M[slot];P.buffs[slot]={n:it.n,until:Date.now()+f.dur*1000};if(--it.q<=0)P.inv[i]=null;
  const fr=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*fr);log((slot==='food'?'You eat ':'You drink ')+it.n+': '+f.d+' for '+Math.round(f.dur/60)+' minutes.','sys');burst(ME.pos.x,ME.pos.y+1,ME.pos.z,slot==='food'?0xffc070:0xff6a4a,20,2.5);sfx('loot');refreshBag();refreshBuffs();saveGame()}
function refreshBuffs(){const el=$('#buffs');if(!el||!P)return;const now=Date.now();let h='';for(const k of['food','elixir']){const b=P.buffs&&P.buffs[k];if(!b||b.until<now)continue;const M=MATS[b.n];if(!M||!M[k])continue;h+='<span class="buff '+k+'" title="'+esc(b.n+': '+M[k].d)+'">'+esc(b.n)+' · '+Math.ceil((b.until-now)/60000)+'m</span>'}el.innerHTML=h}
/* ---- 3D item icons: rendered once from the downloaded models ---- */
const MICON=new Map();let _micBusy=false;const _micQ=[];
function modelIcon(key,cv,ic,sz){let e=MICON.get(key);if(!e){e={img:null,wait:[]};MICON.set(key,e);_micQ.push(key);micRun()}if(e.img)return e.img;e.wait.push([cv,ic,sz]);return null}
async function micRun(){if(_micBusy)return;_micBusy=true;while(_micQ.length){const key=_micQ.shift();const e=MICON.get(key);const[name,tint]=key.slice(2).split('|');const g=await loadEnv(name);if(!g){e.img=false;continue}
    try{e.img=renderModelIcon(g,tint)}catch(err){e.img=false}const w=e.wait;e.wait=[];for(const[cv,ic,sz]of w)if(cv.isConnected||cv.parentNode)drawIcon(cv,ic,sz)}_micBusy=false}
let _micRT=null,_micScene=null,_micCam=null;
function renderModelIcon(g,tint){const S=96;if(!_micRT){_micRT=new THREE.WebGLRenderTarget(S,S);_micScene=new THREE.Scene();_micScene.add(new THREE.HemisphereLight(0xffffff,0x6a5a4a,2.2));const d=new THREE.DirectionalLight(0xffffff,2.4);d.position.set(2,4,3);_micScene.add(d);_micCam=new THREE.PerspectiveCamera(30,1,.01,100)}
  const o=envClone(g);if(tint){const set=tint[0]==='=';const c=new THREE.Color(set?tint.slice(1):tint);o.traverse(x=>{if(x.isMesh){x.material=x.material.clone();if(set)x.material.color.copy(c);else x.material.color.multiply(c);x.material.gradientMap=null}})}
  const sz=o.userData.size;const r=Math.max(sz[0],sz[1],sz[2]);o.scale.setScalar(1/r);o.rotation.y=-.6;_micScene.add(o);const h=sz[1]/r;
  _micCam.position.set(1.15,.55+h*.6,1.55);_micCam.lookAt(0,h*.45,0);
  const prevRT=renderer.getRenderTarget(),pc=renderer.getClearColor(new THREE.Color()),pa=renderer.getClearAlpha(),sh=renderer.shadowMap.enabled;renderer.shadowMap.enabled=false;
  renderer.setRenderTarget(_micRT);renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(_micScene,_micCam);const buf=new Uint8Array(S*S*4);renderer.readRenderTargetPixels(_micRT,0,0,S,S,buf);
  renderer.setRenderTarget(prevRT);renderer.setClearColor(pc,pa);renderer.shadowMap.enabled=sh;_micScene.remove(o);
  const cv=document.createElement('canvas');cv.width=cv.height=S;const cx=cv.getContext('2d');const im=cx.createImageData(S,S);
  const gm=v=>Math.round(255*Math.pow(v/255,1/2.2));for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=((S-1-y)*S+x)*4,j=(y*S+x)*4;im.data[j]=gm(buf[i]);im.data[j+1]=gm(buf[i+1]);im.data[j+2]=gm(buf[i+2]);im.data[j+3]=buf[i+3]}
  cx.putImageData(im,0,0);return cv}

/* ---- crafting book (K) ---- */
let lifeTab='smithing',lifeOpen={};
const TIER_N=['Tier I · Novice','Tier II · Expert','Tier III · Artisan','Tier IV · Grandmaster'];
const SLOT_EN={wapen:'Weapon',hoofd:'Head',borst:'Chest',handen:'Hands',benen:'Legs',voeten:'Feet',ring:'Finger'};
function recipeRow(rc){const why=canCraft(rc);const lockedLv=lifeOf(rc.sk).lv<rc.lv;
  const ins=rc.in.map(([n,q,tag])=>{const have=invCount(n,tag);return'<span class="'+(have>=q?'ok':'no')+'">'+q+'× '+esc(tag?{wood:'any wood',herb:'any herb',fish:'any fish',ore:'any ore'}[tag]:n)+' ('+have+')</span>'}).join(' ');
  let info='';if(rc.gear){const o=craftOdds(rc);info='<div class="ins gi">'+SLOT_EN[rc.gear.slot]+' · item level '+rc.gear.il+' · <span style="color:'+RARITY[1].c+'">Uncommon</span>, <span style="color:'+RARITY[2].c+'">'+Math.round(o.blue*100)+'% Rare</span>, <span style="color:'+RARITY[3].c+'">'+Math.round(o.epic*100)+'% Masterwork</span></div>'}
  else if(rc.ench){const E=ENCH[rc.ench],cur=P.eq[E.slot];const ce=cur&&cur.ench&&ENCH[cur.ench];info='<div class="ins ok">'+esc(E.txt)+(E.type?' · <span style="color:#'+new THREE.Color(ENCH_TYPES[E.type].col).getHexString()+'">glowing '+ENCH_TYPES[E.type].n.toLowerCase()+' aura</span>':'')+'</div><div class="ins gi">'+(cur?'Your '+esc(cur.n)+(ce?' · now: '+esc(ce.n):' · not enchanted'):'Nothing equipped in this slot')+'</div>'}
  else{const M=MATS[rc.out];if(M&&(M.food||M.elixir))info='<div class="ins ok">'+(M.food||M.elixir).d+'</div>'}
  const ic=rc.gear?'g:'+rc.id:rc.ench?'e:'+rc.ench:'o:'+rc.out;
  return'<div class="rc'+(lockedLv?' lock':'')+'"><canvas data-ri="'+esc(ic)+'" width="48" height="48"></canvas><div class="rci"><b'+(rc.gear?' style="color:'+RARITY[1].c+'"':'')+'>'+esc(rc.out)+(rc.q>1?' ×'+rc.q:'')+'</b>'+(rc.lv?' <small>'+rankOf(rc.lv)+'</small>':'')+'<div class="ins">'+ins+'</div>'+info+'</div><div class="rcb"><button class="btn" data-c="'+rc.id+'" data-n="1"'+(why?' disabled title="'+esc(why)+'"':'')+'>'+(rc.ench?'Enchant':'Make')+'</button>'+(rc.gear||rc.ench?'':'<button class="btn alt" data-c="'+rc.id+'" data-n="10"'+(why?' disabled':'')+'>×10</button>')+'</div></div>'}
function refreshLife(){if(!P)return;energyTick();migrateLife();const b=$('#lifeBody');if(!LIFE[lifeTab])lifeTab='smithing';
  let h='<div class="bar enb" id="enBar" style="height:20px"><i style="transform:scaleX('+clamp((P.energy??100)/maxEnergy(),0,1)+')"></i><span>Energy '+Math.floor(P.energy??100)+' / '+maxEnergy()+'</span></div><div class="lwrap"><div class="lside">';
  for(const kind of['gather','craft']){h+='<div class="lgrp">'+(kind==='gather'?'Gathering':'Crafting')+'</div>';for(const k in LIFE){if(LIFE[k].kind!==kind)continue;const L=lifeOf(k);
    h+='<button class="lsk'+(k===lifeTab?' sel':'')+'" data-t="'+k+'"><canvas data-ic="'+LIFE[k].ic+'" width="40" height="40"></canvas><div><b>'+LIFE[k].n+'</b><small>'+rankOf(L.lv)+'</small><div class="bar" style="--c1:#b6ff8a;--c2:#3a8a2a;height:6px"><i style="transform:scaleX('+clamp(L.xp/lifeNeed(L.lv),0,1)+')"></i><span></span></div></div></button>'}}
  h+='</div><div class="lmain"><h4>'+LIFE[lifeTab].n+'</h4><p class="lhint">'+LIFE[lifeTab].d+'</p>';
  const T=LIFE[lifeTab];if(T.st&&!nearStation(T.st))h+='<p class="lhint warn">Crafting needs '+ST_HINT[T.st]+'.</p>';
  if(lifeTab==='mining')h+='<p class="lhint">Iron veins around the mines and hills · Silver veins (Expert) in the Ashen Hills and Bone Hills · Emberstone (Artisan) in the Dragon Realm.</p>';
  if(lifeTab==='woodcutting')h+='<p class="lhint">Fallen trunks in Twilight Wood and near the lake · Ashwood trunks (Artisan) in the Dragon Realm. Saw planks at the sawmill.</p>';
  if(lifeTab==='herbalism')h+='<p class="lhint">Sunleaf in the fields · Moonbloom and Bloodroot in the woods · Flax near the farmlands · Fireblossom (Artisan) in the Dragon Realm.</p>';
  if(lifeTab==='skinning')h+='<p class="lhint">Loot a beast first, then press F on its body. Boars and wolves give Rough Hide (wolves sometimes Thick Hide), spiders Spider Silk, fire bats Thick Hide and drakes Drake Scales.</p>';
  if(lifeTab==='fishing')h+='<p class="lhint">Stand on the shore of Mirror Lake and press F. Strike when the marker is inside the green zone.</p>';
  if(lifeTab==='enchanting')h+='<p class="lhint">Disenchant gear you do not need: open your bag, click an item and choose Disenchant. Common and uncommon gear gives Arcane Dust, rare gear Glimmering Essence, epic and legendary gear Radiant Shards. One enchantment per item; a new one replaces the old.</p>';
  const list=RECIPES.filter(r=>r.sk===lifeTab&&!(r.gear&&(r.gear.cls==='paladijn')!==(P.cls==='paladijn')&&(r.gear.cls==='paladijn'||r.gear.cls==='krijger')));/* smiths see the plate of their own kind: paladins the paladin set, everyone else the warrior set */const proc=list.filter(r=>!r.gear&&!r.ench),gear=list.filter(r=>r.gear),ench=list.filter(r=>r.ench);
  if(proc.length){h+='<div class="lrec">';for(const rc of proc)h+=recipeRow(rc);h+='</div>'}
  for(const[k,lbl,f]of[['w','Weapon enchantments (with aura)',r=>ENCH[r.ench].slot==='wapen'],['a','Armour enchantments',r=>ENCH[r.ench].slot!=='wapen']]){const G=ench.filter(f);if(!G.length)continue;const key=lifeTab+k;const open=lifeOpen[key]??true;
    h+='<button class="ltier'+(open?' open':'')+'" data-tier="'+key+'">'+lbl+'</button>';if(open){h+='<div class="lrec">';for(const rc of G.sort((a,b)=>a.lv-b.lv))h+=recipeRow(rc);h+='</div>'}}
  if(gear.length){for(let t=0;t<4;t++){const G=gear.filter(r=>r.gear.tier===t);if(!G.length)continue;const k=lifeTab+t;const open=lifeOpen[k]??(lifeOf(lifeTab).lv>=G[0].lv-2||t===0);
    h+='<button class="ltier'+(open?' open':'')+'" data-tier="'+k+'">'+TIER_N[t]+' <small>from '+rankOf(Math.min(...G.map(r=>r.lv)))+'</small></button>';if(open){h+='<div class="lrec">';for(const rc of G)h+=recipeRow(rc);h+='</div>'}}}
  h+='</div></div>';b.innerHTML=h;
  b.querySelectorAll('canvas[data-ic]').forEach(c=>drawIcon(c,[c.dataset.ic,'#4a5a3a','#1a2410'],40));
  b.querySelectorAll('canvas[data-ri]').forEach(c=>{const v=c.dataset.ri;if(v.startsWith('e:')){drawIcon(c,enchIcon(v.slice(2)),48);return}if(v.startsWith('g:')){const rc=RECIPES.find(r=>r.id===v.slice(2));const G=rc.gear;drawIcon(c,[G.slot==='wapen'?G.wt:G.slot,'#3a8a3a','#0c240c'],48)}else{const n=v.slice(2);drawIcon(c,itemIcon(n==='Healing Potion'?potion('heal'):n==='Power Potion'?potion('mana'):matItem(n)),48)}});
  b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{lifeTab=x.dataset.t;refreshLife()});
  b.querySelectorAll('[data-tier]').forEach(x=>x.onclick=()=>{lifeOpen[x.dataset.tier]=!x.classList.contains('open');refreshLife()});
  b.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{const rc=RECIPES.find(r=>r.id===x.dataset.c);startCraft(rc,+x.dataset.n)})}
