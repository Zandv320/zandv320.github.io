/* Runeveld – renderer, camera, grond, decor en botsingen.
   Maat: 1 wereld-eenheid = 16 pixels pixel-art (PPU). Een grondtegel van 32 px is 1,5 eenheid.
   De wereld is een vierkant van -VELD..VELD; in het midden ligt het dorp (-DORP..DORP) achter een palissade
   met een poort in het noorden en het zuiden. Daarbuiten liggen velden en bos waar de monsters leven. */
import * as THREE from 'three';
import {laadTextuur,maakTex,Bord,FACTOR,GLAD,PIXEL} from './sprites.js';
import * as B from './bouw.js';

export const VELD=60;                     /* halve breedte van de wereld */
export const DORP=22;                     /* halve breedte van het dorp */
export const PLEIN=8;                     /* straal van het keienplein */
export const POORT=2.8;                   /* halve breedte van de poorten (op het pad) */
export const PPU=16;
export const canvas=document.getElementById('c');
export const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
/* pixel-look: de scene wordt op lage resolutie gerenderd en zonder vervaging opgeschaald (canvas: image-rendering) */
renderer.setPixelRatio(PIXEL>1?1/PIXEL:Math.min(devicePixelRatio,2));canvas.style.imageRendering=PIXEL>1?'pixelated':'auto';
renderer.outputColorSpace=THREE.SRGBColorSpace;
/* harde, pixelige slagschaduwen van de 3D-omgeving (BasicShadowMap: geen verzachting) */
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.BasicShadowMap;

export const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87c9ee);
/* geen mist: de orthografische camera staat op vaste afstand en de wereld eindigt in een bomenrij */
/* licht voor de 3D-modellen; sprites zijn onbelicht en merken hier niets van */
scene.add(new THREE.HemisphereLight(0xdff3ff,0x6a8a46,2.2));
const zon=new THREE.DirectionalLight(0xfff1d6,2.6);zon.position.set(20,40,15);scene.add(zon);scene.add(zon.target);
zon.castShadow=true;zon.shadow.mapSize.set(2048,2048);zon.shadow.bias=-.0005;
Object.assign(zon.shadow.camera,{left:-30,right:30,top:30,bottom:-30,near:1,far:120});

/* Pixelcamera: orthografisch, schuin van boven (zoals RO), met een vaste pixelschaal: cam.px gerenderde pixels per
   wereld-eenheid. Op 16 valt elke sprite-pixel precies op één gerenderde pixel. De camera klikt op het pixelraster vast
   (cam.r en cam.u zijn de schermassen), zodat niets verspringt zolang er niets beweegt. */
export const camera=new THREE.OrthographicCamera(-1,1,1,-1,1,200);
/* zoomstappen in gerenderde pixels per eenheid. Standaard 32 CSS-pixels per eenheid: in de pixelmodus is dat 16 gerenderde
   pixels (halve resolutie), in de gladde modus 32 × de pixelverhouding van het scherm, zodat de 2×-sprites 1:1 staan. */
const PR=GLAD?renderer.getPixelRatio():1;
export const ZOOMS=(GLAD?[16,24,32,48,64]:[8,12,16,24,32]).map(v=>v*PR);
export const cam={yaw:0,tilt:THREE.MathUtils.degToRad(50),px:(GLAD?32:16)*PR,doel:new THREE.Vector3(0,0,0),r:new THREE.Vector3(1,0,0),u:new THREE.Vector3(0,1,0),afstand:60};
const _e=new THREE.Vector3();
export function updateCamera(){
  const {yaw,tilt,afstand,doel,px}=cam;
  const h=afstand*Math.sin(tilt),r=afstand*Math.cos(tilt);
  camera.position.set(doel.x+Math.sin(yaw)*r,doel.y+h,doel.z+Math.cos(yaw)*r);
  camera.lookAt(doel.x,doel.y,doel.z);camera.updateMatrixWorld();
  cam.r.setFromMatrixColumn(camera.matrixWorld,0);cam.u.setFromMatrixColumn(camera.matrixWorld,1);
  /* vastklikken op hele gerenderde pixels langs de schermassen */
  _e.copy(camera.position);
  const er=_e.dot(cam.r),eu=_e.dot(cam.u);
  camera.position.addScaledVector(cam.r,Math.round(er*px)/px-er).addScaledVector(cam.u,Math.round(eu*px)/px-eu);
  camera.updateMatrixWorld();
}
/* zet een wereldpositie op het pixelraster van de huidige camera (voor sprites, zodat hun pixels niet verschuiven) */
export function snap(v){const er=v.dot(cam.r),eu=v.dot(cam.u),px=cam.px;return v.addScaledVector(cam.r,Math.round(er*px)/px-er).addScaledVector(cam.u,Math.round(eu*px)/px-eu)}
export function pasAan(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);
  const rw=Math.floor(w*renderer.getPixelRatio()),rh=Math.floor(h*renderer.getPixelRatio());   /* gerenderde pixels */
  camera.left=-rw/cam.px/2;camera.right=rw/cam.px/2;camera.top=rh/cam.px/2;camera.bottom=-rh/cam.px/2;camera.updateProjectionMatrix();
}
export function zetZoom(px){cam.px=px;pasAan()}
addEventListener('resize',pasAan);pasAan();

/* ---------- gebieden ---------- */
export const inDorp=(x,z)=>Math.abs(x)<DORP&&Math.abs(z)<DORP;
export const opPad=(x,z)=>Math.abs(x)<1.6;

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
const TILE=32,CPU=2;                      /* eenheden per grondtegel: 32 px op 2 eenheden = 16 px per eenheid, net als de sprites */
const N=Math.round(VELD*2/CPU);           /* tegels per zijde */
export function celType(x,z){ /* wereldcoördinaten → 'g' gras, 'c' keien, 'p' pad */
  if(Math.hypot(x,z)<PLEIN)return 'c';
  if(opPad(x,z))return 'p';
  return 'g';
}
function toeval(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function bouwGrond(atlas,decor){
  const R=toeval(12345);
  const c=document.createElement('canvas');c.width=N*TILE;c.height=N*TILE;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const w2p=v=>(v+VELD)/CPU*TILE;          /* wereld → canvaspixels */
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){
    const x=(i+.5)*CPU-VELD,z=(j+.5)*CPU-VELD,t=celType(x,z);
    const idx=(R()<.12?2:R()<.3?1:0);   /* plein en pad zijn 3D-vlakken met kit-texturen (bouw.js) */
    g.drawImage(atlas,idx*TILE,0,TILE,TILE,i*TILE,j*TILE,TILE,TILE);
  }
  /* wat bloemen en steentjes in het gras, spaarzaam en alleen buiten het dorp wat dichter */
  for(let k=0;k<260;k++){const x=R()*2*VELD-VELD,z=R()*2*VELD-VELD;if(celType(x,z)!=='g')continue;
    if(inDorp(x,z)&&R()<.7)continue;
    const img=[decor.bloemen,decor.bloemen2,decor.rots2,decor.bloemen][Math.floor(R()*4)];
    g.drawImage(img,Math.round(w2p(x)-img.width/2),Math.round(w2p(z)-img.height/2))}
  const tex=maakTex(c,false);tex.magFilter=GLAD?THREE.LinearFilter:THREE.NearestFilter;
  if(GLAD){tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=4}else{tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false}
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(VELD*2,VELD*2),new THREE.MeshBasicMaterial({map:tex}));
  mesh.rotation.x=-Math.PI/2;scene.add(mesh);
  /* schaduwvanger: een doorzichtig vlak dat alleen de slagschaduwen van gebouwen en hekken toont, in de omlijningskleur */
  const vanger=new THREE.Mesh(new THREE.PlaneGeometry(VELD*2,VELD*2),new THREE.ShadowMaterial({color:0x1a1540,opacity:.38}));
  vanger.rotation.x=-Math.PI/2;vanger.position.y=.03;vanger.receiveShadow=true;vanger.renderOrder=1;scene.add(vanger);
  /* wijde omgeving buiten de wereld */
  const buiten=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:0x4f7f2a}));
  buiten.rotation.x=-Math.PI/2;buiten.position.y=-.01;scene.add(buiten);
}

/* ---------- decor ---------- */
export const borden=[];
/* Billboards (bomen, struiken, kleine spullen): dorpsobjecten (32px-kit) op .65, bomen en rotsen (16px-kit) op 1.3,
   dan kloppen ze met de held van 24 px. */
async function prop(naam,x,z,{r=0,schaduw=0,schaal=.65}={}){
  const tex=await laadTextuur('sprites/'+naam+'.png');if(!tex)throw new Error('Sprite ontbreekt: '+naam);
  const w=tex.image.width/FACTOR/PPU*schaal,h=tex.image.height/FACTOR/PPU*schaal;
  if(r>0)obstakels.push({x,z,r});
  const b=new Bord(tex,w,h,{schaduw});b.g.position.set(x,0,z);scene.add(b.g);borden.push(b);
  return b;
}
/* pixel-3D-bouwsels (bouw.js): gebouwen, kramen, put, hekken, tonnen. `rot`: draaiing om de y-as; de voorkant wijst naar +z. */
function bouw(g,x,z,{rot=0,r=0}={}){g.position.set(x,0,z);g.rotation.y=rot;g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(g);if(r>0)obstakels.push({x,z,r});return g}

export async function bouwWereld(){
  const[atlas,bloemen,bloemen2,rots2]=await Promise.all(['grond','bloemen','bloemen2','rots2'].map(n=>laadTextuur('sprites/'+n+'.png',{ruw:true})));
  if(!atlas||!bloemen||!bloemen2||!rots2)throw new Error('Grondsprites ontbreken');
  bouwGrond(atlas.image,{bloemen:bloemen.image,bloemen2:bloemen2.image,rots2:rots2.image});
  await B.laadTexturen();
  const P=[];
  /* ----- het dorp: een plein met de put, een kruising van wegen, huizen aan de wegen, en leven eromheen ----- */
  scene.add(B.plein(PLEIN));
  scene.add(B.pad(3.2,VELD*2));                                   /* de doorgaande weg noord-zuid, door beide poorten */
  scene.add(B.pad(2.6,DORP*2-2,{rot:Math.PI/2}));                 /* de dorpsweg oost-west */
  bouw(B.put(),0,0,{r:1.1});
  /* het plein: kramen, bankjes, lantaarns, koopwaar */
  bouw(B.kraam({stof:'stof_rood'}),-8.2,-6.2,{r:1.7,rot:.25});bouw(B.kraam({stof:'stof_groen',w:2.8}),8.4,-6.4,{r:1.6,rot:-.25});
  bouw(B.ton(),-5.6,-8.6,{r:.45});bouw(B.ton(),-4.6,-8.9,{r:.45});bouw(B.kist(),-11,-8.4,{r:.5,rot:.3});bouw(B.kist(.7),11.4,-8.2,{r:.45,rot:.5});bouw(B.ton(),12.2,-7.4,{r:.45});
  /* vier bankjes op de diagonalen rond de put, allemaal naar de put gericht */
  for(const hoek of[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4])bouw(B.bank(),Math.sin(hoek)*4.6,Math.cos(hoek)*4.6,{r:.8,rot:hoek+Math.PI});
  for(const[x,z]of[[-6.5,6.5],[6.5,6.5],[6.5,-6.5],[-6.5,-6.5]])P.push(prop('lantaarn',x*1.3,z*1.3,{r:.25}));
  /* huizen aan de oost-westweg, elk met een paadje van de deur naar de weg */
  const huizen=[
    ['vakwerk',{w:6,d:5,muur:'muur'},-13,-10,0],
    ['taverne',{w:7.5,d:5.5,h:3.4,dakH:2.6,muur:'muur',ramen:3},13,-10,0],
    ['houten',{w:6.5,d:5,muur:'hout',ramen:2},13.5,10.5,Math.PI],
    ['smid',{w:6,d:5,h:2.8,dakH:2,muur:'steen',ramen:1},-13.5,10.5,Math.PI],
  ];
  for(const[,opt,x,z,rot]of huizen){
    bouw(B.huis(opt),x,z,{r:Math.max(opt.w,opt.d)/2+.4,rot});
    const deurX=x+(rot?1:-1)*(-opt.w/2+1.3),deurZ=z+(rot?-1:1)*opt.d/2;        /* de deur zit links in de voorgevel */
    scene.add(B.pad(1.6,Math.abs(deurZ)-1.3,{x:deurX,z:(deurZ+(rot?-1.3:1.3))/2}));
  }
  /* smidse naast de smid: aambeeld, houtstapel, kist */
  P.push(prop('aambeeld',-9.2,8.2,{r:.5,schaduw:1}),prop('hout',-16.5,6.4,{r:.6,schaduw:1.2}));bouw(B.kist(),-9.8,10.6,{r:.5,rot:.4});
  /* achter de taverne: tonnen en hooi */
  bouw(B.ton(),17.6,-12.4,{r:.45});bouw(B.ton(),18.4,-11.6,{r:.45});bouw(B.hooibaal(),17.2,-7.6,{r:.7,rot:.4});bouw(B.hooibaal(),18.6,-8.4,{r:.7,rot:-.2});
  /* moestuinen en een vijver */
  bouw(B.moestuin(4.5,3),-14,-17.5,{r:2.4});bouw(B.moestuin(4,3),14,17.6,{r:2.2});
  bouw(B.vijver(2.4),6.5,15.5,{r:3.1});
  for(const[x,z]of[[3.6,13.2],[9.8,13.6],[4.2,18.2]])P.push(prop('rots',x,z,{r:.5,schaduw:1.2,schaal:1.1}));P.push(prop('struik',9.6,17.8,{schaduw:1,schaal:1.3}),prop('bloemen',3.2,16.4,{schaal:1.6}));
  P.push(prop('kar',-7.6,-14.8,{r:1.2,schaduw:2.6}));
  /* borden bij de poorten en bij het plein */
  P.push(prop('bord',2.4,9.2,{r:.4}),prop('bord',3.4,-DORP+2.6,{r:.4}),prop('bord',-3.4,DORP-2.6,{r:.4}));
  P.push(prop('lantaarn',3.2,-DORP+1.2,{r:.25}),prop('lantaarn',-3.2,-DORP+1.2,{r:.25}),prop('lantaarn',3.2,DORP-1.2,{r:.25}),prop('lantaarn',-3.2,DORP-1.2,{r:.25}));
  /* beplanting: bomen in de hoeken, struiken bij de huizen, bloemen langs het plein */
  const dorpsbomen=[['boom',-19,-19],['den',-16,-20],['boom2',-19.5,-4],['boom',19,-19],['den2',20,-15],['boom2',19.5,4],['boom',-19,18.5],['den',-20,14],['boom2',19.5,19],['den',-6,19.5],['boom',10,-19.5]];
  for(const[n,x,z]of dorpsbomen)P.push(prop(n,x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  for(const[x,z]of[[-9.6,-11.6],[-16.6,-12],[9.4,-13],[17,-13.8],[10,13.2],[17.4,12.6],[-17.2,12.8],[-10,13.4],[-5,-10.6],[5.4,-10.8],[-10.4,3],[10.6,3]])P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}));
  for(const[x,z]of[[-9,0],[9,0],[-4,9.6],[4,9.6],[-9.4,-3.4],[9.4,3.4],[-15.6,-6.2],[15.8,6]])P.push(prop('bloemen',x,z,{schaal:1.6}));
  /* palissade rond het dorp, met poorten op het pad in het noorden en zuiden */
  const STAP=2.6;
  for(let i=-DORP+STAP/2;i<DORP;i+=STAP){
    if(Math.abs(i)>POORT){bouw(B.hek(STAP),i,-DORP,{r:1.2});bouw(B.hek(STAP),i,DORP,{r:1.2})}
    bouw(B.hek(STAP),-DORP,i,{r:1.2,rot:Math.PI/2});bouw(B.hek(STAP),DORP,i,{r:1.2,rot:Math.PI/2});
  }
  /* ----- buiten het dorp: velden en bos ----- */
  const R=toeval(777);
  const buiten=(x,z,marge)=>Math.abs(x)>DORP+marge||Math.abs(z)>DORP+marge;
  const soorten=['boom','boom','boom2','den','den','den2','struik'];
  let n=0,pogingen=0;
  while(n<170&&pogingen++<4000){
    const x=R()*2*(VELD-2)-(VELD-2),z=R()*2*(VELD-2)-(VELD-2);
    if(!buiten(x,z,2.5)||Math.abs(x)<3.5)continue;                       /* niet in het dorp, niet op het pad */
    const rand=Math.max(Math.abs(x),Math.abs(z));
    if(rand<VELD-10&&R()<.45)continue;                                     /* dichter bos aan de rand van de wereld */
    if(!vrij(x,z,2.2))continue;
    const s=soorten[Math.floor(R()*soorten.length)];
    P.push(prop(s,x,z,s==='struik'?{schaduw:1,schaal:1.3}:{r:.55,schaduw:1.8,schaal:1.3}));n++;
  }
  for(let k=0;k<28;k++){const x=R()*2*(VELD-3)-(VELD-3),z=R()*2*(VELD-3)-(VELD-3);if(!buiten(x,z,2)||Math.abs(x)<3||!vrij(x,z,1.5))continue;P.push(prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}))}
  /* een bomenrij als rand van de wereld */
  for(let i=-VELD+1.5;i<VELD;i+=3){const s=R()<.5?'den':'boom';
    P.push(prop(s,i,-VELD+1.2,{r:.7,schaduw:1.8,schaal:1.3}),prop(s,i,VELD-1.2,{r:.7,schaduw:1.8,schaal:1.3}),prop(s,-VELD+1.2,i,{r:.7,schaduw:1.8,schaal:1.3}),prop(s,VELD-1.2,i,{r:.7,schaduw:1.8,schaal:1.3}))}
  await Promise.all(P);
}
export function updateBorden(){for(const b of borden)b.update(cam)}
