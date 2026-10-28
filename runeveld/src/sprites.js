/* Runeveld – 2D sprites in een 3D-wereld (zoals Ragnarok Online).
   Een sprite is een plat vlak dat altijd naar de camera kijkt; de tekening komt uit een
   spritesheet met per animatie een rij (of vier rijen: één per kijkrichting). */
import * as THREE from 'three';

const cache=new Map();
/* Laadt een afbeelding als pixel-art textuur. Bestaat het bestand niet, dan tekent `fallback()` een canvas. */
export function laadTextuur(url,fallback){
  if(cache.has(url))return cache.get(url);
  const p=new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(maakTex(img));
    img.onerror=()=>res(fallback?maakTex(fallback()):null);
    img.src=url;
  });
  cache.set(url,p);return p;
}
export function maakTex(bron){
  const t=new THREE.Texture(bron);
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
}

const schaduwGeo=new THREE.CircleGeometry(.5,20);
const schaduwMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false});

/* Hoe ver sprites achterover leunen naar de camera (1 = exact naar de camera gericht). */
export const LEUN=1;

export class Sprite2D{
  /* blad: {tex, fw, fh, schaal, richtingen:{onder,links,rechts,boven}, anims:{naam:{rij,n,fps,eens,perRichting,tex}}}
     schaduw: diameter van de schaduw in wereld-eenheden (0 = geen) */
  constructor(blad,{schaduw=.9}={}){
    this.mat=new THREE.MeshBasicMaterial({transparent:true,alphaTest:.5,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.mat);this.mesh.frustumCulled=false;
    this.g=new THREE.Group();this.g.add(this.mesh);
    this.anim=null;this.naam='';this.t=0;this.frame=0;this.richt='onder';this.klaar=false;this.kijk=new THREE.Vector2(0,1);this.flits=0;
    this.zetBlad(blad);
    if(schaduw>0){const s=new THREE.Mesh(schaduwGeo,schaduwMat);s.rotation.x=-Math.PI/2;s.position.y=.02;s.scale.setScalar(schaduw);this.g.add(s);this.schaduw=s}
  }
  /* (ander) blad gebruiken; de hoogte van het figuur en de voetpositie komen uit het blad */
  zetBlad(blad){
    this.blad=blad;this.bron=null;this.tex=null;this.cols=1;this.rows=1;this.anim=null;this.naam='';
    const w=blad.fw*blad.schaal,h=blad.fh*blad.schaal,voet=(blad.voet||0)*blad.schaal;
    this.w=w;this.h=(blad.hoogte||blad.fh)*blad.schaal;
    this.mesh.geometry.dispose();const geo=new THREE.PlaneGeometry(w,h);geo.translate(0,h/2-voet,0);this.mesh.geometry=geo;
    this.speel('idle',true);
  }
  _zetBron(src){
    if(src===this.bron)return;this.bron=src;
    this.tex=src.clone();this.tex.needsUpdate=true;
    this.cols=Math.max(1,Math.round(src.image.width/this.blad.fw));this.rows=Math.max(1,Math.round(src.image.height/this.blad.fh));
    this.mat.map=this.tex;this.mat.needsUpdate=true;
  }
  heeft(naam){return !!this.blad.anims[naam]}
  speel(naam,herstart=false){
    const a=this.blad.anims[naam]||this.blad.anims.idle;if(!a)return;
    if(this.anim===a&&!herstart)return;
    this.anim=a;this.naam=naam;this.t=0;this.frame=0;this.klaar=false;
    this._zetBron(a.tex||this.blad.tex);this._uv();
  }
  duur(naam){const a=this.blad.anims[naam];return a?a.n/a.fps:0}
  zetKijk(dx,dz){if(Math.abs(dx)+Math.abs(dz)<1e-4)return;this.kijk.set(dx,dz).normalize()}
  /* korte witte/rode flits bij schade */
  raak(kleur=0xff6060){this.flits=.12;this.mat.color.set(kleur)}
  update(dt,cam){
    const a=this.anim;
    if(a){this.t+=dt;let f=Math.floor(this.t*a.fps);
      if(a.eens){if(f>=a.n){f=a.n-1;this.klaar=true}}else f%=a.n;
      if(f!==this.frame){this.frame=f;this._uv()}}
    if(this.flits>0){this.flits-=dt;if(this.flits<=0)this.mat.color.set(0xffffff)}
    /* kijkrichting omzetten naar onder/links/rechts/boven, gezien vanuit de camera */
    const fx=this.kijk.x,fz=this.kijk.y,sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw);
    const weg=-(fx*sy+fz*cy);      /* > 0: van de camera af (we zien de rug) */
    const rechts=fx*cy-fz*sy;
    const r=Math.abs(weg)>=Math.abs(rechts)?(weg>0?'boven':'onder'):(rechts>0?'rechts':'links');
    if(r!==this.richt){this.richt=r;this._uv()}
    this.g.rotation.y=cam.yaw;this.mesh.rotation.x=-cam.tilt*LEUN;
  }
  _uv(){
    const a=this.anim;if(!a||!this.tex)return;
    const d=this.blad.richtingen||{onder:0};
    let ri=d[this.richt],spiegel=false;
    if(ri===undefined){ /* geen eigen rij voor deze richting: gebruik de tegenovergestelde kant gespiegeld */
      const alt=this.richt==='links'?'rechts':this.richt==='rechts'?'links':'onder';
      ri=d[alt]??d.onder??0;spiegel=(this.richt==='links'||this.richt==='rechts')&&d[alt]!==undefined;
    }
    const rij=(a.rij||0)+(a.perRichting===false?0:ri),kol=(a.kol||0)+this.frame;
    const cw=1/this.cols,ch=1/this.rows;
    this.tex.repeat.set(spiegel?-cw:cw,ch);
    this.tex.offset.set(spiegel?(kol+1)*cw:kol*cw,1-(rij+1)*ch);
  }
  verwijder(){this.g.removeFromParent();this.mat.dispose();if(this.tex)this.tex.dispose()}
}

/* Een stilstaand plaatje (huis, boom, hek) dat ook naar de camera gekeerd staat. */
export class Bord{
  constructor(tex,w,h,{schaduw=0,leun=LEUN}={}){
    const geo=new THREE.PlaneGeometry(w,h);geo.translate(0,h/2,0);
    this.mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.5,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(geo,this.mat);this.leun=leun;
    this.g=new THREE.Group();this.g.add(this.mesh);
    if(schaduw>0){const s=new THREE.Mesh(schaduwGeo,schaduwMat);s.rotation.x=-Math.PI/2;s.position.y=.02;s.scale.set(schaduw,schaduw*.7,1);this.g.add(s)}
  }
  update(cam){this.g.rotation.y=cam.yaw;this.mesh.rotation.x=-cam.tilt*this.leun}
}
