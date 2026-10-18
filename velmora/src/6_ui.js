
/* ===================== UI ===================== */
const logEl=$('#log');
function log(t,cls='sys',raw=false){if(isTouch){const f=$('#feed');if(f){const e=document.createElement('div');e.className='c-'+cls;e.innerHTML=raw?t:esc(t);f.appendChild(e);setTimeout(()=>e.classList.add('old'),4200);setTimeout(()=>e.remove(),5200);while(f.children.length>3)f.firstChild.remove()}}const d=document.createElement('div');d.className='c-'+cls;d.innerHTML=raw?t:esc(t);logEl.appendChild(d);setTimeout(()=>d.classList.add('old'),30000);while(logEl.children.length>70)logEl.firstChild.remove();if($('#chat').classList.contains('open'))logEl.scrollTop=1e9}
let bannerT=0;function banner(t,s='',dur=2.6){const b=$('#banner');b.innerHTML='<b>'+esc(t)+'</b>'+(s?'<small>'+esc(s)+'</small>':'');b.style.opacity=1;bannerT=dur}
const npcName=id=>(NPCS.find(n=>n.id===id)||{}).n||'';
function setBar(el,v,max,txt){const f=Math.round(clamp(max?v/max:0,0,1)*400)/400;if(el._f!==f){el._f=f;el.firstElementChild.style.transform='scaleX('+f+')'}const t=txt??(Math.round(v)+' / '+Math.round(max));if(el._t!==t){el._t=t;el.lastElementChild.textContent=t}}
const panels=['pBag','pChar','pQuest','pMap','pDialog','pMenu','pLife'];
function openPanel(id){if(id==='pDialog'||id==='pMenu'||id==='pMap'||id==='pQuest')for(const p of['pDialog','pMenu','pMap','pQuest'])if(p!==id)$('#'+p).hidden=true;$('#'+id).hidden=false;if(id==='pBag')refreshBag();if(id==='pChar')refreshChar();if(id==='pQuest')refreshQuestLog();if(id==='pMap')drawBigMap();if(id==='pLife')refreshLife()}
function closePanel(id){$('#'+id).hidden=true;if(id==='pDialog')S.shop=false;hideTip()}
function togglePanel(id){if($('#'+id).hidden)openPanel(id);else closePanel(id)}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{const p=b.closest('.panel');if(p)closePanel(p.id)}));
document.querySelectorAll('#mbtn [data-p]').forEach(b=>b.addEventListener('click',()=>togglePanel(b.dataset.p)));
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{closePanel('pMenu');openPanel(b.dataset.open)}));
$('#mmw').addEventListener('click',()=>togglePanel('pMap'));
$('#bChat').addEventListener('click',()=>openChat());
$('#bSave').addEventListener('click',()=>{saveGame(true);toast('');log('Spel opgeslagen.','sys')});
$('#bSound').addEventListener('click',()=>{S.sound=!S.sound;$('#bSound').textContent='Geluid: '+(S.sound?'aan':'uit')});
const gfxBtn=()=>$('#bGfx').textContent='Grafiek: '+GFX_N[GFX.q];gfxBtn();$('#bGfx').addEventListener('click',()=>{GFX.q=GFX.q==='hoog'?'middel':GFX.q==='middel'?'laag':'hoog';GFX.auto=9;applyGfx();gfxBtn()});
$('#bQuit').addEventListener('click',()=>{toMenu()});
$('#bPvp').addEventListener('click',()=>setPvp(!P.pvp));
$('#bRes').addEventListener('click',()=>resurrect());
$('#tInv').addEventListener('click',()=>{if(ME.target&&ME.target.kind==='pl')inviteToGroup(ME.target)});
/* portraits */
function drawPortrait(cv,o){const g=cv.getContext('2d'),w=cv.width;g.clearRect(0,0,w,w);
  if(o.cls){const C=CLASSES[o.cls];const R=RACES[o.race];const gr=g.createRadialGradient(w/2,w*.3,4,w/2,w/2,w*.7);gr.addColorStop(0,C.col);gr.addColorStop(1,'#120c06');g.fillStyle=gr;g.fillRect(0,0,w,w);
    const sk='#'+new THREE.Color(R.skin).getHexString(),hr='#'+new THREE.Color(R.hair[o.hair||0]).getHexString();g.fillStyle=sk;g.fillRect(w*.3,w*.28,w*.4,w*.46);g.fillStyle=hr;g.fillRect(w*.27,w*.2,w*.46,w*.14);g.fillRect(w*.27,w*.2,w*.08,w*.3);g.fillRect(w*.65,w*.2,w*.08,w*.3);if(o.race==='dwerg'){g.fillRect(w*.3,w*.56,w*.4,w*.26)}g.fillStyle='#111';g.fillRect(w*.38,w*.44,w*.07,w*.06);g.fillRect(w*.55,w*.44,w*.07,w*.06);
    if(o.race==='elf'){g.fillStyle=sk;g.beginPath();g.moveTo(w*.3,w*.42);g.lineTo(w*.14,w*.3);g.lineTo(w*.3,w*.5);g.fill();g.beginPath();g.moveTo(w*.7,w*.42);g.lineTo(w*.86,w*.3);g.lineTo(w*.7,w*.5);g.fill()}
    if(o.race==='grol'){g.fillStyle='#f0ead8';g.fillRect(w*.38,w*.62,w*.05,w*.07);g.fillRect(w*.57,w*.62,w*.05,w*.07)}
    g.fillStyle=C.col;g.fillRect(w*.2,w*.78,w*.6,w*.3)}
  else{const col=o.col||'#777';const gr=g.createRadialGradient(w/2,w*.35,4,w/2,w/2,w*.7);gr.addColorStop(0,col);gr.addColorStop(1,'#0c0806');g.fillStyle=gr;g.fillRect(0,0,w,w);g.fillStyle='rgba(255,255,255,.85)';g.font='800 '+(w*.5)+'px Cinzel,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(o.ch||'?',w/2,w*.55)}}
const MON_COL={boar:'#8a5a32',wolf:'#6a7480',spider:'#5a3a6a',human:'#8a2a2a',skel:'#cfc8b0'};
function conCol(l){const d=l-(P?P.level:1);return d>=5?'#ff3030':d>=3?'#ff8a20':d>=-2?'#ffe040':d>=-4?'#40d040':'#9d9d9d'}
let tfKey='';
function updTargetFrame(force){const e=ME.target,tf=$('#tframe');if(!e||S.mode!=='play'){tf.hidden=true;tfKey='';return}tf.hidden=false;
  let name,lvl,hp,mhp,key,cls='enemyb';
  if(e.kind==='mon'){name=e.t.n;lvl=e.lvl;hp=e.hp;mhp=e.mhp;key='m'+e.id;$('#tTag').hidden=!e.t.elite;$('#tTag').textContent=e.t.boss?'Baas':'Elite';$('#tInv').hidden=true}
  else if(e.kind==='npc'){name=e.n;lvl=e.def.id==='thorne'?15:10;hp=mhp=1;key='n'+e.id;cls='friendb';$('#tTag').hidden=true;$('#tInv').hidden=true}
  else{const hos=pvpHostile(e);name=e.n;lvl=e.lvl;hp=e.hp;mhp=e.mhp;key='p'+e.id+hos+e.pvp;cls=hos?'enemyb':'friendb';$('#tTag').hidden=!e.pvp;$('#tTag').textContent='PvP';$('#tInv').hidden=!(room&&room.connected())||(GROUP&&GROUP.members.includes(e.id))}
  if(key!==tfKey||force){tfKey=key;$('#tName').textContent=name;$('#tName').style.color=e.kind==='mon'?conCol(lvl):e.kind==='npc'?'#5bea6b':pvpHostile(e)?'#ff5a5a':'#7cc4ff';$('#tLvl').textContent=e.t&&e.t.boss?'??':lvl;$('#tHp').className='bar '+cls;tf.classList.toggle('hostile',cls==='enemyb');
    drawPortrait($('#tPort'),e.kind==='pl'?{cls:e.cls,race:e.race,hair:0}:e.kind==='npc'?{col:'#3a6a3a',ch:e.n[0]}:{col:MON_COL[e.t.kind],ch:e.t.n[0]})}
  setBar($('#tHp'),hp,mhp,e.kind==='npc'?'':e.dead?'Dood':Math.round(hp)+' / '+Math.round(mhp))}
/* korte trilling op telefoons */
function buzz(ms){try{if(isTouch&&navigator.vibrate&&S.vibe!==false)navigator.vibrate(ms)}catch(e){}}
/* grote aanvalsknop: start of stopt de automatische aanval op het (dichtstbijzijnde) doelwit */
function attackToggle(){if(ME.dead)return;if(ME.auto&&isEnemy(ME.target)){ME.auto=false;return}if(!isEnemy(ME.target)){const n=nearestEnemy(35);if(n)setTarget(n);else{const r=[...REMOTES.values()].filter(pvpHostile).sort((a,b)=>Math.hypot(a.x-ME.pos.x,a.z-ME.pos.z)-Math.hypot(b.x-ME.pos.x,b.z-ME.pos.z))[0];if(r)setTarget(r)}}
  if(!isEnemy(ME.target))return toast('Geen vijand in de buurt');ME.auto=true;faceTo(ME.target.x,ME.target.z)}
/* action bar */
const barEls=[],tbEls=[];
function buildBar(){const ab=$('#abar');const B=bar();
  if(ab.children.length!==B.length){ab.innerHTML='';barEls.length=0;B.forEach((a,i)=>{const b=document.createElement('button');b.className='slot';b.innerHTML='<span class="k">'+(i+1)+'</span><span class="n"></span><div class="cd"></div><div class="cdt"></div>';b.prepend(iconCanvas(a.ic,64));b.addEventListener('click',()=>useAbility(i));b.addEventListener('mouseenter',ev=>showAbilTip(a,b));b.addEventListener('mouseleave',hideTip);ab.appendChild(b);barEls.push(b)})}
  B.forEach((a,i)=>{const b=barEls[i];if(b.dataset.id!==a.id){b.dataset.id=a.id;b.querySelector('canvas').replaceWith(iconCanvas(a.ic,64))}});
  if(isTouch){const tb=$('#tbtns');
    /* actiewiel: plek t.o.v. rechtsonder [right,bottom,maat]; vaardigheden 0–3 in een boog, de rest in de lade */
    const WHEEL=[[112,6,68],[100,88,68],[26,116,68],[184,80,58]];
    const mk=(cls,r,bt,sz,inner,fn,par=tb)=>{const b=document.createElement('button');b.className='tb '+cls;Object.assign(b.style,{right:r+'px',bottom:bt+'px',width:sz+'px',height:sz+'px'});b.innerHTML=inner;b.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();buzz(12);fn(b)});par.appendChild(b);return b};
    if(!tb.children.length){
      mk('big',0,0,104,'<img src="ui/icon_sword.png" alt=""><span class="lab">Aanval</span>',b=>attackToggle());
      const drawer=document.createElement('div');drawer.id='tdrawer';tb.appendChild(drawer);
      B.forEach((a,i)=>{const w=WHEEL[i];const inner='<span class="n"></span><div class="cd"></div><div class="cdt"></div>';let b;
        if(w)b=mk('ab',w[0],w[1],w[2],inner,()=>useAbility(i));
        else{b=mk('ab sm',0,0,52,inner,()=>{useAbility(i);drawer.classList.remove('open')},drawer);b.style.position='relative';b.style.right=b.style.bottom='auto'}
        b.prepend(iconCanvas(a.ic,64));b.dataset.id=a.id;tbEls.push(b)});
      mk('ic',196,-4,54,'<img src="ui/icon_target.png" alt=""><span class="lab">Doel</span>',()=>cycleTarget());
      mk('ic act',258,-4,54,'<img src="ui/icon_hand.png" alt=""><span class="lab">Actie</span>',()=>interact());
      mk('ic sm2',10,196,40,'<span class="arr">▲</span>',b=>{drawer.classList.toggle('open');b.classList.toggle('on',drawer.classList.contains('open'))});
      const jp=document.createElement('button');jp.className='tb ic';jp.id='tJump';jp.innerHTML='<img src="ui/icon_jump.png" alt=""><span class="lab">Spring</span>';jp.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();buzz(10);jump()});$('#touch').appendChild(jp)}
    else B.forEach((a,i)=>{const b=tbEls[i];if(b&&b.dataset.id!==a.id){b.dataset.id=a.id;b.querySelector('canvas').replaceWith(iconCanvas(a.ic,64))}});
    const big=tb.querySelector('.big');if(big)big.classList.toggle('on',!!(ME.auto&&isEnemy(ME.target)))}
  updBar()}
function updBar(){const B=bar();if(isTouch){const big=document.querySelector('#tbtns .big');if(big){const on=!!(ME.auto&&isEnemy(ME.target));if(big._on!==on){big._on=on;big.classList.toggle('on',on)}}}B.forEach((a,i)=>{for(const b of[barEls[i],tbEls[i]]){if(!b)continue;const cd=Math.max(ME.cds[a.id]||0,a.item?0:ME.gcd);const tot=ME.cds[a.id]>0?a.cd:1;const pv=cd>0?Math.round(clamp(cd/tot,0,1)*60)/60:0;if(b._p!==pv){b._p=pv;b.querySelector('.cd').style.setProperty('--p',pv)}const ct=(ME.cds[a.id]||0)>1.5?String(Math.ceil(ME.cds[a.id])):'';if(b._ct!==ct){b._ct=ct;b.querySelector('.cdt').textContent=ct}
  const lk=P.level<a.lvl,nr=!!(a.cost>P.mp||(a.item&&!countItem(a.item)));if(b._lk!==lk){b._lk=lk;b.classList.toggle('lock',lk)}if(b._nr!==nr){b._nr=nr;b.classList.toggle('nores',nr)}
  const n=b.querySelector('.n');const nt=a.item?String(countItem(a.item)):P.level<a.lvl?'N'+a.lvl:'';if(n.textContent!==nt)n.textContent=nt;
  if(a.range&&b.classList){const far=!!(isEnemy(ME.target)&&distTo(ME.target)-ME.target.size*.6>a.range);if(b._far!==far){b._far=far;b.classList.toggle('far',far)}}}})}
/* tooltips */
const tipEl=$('#tip');
function placeTip(anchor){const r=anchor.getBoundingClientRect();tipEl.hidden=false;const tw=tipEl.offsetWidth,th=tipEl.offsetHeight;let x=r.left+r.width/2-tw/2,y=r.top-th-8;if(y<8)y=r.bottom+8;x=clamp(x,8,innerWidth-tw-8);y=clamp(y,8,innerHeight-th-8);tipEl.style.left=x+'px';tipEl.style.top=y+'px'}
function showAbilTip(a,el){tipEl.innerHTML='<div class="tn">'+esc(a.n)+'</div><div class="ts">'+(a.cost?a.cost+' '+resName()+' · ':'')+(a.cast?a.cast+' s spreuktijd · ':'Direct · ')+(a.cd?a.cd+' s afkoeltijd':'')+(a.range?' · '+a.range+' m':'')+'</div><div style="margin-top:4px">'+esc(a.d)+'</div>'+(P.level<a.lvl?'<div class="tr">Vereist niveau '+a.lvl+'</div>':'');placeTip(el)}
function hideTip(){tipEl.hidden=true}
function itemHtml(it,cmp=true){if(!it)return'';let h='<div class="tn" style="color:'+rarCol(it)+'">'+esc(it.n)+(it.q>1?' x'+it.q:'')+'</div>';
  if(it.kind==='gear'){h+='<div class="ts">'+SLOT_NL[it.s]+(it.s==='wapen'?' · '+it.wt:'')+' · '+RARITY[it.r].n+'</div>';if(it.s==='wapen')h+='<div>'+it.min+' – '+it.max+' schade · snelheid '+it.spd.toFixed(1)+'</div>';if(it.arm)h+='<div>'+it.arm+' pantser</div>';if(it.pow)h+='<div class="tg">+'+it.pow+' kracht</div>';if(it.sta)h+='<div class="tg">+'+it.sta+' uithouding</div>';
    h+='<div class="'+(P.level<it.req?'tr':'ts')+'">Vereist niveau '+it.req+'</div>';if(it.cls!==P.cls)h+='<div class="tr">Alleen voor '+CLASSES[it.cls].n+'</div>';
    const cur=P.eq[it.s];if(cmp&&cur&&cur!==it){const df=(k,lbl)=>{const v=(it[k]||0)-(cur[k]||0);return v?'<span class="'+(v>0?'tg':'tr')+'">'+(v>0?'+':'')+v+' '+lbl+'</span> ':''};const avg=x=>x.s==='wapen'?(x.min+x.max)/2:0;const dv=Math.round(avg(it)-avg(cur));h+='<div class="cmp">Vergeleken met '+esc(cur.n)+':<br>'+(dv?'<span class="'+(dv>0?'tg':'tr')+'">'+(dv>0?'+':'')+dv+' gem. schade</span> ':'')+df('arm','pantser')+df('pow','kracht')+df('sta','uithouding')+'</div>'}}
  else if(it.kind==='mat'){const M=MATS[it.n]||{};h+='<div class="ts">'+(M.food?'Voedsel':M.elixir?'Elixir':'Materiaal')+(it.r>0?' · '+RARITY[it.r].n:'')+'</div>';if(M.food||M.elixir)h+='<div class="tg">'+(M.food||M.elixir).d+' gedurende '+Math.round((M.food||M.elixir).dur/60)+' minuten. Je kunt één '+(M.food?'maaltijd':'elixir')+' tegelijk actief hebben.</div>';else h+='<div class="ts">Gebruik dit in je ambachtsboek (K) of verkoop het bij een handelaar.</div>'}
  else if(it.kind==='potion')h+='<div class="tg">'+(it.pt==='mana'?'Herstelt 50% mana, energie of focus.':'Herstelt 45% levenspunten.')+'</div>';else h+='<div class="ts">Rommel · verkoop dit bij een handelaar.</div>';
  h+='<div class="tv">Verkoopwaarde: '+it.price+' goud</div>';return h}
function showItem(it,el,ctx){tipEl.innerHTML=itemHtml(it)+(ctx?'<div class="tb" id="tipB"></div>':'');if(ctx){const tb=tipEl.querySelector('#tipB');const add=(t,fn,alt)=>{const b=document.createElement('button');b.className='btn'+(alt?' alt':'');b.textContent=t;b.onclick=()=>{fn();hideTip()};tb.appendChild(b)};
    if(ctx.bag!=null){if(it.kind==='gear')add('Uitrusten',()=>equip(ctx.bag));if(it.kind==='potion')add('Gebruiken',()=>useAbility(bar().findIndex(a=>a.item===it.pt)));if(it.kind==='mat'&&MATS[it.n]&&(MATS[it.n].food||MATS[it.n].elixir))add(MATS[it.n].food?'Eten':'Drinken',()=>useConsumable(ctx.bag));if(S.shop)add('Verkopen ('+it.price*(it.q||1)+'g)',()=>sell(ctx.bag));else add('Weggooien',()=>{P.inv[ctx.bag]=null;refreshBag();saveGame()},1)}
    if(ctx.eq)add('Afdoen',()=>unequip(ctx.eq),1);add('Sluiten',()=>{},1)}placeTip(el)}
function equip(i){const it=P.inv[i];if(!it||it.kind!=='gear')return;if(it.cls!==P.cls&&it.cls!=='alle')return toast('Dit is niet voor jouw klasse');if(P.level<it.req)return toast('Je moet niveau '+it.req+' zijn');const old=P.eq[it.s]||null;P.eq[it.s]=it;P.inv[i]=old;const f=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*f);rebuildMe();refreshBag();refreshChar();sfx('loot');saveGame()}
function unequip(s){const it=P.eq[s];if(!it)return;const i=P.inv.indexOf(null);if(i<0)return toast('Je rugzak is vol');P.inv[i]=it;delete P.eq[s];calcStats();rebuildMe();refreshBag();refreshChar();saveGame()}
function sell(i){const it=P.inv[i];if(!it)return;P.gold+=it.price*(it.q||1);log('Verkocht: '+it.n+' voor '+it.price*(it.q||1)+' goud.','loot');P.inv[i]=null;refreshBag();sfx('loot');saveGame();if(S.shop&&S.dlgNpc)openNpc(S.dlgNpc,true)}
function cellEl(it,onClick){const c=document.createElement('button');c.className='cell';if(it){c.classList.add(it.kind==='junk'?'rj':'r'+(it.r||0));c.appendChild(iconCanvas(itemIcon(it),48));if(it.q>1){const n=document.createElement('span');n.className='n';n.textContent=it.q;c.appendChild(n)}
  if(!isTouch){c.addEventListener('mouseenter',()=>{if(!tipEl.querySelector('#tipB'))showItem(it,c)});c.addEventListener('mouseleave',()=>{if(!tipEl.querySelector('#tipB'))hideTip()})}c.addEventListener('click',ev=>{ev.stopPropagation();onClick(c)})}return c}
function refreshBag(){if(!P)return;const g=$('#bagGrid');g.innerHTML='';P.inv.forEach((it,i)=>g.appendChild(cellEl(it,c=>{if(it&&it.kind==='gear'&&!isTouch&&!S.shop&&event&&event.shiftKey)return equip(i);showItem(it,c,{bag:i})})));$('#goldTxt').textContent=P.gold+' g';if(!$('#pChar').hidden)refreshChar()}
function refreshChar(){if(!P)return;$('#cTitle').textContent=P.name+' · niveau '+P.level+' '+RACES[P.race].n+' '+CLASSES[P.cls].n;const g=$('#eqGrid');g.innerHTML='';
  for(const s of SLOTS){const w=document.createElement('div');w.className='eqs';const it=P.eq[s];const c=cellEl(it,c=>showItem(it,c,{eq:s}));if(!it){c.appendChild(iconCanvas([s==='wapen'?CLASSES[P.cls].wt:s,'#3a3a3a','#141414'],48));c.style.opacity=.5}w.appendChild(c);w.insertAdjacentHTML('beforeend','<span>'+SLOT_NL[s]+'</span>');g.appendChild(w)}
  const rows=[['Levenspunten',ST.maxhp],[CLASSES[P.cls].res[0].toUpperCase()+CLASSES[P.cls].res.slice(1),ST.maxmp],['Kracht',ST.pow],['Uithouding',ST.sta],['Pantser',ST.arm],['Wapenschade',ST.wmin+' – '+ST.wmax],['Kritieke kans',ST.crit.toFixed(1)+'%'],['Ervaring',P.level>=MAXLVL?'max':P.xp+' / '+xpNeed(P.level)],['Goud',P.gold],['Monsters verslagen',P.kills],['Eerpunten (PvP)',P.honor||0]];
  $('#statList').innerHTML=rows.map(r=>'<span>'+r[0]+'</span><span>'+r[1]+'</span>').join('')}
/* quests */
function qState(q){if(P.done.includes(q.id))return'done';const a=P.quests[q.id];if(a)return a.n>=q.obj.n?'ready':'active';if(P.level>=q.lvl-1&&(!q.req||P.done.includes(q.req)))return'avail';return'locked'}
function refreshTracker(){if(!P)return;const el=$('#tracker');const act=QUESTS.filter(q=>P.quests[q.id]);el.innerHTML=act.map(q=>{const a=P.quests[q.id];const d=a.n>=q.obj.n;return'<div><b>'+esc(q.n)+'</b><span class="'+(d?'done':'')+'">'+(d?'✓ Keer terug naar '+esc(npcName(q.giver)):'- '+esc(q.obj.lbl)+': '+a.n+'/'+q.obj.n)+'</span></div>'}).join('');el.classList.toggle('show',act.length>0)}
function refreshQuestLog(){const act=QUESTS.filter(q=>P.quests[q.id]);const L=$('#qList');L.innerHTML=act.length?'':'<p style="color:var(--muted)">Je hebt geen actieve quests. Zoek naar personen met een gele <b style="color:#ffd100">!</b> boven hun hoofd.</p>';
  for(const q of act){const a=P.quests[q.id];const d=document.createElement('div');d.className='qrow';d.innerHTML='<b>'+esc(q.n)+'</b> <small style="color:var(--muted)">(niveau '+q.lvl+')</small><p>'+esc(q.txt)+'</p><p>'+esc(q.obj.lbl)+': <b>'+a.n+'/'+q.obj.n+'</b> · Bij: '+esc(npcName(q.giver))+'</p>';const b=document.createElement('button');b.className='btn alt';b.style.cssText='min-height:32px;padding:4px 10px;font-size:12px';b.textContent='Opgeven';b.onclick=()=>{delete P.quests[q.id];refreshQuestLog();refreshTracker();refreshNpcMarks();saveGame()};d.appendChild(b);L.appendChild(d)}
  const done=P.done.length;L.insertAdjacentHTML('beforeend','<p style="color:var(--muted);font-size:13px;margin-top:10px">Voltooide quests: '+done+' / '+QUESTS.length+'</p>')}
function npcMark(n){let m='';for(const q of QUESTS){if(q.giver!==n.id)continue;const s=qState(q);if(s==='ready')return'?';if(s==='avail')m='!';else if(s==='active'&&!m)m='a'}return m}
function refreshNpcMarks(){for(const n of NPCOBJ)n.mark=P?npcMark(n):''}
function openNpc(n,keep){if(Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z)>6)return toast('Je staat te ver weg');S.dlgNpc=n;if(!keep){n.rig.g.rotation.y=Math.atan2(ME.pos.x-n.x,ME.pos.z-n.z)}
  $('#dName').textContent=n.n;const b=$('#dBody');let h='<p>'+esc(n.def.hi)+'</p>';const qs=QUESTS.filter(q=>q.giver===n.id);
  for(const q of qs){const s=qState(q);if(s==='done'||s==='locked')continue;h+='<button class="dq" data-q="'+q.id+'"><span class="m">'+(s==='ready'?'?':s==='avail'?'!':'…')+'</span>'+esc(q.n)+(s==='active'?' (bezig)':s==='ready'?' (voltooien)':'')+'</button>'}
  if(qs.length&&qs.every(q=>qState(q)==='done'))h+='<p><i>Je hebt alles gedaan wat ik je kon vragen. Dank je, held.</i></p>';
  if(qs.some(q=>qState(q)==='locked')&&!qs.some(q=>['avail','active','ready'].includes(qState(q)))&&!qs.every(q=>qState(q)==='done'))h+='<p><i>Kom terug als je sterker bent geworden.</i></p>';
  S.shop=!!n.def.shop;if(S.shop){h+='<b>Te koop</b><div class="shop" id="shopL"></div>';const junk=P.inv.reduce((s,x)=>s+(x&&x.kind==='junk'?x.price*x.q:0),0);h+='<div class="row"><button class="btn" id="sellJ"'+(junk?'':' disabled')+'>Verkoop alle rommel ('+junk+'g)</button></div><p style="font-size:13px;margin-top:8px">Tip: open je rugzak om uitrusting te verkopen. Je hebt <b>'+P.gold+'</b> goud.</p>'}
  b.innerHTML=h;b.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>showQuest(n,QUESTS.find(q=>q.id===x.dataset.q)));
  if(S.shop){const sl=$('#shopL');for(const[pt,pr]of[['heal',3],['mana',3]]){const it=potion(pt);const bt=document.createElement('button');bt.appendChild(iconCanvas(itemIcon(it),40));bt.insertAdjacentHTML('beforeend','<span>'+it.n+'<br><small>'+pr+' goud</small></span>');bt.onclick=()=>{if(P.gold<pr)return toast('Niet genoeg goud');if(!addItem(potion(pt)))return toast('Je rugzak is vol');P.gold-=pr;sfx('loot');refreshBag();openNpc(n,true);saveGame()};sl.appendChild(bt)}
    $('#sellJ').onclick=()=>{let g=0;P.inv.forEach((x,i)=>{if(x&&x.kind==='junk'){g+=x.price*x.q;P.inv[i]=null}});P.gold+=g;log('Rommel verkocht voor '+g+' goud.','loot');sfx('loot');refreshBag();openNpc(n,true);saveGame()}}
  openPanel('pDialog');S.shop=!!n.def.shop}
function rewardHtml(q){return'<div class="rew"><span>'+q.xp+' XP</span><span style="color:#8a6a00">'+q.gold+' goud</span>'+(q.item?'<span style="color:'+['#000','#1a8a2a','#1a5ab8','#8a2ac8'][q.item]+'">'+RARITY[q.item].n+' voorwerp</span>':'')+(q.pots?'<span>'+q.pots+' drankjes</span>':'')+'</div>'}
function showQuest(n,q){const s=qState(q);const b=$('#dBody');const a=P.quests[q.id];
  b.innerHTML='<p><b>'+esc(q.n)+'</b></p><p>'+esc(s==='ready'?q.done:q.txt)+'</p><div class="obj">'+esc(q.obj.lbl)+': '+(a?a.n:0)+' / '+q.obj.n+'</div><p style="margin:6px 0 4px"><b>Beloning</b></p>'+rewardHtml(q)+'<div class="row" style="margin-top:12px" id="qBtns"></div>';
  const bb=$('#qBtns');const add=(t,fn,alt)=>{const x=document.createElement('button');x.className='btn'+(alt?' alt':'');x.textContent=t;x.onclick=fn;bb.appendChild(x)};
  if(s==='avail')add('Accepteren',()=>{P.quests[q.id]={n:0};log('Quest aangenomen: '+q.n,'sys');sfx('quest');refreshTracker();refreshNpcMarks();saveGame();closePanel('pDialog')});
  if(s==='ready')add('Voltooien',()=>completeQuest(q));add('Terug',()=>openNpc(n,true),1)}
function completeQuest(q){delete P.quests[q.id];P.done.push(q.id);P.gold+=q.gold;log('Quest voltooid: '+q.n+' (+'+q.gold+' goud)','sys');sfx('quest');
  if(q.item){const it=makeGear(q.id==='q6'?'wapen':randSlot(),q.lvl+1,q.item,P.cls);if(!addItem(it)){toast('Je rugzak is vol: het voorwerp ligt op de grond.')}else log('Beloning: <span style="color:'+rarCol(it)+'">['+esc(it.n)+']</span>','loot',true)}
  if(q.pots){addItem(potion('heal',q.pots))}gainXp(q.xp,'me');banner('Quest voltooid',q.n);refreshTracker();refreshNpcMarks();refreshBag();closePanel('pDialog');saveGame()}
/* party frames */
function refreshParty(){const el=$('#party');if(!GROUP||S.mode!=='play'){el.innerHTML='';return}let h='';for(const id of GROUP.members){if(id===myId())continue;const r=REMOTES.get(id);if(!r)continue;h+='<div class="pm frame" data-id="'+id+'"><b><span>'+(GROUP.leader===id?'★ ':'')+esc(r.n)+'</span><small>'+r.lvl+' '+CLASSES[r.cls].n+'</small></b><div class="bar hpb"><i style="transform:scaleX('+clamp(r.hp/Math.max(1,r.mhp),0,1)+')"></i><span>'+(r.dead?'Dood':r.hp+'/'+r.mhp)+'</span></div></div>'}
  h+='<button class="btn alt" id="gLeave">Groep verlaten</button>';el.innerHTML=h;el.querySelectorAll('.pm').forEach(x=>x.onclick=()=>{const r=REMOTES.get(x.dataset.id);if(r)setTarget(r)});$('#gLeave').onclick=leaveGroup}
/* chat */
const chatIn=$('#chatIn');
function openChat(){$('#chat').classList.add('open');chatIn.focus();logEl.scrollTop=1e9}
function closeChat(){$('#chat').classList.remove('open');chatIn.blur();chatIn.value=''}
chatIn.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter'){const t=chatIn.value.trim();if(t)sendChat(t);closeChat()}else if(ev.key==='Escape')closeChat()});
chatIn.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==chatIn)$('#chat').classList.remove('open')},150));
function sendChat(t){t=t.slice(0,120);if(/^\/(g|groep|p) /i.test(t)){const m=t.replace(/^\/\S+ /,'');if(!GROUP)return log('Je zit niet in een groep.','err');netEmit('chat',{t:m,g:GROUP.leader});log('<span class="c-grp">[Groep] '+esc(P.name)+': '+esc(m)+'</span>','grp',true);return}
  if(/^\/(inv|uitnodigen) /i.test(t)){const nm=t.replace(/^\/\S+ /,'').toLowerCase();const r=[...REMOTES.values()].find(x=>x.n.toLowerCase()===nm);if(!r)return log('Speler niet gevonden: '+nm,'err');return inviteToGroup(r)}
  if(/^\/(verlaat|leave)/i.test(t))return leaveGroup();
  if(/^\/pvp/i.test(t))return setPvp(!P.pvp);
  if(/^\/(help|\?)/i.test(t))return log('Commando\'s: /g bericht (groepschat), /inv naam (uitnodigen), /verlaat (groep verlaten), /pvp (PvP aan of uit)','sys');
  netEmit('chat',{t});log('<b>'+esc(P.name)+':</b> '+esc(t),'say',true);ME.bubble={t:t.slice(0,60),until:performance.now()+5000};if(!room||!room.connected())log('(Je bent offline: niemand hoort je.)','err')}
/* nameplates */
function plateFor(e){if(!e.plate){e.plate=document.createElement('div');e.plate.className='plate';platesEl.appendChild(e.plate);e.plateKey=''}return e.plate}
function updPlates(W,H){
  const list=[];for(const m of MONS)list.push(m);for(const n of NPCOBJ)list.push(n);for(const r of REMOTES.values())list.push(r);if(ME.bubble&&S.mode==='play')list.push({kind:'self',x:ME.pos.x,y:ME.pos.y,z:ME.pos.z,plateSelf:1});
  for(const n of NODES)list.push(n);
  for(const e of list){const x=e.kind==='mon'?e.x:e.kind==='self'?ME.pos.x:e.kind==='npc'?e.x:e.x,z=e.z,y=e.kind==='mon'?e.y:e.kind==='npc'?e.y:e.y;const dd=Math.hypot(x-camTarget.x,z-camTarget.z);
    let show=S.mode==='play'&&dd<(e.kind==='npc'?50:e.kind==='pl'?70:40);if(e.kind==='mon'&&e.dead&&!e.loot)show=false;
    if(e.kind==='mon'&&show&&ME.target!==e&&!e.tgt&&dd>22)show=false;if(e.kind==='node')show=S.mode==='play'&&!e.down&&dd<15;
    if(!show){if(e.plate&&e.plate.style.display!=='none'){e.plate.style.display='none'}if(e.kind==='self'&&ME.selfPlate)ME.selfPlate.style.display='none';continue}
    const pl=e.kind==='self'?(ME.selfPlate||(ME.selfPlate=Object.assign(document.createElement('div'),{className:'plate pl'}),platesEl.appendChild(ME.selfPlate),ME.selfPlate)):plateFor(e);
    const hh=e.kind==='mon'?e.rig.h:e.kind==='self'?ME.rig.h:(e.rig?e.rig.h:1.8);_v.set(x,y+hh+.35,z).project(camera);if(_v.z>1||Math.abs(_v.x)>1.2||Math.abs(_v.y)>1.2){pl.style.display='none';continue}
    if(pl.style.display)pl.style.display='';const tr='translate('+Math.round((_v.x*.5+.5)*W)+'px,'+Math.round((-_v.y*.5+.5)*H)+'px) translate(-50%,-100%)';if(pl._tr!==tr){pl._tr=tr;pl.style.transform=tr}
    let key,html;const tg=ME.target===e;
    if(e.kind==='mon'){const hp=Math.round(e.hp/e.mhp*100);key=e.lvl+'|'+hp+'|'+tg+'|'+e.dead+'|'+(e.loot?1:0)+'|'+(P&&P.level);html=e.dead?'<span style="color:#ffd34d">Buit</span>':'<span style="color:'+conCol(e.lvl)+'">'+(e.t.boss?'':e.lvl+' ')+esc(e.t.n)+'</span>'+(tg||e.hp<e.mhp?'<div class="pb"><i style="width:'+hp+'%"></i></div>':'');pl.className='plate'+(tg?' tgt':'')}
    else if(e.kind==='node'){key='n';html='<span style="color:#d8f0a0;font-size:12px;font-weight:600">'+esc(e.name)+'</span>';pl.className='plate'}
    else if(e.kind==='npc'){key=e.mark+'|'+tg;html=(e.mark==='!'||e.mark==='?'?'<div class="q">'+e.mark+'</div>':e.mark==='a'?'<div class="q" style="color:#bbb">?</div>':'')+esc(e.n)+'<br><small style="color:#cfe9cf;font-weight:500">&lt;'+esc(e.t)+'&gt;</small>';pl.className='plate npc'}
    else{const b=(e.kind==='self'?ME.bubble:e.bubble);const bt=b&&b.until>performance.now()?b.t:'';const hos=e.kind==='pl'&&pvpHostile(e);key=(e.n||'')+'|'+bt+'|'+(e.lvl||0)+'|'+(GROUP&&GROUP.members.includes(e.id))+'|'+hos+'|'+e.pvp;html=(bt?'<div style="background:rgba(255,255,255,.92);color:#222;padding:4px 8px;border-radius:8px;max-width:220px;white-space:normal;margin-bottom:3px;font-weight:600;text-shadow:none">'+esc(bt)+'</div>':'')+(e.kind==='self'?'':(e.pvp?'⚔ ':'')+esc(e.n)+' <small>('+e.lvl+')</small>');pl.className='plate '+(GROUP&&GROUP.members.includes(e.id)?'grp':hos?'hos':'pl')}
    if(key!==e.plateKey||(e.kind==='self'&&key!==ME.selfKey)){if(e.kind==='self')ME.selfKey=key;else e.plateKey=key;pl.innerHTML=html}}}
/* minimap */
const mapImg=(()=>{const c=document.createElement('canvas');c.width=c.height=HN;const g=c.getContext('2d');const d=g.createImageData(HN,HN);const col=terrain.geometry.attributes.color.array;for(let i=0;i<HN*HN;i++){for(let k=0;k<3;k++)d.data[i*4+k]=Math.pow(col[i*3+k],1/2.2)*255*1.05;d.data[i*4+3]=255}g.putImageData(d,0,0);
  const big=document.createElement('canvas');big.width=big.height=640;const b=big.getContext('2d');b.imageSmoothingEnabled=true;b.drawImage(c,0,0,640,640);const m=x=>x+320;
  b.fillStyle='#3a7ea8';b.beginPath();b.arc(m(LAKE.x),m(LAKE.z),LAKE.r*.95,0,7);b.fill();b.fillStyle='rgba(30,50,20,.22)';for(const t of pineT){b.fillRect(m(t[0])-1,m(t[1])-1,2,2)}
  b.fillStyle='#5a4a3a';for(const x of BOXES)b.fillRect(m(x.x0),m(x.z0),x.x1-x.x0,x.z1-x.z0);b.strokeStyle='#8a8478';b.lineWidth=2;b.beginPath();b.arc(m(0),m(0),52,0,7);b.stroke();b.strokeStyle='#6a4a2a';b.beginPath();b.arc(m(CAMP.x),m(CAMP.z),25,0,7);b.stroke();b.fillStyle='#2a2a2a';b.fillRect(m(CRYPT.x)-7,m(CRYPT.z)-6,14,6);return big})();
const dunImg=(()=>{const c=document.createElement('canvas');c.width=DC*12;c.height=DR*12;const g=c.getContext('2d');g.fillStyle='#120e14';g.fillRect(0,0,c.width,c.height);for(let r=0;r<DR;r++)for(let k=0;k<DC;k++)if(DMAP[r][k]!=='#'){g.fillStyle='#5a5560';g.fillRect(k*12,r*12,12,12)}return c})();
const mm=$('#mmc'),mg=mm.getContext('2d');
function w2m(x,z,cx,cz,sc,W){return[W/2+(x-cx)*sc,W/2+(z-cz)*sc]}
function drawMini(){const W=mm.width,inD=ME.pos.x>700;mg.save();mg.clearRect(0,0,W,W);mg.beginPath();mg.arc(W/2,W/2,W/2,0,7);mg.clip();mg.fillStyle='#000';mg.fillRect(0,0,W,W);
  const sc=inD?1.6:1.1;const cx=ME.pos.x,cz=ME.pos.z;
  if(ME.pos.x>1250){const ox=D2.X-D2.C/2*D2.c,oz=D2.Z-D2.R/2*D2.c;const[x0,y0]=w2m(ox,oz,cx,cz,sc,W);mg.drawImage(D2.img,x0,y0,D2.C*D2.c*sc,D2.R*D2.c*sc)}
  else if(inD){const ox=DUN.x-DC/2*DUN.c,oz=DUN.z-DR/2*DUN.c;const[x0,y0]=w2m(ox,oz,cx,cz,sc,W);mg.drawImage(dunImg,x0,y0,DC*DUN.c*sc,DR*DUN.c*sc)}
  else{const[x0,y0]=w2m(-320,-320,cx,cz,sc,W);mg.drawImage(mapImg,x0,y0,640*sc,640*sc)}
  const dot=(x,z,c,r=3)=>{const[a,b]=w2m(x,z,cx,cz,sc,W);if(a<-5||b<-5||a>W+5||b>W+5)return;mg.fillStyle=c;mg.beginPath();mg.arc(a,b,r,0,7);mg.fill()};
  for(const m of MONS)if(!m.dead&&Math.abs(m.x-cx)<120)dot(m.x,m.z,m.t.boss?'#ff40ff':'#e03030',m.t.elite?4:2.6);
  for(const n of NPCOBJ){if(n.mark==='!'||n.mark==='?'){const[a,b]=w2m(n.x,n.z,cx,cz,sc,W);mg.fillStyle='#ffd100';mg.font='800 16px Cinzel,serif';mg.textAlign='center';mg.fillText(n.mark,a,b+6)}else dot(n.x,n.z,'#ffd34d',2.5)}
  if(!inD)for(const n of NODES)if(!n.down&&Math.abs(n.x-cx)<110&&Math.abs(n.z-cz)<110)dot(n.x,n.z,n.type==='kruid'?'#e8ff6a':n.type==='erts'?'#d0d0d8':'#c8945a',1.8);
  for(const r of REMOTES.values())dot(r.x,r.z,GROUP&&GROUP.members.includes(r.id)?'#40ffa0':pvpHostile(r)?'#ff4040':'#5ab0ff',3.5);
  if(!inD){{const[a,b]=w2m(CAVE.x,CAVE.z,cx,cz,sc,W);mg.fillStyle='#ff7a30';mg.fillRect(a-3,b-3,6,6)}const[a,b]=w2m(CRYPT.x,CRYPT.z,cx,cz,sc,W);mg.fillStyle='#b06aff';mg.fillRect(a-3,b-3,6,6)}
  mg.restore();mg.save();mg.translate(W/2,W/2);mg.rotate(-ME.ry+Math.PI);mg.fillStyle='#fff';mg.strokeStyle='#000';mg.lineWidth=1.5;mg.beginPath();mg.moveTo(0,-8);mg.lineTo(6,7);mg.lineTo(0,3);mg.lineTo(-6,7);mg.closePath();mg.fill();mg.stroke();mg.restore();
  mg.fillStyle='#e8c06a';mg.font='700 14px Cinzel,serif';mg.textAlign='center';mg.fillText('N',W/2,14)}
function drawBigMap(){const c=$('#bigmap'),g=c.getContext('2d'),W=c.width;const inD=ME.pos.x>700;g.fillStyle='#000';g.fillRect(0,0,W,W);let tf;
  if(ME.pos.x>1250){const D=D2,s=W/(Math.max(D.C,D.R)*D.c);g.drawImage(D.img,(W-D.C*D.c*s)/2,(W-D.R*D.c*s)/2,D.C*D.c*s,D.R*D.c*s);tf=(x,z)=>[(W-D.C*D.c*s)/2+(x-(D.X-D.C/2*D.c))*s,(W-D.R*D.c*s)/2+(z-(D.Z-D.R/2*D.c))*s];$('#mapTitle').textContent=D.name}
  else if(inD){const s=W/(Math.max(DC,DR)*DUN.c);g.drawImage(dunImg,(W-DC*DUN.c*s)/2,(W-DR*DUN.c*s)/2,DC*DUN.c*s,DR*DUN.c*s);tf=(x,z)=>[(W-DC*DUN.c*s)/2+(x-(DUN.x-DC/2*DUN.c))*s,(W-DR*DUN.c*s)/2+(z-(DUN.z-DR/2*DUN.c))*s];$('#mapTitle').textContent='Crypte van Kaal-Morath'}
  else{g.drawImage(mapImg,0,0,W,W);const s=W/640;tf=(x,z)=>[(x+320)*s,(z+320)*s];$('#mapTitle').textContent='Kaart van Velmora';
    g.font='700 15px Cinzel,serif';g.textAlign='center';g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=3;for(const[t,x,z]of[['Asbergen',205,-215],['Zilverbron',0,-62],['Schemerwoud',-30,-150],['Roversheide',165,-140],['Knekelheuvels',-170,-255],['Spiegelmeer',-150,125],['Gouden Velden',10,178],['Zilverdal',120,60]]){const[a,b]=tf(x,z);g.strokeText(t,a,b);g.fillText(t,a,b)}
    const[a,b]=tf(CRYPT.x,CRYPT.z);g.fillStyle='#b06aff';g.fillRect(a-5,b-5,10,10);const[c2,d2_]=tf(CAVE.x,CAVE.z);g.fillStyle='#ff7a30';g.fillRect(c2-5,d2_-5,10,10)}
  for(const n of NPCOBJ){const[a,b]=tf(n.x,n.z);if(n.mark==='!'||n.mark==='?'){g.fillStyle='#ffd100';g.font='800 18px Cinzel,serif';g.fillText(n.mark,a,b+6)}}
  for(const r of REMOTES.values()){const[a,b]=tf(r.x,r.z);g.fillStyle='#5ab0ff';g.beginPath();g.arc(a,b,4,0,7);g.fill()}
  const[px,pz]=tf(ME.pos.x,ME.pos.z);g.save();g.translate(px,pz);g.rotate(-ME.ry+Math.PI);g.fillStyle='#fff';g.strokeStyle='#000';g.lineWidth=2;g.beginPath();g.moveTo(0,-11);g.lineTo(8,9);g.lineTo(0,4);g.lineTo(-8,9);g.closePath();g.fill();g.stroke();g.restore()}
let zoneName='';function updZone(force){const z=zoneAt(ME.pos.x,ME.pos.z);if(z!==zoneName||force){const changed=z!==zoneName;zoneName=z;$('#zone').textContent=z;if(changed&&S.mode==='play'){banner(z,z==='Crypte van Kaal-Morath'?'Aanbevolen: niveau 8+ en een groep':z==='Zilverbron'?'Een veilige haven':z==='Arena van Zilverbron'?'PvP is hier altijd actief — wie de kist opent, krijgt de AK-47':'',2.2)}}}
