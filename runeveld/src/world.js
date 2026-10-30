/* Runeveld – renderer, camera, grond, decor en botsingen.
   Maat: 1 wereld-eenheid = 16 pixels pixel-art (PPU). Een grondtegel van 32 px is 1,5 eenheid.
   De wereld is een vierkant van -VELD..VELD; in het midden ligt het dorp (-DORP..DORP) achter een palissade
   met een poort in het noorden en het zuiden. Daarbuiten liggen velden en bos waar de monsters leven. */
import * as THREE from 'three';
import {laadTextuur,maakTex,Bord,FACTOR,GLAD,PIXEL,TELEFOON} from './sprites.js';
import * as B from './bouw.js';
import {BOS,inBos,inVeld,veldRand,binnenWereld,VALE,inVale,inStad,inKasteel} from './gebied.js';
export {binnenWereld};
import {bouwBos} from './bos.js';
import {bouwStad} from './stad.js';

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
export const hemi=new THREE.HemisphereLight(0xdff3ff,0x6a8a46,2.2);scene.add(hemi);
export const zon=new THREE.DirectionalLight(0xfff1d6,2.6);zon.position.set(20,40,15);scene.add(zon);scene.add(zon.target);
zon.castShadow=true;zon.shadow.mapSize.set(TELEFOON?2048:4096,TELEFOON?2048:4096);zon.shadow.bias=-.0005;
/* het bereik dekt het veld en het bos; de zon staat zo dat de projectie het bos (z tot -112) ook raakt */
zon.position.set(20,40,-10);zon.target.position.set(0,0,-26);
Object.assign(zon.shadow.camera,{left:-56,right:56,top:66,bottom:-66,near:1,far:160});
/* de schaduwcamera reist mee met de speler (de wereld is te groot voor één schaduwkaart); op hele eenheden, anders flikkeren de randen */
/* De schaduwkaart wordt alleen opnieuw getekend als het zicht verschuift of de zoom verandert: alles wat slagschaduw
   werpt staat stil (sprites hebben een eigen blobschaduw). De kaart dekt precies het zicht plus een rand. */
renderer.shadowMap.autoUpdate=false;
let zonX=1e9,zonZ=1e9,zonW=0,zonH=0;
export function volgZon(x,z){
  x=Math.round(x);z=Math.round(z);
  const hw=Math.ceil((camera.right-camera.left)/2+14),hh=Math.ceil((camera.top-camera.bottom)/2/Math.sin(cam.tilt)+18);
  if(x===zonX&&z===zonZ&&hw===zonW&&hh===zonH)return;
  zonX=x;zonZ=z;zonW=hw;zonH=hh;zon.position.set(x+20,40,z-10);zon.target.position.set(x,0,z-26);
  const sc=zon.shadow.camera;sc.left=-hw;sc.right=hw;sc.top=hh;sc.bottom=-hh;sc.updateProjectionMatrix();
  renderer.shadowMap.needsUpdate=true;
}
export function schaduwVernieuwen(){renderer.shadowMap.needsUpdate=true}

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
export function schud(kracht=.25,duur=.22){cam.schudK=Math.max(cam.schudK||0,kracht);cam.schudT=duur;cam.schudD=duur}
export function updateCamera(){
  const {yaw,tilt,afstand,doel,px}=cam;
  const h=afstand*Math.sin(tilt),r=afstand*Math.cos(tilt);
  camera.position.set(doel.x+Math.sin(yaw)*r,doel.y+h,doel.z+Math.cos(yaw)*r);
  camera.lookAt(doel.x,doel.y,doel.z);camera.updateMatrixWorld();
  cam.r.setFromMatrixColumn(camera.matrixWorld,0);cam.u.setFromMatrixColumn(camera.matrixWorld,1);
  if(cam.schudT>0){const k=cam.schudK*(cam.schudT/cam.schudD);camera.position.addScaledVector(cam.r,(Math.random()*2-1)*k).addScaledVector(cam.u,(Math.random()*2-1)*k)}
  else cam.schudK=0;
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
/* buiten de wereld? dan terug naar binnen: in kleine stappen richting het dorp of het bosmidden, wat het dichtst bij is */
function klem(x,z,m=1.2){
  if(binnenWereld(x,z,m))return[x,z];
  let best=null,bd=1e9;
  for(const[cx,cz]of[[0,0],[BOS.cx,BOS.cz],[VALE.cx,VALE.cz]]){const dx=cx-x,dz=cz-z,d=Math.hypot(dx,dz)||1;
    for(let s=.3;s<60;s+=.3){const px=x+dx/d*s,pz=z+dz/d*s;if(binnenWereld(px,pz,m)){if(s<bd){bd=s;best=[px,pz]}break}}}
  return best||[0,4];
}
export function botsing(x,z,r=.35){
  [x,z]=klem(x,z);
  for(const o of obstakels){const dx=x-o.x,dz=z-o.z,d=Math.hypot(dx,dz),min=o.r+r;
    if(d<min){if(d<1e-4){x+=min}else{x=o.x+dx/d*min;z=o.z+dz/d*min}}}
  return[x,z];
}
export function vrij(x,z,r=.5){if(!binnenWereld(x,z))return false;for(const o of obstakels)if(Math.hypot(x-o.x,z-o.z)<o.r+r)return false;return true}

/* ---------- muis → grondpunt ---------- */
const ray=new THREE.Raycaster(),grondVlak=new THREE.Plane(new THREE.Vector3(0,1,0),0),_v=new THREE.Vector2(),_p=new THREE.Vector3();
export function straal(cx,cy){_v.set(cx/innerWidth*2-1,-(cy/innerHeight)*2+1);ray.setFromCamera(_v,camera);return ray}
export function grondPunt(cx,cy){straal(cx,cy);return ray.ray.intersectPlane(grondVlak,_p)?_p.clone():null}

/* ---------- grond: tegelkaart ---------- */
const TILE=32,CPU=2;                      /* eenheden per grondtegel: 32 px op 2 eenheden = 16 px per eenheid, net als de sprites */
/* de grondkaart dekt het veld en het bos erboven */
const X0=-VELD-10,X1=VELD+10,Z0=BOS.z0,Z1=VELD+10,NX=Math.round((X1-X0)/CPU),NZ=Math.round((Z1-Z0)/CPU);
export function celType(x,z){ /* wereldcoördinaten → 'g' gras, 'c' keien, 'p' pad */
  if(Math.hypot(x,z)<PLEIN)return 'c';
  if(opPad(x,z))return 'p';
  return 'g';
}
function toeval(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
function bouwGrond(atlas,decor){
  const R=toeval(12345);
  const c=document.createElement('canvas');c.width=NX*TILE;c.height=NZ*TILE;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const w2px=v=>(v-X0)/CPU*TILE,w2pz=v=>(v-Z0)/CPU*TILE;          /* wereld → canvaspixels */
  for(let j=0;j<NZ;j++)for(let i=0;i<NX;i++){
    const x=(i+.5)*CPU+X0,z=(j+.5)*CPU+Z0;
    const idx=(R()<.12?2:R()<.3?1:0);   /* plein en pad zijn 3D-vlakken met kit-texturen (bouw.js) */
    g.drawImage(atlas,idx*TILE,0,TILE,TILE,i*TILE,j*TILE,TILE,TILE);
  }
  /* het bos: donkerder, koeler gras; buiten de wereld (achter de bomenrand) nog donkerder. Per halve tegel, zodat de
     golvende randen te volgen zijn; de bomen eroverheen maken de trapjes onzichtbaar */
  const H=TILE/4,S=CPU/4;
  for(let j=0;j<NZ*4;j++)for(let i=0;i<NX*4;i++){const x=(i+.5)*S+X0,z=(j+.5)*S+Z0;
    if(inBos(x,z)&&!inVeld(x,z))g.fillStyle='rgba(22,44,38,.34)';else if(!inBos(x,z,-2.5)&&!inVeld(x,z,-2.5)&&!inVale(x,z,-2.5))g.fillStyle='rgba(10,28,20,.5)';else continue;
    g.fillRect(i*H,j*H,H,H)}
  /* wat bloemen en steentjes in het gras, spaarzaam en alleen buiten het dorp wat dichter; in het bos alleen steentjes */
  for(let k=0;k<380;k++){const x=X0+R()*(X1-X0),z=Z0+R()*(Z1-Z0);
    if(inVeld(x,z)){if(celType(x,z)!=='g'||(inDorp(x,z)&&R()<.7))continue}else if(!inBos(x,z))continue;
    const img=inBos(x,z)?decor.rots2:[decor.bloemen,decor.bloemen2,decor.rots2,decor.bloemen][Math.floor(R()*4)];
    g.drawImage(img,Math.round(w2px(x)-img.width/2),Math.round(w2pz(z)-img.height/2))}
  const tex=maakTex(c,false);tex.magFilter=GLAD?THREE.LinearFilter:THREE.NearestFilter;
  if(GLAD){tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=4}else{tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false}
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0),new THREE.MeshBasicMaterial({map:tex}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set((X0+X1)/2,0,(Z0+Z1)/2);scene.add(mesh);
  /* schaduwvanger: een doorzichtig vlak dat alleen de slagschaduwen van gebouwen en hekken toont, in de omlijningskleur */
  const vanger=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0),new THREE.ShadowMaterial({color:0x1a1540,opacity:.38}));
  vanger.rotation.x=-Math.PI/2;vanger.position.set((X0+X1)/2,.03,(Z0+Z1)/2);vanger.receiveShadow=true;vanger.renderOrder=1;scene.add(vanger);
  /* wijde omgeving buiten de wereld */
  bouwGrondVale(atlas,decor);
  const buiten=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshBasicMaterial({color:0x4f7f2a}));
  buiten.rotation.x=-Math.PI/2;buiten.position.y=-.01;scene.add(buiten);
}

/* de grond van Kingsvale: een eigen tegelkaart (één grote kaart voor alles zou te veel textuurgeheugen vragen).
   Waar het veld overlapt blijft hij doorzichtig; de weiden zijn iets warmer van kleur, de stad krijgt aangestampte aarde. */
function bouwGrondVale(atlas,decor){
  const R=toeval(31337);
  const VX0=VALE.x0-8,VX1=-60,VZ0=VALE.z0-6,VZ1=VALE.z1+6,VNX=Math.round((VX1-VX0)/CPU),VNZ=Math.round((VZ1-VZ0)/CPU);
  const c=document.createElement('canvas');c.width=VNX*TILE;c.height=VNZ*TILE;const g=c.getContext('2d');g.imageSmoothingEnabled=false;
  const w2px=v=>(v-VX0)/CPU*TILE,w2pz=v=>(v-VZ0)/CPU*TILE;
  for(let j=0;j<VNZ;j++)for(let i=0;i<VNX;i++){
    const x=(i+.5)*CPU+VX0,z=(j+.5)*CPU+VZ0;
    if(inVeld(x,z,-1)&&x>-70)continue;                       /* daar ligt de grond van het veld al */
    const idx=(R()<.12?2:R()<.3?1:0);g.drawImage(atlas,idx*TILE,0,TILE,TILE,i*TILE,j*TILE,TILE,TILE);
  }
  const H=TILE/4,S=CPU/4;
  for(let j=0;j<VNZ*4;j++)for(let i=0;i<VNX*4;i++){const x=(i+.5)*S+VX0,z=(j+.5)*S+VZ0;
    if(inVeld(x,z,-1)&&x>-70)continue;
    if(inStad(x,z,.7))g.fillStyle=inKasteel(x,z)?'rgba(120,110,100,.5)':'rgba(150,122,80,.42)';
    else if(inVale(x,z))g.fillStyle='rgba(140,120,30,.1)';
    else if(!inVale(x,z,-2.5)&&!inVeld(x,z,-2.5))g.fillStyle='rgba(10,28,20,.5)';else continue;
    g.fillRect(i*H,j*H,H,H)}
  for(let k=0;k<420;k++){const x=VX0+R()*(VX1-VX0),z=VZ0+R()*(VZ1-VZ0);
    if(!inVale(x,z)||inVeld(x,z)||inStad(x,z,-1))continue;
    const img=[decor.bloemen,decor.bloemen2,decor.rots2,decor.bloemen][Math.floor(R()*4)];
    g.drawImage(img,Math.round(w2px(x)-img.width/2),Math.round(w2pz(z)-img.height/2))}
  const tex=maakTex(c,false);tex.magFilter=GLAD?THREE.LinearFilter:THREE.NearestFilter;
  if(GLAD){tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=4}else{tex.minFilter=THREE.NearestFilter;tex.generateMipmaps=false}
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(VX1-VX0,VZ1-VZ0),new THREE.MeshBasicMaterial({map:tex,transparent:true,alphaTest:.5}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set((VX0+VX1)/2,.006,(VZ0+VZ1)/2);scene.add(mesh);
  const vanger=new THREE.Mesh(new THREE.PlaneGeometry(VX1-VX0,VZ1-VZ0),new THREE.ShadowMaterial({color:0x1a1540,opacity:.38}));
  vanger.rotation.x=-Math.PI/2;vanger.position.set((VX0+VX1)/2,.031,(VZ0+VZ1)/2);vanger.receiveShadow=true;vanger.renderOrder=1;scene.add(vanger);
}

/* ---------- decor ---------- */
export const borden=[];
/* Billboards (bomen, struiken, kleine spullen): dorpsobjecten (32px-kit) op .65, bomen en rotsen (16px-kit) op 1.3,
   dan kloppen ze met de held van 24 px. */
async function prop(naam,x,z,{r=0,schaduw=0,schaal=.65}={}){
  const tex=await laadTextuur('sprites/'+naam+'.png');if(!tex)throw new Error('Sprite ontbreekt: '+naam);
  const w=tex.image.width/FACTOR/PPU*schaal,h=tex.image.height/FACTOR/PPU*schaal;
  if(r>0)obstakels.push({x,z,r});
  const b=new Bord(tex,w,h,{schaduw});b.g.position.set(x,0,z);scene.add(b.g);borden.push(b);b.naam=naam;b.x=x;b.z=z;b.schaal=schaal;
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
  P.push(prop('lantaarn',-DORP+1.2,3.2,{r:.25}),prop('lantaarn',-DORP+1.2,-3.2,{r:.25}),prop('bord',-DORP+2.6,3.4,{r:.4}),prop('lantaarn',3.2,-DORP+1.2,{r:.25}),prop('lantaarn',-3.2,-DORP+1.2,{r:.25}),prop('lantaarn',3.2,DORP-1.2,{r:.25}),prop('lantaarn',-3.2,DORP-1.2,{r:.25}));
  /* beplanting: bomen in de hoeken, struiken bij de huizen, bloemen langs het plein */
  const dorpsbomen=[['boom',-19,-19],['den',-16,-20],['boom2',-19.5,-4],['boom',19,-19],['den2',20,-15],['boom2',19.5,4],['boom',-19,18.5],['den',-20,14],['boom2',19.5,19],['den',-6,19.5],['boom',10,-19.5]];
  for(const[n,x,z]of dorpsbomen)P.push(prop(n,x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  for(const[x,z]of[[-9.6,-11.6],[-16.6,-12],[9.4,-13],[17,-13.8],[10,13.2],[17.4,12.6],[-17.2,12.8],[-10,13.4],[-5,-10.6],[5.4,-10.8],[-10.4,3],[10.6,3]])P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}));
  for(const[x,z]of[[-9,0],[9,0],[-4,9.6],[4,9.6],[-9.4,-3.4],[9.4,3.4],[-15.6,-6.2],[15.8,6]])P.push(prop('bloemen',x,z,{schaal:1.6}));
  /* palissade rond het dorp, met poorten op het pad in het noorden en zuiden */
  const STAP=2.6;
  for(let i=-DORP+STAP/2;i<DORP;i+=STAP){
    if(Math.abs(i)>POORT){bouw(B.hek(STAP),i,-DORP,{r:1.2});bouw(B.hek(STAP),i,DORP,{r:1.2})}
    if(Math.abs(i)>POORT)bouw(B.hek(STAP),-DORP,i,{r:1.2,rot:Math.PI/2});bouw(B.hek(STAP),DORP,i,{r:1.2,rot:Math.PI/2});
  }
  /* ----- buiten het dorp: velden en bos ----- */
  const R=toeval(777);
  const buiten=(x,z,marge)=>Math.abs(x)>DORP+marge||Math.abs(z)>DORP+marge;
  const soorten=['boom','boom','boom2','den','den','den2','struik'];
  let n=0,pogingen=0;
  while(n<170&&pogingen++<4000){
    const x=R()*2*(VELD-2)-(VELD-2),z=R()*2*(VELD-2)-(VELD-2);
    if(!buiten(x,z,2.5)||Math.abs(x)<3.5||(x<-DORP&&Math.abs(z)<3.2))continue;   /* niet in het dorp, niet op de wegen */
    const rand=Math.max(Math.abs(x),Math.abs(z));
    if(rand<VELD-10&&R()<.45)continue;                                     /* dichter bos aan de rand van de wereld */
    if(!vrij(x,z,2.2))continue;
    const s=soorten[Math.floor(R()*soorten.length)];
    P.push(prop(s,x,z,s==='struik'?{schaduw:1,schaal:1.3}:{r:.55,schaduw:1.8,schaal:1.3}));n++;
  }
  for(let k=0;k<28;k++){const x=R()*2*(VELD-3)-(VELD-3),z=R()*2*(VELD-3)-(VELD-3);if(!buiten(x,z,2)||Math.abs(x)<3||(x<-DORP&&Math.abs(z)<3)||!vrij(x,z,1.5))continue;P.push(prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}))}
  /* een bomenrij als rand van de wereld */
  /* een bomenrand langs de golvende rand van het veld: de binnenste rij sluit af (botsing), daarbuiten nog drie
     losse rijen zodat de wereld in bos overgaat. Waar het bos het veld overlapt (de noordpoort) staat niets. */
  for(let th=0;th<Math.PI*2;th+=2.3/60){const r=veldRand(th);
    for(const[k,dicht,kans]of[[-1.3,true,1],[1.6,false,1],[4.4,false,.85],[7.4,false,.7],[10.4,false,.5]]){
      const rr=r+k+(dicht?0:(R()-.5)*1.6),x=Math.sin(th)*rr+(dicht?0:(R()-.5)*1.2),z=Math.cos(th)*rr;
      if(inBos(x,z)||inVale(x,z)||R()>kans)continue;
      const s=R()<.6?'den':R()<.5?'boom':'boom2';
      P.push(prop(s,x,z,{r:dicht?.7:0,schaduw:1.8,schaal:1.3}))}}
  bouwBos({scene,prop,bouw,vrij,toeval,P});
  bouwStad({scene,prop,bouw,vrij,toeval,P,obstakels});
  await Promise.all(P);renderer.shadowMap.needsUpdate=true;
}
export function updateBorden(){for(const b of borden)b.update(cam)}
