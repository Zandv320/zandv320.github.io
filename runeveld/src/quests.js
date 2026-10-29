/* Runeveld – questvoortgang van de speler: aannemen, bijhouden (kills, items, bezoeken), inleveren,
   de markers boven npc's, de tracker in de HUD en de lijst voor het characterscherm. */
import {QUESTS,QUEST_VOLGORDE,status,voltooid,questsVan,voortgangTekst} from './regels/quests.js';
import {ITEMS,MONSTERS} from './data.js';
import * as UI from './ui.js';
import {G} from './geluid.js';

/* P: de speler (P.quests is de voortgang); A: {tasAantal, tasVerwijderen, tasToevoegen, beloning({exp,zeny}), npcLabel(naam), render()} */
export function maakQuests(P,A){
  const $=s=>document.querySelector(s);
  const tracker=$('#qtracker');
  const monsterNaam=k=>MONSTERS[k]?.naam||k,itemNaam=k=>ITEMS[k]?.naam||k;
  if(!P.quests)P.quests={};
  const st=id=>status(id,P.quests,P.lvl);

  /* alles wat een npc te vertellen heeft: nieuwe quests, lopende en inleverbare */
  function vanNpc(naam){return questsVan(naam).map(id=>({id,q:QUESTS[id],st:st(id)})).filter(x=>x.st!=='gesloten'&&x.st!=='gedaan')}
  function accepteer(id){if(st(id)!=='nieuw')return false;P.quests[id]={st:'bezig',n:0};
    const d=QUESTS[id].doel;if(d.soort==='item')P.quests[id].n=Math.min(d.n,A.tasAantal(d.item));
    UI.log(`<span class="lvl">Quest accepted: ${UI.esc(QUESTS[id].titel)}</span>`);vernieuw();return true}
  function lever(id){
    const q=QUESTS[id],s=P.quests[id];if(!voltooid(id,s))return false;
    if(q.doel.soort==='item'&&!A.tasVerwijderen(q.doel.item,q.doel.n))return false;
    s.st='gedaan';const b=q.beloning;A.beloning({exp:b.exp,zeny:b.zeny});
    const gekregen=[];for(const it of b.items||[]){const id=P.klasse==='mage'&&it.mage?it.mage:it.id;if(A.tasToevoegen(id,it.n))gekregen.push(`${ITEMS[id].icoon} ${UI.esc(ITEMS[id].naam)}${it.n>1?' ×'+it.n:''}`);else UI.sys(`Your bag is full, the ${ITEMS[id].naam.toLowerCase()} was left behind.`)}
    UI.log(`<span class="lvl">Quest complete: ${UI.esc(q.titel)} · +${b.exp} exp · +${b.zeny} zeny${gekregen.length?' · '+gekregen.join(', '):''}</span>`);
    UI.melding('QUEST COMPLETE',q.titel);G.quest();vernieuw();return true;
  }
  /* gebeurtenissen */
  function opDood(soort){let w=false;for(const id in P.quests){const s=P.quests[id],d=QUESTS[id].doel;if(s.st==='bezig'&&d.soort==='dood'&&d.monster===soort&&s.n<d.n){s.n++;w=true;
      if(s.n>=d.n)UI.log(`<span class="lvl">${UI.esc(QUESTS[id].titel)}: done! Return to ${UI.esc(QUESTS[id].gever)}.</span>`)}}if(w)vernieuw()}
  function opBezoek(npc){let w=false;for(const id in P.quests){const s=P.quests[id],d=QUESTS[id].doel;if(s.st==='bezig'&&d.soort==='bezoek'&&d.npc===npc&&!s.n){s.n=1;w=true;
      UI.log(`<span class="lvl">${UI.esc(QUESTS[id].titel)}: done! Return to ${UI.esc(QUESTS[id].gever)}.</span>`)}}if(w)vernieuw()}
  function opPlek(x,z){let w=false;for(const id in P.quests){const s=P.quests[id],d=QUESTS[id].doel;if(s.st==='bezig'&&d.soort==='plek'&&!s.n&&Math.hypot(x-d.x,z-d.z)<=d.r){s.n=1;w=true;
      UI.log(`<span class="lvl">${UI.esc(QUESTS[id].titel)}: you found ${UI.esc(d.naam)}. Return to ${UI.esc(QUESTS[id].gever)}.</span>`)}}if(w)vernieuw()}
  /* itemquests kijken gewoon in de tas */
  function opTas(){let w=false;for(const id in P.quests){const s=P.quests[id],d=QUESTS[id].doel;if(s.st==='bezig'&&d.soort==='item'){const n=Math.min(d.n,A.tasAantal(d.item));if(n!==s.n){if(n>=d.n&&s.n<d.n)UI.log(`<span class="lvl">${UI.esc(QUESTS[id].titel)}: you have everything. Return to ${UI.esc(QUESTS[id].gever)}.</span>`);s.n=n;w=true}}}if(w)vernieuw()}

  /* markers boven de npc's: ! nieuw, ? bezig (grijs) of klaar (goud) */
  function markers(){
    const per={};for(const id of QUEST_VOLGORDE){const s=st(id);if(s==='gesloten'||s==='gedaan')continue;const g=QUESTS[id].gever;
      per[g]=s==='klaar'?'klaar':s==='nieuw'&&per[g]!=='klaar'?'nieuw':per[g]||'bezig'}
    A.elkeNpc((naam,label)=>UI.questMarker(label,per[naam]||null));
  }
  function tekst(id){return voortgangTekst(id,P.quests[id],monsterNaam,itemNaam)}
  function renderTracker(){
    const actief=QUEST_VOLGORDE.filter(id=>P.quests[id]&&P.quests[id].st!=='gedaan');
    tracker.hidden=!actief.length;
    tracker.innerHTML='<div class="qth">Quests</div>'+actief.map(id=>{const k=st(id)==='klaar';return `<div class="qt${k?' klaar':''}"><b>${UI.esc(QUESTS[id].titel)}</b><span>${k?'Return to '+UI.esc(QUESTS[id].gever):UI.esc(tekst(id))}</span></div>`}).join('');
  }
  function vernieuw(){markers();renderTracker();A.render()}
  /* voor het characterscherm */
  const VOLG={klaar:0,bezig:1,nieuw:2,gedaan:3};
  function lijst(){return QUEST_VOLGORDE.map((id,i)=>({id,q:QUESTS[id],st:st(id),voortgang:tekst(id),i})).filter(x=>x.st!=='gesloten').sort((a,b)=>VOLG[a.st]-VOLG[b.st]||a.i-b.i)}
  const klaarAantal=()=>QUEST_VOLGORDE.filter(id=>st(id)==='klaar').length;
  return{vanNpc,accepteer,lever,opDood,opBezoek,opTas,opPlek,vernieuw,lijst,klaarAantal,status:st,tekst};
}
