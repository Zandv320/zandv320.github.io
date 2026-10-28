/* Runeveld – HUD, naamlabels, schadegetallen, chat. */
import * as THREE from 'three';
export const $=s=>document.querySelector(s);
const labelsEl=$('#labels'),fxEl=$('#fx'),logEl=$('#log');
const _v=new THREE.Vector3();

export function maakLabel(klasse,naam){
  const el=document.createElement('div');el.className='label '+klasse;
  el.innerHTML='<div class="naam"></div><div class="hp" hidden><i></i></div>';
  el.querySelector('.naam').textContent=naam;labelsEl.appendChild(el);
  return{el,naam:el.querySelector('.naam'),hp:el.querySelector('.hp'),hpi:el.querySelector('.hp i'),bubble:null,timer:0};
}
export function plaatsLabel(l,x,y,z,camera){
  _v.set(x,y,z).project(camera);
  if(_v.z>1||Math.abs(_v.x)>1.3||Math.abs(_v.y)>1.3){l.el.style.display='none';return}
  l.el.style.display='';
  l.el.style.transform=`translate(${((_v.x+1)/2*innerWidth).toFixed(1)}px,${((1-_v.y)/2*innerHeight).toFixed(1)}px) translate(-50%,-100%)`;
}
export function labelHp(l,hp,max,toon){
  l.hp.hidden=!toon;if(toon)l.hpi.style.transform=`scaleX(${Math.max(0,hp/max).toFixed(3)})`;
}
export function verwijderLabel(l){l.el.remove()}
export function bubble(l,tekst){
  if(l.bubble)l.bubble.remove();const b=document.createElement('div');b.className='bubble';b.textContent=tekst;l.el.appendChild(b);l.bubble=b;
  clearTimeout(l.timer);l.timer=setTimeout(()=>{b.remove();if(l.bubble===b)l.bubble=null},6000);
}

export function getal(x,y,z,camera,tekst,klasse=''){
  _v.set(x,y,z).project(camera);if(_v.z>1)return;
  const d=document.createElement('div');d.className='dmg '+klasse;d.textContent=tekst;
  d.style.left=((_v.x+1)/2*innerWidth+(Math.random()*24-12)).toFixed(0)+'px';d.style.top=((1-_v.y)/2*innerHeight).toFixed(0)+'px';
  fxEl.appendChild(d);setTimeout(()=>d.remove(),950);
}

export function log(html){const d=document.createElement('div');d.innerHTML=html;logEl.appendChild(d);while(logEl.children.length>60)logEl.firstChild.remove();logEl.scrollTop=logEl.scrollHeight}
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function sys(tekst){log('<span class="sys">'+esc(tekst)+'</span>')}
export function chat(wie,tekst){log('<span class="wie">'+esc(wie)+':</span> '+esc(tekst))}

let meldT=0;
export function melding(groot,klein=''){
  const el=$('#melding');el.innerHTML='<div class="groot">'+esc(groot)+'</div>'+(klein?'<div class="klein">'+esc(klein)+'</div>':'');
  clearTimeout(meldT);meldT=setTimeout(()=>{el.innerHTML=''},2600);
}

export function hud(P,hpMax,spMax,expMax,dranken){
  $('#h-naam').textContent=P.naam;$('#h-lvl').textContent=P.lvl;$('#h-job').textContent=P.job;
  $('#h-hp').style.transform=`scaleX(${(P.hp/hpMax).toFixed(3)})`;$('#h-hpt').textContent=Math.ceil(P.hp)+' / '+hpMax;
  $('#h-sp').style.transform=`scaleX(${(P.sp/spMax).toFixed(3)})`;$('#h-spt').textContent=Math.floor(P.sp)+' / '+spMax;
  $('#h-exp').style.transform=`scaleX(${(P.exp/expMax).toFixed(3)})`;$('#h-expbar').title='Experience: '+P.exp+' / '+expMax;
  $('#h-zeny').textContent=P.zeny;$('#h-drank').textContent=dranken;$('#w-zeny').textContent=P.zeny;
}
export function doelkader(m){
  const el=$('#doelkader');if(!m){el.hidden=true;return}
  el.hidden=false;$('#d-naam').textContent=m.spec.naam;$('#d-lvl').textContent='Lv '+m.spec.lvl;
  $('#d-hp').style.transform=`scaleX(${Math.max(0,m.hp/m.hpm).toFixed(3)})`;$('#d-hpt').textContent=Math.max(0,Math.ceil(m.hp))+' / '+m.hpm;
}
export function cooldown(skill,frac){const s=document.querySelector(`.slot[data-skill="${skill}"] .cd`);if(s)s.style.transform=`scaleY(${Math.max(0,Math.min(1,frac)).toFixed(3)})`}
export function slotStatus(skill,uit,actief){const s=document.querySelector(`.slot[data-skill="${skill}"]`);if(!s)return;s.classList.toggle('uit',!!uit);s.classList.toggle('actief',!!actief)}
export function online(verbonden,aantal){$('#h-stip').classList.toggle('aan',verbonden);$('#h-online').textContent=verbonden?aantal+' online':'offline'}
