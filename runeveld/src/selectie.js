/* Runeveld – characterselectie, zoals in WoW: een lijst van helden rechts, de gekozen held groot in beeld,
   onderaan Enter World / Create / Delete. Aanmaken met naam en haarkleur; verwijderen door de naam te typen. */
import {heldLagen,tekenHeld,HAARKEUZE} from './uiterlijk.js';
import {STARTUITRUSTING,KLASSE} from './data.js';
import {inBos,BOS} from './gebied.js';
import {esc} from './ui.js';
import {BLADEN} from './bladen.js';

export const MAX_CHARS=6;
/* A: {chars() → lijst van saves, bewaar(), start(i), laatst() → index, inDorp(x,z)} */
export function maakSelectie(A){
  const $=s=>document.querySelector(s);
  const el=$('#start'),sel=$('#sel'),maak=$('#maak'),wis=$('#wis');
  /* de canvassen op de resolutie van de sprites (2× in de gladde modus), zodat niets wazig wordt */
  const k=BLADEN.held.fw/64,maat=(c,w,h)=>{c.width=w*k;c.height=h*k;return c};
  const ctx=maat($('#sel-canvas'),144,160).getContext('2d'),mctx=maat($('#maak-canvas'),144,160).getContext('2d');
  let i=A.laatst()||0,t=0,haar='standaard',open=false,scherm='sel';
  const lijst=()=>A.chars();
  const zone=c=>!c.lvl?'Never played':inBos(c.x||0,c.z||0)?BOS.naam:A.inDorp(c.x||0,c.z||0)?'Runeveld village':'Runeveld fields';
  const lagenVan=c=>heldLagen(c.uitr||STARTUITRUSTING,c.haar);

  function renderLijst(){
    const L=lijst();i=Math.max(0,Math.min(L.length-1,i));
    $('#sel-lijst').innerHTML=L.map((c,n)=>`<button class="selkaart${n===i?' actief':''}" data-i="${n}"><canvas width="${36*k}" height="${40*k}"></canvas><div><b>${esc(c.naam)}</b><small>Level ${c.lvl||1} ${KLASSE.naam}</small><small class="zone">${esc(zone(c))}</small></div></button>`).join('')
      +`<div class="selaantal">${L.length} / ${MAX_CHARS} characters</div>`;
    $('#sel-lijst').querySelectorAll('.selkaart').forEach((b,n)=>tekenHeld(b.querySelector('canvas').getContext('2d'),lagenVan(L[n]),0));
    const c=L[i];
    $('#sel-naam').textContent=c?c.naam:'No characters yet';$('#sel-sub').textContent=c?`Level ${c.lvl||1} ${KLASSE.naam} · ${zone(c)}`:'Create your first hero to begin.';
    $('#sel-speel').disabled=!c;$('#sel-wis').disabled=!c;$('#sel-nieuw').disabled=L.length>=MAX_CHARS;
    $('#sel-canvas').style.visibility=c?'':'hidden';
  }
  function tick(dt){
    if(!open)return;t+=dt;const L=lijst();
    if(scherm==='sel'&&L[i])tekenHeld(ctx,lagenVan(L[i]),t);
    else if(scherm==='maak')tekenHeld(mctx,heldLagen(STARTUITRUSTING,haar),t);
  }
  function toonScherm(naam){scherm=naam;sel.hidden=naam!=='sel';maak.hidden=naam!=='maak';wis.hidden=naam!=='wis';if(naam==='sel')renderLijst()}

  /* ---- selectie ---- */
  $('#sel-lijst').addEventListener('click',e=>{const b=e.target.closest('.selkaart');if(!b)return;const k=+b.dataset.i;if(k===i){binnen();return}i=k;t=0;renderLijst()});
  $('#sel-lijst').addEventListener('dblclick',e=>{if(e.target.closest('.selkaart'))binnen()});
  function binnen(){const L=lijst();if(!L[i])return;open=false;el.hidden=true;A.start(i)}
  $('#sel-speel').onclick=binnen;
  $('#sel-nieuw').onclick=()=>{if(lijst().length>=MAX_CHARS)return;haar='standaard';$('#maak-naam').value='';$('#maak-fout').textContent='';renderHaar();toonScherm('maak');t=0;if(!matchMedia('(pointer:coarse)').matches)$('#maak-naam').focus()};
  $('#sel-wis').onclick=()=>{const c=lijst()[i];if(!c)return;$('#wis-naam').textContent=c.naam;$('#wis-typ').value='';$('#wis-ok').disabled=true;toonScherm('wis');$('#wis-typ').focus()};

  /* ---- aanmaken ---- */
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
    L.push({naam,haar});A.bewaar();i=L.length-1;t=0;toonScherm('sel');
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

  function toon(){open=true;el.hidden=false;toonScherm(lijst().length?'sel':'maak');if(scherm==='maak'){haar='standaard';renderHaar();if(!matchMedia('(pointer:coarse)').matches)$('#maak-naam').focus()}}
  return{toon,tick,isOpen:()=>open};
}
