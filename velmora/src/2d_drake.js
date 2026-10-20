/* ===================== Drakenrijk: de Asvlakte van Vyraxion =====================
   Een eigen gebied (instance) achter de Drakenpas aan de oostrand van Zilverdal. Het ligt in de wereld ver weg
   (x≈-1600), zodat de rest van Velmora niet getekend of doorgerekend wordt zolang je hier bent.
   - Asvlakte met lavarivieren, verkoolde bossen, drakennesten en drakenschrijnen (niveau 13–18)
   - In het midden een vulkaan; halverwege de westflank ligt de ingang naar het Hart van de Vulkaan (kerker, 18–20)
     waar Vyraxion de Asvorst woont.
   Alle modellen zijn CC0: Quaternius (draken, vleermuizen, raptors, lavadrakes, bomen, rotsen, kerkerdecor). */
const DRK={x:-1600,z:0,R:186};
const inDrk=x=>x<-1000;
const VOLC={x:DRK.x,z:DRK.z,r:80,h:46,cr:15};
const DRK_GATE={x:228,z:100};                         /* Drakenpas in Zilverdal */
const DRK_ENTRY={x:DRK.x-160,z:4};                    /* aankomst in het Drakenrijk */
const DRK_EXIT={x:DRK.x-177,z:0};                     /* poort terug */
const DRK_CAMP={x:DRK.x-138,z:26};                    /* Drakenjagerskamp */
const VOLC_DOOR={x:VOLC.x-50,z:VOLC.z};               /* ingang van de vulkaankerker */
/* ---- lava: rivieren vanaf de kraterrand naar beneden, en losse poelen ---- */
const DRK_RIVERS=[];{const R=mulberry(7071);
  for(const a0 of[.25,1.62,-1.58,-.8]){const pts=[];let w=1.7;for(let r=16;r<178;r+=5){const a=a0+.28*Math.sin(r*.034+a0*3)+.1*Math.sin(r*.11+a0);pts.push([DRK.x+Math.cos(a)*r,DRK.z+Math.sin(a)*r,w]);w=Math.min(3.6,w+.06+R()*.04)}DRK_RIVERS.push(pts)}}
const DRK_POOLS=[];{const R=mulberry(7072);for(let i=0,t=0;i<9&&t<400;t++){const a=R()*6.28,d=96+R()*64,x=DRK.x+Math.cos(a)*d,z=DRK.z+Math.sin(a)*d;
  if(Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)<44||Math.abs(z-DRK.z)<14&&x<DRK.x)continue;DRK_POOLS.push({x,z,r:3+R()*3.5});i++}}
function riverDist(x,z){let best=1e9,bw=2;for(const pts of DRK_RIVERS)for(let i=0;i<pts.length-1;i++){const[ax,az,aw]=pts[i],[bx,bz]=pts[i+1];const d=segDist(x,z,ax,az,bx,bz);if(d<best){best=d;bw=aw}}return[best,bw]}
/* staat (x,z) in de lava? (rivier, poel of kratermeer) */
function drkLava(x,z){if(!inDrk(x))return false;const dv=Math.hypot(x-VOLC.x,z-VOLC.z);if(dv<VOLC.cr*.62)return true;if(dv<VOLC.cr+2)return false;
  const[d,w]=riverDist(x,z);if(d<w*.85)return true;for(const p of DRK_POOLS)if(Math.hypot(x-p.x,z-p.z)<p.r*.85)return true;return false}
/* ---- paden ---- */
const DRK_PATHS=[[[DRK_EXIT.x,DRK_EXIT.z],[DRK.x-150,10],[DRK.x-122,14],[DRK.x-92,4],[DRK.x-62,0],[VOLC_DOOR.x,0]],[[DRK.x-122,14],[DRK.x-110,-60],[DRK.x-60,-118]],[[DRK.x-92,4],[DRK.x-60,90],[DRK.x-10,130]],[[DRK.x-60,-118],[DRK.x+60,-110],[DRK.x+118,-30]]];
function drkPathDist(x,z){let m=1e9;for(const p of DRK_PATHS)for(let i=0;i<p.length-1;i++){const d=segDist(x,z,p[i][0],p[i][1],p[i+1][0],p[i+1][1]);if(d<m)m=d}return m}
/* ---- hoogteveld ---- */
const DSZ=380,DSEG=190,DCELL=DSZ/DSEG,DHN=DSEG+1;
function drkRaw(x,z){const u=x-DRK.x,v=z-DRK.z;
  let h=(fbm(u*.017+11,v*.017+5)-.5)*9+(fbm(u*.07+3,v*.07)-.5)*2.2;
  const d=Math.hypot(u,v);
  if(d<VOLC.r){const k=1-d/VOLC.r;h+=VOLC.h*Math.pow(k,1.25)*(1+.06*Math.sin(Math.atan2(v,u)*7))}
  const rimH=VOLC.h*Math.pow(1-VOLC.cr/VOLC.r,1.25)+2;if(d<VOLC.cr){h=rimH-12*(1-(d/VOLC.cr)**2)}
  const e=Math.max(Math.abs(u),Math.abs(v));if(e>158)h+=(e-158)*.3;
  /* kamp en aankomst vlak; paden zacht */
  for(const f of[{x:DRK_CAMP.x,z:DRK_CAMP.z,r:24},{x:DRK_EXIT.x+8,z:DRK_EXIT.z,r:16}]){const fd=Math.hypot(x-f.x,z-f.z);if(fd<f.r)h=lerp(1.5,h,smooth(clamp((fd-f.r*.6)/(f.r*.4),0,1)))}
  const pd=drkPathDist(x,z);if(pd<6&&d>VOLC.r*.55)h=lerp(h*.7+.4,h,smooth(pd/6));
  /* geulen voor de lava */
  const[rd,rw]=riverDist(x,z);if(rd<rw+1.5)h-=.9*smooth(1-rd/(rw+1.5));for(const p of DRK_POOLS){const pd2=Math.hypot(x-p.x,z-p.z);if(pd2<p.r+1)h-=.7*smooth(1-pd2/(p.r+1))}
  return h}
const DHM=new Float32Array(DHN*DHN);for(let i=0;i<DHN;i++)for(let j=0;j<DHN;j++)DHM[i*DHN+j]=drkRaw(DRK.x-DSZ/2+j*DCELL,DRK.z-DSZ/2+i*DCELL);
function drkH(x,z){const fx=clamp((x-DRK.x+DSZ/2)/DCELL,0,DSEG-.001),fz=clamp((z-DRK.z+DSZ/2)/DCELL,0,DSEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;
  const a=DHM[i*DHN+j],b=DHM[i*DHN+j+1],c=DHM[(i+1)*DHN+j],d=DHM[(i+1)*DHN+j+1];return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
function drkZone(x,z){const d=Math.hypot(x-VOLC.x,z-VOLC.z);if(d<VOLC.r*.85)return'Mount Dragonrest';if(Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)<34)return'Dragonhunters\' Camp';
  const u=x-DRK.x,v=z-DRK.z;if(v>60)return'Dragon Nests';if(u>70)return'Shrines of the Ash Queen';if(v<-70)return'Fire Fields';return'Ash Plains'}
function drkCollide(p,r){p.x=clamp(p.x,DRK.x-178,DRK.x+170);p.z=clamp(p.z,DRK.z-170,DRK.z+170)}
/* ---- terrein ---- */
const drkTerrain=(()=>{const geo=new THREE.PlaneGeometry(DSZ,DSZ,DSEG,DSEG);geo.rotateX(-Math.PI/2);geo.translate(DRK.x,0,DRK.z);
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3),c=new THREE.Color(),t=new THREE.Color();
  const ASH=new THREE.Color(0x5b5550),ASH2=new THREE.Color(0x76695c),BAS=new THREE.Color(0x2c2826),SCOR=new THREE.Color(0x45302a),EMB=new THREE.Color(0x8a3a18),PATH=new THREE.Color(0x857360),RIM=new THREE.Color(0x221c1a),CRAT=new THREE.Color(0x5a2410),MOSS=new THREE.Color(0x4a4a34);
  for(let k=0;k<pos.count;k++){const i=Math.floor(k/DHN),j=k%DHN,x=DRK.x-DSZ/2+j*DCELL,z=DRK.z-DSZ/2+i*DCELL,h=DHM[k];pos.setY(k,h);
    const n=fbm(x*.04,z*.04),n2=vnoise(x*.25,z*.25);c.copy(ASH).lerp(ASH2,n*.8);if(n2>.62)c.lerp(SCOR,.5);if(Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)<30&&n>.5)c.lerp(MOSS,.35);
    const hx=DHM[i*DHN+Math.min(j+1,DSEG)]-h,hz=DHM[Math.min(i+1,DSEG)*DHN+j]-h,slope=Math.hypot(hx,hz)/DCELL;
    if(slope>.45)c.lerp(BAS,clamp((slope-.4)*2,0,.9));if(h>22)c.lerp(RIM,clamp((h-22)/14,0,.85));
    const dv=Math.hypot(x-VOLC.x,z-VOLC.z);if(dv<VOLC.cr+1)c.lerp(CRAT,.8);
    const[rd,rw]=riverDist(x,z);if(rd<rw+7)c.lerp(EMB,smooth(clamp(1-(rd-rw)/7,0,1))*.75);for(const p of DRK_POOLS){const d=Math.hypot(x-p.x,z-p.z);if(d<p.r+5)c.lerp(EMB,smooth(clamp(1-(d-p.r)/5,0,1))*.7)}
    const pd=drkPathDist(x,z);if(pd<3.6)c.lerp(PATH,smooth(clamp(1-(pd-1.6)/2,0,1))*.85);
    const jit=.9+hash(i+7000,j)*.18;col[k*3]=c.r*jit;col[k*3+1]=c.g*jit;col[k*3+2]=c.b*jit}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
  const tex=TEX.paint.clone();tex.needsUpdate=true;tex.repeat.set(22,22);
  const m=new THREE.Mesh(geo,new THREE.MeshToonMaterial({vertexColors:true,map:tex,bumpMap:tex,bumpScale:.1,gradientMap:RAMP}));m.receiveShadow=true;scene.add(m);return m})();
/* ---- lava: stromende textuur (gedeeld, wordt in updDrake verschoven) ---- */
const LAVA_TEX=canvasTex(256,256,(g,w,h)=>{const d=g.createImageData(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const n=fbm(x*.045,y*.03)*.7+fbm(x*.14+9,y*.1)*.3;const crack=Math.abs(Math.sin((x*.08+fbm(x*.03,y*.03)*6)))<.12;const v=crack?.35:n;
  const i=(y*w+x)*4;d.data[i]=255*clamp(.55+v*.6,0,1);d.data[i+1]=255*clamp(v*v*.95,0,1);d.data[i+2]=255*clamp(v*v*v*.35,0,1);d.data[i+3]=255}g.putImageData(d,0,0)});
LAVA_TEX.wrapS=LAVA_TEX.wrapT=THREE.RepeatWrapping;LAVA_TEX.colorSpace=THREE.SRGBColorSpace;
const LAVA_MAT=new THREE.MeshBasicMaterial({map:LAVA_TEX,color:new THREE.Color().setRGB(1.5,1.3,1.15)});
{/* rivieren als linten die het terrein volgen */
  const P=[],U=[],I=[];let base=0;
  for(const pts of DRK_RIVERS){let along=0;const n=[];for(let i=0;i<pts.length-1;i++){const[ax,az,aw]=pts[i],[bx,bz,bw]=pts[i+1];const L=Math.hypot(bx-ax,bz-az),steps=Math.ceil(L/1.6);for(let s=0;s<steps;s++){const f=s/steps;n.push([lerp(ax,bx,f),lerp(az,bz,f),lerp(aw,bw,f)])}}
    for(let i=0;i<n.length;i++){const[x,z,w]=n[i];const[nx,nz]=n[Math.min(i+1,n.length-1)],[px,pz]=n[Math.max(i-1,0)];const dx=nx-px,dz=nz-pz,L=Math.hypot(dx,dz)||1;const ox=-dz/L*w,oz=dx/L*w;
      if(Math.max(Math.abs(x-DRK.x),Math.abs(z-DRK.z))>172)break;
      const y=drkH(x,z)+.32;if(i)along+=Math.hypot(x-n[i-1][0],z-n[i-1][1]);P.push(x+ox,y,z+oz,x-ox,y,z-oz);U.push(0,along/6,1,along/6);
      if(i){const a=base+(i-1)*2;I.push(a,a+2,a+1,a+1,a+2,a+3)}}
    base=P.length/3}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();
  const m=new THREE.Mesh(g,LAVA_MAT);m.receiveShadow=false;scene.add(m);
  /* poelen en kratermeer */
  for(const p of DRK_POOLS){const c=new THREE.Mesh(new THREE.CircleGeometry(p.r,28).rotateX(-Math.PI/2),LAVA_MAT);c.position.set(p.x,drkH(p.x,p.z)+.25,p.z);scene.add(c);if(DRK_POOLS.indexOf(p)%2===0)addLight(p.x,drkH(p.x,p.z)+2,p.z,0xff6a20,22,16,true)}
  const rimH=VOLC.h*Math.pow(1-VOLC.cr/VOLC.r,1.25)+2;const lake=new THREE.Mesh(new THREE.CircleGeometry(VOLC.cr*.7,40).rotateX(-Math.PI/2),LAVA_MAT);lake.position.set(VOLC.x,rimH-7,VOLC.z);scene.add(lake);addLight(VOLC.x,rimH-3,VOLC.z,0xff7a30,40,40,true);
  for(const pts of DRK_RIVERS)for(let i=1;i<pts.length;i+=5){const[x,z]=pts[i];if(Math.max(Math.abs(x-DRK.x),Math.abs(z-DRK.z))<165)addLight(x,drkH(x,z)+2.2,z,0xff5a18,20,15,true)}}
/* ---- portalen en poorten (procedureel deel; modellen komen in buildDrakeEnv) ---- */
/* the three gates of the Dragon Realm: a D_Arch (opening along z) with the portal filling it exactly, colliders only on the
   arch posts, and the pillars with fire bowls just outside the arch */
const DRK_ARCH={gate:{x:DRK_GATE.x,z:DRK_GATE.z,s:2.6,col:0xff5a1a,skull:1},exit:{x:DRK_EXIT.x,z:DRK_EXIT.z,s:2.4,col:0x6ac8ff,skull:0},door:{x:VOLC_DOOR.x,z:VOLC_DOOR.z,s:2.2,col:0xff7a20,skull:1}};
const DRK_PORTALS={};for(const k in DRK_ARCH){const a=DRK_ARCH[k];const y=groundH(a.x,a.z);DRK_PORTALS[k]=portalMesh(a.col,a.s,a.x,y,a.z,Math.PI/2);
  for(const sd of[-1,1]){addCol(a.x,a.z+sd*1.58*a.s,.46*a.s);const cz=a.z+sd*(2.05*a.s+1.4);addCol(a.x,cz,1.1);addFlame(scene,a.x,y+6.35,cz,1.6,0xff8a30);addLight(a.x,y+6.8,cz,0xff8a40,26,16)}}
/* vulkaankern rond de ingang: niet door de berg heen lopen naast de deur */
for(let a=-1;a<=1;a+=2)for(let k=0;k<4;k++)addCol(VOLC_DOOR.x+1.6+k*1.4,VOLC_DOOR.z+a*(2.05*2.2+.9+k*.6),1.3);
/* ---- kerker: Hart van de Vulkaan ---- */
const D3MAP=[
'#########################',
'#######...........#######',
'#####...............#####',
'####....~.......~....####',
'###.........B.........###',
'###..~.............~..###',
'###...................###',
'####....~.......~....####',
'#####...............#####',
'#######...........#######',
'##########.....##########',
'###########...###########',
'#####......w.w......#####',
'####..~~.........~~..####',
'####.L.....p.p.....L.####',
'####.......~~~.......####',
'#####..w.........w..#####',
'#########...~...#########',
'#########.......#########',
'######.p.........p.######',
'#####~.....w.w.....~#####',
'#####...............#####',
'######..~~.....~~..######',
'##########.....##########',
'#########..p.p..#########',
'#########.......#########',
'###########...###########',
'###########.E.###########',
'#########################'];
const D3=buildDun({x:1800,z:0,c:6,map:D3MAP,floor:0x7a5242,wall:0x4a2a20,crystal:0xff5a20,spawn:{w:['welp',18,19],p:['drakonier',19,19],L:['lavadrake',19,19],B:'vyraxion'},name:'Heart of the Volcano'});
/* de drakenhal: middelpunt en straal (voor de baas) */
const D3_HALL=(()=>{const[x,z]=D3.pos(12,5);return{x,z,r:30}})();
/* ---- overzichtskaart van het Drakenrijk ---- */
const drkImg=(()=>{const W=380,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');const d=g.createImageData(W,W);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const wx=DRK.x-DSZ/2+x*DSZ/W,wz=DRK.z-DSZ/2+y*DSZ/W;const h=drkH(wx,wz);let r=86+h*1.2,gg=80+h*.9,b=74+h*.6;
    if(drkLava(wx,wz)){r=255;gg=110;b=30}else{const[rd,rw]=riverDist(wx,wz);if(rd<rw+4){r=200;gg=90;b=40}}
    if(drkPathDist(wx,wz)<2.2){r=150;gg=128;b=100}const e=Math.max(Math.abs(wx-DRK.x),Math.abs(wz-DRK.z));if(e>168){r*=.45;gg*=.45;b*=.45}
    const i=(y*W+x)*4;d.data[i]=clamp(r,0,255);d.data[i+1]=clamp(gg,0,255);d.data[i+2]=clamp(b,0,255);d.data[i+3]=255}
  g.putImageData(d,0,0);return c})();
/* ---- omgevingsmodellen (async, bij het laden) ---- */
async function buildDrakeEnv(){if(window.__NOGLTF)return;
  const R=mulberry(9393);const jobs=[];
  const ok=(x,z,clear=5)=>Math.max(Math.abs(x-DRK.x),Math.abs(z-DRK.z))<158&&Math.hypot(x-VOLC.x,z-VOLC.z)>VOLC.cr+6&&!drkLava(x,z)&&riverDist(x,z)[0]>riverDist(x,z)[1]+2&&drkPathDist(x,z)>clear&&Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)>26&&Math.hypot(x-DRK_EXIT.x,z-DRK_EXIT.z)>18&&Math.hypot(x-VOLC_DOOR.x,z-VOLC_DOOR.z)>12;
  /* verkoolde bomen, lavabomen en basaltblokken (instanced + LOD) */
  const deadL=[],lavaL=[],rockL=[];
  for(let i=0;i<2400&&deadL.length<150;i++){const x=DRK.x-160+R()*320,z=DRK.z-160+R()*320;if(ok(x,z)&&Math.hypot(x-VOLC.x,z-VOLC.z)>VOLC.r*.8&&(fbm(x*.02,z*.02)>.45||R()<.15))deadL.push([x,z,.8+R()*.6,R()*6.28])}
  for(let i=0;i<2400&&lavaL.length<60;i++){const x=DRK.x-160+R()*320,z=DRK.z-160+R()*320;const[rd,rw]=riverDist(x,z);if(ok(x,z,4)&&rd<rw+11)lavaL.push([x,z,.8+R()*.7,R()*6.28])}
  for(let i=0;i<3000&&rockL.length<240;i++){const x=DRK.x-165+R()*330,z=DRK.z-165+R()*330;if(ok(x,z,3.5))rockL.push([x,z,.6+R()*2.2,R()*6.28])}
  const dark=new THREE.Color(.42,.38,.36),char=new THREE.Color(.5,.42,.38);
  jobs.push(envInstances(['CommonTree_Dead_3','CommonTree_Dead_4','CommonTree_Dead_5','BirchTree_Dead_1','BirchTree_Dead_2','Willow_Dead_3'],deadL,(t,i)=>i,(t,bb)=>{const k=6.2*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},true,char));
  jobs.push(envInstances(['Tree_Lava_1','Tree_Lava_2','Tree_Lava_3'],lavaL,(t,i)=>i,(t,bb)=>{const k=5*t[2]/(bb.max.y-bb.min.y);return[k,k,k]}));
  jobs.push(envInstances(['Rock_1','Rock_2','Rock_3','Rock_4','Rock_5','Rock_6','Rock_7'],rockL,(t,i)=>Math.floor(t[2]*31+i),(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=2*t[2]/w;return[k,k*.85,k]},true,dark));
  for(const t of deadL)addCol(t[0],t[1],.45*t[2]);for(const t of lavaL)addCol(t[0],t[1],.5*t[2]);for(const t of rockL)if(t[2]>1)addCol(t[0],t[1],.75*t[2]);
  const BONE=new THREE.Color(.78,.7,.58);
  const P=(n,x,z,ry,s,par=scene,y=0)=>jobs.push(envPlace(n,x,z,ry,sz=>[s,s,s],par,y).then(o=>{if(/Skull|Bones/.test(n))tintObj(o,BONE);return o}));
  /* botten en drakenschedels over de vlakte */
  for(let i=0,t=0;i<26&&t<600;t++){const x=DRK.x-150+R()*300,z=DRK.z-150+R()*300;if(!ok(x,z,4))continue;P('D_Bones',x,z,R()*6.28,1.6+R()*.8);i++}
  for(const[u,v,s,ry]of[[-95,-40,3.6,.4],[40,120,4.2,2.2],[110,40,3.4,-1.2],[-40,-140,3.8,1],[130,-120,3.2,2.8]]){const x=DRK.x+u,z=DRK.z+v;P('D_Skull',x,z,ry,s);addCol(x,z,1.6)}
  /* drakennesten (zuid) met eieren */
    for(const[u,v]of[[-30,112],[22,132],[60,104],[-60,140]]){const x=DRK.x+u,z=DRK.z+v,y=drkH(x,z);for(let k=0;k<9;k++){const a=k/9*6.28;P(k%2?'Rock_6':'Rock_7',x+Math.cos(a)*3.2,z+Math.sin(a)*3.2,a,.9)}
    P('D_Bones',x,z,R()*6,1.2);addCol(x,z,2.2);addLight(x,y+1.5,z,0xff6a20,10,8,true)}
  /* schrijnen van de drakenpriesters (oost) */
  for(const[u,v]of[[110,-40],[140,10],[100,40]]){const x=DRK.x+u,z=DRK.z+v,y=drkH(x,z);P('D_Pedestal',x,z,0,2.2);for(let k=0;k<6;k++){const a=k/6*6.28;P('D_Column2',x+Math.cos(a)*6,z+Math.sin(a)*6,a,1.6);addCol(x+Math.cos(a)*6,z+Math.sin(a)*6,.7)}
    addFlame(scene,x,y+2.6,z,2.4,0xff5a10);addLight(x,y+3,z,0xff6a20,30,18);addCol(x,z,1.4)}
  /* Drakenjagerskamp: vuur, tenten, banieren, toortsen, kisten */
  {const cx=DRK_CAMP.x,cz=DRK_CAMP.z,y=drkH(cx,cz);P('D_Woodfire',cx,cz,0,1.6);addFlame(scene,cx,y+.7,cz,2.6,0xff8a30);addLight(cx,y+2,cz,0xffa050,34,18);addCol(cx,cz,1.2);
    const tc=[new THREE.Color(1,.55,.45),new THREE.Color(.6,.7,1),new THREE.Color(1,.85,.6)];for(let k=0;k<3;k++){const a=-1.4+k*1.1,tx=cx+Math.cos(a)*11,tz=cz+Math.sin(a)*11;jobs.push(envPlace('S_Tent',tx,tz,a+Math.PI/2,()=>[.24,.24,.24]).then(o=>tintObj(o,tc[k])));addCol(tx,tz,2.6)}
    for(const[a,d]of[[2.2,9],[3.4,10],[.4,14],[4.4,13]]){P('D_Torch',cx+Math.cos(a)*d,cz+Math.sin(a)*d,a,1.5);addFlame(scene,cx+Math.cos(a)*d,drkH(cx+Math.cos(a)*d,cz+Math.sin(a)*d)+2.1,cz+Math.sin(a)*d,1.1);addLight(cx+Math.cos(a)*d,drkH(cx,cz)+2.4,cz+Math.sin(a)*d,0xffa040,16,12)}
    for(const[a,d]of[[1.6,15],[2.8,15]])P('D_Banner',cx+Math.cos(a)*d,cz+Math.sin(a)*d,a+Math.PI,2);
    for(let k=0;k<4;k++)P(k%2?'Barrel':'Crate',cx-6+k*1.3,cz-12,R()*3,1)}
  /* poorten: Drakenpas (Zilverdal), terugpoort en de vulkaandeur */
  for(const k in DRK_ARCH){const{x:px,z:pz,s,skull}=DRK_ARCH[k];P('D_Arch',px,pz,Math.PI/2,s);for(const sd of[-1,1])jobs.push(envPlace('D_Column',px,pz+sd*(2.05*s+1.4),0,()=>[1.2,1.5,1.2]).then(o=>{if(o)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.vertexColors=false;m.material.color.setHex(0x6e5244)}})}));if(skull)P('D_Skull',px+.6,pz,-Math.PI/2,2.4,scene,6.6*s/2.6)}
  /* het Hart van de Vulkaan: zuilen rond de drakenhal, de drakenschat en banieren */
  {const H=D3_HALL;for(let k=0;k<12;k++){const a=k/12*6.28;const x=H.x+Math.cos(a)*44,z=H.z+Math.sin(a)*21;if(D3.cell(x,z)!=='.'||Math.abs(Math.sin(a))>.9&&Math.cos(a)>-.2&&Math.sin(a)>0)continue;P('D_Column',x,z,a,1.5);addCol(x,z,.8);addFlame(scene,x,4.2,z,1.6,0xff7a20)}
    const[tx,tz]=D3.pos(12,1);for(let k=0;k<3;k++)P('D_Chest_Gold',tx-6+k*6,tz+1,Math.PI,1.6);for(let k=0;k<7;k++)P('D_Coin_Pile',tx-9+k*3,tz+3+(k%2)*1.5,R()*6,2.2);
    for(let k=0;k<8;k++){const x=H.x+R()*40-20,z=H.z+R()*24-12;if(D3.cell(x,z)==='.')P('D_Bones',x,z,R()*6,1.8)}
}
  await Promise.all(jobs)}
/* ---- per frame: lava laten stromen ---- */
function updDrakeWorld(dt){LAVA_TEX.offset.y-=dt*.035;LAVA_TEX.offset.x+=dt*.004}
