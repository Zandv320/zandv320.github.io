/* Runeveld – characterselectie, zoals in WoW: een lijst van helden rechts, de gekozen held groot in beeld,
   onderaan Enter World / Create / Delete. Aanmaken met naam en haarkleur; verwijderen door de naam te typen. */
import {heldLagen,tekenHeld,HAARKEUZE} from './uiterlijk.js';   /* tekenHeld: de kleine avatars in de lijst */
import {ico} from './iconen.js';
import {KLASSEN} from './data.js';
import {inBos,BOS} from './gebied.js';
import {esc} from './ui.js';
import {BLADEN} from './bladen.js';
import {Sprite2D} from './sprites.js';
import * as THREE from 'three';

export const MAX_CHARS=6;
/* de plek waar de gekozen held staat: voor de put op het plein, met het gezicht naar de camera */
export const PODIUM={x:0,z:4.5,yaw:0,tilt:36};
/* A: {chars() → lijst van saves, bewaar(), start(i), laatst() → index, inDorp(x,z), scene, cam, camera, zoomPx} */
export function maakSelectie(A){
  const $=s=>document.querySelector(s);
  const el=$('#start'),sel=$('#sel'),maak=$('#maak'),wis=$('#wis');
  const k=BLADEN.held.fw/64;
  /* de held staat echt in de wereld: een sprite op het podium, die de lagen van de gekozen held krijgt */
  const held=new Sprite2D(BLADEN.held,{lagen:heldLagen(KLASSEN.swordsman.start,'standaard')});held.g.position.set(PODIUM.x,0,PODIUM.z);held.g.visible=false;A.scene.add(held.g);
  let heldKey='';const _v=new THREE.Vector3();
  function zetHeld(lagen,key){if(key===heldKey)return;heldKey=key;held.zetLagen(lagen);held.speel('idle',true)}
  let i=A.laatst()||0,t=0,haar='standaard',kl='swordsman',open=false,scherm='sel';
  const klasseVan=c=>KLASSEN[c.klasse]||KLASSEN.swordsman;
  const lijst=()=>A.chars();
  const zone=c=>!c.lvl?'Never played':inBos(c.x||0,c.z||0)?BOS.naam:A.inDorp(c.x||0,c.z||0)?'Runeveld village':'Runeveld fields';
  const lagenVan=c=>heldLagen(c.uitr||klasseVan(c).start,c.haar);

  function renderLijst(){
    const L=lijst();i=Math.max(0,Math.min(L.length-1,i));
    $('#sel-lijst').innerHTML=L.map((c,n)=>`<button class="selkaart${n===i?' actief':''}" data-i="${n}"><canvas width="${36*k}" height="${40*k}"></canvas><div><b>${esc(c.naam)}</b><small>Level ${c.lvl||1} ${klasseVan(c).naam}</small><small class="zone">${esc(zone(c))}</small></div></button>`).join('')
      +`<div class="selaantal">${L.length} / ${MAX_CHARS} characters</div>`;
    $('#sel-lijst').querySelectorAll('.selkaart').forEach((b,n)=>tekenHeld(b.querySelector('canvas').getContext('2d'),lagenVan(L[n]),0));
    const c=L[i];
    $('#sel-naam').textContent=c?c.naam:'No characters yet';$('#sel-sub').textContent=c?`Level ${c.lvl||1} ${klasseVan(c).naam} · ${zone(c)}`:'Create your first hero to begin.';
    $('#sel-speel').disabled=!c;$('#sel-wis').disabled=!c;$('#sel-nieuw').disabled=L.length>=MAX_CHARS;
  }
  function tick(dt){
    if(!open)return;t+=dt;const L=lijst();
    const c=scherm==='sel'?L[i]:scherm==='maak'?{uitr:KLASSEN[kl].start,haar,klasse:kl}:L[i];
    held.g.visible=!!c&&scherm!=='wis';
    if(c){const lg=lagenVan(c);zetHeld(lg,JSON.stringify([c.uitr||null,c.haar||null,c.klasse||null,lg.length]));
      /* naar de camera kijken, ook als die draait */
      held.zetKijk(Math.sin(A.cam.yaw),Math.cos(A.cam.yaw));held.update(dt,A.cam)}
    /* naam en level onder de voeten van de held */
    const info=$('#sel-info');info.hidden=scherm!=='sel'||!c;
    if(!info.hidden){_v.set(PODIUM.x,-.15,PODIUM.z).project(A.camera);info.style.transform=`translate(${((_v.x+1)/2*innerWidth).toFixed(1)}px,${((1-_v.y)/2*innerHeight).toFixed(1)}px) translate(-50%,0)`}
  }
  /* waar de camera naar kijkt zolang het selectiescherm open is: de held iets links van het midden, op borsthoogte */
  function cameraDoel(){const b=matchMedia('(max-width:700px)').matches;return b?[PODIUM.x,.7,PODIUM.z+3.6]:[PODIUM.x+2.4,.7,PODIUM.z]}
  function toonScherm(naam){scherm=naam;sel.hidden=naam!=='sel';maak.hidden=naam!=='maak';wis.hidden=naam!=='wis';if(naam==='sel')renderLijst()}

  /* ---- selectie ---- */
  $('#sel-lijst').addEventListener('click',e=>{const b=e.target.closest('.selkaart');if(!b)return;const k=+b.dataset.i;if(k===i){binnen();return}i=k;t=0;renderLijst()});
  $('#sel-lijst').addEventListener('dblclick',e=>{if(e.target.closest('.selkaart'))binnen()});
  function binnen(){const L=lijst();if(!L[i])return;open=false;el.hidden=true;held.g.visible=false;$('#sel-info').hidden=true;A.start(i)}
  $('#sel-speel').onclick=binnen;
  $('#sel-nieuw').onclick=()=>{if(lijst().length>=MAX_CHARS)return;haar='standaard';kl='swordsman';$('#maak-naam').value='';$('#maak-fout').textContent='';renderKlasse();renderHaar();toonScherm('maak');t=0;if(!matchMedia('(pointer:coarse)').matches)$('#maak-naam').focus()};
  $('#sel-wis').onclick=()=>{const c=lijst()[i];if(!c)return;$('#wis-naam').textContent=c.naam;$('#wis-typ').value='';$('#wis-ok').disabled=true;toonScherm('wis');$('#wis-typ').focus()};

  /* ---- aanmaken ---- */
  function renderKlasse(){
    $('#maak-klassen').innerHTML=Object.entries(KLASSEN).filter(([,k])=>k.tier===1).map(([id,k])=>`<button class="klas${id===kl?' actief':''}" data-klasse="${id}"><div class="icoon">${ico("k_"+id,k.icoon)}</div><div><b>${k.naam}</b><small>${esc(k.beschr)}</small></div></button>`).join('');
  }
  $('#maak-klassen').addEventListener('click',e=>{const b=e.target.closest('.klas');if(!b)return;kl=b.dataset.klasse;renderKlasse()});
  function renderHaar(){
    $('#maak-haar').innerHTML=HAARKEUZE.map(([id,naam,[r,g,b]])=>`<button class="haar${id===haar?' actief':''}" data-haar="${id}" title="${naam}" style="background:rgb(${r},${g},${b})"></button>`).join('');
    $('#maak-haarnaam').textContent=HAARKEUZE.find(h=>h[0]===haar)[1];
  }
  $('#maak-haar').addEventListener('click',e=>{const b=e.target.closest('.haar');if(!b)return;haar=b.dataset.haar;renderHaar()});
  function maakAan(){
    const naam=$('#maak-naam').value.trim(),L=lijst();
    if(naam.length<2||naam.length>14){$('#maak-fout').textContent='A name has 2 to 14 characters.';return}
    if(!/^[\p{L}\p{N} '\-]+$/u.test(naam)){$('#maak-fout').textContent='Letters, numbers, spaces and - only.';return}
    if(L.some(c=>c.naam.toLowerCase()===naam.toLowerCase())){$('#maak-fout').textContent='You already have a hero with that name.';return}
    L.push({naam,haar,klasse:kl});A.bewaar();i=L.length-1;t=0;toonScherm('sel');
  }
  $('#maak-ok').onclick=maakAan;$('#maak-naam').onkeydown=e=>{if(e.key==='Enter')maakAan()};
  $('#maak-terug').onclick=()=>toonScherm('sel');

  /* ---- verwijderen: de naam typen als bevestiging ---- */
  $('#wis-typ').oninput=()=>{const c=lijst()[i];$('#wis-ok').disabled=!c||$('#wis-typ').value.trim().toLowerCase()!==c.naam.toLowerCase()};
  $('#wis-ok').onclick=()=>{const L=lijst();if($('#wis-ok').disabled||!L[i])return;L.splice(i,1);A.bewaar();i=Math.max(0,i-1);toonScherm('sel')};
  $('#wis-terug').onclick=()=>toonScherm('sel');

  /* toetsen: pijltjes kiezen, Enter gaat de wereld in, Escape terug */
  addEventListener('keydown',e=>{
    if(!open)return;
    if(scherm!=='sel'){if(e.key==='Escape')toonScherm('sel');return}
    if(document.activeElement&&document.activeElement.tagName==='INPUT')return;
    const L=lijst();
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!L.length)return;i=(i+(e.key==='ArrowDown'?1:L.length-1))%L.length;t=0;renderLijst()}
    else if(e.key==='Enter')binnen();
  });

  function toon(){open=true;el.hidden=false;toonScherm(lijst().length?'sel':'maak');if(scherm==='maak'){haar='standaard';kl='swordsman';renderKlasse();renderHaar();if(!matchMedia('(pointer:coarse)').matches)$('#maak-naam').focus()}}
  return{toon,tick,isOpen:()=>open,cameraDoel};
}
