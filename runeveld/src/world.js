/* Runeveld – renderer, camera, grond, decor en botsingen.
   Maat: 1 wereld-eenheid = 16 pixels pixel-art (PPU). Een grondtegel van 32 px is dus 2 eenheden. */
import * as THREE from 'three';
import {laadTextuur,maakTex,Bord} from './sprites.js';

export const VELD=22;                     /* het speelveld loopt van -VELD tot VELD */
export const PPU=16;
export const PLEIN=8;                     /* straal van het keienplein */
export const canvas=document.getElementById('c');
export const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;

export const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87c9ee);
scene.fog=new THREE.Fog(0x87c9ee,55,95);

export const camera=new THREE.PerspectiveCamera(34,1,.5,220);
/* RO-achtige camera: schuin van boven, draaibaar met Q/E, zoombaar met het scrollwiel */
export const cam={yaw:0,tilt:THREE.MathUtils.degToRad(50),afstand:19,doel:new THREE.Vector3(0,0,0)};
export function updateCamera(){
  const {yaw,tilt,afstand,doel}=cam;
  const h=afstand*Math.sin(tilt),r=afstand*Math.cos(tilt);
  camera.position.set(doel.x+Math.sin(yaw)*r,doel.y+h,doel.z+Math.cos(yaw)*r);
  camera.lookAt(doel.x,doel.y+.8,doel.z);
}
export function pasAan(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;
  /* in portret (telefoon) een wijdere lens, anders zie je bijna niets naast de speler */
  camera.fov=camera.aspect<1?Math.min(62,34/camera.aspect):34;camera.updateProjectionMatrix();
}
addEventListener('resize',pasAan);pasAan();

/* ---------- botsingen ---------- */
export const obstakels=[];                /* {x,z,r} */
export function botsing(x,z,r=.35){
  const lim=VELD-1.2;
  x=Math.max(-lim,Math.min(lim,x));z=Math.max(-lim,Math.min(lim,z));
  for(const o of obstakels){const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz),min=o.r+r;
    if(d<min){if(d<1e-4){x+=min}else{x=o.x+dx/d*min;z=o.z+dz/d*min}}}
  return[x,z];
}
export function vrij(x,z,r=.5){if(Math.abs(x)>VELD-1.5||Math.abs(z)>VELD-1.5)return false;for(const o of obstakels)if(Math.hypot(x-o.x,z-o.z)<o.r+r)return false;return true}

/* ---------- muis → grondpunt ---------- */
const ray=new THREE.Raycaster(),grondVlak=new THREE.Plane(new THREE.Vector3(0,1,0),0),_v=new THREE.Vector2(),_p=new THREE.Vector3();
export function straal(cx,cy){_v.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(_v,camera);return ray}
export function grondPunt(cx,cy){straal(cx,cy);return ray.ray.intersectPlane(grondVlak,_p)?_p.clone():null}

/* ---------- grond: tegelkaart ---------- */
const TILE=32,CPU=1.5;                    /* eenheden per grondtegel */
const N=Math.round(VELD*2/CPU);           /* tegels per zijde */
export function celType(x,z){ /* wereldcoördinaten → 'g' gras, 'c' keien, 'p' pad */
  if(Math.hypot(x,z)<PLEIN)return 'c';
  if(Math.abs(x)<1.6)return 'p';
  return 'g';
}
function toeval(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function bouwGrond(atlas,decor){
  const R=toeval(12345);
  const c=document.createElement('canvas');c.width=N*TILE;c.height=N*TILE;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const w2p=v=>(v+VELD)/CPU*TILE;          /* wereld → canvaspixels */
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=(i+.5)*CPU-VELD,z=(j+.5)*CPU-VELD,t=celType(x,z);
    const idx=t==='c'?3+(R()<.5?0:1):t==='p'?5+(R()<.5?0:1):(R()<.12?2:R()<.3?1:0);
    g.drawImage(atlas,idx*TILE,0,TILE,TILE,i*TILE,j*TILE,TILE,TILE);
  }
  /* graspollen, bloemen en steentjes verspreid over het gras */
  for(let k=0;k<70;k++){const x=R()*2*VELD-VELD,z=R()*2*VELD-VELD;if(celType(x,z)!=='g')continue;
    const img=[decor.graspol,decor.graspol,decor.bloemen,decor.bloemen2,decor.rots2][Math.floor(R()*5)];
    g.drawImage(img,Math.round(w2p(x)-img.width/2),Math.round(w2p(z)-img.height/2))}
  /* zachte rand om het plein */
  g.strokeStyle='rgba(70,50,30,.35)';g.lineWidth=4;g.beginPath();g.arc(w2p(0),w2p(0),PLEIN/CPU*TILE,0,7);g.stroke();
  const tex=maakTex(c);tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=4;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(VELD*2,VELD*2),new THREE.MeshBasicMaterial({map:tex}));
  mesh.rotation.x=-Math.PI/2;scene.add(mesh);
  /* wijde omgeving buiten het hek */
  const buiten=new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshBasicMaterial({color:0x6e9a3a}));
  buiten.rotation.x=-Math.PI/2;buiten.position.y=-.01;scene.add(buiten);
}

/* ---------- decor ---------- */
export const borden=[];
/* dorpsobjecten (32px-kit) op .65, bomen en rotsen (16px-kit) op 1.3: dan kloppen ze met de held van 24 px */
async function prop(naam,x,z,{r=0,schaduw=0,schaal=.65}={}){
  const tex=await laadTextuur('sprites/'+naam+'.png');if(!tex)throw new Error('Sprite ontbreekt: '+naam);
  const w=tex.image.width/PPU*schaal,h=tex.image.height/PPU*schaal;
  const b=new Bord(tex,w,h,{schaduw});b.g.position.set(x,0,z);scene.add(b.g);borden.push(b);
  if(r>0)obstakels.push({x,z,r});
  return b;
}

export async function bouwWereld(){
  const[atlas,graspol,bloemen,bloemen2,rots2]=await Promise.all(['grond','graspol','bloemen','bloemen2','rots2'].map(n=>laadTextuur('sprites/'+n+'.png')));
  if(!atlas||!graspol||!bloemen||!bloemen2||!rots2)throw new Error('Grondsprites ontbreken');
  bouwGrond(atlas.image,{graspol:graspol.image,bloemen:bloemen.image,bloemen2:bloemen2.image,rots2:rots2.image});
  const P=[];
  /* het plein */
  P.push(prop('put',0,0,{r:1.1,schaduw:2.2}));
  P.push(prop('kraam',-7.5,-6,{r:1.5,schaduw:3.2}),prop('kraam2',8,-6.5,{r:1.5,schaduw:3}));
  P.push(prop('ton',-5.2,-8.2,{r:.5,schaduw:1}),prop('ton',-4.2,-8.4,{r:.5,schaduw:1}),prop('kist',-10.3,-7.6,{r:.5,schaduw:1}),prop('hout',10.8,-8,{r:.6,schaduw:1.2}));
  for(const[x,z]of[[-6.5,6.5],[6.5,6.5],[6.5,-6.5],[-6.5,-6.5]])P.push(prop('lantaarn',x*1.25,z*1.25,{r:.25}));
  P.push(prop('bord',2.2,8.6,{r:.4}));
  /* huizen rond het plein */
  P.push(prop('huis_a',-14,-14,{r:2.4,schaduw:5}),prop('huis_b',14,-13.5,{r:3,schaduw:6.5}),prop('huis_c',15.5,11,{r:3,schaduw:6.5}),prop('huis_d',-15,12,{r:3,schaduw:6.5}));
  P.push(prop('kar',-8.5,-13.5,{r:1.2,schaduw:2.6}),prop('aambeeld',9.5,-9.6,{r:.5,schaduw:1}));
  /* bomen en struiken langs de rand */
  const bomen=[['boom',-18,-19],['den',-19.5,-9],['boom2',-18.5,3],['den',-19.5,17],['boom',18.5,-6],['den2',19.5,2],['boom2',-8,19],['den',4,19],['boom',-13,19.5],['boom2',19.5,18.5],['den2',-3,-19.5],['boom',6,-19.5],['boom2',18.5,-19.5],['den',10,19]];
  for(const[n,x,z]of bomen)P.push(prop(n,x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  const struiken=[[-15.5,-2],[16.5,-10],[-6,13],[9.5,13.5],[12,5],[-11,-10],[5,-13],[-16.5,7],[14,-2],[-2,15.5],[2,-12]];
  for(const[x,z]of struiken)P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}));
  for(const[x,z]of[[-12,4],[11,-16],[-4,-15],[16,16],[-17,-6]])P.push(prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}));
  /* palissade rondom het veld */
  for(let i=-VELD+1.3;i<VELD;i+=2.6){P.push(prop('hek',i,-VELD+.6,{}),prop('hek',i,VELD-.6,{}),prop('hek',-VELD+.6,i,{}),prop('hek',VELD-.6,i,{}))}
  await Promise.all(P);
}
export function updateBorden(){for(const b of borden)b.update(cam)}
