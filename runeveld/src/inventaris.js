/* Runeveld – inventory-venster (I): een raster van slots met stapels, met uitrusten, gebruiken, verkopen en weggooien. */
import {ITEMS,TAS_SLOTS,VERKOOPDEEL} from './data.js';
import {ico} from './iconen.js';
import {esc} from './ui.js';
import {statTekst} from './karakter.js';

/* P: de speler (P.tas = [{id,n}]); A: {uitrusten(id), gebruik(id), verkoop(id), weggooi(id), winkelOpen()} */
export function maakInventaris(P,A){
  const $=s=>document.querySelector(s);
  const el=$('#inventaris');
  let open=false,gekozen=null;

  function render(){
    if(!open)return;
    $('#i-zeny').textContent=P.zeny;$('#i-vol').textContent=`${P.tas.length} / ${TAS_SLOTS}`;
    if(gekozen&&!P.tas.some(e=>e.id===gekozen))gekozen=null;
    const slots=[];
    for(let i=0;i<TAS_SLOTS;i++){const e=P.tas[i];
      if(!e){slots.push('<div class="islot leeg"></div>');continue}
      const it=ITEMS[e.id];
      slots.push(`<button class="islot ${gekozen===e.id?'gekozen':''}" data-id="${e.id}" title="${esc(it.naam)}"><span class="iicoon">${ico(e.id,it.icoon)}</span>${e.n>1?`<span class="iaantal">${e.n}</span>`:''}</button>`)}
    $('#i-raster').innerHTML=slots.join('');
    const d=$('#i-detail');
    if(!gekozen){d.innerHTML='<p class="ktip">Select an item to see what it does.</p>';return}
    const it=ITEMS[gekozen],e=P.tas.find(x=>x.id===gekozen);
    const knoppen=[];
    if(it.slot)knoppen.push('<button class="knop" data-actie="uitrusten">Equip</button>');
    if(it.gebruik)knoppen.push('<button class="knop" data-actie="gebruik">Use</button>');
    if(A.winkelOpen())knoppen.push(`<button class="knop alt" data-actie="verkoop">Sell for ${Math.floor(it.prijs*VERKOOPDEEL)} zeny</button>`);
    else knoppen.push('<button class="knop alt" data-actie="weggooi">Drop</button>');
    d.innerHTML=`<div class="idetailkop"><span class="iicoon groot">${ico(gekozen,it.icoon)}</span><div><b>${esc(it.naam)}</b>${e.n>1?` <small>×${e.n}</small>`:''}<small class="istat">${statTekst(it)||''}</small></div></div><p>${esc(it.beschr||'')}</p><div class="iknoppen">${knoppen.join('')}</div>`;
  }
  el.addEventListener('click',e=>{
    const s=e.target.closest('.islot[data-id]');if(s){gekozen=s.dataset.id;render();return}
    const b=e.target.closest('button[data-actie]');if(!b||!gekozen)return;
    const id=gekozen,actie=b.dataset.actie;
    if(actie==='uitrusten')A.uitrusten(id);else if(actie==='gebruik')A.gebruik(id);else if(actie==='verkoop')A.verkoop(id);else if(actie==='weggooi')A.weggooi(id);
    render();
  });
  $('#i-sluit').onclick=()=>sluit();
  function toon(){open=true;el.hidden=false;render()}
  function sluit(){open=false;el.hidden=true}
  return{toon,sluit,toggle(){open?sluit():toon()},isOpen:()=>open,render};
}
