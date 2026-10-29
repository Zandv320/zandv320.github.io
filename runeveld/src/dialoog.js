/* Runeveld – gespreksvenster met een npc: portret, tekst en keuzes (quests, winkel, afscheid). */
import {esc} from './ui.js';

/* Q: de questmodule; A: {openWinkel(), gesloten()} */
export function maakDialoog(Q,A){
  const $=s=>document.querySelector(s);
  const el=$('#dialoog'),cv=$('#dl-portret'),ctx=cv.getContext('2d');
  let open=false,npc=null;

  function portret(sprite){
    ctx.clearRect(0,0,cv.width,cv.height);if(!sprite)return;
    const b=sprite.blad,a=b.anims.idle,rij=a.rij+((b.richtingen||{onder:0}).onder||0);
    /* alleen het figuur zelf uitsnijden (voet en hoogte uit het blad), met wat lucht erom, en passend vergroten */
    const sh=b.hoogte+b.hoogte*.3,sw=sh*.75,sx=b.fw/2-sw/2,sy=b.fh-b.voet-b.hoogte-b.hoogte*.15;
    const sch=Math.min(cv.width/sw,cv.height/sh);const w=sw*sch,h=sh*sch;
    ctx.imageSmoothingEnabled=false;
    for(const L of sprite.lagen){const img=(L.bron||L.tex)?.image;if(!img)continue;ctx.drawImage(img,sx,rij*b.fh+sy,sw,sh,(cv.width-w)/2,(cv.height-h)/2,w,h)}
  }
  function toon(tekst,keuzes){
    $('#dl-tekst').textContent=tekst;
    const k=$('#dl-keuzes');k.innerHTML='';
    for(const[label,fn,klasse]of keuzes){const b=document.createElement('button');b.className='knop'+(klasse?' '+klasse:'');b.textContent=label;b.onclick=fn;k.appendChild(b)}
  }
  /* het hoofdmenu van een npc */
  function menu(){
    const n=npc,keuzes=[];
    for(const{id,q,st}of Q.vanNpc(n.naam)){
      if(st==='nieuw')keuzes.push(['! '+q.titel,()=>toon(q.intro,[['Accept',()=>{Q.accepteer(id);menu()}],['Not now',menu,'alt']])]);
      else if(st==='klaar')keuzes.push(['? '+q.titel,()=>{toon(q.klaar,[['Thank you',menu]]);Q.lever(id)}]);
      else keuzes.push(['? '+q.titel,()=>toon(q.bezig+' ('+Q.tekst(id)+')',[['I am on it',menu,'alt']]),'alt']);
    }
    if(n.winkel)keuzes.push(['Let me see your wares',()=>{sluit();A.openWinkel()},'alt']);
    keuzes.push(['Goodbye',sluit,'alt']);
    toon(n.groet,keuzes);
  }
  /* n: {naam, groet, sprite, winkel} */
  function openVoor(n){
    npc=n;open=true;el.hidden=false;document.body.classList.add('dialoog-open');$('#dl-naam').textContent=n.naam;portret(n.sprite);Q.opBezoek(n.naam);menu();
  }
  function sluit(){if(!open)return;open=false;el.hidden=true;document.body.classList.remove('dialoog-open');npc=null;A.gesloten&&A.gesloten()}
  el.addEventListener('pointerdown',e=>e.stopPropagation());
  return{open:openVoor,sluit,isOpen:()=>open,menu:()=>{if(open)menu()}};
}
