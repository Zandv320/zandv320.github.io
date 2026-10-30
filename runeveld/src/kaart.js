/* Runeveld – wereldkaart (M) en minimap. De vaste laag (grond, wegen, gebouwen, bomen) wordt één keer getekend
   uit wat er in de scene staat (userData.kaart op bouwsels en vlakken, de billboards uit `borden`); de live laag
   (speler, medespelers, monsters, npc's met questmarkers) wordt elk frame opnieuw getekend zolang de kaart open is. */
import * as THREE from 'three';
import {BOS,inBos,inVeld,VALE,inVale,STAD,inStad,KASTEEL,inKasteel} from './gebied.js';

const KLEUR={
  buiten:'#2f4a22',gras:'#86b54c',bos:'#4c7a3b',dorp:'#8fbb52',weide:'#9cbe56',stad:'#c4ab84',kasteelgrond:'#b3a494',
  plein:'#d9905a',pad:'#caa062',plek:'#8e8d86',straat:'#a99a84',
  muur:'#7d7d78',toren:'#66665f',poort:'#55554f',kasteel:'#6a6a92',fontein:'#58a6d8',standbeeld:'#b9b9b2',kerk:'#8f7fb2',tent:'#6f8f4a',
  huis:'#5d6c9c',huisRand:'#0c0f2a',hut:'#a6713c',hek:'#6b4a2a',put:'#8f8e89',kraam:'#c9473d',kraam2:'#4f9a4f',
  klein:'#8a5a2a',hooi:'#d9b25a',vijver:'#58a6d8',moestuin:'#7a5536',altaar:'#b4b2aa',menhir:'#86857f',
  boom:'#3b8a3c',den:'#2d6b3a',struik:'#67ad4c',rots:'#9b9b95',lantaarn:'#ffd27a',
  speler:'#ffffff',ander:'#7cc4ff',monster:'#f87171',monsterRustig:'#ffd1a6',npc:'#ffc857',quest:'#ffe9a8',
};
const X0=VALE.x0-4,X1=70,Z0=BOS.z0,Z1=70;        /* de wereld: Kingsvale in het westen, het veld, het bos erboven */

/* A: {scene, borden, P, M (monsters), S (medespelers), npcs() → [{naam,x,z,label}], Q (quests), VELD, DORP, PLEIN, loopNaar(x,z), inDorp} */
export function maakKaart(A){
  const $=s=>document.querySelector(s);
  const el=$('#kaart'),cv=$('#kaart-canvas'),ctx=cv.getContext('2d');
  const mini=$('#minimap'),mctx=mini.getContext('2d');
  let open=false,S=0,vast=null,items=null;

  /* ---- de vaste laag ---- */
  function verzamel(){
    items={vlak:[],bouw:[],prop:[]};
    const box=new THREE.Box3();
    A.scene.traverse(o=>{const k=o.userData&&o.userData.kaart;if(!k)return;
      if(typeof k==='string'){box.setFromObject(o);items.bouw.push({soort:k,x0:box.min.x,z0:box.min.z,x1:box.max.x,z1:box.max.z,x:o.position.x,z:o.position.z,rot:o.rotation.y})}
      else items.vlak.push({...k,x:o.position.x,z:o.position.z,rot:o.rotation.y});
    });
    for(const b of A.borden)if(b.naam)items.prop.push({soort:b.naam,x:b.x,z:b.z,schaal:b.schaal||1});
  }
  function tekenVast(schaal){
    if(!items)verzamel();
    const c=document.createElement('canvas');c.width=Math.ceil((X1-X0)*schaal);c.height=Math.ceil((Z1-Z0)*schaal);const g=c.getContext('2d');
    const px=x=>(x-X0)*schaal,pz=z=>(z-Z0)*schaal;
    /* grond: buiten de wereld, het veld, het bos, het dorp */
    g.fillStyle=KLEUR.buiten;g.fillRect(0,0,c.width,c.height);
    /* de golvende vormen van veld en bos, per halve eenheid */
    const st=.5;
    for(let z=Z0;z<Z1;z+=st)for(let x=X0;x<X1;x+=st){const xx=x+st/2,zz=z+st/2,v=inVeld(xx,zz),b=inBos(xx,zz),w=inVale(xx,zz);if(!v&&!b&&!w)continue;
      g.fillStyle=v?KLEUR.gras:b?KLEUR.bos:inStad(xx,zz)?(inKasteel(xx,zz)?KLEUR.kasteelgrond:KLEUR.stad):KLEUR.weide;g.fillRect(px(x),pz(z),st*schaal+.5,st*schaal+.5)}
    g.fillStyle=KLEUR.dorp;g.fillRect(px(-A.DORP),pz(-A.DORP),2*A.DORP*schaal,2*A.DORP*schaal);
    /* vlakken: plein, wegen, open plek */
    for(const v of items.vlak){
      if(v.soort==='pad'||v.soort==='straat'){g.save();g.translate(px(v.x),pz(v.z));g.rotate(-v.rot);g.fillStyle=KLEUR[v.soort];g.fillRect(-v.w/2*schaal,-v.l/2*schaal,v.w*schaal,v.l*schaal);g.restore()}
      else{g.fillStyle=KLEUR[v.soort]||KLEUR.plein;g.beginPath();g.arc(px(v.x),pz(v.z),v.r*schaal,0,Math.PI*2);g.fill()}
    }
    /* bouwsels als hun omhullende doos */
    for(const b of items.bouw){
      const w=(b.x1-b.x0)*schaal,h=(b.z1-b.z0)*schaal,x=px(b.x0),y=pz(b.z0);
      if(b.soort==='huis'){const hut=b.z<BOS.z1;g.fillStyle=hut?KLEUR.hut:KLEUR.huis;g.fillRect(x,y,w,h);g.strokeStyle=KLEUR.huisRand;g.lineWidth=Math.max(1,schaal*.25);g.strokeRect(x+.5,y+.5,w-1,h-1)}
      else if(b.soort==='hek'){g.fillStyle=KLEUR.hek;g.fillRect(x,y,Math.max(w,schaal*.4),Math.max(h,schaal*.4))}
      else if(b.soort==='kraam'){g.fillStyle=b.x<0?KLEUR.kraam:KLEUR.kraam2;g.fillRect(x,y,w,h)}
      else if(b.soort==='vijver'||b.soort==='put'||b.soort==='altaar'||b.soort==='menhir'||b.soort==='toren'||b.soort==='fontein'||b.soort==='standbeeld'){g.fillStyle=KLEUR[b.soort];g.beginPath();g.ellipse(px(b.x),pz(b.z),w/2,h/2,0,0,Math.PI*2);g.fill()}
      else{g.fillStyle=KLEUR[b.soort]||KLEUR.klein;g.fillRect(x,y,w,h)}
    }
    /* bomen, struiken, rotsen, lantaarns */
    for(const p of items.prop){
      const s=p.soort.replace(/\d$/,'');
      if(s==='boom'||s==='den'){g.fillStyle=KLEUR[s];g.beginPath();g.arc(px(p.x),pz(p.z),.95*schaal*p.schaal/1.3,0,Math.PI*2);g.fill()}
      else if(s==='struik'){g.fillStyle=KLEUR.struik;g.beginPath();g.arc(px(p.x),pz(p.z),.5*schaal,0,Math.PI*2);g.fill()}
      else if(s==='rots'){g.fillStyle=KLEUR.rots;g.beginPath();g.arc(px(p.x),pz(p.z),.55*schaal,0,Math.PI*2);g.fill()}
      else if(s==='lantaarn'){g.fillStyle=KLEUR.lantaarn;g.fillRect(px(p.x)-schaal*.2,pz(p.z)-schaal*.2,schaal*.4,schaal*.4)}
    }
    /* namen van de gebieden */
    g.textAlign='center';g.fillStyle='rgba(255,255,255,.85)';g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=3;g.lineJoin='round';
    const naam=(t,x,z,maat)=>{g.font=`700 ${maat}px Rubik,sans-serif`;g.strokeText(t,px(x),pz(z));g.fillText(t,px(x),pz(z))};
    naam('Runeveld',0,-A.DORP-3,schaal*2.6);naam(BOS.naam,0,BOS.z0+5,schaal*2.6);naam(VALE.naam,VALE.cx,VALE.z0+8,schaal*2.6);naam(STAD.naam,STAD.cx,STAD.z0-3,schaal*2.2);
    return c;
  }
  function zorgVast(schaal){if(!vast||S!==schaal){S=schaal;vast=tekenVast(schaal)}return vast}

  /* ---- de live laag ---- */
  function stip(g,x,y,r,kleur,rand){g.fillStyle=kleur;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();if(rand){g.strokeStyle=rand;g.lineWidth=1;g.stroke()}}
  function tekenLive(g,schaal,ox,oz,dpr){
    const px=x=>(x-X0)*schaal-ox,pz=z=>(z-Z0)*schaal-oz;
    for(const m of A.M.values()){if(m.dood||!m.sprite.g.visible)continue;stip(g,px(m.x),pz(m.z),2.2*dpr,m.spec.agressief?KLEUR.monster:KLEUR.monsterRustig,'rgba(0,0,0,.5)')}
    for(const n of A.npcs()){stip(g,px(n.x),pz(n.z),2.6*dpr,KLEUR.npc,'rgba(0,0,0,.6)');
      const q=n.label&&n.label.el.querySelector('.qm');if(q&&!q.hidden){g.font=`900 ${11*dpr}px Rubik,sans-serif`;g.textAlign='center';g.fillStyle=q.classList.contains('bezig')?'#c9d3dd':KLEUR.quest;g.strokeStyle='#000';g.lineWidth=2*dpr;g.strokeText(q.textContent,px(n.x),pz(n.z)-4*dpr);g.fillText(q.textContent,px(n.x),pz(n.z)-4*dpr)}}
    for(const s of A.S.values())stip(g,px(s.x),pz(s.z),3*dpr,KLEUR.ander,'#000');
    /* de speler: een pijl in de kijkrichting */
    const P=A.P,k=P.sprite?P.sprite.kijk:{x:0,y:1},a=Math.atan2(k.x,-k.y);
    g.save();g.translate(px(P.x),pz(P.z));g.rotate(a);g.fillStyle=KLEUR.speler;g.strokeStyle='#000';g.lineWidth=1.5*dpr;
    g.beginPath();g.moveTo(0,-6*dpr);g.lineTo(4.5*dpr,5*dpr);g.lineTo(0,2.5*dpr);g.lineTo(-4.5*dpr,5*dpr);g.closePath();g.fill();g.stroke();g.restore();
  }

  /* ---- het kaartpaneel: de hele wereld past in beeld; scrollen zoomt in (tot 4×), slepen verschuift, klikken loopt ---- */
  const VS=10;                                   /* de vaste laag staat op 10 px per eenheid (× pixelverhouding) */
  let zoom=1,cx=(X0+X1)/2,cz=(Z0+Z1)/2,fit=1,dpr=1,sleep=null;
  function maat(){
    dpr=Math.min(2,devicePixelRatio||1);
    const bw=Math.min(innerWidth-48,960),bh=innerHeight-150;
    fit=Math.max(2,Math.min(bw/(X1-X0),bh/(Z1-Z0)));
    const w=Math.round((X1-X0)*fit),h=Math.round((Z1-Z0)*fit);
    if(cv.style.width!==w+'px'){cv.style.width=w+'px';cv.style.height=h+'px';cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr)}
  }
  /* schaal in canvaspixels per eenheid, en de linkerbovenhoek van het zicht in wereldcoördinaten */
  function zicht(){
    const k=fit*zoom*dpr,bw=cv.width/k,bh=cv.height/k;
    cx=Math.max(X0+bw/2,Math.min(X1-bw/2,cx));cz=Math.max(Z0+bh/2,Math.min(Z1-bh/2,cz));
    return{k,wx0:cx-bw/2,wz0:cz-bh/2,bw,bh};
  }
  function render(){
    if(!open)return;
    maat();const v=zorgVast(VS*dpr);const{k,wx0,wz0,bw,bh}=zicht();
    ctx.imageSmoothingEnabled=true;ctx.drawImage(v,(wx0-X0)*VS*dpr,(wz0-Z0)*VS*dpr,bw*VS*dpr,bh*VS*dpr,0,0,cv.width,cv.height);
    tekenLive(ctx,k,(wx0-X0)*k,(wz0-Z0)*k,dpr);
  }
  const naarWereld=e=>{const r=cv.getBoundingClientRect(),{k,wx0,wz0}=zicht();return[wx0+(e.clientX-r.left)*dpr/k,wz0+(e.clientY-r.top)*dpr/k]};
  cv.addEventListener('wheel',e=>{e.preventDefault();const[x,z]=naarWereld(e);const z0=zoom;zoom=Math.max(1,Math.min(4,zoom*Math.max(1/1.6,Math.min(1.6,Math.exp(-e.deltaY*.0025)))));
    /* het punt onder de muis blijft op zijn plek */
    const f=1-z0/zoom;cx+=(x-cx)*f;cz+=(z-cz)*f;render()},{passive:false});
  cv.addEventListener('pointerdown',e=>{sleep={x:e.clientX,y:e.clientY,cx,cz,bewoog:false};cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{
    if(sleep){const dx=e.clientX-sleep.x,dy=e.clientY-sleep.y;if(Math.hypot(dx,dy)>4)sleep.bewoog=true;
      if(sleep.bewoog){const k=fit*zoom;cx=sleep.cx-dx/k;cz=sleep.cz-dy/k;render()}}
    const[x,z]=naarWereld(e);
    $('#kaart-pos').textContent=`${Math.round(x)}, ${Math.round(z)} · ${inStad(x,z)?STAD.naam:inBos(x,z)?BOS.naam:(inVale(x,z)&&!inVeld(x,z))?VALE.naam:A.inDorp(x,z)?'Runeveld village':'Runeveld fields'}`});
  cv.addEventListener('pointerup',e=>{if(!sleep)return;const s=sleep;sleep=null;if(s.bewoog)return;const[x,z]=naarWereld(e);if(A.loopNaar(x,z))sluit()});
  cv.addEventListener('pointercancel',()=>{sleep=null});
  $('#kaart-sluit').onclick=()=>sluit();
  function toon(){open=true;el.hidden=false;if(zoom===1){cx=(X0+X1)/2;cz=(Z0+Z1)/2}render()}
  function sluit(){open=false;el.hidden=true}

  /* ---- de minimap: een uitsnede rond de speler, uit dezelfde vaste laag ---- */
  const MS=2.4;let miniDpr=0;
  function renderMini(){
    if(mini.hidden||!A.P.sprite)return;
    const d=Math.min(2,devicePixelRatio||1);if(d!==miniDpr){miniDpr=d;mini.width=Math.round(156*d);mini.height=Math.round(156*d)}
    const k=MS*d,v=zorgVast(VS*d),w=mini.width,h=mini.height;
    const wx0=A.P.x-w/2/k,wz0=A.P.z-h/2/k;
    mctx.save();mctx.beginPath();mctx.roundRect(0,0,w,h,10*d);mctx.clip();
    mctx.fillStyle=KLEUR.buiten;mctx.fillRect(0,0,w,h);
    mctx.imageSmoothingEnabled=true;mctx.drawImage(v,(wx0-X0)*VS*d,(wz0-Z0)*VS*d,w/k*VS*d,h/k*VS*d,0,0,w,h);
    tekenLive(mctx,k,(wx0-X0)*k,(wz0-Z0)*k,d);mctx.restore();
  }

  return{toon,sluit,toggle(){open?sluit():toon()},isOpen:()=>open,render,renderMini,vernieuw(){items=null;vast=null}};
}
