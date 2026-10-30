/* Runeveld – partijen: samen in een groep van maximaal zes, met gedeelde exp en zeny (server/src/index.js verdeelt).
   Hier de HUD: het partijkader met de leden en hun hp, uitnodigingen (popup bovenin), het kaartje als je op een
   medespeler klikt, en de chatopdrachten /invite, /leave en /kick. Alleen met de eigen server. */
import {ico} from './iconen.js';
import {KLASSEN} from './data.js';
import * as UI from './ui.js';
const $=s=>document.querySelector(s);
const esc=UI.esc;

export function maakPartij({net,P,S}){
  const el=$('#partij'),kaart=$('#spelerkaart'),uitn=$('#uitnodiging');
  let partij=null,hpT=0,uitnTimer=null;
  const isLid=id=>!!partij&&partij.leden.some(l=>l.f===id);
  const leden=()=>new Set(partij?partij.leden.map(l=>l.f):[]);
  const leider=()=>!!partij&&partij.leider===net.me;
  function hpVan(f){if(f===net.me)return[P.hp,P.hpMax?P.hpMax():P.hp];const s=S.get(f);return s&&s.pres?[s.pres.hp||0,s.pres.hm||1]:null}
  function render(){
    if(!partij){el.hidden=true;return}
    el.hidden=false;
    el.innerHTML=`<div class="pkop"><span>Party · ${partij.leden.length}/6</span><button data-p="verlaat" title="Leave the party">Leave</button></div>`+partij.leden.map(l=>{
      const hp=hpVan(l.f),ik=l.f===net.me,weg=!ik&&!S.has(l.f);
      return`<div class="plid${ik?' ik':''}${weg?' weg':''}" data-f="${l.f}"><span class="pn">${ico('k_'+l.k,'','klein')}${esc(l.n)}${partij.leider===l.f?' <span class="kroon" title="Party leader">♛</span>':''}<small>Lv ${l.l}</small></span>
        <span class="ps">${weg?'away':hp?Math.ceil(hp[0])+' / '+hp[1]:''}${leider()&&!ik?` <button data-p="schop" data-wie="${l.f}" title="Remove from party">✕</button>`:''}</span>
        <div class="bar hp"><i style="width:${hp?Math.max(0,Math.min(100,hp[0]/hp[1]*100)):0}%"></i></div></div>`}).join('');
  }
  el.addEventListener('click',e=>{const b=e.target.closest('button[data-p]');if(!b)return;
    if(b.dataset.p==='verlaat')net.party('verlaat');else if(b.dataset.p==='schop')net.party('schop',{wie:b.dataset.wie})});
  /* berichten van de server */
  net.onBericht('partij',m=>{const had=!!partij;partij=m.p;render();if(partij&&!had)UI.sys('You joined a party. Exp and zeny are shared with members nearby.');if(!partij&&had)UI.sys('You left the party.')});
  net.onBericht('partijinfo',m=>UI.sys(m.tekst));
  net.onBericht('uitnodiging',m=>{
    uitn.hidden=false;uitn.innerHTML=`<b>${esc(m.van.n)}</b> invites you to a party.<div class="rij"><button data-u="ja">Accept</button><button data-u="nee">Decline</button></div>`;
    clearTimeout(uitnTimer);uitnTimer=setTimeout(()=>{uitn.hidden=true},60000);
  });
  uitn.addEventListener('click',e=>{const b=e.target.closest('button[data-u]');if(!b)return;uitn.hidden=true;net.party(b.dataset.u==='ja'?'accepteer':'weiger')});
  /* uitnodigen op naam (chat) of via het kaartje van een speler */
  function zoek(naam){naam=naam.trim().toLowerCase();for(const[id,s]of S)if(s.pres&&(s.pres.n||'').toLowerCase()===naam)return id;return null}
  function uitnodig(naam){if(!net.viaServer()){UI.sys('Parties need the game server; you are on the fallback connection.');return}const id=zoek(naam);if(!id){UI.sys(`No player called ${naam} is online here.`);return}net.party('uitnodig',{naar:id})}
  function spelerKaart(id,cx,cy){
    const s=S.get(id);if(!s)return;const p=s.pres||{};
    kaart.hidden=false;kaart.style.left=Math.min(innerWidth-170,cx+8)+'px';kaart.style.top=Math.min(innerHeight-90,cy+8)+'px';
    kaart.innerHTML=`<b>${esc(p.n||'?')}</b><small>Level ${p.l||1} ${esc((KLASSEN[p.k]||KLASSEN.swordsman).naam)}</small><div class="rij">${isLid(id)?'':'<button data-s="invite">Invite to party</button>'}<button data-s="dicht">Close</button></div>`;
    kaart.dataset.id=id;
  }
  kaart.addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;if(b.dataset.s==='invite')net.party('uitnodig',{naar:kaart.dataset.id});kaart.hidden=true});
  kaart.addEventListener('pointerdown',e=>e.stopPropagation());uitn.addEventListener('pointerdown',e=>e.stopPropagation());
  /* chatopdrachten; geeft true als de tekst een opdracht was */
  function opdracht(t){
    const m=/^\/(invite|leave|kick|party)\b\s*(.*)$/i.exec(t);if(!m)return false;const w=m[1].toLowerCase(),arg=m[2];
    if(w==='invite'||w==='party'){if(arg)uitnodig(arg);else UI.sys('Use /invite name, or click a player.')}
    else if(w==='leave')net.party('verlaat');
    else if(w==='kick'){const id=zoek(arg);if(id)net.party('schop',{wie:id});else UI.sys(`No player called ${arg}.`)}
    return true;
  }
  function tick(dt){if(!partij)return;hpT+=dt;if(hpT>.5){hpT=0;render()}}
  return{render,tick,uitnodig,spelerKaart,opdracht,leden,isLid,sluitKaart:()=>{kaart.hidden=true}};
}
