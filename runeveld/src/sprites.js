/* Runeveld – 2D sprites in een 3D-wereld (zoals Ragnarok Online).
   Een sprite is een plat vlak dat altijd naar de camera kijkt; de tekening komt uit een
   spritesheet met per animatie vier rijen (één per kijkrichting). Een sprite kan uit meerdere
   lagen bestaan die dezelfde indeling delen (lijf, kleding, hoofd, wapen): zo wordt uitrusting zichtbaar. */
import * as THREE from 'three';

/* Gladde graphics: de sprites uit sprites/glad/ zijn 2× opgeschaald met Scale2x (tools/maak_sprites.py)
   en worden met zachte filtering getekend. Uit te zetten in het admin-paneel. */
export const GLAD=(()=>{try{return localStorage.getItem('runeveld.glad')==='1'}catch(e){return false}})();
/* Pixelgrootte: hoeveel schermpixels (CSS) één gerenderde pixel beslaat. 2 laat de sprites ongeveer 1:1 in het
   pixelraster vallen; 1 is volle resolutie. Instelbaar in het admin-paneel. */
/* In de gladde modus rendert alles op volle resolutie: de 2×-sprites staan dan 1:1 bij een pixelschaal van 32. */
export const PIXEL=GLAD?1:(()=>{try{const v=parseFloat(localStorage.getItem('runeveld.pixel'));if(v>0)return v}catch(e){}return innerWidth<700?1:2})();
export const FACTOR=GLAD?2:1;             /* hoeveel keer groter de geladen sprites zijn dan de pixel-art */

const cache=new Map();
/* Laadt een afbeelding als textuur (null als het bestand ontbreekt). In de gladde modus komt hij uit sprites/glad/,
   tenzij `ruw` (voor de grondtegels, die zelf in een canvas worden samengesteld). */
export function laadTextuur(url,{ruw=false}={}){
  const glad=GLAD&&!ruw&&url.startsWith('sprites/');
  const bron=glad?url.replace('sprites/','sprites/glad/'):url;
  if(cache.has(bron))return cache.get(bron);
  const p=new Promise(res=>{const img=new Image();img.onload=()=>res(maakTex(img,glad));img.onerror=()=>res(glad?laadTextuur(url,{ruw:true}):null);img.src=bron});
  cache.set(bron,p);return p;
}
export function maakTex(bron,zacht=GLAD){
  const t=new THREE.Texture(bron);
  if(zacht){t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4}
  else{t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false}   /* geen mipmaps: niets wisselt van niveau */
  t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}

/* blobschaduw onder figuren en planten: een platte ellips net boven plein en pad (y .06), zodat hij nooit z-fight met de grond */
const schaduwGeo=new THREE.CircleGeometry(.5,16);
const schaduwMat=new THREE.MeshBasicMaterial({color:0x1a1540,transparent:true,opacity:.32,depthWrite:false});
const SCHADUW_Y=.06;
const klikMat=new THREE.MeshBasicMaterial({visible:false});

/* Hoe ver sprites achterover leunen naar de camera (1 = exact naar de camera gericht). */
export const LEUN=1;

export class Sprite2D{
  /* blad: {tex, fw, fh, schaal, voet, hoogte, richtingen:{onder,links,rechts,boven}, anims:{naam:{rij,n,fps,eens,perRichting}}}
     lagen: texturen in tekenvolgorde (achterste eerst); zonder lagen wordt blad.tex gebruikt
     schaduw: diameter van de schaduw in wereld-eenheden (0 = geen) */
  constructor(blad,{schaduw=.9,lagen=null}={}){
    this.g=new THREE.Group();this.lagen=[];
    /* onzichtbaar vlak om op te klikken (raycast) */
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),klikMat);this.mesh.frustumCulled=false;this.g.add(this.mesh);
    this.anim=null;this.naam='';this.t=0;this.frame=0;this.richt='onder';this.klaar=false;this.kijk=new THREE.Vector2(0,1);this.flits=0;this.cols=1;this.rows=1;
    this.zetBlad(blad,lagen);
    if(schaduw>0){const s=new THREE.Mesh(schaduwGeo,schaduwMat);s.rotation.x=-Math.PI/2;s.position.y=SCHADUW_Y;s.scale.set(schaduw,schaduw*.62,1);s.renderOrder=2;this.g.add(s);this.schaduw=s}
  }
  /* (ander) blad gebruiken; hoogte van het figuur en voetpositie komen uit het blad */
  zetBlad(blad,lagen=null){
    this.blad=blad;this.anim=null;this.naam='';
    const w=blad.fw*blad.schaal,h=blad.fh*blad.schaal,voet=(blad.voet||0)*blad.schaal;
    this.w=w;this.h=(blad.hoogte||blad.fh)*blad.schaal;
    if(this.geo)this.geo.dispose();this.geo=new THREE.PlaneGeometry(w,h);this.geo.translate(0,h/2-voet,0);
    this.mesh.geometry=this.geo;for(const L of this.lagen)L.mesh.geometry=this.geo;
    this.zetLagen(lagen||[blad.tex]);
    this.speel('idle',true);
  }
  /* de lagen (texturen) vervangen, in tekenvolgorde */
  zetLagen(bronnen){
    bronnen=bronnen.filter(Boolean);
    while(this.lagen.length>bronnen.length){const L=this.lagen.pop();L.mesh.removeFromParent();L.mesh.material.dispose();L.tex.dispose()}
    bronnen.forEach((bron,i)=>{
      let L=this.lagen[i];
      if(!L){const mat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.5,side:THREE.DoubleSide});
        const mesh=new THREE.Mesh(this.geo,mat);mesh.frustumCulled=false;mesh.position.z=.004*(i+1);this.g.add(mesh);
        L={mesh,bron:null,tex:null};this.lagen.push(L)}
      if(L.bron!==bron){if(L.tex)L.tex.dispose();L.bron=bron;L.tex=bron.clone();L.tex.needsUpdate=true;L.mesh.material.map=L.tex;L.mesh.material.needsUpdate=true}
    });
    const b=bronnen[0];
    this.cols=Math.max(1,Math.round(b.image.width/this.blad.fw));this.rows=Math.max(1,Math.round(b.image.height/this.blad.fh));
    this._uv();
  }
  heeft(naam){return !!this.blad.anims[naam]}
  speel(naam,herstart=false){
    const a=this.blad.anims[naam]||this.blad.anims.idle;if(!a)return;
    if(this.anim===a&&!herstart)return;
    this.anim=a;this.naam=naam;this.t=0;this.frame=0;this.klaar=false;this._uv();
  }
  duur(naam){const a=this.blad.anims[naam];return a?a.n/a.fps:0}
  zetKijk(dx,dz){if(Math.abs(dx)+Math.abs(dz)<1e-4)return;this.kijk.set(dx,dz).normalize()}
  /* korte rode flits bij schade */
  raak(kleur=0xff6060){this.flits=.12;for(const L of this.lagen)L.mesh.material.color.set(kleur)}
  update(dt,cam){
    const a=this.anim;
    if(a){this.t+=dt;let f=Math.floor(this.t*a.fps);
      if(a.eens){if(f>=a.n){f=a.n-1;this.klaar=true}}else f%=a.n;
      if(f!==this.frame){this.frame=f;this._uv()}}
    if(this.flits>0){this.flits-=dt;if(this.flits<=0)for(const L of this.lagen)L.mesh.material.color.set(0xffffff)}
    /* kijkrichting omzetten naar onder/links/rechts/boven, gezien vanuit de camera */
    const fx=this.kijk.x,fz=this.kijk.y,sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);
    const weg=-(fx*sy+fz*cy);      /* > 0: van de camera af (we zien de rug) */
    const rechts=fx*cy-fz*sy;
    const r=Math.abs(weg)>=Math.abs(rechts)?(weg>0?'boven':'onder'):(rechts>0?'rechts':'links');
    if(r!==this.richt){this.richt=r;this._uv()}
    this.g.rotation.y=cam.yaw;const rx=-cam.tilt*LEUN;this.mesh.rotation.x=rx;for(const L of this.lagen)L.mesh.rotation.x=rx;
    klik(this,cam);
  }
  _uv(){
    const a=this.anim;if(!a||!this.lagen.length)return;
    const d=this.blad.richtingen||{onder:0};
    let ri=d[this.richt],spiegel=false;
    if(ri===undefined){ /* geen eigen rij voor deze richting: gebruik de tegenovergestelde kant gespiegeld */
      const alt=this.richt==='links'?'rechts':this.richt==='rechts'?'links':'onder';
      ri=d[alt]??d.onder??0;spiegel=(this.richt==='links'||this.richt==='rechts')&&d[alt]!==undefined;
    }
    const rij=(a.rij||0)+(a.perRichting===false?0:ri),kol=(a.kol||0)+this.frame;
    const cw=1/this.cols,ch=1/this.rows;
    for(const L of this.lagen){L.tex.repeat.set(spiegel?-cw:cw,ch);L.tex.offset.set(spiegel?(kol+1)*cw:kol*cw,1-(rij+1)*ch)}
  }
  verwijder(){this.g.removeFromParent();for(const L of this.lagen){L.mesh.material.dispose();L.tex.dispose()}this.lagen=[];this.geo.dispose()}
}

/* Een stilstaand plaatje (huis, boom, hek) dat ook naar de camera gekeerd staat. */
export class Bord{
  constructor(tex,w,h,{schaduw=0,leun=LEUN}={}){
    const geo=new THREE.PlaneGeometry(w,h);geo.translate(0,h/2,0);
    this.mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.5,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(geo,this.mat);this.leun=leun;
    this.g=new THREE.Group();this.g.add(this.mesh);
    if(schaduw>0){const s=new THREE.Mesh(schaduwGeo,schaduwMat);s.rotation.x=-Math.PI/2;s.position.y=SCHADUW_Y;s.scale.set(schaduw,schaduw*.62,1);s.renderOrder=2;this.g.add(s)}
  }
  update(cam){this.g.rotation.y=cam.yaw;this.mesh.rotation.x=-cam.tilt*this.leun;klik(this,cam)}
}

/* Zet de groep van een sprite op het pixelraster van de camera. De logische positie (zoals het spel die zet) wordt
   onthouden, zodat het vastklikken niet optelt; verandert het spel de positie, dan wordt die opnieuw als logisch gezien. */
function klik(s,cam){
  if(!cam.r||!cam.px)return;
  if(!s._log){s._log=new THREE.Vector3();s._snap=new THREE.Vector3(NaN,NaN,NaN)}
  if(!s.g.position.equals(s._snap))s._log.copy(s.g.position);
  const v=s.g.position.copy(s._log),px=cam.px,er=v.dot(cam.r),eu=v.dot(cam.u);
  v.addScaledVector(cam.r,Math.round(er*px)/px-er).addScaledVector(cam.u,Math.round(eu*px)/px-eu);s._snap.copy(v);
}
