/* ===================== Admin panel =====================
   Opened with "/admin <password>" in the chat (afterwards "/admin" alone works in the same browser). Only a salted
   SHA-256 hash of the password is in the code. Everything here changes your own character (saved locally), and the
   cheats only last for this session. */
const ADM_HASH='d9b1fa67fd1dfa129e120020305ca4ff2f1d6bbbc1abdf6ff1a7a2c79a0fd2f9';
const ADM_KEY='velmora-adm';
let ADM_TAB='char';
async function admHash(pw){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('velmora-admin:'+pw));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function adminCmd(arg){arg=(arg||'').trim();let ok=false;
  try{if(arg){ok=(await admHash(arg))===ADM_HASH;if(ok)localStorage.setItem(ADM_KEY,ADM_HASH)}else ok=localStorage.getItem(ADM_KEY)===ADM_HASH}catch(e){}
  if(arg==='off'){try{localStorage.removeItem(ADM_KEY)}catch(e){}closePanel('pAdmin');return log('Admin: this browser no longer remembers the password.','sys')}
  if(!ok)return log('Unknown command. Type /help for the list.','err');
  S.admin=true;openPanel('pAdmin');renderAdmin()}
/* small helpers */
const LIFE_MAXLV=()=>RANKS.length*10-1;
const admNum=(id,min,max)=>{const v=Math.round(+$('#'+id).value);return clamp(isFinite(v)?v:min,min,max)};
function admDone(msg){log('Admin: '+msg,'sys');sfx('loot');calcStats();P.hp=Math.min(P.hp,ST.maxhp);P.mp=Math.min(P.mp,ST.maxmp);buildBar(true);refreshBag();talentDot();refreshTracker();refreshNpcMarks();
  if(!$('#pChar').hidden)refreshChar();if(!$('#pTalent').hidden)refreshTalent();if(!$('#pLife').hidden)refreshLife();saveGame(true);renderAdmin()}
function admRow(label,inner){return'<div class="arow"><label>'+label+'</label><div class="actl">'+inner+'</div></div>'}
const admBtn=(id,t,alt)=>'<button class="btn'+(alt?' alt':'')+'" id="'+id+'">'+t+'</button>';
const admIn=(id,v,min,max)=>'<input type="number" id="'+id+'" value="'+v+'" min="'+min+'" max="'+max+'">';
const admSel=(id,opts,v)=>'<select id="'+id+'">'+opts.map(([k,t])=>'<option value="'+k+'"'+(String(k)===String(v)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
const ADM_TP=[['Silverbrook square',0,8],['Arena',ARENA.x-4,ARENA.z+22],["Artisans' Yard",CRAFT.x+6,CRAFT.z+6],['Stables',STABLE.x,STABLE.z-9],['Farm',FARM.x,FARM.z-8],['Mirror Lake',LAKE.x+LAKE.r+4,LAKE.z],
  ['Bandit Camp',CAMP.x,CAMP.z+30],['Crypt entrance',CRYPT.x,CRYPT.z+8],['Crypt (inside)','dun'],['Fire Cave entrance',CAVE.x,CAVE.z+9],["Ignaroth's Fire Cave (inside)",'cave'],['Dragon Realm','drk'],['WindStorm (Elvia)',WS.x,WS.z+WS.plaza+8],['Woods of Elvia gate',ELV_ENTRY.x,ELV_ENTRY.z],['Silverfalls (Elvia)',ELV.x-100,ELV.z-150],['Volcano (Vyraxion)','volc'],['Thornroot Hollow gate',HOLLOW.x,HOLLOW.z-10],['Thornroot Hollow (inside)','hollow']];
function renderAdmin(){const b=$('#admBody');if(!b||!P)return;
  $('#admTabs').innerHTML=[['char','Character'],['items','Items'],['life','Skills & quests'],['cheat','Cheats']].map(([k,t])=>'<button class="'+(ADM_TAB===k?'on':'')+'" data-t="'+k+'">'+t+'</button>').join('');
  $('#admTabs').querySelectorAll('button').forEach(x=>x.onclick=()=>{ADM_TAB=x.dataset.t;renderAdmin()});
  let h='';
  if(ADM_TAB==='char'){h+=admRow('Level (1–'+MAXLVL+')',admIn('aLvl',P.level,1,MAXLVL)+admBtn('aLvlB','Set'));
    h+=admRow('Experience',admIn('aXp',P.level>=MAXLVL?0:P.xp,0,99999)+'<small>/ '+xpNeed(P.level)+'</small>'+admBtn('aXpB','Set')+admBtn('aXpL','Level up',1));
    h+=admRow('Gold',admIn('aGold',P.gold,0,9999999)+admBtn('aGoldB','Set'));
    h+=admRow('Talent points','<small>'+talentFree()+' free · '+talentSpent()+' spent · '+(P.bonusTP|0)+' bonus</small>'+admIn('aTp',P.bonusTP|0,0,99)+admBtn('aTpB','Set bonus')+admBtn('aTpR','Reset talents (free)',1));
    h+=admRow('Honour (PvP)',admIn('aHon',P.honor|0,0,999999)+admBtn('aHonB','Set'));
    h+=admRow('Monsters defeated',admIn('aKills',P.kills|0,0,9999999)+admBtn('aKillsB','Set'))}
  else if(ADM_TAB==='items'){const SL=SLOTS.map(s=>[s,SLOT_NL[s]]);
    h+=admRow('New gear',admSel('aSlot',SL,'wapen')+admIn('aIl',P.level,1,30)+admSel('aRar',RARITY.map((r,i)=>[i,r.n]),3)+admBtn('aGear','Create'));
    /* weapons: pick the kind, one-handed or two-handed */h+=admRow('Weapon kind','<small>for Main Hand</small>'+admSel('aWt',[['','Any'],...WEAP[P.cls].map((w,i)=>[String(i),w[0]+' · '+(TWO_HAND.has(w[1])?'Two-Hand':'One-Hand')])],''));
    h+=admRow('Potions',admIn('aPq',10,1,99)+admBtn('aPh','Healing')+admBtn('aPm','Power',1));
    h+=admRow('Materials',admSel('aMat',Object.keys(MATS).map(k=>[k,k]),'Iron Bar')+admIn('aMq',20,1,99)+admBtn('aMatB','Give'));
    ensureMounts();h+=admRow('Mounts','<small>'+P.mounts.length+' / '+Object.keys(MOUNTS).length+' owned</small>'+admBtn('aMntAll','Unlock all')+admBtn('aMntNone','Back to horse only',1));
    h+=admRow('Bag','<small>'+P.inv.filter(Boolean).length+' / '+P.inv.length+' slots used</small>'+admBtn('aBagJ','Remove junk',1)+admBtn('aBagC','Empty bag',1))}
  else if(ADM_TAB==='life'){h+='<div class="agrid">'+Object.keys(LIFE).map(k=>'<label>'+LIFE[k].n+'<small>'+rankOf(lifeOf(k).lv)+'</small>'+admIn('aL_'+k,lifeOf(k).lv,0,LIFE_MAXLV())+'</label>').join('')+'</div>';
    h+='<div class="row">'+admBtn('aLifeB','Save skill levels')+admBtn('aLifeMax','All to '+RANKS[RANKS.length-1]+' (max)',1)+'</div><h4>House</h4><div class="row">'+admBtn('aHouse',P.house?'Upgrade house to Manor':'Give a house deed (Manor)')+admBtn('aFurn','All furniture ×5',1)+admBtn('aTroph','All trophy statues',1)+'</div><h4>Body (beta)</h4><div class="row">'+admBtn('aBody',P.bd==='rpg'?'Back to classic body':'Heroic body')+(P.bd==='rpg'?admBtn('aBodyM','Other model ('+(RPG_CLS[P.cls]||RPG_CLS.krijger).find(m=>m!==rpgModelFor(P))+')',1):'')+'</div><h4>Quests</h4><div class="aq">';
    for(const q of QUESTS){const s=qState(q);h+='<div><span><b>'+esc(q.n)+'</b> <small>lvl '+q.lvl+' · '+esc(npcName(q.giver))+' · '+s+'</small></span>'+(s==='done'?'<button class="btn alt" data-qr="'+q.id+'">Reset</button>':'<button class="btn" data-qc="'+q.id+'">Complete</button>')+'</div>'}
    h+='</div><div class="row">'+admBtn('aQAll','Complete all',1)+admBtn('aQNone','Reset all',1)+'</div>'}
  else{h+=admRow('God mode',admBtn('aGod',S.god?'On':'Off',!S.god)+'<small>no damage, endless health and resource</small>');
    h+=admRow('Speed',admSel('aSpd',[[1,'Normal'],[1.5,'1.5×'],[2,'2×'],[3,'3×'],[5,'5×']],S.admSpd||1)+'<small>on top of mounts</small>');
    h+=admRow('No cooldowns',admBtn('aNoCd',S.noCd?'On':'Off',!S.noCd)+'<small>abilities are ready again at once</small>');
    h+=admRow('Health',admBtn('aHeal','Full heal')+admBtn('aRes','Resurrect',1));
    h+=admRow('Target',admBtn('aKill','Defeat target')+'<small>'+(ME.target&&ME.target.kind==='mon'?esc(ME.target.t.n||''):'no monster targeted')+'</small>');
    h+='<h4>Teleport</h4><div class="atp">'+ADM_TP.map((t,i)=>'<button class="btn alt" data-tp="'+i+'">'+esc(t[0])+'</button>').join('')+'</div>'}
  b.innerHTML=h;const on=(id,fn)=>{const e=$('#'+id);if(e)e.onclick=fn};
  /* character */
  on('aLvlB',()=>{const v=admNum('aLvl',1,MAXLVL);P.level=v;P.xp=0;if(talentSpent()>talentPoints()){P.talents={};TMC=null;log('Admin: talents were reset because the new level has fewer points.','sys')}calcStats();P.hp=ST.maxhp;P.mp=ST.maxmp;buildBar(true);lvlFx(ME.pos.x,ME.pos.y,ME.pos.z);admDone('level set to '+v+'.')});
  on('aXpB',()=>{P.xp=admNum('aXp',0,xpNeed(P.level)-1);admDone('experience set.')});
  on('aXpL',()=>{if(P.level>=MAXLVL)return toast('Already at the maximum level');gainXp(Math.max(1,Math.ceil((xpNeed(P.level)-P.xp)/(RACES[P.race].xp||1))));admDone('level up!')});
  on('aGoldB',()=>{P.gold=admNum('aGold',0,9999999);admDone('gold set to '+P.gold+'.')});
  on('aTpB',()=>{P.bonusTP=admNum('aTp',0,99);if(talentSpent()>talentPoints()){P.talents={};TMC=null}admDone('bonus talent points: '+P.bonusTP+'.')});
  on('aTpR',()=>{P.talents={};TMC=null;admDone('talents reset.')});
  on('aHonB',()=>{P.honor=admNum('aHon',0,999999);refreshPvpUi&&refreshPvpUi();admDone('honour set.')});
  on('aKillsB',()=>{P.kills=admNum('aKills',0,9999999);admDone('kills set.')});
  /* items */
  on('aGear',()=>{const s=$('#aSlot').value,r=+$('#aRar').value,il=admNum('aIl',1,60);const wk=$('#aWt')?$('#aWt').value:'';const it=s==='wapen'&&wk!==''?admWeapon(+wk,il,r):s==='schouders'?makeShoulders(P.cls,clamp(r,1,4)):s==='rug'?makeCloak(P.cls,clamp(r,0,4)):s==='hoofd'&&r>=1?makeHelm(P.cls,clamp(r,1,4)):r>=4?makeLegendary(P.cls,s):makeGear(s,il,r,P.cls);if(r>=4){it.il=Math.max(it.il||1,il);it.req=1}else it.req=1;
    if(!addItem(it))return toast('Your bag is full');log('Admin: <span style="color:'+rarCol(it)+'">['+esc(it.n)+']</span> created.','loot',true);admDone('item in your bag.')});
  on('aPh',()=>{if(!addItem(potion('heal',admNum('aPq',1,99))))return toast('Your bag is full');admDone('healing potions added.')});
  on('aPm',()=>{if(!addItem(potion('mana',admNum('aPq',1,99))))return toast('Your bag is full');admDone('power potions added.')});
  on('aMatB',()=>{if(giveMat($('#aMat').value,admNum('aMq',1,99)))admDone('materials added.')});
  on('aMntAll',()=>{ensureMounts();for(const id in MOUNTS)if(!P.mounts.includes(id))P.mounts.push(id);admDone('all mounts unlocked.')});
  on('aMntNone',()=>{if(ME.mounted)dismount();P.mounts=['horse'];P.mountSel='horse';admDone('only the brown horse is left.')});
  on('aBagJ',()=>{P.inv=P.inv.map(x=>x&&x.kind==='junk'?null:x);admDone('junk removed.')});
  on('aBagC',()=>{if(!confirmTwice('aBagC'))return;P.inv=P.inv.map(()=>null);admDone('bag emptied.')});
  /* life skills and quests */
  on('aLifeB',()=>{for(const k in LIFE){const L=lifeOf(k);L.lv=admNum('aL_'+k,0,LIFE_MAXLV());L.xp=0}admDone('skill levels saved.')});
  on('aLifeMax',()=>{for(const k in LIFE){const L=lifeOf(k);L.lv=LIFE_MAXLV();L.xp=0}admDone('every skill is '+RANKS[RANKS.length-1]+' 10.')});
  on('aHouse',()=>{houseInit();if(P.house){P.house.t=2;if(P.house.placed){houseRemove('me');houseSync('me',houseRecMine())}}else P.house={t:2,c:'blue',placed:0,x:0,z:0,ry:0,items:[]};lastPres='';admDone(P.house.placed?'your house is now a Manor.':'you own a Manor deed: press H to build it.')});
  on('aBody',()=>{if(P.bd==='rpg')delete P.bd;else{P.bd='rpg';P.rm=rpgModelFor(P)}rebuildMe();renderAdmin();admDone(P.bd?'you now have the heroic body ('+rpgModelFor(P)+').':'back to the classic body.')});
  on('aBodyM',()=>{const L=RPG_CLS[P.cls]||RPG_CLS.krijger;P.rm=L.find(m=>m!==rpgModelFor(P));rebuildMe();renderAdmin();admDone('model: '+P.rm+'.')});
  on('aFurn',()=>{houseInit();for(const k in FURN)P.furn[k]=(P.furn[k]||0)+5;admDone('5 of every piece of furniture added to your house store.')});
  on('aTroph',()=>{houseInit();for(const t of TROPHIES)if(!P.trophies.includes(t))P.trophies.push(t);admDone('every trophy statue unlocked.')});
  const qDone=id=>{delete P.quests[id];if(!P.done.includes(id))P.done.push(id)},qReset=id=>{delete P.quests[id];P.done=P.done.filter(x=>x!==id)};
  b.querySelectorAll('[data-qc]').forEach(x=>x.onclick=()=>{qDone(x.dataset.qc);admDone('quest completed (no reward).')});
  b.querySelectorAll('[data-qr]').forEach(x=>x.onclick=()=>{qReset(x.dataset.qr);admDone('quest reset.')});
  on('aQAll',()=>{for(const q of QUESTS)qDone(q.id);admDone('all quests completed.')});
  on('aQNone',()=>{if(!confirmTwice('aQNone'))return;P.quests={};P.done=[];admDone('all quests reset.')});
  /* cheats */
  on('aGod',()=>{S.god=!S.god;admDone('god mode '+(S.god?'on':'off')+'.')});
  {const e=$('#aSpd');if(e)e.onchange=()=>{S.admSpd=+e.value;log('Admin: speed '+S.admSpd+'×.','sys')}}
  on('aNoCd',()=>{S.noCd=!S.noCd;if(S.noCd){ME.cds={};ME.gcd=0}admDone('cooldowns '+(S.noCd?'off':'normal')+'.')});
  on('aHeal',()=>{calcStats();P.hp=ST.maxhp;P.mp=ST.maxmp;healFx&&healFx(ME.pos.x,ME.pos.y,ME.pos.z);admDone('fully healed.')});
  on('aRes',()=>{if(!ME.dead)return toast('You are not dead');resurrect();P.hp=ST.maxhp;admDone('resurrected.')});
  on('aKill',()=>{const t=ME.target;if(!t||t.kind!=='mon'||t.dead)return toast('Target a monster first');dealDamage(t,t.hp*50+9999);admDone('target defeated.')});
  b.querySelectorAll('[data-tp]').forEach(x=>x.onclick=()=>{const t=ADM_TP[+x.dataset.tp];if(ME.mounted&&t[1]!==+t[1])dismount();
    if(t[1]==='dun')enterDungeon();else if(t[1]==='cave')enterCave();else if(t[1]==='drk')enterDrake();else if(t[1]==='volc')enterVolcano();else if(t[1]==='hollow')enterHollow();else teleport(t[1],t[2]);
    beamFx(ME.pos.x,ME.pos.z,0x7cf0ff,1.2);log('Admin: teleported to '+t[0]+'.','sys')})}
/* destructive buttons ask for a second click */
function confirmTwice(id){const e=$('#'+id);if(e.dataset.sure)return true;e.dataset.sure=1;e.textContent='Click again to confirm';setTimeout(()=>{if(e.isConnected){delete e.dataset.sure;renderAdmin()}},3000);return false}
/* per-frame cheat effects */
function adminFrame(){if(!S.admin||!P)return;if(S.god&&!ME.dead){P.hp=ST.maxhp;P.mp=ST.maxmp}if(S.noCd){for(const k in ME.cds)ME.cds[k]=0;ME.gcd=0}}

/* a weapon of one chosen kind (sword, axe, greatsword…): rolled until it matches, a legendary is turned into that kind */
function admWeapon(k,il,r){const[bn,wt]=WEAP[P.cls][k];const gs=bn==='Greatsword';const ok=it=>it.wt===wt&&!!it.gs===gs&&(r>=3||it.n.includes(bn));
  if(r>=4){const it=makeLegendary(P.cls,'wapen');it.wt=wt;it.gs=gs?1:0;const pw=it.pow,st=it.sta;weaponStats(it,Math.max(il,24),4,P.cls);it.pow=pw;it.sta=st;return it}
  for(let i=0;i<200;i++){const it=makeGear('wapen',il,r,P.cls);if(ok(it))return it}
  const it=makeGear('wapen',il,r,P.cls);it.wt=wt;it.gs=gs?1:0;weaponStats(it,il,r,P.cls);return it}
