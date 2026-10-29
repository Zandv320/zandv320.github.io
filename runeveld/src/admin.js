/* Runeveld – admin-paneel (Ctrl+Shift+A of ?admin in de URL).
   Alles hier draait in de browser van de speler en is dus géén beveiliging: het is een handig
   instrumentenbord voor de maker. Zodra de wereld op een server draait, worden dit serverbevelen. */
import {ITEMS,MONSTERS,MAX_LVL} from './data.js';
import {MAX_JOB} from './regels/skills.js';
import {DORP,VELD} from './world.js';
import * as THREE from 'three';
import * as UI from './ui.js';
import {GLAD} from './sprites.js';

const SLEUTEL='runeveld.admin';

/* C: {P,M,S,cam,camera,scene,renderer,ADMIN,net(),isHost(),tasToevoegen,zetLevel,zetJob,respec,teleport,spawnMonster,
       doodMonster,doodAlles,herleefAlles,vernieuwUiterlijk,bewaar,herstel,exportSave,importSave,resetSave,af,obstakels,render} */
export function maakAdmin(C){
  const $=s=>document.querySelector(s);
  const el=$('#admin'),inhoud=$('#a-inhoud'),knop=$('#a-knop');
  const {P,M,S,cam,camera,scene,ADMIN}=C;
  let open=false,fps=0,frames=0,fpsT=0,debug=null;

  /* ?admin in de URL onthoudt de knop in de HUD */
  if(new URLSearchParams(location.search).has('admin'))try{localStorage.setItem(SLEUTEL,'1')}catch(e){}
  let zichtbaar=false;try{zichtbaar=localStorage.getItem(SLEUTEL)==='1'}catch(e){}
  knop.hidden=!zichtbaar;

  const h=(tag,attrs={},html='')=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);e.innerHTML=html;return e};
  const sectie=(titel,openStaat=false)=>{const d=h('details',openStaat?{open:''}:{});d.appendChild(h('summary',{},titel));inhoud.appendChild(d);return d};
  const rij=(ouder,label,...kinderen)=>{const r=h('div',{class:'arij'});r.appendChild(h('label',{},label));for(const k of kinderen)r.appendChild(k);ouder.appendChild(r);return r};
  const knoppen=(ouder,lijst)=>{const r=h('div',{class:'aknoppen'});for(const[tekst,fn,klasse]of lijst){const b=h('button',{class:'aknop '+(klasse||'')},tekst);b.onclick=()=>{fn();ververs()};r.appendChild(b)}ouder.appendChild(r);return r};
  const schuif=(ouder,label,get,set,min,max,stap=1,fmt=v=>v)=>{const i=h('input',{type:'range',min,max,step:stap});i.value=get();const o=h('output',{},fmt(get()));i.oninput=()=>{set(+i.value);o.textContent=fmt(+i.value)};rij(ouder,label,i,o);return i};
  const getal=(ouder,label,get,set,min,max)=>{const i=h('input',{type:'number',min,max});i.value=get();i.onchange=()=>{set(+i.value);ververs()};rij(ouder,label,i);return i};
  const schakel=(ouder,label,get,set)=>{const b=h('button',{class:'aknop'+(get()?' aan':'')},get()?'on':'off');b.onclick=()=>{set(!get());b.classList.toggle('aan',get());b.textContent=get()?'on':'off'};rij(ouder,label,b);return b};

  function bouw(){
    inhoud.innerHTML='';
    /* ---------- character ---------- */
    let d=sectie('Character',true);
    const lvl=getal(d,'Base level',()=>P.lvl,v=>C.zetLevel(v),1,MAX_LVL);
    const job=getal(d,'Job level',()=>P.job,v=>C.zetJob(v),1,50);
    getal(d,'Zeny',()=>P.zeny,v=>{P.zeny=Math.max(0,v|0);C.render()},0,9999999);
    knoppen(d,[['Full HP/SP',()=>C.herstel()],['+1000 zeny',()=>{P.zeny+=1000;C.render()}],['Reset stats & skills',()=>C.respec(),'rood']]);
    schakel(d,'God mode (no damage)',()=>ADMIN.god,v=>ADMIN.god=v);
    schakel(d,'No clip (walk through things)',()=>ADMIN.noclip,v=>ADMIN.noclip=v);
    schuif(d,'Speed ×',()=>ADMIN.snelheid,v=>ADMIN.snelheid=v,.5,6,.5,v=>v+'×');
    schuif(d,'Exp ×',()=>ADMIN.expMult,v=>ADMIN.expMult=v,1,50,1,v=>v+'×');
    schuif(d,'Drop chance ×',()=>ADMIN.dropMult,v=>ADMIN.dropMult=v,1,20,1,v=>v+'×');
    /* ---------- items ---------- */
    d=sectie('Items');
    const sel=h('select');for(const[id,it]of Object.entries(ITEMS))sel.appendChild(h('option',{value:id},`${it.icoon} ${it.naam}`));
    const aantal=h('input',{type:'number',min:1,max:99,value:1});
    const geef=h('button',{class:'aknop'},'Give');geef.onclick=()=>{C.tasToevoegen(sel.value,+aantal.value||1);C.render()};
    rij(d,'',sel,aantal,geef);
    knoppen(d,[['Give one of everything',()=>{for(const id of Object.keys(ITEMS))C.tasToevoegen(id,1);C.render()}],['Empty bag',()=>{P.tas.length=0;C.render()},'rood']]);
    /* ---------- teleport ---------- */
    d=sectie('Teleport');
    const tx=h('input',{type:'number',value:0}),tz=h('input',{type:'number',value:0});const ga=h('button',{class:'aknop'},'Go');ga.onclick=()=>C.teleport(+tx.value,+tz.value);
    rij(d,'x / z',tx,tz,ga);
    knoppen(d,[['Well',()=>C.teleport(0,4)],['North gate',()=>C.teleport(0,-DORP-3)],['South gate',()=>C.teleport(0,DORP+3)],['Rabbits',()=>C.teleport(12,-30)],['Foxes',()=>C.teleport(-40,10)],['Boars',()=>C.teleport(50,45)],['World edge',()=>C.teleport(VELD-3,0)]]);
    /* ---------- monsters ---------- */
    d=sectie('Monsters');
    const hostNoot=h('p',{class:'amono'});d.appendChild(hostNoot);
    const msel=h('select');for(const[id,m]of Object.entries(MONSTERS))msel.appendChild(h('option',{value:id},m.naam));
    const spawn=h('button',{class:'aknop'},'Spawn here');spawn.onclick=()=>{if(!C.spawnMonster(msel.value,P.x+2,P.z))UI.sys('Only the world host can spawn monsters.');ververs()};
    rij(d,'',msel,spawn);
    schakel(d,'Freeze monsters (host)',()=>ADMIN.bevroren,v=>ADMIN.bevroren=v);
    knoppen(d,[['Kill all',()=>C.doodAlles(),'rood'],['Respawn dead (host)',()=>C.herleefAlles()]]);
    const tabel=h('table',{class:'atabel'});d.appendChild(tabel);
    /* ---------- world & camera ---------- */
    d=sectie('World & camera');
    schuif(d,'Camera tilt',()=>Math.round(THREE.MathUtils.radToDeg(cam.tilt)),v=>cam.tilt=THREE.MathUtils.degToRad(v),25,85,1,v=>v+'°');
    schuif(d,'Zoom (px per unit)',()=>cam.px,v=>C.zetZoom(v),4,96,4);
    schuif(d,'Time of day (24 = real clock)',()=>C.tijd(),v=>C.zetTijd(v>=24?null:v),0,24,.5,v=>v>=24?'real':v+'h');
    schakel(d,'Fog',()=>!!scene.fog,v=>{scene.fog=v?new THREE.Fog(0x87c9ee,55,95):null});
    schuif(d,'Pixel size (reloads)',()=>{try{return parseFloat(localStorage.getItem('runeveld.pixel'))||2}catch(e){return 2}},v=>{try{localStorage.setItem('runeveld.pixel',String(v))}catch(e){}clearTimeout(window.__pxT);window.__pxT=setTimeout(()=>location.reload(),600)},1,4,.5,v=>v+'px');
    schakel(d,'Smooth graphics (reloads)',()=>GLAD,v=>{try{localStorage.setItem('runeveld.glad',v?'1':'0')}catch(e){}location.reload()});
    schakel(d,'Show collision & zones',()=>!!debug,v=>{v?toonDebug():verbergDebug()});
    const info=h('p',{class:'amono'});d.appendChild(info);
    /* ---------- network ---------- */
    d=sectie('Network');
    const netinfo=h('p',{class:'amono'});d.appendChild(netinfo);
    const spelersTabel=h('table',{class:'atabel'});d.appendChild(spelersTabel);
    /* ---------- save ---------- */
    d=sectie('Save');
    const ta=h('textarea',{spellcheck:'false'});d.appendChild(ta);
    knoppen(d,[['Show save',()=>{C.bewaar();ta.value=C.exportSave()||''}],['Copy',()=>{C.bewaar();navigator.clipboard&&navigator.clipboard.writeText(C.exportSave()||'')}],['Load from text',()=>{try{JSON.parse(ta.value);C.importSave(ta.value)}catch(e){UI.sys('That is not valid save JSON.')}},'rood'],['Reset save',()=>{if(confirm('Delete this character and start over?'))C.resetSave()},'rood']]);
    knoppen(d,[[knop.hidden?'Show 🛠️ button in HUD':'Hide 🛠️ button',()=>{knop.hidden=!knop.hidden;try{localStorage.setItem(SLEUTEL,knop.hidden?'0':'1')}catch(e){}}]]);
    el.ververs=()=>{
      lvl.value=P.lvl;job.value=P.job;
      hostNoot.textContent=C.isHost()?'You are the world host: spawn, freeze and respawn work.':'Another player hosts the world: kill works, spawn/freeze/respawn do not.';
      const rijen=[];for(const m of M.values()){rijen.push(`<tr><td>${m.id}</td><td class="r">${m.dood?'dead':Math.round(m.hp)+'/'+m.hpm}</td><td class="r">${m.x.toFixed(0)},${m.z.toFixed(0)}</td><td><button class="aknop" data-ga="${m.id}">go</button> <button class="aknop rood" data-dood="${m.id}">kill</button></td></tr>`)}
      tabel.innerHTML=rijen.join('')||'<tr><td>no monsters yet</td></tr>';
      const r=C.renderer.info.render;info.textContent=`${fps} fps · ${r.calls} draw calls · ${r.triangles} triangles · player ${P.x.toFixed(1)}, ${P.z.toFixed(1)} · ${C.obstakels.length} obstacles`;
      const n=C.net();netinfo.textContent=n?`id ${n.me} · ${n.verbonden()?'connected':'offline'} · broker ${n.broker()||'-'} · host ${n.hostId()===n.me?'me':n.hostId()}`:'no network yet';
      spelersTabel.innerHTML=[...S.entries()].map(([id,s])=>`<tr><td>${s.pres.n}</td><td class="r">Lv ${s.pres.l}</td><td class="r">${s.x.toFixed(0)},${s.z.toFixed(0)}</td><td><button class="aknop" data-naar="${id}">go</button></td></tr>`).join('')||'<tr><td>nobody else online</td></tr>';
    };
  }
  inhoud.addEventListener('click',e=>{
    const b=e.target.closest('button[data-ga],button[data-dood],button[data-naar]');if(!b)return;
    if(b.dataset.ga){const m=M.get(b.dataset.ga);if(m)C.teleport(m.x+1.5,m.z)}
    else if(b.dataset.dood){const m=M.get(b.dataset.dood);if(m)C.doodMonster(m)}
    else if(b.dataset.naar){const s=S.get(b.dataset.naar);if(s)C.teleport(s.x+1.5,s.z)}
    ververs();
  });
  $('#a-sluit').onclick=()=>sluit();

  /* ---------- debug-overlay: botsingscirkels en monsterzones ---------- */
  function toonDebug(){
    verbergDebug();debug=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:0xff4d4d,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide});
    for(const o of C.obstakels){const m=new THREE.Mesh(new THREE.RingGeometry(o.r*.85,o.r,24),mat);m.rotation.x=-Math.PI/2;m.position.set(o.x,.05,o.z);debug.add(m)}
    const kleuren={konijn:0x9fe3b0,vos:0xffb84d,zwijn:0xff6b6b};
    for(const[id,spec]of Object.entries(MONSTERS))for(const r of(spec.zone||[])){
      const vorm=new THREE.Shape();vorm.moveTo(-r,-r);vorm.lineTo(r,-r);vorm.lineTo(r,r);vorm.lineTo(-r,r);vorm.lineTo(-r,-r);
      const g=new THREE.BufferGeometry().setFromPoints(vorm.getPoints());const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:kleuren[id]}));l.rotation.x=-Math.PI/2;l.position.y=.06;debug.add(l)}
    const dorp=new THREE.Shape();dorp.moveTo(-DORP,-DORP);dorp.lineTo(DORP,-DORP);dorp.lineTo(DORP,DORP);dorp.lineTo(-DORP,DORP);dorp.lineTo(-DORP,-DORP);
    const dl=new THREE.Line(new THREE.BufferGeometry().setFromPoints(dorp.getPoints()),new THREE.LineBasicMaterial({color:0xffffff}));dl.rotation.x=-Math.PI/2;dl.position.y=.06;debug.add(dl);
    scene.add(debug);
  }
  function verbergDebug(){if(debug){scene.remove(debug);debug.traverse(o=>{if(o.geometry)o.geometry.dispose()});debug=null}}

  function ververs(){if(open&&el.ververs)el.ververs()}
  function toon(){open=true;el.hidden=false;if(!el.ververs)bouw();ververs()}
  function sluit(){open=false;el.hidden=true}
  let verversT=0;
  return{
    toon,sluit,toggle(){open?sluit():toon()},isOpen:()=>open,
    tick(dt){frames++;fpsT+=dt;if(fpsT>=1){fps=Math.round(frames/fpsT);frames=0;fpsT=0}if(!open)return;verversT+=dt;if(verversT>=1){verversT=0;ververs()}},
  };
}
