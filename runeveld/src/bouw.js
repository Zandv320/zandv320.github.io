/* Runeveld – de dorpsomgeving in pixel-3D, zoals Ragnarok Online: dichte 3D-vormen (dozen, daken, cilinders)
   bekleed met tegelbare pixeltexturen in het palet van de sprites (sprites/tex/, gemaakt door tools/maak_sprites.py),
   en met een donkere omlijning zoals de sprites die hebben. Figuren en planten blijven platte sprites.
   Maten in wereld-eenheden; de texturen hebben 16 px per eenheid, net als de sprites. */
import * as THREE from 'three';
import {GLAD,PIXEL} from './sprites.js';

const PPU=16;
const basis=new Map();          /* naam → geladen afbeelding */
const varianten=new Map();      /* naam|rx|ry → gekloonde textuur met eigen herhaling */
const NAMEN=['muur','dak','steen','hout','hout_donker','stof_rood','stof_groen','glas','water','keien','keien2','pad','hooi','aarde'];
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
/* grondvlakken zonder polygon-offset, anders zakken ze onder het gras */
const grondMat=(naam,w,h)=>new THREE.MeshLambertMaterial({map:tex(naam,w/tegelW(naam),h/tegelH(naam))});
/* donkere omlijning langs scherpe randen, zoals de omlijning van de sprites */
function omlijn(mesh,hoek=35){mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,hoek),lijnMat));return mesh}
const doos=(w,h,d,m)=>{const b=omlijn(new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m));b.position.y=h/2;return b};
/* een doos waarvan elke zijde de textuur op ware grootte herhaalt. Eén materiaal voor alle zes zijden (één tekenopdracht in
   plaats van zes): de uv's worden per zijde geschaald en de schaduwtint per zijde zit in de vertexkleuren. */
const blokMats=new Map();
function blokMat(naam){let m=blokMats.get(naam);if(!m){m=new THREE.MeshLambertMaterial({map:tex(naam,1,1),vertexColors:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});blokMats.set(naam,m)}return m}
function blok(w,h,d,naam,tint=1){
  const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv,tw=tegelW(naam),th=tegelH(naam);
  const maten=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]],tints=[.88,.88,.95,1,1,.92],kleuren=[];   /* volgorde van BoxGeometry: +x −x +y −y +z −z */
  for(let f=0;f<6;f++){const[a,c]=maten[f],t=tint*tints[f];for(let i=f*4;i<f*4+4;i++){uv.setXY(i,uv.getX(i)*a/tw,uv.getY(i)*c/th);kleuren.push(t,t,t)}}
  geo.setAttribute('color',new THREE.Float32BufferAttribute(kleuren,3));
  const m=omlijn(new THREE.Mesh(geo,blokMat(naam)));m.position.y=h/2;return m;
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
  g.userData.kaart='huis';return g;
}

/* ---------- houten hek: twee palen en twee liggers per segment (lengte `L`, langs x) ---------- */
export function hek(L=2.6,h=1.25){
  const g=new THREE.Group();
  for(const t of[-1,1]){const p=doos(.2,h,.2,mat('hout_donker',.2,h));p.position.x=t*(L/2-.1);g.add(p)}
  for(const y of[h*.42,h*.8]){const r=doos(L,.16,.1,mat('hout',L,.16));r.position.y=y;g.add(r)}
  g.userData.kaart='hek';return g;
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
  g.userData.kaart='put';return g;
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
  g.userData.kaart='kraam';return g;
}

/* ---------- ton en kist ---------- */
export function ton(){
  const g=new THREE.Group();
  const lijf=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.95,10),mat('hout',2.3,.95)),40);lijf.position.y=.475;g.add(lijf);
  for(const y of[.2,.75]){const band=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.385,.385,.08,10),kleur(0x3d3333)),40);band.position.y=y;g.add(band)}
  const top=new THREE.Mesh(new THREE.CircleGeometry(.36,10),mat('hout_donker',.72,.72));top.rotation.x=-Math.PI/2;top.position.y=.96;g.add(top);
  g.userData.kaart='klein';return g;
}
export function kist(w=.85){
  const g=new THREE.Group();g.add(blok(w,w*.85,w,'hout'));
  for(const[x,z]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const r=doos(.08,w*.85,.08,mat('hout_donker',.1,w));r.position.set(x*w/2,0,z*w/2);g.add(r)}
  g.userData.kaart='klein';return g;
}

/* ---------- bankje: zitting, rugleuning en vier poten ---------- */
export function bank(){
  const g=new THREE.Group();
  const zit=doos(1.7,.1,.5,mat('hout',1.7,.5));zit.position.y=.45;g.add(zit);
  const rug=doos(1.7,.45,.08,mat('hout',1.7,.45));rug.position.set(0,.6,-.22);g.add(rug);
  for(const[x,z]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const p=doos(.1,.45,.1,mat('hout_donker',.1,.45));p.position.set(x*.75,0,z*.18);g.add(p)}
  g.userData.kaart='klein';return g;
}

/* ---------- hooibaal: liggende rol ---------- */
export function hooibaal(){
  const g=new THREE.Group();
  const rol=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,1.1,10),mat('hooi',3,1.1)),40);rol.rotation.z=Math.PI/2;rol.position.y=.5;g.add(rol);
  g.userData.kaart='hooi';return g;
}

/* ---------- vijver: water met een stenen rand ---------- */
export function vijver(r=2.4){
  const g=new THREE.Group();
  /* het water staat tot net onder de stenen rand, zodat het als een gevulde vijver leest en niet als een gat */
  const water=new THREE.Mesh(new THREE.CircleGeometry(r+.1,24),grondMat('water',r*2,r*2));water.rotation.x=-Math.PI/2;water.position.y=.3;g.add(water);
  const rand=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(r+.5,r+.6,.4,24,1,true),mat('steen',(r+.5)*6,.4)),40);rand.position.y=.2;g.add(rand);
  const binnen=new THREE.Mesh(new THREE.RingGeometry(r,r+.5,24),grondMat('steen',r*2,r*2));binnen.rotation.x=-Math.PI/2;binnen.position.y=.405;g.add(binnen);
  const bodem=new THREE.Mesh(new THREE.CylinderGeometry(r+.05,r+.05,.4,24,1,true),mat('steen',r*6,.4));bodem.position.y=.2;bodem.material.side=THREE.BackSide;g.add(bodem);
  g.userData.kaart='vijver';return g;
}

/* ---------- moestuin: omgewoelde aarde met een laag hekje eromheen ---------- */
export function moestuin(w=4,d=3){
  const g=new THREE.Group();
  const grond=new THREE.Mesh(new THREE.PlaneGeometry(w,d),grondMat('aarde',w,d));grond.rotation.x=-Math.PI/2;grond.position.y=.025;g.add(grond);
  const n=Math.max(2,Math.round(w/1.3)),m=Math.max(2,Math.round(d/1.3));
  for(let i=0;i<n;i++){const x=-w/2+(i+.5)*w/n;for(const z of[-d/2,d/2]){const h=hek(w/n,.7);h.position.set(x,0,z);g.add(h)}}
  for(let i=0;i<m;i++){const z=-d/2+(i+.5)*d/m;for(const x of[-w/2,w/2]){const h=hek(d/m,.7);h.rotation.y=Math.PI/2;h.position.set(x,0,z);g.add(h)}}
  g.userData.kaart='moestuin';return g;
}

/* ---------- plein en pad als texturen op de grond (zonder polygon-offset, anders zakken ze onder het gras) ---------- */
/* ---------- bos: een oud altaar van gestapelde steen en een menhir ---------- */
export function altaar(){
  const g=new THREE.Group();
  g.add(blok(3.2,.35,2.4,'steen',.86));
  const b=blok(2.3,.5,1.6,'steen',.94);b.position.y=.35+.25;g.add(b);
  const t=blok(1.7,.3,1.1,'steen',1.04);t.position.y=.85+.15;g.add(t);
  g.userData.kaart='altaar';return g;
}
export function menhir(h=2.2){
  const g=new THREE.Group();g.add(blok(.8,h,.6,'steen',.84));
  const k=blok(.6,.3,.45,'steen',.9);k.position.y=h+.15;g.add(k);g.userData.kaart='menhir';return g;
}
export function plein(straal,naam='keien',tint=1){
  const m=new THREE.Mesh(new THREE.CircleGeometry(straal,48),grondMat(naam,straal*2,straal*2));m.material.color.setScalar(tint);m.userData.kaart={soort:naam==='keien'?'plein':'plek',r:straal};
  m.rotation.x=-Math.PI/2;m.position.y=.02;return m;
}
export function pad(breedte,lengte,{x=0,z=0,rot=0}={}){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(breedte,lengte),grondMat('pad',breedte,lengte));m.userData.kaart={soort:'pad',w:breedte,l:lengte};
  m.rotation.order='YXZ';m.rotation.y=rot;m.rotation.x=-Math.PI/2;m.position.set(x,.015,z);return m;
}

/* ====================== Aurelia: stadsmuren, torens, poorten, het kasteel en het stadsleven ====================== */
/* kantelen langs een lengte L (langs x), op hoogte y, aan beide kanten van een dikte `dik` */
/* als één instanced mesh: tientallen kantelen per muur kosten zo één tekenopdracht in plaats van zeven per kanteel */
const kanteelGeo=new THREE.BoxGeometry(.7,.6,.3);
function kantelen(g,L,y,dik){
  const xs=[];for(let x=-L/2+.45;x<L/2-.2;x+=1.3)xs.push(x);
  const im=new THREE.InstancedMesh(kanteelGeo,mat('steen',.7,.6,.9),xs.length*2);const m=new THREE.Matrix4();let i=0;
  for(const x of xs)for(const t of[-1,1]){m.makeTranslation(x,y+.3,t*(dik/2-.15));im.setMatrixAt(i++,m)}
  im.instanceMatrix.needsUpdate=true;g.add(im);
}
/* ---------- stadsmuur: een stenen segment (lengte L langs x) met plint en kantelen ---------- */
export function muur(L=6,h=4,dik=1.4){
  const g=new THREE.Group();g.add(blok(L,h,dik,'steen',.96));
  g.add(blok(L,.5,dik+.3,'steen',.85));kantelen(g,L,h,dik);
  g.userData.kaart='muur';return g;
}
/* ---------- ronde toren met een kegeldak, of open met kantelen ---------- */
export function toren(r=2,h=7,{dak=true}={}){
  const g=new THREE.Group();
  const lijf=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(r,r*1.08,h,12),mat('steen',r*6.5,h)),40);lijf.position.y=h/2;g.add(lijf);
  const rand=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(r*1.18,r*1.08,.6,12),mat('steen',r*7,.6)),40);rand.position.y=h+.3;g.add(rand);
  if(dak){const k=omlijn(new THREE.Mesh(new THREE.ConeGeometry(r*1.3,r*1.7,12),mat('dak',r*8,r*1.7,.95)),30);k.position.y=h+.6+r*.85;g.add(k)}
  else for(let i=0;i<10;i++){const a=i/10*Math.PI*2,k=blok(.6,.55,.35,'steen',.9);k.position.set(Math.cos(a)*r*1.05,h+.6,Math.sin(a)*r*1.05);k.rotation.y=-a;g.add(k)}
  for(const y of[h*.45,h*.75]){const raam=doos(.3,.7,.1,mat('hout_donker',.3,.7));raam.position.set(0,y,r+.02);g.add(raam)}
  g.userData.kaart='toren';g.userData.top=dak?h+.6+r*1.7:h+.6;return g;
}
/* ---------- vlag: een paal met een wapperende lap ---------- */
export function vlag(h=2.4,stof='stof_rood'){
  const g=new THREE.Group();
  const paal=doos(.12,h,.12,mat('hout_donker',.12,h));g.add(paal);
  const lap=doos(1.3,.75,.05,mat(stof,1.3,.75));lap.position.set(.7,h-.45,0);g.add(lap);
  const bol=omlijn(new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),kleur(0xe6bb63)),50);bol.position.y=h+.1;g.add(bol);
  return g;
}
/* ---------- poortgebouw: twee zijblokken, een overspanning met kantelen, een opgehaald valhek en vlaggen; de doorgang langs z ---------- */
export function poortgebouw({w=9,h=5.5,d=3.2,open=3.6}={}){
  const g=new THREE.Group();const zijde=(w-open)/2;
  for(const t of[-1,1]){const b=blok(zijde,h,d,'steen',.96);b.position.x=t*(open/2+zijde/2);g.add(b);
    const p=blok(zijde,.5,d+.3,'steen',.85);p.position.x=t*(open/2+zijde/2);g.add(p)}
  const boven=blok(w,h*.42,d,'steen',.92);boven.position.y=h*.58;g.add(boven);kantelen(g,w,h,d);
  const hek=doos(open,1.1,.1,mat('hout_donker',open,1.1));hek.position.set(0,h*.58-.4,d/2+.05);g.add(hek);
  for(const x of[-open/2-.4,open/2+.4]){const f=doos(.25,h*.5,.25,mat('hout_donker',.25,h*.5));f.position.set(x,h*.1,d/2+.15);g.add(f)}
  for(const t of[-1,1]){const v=vlag(2.2);v.position.set(t*(w/2-.8),h+.3,0);g.add(v)}
  g.userData.kaart='poort';return g;
}
/* ---------- het kasteel: een hoge donjon met vier hoektorens, een middentoren, kantelen, poort, trap en banieren ---------- */
export function kasteel({w=16,d=12,h=8}={}){
  const g=new THREE.Group();
  g.add(blok(w,h,d,'steen',.98));g.add(blok(w+.6,1,d+.6,'steen',.85));
  kantelen(g,w,h,d);
  for(const t of[-1,1]){const zij=new THREE.Group();zij.rotation.y=Math.PI/2;zij.position.x=t*(w/2);kantelen(zij,d,h,.3);g.add(zij)}
  for(const[x,z]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const t=toren(2.2,11);t.position.set(x*(w/2),0,z*(d/2));g.add(t);
    const v=vlag(2.2);v.position.set(x*(w/2),11+.6+2.2*1.7-.2,z*(d/2));g.add(v)}
  const mid=toren(3,15);mid.position.set(0,0,-1.5);g.add(mid);
  const top=vlag(3,'stof_rood');top.position.set(0,15+.6+3*1.7-.2,-1.5);g.add(top);
  /* de poort met een luifel van hout, ramen en banieren aan de voorkant */
  const deur=doos(2.8,3.6,.12,mat('hout_donker',2.8,3.6));deur.position.set(0,1.8,d/2+.06);g.add(deur);
  const boog=blok(3.6,.5,.9,'steen',.9);boog.position.set(0,3.6,d/2+.3);g.add(boog);
  for(const x of[-5.5,-3,3,5.5]){const r=doos(.8,1.3,.08,mat('glas',.8,1.3));r.position.set(x,5.2,d/2+.04);g.add(r)}
  for(const x of[-5.5,5.5]){const b=doos(1.1,2.6,.06,mat('stof_rood',1.1,2.6));b.position.set(x,2.4,d/2+.05);g.add(b)}
  /* een brede trap naar de poort */
  for(let i=0;i<3;i++){const s=blok(6-i*.8,.32,1.1,'steen',.92);s.position.set(0,i*.32,d/2+1.6-i*.55);g.add(s)}
  g.userData.kaart='kasteel';return g;
}
/* ---------- fontein: een bekken met water, een zuil en een bovenschaal ---------- */
export function fontein(r=2.6){
  const g=new THREE.Group();
  const water=new THREE.Mesh(new THREE.CircleGeometry(r,24),grondMat('water',r*2,r*2));water.rotation.x=-Math.PI/2;water.position.y=.42;g.add(water);
  const rand=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(r+.5,r+.6,.6,24,1,true),mat('steen',(r+.5)*6,.6)),40);rand.position.y=.3;g.add(rand);
  const ring=new THREE.Mesh(new THREE.RingGeometry(r,r+.5,24),grondMat('steen',r*2,r*2));ring.rotation.x=-Math.PI/2;ring.position.y=.605;g.add(ring);
  const zuil=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,2.2,10),mat('steen',3,2.2)),40);zuil.position.y=1.1;g.add(zuil);
  const schaal=omlijn(new THREE.Mesh(new THREE.CylinderGeometry(1.2,.7,.4,14),mat('steen',7,.4)),40);schaal.position.y=2.4;g.add(schaal);
  const w2=new THREE.Mesh(new THREE.CircleGeometry(1.05,14),grondMat('water',2,2));w2.rotation.x=-Math.PI/2;w2.position.y=2.61;g.add(w2);
  const punt=omlijn(new THREE.Mesh(new THREE.ConeGeometry(.35,.9,8),mat('steen',2,.9)),40);punt.position.y=3.05;g.add(punt);
  g.userData.kaart='fontein';return g;
}
/* ---------- standbeeld: een sokkel met een stenen ridder (vereenvoudigd) ---------- */
export function standbeeld(){
  const g=new THREE.Group();
  g.add(blok(2,1.3,2,'steen',.9));const s2=blok(1.4,.4,1.4,'steen',.95);s2.position.y=1.3;g.add(s2);
  const lijf=blok(.8,1.6,.55,'steen',.82);lijf.position.y=1.7;g.add(lijf);
  const hoofd=omlijn(new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),mat('steen',2,1,.85)),50);hoofd.position.y=3.6;g.add(hoofd);
  const zwaard=blok(.14,2,.14,'steen',.75);zwaard.position.set(.55,2.3,.2);g.add(zwaard);
  const schild=blok(.5,.9,.12,'steen',.8);schild.position.set(-.55,2.2,.2);g.add(schild);
  g.userData.kaart='standbeeld';return g;
}
/* ---------- kerk: een hoog schip met een vierkante toren en een spits ---------- */
export function kerk(){
  const g=huis({w:8,d:11,h:4.2,dakH:3.2,muur:'steen',ramen:3,schoorsteen:false});
  const toren=blok(3.2,10,3.2,'steen',.96);toren.position.set(-8/2+1.6,0,-11/2+1.6);g.add(toren);
  const spits=omlijn(new THREE.Mesh(new THREE.ConeGeometry(2.3,3.2,4),mat('dak',8,3.2,.95)),30);spits.rotation.y=Math.PI/4;spits.position.set(-8/2+1.6,11.6,-11/2+1.6);g.add(spits);
  for(const y of[5,7.5]){const r=doos(.6,1.1,.1,mat('glas',.6,1.1));r.position.set(-8/2+1.6,y,-11/2+1.6+1.62);g.add(r)}
  const kruis=new THREE.Group();kruis.add(blok(.12,1,.12,'steen',.8));const dwars=blok(.6,.12,.12,'steen',.8);dwars.position.y=.7;kruis.add(dwars);kruis.position.set(-8/2+1.6,13.2,-11/2+1.6);g.add(kruis);
  g.userData.kaart='kerk';return g;
}
/* ---------- tent voor het bandietenkamp: twee schuine lappen op een nokbalk ---------- */
export function tent(w=3,d=3.2,stof='stof_groen'){
  const g=new THREE.Group();const dakH=1.7,span=w/2,L=Math.hypot(span,dakH),a=Math.atan2(dakH,span);
  for(const[teken,tint]of[[1,1],[-1,.85]]){const p=helling(d,L,stof,tint);p.rotation.order='YXZ';p.rotation.y=Math.PI/2;p.rotation.x=-Math.PI/2+teken*a;p.position.set(teken*span/2,dakH/2,0);g.add(p)}
  const nok=doos(.12,.12,d+.3,mat('hout_donker',.2,d));nok.position.y=dakH;g.add(nok);
  for(const t of[-1,1]){const paal=doos(.14,dakH,.14,mat('hout_donker',.14,dakH));paal.position.z=t*(d/2);g.add(paal)}
  g.userData.kaart='tent';return g;
}
/* ---------- straat: keien op de grond, zoals pad() maar met de stadskeien ---------- */
export function straat(breedte,lengte,{x=0,z=0,rot=0}={}){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(breedte,lengte),grondMat('keien2',breedte,lengte));m.userData.kaart={soort:'straat',w:breedte,l:lengte};
  m.rotation.order='YXZ';m.rotation.y=rot;m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);return m;
}
/* ---------- vierkant stadsplein ---------- */
export function pleinVierkant(w,d,naam='keien2'){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),grondMat(naam,w,d));m.userData.kaart={soort:'straat',w,l:d};
  m.rotation.x=-Math.PI/2;m.position.y=.02;return m;
}
