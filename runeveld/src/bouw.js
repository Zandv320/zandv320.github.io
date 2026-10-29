/* Runeveld – de dorpsomgeving in pixel-3D, zoals Ragnarok Online: dichte 3D-vormen (dozen, daken, cilinders)
   bekleed met tegelbare pixeltexturen in het palet van de sprites (sprites/tex/, gemaakt door tools/maak_sprites.py),
   en met een donkere omlijning zoals de sprites die hebben. Figuren en planten blijven platte sprites.
   Maten in wereld-eenheden; de texturen hebben 16 px per eenheid, net als de sprites. */
import * as THREE from 'three';
import {GLAD,PIXEL} from './sprites.js';

const PPU=16;
const basis=new Map();          /* naam → geladen afbeelding */
const varianten=new Map();      /* naam|rx|ry → gekloonde textuur met eigen herhaling */
const NAMEN=['muur','dak','steen','hout','hout_donker','stof_rood','stof_groen','glas','water','keien','keien2','pad'];
const LIJN=0x0c0f2a;

export function laadTexturen(){
  return Promise.all(NAMEN.map(n=>new Promise((res,rej)=>{const img=new Image();img.onload=()=>{basis.set(n,img);res()};img.onerror=()=>rej(new Error('Textuur ontbreekt: '+n));img.src='sprites/tex/'+n+'.png'})));
}
/* breedte en hoogte van één tegel in wereld-eenheden */
const tegelW=naam=>basis.get(naam).width/PPU,tegelH=naam=>basis.get(naam).height/PPU;
/* een textuur die rx × ry keer herhaalt; pixel-scherp (nearest) */
export function tex(naam,rx=1,ry=1){
  const k=`${naam}|${rx.toFixed(3)}|${ry.toFixed(3)}`;if(varianten.has(k))return varianten.get(k);
  const t=new THREE.Texture(basis.get(naam));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);
  t.magFilter=GLAD?THREE.LinearFilter:THREE.NearestFilter;
  if(GLAD){t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4}else{t.minFilter=THREE.NearestFilter;t.generateMipmaps=false}   /* geen mipmaps: geen wisselende niveaus */
  t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;varianten.set(k,t);return t;
}
/* belicht materiaal voor een vlak van w × h eenheden: de textuur herhaalt op ware grootte; `tint` maakt het iets donkerder */
export const mat=(naam,w,h,tint=1)=>new THREE.MeshLambertMaterial({map:tex(naam,w/tegelW(naam),h/tegelH(naam)),color:new THREE.Color(tint,tint,tint),polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const kleur=(hex,tint=1)=>new THREE.MeshLambertMaterial({color:new THREE.Color(hex).multiplyScalar(tint),polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
const lijnMat=new THREE.LineBasicMaterial({color:LIJN});
/* donkere omlijning langs scherpe randen, zoals de omlijning van de sprites */
function omlijn(mesh,hoek=35){mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,hoek),lijnMat));return mesh}
const doos=(w,h,d,m)=>{const b=omlijn(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m));b.position.y=h/2;return b};
/* een doos waarvan elke zijde de textuur op ware grootte herhaalt */
function blok(w,h,d,naam,tint=1){
  return doos(w,h,d,[mat(naam,d,h,tint*.88),mat(naam,d,h,tint*.88),mat(naam,w,d,tint*.95),mat(naam,w,d,tint),mat(naam,w,h,tint),mat(naam,w,h,tint*.92)]);
}
function helling(w,L,naam,tint){const p=omlijn(new THREE.Mesh(new THREE.PlaneGeometry(w,L),mat(naam,w,L,tint)));p.material.side=THREE.DoubleSide;return p}

/* ---------- huis: muren, plint, deur, ramen, zadeldak met overstek, gevels, nokbalk en schoorsteen ---------- */
export function huis({w=6,d=5,h=3,dakH=2.2,muur='muur',ramen=2,schoorsteen=true}={}){
  const g=new THREE.Group();
  g.add(blok(w,h,d,muur));
  g.add(blok(w+.1,.5,d+.1,'steen'));
  /* deur en ramen op de voorkant (+z) */
  const deur=doos(.9,1.7,.08,mat('hout_donker',.9,1.7));deur.position.set(-w/2+1.3,.85,d/2+.04);g.add(deur);
  for(let i=0;i<ramen;i++){const x=w/2-1-i*1.6;const glas=doos(.8,.9,.08,mat('glas',.8,.9));glas.position.set(x,1.8,d/2+.04);g.add(glas)}
  for(const t of[1,-1]){const glas=doos(.08,.9,.8,mat('glas',.8,.9));glas.position.set(t*(w/2+.04),1.8,0);g.add(glas)}
  /* zadeldak: nok langs x, hellingen naar voor en achter */
  const ov=.45,span=d/2+ov,L=Math.hypot(span,dakH),a=Math.atan2(dakH,span);
  for(const[teken,tint]of[[1,1],[-1,.85]]){const p=helling(w+2*ov,L,'dak',tint);p.rotation.x=-Math.PI/2+teken*a;p.position.set(0,h+dakH/2,teken*span/2);g.add(p)}
  /* puntgevels dicht, in de muurtextuur */
  const drie=new THREE.Shape();drie.moveTo(-d/2,0);drie.lineTo(d/2,0);drie.lineTo(0,dakH);drie.closePath();
  const gevelGeo=new THREE.ShapeGeometry(drie);const uv=gevelGeo.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/tegelW(muur),uv.getY(i)/tegelH(muur));
  for(const t of[1,-1]){const m=omlijn(new THREE.Mesh(gevelGeo,new THREE.MeshLambertMaterial({map:tex(muur,1,1),color:new THREE.Color(.9,.9,.9),side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1})));m.rotation.y=t*Math.PI/2;m.position.set(t*w/2,h,0);g.add(m)}
  /* nokbalk en dakranden */
  const nok=doos(w+2*ov+.1,.18,.22,mat('hout_donker',w,.2));nok.position.y=h+dakH-.02;g.add(nok);
  for(const t of[1,-1]){const rand=doos(w+2*ov,.16,.12,mat('hout_donker',w,.2));rand.position.set(0,h-.04,t*span);g.add(rand)}
  if(schoorsteen){const s=blok(.7,dakH*.95,.7,'steen');s.position.set(w/2-1.1,h+dakH*.25,-d*.15);g.add(s)}
  return g;
}

/* ---------- houten hek: twee palen en twee liggers per segment (lengte `L`, langs x) ---------- */
export function hek(L=2.6,h=1.25){
  const g=new THREE.Group();
  for(const t of[-1,1]){const p=doos(.2,h,.2,mat('hout_donker',.2,h));p.position.x=t*(L/2-.1);g.add(p)}
  for(const y of[h*.42,h*.8]){const r=doos(L,.16,.1,mat('hout',L,.16));r.position.y=y;g.add(r)}
  return g;
}

/* ---------- waterput: stenen rand met water, twee palen, dwarsbalk en een dakje ---------- */
export function put(){
  const g=new THREE.Group();
  const rand=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.95,1,.9,12),mat('steen',6,.9)),40);rand.position.y=.45;g.add(rand);
  const water=new THREE.Mesh(new THREE.CircleGeometry(.8,12),grondMat('water',1.6,1.6));water.rotation.x=-Math.PI/2;water.position.y=.62;g.add(water);
  for(const t of[-1,1]){const p=doos(.18,2.2,.18,mat('hout_donker',.2,2.2));p.position.set(t*.85,0,0);g.add(p)}
  const balk=doos(1.9,.16,.16,mat('hout',1.9,.16));balk.position.y=1.5;g.add(balk);
  const ov=.3,span=.9,dakH=.6,L=Math.hypot(span,dakH),a=Math.atan2(dakH,span);
  for(const[teken,tint]of[[1,1],[-1,.85]]){const p=helling(2.2,L,'dak',tint);p.rotation.x=-Math.PI/2+teken*a;p.position.set(0,2.2+dakH/2,teken*span/2);g.add(p)}
  return g;
}

/* ---------- marktkraam: toonbank, vier palen, schuine stoffen luifel en wat koopwaar ---------- */
export function kraam({stof='stof_rood',w=3.2,d=1.6}={}){
  const g=new THREE.Group();
  const bank=blok(w,.95,d*.75,'hout');bank.position.z=d*.1;g.add(bank);
  const blad=doos(w+.1,.1,d*.75+.1,mat('hout_donker',w,.1));blad.position.set(0,.95,d*.1);g.add(blad);
  for(const[x,z]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=doos(.16,2.4,.16,mat('hout_donker',.16,2.4));p.position.set(x*(w/2-.1),0,z*(d/2-.1));g.add(p)}
  const L=d+.6,a=Math.atan2(.5,L);
  const luifel=helling(w+.4,L,stof,1);luifel.rotation.x=-Math.PI/2+a;luifel.position.set(0,2.55,.1);g.add(luifel);
  const val=doos(w+.4,.35,.05,mat(stof,w+.4,.35));val.position.set(0,2.15,d/2+.32);g.add(val);
  for(const[x,hh,n]of[[-1,.3,'hout'],[0,.25,'hout_donker'],[1,.35,'steen']]){const k=blok(.6,hh,.5,n);k.position.set(x*.95,1,d*.1);g.add(k)}
  return g;
}

/* ---------- ton en kist ---------- */
export function ton(){
  const g=new THREE.Group();
  const lijf=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.95,10),mat('hout',2.3,.95)),40);lijf.position.y=.475;g.add(lijf);
  for(const y of[.2,.75]){const band=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.385,.385,.08,10),kleur(0x3d3333)),40);band.position.y=y;g.add(band)}
  const top=new THREE.Mesh(new THREE.CircleGeometry(.36,10),mat('hout_donker',.72,.72));top.rotation.x=-Math.PI/2;top.position.y=.96;g.add(top);
  return g;
}
export function kist(w=.85){
  const g=new THREE.Group();g.add(blok(w,w*.85,w,'hout'));
  for(const[x,z]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const r=doos(.08,w*.85,.08,mat('hout_donker',.1,w));r.position.set(x*w/2,0,z*w/2);g.add(r)}
  return g;
}

/* ---------- plein en pad als texturen op de grond (zonder polygon-offset, anders zakken ze onder het gras) ---------- */
const grondMat=(naam,w,h)=>new THREE.MeshLambertMaterial({map:tex(naam,w/tegelW(naam),h/tegelH(naam))});
export function plein(straal){
  const m=new THREE.Mesh(new THREE.CircleGeometry(straal,48),grondMat('keien',straal*2,straal*2));
  m.rotation.x=-Math.PI/2;m.position.y=.02;return m;
}
export function pad(breedte,lengte){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(breedte,lengte),grondMat('pad',breedte,lengte));
  m.rotation.x=-Math.PI/2;m.position.y=.015;return m;
}
