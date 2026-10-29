/* Runeveld – characterscherm (C) met uitrusting, stats en skills, en de winkel van Koopman Bram. */
import {ITEMS,SLOTS,WINKEL} from './data.js';
import {ico} from './iconen.js';
import {BLADEN} from './bladen.js';
import {heldLagen,tekenHeld} from './uiterlijk.js';
import {STATS,MAX_STAT,statKosten} from './regels/stats.js';
import {SKILLS,kanLeren,jobExpVoor,BOMEN,TAKKEN} from './regels/skills.js';
import {KLASSEN} from './data.js';
import {esc} from './ui.js';

export function statTekst(it){const d=[];if(it.atk)d.push('ATK +'+it.atk);if(it.matk)d.push('MATK +'+it.matk);if(it.def)d.push('DEF +'+it.def);if(it.hp)d.push('HP +'+it.hp);if(it.sp)d.push('SP +'+it.sp);if(it.klasse)d.push(it.klasse==='mage'?'Mage':'Swordsman');return d.join(' · ')}

/* P: de speler; A: {af(), expMax(), vrijeStat(), vrijeSkill(), statOmhoog(k), skillOmhoog(id),
                     uitrusten(id), afdoen(slot), gebruikDrank(), koop(id), koopDrank()} */
export function maakKarakter(P,A){
  const $=s=>document.querySelector(s);
  const el=$('#karakter'),cv=$('#k-canvas'),ctx=cv.getContext('2d');
  const wk=$('#winkel');
  let open=false,t=0,tab='uitrusting';

  function render(){
    const af=A.af();
    $('#k-naam').textContent=P.naam;$('#k-sub').textContent=`Level ${P.lvl} · ${A.klasse().naam} · Job ${P.job}`;
    const vs=A.vrijeStat(),vk=A.vrijeSkill();
    document.querySelectorAll('.ktab').forEach(b=>{b.classList.toggle('actief',b.dataset.tab===tab);
      const n=b.dataset.tab==='stats'?vs:b.dataset.tab==='skills'?vk:b.dataset.tab==='quests'?A.questsKlaar():0;b.querySelector('.kbadge').textContent=n>0?n:'';b.querySelector('.kbadge').hidden=n<=0});
    for(const t of['uitrusting','stats','skills','quests'])$('#k-tab-'+t).hidden=tab!==t;
    if(tab==='uitrusting')renderUitrusting(af);else if(tab==='stats')renderStats(af,vs);else if(tab==='skills')renderSkills(vk);else renderQuests();
  }
  function renderQuests(){
    const l=A.questLijst(),naam={nieuw:'Available',bezig:'In progress',klaar:'Ready to turn in',gedaan:'Completed'};
    $('#k-questlijst').innerHTML=l.length?l.map(x=>`<div class="quest ${x.st}"><div class="qkop"><b>${esc(x.q.titel)}</b><span class="qst">${naam[x.st]}</span></div>
      <small>${esc(x.q.gever)}${x.st==='gedaan'?'':' · '+esc(x.voortgang)}</small><p>${esc(x.st==='gedaan'?x.q.klaar:x.q.intro)}</p>
      <div class="qbel">Reward: ${x.q.beloning.exp} exp · ${x.q.beloning.zeny} zeny${(x.q.beloning.items||[]).map(i=>{const id=(P.klasse==='mage'||P.klasse==='wizard'||P.klasse==='sage')&&i.mage?i.mage:i.id;return ' · '+ico(id,ITEMS[id].icoon,'klein')+' '+esc(ITEMS[id].naam)+(i.n>1?' ×'+i.n:'')}).join('')}</div></div>`).join('')
      :'<p class="ktip">No quests yet. Villagers with a <b class="qm nieuw">!</b> above their head have work for you.</p>';
  }
  function renderUitrusting(af){
    $('#k-stats').innerHTML=[['HP',`${Math.ceil(P.hp)} / ${af.hpMax}`],['SP',`${Math.floor(P.sp)} / ${af.spMax}`],['ATK',af.atk],['MATK',af.matk],['DEF',af.def],['EXP',`${P.exp} / ${A.expMax()}`],['Zeny',P.zeny]]
      .map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('');
    $('#k-slots').innerHTML=SLOTS.map(([slot,naam])=>{const it=P.uitr[slot]&&ITEMS[P.uitr[slot]];
      return it?`<button class="kslot" data-slot="${slot}" title="Click to unequip"><small>${naam}</small><b>${ico(P.uitr[slot],it.icoon,"klein")} ${esc(it.naam)}</b><i>${statTekst(it)}</i></button>`
               :`<button class="kslot leeg" data-slot="${slot}"><small>${naam}</small><b>— empty —</b></button>`}).join('');
    const n=P.tas.reduce((t,e)=>t+e.n,0);
    $('#k-tas').innerHTML=`<button class="knop alt" data-inventaris="1">${ico("ui_tas","🎒","klein")} Open inventory (I)</button><span class="ktip">${n?`${n} item${n===1?'':'s'} in your bag.`:'Your bag is empty. Monsters sometimes drop gear, and Merchant Bram sells it.'}</span>`;
    tekenPreview();
  }
  function renderStats(af,vrij){
    $('#k-statpunten').innerHTML=vrij>0?`You have <b>${vrij}</b> stat point${vrij===1?'':'s'} to spend.`:'No stat points left. Every level grants new ones.';
    $('#k-statlijst').innerHTML=STATS.map(([k,naam,uitleg])=>{const n=P.stats[k]||1,kost=statKosten(n),kan=vrij>=kost&&n<MAX_STAT;
      return`<div class="kstat" title="${esc(uitleg)}"><span class="kstatnaam">${naam}</span><b>${n}</b><button class="kplus" data-stat="${k}" ${kan?'':'disabled'} title="Costs ${kost} point${kost===1?'':'s'}">+<small>${kost}</small></button><em>${esc(uitleg.split(':')[1]||'')}</em></div>`}).join('');
    $('#k-afgeleid').innerHTML=[['ATK',af.atk],['MATK',af.matk],['DEF',af.def],['Hit',af.hit],['Flee',af.flee],['Crit',af.crit.toFixed(1)+'%'],['Attacks/s',(1/af.aanvalTijd).toFixed(2)],['HP recovery',af.hpRegen.toFixed(1)+'/s'],['SP recovery',af.spRegen.toFixed(1)+'/s'],['Max HP',af.hpMax],['Max SP',af.spMax]]
      .map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('');
  }
  /* de talent tree: drie takken, rijen per niveau, lijnen langs de vereisten; klik een skill voor uitleg en leren */
  let gekozenSkill=null;
  function renderSkills(vrij){
    $('#k-skillpunten').innerHTML=`Job level <b>${P.job}</b>${P.job<A.maxJob()?` · job exp ${P.jobexp} / ${jobExpVoor(P.job)}`:' (max)'} · ${vrij>0?`<b>${vrij}</b> skill point${vrij===1?'':'s'} to spend`:'no skill points left'}`;
    const kl=A.klasse(),boom=BOMEN[P.klasse]||BOMEN.swordsman,takken=TAKKEN[P.klasse]||TAKKEN.swordsman;
    /* een tweede klasse krijgt een scheidingsrij tussen de boom van de eerste klasse (rijen 0–2) en de eigen rijen */
    const rij=y=>kl.tier===2&&y>=3?y+2:y+1;
    const rijen=rij(Math.max(...Object.values(boom).map(p=>p[1])));
    let html=`<div class="takken">${takken.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="boom" style="grid-template-rows:repeat(${rijen},auto)">`;
    for(const[id,[x,y]]of Object.entries(boom)){const sk=SKILLS[id],l=P.skills[id]||0,kan=vrij>0&&kanLeren(P.skills,id),open=kanLeren({...P.skills,[id]:0},id)||l>0;
      html+=`<button class="tnode${l>0?' geleerd':open?' open':' dicht'}${kan?' kan':''}${l>=sk.max?' max':''}${gekozenSkill===id?' gekozen':''}" data-tskill="${id}" style="grid-column:${x+1};grid-row:${rij(y)}" title="${esc(sk.naam)}"><span class="ti">${ico(id,sk.icoon)}</span><span class="tl">${l}/${sk.max}</span><span class="tn">${esc(sk.naam)}</span>${sk.passief?'<span class="tp">passive</span>':''}</button>`}
    if(kl.tier===2)html+=`<div class="tdeel" style="grid-column:1/4;grid-row:4"><span>${esc(kl.naam)} · job ${P.job} / ${A.maxJob()}</span></div>`;
    html+=`<svg class="tlijnen"></svg></div><div class="tdetail" id="k-tdetail"></div>`;
    $('#k-skilllijst').innerHTML=html;
    tekenLijnen(boom);renderDetail(vrij);
  }
  function tekenLijnen(boom){
    const wrap=$('#k-skilllijst .boom'),svg=wrap.querySelector('.tlijnen');if(!wrap||!svg)return;
    const r0=wrap.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${r0.width} ${r0.height}`);svg.style.width=r0.width+'px';svg.style.height=r0.height+'px';
    const mid=id=>{const el=wrap.querySelector(`[data-tskill="${id}"]`);if(!el)return null;const r=el.getBoundingClientRect();return[r.left-r0.left+r.width/2,r.top-r0.top+r.width/2]};
    let d='';
    for(const id of Object.keys(boom)){const sk=SKILLS[id];for(const[eis,n]of Object.entries(sk.eis)){if(!boom[eis])continue;const a=mid(eis),b=mid(id);if(!a||!b)continue;
      const ok=(P.skills[eis]||0)>=n;d+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${ok?'aan':''}"/>`}}
    svg.innerHTML=d;
  }
  function renderDetail(vrij){
    const d=$('#k-tdetail');if(!d)return;const id=gekozenSkill;
    if(!id||!SKILLS[id]){d.innerHTML='<p class="ktip">Click a skill in the tree to read what it does and to learn it.</p>';return}
    const sk=SKILLS[id],l=P.skills[id]||0,kan=vrij>0&&kanLeren(P.skills,id);
    const eis=Object.entries(sk.eis).map(([e,n])=>`${SKILLS[e].naam} ${n}`).join(', ');
    const nu=l>0?sk.tekst(l):'not learned yet',volgende=l<sk.max?`next: ${sk.tekst(l+1)}`:'max level';
    d.innerHTML=`<div class="tdkop"><span class="kskillicoon">${ico(id,sk.icoon)}</span><div><b>${esc(sk.naam)}${sk.passief?' <small>(passive)</small>':''}</b><small>Lv ${l} / ${sk.max}${eis?' · requires '+esc(eis):''}</small></div><button class="knop" data-tleer="${id}" ${kan?'':'disabled'}>${l>0?'Level up':'Learn'} (1 point)</button></div><p>${esc(sk.beschr)}</p><em>${esc(nu)} · ${esc(volgende)}</em>`;
  }
  function tekenPreview(){tekenHeld(ctx,heldLagen(P.uitr,P.haar),t)}
  el.addEventListener('click',e=>{
    const tb=e.target.closest('.ktab');if(tb){tab=tb.dataset.tab;render();return}
    const s=e.target.closest('.kslot');if(s&&!s.classList.contains('leeg')){A.afdoen(s.dataset.slot);render();return}
    if(e.target.closest('[data-inventaris]')){A.openInventaris();return}
    const tn=e.target.closest('.tnode');if(tn){gekozenSkill=tn.dataset.tskill;render();return}
    const tl=e.target.closest('[data-tleer]');if(tl&&!tl.disabled){A.skillOmhoog(tl.dataset.tleer);render();return}
    const p=e.target.closest('.kplus');if(p&&!p.disabled){if(p.dataset.stat)A.statOmhoog(p.dataset.stat);else if(p.dataset.skill)A.skillOmhoog(p.dataset.skill);render()}
  });
  $('#k-sluit').onclick=()=>sluit();
  addEventListener('resize',()=>{if(open&&tab==='skills')render()});

  /* ---------- winkel ---------- */
  function renderWinkel(){
    $('#w-lijst').innerHTML=WINKEL.map(id=>{const it=ITEMS[id];
      return`<div class="rij"><span>${ico(id,it.icoon,"klein")} ${esc(it.naam)}<small class="wstat">${statTekst(it)||esc(it.beschr||'')}</small></span><button class="knop" data-item="${id}" ${P.zeny<it.prijs?'disabled':''}>${it.prijs} zeny</button></div>`}).join('')
      +'<p class="ktip">Open your inventory (I) while the shop is open to sell items for half their price.</p>';
    $('#w-zeny').textContent=P.zeny;
  }
  wk.addEventListener('click',e=>{const b=e.target.closest('button[data-item]');if(!b)return;A.koop(b.dataset.item);renderWinkel();if(open)render()});
  $('#sluit').onclick=()=>{wk.hidden=true;A.winkelDicht&&A.winkelDicht()};

  function toon(welkTab){if(welkTab)tab=welkTab;open=true;el.hidden=false;render()}
  function sluit(){open=false;el.hidden=true}
  return{
    toon,sluit,toggle(){open?sluit():toon()},isOpen:()=>open,render:()=>{if(open)render()},
    tick(dt){if(!open||tab!=='uitrusting')return;t+=dt;tekenPreview()},
    winkelToon(){wk.hidden=false;renderWinkel()},winkelSluit(){wk.hidden=true},winkelOpen:()=>!wk.hidden,winkelRender:()=>{if(!wk.hidden)renderWinkel()},
  };
}
