
/* ===================== life skills (gathering, fishing, processing, cooking, alchemy) ===================== */
const NODES=[];
{const r=mulberry(9091);
  const place=(type,item,count,cx,cz,rad,ok)=>{for(let i=0,t=0;i<count&&t<900;t++){const a=r()*6.28,d=Math.sqrt(r())*rad,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;if(Math.abs(x)>240||Math.abs(z)>245)continue;if(pathDist(x,z)<3.5||Math.hypot(x,z)<58||Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.1||Math.hypot(x-CAMP.x,z-CAMP.z)<28||Math.hypot(x-CRYPT.x,z-CRYPT.z)<22||Math.hypot(x-CAVE.x,z-CAVE.z)<20)continue;if(ok&&!ok(x,z))continue;NODES.push({id:'n'+NODES.length,type,item,x,z});i++}};
  place('hout','Hout',12,-60,-62,90,(x,z)=>z<-50&&z>-90);place('hout','Hout',6,-130,30,45);
  place('erts','IJzererts',8,-140,-150,45);place('erts','IJzererts',7,175,-150,40);place('erts','Zilvererts',4,215,-205,30);place('erts','IJzererts',4,120,40,40);
  place('kruid','Zonnekruid',14,30,90,80,(x,z)=>!inForest(x,z));place('kruid','Zonnekruid',5,-80,20,40);
  place('kruid','Maanbloem',10,-40,-120,70,inForest);place('kruid','Bloedwortel',7,-130,-200,40,(x,z)=>inForest(x,z)||Math.hypot(x-CRYPT.x,z-CRYPT.z)<70)}
const NODE_N={hout:'Omgevallen stam',erts:'Ertsader',kruid:''};
for(const n of NODES){const g=new THREE.Group();const y=groundH(n.x,n.z);g.position.set(n.x,y,n.z);g.rotation.y=hash(n.x|0,n.z|0)*6;scene.add(g);n.g=g;n.y=y;n.kind='node';n.rig={h:.8};n.name=n.type==='kruid'?n.item:NODE_N[n.type];
  if(n.type==='hout'){const l=mesh(new THREE.CylinderGeometry(.42,.5,4.2,12),mat(0x6a4a2c,{flat:false}),0,.42,0,g);l.rotation.z=Math.PI/2;for(const s of[-1,1])mesh(new THREE.CircleGeometry(.42,12),mat(0xc8a070,{flat:false}),s*2.11,.42,0,g).rotation.y=s*Math.PI/2;const b=mesh(new THREE.CylinderGeometry(.06,.1,1.2,6),mat(0x5a3a22),.6,.9,.2,g);b.rotation.set(.5,0,.4);mesh(new THREE.SphereGeometry(.35,10,8),mat(0x5f8f36,{flat:false}),.9,1.3,.4,g);addCol(n.x,n.z,1)}
  else if(n.type==='erts'){mesh(new THREE.DodecahedronGeometry(1.1,1),mat(0x6a6660),0,.5,0,g).scale.set(1.2,.8,1);const col=n.item==='Zilvererts'?0xdfe8f2:0xc8783a;for(let i=0;i<5;i++){const c=mesh(new THREE.OctahedronGeometry(.3,0),mat(col,{m:.6,r:.25,e:col,ei:.45}),Math.cos(i*1.3)*.75,.95+Math.sin(i*2)*.25,Math.sin(i*1.3)*.65,g);c.scale.y=1.7;c.rotation.z=(i-2)*.35}addCol(n.x,n.z,1.2)}
  else{const c=n.item==='Zonnekruid'?0xffd94a:n.item==='Maanbloem'?0x7ab8ff:0xe04040;mesh(new THREE.SphereGeometry(.38,12,8,0,Math.PI*2,0,Math.PI/2),mat(0x3f7a2a,{flat:false}),0,0,0,g);for(let i=0;i<4;i++){mesh(new THREE.CylinderGeometry(.015,.015,.5,4),mat(0x3f7a2a),Math.cos(i*1.6)*.15,.35,Math.sin(i*1.6)*.15,g,false);mesh(new THREE.SphereGeometry(.08,8,6),mat(c,{e:c,ei:1.2,flat:false}),Math.cos(i*1.6)*.15,.62,Math.sin(i*1.6)*.15,g,false)}}
  g.traverse(o=>{if(o.isMesh)o.userData.ent=n});g.userData.ent=n}
function lifeOf(k){P.life=P.life||{};return P.life[k]||(P.life[k]={lv:0,xp:0})}
function lifeXp(k,n){const L=lifeOf(k);L.xp+=Math.round(n);let up=false;while(L.lv<69&&L.xp>=lifeNeed(L.lv)){L.xp-=lifeNeed(L.lv);L.lv++;up=true}if(up){log('✦ '+LIFE[k].n+': je bent nu '+rankOf(L.lv)+'!','sys');floatText('me',LIFE[k].n+' '+rankOf(L.lv),'xp');sfx('quest');if(L.lv%10===0)banner(LIFE[k].n+': '+RANKS[Math.min(6,L.lv/10)],'Nieuwe rang bereikt')}if(!$('#pLife').hidden)refreshLife()}
function energyTick(){if(!P)return;const now=Date.now();P.energyT=P.energyT||now;const gain=Math.floor((now-P.energyT)/6000);if(gain>0){P.energy=Math.min(maxEnergy(),(P.energy??100)+gain);P.energyT+=gain*6000}if(P.energy>=maxEnergy())P.energyT=now}
const maxEnergy=()=>100+Math.floor(Object.values(P.life||{}).reduce((s,l)=>s+l.lv,0)/5);
function useEnergy(n){energyTick();if((P.energy??100)<n){toast('Niet genoeg werkkracht (die laadt vanzelf weer op)');return false}P.energy-=n;return true}
function questEvent(kind,key,q=1){for(const qq of QUESTS){const st=P.quests[qq.id];if(!st||st.n>=qq.obj.n)continue;const o=qq.obj;if((kind==='gather'&&o.gather===key)||(kind==='fish'&&o.fish)||(kind==='craft'&&o.craft===key)){st.n=Math.min(o.n,st.n+q);log(o.lbl+': '+st.n+'/'+o.n,'sys');if(st.n>=o.n){log('Quest klaar: '+qq.n+' — keer terug naar '+npcName(qq.giver),'sys');sfx('quest')}refreshTracker();refreshNpcMarks()}}}
function giveMat(n,q){const it=matItem(n,q);if(!addItem(it)){toast('Je rugzak is vol');return false}log('Je ontvangt: <span style="color:'+rarCol(it)+'">['+esc(n)+']</span>'+(q>1?' x'+q:''),'loot',true);return true}
/* ---- gathering ---- */
const ACT={cur:null};
function nearNode(rad=3.6){let b=null,bd=rad;for(const n of NODES){if(n.down)continue;const d=Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z);if(d<bd){bd=d;b=n}}return b}
function startGather(n){if(ME.dead||ME.cast||ACT.cur)return;if(Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z)>3.8)return toast('Loop dichterbij');if(n.down)return toast('Hier is nu niets meer te halen');if(!useEnergy(1))return;
  const L=lifeOf('verzamelen');const dur=Math.max(1.2,3.2-L.lv*.03);faceTo(n.x,n.z);ACT.cur={k:'gather',n,t:0,dur,lbl:n.type==='hout'?'Hout hakken…':n.type==='erts'?'Erts delven…':'Kruiden plukken…',sw:0};$('#castbar').hidden=false}
function finishGather(n){const L=lifeOf('verzamelen');let q=1+(Math.random()<.25+L.lv*.012?1:0);const got=[[n.item,q]];
  if(n.type==='hout'&&Math.random()<.06+L.lv*.004)got.push(['Stevig hout',1]);if(n.type==='erts'&&n.item==='IJzererts'&&Math.random()<.08+L.lv*.004)got.push(['Zilvererts',1]);if(n.type==='kruid'&&Math.random()<.05+L.lv*.003)got.push([pick(['Maanbloem','Bloedwortel']),1]);
  for(const[it,qq]of got){if(giveMat(it,qq))questEvent('gather',it,qq)}lifeXp('verzamelen',12);n.down=1;n.downT=50;n.g.visible=false;burst(n.x,n.y+.6,n.z,n.type==='kruid'?0xffe08a:0xd8c8a0,14,2.5);sfx('loot');refreshBag();saveGame()}
/* ---- fishing (timing mini-game) ---- */
function atShore(){const d=Math.hypot(ME.pos.x-LAKE.x,ME.pos.z-LAKE.z);return d<LAKE.r*1.25&&d>LAKE.r*.7}
let bobber=null;
function startFish(){if(ME.dead||ACT.cur||ME.cast)return;if(!atShore())return toast('Ga aan de oever van het Spiegelmeer staan om te vissen');if(!useEnergy(1))return;
  const a=Math.atan2(LAKE.x-ME.pos.x,LAKE.z-ME.pos.z);ME.ry=a;const bx=ME.pos.x+Math.sin(a)*7,bz=ME.pos.z+Math.cos(a)*7;
  if(!bobber){bobber=new THREE.Group();mesh(new THREE.SphereGeometry(.14,10,8),mat(0xff3030,{flat:false}),0,0,0,bobber,false);mesh(new THREE.SphereGeometry(.1,10,8),mat(0xffffff,{flat:false}),0,.1,0,bobber,false);scene.add(bobber)}
  bobber.position.set(bx,-.62,bz);bobber.visible=true;ringFx(bx,bz,1.5,0xffffff,.6,-.7);const L=lifeOf('vissen');ACT.cur={k:'fish',t:0,wait:rand(4,10)*Math.max(.45,1-L.lv*.01),phase:'wait',lbl:'Vissen…',bx,bz};swingAnim(true);log('Je werpt je lijn uit…','sys')}
function fishBite(){const A=ACT.cur;A.phase='bite';A.t=0;sfx('hit');sfx('loot');ringFx(A.bx,A.bz,2,0xffffff,.5,-.7);burst(A.bx,-.4,A.bz,0xcfefff,16,2.5);
  const L=lifeOf('vissen');A.zone=[rand(.2,.6),.2+L.lv*.003];A.m=0;A.dir=1;$('#fishBar').hidden=false;$('#fishZone').style.left=(A.zone[0]*100)+'%';$('#fishZone').style.width=(A.zone[1]*100)+'%';toast('Beet! Druk nu op F / Actie in het groene vak')}
function fishHook(){const A=ACT.cur;if(!A||A.k!=='fish'||A.phase!=='bite')return false;const[z0,w]=A.zone;const inZ=A.m>=z0&&A.m<=z0+w;const perfect=Math.abs(A.m-(z0+w/2))<w*.18;endFish();
  if(!inZ){log('De vis is ontsnapt…','err');lifeXp('vissen',4);return true}
  const L=lifeOf('vissen');const roll=FISH.map(([n,wt],i)=>[n,wt*(i>=3?(1+L.lv*.04)*(perfect?2:1):1)]);let tot=roll.reduce((s,f)=>s+f[1],0),r=Math.random()*tot,got='Baars';for(const[n,wt]of roll){if((r-=wt)<=0){got=n;break}}
  if(giveMat(got,1)){questEvent('fish',got,1);floatText('me',(perfect?'Perfect! ':'')+got,MATS[got].r>=2?'gold':'heal')}lifeXp('vissen',perfect?32:24);sfx('quest');refreshBag();saveGame();return true}
function endFish(){ACT.cur=null;$('#fishBar').hidden=true;$('#castbar').hidden=true;if(bobber)bobber.visible=false}
/* ---- crafting ---- */
function nearStation(k){return STATIONS.some(s=>s.k===k&&Math.hypot(s.x-ME.pos.x,s.z-ME.pos.z)<5)}
function invCount(name,tag){return P.inv.reduce((s,x)=>s+(x&&(x.n===name||(tag&&MATS[x.n]&&MATS[x.n].tag===tag))?(x.q||1):0),0)}
function invTake(name,tag,n){for(let i=0;i<P.inv.length&&n>0;i++){const x=P.inv[i];if(!x||!(x.n===name||(tag&&MATS[x.n]&&MATS[x.n].tag===tag)))continue;const k=Math.min(n,x.q||1);x.q=(x.q||1)-k;n-=k;if(x.q<=0)P.inv[i]=null}}
function canCraft(rc){const L=lifeOf(rc.sk);if(L.lv<rc.lv)return'Vereist '+rankOf(rc.lv);if(rc.st&&!nearStation(rc.st))return rc.st==='vuur'?'Ga naar een kookvuur':'Ga naar de alchemietafel van Mirla';for(const[n,q,tag]of rc.in)if(invCount(n,tag)<q)return'Niet genoeg '+(tag?{hout:'hout',kruid:'kruiden',vis:'vis'}[tag]:n);return''}
function startCraft(rc,times=1){if(ACT.cur||ME.cast||ME.dead)return;const why=canCraft(rc);if(why)return toast(why);if(!useEnergy(1))return;ACT.cur={k:'craft',rc,t:0,dur:Math.max(.8,rc.t-lifeOf(rc.sk).lv*.015),left:times-1,lbl:rc.out+' maken…'};$('#castbar').hidden=false}
function finishCraft(rc){const why=canCraft(rc);if(why){toast(why);return false}for(const[n,q,tag]of rc.in)invTake(n,tag,q);const L=lifeOf(rc.sk);const q=rc.q+(Math.random()<L.lv*.012?1:0);
  if(rc.potion){addItem(potion(rc.potion,q));log('Je maakt: ['+rc.out+'] x'+q,'loot')}else giveMat(rc.out,q);questEvent('craft',rc.id,1);lifeXp(rc.sk,rc.sk==='bewerken'?10:18);sfx('loot');refreshBag();if(!$('#pLife').hidden)refreshLife();saveGame();return true}
function updActivity(dt,moving){const A=ACT.cur;if(!A)return;
  if(moving&&!(A.k==='fish'&&A.phase==='bite')){toast('Onderbroken');if(A.k==='fish')endFish();ACT.cur=null;$('#castbar').hidden=true;return}
  A.t+=dt;
  if(A.k==='gather'){setBar($('#castbar'),A.t,A.dur,A.lbl);A.sw-=dt;if(A.sw<=0){A.sw=.7;if(A.n.type!=='kruid')swingAnim(false)}if(A.n.type==='kruid')ME.cast=null;if(A.t>=A.dur){ACT.cur=null;$('#castbar').hidden=true;finishGather(A.n)}}
  else if(A.k==='craft'){setBar($('#castbar'),A.t,A.dur,A.lbl+(A.left?' ('+(A.left+1)+')':''));if(A.t>=A.dur){const rc=A.rc,left=A.left;ACT.cur=null;$('#castbar').hidden=true;if(finishCraft(rc)&&left>0&&!canCraft(rc)&&useEnergy(1)){ACT.cur={...A,t:0,left:left-1};$('#castbar').hidden=false}}}
  else if(A.k==='fish'){if(bobber)bobber.position.y=-.62+Math.sin(performance.now()*.004)*.03+(A.phase==='bite'?Math.sin(performance.now()*.03)*.08:0);
    if(A.phase==='wait'){setBar($('#castbar'),A.t,A.wait,'Wachten op beet…');$('#castbar').hidden=false;if(A.t>=A.wait){$('#castbar').hidden=true;fishBite()}}
    else{A.m+=A.dir*dt*(1.1+A.t*.25);if(A.m>1){A.m=1;A.dir=-1}if(A.m<0){A.m=0;A.dir=1}$('#fishMark').style.left=(A.m*100)+'%';if(A.t>3.2){endFish();log('De vis is ontsnapt…','err')}}}}
function updNodes(dt){for(const n of NODES)if(n.down){n.downT-=dt;if(n.downT<=0){n.down=0;n.g.visible=true}}}
/* ---- food & elixirs ---- */
function useConsumable(i){const it=P.inv[i];if(!it)return;const M=MATS[it.n]||{};const slot=M.food?'food':M.elixir?'elixir':null;if(!slot)return;P.buffs=P.buffs||{};const f=M[slot];P.buffs[slot]={n:it.n,until:Date.now()+f.dur*1000};if(--it.q<=0)P.inv[i]=null;
  const fr=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*fr);log((slot==='food'?'Je eet ':'Je drinkt ')+it.n+': '+f.d+' voor '+Math.round(f.dur/60)+' minuten.','sys');burst(ME.pos.x,ME.pos.y+1,ME.pos.z,slot==='food'?0xffc070:0xff6a4a,20,2.5);sfx('loot');refreshBag();refreshBuffs();saveGame()}
function refreshBuffs(){const el=$('#buffs');if(!el||!P)return;const now=Date.now();let h='';for(const k of['food','elixir']){const b=P.buffs&&P.buffs[k];if(!b||b.until<now)continue;const M=MATS[b.n];h+='<span class="buff '+k+'" title="'+esc(b.n+': '+M[k].d)+'">'+esc(b.n)+' · '+Math.ceil((b.until-now)/60000)+'m</span>'}el.innerHTML=h}

/* ---- ambacht panel ---- */
let lifeTab='bewerken';
function refreshLife(){if(!P)return;energyTick();const b=$('#lifeBody');let h='<div class="bar enb" id="enBar" style="height:16px"><i style="transform:scaleX('+clamp((P.energy??100)/maxEnergy(),0,1)+')"></i><span>Werkkracht '+Math.floor(P.energy??100)+' / '+maxEnergy()+'</span></div><p class="lhint">Werkkracht kost 1 punt per actie en laadt vanzelf op (1 punt per 6 seconden, ook als je niet speelt).</p><div class="lskills">';
  for(const k in LIFE){const L=lifeOf(k);h+='<div class="lsk"><canvas data-ic="'+LIFE[k].ic+'" width="40" height="40"></canvas><div><b>'+LIFE[k].n+'</b> <small>'+rankOf(L.lv)+'</small><div class="bar" style="--c1:#b6ff8a;--c2:#3a8a2a;height:8px"><i style="transform:scaleX('+clamp(L.xp/lifeNeed(L.lv),0,1)+')"></i><span></span></div></div></div>'}
  h+='</div><div class="ltabs">';for(const k of['bewerken','koken','alchemie'])h+='<button class="opt'+(k===lifeTab?' sel':'')+'" data-t="'+k+'">'+LIFE[k].n+'</button>';h+='</div><div class="lrec">';
  const st=lifeTab==='koken'?'vuur':lifeTab==='alchemie'?'tafel':null;if(st&&!nearStation(st))h+='<p class="lhint" style="color:#ffb070">'+(st==='vuur'?'Koken kan bij een kookvuur: naast de fontein in Zilverbron, in het roverkamp of bij de Asbergen.':'Alchemie kan aan de alchemietafel bij Kruidenvrouw Mirla in Zilverbron.')+'</p>';
  if(lifeTab==='bewerken')h+='<p class="lhint">Bewerken kan overal. Verzamel eerst hout, erts en kruiden: loop naar een stam, ertsader of plant en druk op F.</p>';
  RECIPES.filter(r=>r.sk===lifeTab).forEach((rc,i)=>{const why=canCraft(rc);const ins=rc.in.map(([n,q,tag])=>{const have=invCount(n,tag);return'<span class="'+(have>=q?'ok':'no')+'">'+q+'× '+n+' ('+have+')</span>'}).join(' ');
    h+='<div class="rc"><canvas data-mat="'+esc(rc.out)+'" width="40" height="40"></canvas><div class="rci"><b>'+esc(rc.out)+(rc.q>1?' ×'+rc.q:'')+'</b>'+(rc.lv?' <small>vanaf '+rankOf(rc.lv)+'</small>':'')+'<div class="ins">'+ins+'</div>'+(MATS[rc.out]&&(MATS[rc.out].food||MATS[rc.out].elixir)?'<div class="ins ok">'+(MATS[rc.out].food||MATS[rc.out].elixir).d+'</div>':'')+'</div><div class="rcb"><button class="btn" data-c="'+rc.id+'" data-n="1"'+(why?' disabled title="'+esc(why)+'"':'')+'>Maak</button><button class="btn alt" data-c="'+rc.id+'" data-n="10"'+(why?' disabled':'')+'>×10</button></div></div>'});
  h+='</div>';b.innerHTML=h;
  b.querySelectorAll('canvas[data-ic]').forEach(c=>drawIcon(c,[c.dataset.ic,'#d8e8c8','#2a3a1a'],40));b.querySelectorAll('canvas[data-mat]').forEach(c=>{const n=c.dataset.mat;drawIcon(c,itemIcon(n==='Genezend drankje'?potion('heal'):n==='Krachtdrankje'?potion('mana'):matItem(n)),40)});
  b.querySelectorAll('[data-t]').forEach(x=>x.onclick=()=>{lifeTab=x.dataset.t;refreshLife()});
  b.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{const rc=RECIPES.find(r=>r.id===x.dataset.c);startCraft(rc,+x.dataset.n)})}
