/* ===================== The character sheet (C) =====================
   Three tabs:
   - Character: your hero in 3D in the middle (drag to turn, slowly turns by itself), the ten gear slots around it with
     name, item level, enchantment and gem; health, resource and experience bars, and your average item level.
   - Statistics: attributes, offence, defence and utility, worked out from the same numbers the game uses in combat,
     plus every bonus that is active (set bonuses, enchantments, gems, talents, food and elixirs).
   - Records: titles, professions, mounts, house, trophies and the numbers of your adventure.
   The 3D view has its own small renderer and scene; it only runs while the sheet is open on the Character tab. */
let CS_TAB='char';
const CS={r:null,canvas:null,scene:null,cam:null,rig:null,key:'',yaw:-.5,vy:0,drag:null,raf:0,last:0,h:2,auto:1};
const CS_TITLES=[['q6','Hero of Silverbrook'],['q8','Flamebreaker'],['d6','Dragonslayer'],['r23','Voidbreaker'],['r27','Voice of Velmora'],['r28','Bane of the Riftlord']];
function csTitles(){return CS_TITLES.filter(([q])=>P.done.includes(q)).map(t=>t[1])}
const CS_LEFT=['hoofd','schouders','rug','borst','ring'],CS_RIGHT=['handen','benen','voeten','wapen','offhand'];
function csAvgIl(){let s=0;for(const k of SLOTS){const it=P.eq[k];if(it)s+=it.il||1}return s/SLOTS.length}
function csSlot(s){const it=P.eq[s];const row=document.createElement('div');row.className='csl'+(it?' r'+(it.r|0):' empty');
  const c=cellEl(it,c=>{if(it)showItem(it,c,{eq:s})});if(!it){c.appendChild(iconCanvas([s==='wapen'?CLASSES[P.cls].wt:s,'#3a3a3a','#141414'],48));c.style.opacity=.45}row.appendChild(c);
  const E=it&&it.ench&&typeof ENCH!=='undefined'&&ENCH[it.ench];const G=it&&it.gem&&MATS[it.gem]&&MATS[it.gem].gem;
  row.insertAdjacentHTML('beforeend','<div class="cst"><small>'+esc(SLOT_NL[s]||s)+'</small>'+(it?'<b style="color:'+rarCol(it)+'">'+esc(it.n)+'</b><i>item level '+(it.il||1)+(E?' · <span class="ce">✦ '+esc(E.n)+'</span>':'')+(G?' · <span style="color:'+MATS[it.gem].t+'">◆ '+esc(it.gem)+'</span>':'')+'</i>':'<i class="cse">Empty</i>')+'</div>');
  return row}
function csBar(cls,lbl,v,max){const f=max>0?clamp(v/max,0,1):0;return'<div class="csbar '+cls+'"><i style="width:'+(f*100).toFixed(1)+'%"></i><span>'+lbl+'</span><b>'+v+(max!=null?' / '+max:'')+'</b></div>'}
function refreshChar(){if(!P)return;const b=$('#csBody');if(!b)return;
  const T=csTitles();if(P.title&&!T.includes(P.title))P.title='';const C=CLASSES[P.cls],R=RACES[P.race];
  $('#cTitle').innerHTML='<span class="csn">'+esc(P.name)+'</span>'+(P.title?'<span class="cstt">'+esc(P.title)+'</span>':'');
  $('#csSub').innerHTML='Level '+P.level+' '+esc(R.n)+' '+esc(C.n)+' · <b>item level '+csAvgIl().toFixed(1)+'</b>';
  $('#csTabs').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x.dataset.ct===CS_TAB));
  if(CS_TAB==='char'){b.innerHTML='<div class="csdoll"><div class="cscol" id="csL"></div><div class="csmid"><canvas id="csCv"></canvas><div class="cshint">'+(isTouch?'Swipe':'Drag')+' to turn</div><div class="csbars" id="csBars"></div></div><div class="cscol" id="csR"></div></div>';
    for(const s of CS_LEFT)$('#csL').appendChild(csSlot(s));for(const s of CS_RIGHT)$('#csR').appendChild(csSlot(s));
    const res={energie:'Energy',mana:'Mana',focus:'Focus'}[C.res];
    $('#csBars').innerHTML=csBar('hp','Health',Math.round(P.hp),ST.maxhp)+csBar('mp',res,Math.round(P.mp),ST.maxmp)+(P.level>=MAXLVL?csBar('xp','Experience','max level',null):csBar('xp','Experience',P.xp,xpNeed(P.level)));
    csStart()}
  else if(CS_TAB==='stats'){csStop();b.innerHTML=csStatsHtml()}
  else{csStop();b.innerHTML=csRecordsHtml();const sel=$('#csTitleSel');if(sel)sel.onchange=()=>{P.title=sel.value;saveGame();refreshChar()};refreshMountList()}}
/* ---- statistics ---- */
function csStatsHtml(){const C=CLASSES[P.cls];const pct=v=>(v*100).toFixed(v*100<10?1:0)+'%';const red=ST.arm/(ST.arm+40+P.level*12);
  const haste=TM('haste'),spd=ST.spd/(1+haste);const avgHit=((ST.wmin+ST.wmax)/2+ST.pow*.45+P.level)*ST.dmgMul*(1+TM('wdmg'));const critC=Math.min(100,ST.crit),critD=1.5+TM('critdmg');
  const dps=avgHit/Math.max(.2,spd)*(1+critC/100*(critD-1));const resN={energie:'Energy',mana:'Mana',focus:'Focus'}[C.res];
  const grp=(t,rows)=>'<section class="csg"><h5>'+t+'</h5>'+rows.filter(Boolean).map(([k,v,d])=>'<div title="'+esc(d||'')+'"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</section>';
  let h='<div class="csstats">';
  h+=grp('Attributes',[['Health',ST.maxhp,'Stamina, level and bonuses'],[resN,ST.maxmp],['Power',ST.pow,'Raises damage, healing and critical chance'],['Stamina',ST.sta,'Every point gives 8 health'],['Level',P.level+' / '+MAXLVL]]);
  h+=grp('Offence',[['Weapon damage',ST.wmin+' – '+ST.wmax],ST.owmax?['Off-hand damage',ST.owmin+' – '+ST.owmax]:null,['Attack speed',spd.toFixed(2)+' s'+(haste?' (+'+pct(haste)+')':'')],['Damage per second','≈ '+Math.round(dps),'An estimate for auto attacks, with critical hits'],
    ['Critical chance',critC.toFixed(1)+'%'],['Critical damage',pct(critD)],TM('wdmg')?['Damage bonus','+'+pct(TM('wdmg'))]:null,TM('exec')?['Execute bonus','+'+pct(TM('exec'))+' below 35% health']:null,TM('heal')?['Healing bonus','+'+pct(TM('heal'))]:null]);
  h+=grp('Defence',[['Armour',ST.arm],['Damage reduction',pct(red),'From armour, against an enemy of your level'],TM('dr')?['Less damage taken',pct(Math.min(.75,TM('dr')))]:null,TM('dodge')?[P.cls==='krijger'||P.cls==='paladijn'?'Block chance':'Dodge chance',pct(TM('dodge'))]:null,TM('regen')?['Health regeneration',TM('regen').toFixed(1)+' / s']:null]);
  h+=grp('Utility',[['Movement speed','+'+pct(TM('speed'))],['Ability cooldowns',TM('cdall')?'−'+pct(TM('cdall')):'—'],['Ability costs',TM('costall')?'−'+pct(TM('costall')):'—'],[resN+' regeneration',TM('mregen')?'+'+pct(TM('mregen')):'—'],['Talent points',talentSpent()+' / '+talentPoints()]]);
  /* every bonus that is active right now */
  const B=[];for(const s of SLOTS){const it=P.eq[s];if(!it)continue;if(it.leg)B.push(['tlg',it.leg]);const E=it.ench&&ENCH[it.ench];if(E)B.push(['ce','✦ '+E.n+': '+E.txt]);const G=it.gem&&MATS[it.gem]&&MATS[it.gem].gem;if(G)B.push(['cg','◆ '+it.gem+': '+G.txt])}
  if(typeof ALL_SETS==='function')for(const SM of ALL_SETS()){const S=SM[P.cls];if(!S)continue;const n=setCountOf(S);if(!n)continue;B.push(['cs',S.n+' ('+n+'/5)'+(n>=3?' · 3: '+S.b3.d:'')+(n>=5?' · 5: '+S.b5.d:'')])}
  for(const k of['food','elixir']){const bf=P.buffs&&P.buffs[k];if(bf&&bf.until>Date.now()){const M=MATS[bf.n]||{};const f=M[k];if(f)B.push(['cf',(k==='food'?'🍲 ':'⚗ ')+bf.n+': '+f.d+' · '+Math.ceil((bf.until-Date.now())/60000)+' min left'])}}
  h+='<section class="csg csbon"><h5>Active bonuses</h5>'+(B.length?B.map(([c,t])=>'<p class="'+c+'">'+esc(t)+'</p>').join(''):'<p class="cse">No enchantments, gems, set bonuses or buffs yet.</p>')+'</section></div>';return h}
/* ---- records ---- */
function csRecordsHtml(){const T=csTitles();let h='<div class="csrec">';
  h+='<section class="csg"><h5>Title</h5>'+(T.length?'<select id="csTitleSel"><option value="">No title</option>'+T.map(t=>'<option'+(P.title===t?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select><p class="cse">Shown under your name on this sheet.</p>':'<p class="cse">Titles are earned by finishing the great quest lines: the Bone King, the Ash Queen, the Song of the Void…</p>')+'</section>';
  const prof=Object.keys(LIFE).map(k=>[k,lifeOf(k).lv]).sort((a,b)=>b[1]-a[1]);
  h+='<section class="csg"><h5>Professions</h5><div class="csprof">'+prof.map(([k,l])=>'<div><span>'+esc(LIFE[k].n)+'</span><small>'+rankOf(l)+'</small><i><b style="width:'+((l+1)/(RANKS.length*10)*100).toFixed(1)+'%"></b></i></div>').join('')+'</div></section>';
  const H=P.house;const tro=(P.trophies||[]).length;
  h+=grp2('Adventure',[['Monsters defeated',P.kills|0],['Quests completed',P.done.length+' / '+QUESTS.length],['Honour (PvP)',P.honor|0],['Gold',P.gold],['Trophy statues',tro+' / '+(typeof TROPHIES!=='undefined'?TROPHIES.length:0)],['House',H?HOUSE_TIERS[H.t].n+(H.placed?'':' (not built)'):'—']]);
  h+='<section class="csg csmounts"><h5 id="mountHd" class="mhd">Mounts</h5><div class="mlist" id="mountList"></div></section></div>';return h}
const grp2=(t,rows)=>'<section class="csg"><h5>'+t+'</h5>'+rows.map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</section>';
/* ---- the 3D view ---- */
function csStart(){const cv=$('#csCv');if(!cv)return;
  if(!CS.r||CS.canvas!==cv){if(CS.r){CS.r.dispose();CS.r=null}CS.canvas=cv;try{CS.r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){console.warn('sheet renderer',e);return}
    CS.r.outputColorSpace=THREE.SRGBColorSpace;CS.r.toneMapping=THREE.ACESFilmicToneMapping;CS.r.toneMappingExposure=1.1;
    if(!CS.scene){const s=new THREE.Scene();CS.scene=s;s.add(new THREE.HemisphereLight(0xfff2dc,0x3a2a1c,1.7));const k=new THREE.DirectionalLight(0xffffff,2.4);k.position.set(2.5,4,4);s.add(k);const rim=new THREE.DirectionalLight(0xa8c4ff,1.6);rim.position.set(-3,2.5,-3.5);s.add(rim);
      const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const gr=g.createRadialGradient(64,64,4,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(0,0,128,128);
      const sh=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.8).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));sh.position.y=.005;s.add(sh);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.78,.84,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xe8c06a,transparent:true,opacity:.45}));ring.position.y=.01;s.add(ring);CS.ring=ring;
      CS.cam=new THREE.PerspectiveCamera(26,1,.05,60)}
    const down=e=>{CS.drag={x:e.clientX,y0:CS.yaw};CS.auto=0;cv.setPointerCapture&&cv.setPointerCapture(e.pointerId)},move=e=>{if(!CS.drag)return;CS.yaw=CS.drag.y0+(e.clientX-CS.drag.x)*.012},up=()=>{CS.drag=null;CS.idleT=performance.now()};
    cv.addEventListener('pointerdown',down);cv.addEventListener('pointermove',move);cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up)}
  const key=JSON.stringify(ME.look||playerLook(P));if(key!==CS.key||!CS.rig){if(CS.rig)CS.scene.remove(CS.rig.g);CS.rig=buildHumanoid(ME.look||playerLook(P));CS.scene.add(CS.rig.g);CS.key=key;CS.fitT=0}
  if(!CS.raf){CS.last=performance.now();CS.raf=requestAnimationFrame(csLoop)}}
function csStop(){if(CS.raf)cancelAnimationFrame(CS.raf);CS.raf=0}
const _csB=new THREE.Box3(),_csV=new THREE.Vector3();
function csLoop(t){CS.raf=0;if(!P||$('#pChar').hidden||CS_TAB!=='char'||!CS.r||!CS.canvas.isConnected)return;const dt=Math.min(.05,(t-CS.last)/1000);CS.last=t;
  const cv=CS.canvas,w=cv.clientWidth,h=cv.clientHeight;if(w&&h&&(cv.width!==Math.round(w*Math.min(2,devicePixelRatio))||cv.height!==Math.round(h*Math.min(2,devicePixelRatio)))){CS.r.setPixelRatio(Math.min(2,devicePixelRatio));CS.r.setSize(w,h,false);CS.cam.aspect=w/h;CS.cam.updateProjectionMatrix()}
  const R=CS.rig;if(R){if(CS.auto||(CS.idleT&&t-CS.idleT>4000)){CS.auto=1;CS.yaw+=dt*.35}R.g.rotation.y=CS.yaw;try{animRig(R,{spd:0,air:false,atk:-1,dead:false},dt)}catch(e){}if(typeof enchGlow==='function'){try{enchGlow(R,false);enchGlow(R,true)}catch(e){}}
    /* frame the hero once the model has loaded: feet on the ring, head near the top */
    if(CS.fitT<3){CS.fitT+=dt;R.g.updateMatrixWorld(true);_csB.setFromObject(R.g);if(!_csB.isEmpty()){const hh=Math.max(.8,_csB.max.y-_csB.min.y);CS.h=hh}}
    const hh=CS.h,d=hh*.5/Math.tan(CS.cam.fov*Math.PI/360)*1.12/Math.min(1,CS.cam.aspect*1.25);CS.cam.position.set(0,hh*.58,d);CS.cam.lookAt(0,hh*.5,0)}
  CS.r.render(CS.scene,CS.cam);CS.raf=requestAnimationFrame(csLoop)}
document.querySelectorAll('#csTabs button').forEach(b=>b.addEventListener('click',()=>{CS_TAB=b.dataset.ct;hideTip();refreshChar()}));
