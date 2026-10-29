/* Runeveld – dag en nacht. De klok loopt op de echte tijd (één speldag = 24 minuten), dus iedereen ziet
   hetzelfde licht zonder dat er iets over het net hoeft. 's Nachts ligt er een blauw waas over het beeld
   (een canvas dat met de scène vermenigvuldigt) met warme gaten op de lantaarns en het altaar, en krijgen
   de lampen een gloed in de scène. Zon, hemellicht en lucht draaien mee. */
import * as THREE from 'three';

export const DAGMINUTEN=24;                      /* echte minuten per speldag */
let override=null;                               /* admin: vaste tijd in uren, of null */
export function zetTijd(uren){override=uren}
/* tijd van de dag in uren, 0..24 */
export function tijd(){if(override!==null)return override;return(Date.now()/1000/60%DAGMINUTEN)/DAGMINUTEN*24}
export function klokTekst(){const u=tijd(),h=Math.floor(u),m=Math.floor((u-h)*60);return`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`}
const glad=t=>t*t*(3-2*t);
/* daglicht 0 (nacht) .. 1 (dag): nacht 21–5, dag 7–19, dageraad en schemering ertussen */
export function daglicht(u=tijd()){
  if(u>=7&&u<=19)return 1;if(u>=21||u<=5)return 0;
  if(u<7)return glad((u-5)/2);return 1-glad((u-19)/2);
}
export const isNacht=()=>daglicht()<.5;
const NACHT=[62,78,138],DAG=[255,255,255],SCHEMER=[255,206,150];
/* de kleur van het waas: nacht → (via een warme schemering) → dag */
export function waasKleur(d=daglicht()){
  const w=4*d*(1-d);                                        /* warm rond de overgang */
  return[0,1,2].map(i=>Math.round(NACHT[i]*(1-d)+DAG[i]*d+(SCHEMER[i]-DAG[i])*w*.55));
}

/* lichtbronnen: {x,z,r (eenheden), kleur:[r,g,b], sterkte 0..1, y (hoogte van de gloed)} */
export function maakDaglicht({scene,camera,renderer,zon,hemi,lichten}){
  const cv=document.getElementById('nacht'),ctx=cv.getContext('2d');
  const _v=new THREE.Vector3();
  /* gloed in de scène: zachte ronde sprite, additief */
  const gc=document.createElement('canvas');gc.width=gc.height=64;const gg=gc.getContext('2d');
  const gr=gg.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.45)');gr.addColorStop(1,'rgba(255,255,255,0)');
  gg.fillStyle=gr;gg.fillRect(0,0,64,64);
  const gloedTex=new THREE.CanvasTexture(gc);
  const gloeden=lichten.map(l=>{
    const m=new THREE.Mesh(new THREE.PlaneGeometry(l.r*1.1,l.r*1.1),new THREE.MeshBasicMaterial({map:gloedTex,color:new THREE.Color(l.kleur[0]/255,l.kleur[1]/255,l.kleur[2]/255),transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.position.set(l.x,l.y??1.1,l.z);m.renderOrder=3;scene.add(m);return{m,l};
  });
  const zonKleurDag=new THREE.Color(0xfff1d6),zonKleurNacht=new THREE.Color(0x6a7ab8),hemiDag=new THREE.Color(0xdff3ff),hemiNacht=new THREE.Color(0x3a4878),luchtDag=new THREE.Color(0x87c9ee),luchtNacht=new THREE.Color(0x0e1630);
  let laatst=-1;
  function update(cam,extra=[]){
    const d=daglicht(),nacht=1-d;
    /* zon, hemellicht en lucht */
    zon.intensity=.5+2.1*d;zon.color.copy(zonKleurNacht).lerp(zonKleurDag,d);
    hemi.intensity=.8+1.4*d;hemi.color.copy(hemiNacht).lerp(hemiDag,d);
    scene.background.copy(luchtNacht).lerp(luchtDag,d);
    for(const g of gloeden){g.m.material.opacity=nacht*(g.l.sterkte??.8)*.4;g.m.rotation.y=cam.yaw;g.m.rotation.x=-cam.tilt;g.m.visible=nacht>.02}
    /* het waas */
    if(nacht<.01){if(laatst!==0){cv.style.display='none';laatst=0}return}
    cv.style.display='block';laatst=nacht;
    const w=innerWidth,h=innerHeight;if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    const[r,g,b]=waasKleur(d);ctx.globalCompositeOperation='source-over';ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(0,0,w,h);
    /* warme gaten op de lichtbronnen: lichter maken waar lampen staan */
    ctx.globalCompositeOperation='lighter';
    const pxPerUnit=cam.px/renderer.getPixelRatio();          /* CSS-pixels per eenheid */
    for(const l of lichten.concat(extra)){
      _v.set(l.x,l.y??.8,l.z).project(camera);if(_v.z>1||Math.abs(_v.x)>1.5||Math.abs(_v.y)>1.5)continue;
      const sx=(_v.x+1)/2*w,sy=(1-_v.y)/2*h,R=l.r*pxPerUnit*1.15;
      const k=l.kleur,st=(l.sterkte??.8)*nacht;
      const rg=ctx.createRadialGradient(sx,sy,0,sx,sy,R);
      rg.addColorStop(0,`rgba(${k[0]},${k[1]},${k[2]},${(.85*st).toFixed(3)})`);rg.addColorStop(.4,`rgba(${k[0]},${k[1]},${k[2]},${(.45*st).toFixed(3)})`);rg.addColorStop(1,`rgba(${k[0]},${k[1]},${k[2]},0)`);
      ctx.fillStyle=rg;ctx.fillRect(sx-R,sy-R,R*2,R*2);
    }
  }
  return{update};
}
