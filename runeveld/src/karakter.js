/* Runeveld – characterscherm (C) en de winkel van Koopman Bram. */
import {ITEMS,SLOTS,WINKEL,DRANK_PRIJS,VAARDIGHEDEN} from './data.js';
import {BLADEN,heldLagen} from './bladen.js';
import {esc} from './ui.js';

export function statTekst(it){const d=[];if(it.atk)d.push('ATK +'+it.atk);if(it.def)d.push('DEF +'+it.def);if(it.hp)d.push('HP +'+it.hp);return d.join(' · ')}

/* P: de speler; A: {hpMax,spMax,atk,def,expMax,uitrusten(id),afdoen(slot),gebruikDrank(),koop(id),koopDrank()} */
export function maakKarakter(P,A){
  const $=s=>document.querySelector(s);
  const el=$('#karakter'),cv=$('#k-canvas'),ctx=cv.getContext('2d');
  const wk=$('#winkel');
  let open=false,t=0;

  function render(){
    $('#k-naam').textContent=P.naam;$('#k-sub').textContent=`Level ${P.lvl} · Zwaardvechter`;
    $('#k-stats').innerHTML=[['HP',`${Math.ceil(P.hp)} / ${A.hpMax()}`],['SP',`${Math.floor(P.sp)} / ${A.spMax()}`],['ATK',A.atk()],['DEF',A.def()],['EXP',`${P.exp} / ${A.expMax()}`],['Zeny',P.zeny]]
      .map(([k,v])=>`<span>${k}</span><b>${v}</b>`).join('');
    $('#k-slots').innerHTML=SLOTS.map(([slot,naam])=>{const it=P.uitr[slot]&&ITEMS[P.uitr[slot]];
      return it?`<button class="kslot" data-slot="${slot}" title="Klik om af te doen"><small>${naam}</small><b>${it.icoon} ${esc(it.naam)}</b><i>${statTekst(it)}</i></button>`
               :`<button class="kslot leeg" data-slot="${slot}"><small>${naam}</small><b>— leeg —</b></button>`}).join('');
    const tel=new Map();for(const id of P.tas)tel.set(id,(tel.get(id)||0)+1);
    const rijen=[];
    if(P.dranken>0)rijen.push(`<button class="kitem" data-drank="1" title="Klik om te drinken">🧪 Rode drank ×${P.dranken}<small>herstelt ${VAARDIGHEDEN.drank.heal} HP</small></button>`);
    for(const[id,n]of tel){const it=ITEMS[id];if(!it)continue;rijen.push(`<button class="kitem" data-item="${id}" title="Klik om aan te doen">${it.icoon} ${esc(it.naam)}${n>1?' ×'+n:''}<small>${statTekst(it)}</small></button>`)}
    $('#k-tas').innerHTML=rijen.length?rijen.join(''):'<span class="ktip">Je tas is leeg. Monsters laten soms uitrusting vallen, en Koopman Bram verkoopt het.</span>';
    tekenPreview();
  }
  function tekenPreview(){
    const b=BLADEN.held,a=b.anims.idle,f=Math.floor(t*a.fps)%a.n;
    ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,cv.width,cv.height);
    /* alleen het stuk van het frame waar het figuur staat, zodat het lekker groot in beeld komt */
    for(const tex of heldLagen(P.uitr))ctx.drawImage(tex.image,f*b.fw+14,10,36,40,0,0,cv.width,cv.height);
  }
  el.addEventListener('click',e=>{
    const s=e.target.closest('.kslot');if(s&&!s.classList.contains('leeg')){A.afdoen(s.dataset.slot);render();return}
    const i=e.target.closest('.kitem');if(i){if(i.dataset.drank)A.gebruikDrank();else A.uitrusten(i.dataset.item);render()}
  });
  $('#k-sluit').onclick=()=>sluit();

  /* ---------- winkel ---------- */
  function renderWinkel(){
    const rij=(icoon,naam,stat,prijs,data)=>`<div class="rij"><span>${icoon} ${esc(naam)}<small class="wstat">${stat}</small></span><button class="knop" ${data} ${P.zeny<prijs?'disabled':''}>${prijs} zeny</button></div>`;
    $('#w-lijst').innerHTML=rij('🧪','Rode drank','herstelt '+VAARDIGHEDEN.drank.heal+' HP',DRANK_PRIJS,'data-drank="1"')
      +WINKEL.map(id=>{const it=ITEMS[id];return rij(it.icoon,it.naam,statTekst(it),it.prijs,`data-item="${id}"`)}).join('');
    $('#w-zeny').textContent=P.zeny;
  }
  wk.addEventListener('click',e=>{const b=e.target.closest('button[data-item],button[data-drank]');if(!b)return;if(b.dataset.drank)A.koopDrank();else A.koop(b.dataset.item);renderWinkel();if(open)render()});
  $('#sluit').onclick=()=>{wk.hidden=true};

  function toon(){open=true;el.hidden=false;render()}
  function sluit(){open=false;el.hidden=true}
  return{
    toon,sluit,toggle(){open?sluit():toon()},isOpen:()=>open,render:()=>{if(open)render()},
    tick(dt){if(!open)return;t+=dt;tekenPreview()},
    winkelToon(){wk.hidden=false;renderWinkel()},winkelSluit(){wk.hidden=true},winkelOpen:()=>!wk.hidden,
  };
}
