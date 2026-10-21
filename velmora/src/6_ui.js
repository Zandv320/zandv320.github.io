
/* ===================== UI ===================== */
const logEl=$('#log');
function log(t,cls='sys',raw=false){if(isTouch){const f=$('#feed');if(f){const e=document.createElement('div');e.className='c-'+cls;e.innerHTML=raw?t:esc(t);f.appendChild(e);setTimeout(()=>e.classList.add('old'),4200);setTimeout(()=>e.remove(),5200);while(f.children.length>3)f.firstChild.remove()}}const d=document.createElement('div');d.className='c-'+cls;d.innerHTML=raw?t:esc(t);logEl.appendChild(d);setTimeout(()=>d.classList.add('old'),30000);while(logEl.children.length>70)logEl.firstChild.remove();if($('#chat').classList.contains('open'))logEl.scrollTop=1e9}
let bannerT=0;function banner(t,s='',dur=2.6){const b=$('#banner');b.innerHTML='<b>'+esc(t)+'</b>'+(s?'<small>'+esc(s)+'</small>':'');b.style.opacity=1;bannerT=dur}
const npcName=id=>(NPCS.find(n=>n.id===id)||{}).n||'';
function setBar(el,v,max,txt){const f=Math.round(clamp(max?v/max:0,0,1)*400)/400;if(el._f!==f){el._f=f;el.firstElementChild.style.transform='scaleX('+f+')'}const t=txt??(Math.round(v)+' / '+Math.round(max));if(el._t!==t){el._t=t;el.lastElementChild.textContent=t}}
const panels=['pBag','pChar','pQuest','pMap','pDialog','pMenu','pLife','pTalent','pAdmin'];
$('#pTalent').addEventListener('click',()=>{if(isTouch)hideTip()});
function syncPop(){const B=document.body.classList,port=B.contains('portrait');B.toggle('pop',isTouch&&panels.some(p=>(port||p==='pDialog')&&!$('#'+p).hidden));B.toggle('bagdlg',!$('#pDialog').hidden&&!$('#pBag').hidden)}
function openPanel(id){if(isTouch&&document.body.classList.contains('portrait')&&id!=='pDialog')for(const p of panels)if(p!==id&&p!=='pDialog'&&!$('#'+p).hidden)closePanel(p);if(id==='pDialog'||id==='pMenu'||id==='pMap'||id==='pQuest')for(const p of['pDialog','pMenu','pMap','pQuest'])if(p!==id)$('#'+p).hidden=true;$('#'+id).hidden=false;if(id==='pBag')refreshBag();if(id==='pChar')refreshChar();if(id==='pQuest')refreshQuestLog();if(id==='pMap')mapOpen();if(id==='pLife')refreshLife();if(id==='pTalent'){refreshTalent();document.body.classList.add('tal')}syncPop()}
function closePanel(id){$('#'+id).hidden=true;if(id==='pTalent')document.body.classList.remove('tal');if(id==='pDialog')S.shop=false;hideTip();syncPop()}
function togglePanel(id){if($('#'+id).hidden)openPanel(id);else closePanel(id)}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{const p=b.closest('.panel');if(p)closePanel(p.id)}));
document.querySelectorAll('#mbtn [data-p]').forEach(b=>b.addEventListener('click',()=>togglePanel(b.dataset.p)));
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{closePanel('pMenu');openPanel(b.dataset.open)}));
$('#mmw').addEventListener('click',()=>togglePanel('pMap'));

$('#bChat').addEventListener('click',()=>openChat());
$('#bSave').addEventListener('click',()=>{saveGame(true);toast('');log('Game saved.','sys')});
/* fullscreen: the Fullscreen API where the browser has it; on iPhone only via 'Add to Home Screen' */
function fsEl(){return document.fullscreenElement||document.webkitFullscreenElement}
function fsAble(){const d=document.documentElement;return!!(d.requestFullscreen||d.webkitRequestFullscreen)}
const isStandalone=()=>matchMedia('(display-mode: fullscreen),(display-mode: standalone)').matches||navigator.standalone;
function updFs(){const on=!!fsEl()||isStandalone();const b=$('#bFull');if(b)b.textContent='Fullscreen: '+(on?'on':'off');const b2=$('#bFull2');if(b2)b2.hidden=on&&!fsEl()}
function toggleFullscreen(){if(fsEl()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
  if(fsAble()){const d=document.documentElement;const pr=(d.requestFullscreen||d.webkitRequestFullscreen).call(d,{navigationUI:'hide'});if(pr&&pr.catch)pr.catch(()=>fsHint());return}
  fsHint()}
function fsHint(){if($('#fsHint'))return;const d=document.createElement('div');d.id='fsHint';const ios=/iPhone|iPod/.test(navigator.userAgent);
  d.innerHTML=ios?'Safari on iPhone cannot make a web page fullscreen. Tap <b>Share</b> ⎋ and then <b>Add to Home Screen</b>, then start Velmora from its icon: it opens fullscreen, without browser bars.<button class="btn alt">OK</button>':'This browser does not allow fullscreen. Use your browser menu: <b>Add to Home screen</b>, then start Velmora from its icon.<button class="btn alt">OK</button>';
  d.querySelector('button').onclick=()=>d.remove();document.body.appendChild(d)}
document.addEventListener('fullscreenchange',updFs);document.addEventListener('webkitfullscreenchange',updFs);
$('#bFull').addEventListener('click',toggleFullscreen);$('#bFull2').addEventListener('click',toggleFullscreen);updFs();
$('#bSound').addEventListener('click',()=>{S.sound=!S.sound;$('#bSound').textContent='Sound: '+(S.sound?'on':'off')});
const gfxBtn=()=>$('#bGfx').textContent='Graphics: '+GFX_N[GFX.q];gfxBtn();$('#bGfx').addEventListener('click',()=>{GFX.q=GFX.q==='hoog'?'middel':GFX.q==='middel'?'laag':'hoog';GFX.auto=9;applyGfx();gfxBtn()});
$('#bQuit').addEventListener('click',()=>{toMenu()});
$('#bPvp').addEventListener('click',()=>setPvp(!P.pvp));
$('#bRes').addEventListener('click',()=>resurrect());
$('#tInv').addEventListener('click',()=>{if(ME.target&&ME.target.kind==='pl')inviteToGroup(ME.target)});
/* portraits */
function drawPortrait(cv,o){const g=cv.getContext('2d'),w=cv.width;g.clearRect(0,0,w,w);
  if(o.cls){const C=CLASSES[o.cls];const R=RACES[o.race];const gr=g.createRadialGradient(w/2,w*.3,4,w/2,w/2,w*.7);gr.addColorStop(0,C.col);gr.addColorStop(1,'#120c06');g.fillStyle=gr;g.fillRect(0,0,w,w);
    const sk='#'+new THREE.Color(R.orc?R.hair[o.hair||0]:R.skin).getHexString(),hr=R.orc?'#1c1712':'#'+new THREE.Color(R.hair[o.hair||0]).getHexString();if(R.undead){g.fillStyle=sk;g.fillRect(w*.3,w*.24,w*.4,w*.42);g.fillRect(w*.36,w*.62,w*.28,w*.14);g.fillStyle='#1a1410';g.fillRect(w*.35,w*.4,w*.11,w*.1);g.fillRect(w*.54,w*.4,w*.11,w*.1);g.fillStyle=hr;g.shadowColor=hr;g.shadowBlur=8;g.fillRect(w*.38,w*.43,w*.05,w*.04);g.fillRect(w*.57,w*.43,w*.05,w*.04);g.shadowBlur=0;g.fillStyle='#1a1410';for(let i=0;i<4;i++)g.fillRect(w*(.39+i*.06),w*.66,w*.02,w*.08);return}g.fillStyle=sk;g.fillRect(w*.3,w*.28,w*.4,w*.46);g.fillStyle=hr;g.fillRect(w*.27,w*.2,w*.46,w*.14);g.fillRect(w*.27,w*.2,w*.08,w*.3);g.fillRect(w*.65,w*.2,w*.08,w*.3);if(o.race==='dwerg'){g.fillRect(w*.3,w*.56,w*.4,w*.26)}g.fillStyle='#111';g.fillRect(w*.38,w*.44,w*.07,w*.06);g.fillRect(w*.55,w*.44,w*.07,w*.06);if(R.orc){g.fillStyle='#f2e6c4';g.beginPath();g.moveTo(w*.37,w*.68);g.lineTo(w*.4,w*.55);g.lineTo(w*.43,w*.68);g.fill();g.beginPath();g.moveTo(w*.57,w*.68);g.lineTo(w*.6,w*.55);g.lineTo(w*.63,w*.68);g.fill();g.fillStyle='#e0a030';g.fillRect(w*.7,w*.44,w*.04,w*.08)}
    g.fillStyle=C.col;g.fillRect(w*.2,w*.78,w*.6,w*.3)}
  else{const col=o.col||'#777';const gr=g.createRadialGradient(w/2,w*.35,4,w/2,w/2,w*.7);gr.addColorStop(0,col);gr.addColorStop(1,'#0c0806');g.fillStyle=gr;g.fillRect(0,0,w,w);g.fillStyle='rgba(255,255,255,.85)';g.font='800 '+(w*.5)+'px Cinzel,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(o.ch||'?',w/2,w*.55)}}
const MON_COL={boar:'#8a5a32',wolf:'#6a7480',spider:'#5a3a6a',human:'#8a2a2a',skel:'#cfc8b0'};
function conCol(l){const d=l-(P?P.level:1);return d>=5?'#ff3030':d>=3?'#ff8a20':d>=-2?'#ffe040':d>=-4?'#40d040':'#9d9d9d'}
let tfKey='';
function updTargetFrame(force){const e=ME.target,tf=$('#tframe');if(!e||S.mode!=='play'){tf.hidden=true;tfKey='';return}tf.hidden=false;
  let name,lvl,hp,mhp,key,cls='enemyb';
  if(e.kind==='mon'){name=e.t.n;lvl=e.lvl;hp=e.hp;mhp=e.mhp;key='m'+e.id;$('#tTag').hidden=!e.t.elite;$('#tTag').textContent=e.t.boss?'Boss':'Elite';$('#tInv').hidden=true}
  else if(e.kind==='npc'){name=e.n;lvl=e.def.id==='thorne'?15:10;hp=mhp=1;key='n'+e.id;cls='friendb';$('#tTag').hidden=true;$('#tInv').hidden=true}
  else{const hos=pvpHostile(e);name=e.n;lvl=e.lvl;hp=e.hp;mhp=e.mhp;key='p'+e.id+hos+e.pvp;cls=hos?'enemyb':'friendb';$('#tTag').hidden=!e.pvp;$('#tTag').textContent='PvP';$('#tInv').hidden=!(room&&room.connected())||(GROUP&&GROUP.members.includes(e.id))}
  if(key!==tfKey||force){tfKey=key;$('#tName').textContent=name;$('#tName').style.color=e.kind==='mon'?conCol(lvl):e.kind==='npc'?'#5bea6b':pvpHostile(e)?'#ff5a5a':'#7cc4ff';$('#tLvl').textContent=e.t&&e.t.boss?'??':lvl;$('#tHp').className='bar '+cls;tf.classList.toggle('hostile',cls==='enemyb');
    drawPortrait($('#tPort'),e.kind==='pl'?{cls:e.cls,race:e.race,hair:0}:e.kind==='npc'?{col:'#3a6a3a',ch:e.n[0]}:{col:MON_COL[e.t.kind],ch:e.t.n[0]})}
  setBar($('#tHp'),hp,mhp,e.kind==='npc'?'':e.dead?'Dead':Math.round(hp)+' / '+Math.round(mhp))}
/* korte trilling op telefoons */
function buzz(ms){try{if(isTouch&&navigator.vibrate&&S.vibe!==false)navigator.vibrate(ms)}catch(e){}}
/* grote aanvalsknop: start of stopt de automatische aanval op het (dichtstbijzijnde) doelwit */
function attackToggle(){if(ME.dead)return;if(ME.auto&&isEnemy(ME.target)){ME.auto=false;return}if(!isEnemy(ME.target)){const n=nearestEnemy(35);if(n)setTarget(n);else{const r=[...REMOTES.values()].filter(pvpHostile).sort((a,b)=>Math.hypot(a.x-ME.pos.x,a.z-ME.pos.z)-Math.hypot(b.x-ME.pos.x,b.z-ME.pos.z))[0];if(r)setTarget(r)}}
  if(!isEnemy(ME.target))return toast('No enemy nearby');ME.auto=true;faceTo(ME.target.x,ME.target.z)}
/* action bar */
const barEls=[],tbEls=[];
function buildBar(){const ab=$('#abar');const B=bar();refreshTalent();
  if(ab.children.length!==B.length){ab.innerHTML='';barEls.length=0;B.forEach((a,i)=>{const b=document.createElement('button');b.className='slot';b.innerHTML='<span class="k">'+(i<9?i+1:i===9?0:'')+'</span><span class="n"></span><div class="cd"></div><div class="cdt"></div>';b.prepend(iconCanvas(a.ic,64));b.addEventListener('click',()=>useAbility(i));b.addEventListener('mouseenter',ev=>showAbilTip(a,b));b.addEventListener('mouseleave',hideTip);ab.appendChild(b);barEls.push(b)})}
  B.forEach((a,i)=>{const b=barEls[i];if(b.dataset.id!==a.id){b.dataset.id=a.id;b.querySelector('canvas').replaceWith(iconCanvas(a.ic,64))}});
  if(isTouch){const tb=$('#tbtns');
    /* actiewiel: plek t.o.v. rechtsonder [right,bottom,maat]; vaardigheden 0–3 in een boog, de rest in de lade */
    const WHEEL=[[112,6,68],[100,88,68],[26,116,68],[184,80,58]];
    const mk=(cls,r,bt,sz,inner,fn,par=tb,role)=>{const b=document.createElement('button');b.className='tb '+cls;if(role)b.dataset.role=role;Object.assign(b.style,{right:r+'px',bottom:bt+'px',width:sz+'px',height:sz+'px'});b.innerHTML=inner;b.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();buzz(12);fn(b)});par.appendChild(b);return b};
    const TWHEEL=[[252,62,54],[318,36,52]];
    if(tb.children.length&&tbEls.length!==B.length){tb.innerHTML='';tbEls.length=0;const oj=$('#tJump');if(oj)oj.remove()}
    if(!tb.children.length){
      mk('big',0,0,104,'<img src="ui/icon_sword.png" alt=""><span class="lab">Attack</span>',b=>attackToggle(),tb,'big');
      const drawer=document.createElement('div');drawer.id='tdrawer';tb.appendChild(drawer);
      let tk=0;B.forEach((a,i)=>{const w=i<4?WHEEL[i]:a.talent?TWHEEL[tk++]:null;const inner='<span class="n"></span><div class="cd"></div><div class="cdt"></div>';let b;
        if(w)b=mk('ab',w[0],w[1],w[2],inner,()=>useAbility(i),tb,i<4?'a'+i:'t'+(tk-1));
        else{b=mk('ab sm',0,0,52,inner,()=>{useAbility(i);drawer.classList.remove('open')},drawer);b.style.position='relative';b.style.right=b.style.bottom='auto'}
        b.prepend(iconCanvas(a.ic,64));b.dataset.id=a.id;tbEls.push(b)});
      mk('ic',196,-4,54,'<img src="ui/icon_target.png" alt=""><span class="lab">Target</span>',()=>cycleTarget(),tb,'tgt');
      mk('ic act',258,-4,54,'<img src="ui/icon_hand.png" alt=""><span class="lab">Action</span>',()=>interact(),tb,'act');
      mk('ic mnt',190,150,48,MOUNT_SVG+'<span class="lab">Ride</span>',()=>toggleMount(),tb,'mnt');
      mk('ic shth',250,150,44,SHEATH_SVG+'<span class="lab">Sheathe</span>',()=>toggleSheath(),tb,'shth');
      mk('ic sm2',10,196,40,'<span class="arr">▲</span>',b=>{drawer.classList.toggle('open');b.classList.toggle('on',drawer.classList.contains('open'))},tb,'dr');
      const jp=document.createElement('button');jp.className='tb ic';jp.id='tJump';jp.innerHTML='<img src="ui/icon_jump.png" alt=""><span class="lab">Jump</span>';jp.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();buzz(10);S.upHeld=true;jump()});for(const e of['pointerup','pointercancel','pointerleave'])jp.addEventListener(e,()=>{S.upHeld=false});$('#touch').appendChild(jp);
      /* descend button, only while sitting on a flying mount */const dn=document.createElement('button');dn.className='tb ic';dn.id='tDown';dn.innerHTML='<img src="ui/icon_jump.png" alt="" style="transform:scaleY(-1)"><span class="lab">Down</span>';dn.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();buzz(10);S.dnHeld=true});for(const e of['pointerup','pointercancel','pointerleave'])dn.addEventListener(e,()=>{S.dnHeld=false});$('#touch').appendChild(dn);layoutTB()}
    else B.forEach((a,i)=>{const b=tbEls[i];if(b&&b.dataset.id!==a.id){b.dataset.id=a.id;b.querySelector('canvas').replaceWith(iconCanvas(a.ic,64))}});
    const big=tb.querySelector('.big');if(big)big.classList.toggle('on',!!(ME.auto&&isEnemy(ME.target)))}
  updBar()}

/* touch buttons: landscape keeps the wheel; portrait (phone held upright) gets a compact cluster, measured from the
   bottom-right corner [right,bottom,size]; target and action sit above the joystick on the left */
const TB_PORT={big:[0,0,88],a0:[96,0,58],a1:[92,74,56],a2:[16,104,56],a3:[162,40,50],t0:[160,100,46],t1:[100,140,46],dr:[20,172,38]};
function layoutTB(){const tb=$('#tbtns');if(!tb)return;const port=document.body.classList.contains('portrait');
  for(const b of tb.querySelectorAll(':scope>.tb')){const r=b.dataset.role;if(!r)continue;if(!b._land)b._land=[b.style.right,b.style.bottom,b.style.width,b.style.left];
    if(port&&TB_PORT[r]){const[x,y,z]=TB_PORT[r];Object.assign(b.style,{right:x+'px',bottom:y+'px',width:z+'px',height:z+'px',left:''})}
    else if(port&&(r==='tgt'||r==='act'||r==='mnt'||r==='shth')){Object.assign(b.style,{right:'auto',left:'',bottom:'',width:'',height:''})}
    else{const[x,y,z,l]=b._land;Object.assign(b.style,{right:x,bottom:y,width:z,height:z,left:l})}}}
/* ---------- talentpaneel ---------- */
let TAL_TAB=0;
const talD=(d,r)=>d.replace(/\{([\d.]+)\}/g,(m,v)=>String(+(parseFloat(v)*Math.max(1,r)).toFixed(1)));
function talentDot(){const f=talentFree();const d=document.querySelector('#mbTal .tdot');if(d)d.hidden=!(f>0);const ht=$('#tPts');if(ht){ht.textContent=f+' point'+(f===1?'':'s')+' free';ht.classList.toggle('has',f>0)}}
function talentTip(n,tr,el,touch){const r=talentRank(n.id),sp=treeSpent(tr),req=TIER_REQ[n.t];
  let h='<div class="tn">'+esc(n.n)+'</div><div class="ts">Rank '+r+' / '+n.max+(n.skill?' · new ability':'')+'</div>';
  if(n.skill){const a=n.skill;h+='<div class="ts">'+(a.cost?abCost(a)+' '+resName()+' · ':'')+(a.cast?a.cast+' s cast · ':'Instant · ')+(a.cd?+abCd(a).toFixed(1)+' s cooldown':'')+(a.range?' · '+a.range+' m':'')+'</div><div style="margin-top:4px">'+esc(a.d)+'</div>'}
  else if(r>0)h+='<div style="margin-top:4px">'+esc(talD(n.d,r))+'</div>';
  if(!n.skill&&r<n.max)h+='<div style="margin-top:4px"'+(r?' class="tg"':'')+'>'+(r?'Next rank: ':'')+esc(talD(n.d,r+1))+'</div>';
  if(sp<req)h+='<div class="tr">Requires '+req+' points in '+esc(tr.n)+' ('+sp+'/'+req+')</div>';
  else if(r<n.max&&talentFree()<=0)h+='<div class="tr">'+(P.level<2?'You get your first talent point at level 2':'No talent points free — gain a level')+'</div>';
  if(touch&&canLearn(n.id))h+='<div class="tb" id="tipB"><button class="btn" id="tLearn">Learn</button></div>';
  else if(!touch&&canLearn(n.id))h+='<div class="tk">Click to learn</div>';
  tipEl.innerHTML=h;placeTip(el);const lb=tipEl.querySelector('#tLearn');if(lb)lb.onclick=ev=>{ev.stopPropagation();if(learnTalent(n.id)){refreshTalent();const ne=document.querySelector('.tnode[data-id="'+n.id+'"]');if(ne)talentTip(n,tr,ne,true);else hideTip()}}}
function refreshTalent(){talentDot();if(!P||$('#pTalent').hidden)return;const trees=talentTrees();const box=$('#tTrees'),tabs=$('#tTabs');box.innerHTML='';tabs.innerHTML='';
  trees.forEach((tr,ti)=>{const sp=treeSpent(tr);const tb=document.createElement('button');tb.className='btn'+(ti===TAL_TAB?' on':' alt');tb.textContent=tr.n+' ('+sp+')';tb.onclick=()=>{TAL_TAB=ti;hideTip();refreshTalent()};tabs.appendChild(tb);
    const col=document.createElement('div');col.className='ttree'+(ti===TAL_TAB?' on':'');const hd=document.createElement('header');hd.appendChild(iconCanvas(tr.ic,48));hd.insertAdjacentHTML('beforeend','<span>'+esc(tr.n)+'</span><small>'+sp+' points</small>');col.appendChild(hd);col.insertAdjacentHTML('beforeend','<p class="tdesc">'+esc(tr.d)+'</p>');
    for(let t=0;t<TIER_REQ.length;t++){const row=document.createElement('div');row.className='trow'+(sp<TIER_REQ[t]?' lock':'');if(TIER_REQ[t])row.insertAdjacentHTML('beforeend','<span class="tl">'+TIER_REQ[t]+'</span>');
      for(const n of tr.nodes.filter(x=>x.t===t)){const r=talentRank(n.id);const b=document.createElement('button');b.className='tnode'+(n.skill?' skill':'')+(r>=n.max?' max':'')+(!r?' zero':'')+(canLearn(n.id)?' can':'');b.dataset.id=n.id;b.appendChild(iconCanvas(n.ic,64));b.insertAdjacentHTML('beforeend','<b>'+r+'/'+n.max+'</b>');
        if(isTouch)b.addEventListener('click',ev=>{ev.stopPropagation();talentTip(n,tr,b,true)});
        else{b.addEventListener('mouseenter',()=>talentTip(n,tr,b,false));b.addEventListener('mouseleave',hideTip);b.addEventListener('click',()=>{if(learnTalent(n.id)){refreshTalent();const ne=document.querySelector('.tnode[data-id="'+n.id+'"]');if(ne)talentTip(n,tr,ne,false)}})}
        row.appendChild(b)}
      col.appendChild(row)}
    box.appendChild(col)});
  $('#tFoot').innerHTML='1 talent point per level from level 2 (maximum '+(MAXLVL-1)+'). Round talents grant a new ability. You can reset them with <b>Brother Anselm</b> in Silverbrook for '+respecCost()+' gold.'}
function updBar(){const B=bar();if(isTouch){const big=document.querySelector('#tbtns .big');if(big){const on=!!(ME.auto&&isEnemy(ME.target));if(big._on!==on){big._on=on;big.classList.toggle('on',on)}}}B.forEach((a,i)=>{for(const b of[barEls[i],tbEls[i]]){if(!b)continue;const cd=Math.max(ME.cds[a.id]||0,a.item?0:ME.gcd);const tot=ME.cds[a.id]>0?(abCd(a)||1):1;const pv=cd>0?Math.round(clamp(cd/tot,0,1)*60)/60:0;if(b._p!==pv){b._p=pv;b.querySelector('.cd').style.setProperty('--p',pv)}const ct=(ME.cds[a.id]||0)>1.5?String(Math.ceil(ME.cds[a.id])):'';if(b._ct!==ct){b._ct=ct;b.querySelector('.cdt').textContent=ct}
  const lk=P.level<a.lvl,nr=!!(abCost(a)>P.mp||(a.item&&!countItem(a.item)));if(b._lk!==lk){b._lk=lk;b.classList.toggle('lock',lk)}if(b._nr!==nr){b._nr=nr;b.classList.toggle('nores',nr)}
  const n=b.querySelector('.n');const nt=a.item?String(countItem(a.item)):P.level<a.lvl?'N'+a.lvl:'';if(n.textContent!==nt)n.textContent=nt;
  if(a.range&&b.classList){const far=!!(isEnemy(ME.target)&&distTo(ME.target)-ME.target.size*.6>a.range);if(b._far!==far){b._far=far;b.classList.toggle('far',far)}}}})}
/* tooltips */
const tipEl=$('#tip');
function placeTip(anchor){const r=anchor.getBoundingClientRect();tipEl.hidden=false;const tw=tipEl.offsetWidth,th=tipEl.offsetHeight;let x=r.left+r.width/2-tw/2,y=r.top-th-8;if(y<8)y=r.bottom+8;x=clamp(x,8,innerWidth-tw-8);y=clamp(y,8,innerHeight-th-8);tipEl.style.left=x+'px';tipEl.style.top=y+'px'}
function showAbilTip(a,el){const ac=a.item?a.cost:abCost(a),at=a.item?a.cast:abCast(a),ad=a.item?a.cd:+abCd(a).toFixed(1);tipEl.innerHTML='<div class="tn">'+esc(a.n)+'</div><div class="ts">'+(ac?ac+' '+resName()+' · ':'')+(at?+at.toFixed(1)+' s cast · ':'Instant · ')+(ad?ad+' s cooldown':'')+(a.range?' · '+a.range+' m':'')+'</div><div style="margin-top:4px">'+esc(a.d)+'</div>'+(a.talent?'<div class="tk">Learned through talents</div>':'')+(P.level<a.lvl?'<div class="tr">Requires level '+a.lvl+'</div>':'');placeTip(el)}
function hideTip(){tipEl.hidden=true}
function itemHtml(it,cmp=true){if(!it)return'';let h='<div class="tn" style="color:'+rarCol(it)+'">'+esc(it.n)+(it.q>1?' x'+it.q:'')+'</div>';
  if(it.kind==='gear'){h+='<div class="ts">'+(it.s==='wapen'?(isTwoHand(it)?'Two-Hand':'One-Hand')+' · '+({zwaard:P&&P.cls==='magier'?'wand':'weapon',bijl:it.gs?'greatsword':'two-hander',staf:'staff',boog:'bow',ak:'gun'}[it.wt]||it.wt):SLOT_NL[it.s]+(it.sub?' · '+it.sub:''))+' · '+RARITY[it.r].n+'</div>';if(it.s==='wapen')h+='<div>'+it.min+' – '+it.max+' damage · speed '+it.spd.toFixed(1)+'</div>';if(it.arm)h+='<div>'+it.arm+' armour</div>';if(it.pow)h+='<div class="tg">+'+it.pow+' power</div>';if(it.sta)h+='<div class="tg">+'+it.sta+' stamina</div>';if(it.leg)h+='<div class="tlg">'+esc(it.leg)+'</div>';if(typeof setHtml==='function')h+=setHtml(it);if(it.ench&&typeof ENCH!=='undefined'&&ENCH[it.ench]){const E=ENCH[it.ench];h+='<div class="tench" style="color:'+(E.type?'#'+new THREE.Color(ENCH_TYPES[E.type].col2).getHexString():'#d8c0ff')+'">✦ Enchanted: '+esc(E.n)+' — '+esc(E.txt)+'</div>'}
    h+='<div class="'+(P.level<it.req?'tr':'ts')+'">Requires level '+it.req+'</div>';if(it.cls!==P.cls)h+='<div class="tr">Only for '+CLASSES[it.cls].n+'</div>';
    const cur=P.eq[it.s];if(cmp&&cur&&cur!==it){const df=(k,lbl)=>{const v=(it[k]||0)-(cur[k]||0);return v?'<span class="'+(v>0?'tg':'tr')+'">'+(v>0?'+':'')+v+' '+lbl+'</span> ':''};const avg=x=>x.s==='wapen'?(x.min+x.max)/2:0;const dv=Math.round(avg(it)-avg(cur));h+='<div class="cmp">Compared with '+esc(cur.n)+':<br>'+(dv?'<span class="'+(dv>0?'tg':'tr')+'">'+(dv>0?'+':'')+dv+' avg. damage</span> ':'')+df('arm','armour')+df('pow','power')+df('sta','stamina')+'</div>'}}
  else if(it.kind==='mat'){const M=MATS[it.n]||{};h+='<div class="ts">'+(M.food?'Food':M.elixir?'Elixir':'Material')+(it.r>0?' · '+RARITY[it.r].n:'')+'</div>';if(M.food||M.elixir)h+='<div class="tg">'+(M.food||M.elixir).d+' gedurende '+Math.round((M.food||M.elixir).dur/60)+' minutes. You can have one '+(M.food?'meal':'elixir')+' active at a time.</div>';else h+='<div class="ts">Use this in your crafting book (K) or sell it to a merchant.</div>'}
  else if(it.kind==='potion')h+='<div class="tg">'+(it.pt==='mana'?'Restores 50% mana, energy or focus.':'Restores 45% health.')+'</div>';else h+='<div class="ts">Junk · sell this to a merchant.</div>';
  h+='<div class="tv">Sell value: '+it.price+' gold</div>';return h}
function showItem(it,el,ctx){tipEl.innerHTML=itemHtml(it)+(ctx?'<div class="tb" id="tipB"></div>':'');if(ctx){const tb=tipEl.querySelector('#tipB');const add=(t,fn,alt)=>{const b=document.createElement('button');b.className='btn'+(alt?' alt':'');b.textContent=t;b.onclick=()=>{fn();hideTip()};tb.appendChild(b)};
    if(ctx.bag!=null){if(it.kind==='gear'){add(it.s==='wapen'?'Equip main hand':'Equip',()=>equip(ctx.bag));if(it.s==='wapen'&&canDual(P.cls)&&!isTwoHand(it))add('Equip off hand',()=>equip(ctx.bag,'offhand'));if(!S.shop)add('Disenchant',()=>disenchant(ctx.bag),1)}if(it.kind==='potion')add('Use',()=>useAbility(bar().findIndex(a=>a.item===it.pt)));if(it.kind==='mat'&&MATS[it.n]&&(MATS[it.n].food||MATS[it.n].elixir))add(MATS[it.n].food?'Eat':'Drink',()=>useConsumable(ctx.bag));if(S.shop)add('Sell ('+it.price*(it.q||1)+'g)',()=>sell(ctx.bag));else add('Discard',()=>{P.inv[ctx.bag]=null;refreshBag();saveGame()},1)}
    if(ctx.eq)add('Unequip',()=>unequip(ctx.eq),1);add('Close',()=>{},1)}placeTip(el)}
function equip(i,slot){return equipTo(i,slot)}
function unequip(s){const it=P.eq[s];if(!it)return;const i=P.inv.indexOf(null);if(i<0)return toast('Your bag is full');P.inv[i]=it;delete P.eq[s];calcStats();rebuildMe();refreshBag();refreshChar();saveGame()}
function sell(i){const it=P.inv[i];if(!it)return;P.gold+=it.price*(it.q||1);log('Sold: '+it.n+' for '+it.price*(it.q||1)+' gold.','loot');P.inv[i]=null;refreshBag();sfx('loot');saveGame();if(S.shop&&S.dlgNpc)openNpc(S.dlgNpc,true)}
function cellEl(it,onClick){const c=document.createElement('button');c.className='cell';if(it){c.classList.add(it.kind==='junk'?'rj':'r'+(it.r||0));c.appendChild(iconCanvas(itemIcon(it),48));if(it.q>1){const n=document.createElement('span');n.className='n';n.textContent=it.q;c.appendChild(n)}
  if(!isTouch){c.addEventListener('mouseenter',()=>{if(!tipEl.querySelector('#tipB'))showItem(it,c)});c.addEventListener('mouseleave',()=>{if(!tipEl.querySelector('#tipB'))hideTip()})}c.addEventListener('click',ev=>{ev.stopPropagation();onClick(c)})}return c}
function refreshBag(){if(!P)return;const g=$('#bagGrid');g.innerHTML='';P.inv.forEach((it,i)=>g.appendChild(cellEl(it,c=>{if(it&&it.kind==='gear'&&!isTouch&&!S.shop&&event&&event.shiftKey)return equip(i);showItem(it,c,{bag:i})})));$('#goldTxt').textContent=P.gold+' g';if(!$('#pChar').hidden)refreshChar()}
function refreshChar(){if(!P)return;$('#cTitle').textContent=P.name+' · level '+P.level+' '+RACES[P.race].n+' '+CLASSES[P.cls].n;const g=$('#eqGrid');g.innerHTML='';
  for(const s of SLOTS){const w=document.createElement('div');w.className='eqs';const it=P.eq[s];const c=cellEl(it,c=>showItem(it,c,{eq:s}));if(!it){c.appendChild(iconCanvas([s==='wapen'?CLASSES[P.cls].wt:s,'#3a3a3a','#141414'],48));c.style.opacity=.5}w.appendChild(c);w.insertAdjacentHTML('beforeend','<span>'+SLOT_NL[s]+'</span>');g.appendChild(w)}
  const rows=[['Health',ST.maxhp],[{energie:'Energy',mana:'Mana',focus:'Focus'}[CLASSES[P.cls].res],ST.maxmp],['Power',ST.pow],['Stamina',ST.sta],['Armour',ST.arm],['Weapon damage',ST.wmin+' – '+ST.wmax],['Critical chance',ST.crit.toFixed(1)+'%'],['Experience',P.level>=MAXLVL?'max':P.xp+' / '+xpNeed(P.level)],['Gold',P.gold],['Monsters defeated',P.kills],['Honour (PvP)',P.honor||0]];
  $('#statList').innerHTML=rows.map(r=>'<span>'+r[0]+'</span><span>'+r[1]+'</span>').join('');refreshMountList()}
/* mounts in the hero panel: owned ones can be chosen, the rest show where to get them */
function mountRow(id,extra){const d=MOUNTS[id];extra=extra||(d.fly&&!P.mounts.includes(id)?d.src+' · flying':null);const own=P.mounts.includes(id),sel=P.mountSel===id;const b=document.createElement('button');b.className='mrow'+(own?' own':'')+(sel?' sel':'');
  b.innerHTML='<span class="mic">'+MOUNT_SVG+'</span><span class="mt"><b>'+esc(d.n)+'</b><small>'+esc(extra||(own?(sel?'Chosen mount':'Click to choose'):d.src))+'</small></span>';return b}
function pickMount(id){P.mountSel=id;if(ME.mounted&&ME.mounted!==id){ME.mounted=id}sfx('chat');saveGame()}
function refreshMountList(){const L=$('#mountList');if(!L||!P)return;ensureMounts();L.innerHTML='';
  for(const id in MOUNTS){const own=P.mounts.includes(id);const b=mountRow(id);if(own)b.onclick=()=>{pickMount(id);refreshMountList()};else b.disabled=true;L.appendChild(b)}
  $('#mountHd').textContent='Mounts '+P.mounts.length+' / '+Object.keys(MOUNTS).length+' · press R to ride'}
/* the stable shop (Stablemaster Hob) */
function stableShop(n){const L=$('#stableL');if(!L)return;ensureMounts();
  for(const id in MOUNTS){const d=MOUNTS[id];if(!d.price&&id!=='horse')continue;const own=P.mounts.includes(id);
    const lvOk=!d.lvl||P.level>=d.lvl;const b=mountRow(id,own?(P.mountSel===id?'Your chosen mount':'Owned · click to choose'):d.price+' gold'+(d.fly?' · flying':'')+(!lvOk?' · requires level '+d.lvl:P.gold<d.price?' (not enough gold)':''));
    b.onclick=()=>{if(own){pickMount(id);openNpc(n,true);return}if(d.lvl&&P.level<d.lvl)return toast('Requires level '+d.lvl);if(P.gold<d.price)return toast('Not enough gold');P.gold-=d.price;learnMount(id,'Bought from Stablemaster Hob · press R to ride');refreshBag();openNpc(n,true)};L.appendChild(b)}}
/* quests */
function qState(q){if(P.done.includes(q.id))return'done';const a=P.quests[q.id];if(a)return a.n>=q.obj.n?'ready':'active';if(P.level>=q.lvl-1&&(!q.req||P.done.includes(q.req)))return'avail';return'locked'}
function refreshTracker(){if(!P)return;const el=$('#tracker');const act=QUESTS.filter(q=>P.quests[q.id]);el.innerHTML=act.map(q=>{const a=P.quests[q.id];const d=a.n>=q.obj.n;return'<div><b>'+esc(q.n)+'</b><span class="'+(d?'done':'')+'">'+(d?'✓ Return to '+esc(npcName(q.giver)):'- '+esc(q.obj.lbl)+': '+a.n+'/'+q.obj.n)+'</span></div>'}).join('');el.classList.toggle('show',act.length>0)}
function refreshQuestLog(){const act=QUESTS.filter(q=>P.quests[q.id]);const L=$('#qList');L.innerHTML=act.length?'':'<p style="color:var(--muted)">You have no active quests. Look for people with a yellow <b style="color:#ffd100">!</b> above their head.</p>';
  for(const q of act){const a=P.quests[q.id];const d=document.createElement('div');d.className='qrow';d.innerHTML='<b>'+esc(q.n)+'</b> <small style="color:var(--muted)">(level '+q.lvl+')</small><p>'+esc(q.txt)+'</p><p>'+esc(q.obj.lbl)+': <b>'+a.n+'/'+q.obj.n+'</b> · From: '+esc(npcName(q.giver))+'</p>';const b=document.createElement('button');b.className='btn alt';b.style.cssText='min-height:32px;padding:4px 10px;font-size:12px';b.textContent='Abandon';b.onclick=()=>{delete P.quests[q.id];refreshQuestLog();refreshTracker();refreshNpcMarks();saveGame()};d.appendChild(b);L.appendChild(d)}
  const done=P.done.length;L.insertAdjacentHTML('beforeend','<p style="color:var(--muted);font-size:13px;margin-top:10px">Completed quests: '+done+' / '+QUESTS.length+'</p>')}
function npcMark(n){let m='';for(const q of QUESTS){if(q.giver!==n.id)continue;const s=qState(q);if(s==='ready')return'?';if(s==='avail')m='!';else if(s==='active'&&!m)m='a'}return m}
function refreshNpcMarks(){for(const n of NPCOBJ)n.mark=P?npcMark(n):''}
function openNpc(n,keep){if(Math.hypot(n.x-ME.pos.x,n.z-ME.pos.z)>6)return toast('You are too far away');S.dlgNpc=n;if(!keep){n.rig.g.rotation.y=Math.atan2(ME.pos.x-n.x,ME.pos.z-n.z)}
  $('#dName').textContent=n.n;const b=$('#dBody');let h='<p>'+esc(n.def.hi)+'</p>';const qs=QUESTS.filter(q=>q.giver===n.id);
  for(const q of qs){const s=qState(q);if(s==='done'||s==='locked')continue;h+='<button class="dq" data-q="'+q.id+'"><span class="m">'+(s==='ready'?'?':s==='avail'?'!':'…')+'</span>'+esc(q.n)+(s==='active'?' (bezig)':s==='ready'?' (voltooien)':'')+'</button>'}
  if(qs.length&&qs.every(q=>qState(q)==='done'))h+='<p><i>You have done everything I could ask of you. Thank you, hero.</i></p>';
  if(qs.some(q=>qState(q)==='locked')&&!qs.some(q=>['avail','active','ready'].includes(qState(q)))&&!qs.every(q=>qState(q)==='done'))h+='<p><i>Come back when you have grown stronger.</i></p>';
  if((n.id==='anselm'||n.def.priest)&&P.level>=2){const c=respecCost(),sp=talentSpent();h+='<p style="margin-top:10px"><i>The Light can cleanse your mind, so you can choose your talents again.</i></p><div class="row"><button class="btn" id="respecB"'+(sp?'':' disabled')+'>Reset talents ('+c+' gold)</button></div>'}
  if(n.def.gearshop){h+='<b>For sale</b> <small style="opacity:.8">(the stock grows with your level)</small><div class="shop" id="gearL"></div><p style="font-size:13px;margin-top:8px">You have <b>'+P.gold+'</b> gold.</p>'}
  if(n.def.inn)h+='<div class="row" style="margin-top:8px"><button class="btn" id="innHome">'+(P.home==='ws'?'Make Silverbrook your home again':'Rest here: make WindStorm your home')+'</button></div><p style="font-size:13px;margin-top:6px">Your hearthstone takes you home. Right now that is <b>'+(P.home==='ws'?'WindStorm':'Silverbrook')+'</b>.</p>';
  if(n.def.stable)h+='<b>Mounts for sale</b><div class="mlist" id="stableL"></div><p style="font-size:13px;margin-top:8px">Rare mounts can only be found on mighty bosses. You have <b>'+P.gold+'</b> gold.</p>';
  S.shop=!!n.def.shop;if(S.shop){h+='<b>For sale</b><div class="shop" id="shopL"></div>';const junk=P.inv.reduce((s,x)=>s+(x&&x.kind==='junk'?x.price*x.q:0),0);h+='<div class="row"><button class="btn" id="sellJ"'+(junk?'':' disabled')+'>Sell all junk ('+junk+'g)</button></div><p style="font-size:13px;margin-top:8px">Tip: open your bag to sell gear. You have <b>'+P.gold+'</b> gold.</p>'}
  b.innerHTML=h;b.querySelectorAll('[data-q]').forEach(x=>x.onclick=()=>showQuest(n,QUESTS.find(q=>q.id===x.dataset.q)));
  if(S.shop){const sl=$('#shopL');for(const[pt,pr]of[['heal',3],['mana',3]]){const it=potion(pt);const bt=document.createElement('button');bt.appendChild(iconCanvas(itemIcon(it),40));bt.insertAdjacentHTML('beforeend','<span>'+it.n+'<br><small>'+pr+' gold</small></span>');bt.onclick=()=>{if(P.gold<pr)return toast('Not enough gold');if(!addItem(potion(pt)))return toast('Your bag is full');P.gold-=pr;sfx('loot');refreshBag();openNpc(n,true);saveGame()};sl.appendChild(bt)}
    $('#sellJ').onclick=()=>{let g=0;P.inv.forEach((x,i)=>{if(x&&x.kind==='junk'){g+=x.price*x.q;P.inv[i]=null}});P.gold+=g;log('Junk sold for '+g+' gold.','loot');sfx('loot');refreshBag();openNpc(n,true);saveGame()}}
  if(n.def.stable)stableShop(n);
  if(n.def.gearshop){const L=$('#gearL');const lv=Math.min(P.level+1,26);if(!S.gearStock||S.gearStock.lv!==lv||S.gearStock.cls!==P.cls){S.gearStock={lv,cls:P.cls,items:['wapen','offhand','hoofd','borst','handen','benen','voeten','ring'].map((s2,i)=>{const it=makeGear(s2,lv,i===0||Math.random()<.25?2:1,P.cls);it.req=Math.max(1,lv-1);it.shop=Math.round(it.price*4+lv*6);return it})}}
    for(const it of S.gearStock.items){if(it.sold)continue;const bt=document.createElement('button');bt.appendChild(iconCanvas(itemIcon(it),40));bt.insertAdjacentHTML('beforeend','<span style="color:'+(['#3b2a14','#16702a','#1a4ea8','#7a24b8','#b0560a'][it.r]||'#3b2a14')+'">'+esc(it.n)+'<br><small style="color:inherit;opacity:.85">'+it.shop+' gold · level '+it.req+'</small></span>');
      bt.onmouseenter=()=>{if(!isTouch)showItem(it,bt)};bt.onmouseleave=()=>{if(!isTouch)hideTip()};
      bt.onclick=()=>{if(P.gold<it.shop)return toast('Not enough gold');const c={...it};delete c.shop;delete c.sold;c.id=uid();if(!addItem(c))return toast('Your bag is full');P.gold-=it.shop;it.sold=1;sfx('loot');log('You buy: <span style="color:'+rarCol(c)+'">['+esc(c.n)+']</span>','loot',true);refreshBag();openNpc(n,true);saveGame()};L.appendChild(bt)}}
  {const ib=$('#innHome');if(ib)ib.onclick=()=>{P.home=P.home==='ws'?'':'ws';sfx('quest');log(P.home==='ws'?'WindStorm is now your home: your hearthstone takes you here.':'Silverbrook is your home again.','sys');saveGame();openNpc(n,true)}}
  const rb=$('#respecB');if(rb)rb.onclick=()=>{if(respecTalents()){openNpc(n,true);refreshTalent()}};
  openPanel('pDialog');S.shop=!!n.def.shop}
function rewardHtml(q){return'<div class="rew"><span>'+q.xp+' XP</span><span style="color:#8a6a00">'+q.gold+' gold</span>'+(q.item?'<span style="color:'+['#000','#1a8a2a','#1a5ab8','#8a2ac8'][q.item]+'">'+RARITY[q.item].n+' item</span>':'')+(q.pots?'<span>'+q.pots+' potions</span>':'')+'</div>'}
function showQuest(n,q){const s=qState(q);const b=$('#dBody');const a=P.quests[q.id];
  b.innerHTML='<p><b>'+esc(q.n)+'</b></p><p>'+esc(s==='ready'?q.done:q.txt)+'</p><div class="obj">'+esc(q.obj.lbl)+': '+(a?a.n:0)+' / '+q.obj.n+'</div><p style="margin:6px 0 4px"><b>Reward</b></p>'+rewardHtml(q)+'<div class="row" style="margin-top:12px" id="qBtns"></div>';
  const bb=$('#qBtns');const add=(t,fn,alt)=>{const x=document.createElement('button');x.className='btn'+(alt?' alt':'');x.textContent=t;x.onclick=fn;bb.appendChild(x)};
  if(s==='avail')add('Accept',()=>{P.quests[q.id]={n:0};log('Quest accepted: '+q.n,'sys');sfx('quest');refreshTracker();refreshNpcMarks();saveGame();closePanel('pDialog')});
  if(s==='ready')add('Complete',()=>completeQuest(q));add('Back',()=>openNpc(n,true),1)}
function completeQuest(q){delete P.quests[q.id];P.done.push(q.id);P.gold+=q.gold;log('Quest completed: '+q.n+' (+'+q.gold+' gold)','sys');sfx('quest');
  if(q.item){const it=makeGear(q.id==='q6'?'wapen':randSlot(),q.lvl+1,q.item,P.cls);if(!addItem(it)){toast('Your bag is full: the item lies on the ground.')}else log('Reward: <span style="color:'+rarCol(it)+'">['+esc(it.n)+']</span>','loot',true)}
  if(q.pots){addItem(potion('heal',q.pots))}if(q.life)for(const k in q.life)lifeXp(k,q.life[k]);gainXp(q.xp,'me');banner('Quest completed',q.n);refreshTracker();refreshNpcMarks();refreshBag();closePanel('pDialog');saveGame()}
/* party frames */
function refreshParty(){const el=$('#party');if(!GROUP||S.mode!=='play'){el.innerHTML='';return}let h='';for(const id of GROUP.members){if(id===myId())continue;const r=REMOTES.get(id);if(!r)continue;h+='<div class="pm frame" data-id="'+id+'"><b><span>'+(GROUP.leader===id?'★ ':'')+esc(r.n)+'</span><small>'+r.lvl+' '+CLASSES[r.cls].n+'</small></b><div class="bar hpb"><i style="transform:scaleX('+clamp(r.hp/Math.max(1,r.mhp),0,1)+')"></i><span>'+(r.dead?'Dead':r.hp+'/'+r.mhp)+'</span></div></div>'}
  h+='<button class="btn alt" id="gLeave">Leave group</button>';el.innerHTML=h;el.querySelectorAll('.pm').forEach(x=>x.onclick=()=>{const r=REMOTES.get(x.dataset.id);if(r)setTarget(r)});$('#gLeave').onclick=leaveGroup}
/* chat */
const chatIn=$('#chatIn');
function openChat(){$('#chat').classList.add('open');chatIn.focus();logEl.scrollTop=1e9}
function closeChat(){$('#chat').classList.remove('open');chatIn.blur();chatIn.value=''}
chatIn.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter'){const t=chatIn.value.trim();if(t)sendChat(t);closeChat()}else if(ev.key==='Escape')closeChat()});
chatIn.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==chatIn)$('#chat').classList.remove('open')},150));
function sendChat(t){t=t.slice(0,120);if(/^\/(g|groep|p) /i.test(t)){const m=t.replace(/^\/\S+ /,'');if(!GROUP)return log('You are not in a group.','err');netEmit('chat',{t:m,g:GROUP.leader});log('<span class="c-grp">[Group] '+esc(P.name)+': '+esc(m)+'</span>','grp',true);return}
  if(/^\/(inv|uitnodigen) /i.test(t)){const nm=t.replace(/^\/\S+ /,'').toLowerCase();const r=[...REMOTES.values()].find(x=>x.n.toLowerCase()===nm);if(!r)return log('Player not found: '+nm,'err');return inviteToGroup(r)}
  if(/^\/admin\b/i.test(t))return adminCmd(t.replace(/^\/admin\s*/i,''));
  if(/^\/(verlaat|leave)/i.test(t))return leaveGroup();
  if(/^\/pvp/i.test(t))return setPvp(!P.pvp);
  if(/^\/(help|\?)/i.test(t))return log('Commands: /g message (group chat), /inv name (invite), /leave (leave group), /pvp (toggle PvP)','sys');
  netEmit('chat',{t});log('<b>'+esc(P.name)+':</b> '+esc(t),'say',true);ME.bubble={t:t.slice(0,60),until:performance.now()+5000};if(!room||!room.connected())log('(You are offline: nobody can hear you.)','err')}
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
    if(e.kind==='mon'){const hp=Math.round(e.hp/e.mhp*100);key=e.lvl+'|'+hp+'|'+tg+'|'+e.dead+'|'+(e.loot?1:0)+'|'+(P&&P.level);html=e.dead?'<span style="color:#ffd34d">Loot</span>':'<span style="color:'+conCol(e.lvl)+'">'+(e.t.boss?'':e.lvl+' ')+esc(e.t.n)+'</span>'+(tg||e.hp<e.mhp?'<div class="pb"><i style="width:'+hp+'%"></i></div>':'');pl.className='plate'+(tg?' tgt':'')}
    else if(e.kind==='node'){key='n';html='<span style="color:#d8f0a0;font-size:12px;font-weight:600">'+esc(e.name)+'</span>';pl.className='plate'}
    else if(e.kind==='npc'){key=e.mark+'|'+tg;html=(e.mark==='!'||e.mark==='?'?'<div class="q">'+e.mark+'</div>':e.mark==='a'?'<div class="q" style="color:#bbb">?</div>':'')+esc(e.n)+'<br><small style="color:#cfe9cf;font-weight:500">&lt;'+esc(e.t)+'&gt;</small>';pl.className='plate npc'}
    else{const b=(e.kind==='self'?ME.bubble:e.bubble);const bt=b&&b.until>performance.now()?b.t:'';const hos=e.kind==='pl'&&pvpHostile(e);key=(e.n||'')+'|'+bt+'|'+(e.lvl||0)+'|'+(GROUP&&GROUP.members.includes(e.id))+'|'+hos+'|'+e.pvp;html=(bt?'<div style="background:rgba(255,255,255,.92);color:#222;padding:4px 8px;border-radius:8px;max-width:220px;white-space:normal;margin-bottom:3px;font-weight:600;text-shadow:none">'+esc(bt)+'</div>':'')+(e.kind==='self'?'':(e.pvp?'⚔ ':'')+esc(e.n)+' <small>('+e.lvl+')</small>');pl.className='plate '+(GROUP&&GROUP.members.includes(e.id)?'grp':hos?'hos':'pl')}
    if(key!==e.plateKey||(e.kind==='self'&&key!==ME.selfKey)){if(e.kind==='self')ME.selfKey=key;else e.plateKey=key;pl.innerHTML=html}}}
/* minimap */
const mapImg=(()=>{const c=document.createElement('canvas');c.width=c.height=HN;const g=c.getContext('2d');const d=g.createImageData(HN,HN);const col=terrain.geometry.attributes.color.array;for(let i=0;i<HN*HN;i++){for(let k=0;k<3;k++)d.data[i*4+k]=Math.pow(col[i*3+k],1/2.2)*255*1.05;d.data[i*4+3]=255}g.putImageData(d,0,0);
  const big=document.createElement('canvas');big.width=big.height=640;const b=big.getContext('2d');b.imageSmoothingEnabled=true;b.drawImage(c,0,0,640,640);const m=x=>x+320;
  b.fillStyle='#3a7ea8';b.beginPath();b.arc(m(LAKE.x),m(LAKE.z),LAKE.r*.95,0,7);b.fill();b.fillStyle='rgba(30,50,20,.22)';for(const t of pineT){b.fillRect(m(t[0])-1,m(t[1])-1,2,2)}
  b.fillStyle='#5a4a3a';for(const x of BOXES)b.fillRect(m(x.x0),m(x.z0),x.x1-x.x0,x.z1-x.z0);b.strokeStyle='#8a8478';b.lineWidth=2;b.beginPath();b.arc(m(0),m(0),TOWN.wall,0,7);b.stroke();b.fillStyle='#3a7ea8';b.beginPath();b.ellipse(m(POND.x),m(POND.z),POND.r*1.25,POND.r,0,0,7);b.fill();b.strokeStyle='#6a4a2a';b.beginPath();b.arc(m(CAMP.x),m(CAMP.z),25,0,7);b.stroke();b.fillStyle='#2a2a2a';b.fillRect(m(CRYPT.x)-7,m(CRYPT.z)-6,14,6);return big})();
const dunImg=(()=>{const c=document.createElement('canvas');c.width=DC*12;c.height=DR*12;const g=c.getContext('2d');g.fillStyle='#120e14';g.fillRect(0,0,c.width,c.height);for(let r=0;r<DR;r++)for(let k=0;k<DC;k++)if(DMAP[r][k]!=='#'){g.fillStyle='#5a5560';g.fillRect(k*12,r*12,12,12)}return c})();
const mm=$('#mmc'),mg=mm.getContext('2d');
function w2m(x,z,cx,cz,sc,W){return[W/2+(x-cx)*sc,W/2+(z-cz)*sc]}
function drawMini(){const W=mm.width,inD=ME.pos.x>700;mg.save();mg.clearRect(0,0,W,W);mg.beginPath();mg.arc(W/2,W/2,W/2,0,7);mg.clip();mg.fillStyle='#4a6a34';mg.fillRect(0,0,W,W);
  const sc=inD?1.6:1.1;const cx=ME.pos.x,cz=ME.pos.z;
  if(ME.pos.x>1250){const D=ME.pos.x>2200?D4:ME.pos.x>1700?D3:D2;const ox=D.X-D.C/2*D.c,oz=D.Z-D.R/2*D.c;const[x0,y0]=w2m(ox,oz,cx,cz,sc,W);mg.drawImage(D.img,x0,y0,D.C*D.c*sc,D.R*D.c*sc)}
  else if(inElv(ME.pos.x)){const[x0,y0]=w2m(ELV.x-ESZ/2,ELV.z-ESZ/2,cx,cz,sc,W);mg.drawImage(elvImg,x0,y0,ESZ*sc,ESZ*sc)}
  else if(inDrk(ME.pos.x)){const[x0,y0]=w2m(DRK.x-DSZ/2,DRK.z-DSZ/2,cx,cz,sc,W);mg.drawImage(drkImg,x0,y0,DSZ*sc,DSZ*sc)}
  else if(inD){const ox=DUN.x-DC/2*DUN.c,oz=DUN.z-DR/2*DUN.c;const[x0,y0]=w2m(ox,oz,cx,cz,sc,W);mg.drawImage(dunImg,x0,y0,DC*DUN.c*sc,DR*DUN.c*sc)}
  else{const[x0,y0]=w2m(-320,-320,cx,cz,sc,W);mg.drawImage(ATLAS.c||mapImg,x0,y0,640*sc,640*sc)}
  const dot=(x,z,c,r=3)=>{const[a,b]=w2m(x,z,cx,cz,sc,W);if(a<-5||b<-5||a>W+5||b>W+5)return;mg.fillStyle=c;mg.beginPath();mg.arc(a,b,r,0,7);mg.fill()};
  for(const m of MONS)if(!m.dead&&Math.abs(m.x-cx)<120)dot(m.x,m.z,m.t.boss?'#ff40ff':'#e03030',m.t.elite?4:2.6);
  for(const n of NPCOBJ){if(n.mark==='!'||n.mark==='?'){const[a,b]=w2m(n.x,n.z,cx,cz,sc,W);mg.fillStyle='#ffd100';mg.font='800 16px Cinzel,serif';mg.textAlign='center';mg.fillText(n.mark,a,b+6)}else dot(n.x,n.z,'#ffd34d',2.5)}
  if(!inD)for(const n of NODES)if(!n.down&&Math.abs(n.x-cx)<110&&Math.abs(n.z-cz)<110)dot(n.x,n.z,n.type==='kruid'?'#e8ff6a':n.type==='erts'?'#d0d0d8':'#c8945a',1.8);
  for(const r of REMOTES.values())dot(r.x,r.z,GROUP&&GROUP.members.includes(r.id)?'#40ffa0':pvpHostile(r)?'#ff4040':'#5ab0ff',3.5);
  if(inDrk(ME.pos.x)){for(const[x,z,c]of[[DRK_EXIT.x,DRK_EXIT.z,'#6ac8ff'],[VOLC_DOOR.x,VOLC_DOOR.z,'#ff7a30']]){const[a,b]=w2m(x,z,cx,cz,sc,W);mg.fillStyle=c;mg.fillRect(a-3,b-3,6,6)}}
  if(inElv(ME.pos.x)){const[a,b]=w2m(HOLLOW.x,HOLLOW.z,cx,cz,sc,W);mg.fillStyle='#8aff5a';mg.fillRect(a-3,b-3,6,6)}
  else if(!inD){{const[a,b]=w2m(DRK_GATE.x,DRK_GATE.z,cx,cz,sc,W);mg.fillStyle='#ff5a1a';mg.fillRect(a-3,b-3,6,6)}{const[a,b]=w2m(CAVE.x,CAVE.z,cx,cz,sc,W);mg.fillStyle='#ff7a30';mg.fillRect(a-3,b-3,6,6)}const[a,b]=w2m(CRYPT.x,CRYPT.z,cx,cz,sc,W);mg.fillStyle='#b06aff';mg.fillRect(a-3,b-3,6,6)}
  mg.restore();mg.save();mg.translate(W/2,W/2);mg.rotate(-ME.ry+Math.PI);mg.fillStyle='#fff';mg.strokeStyle='#000';mg.lineWidth=1.5;mg.beginPath();mg.moveTo(0,-8);mg.lineTo(6,7);mg.lineTo(0,3);mg.lineTo(-6,7);mg.closePath();mg.fill();mg.stroke();mg.restore();
  mg.fillStyle='#e8c06a';mg.font='700 14px Cinzel,serif';mg.textAlign='center';mg.fillText('N',W/2,14)}
let zoneName='';function updZone(force){const z=zoneAt(ME.pos.x,ME.pos.z);if(z!==zoneName||force){const changed=z!==zoneName;zoneName=z;$('#zone').textContent=z;if(changed&&S.mode==='play'){banner(z,z==='Crypt of Kaal-Morath'?'Recommended: level 8+ and a group':z==='Heart of the Volcano'?'Recommended: level 18–20 · Vyraxion the Ash Queen awaits':z==='Ash Plains'||z==='Dragonhunters\' Camp'?'The Dragon Realm · level 13–20':z==='Dragon Pass'?'To the Dragon Realm (level 13+)':z==='Silverbrook'?'A safe haven':z==='Arena of Silverbrook'?'PvP is always active here — whoever opens the chest gets the AK-47':'',2.2)}}}
