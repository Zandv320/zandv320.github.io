
/* ===================== renderer & scene ===================== */
const canvas=$('#c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isTouch||devicePixelRatio<2,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.5:1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(58,1,.15,1000);
const FOG_DAY=new THREE.Color(0xb4cde4),FOG_DUN=new THREE.Color(0x0a080d),FOG_D2=new THREE.Color(0x1a0a06);
scene.fog=new THREE.Fog(FOG_DAY.clone(),70,340);
scene.background=FOG_DAY.clone();
const hemi=new THREE.HemisphereLight(0xd6e8ff,0x5a4a2a,1.0);scene.add(hemi);
const fill=new THREE.DirectionalLight(0x8fb4ff,.55);fill.position.set(-70,40,-50);scene.add(fill);
const sun=new THREE.DirectionalLight(0xfff0d4,2.4);sun.position.set(60,95,35);sun.castShadow=true;
sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
{const s=sun.shadow.camera;s.left=-42;s.right=42;s.top=42;s.bottom=-42;s.near=1;s.far=300}
sun.shadow.bias=-.0004;sun.shadow.normalBias=.06;sun.shadow.radius=3;scene.add(sun);scene.add(sun.target);
const SUN_OFF=new THREE.Vector3(60,95,35);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
/* omgevingsocclusie (GTAO): zachte contactschaduw in hoeken, onder karakters en tussen huizen */
const gtao=new GTAOPass(scene,camera,innerWidth,innerHeight);gtao.output=GTAOPass.OUTPUT.Default;gtao.blendIntensity=.85;
gtao.updateGtaoMaterial({radius:.6,distanceExponent:1.5,thickness:1.2,scale:1.1,samples:12,distanceFallOff:1,screenSpaceRadius:false});gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:12});composer.addPass(gtao);
/* GTAO without a second scene render: the AO reads the depth the main render already wrote (a depth texture on the
   composer's buffers) and rebuilds the normals from it. Before, the whole scene was drawn twice per frame (once more
   with a normal material); for a flat-shaded world the rebuilt normals are the same faces. */
{for(const rt of[composer.renderTarget1,composer.renderTarget2]){rt.depthTexture=new THREE.DepthTexture(rt.width,rt.height);rt.depthTexture.type=THREE.UnsignedIntType}
  gtao._renderGBuffer=false;for(const m of[gtao.gtaoMaterial,gtao.pdMaterial]){m.defines.NORMAL_VECTOR_TYPE=0;m.defines.DEPTH_SWIZZLING='x';m.uniforms.tNormal.value=null;m.needsUpdate=true}
  const _gr=gtao.render.bind(gtao);gtao.render=(r,wb,rb,...x)=>{const d=rb.depthTexture;if(d&&gtao.gtaoMaterial.uniforms.tDepth.value!==d){gtao.gtaoMaterial.uniforms.tDepth.value=d;gtao.pdMaterial.uniforms.tDepth.value=d}return _gr(r,wb,rb,...x)}}
const bloom=new UnrealBloomPass(new THREE.Vector2(512,512),.36,.5,.9);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},sat:{value:1.12},vig:{value:.34}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float sat,vig;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float l=dot(c.rgb,vec3(.299,.587,.114));c.rgb=mix(vec3(l),c.rgb,sat);c.rgb=(c.rgb-.5)*1.05+.5;float d=distance(vUv,vec2(.5));c.rgb*=1.-smoothstep(.42,.95,d)*vig;gl_FragColor=c;}'});composer.addPass(grade);composer.addPass(new OutputPass());const smaa=new SMAAPass(innerWidth,innerHeight);composer.addPass(smaa);

const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{top:{value:new THREE.Color(0x2f66c0)},hor:{value:new THREE.Color(0xcfe2f2)},sunDir:{value:SUN_OFF.clone().normalize()},sunCol:{value:new THREE.Color(1,.86,.62)},moonDir:{value:new THREE.Vector3(0,1,0)},night:{value:0},dun:{value:0},rift:{value:0},time:{value:0}},
  vertexShader:'varying vec3 vP;void main(){vP=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}',
  fragmentShader:'uniform vec3 top,hor,sunDir,sunCol,moonDir;uniform float dun,night,rift,time;varying vec3 vP;float hsh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,top,pow(h,.45));float s=max(dot(vP,sunDir),0.);c+=sunCol*pow(s,300.)*2.2+sunCol*pow(s,8.)*.35*(1.-night*.6);float m=max(dot(vP,moonDir),0.);c+=vec3(.85,.9,1.)*pow(m,900.)*1.6*night+vec3(.5,.6,.9)*pow(m,12.)*.12*night;vec3 cell=floor(vP*140.);float st=step(.9965,hsh(cell))*smoothstep(0.,.25,vP.y)*night;c+=vec3(st)*(.5+.5*hsh(cell+1.));if(vP.y<0.)c=hor;c=mix(c,vec3(.004,.003,.006),dun);if(rift>0.){vec3 d=vP;float n=0.,am=.5;vec3 q=d*2.2+vec3(time*.004,0.,0.);for(int i=0;i<4;i++){vec3 f=fract(q),w=floor(q);f=f*f*(3.-2.*f);float v=mix(mix(mix(hsh(w),hsh(w+vec3(1,0,0)),f.x),mix(hsh(w+vec3(0,1,0)),hsh(w+vec3(1,1,0)),f.x),f.y),mix(mix(hsh(w+vec3(0,0,1)),hsh(w+vec3(1,0,1)),f.x),mix(hsh(w+vec3(0,1,1)),hsh(w+vec3(1,1,1)),f.x),f.y),f.z);n+=v*am;q*=2.1;am*=.5;}vec3 nc=mix(vec3(.03,.015,.07),vec3(.32,.1,.5),smoothstep(.38,.8,n));nc=mix(nc,vec3(.08,.42,.5),smoothstep(.62,.85,n)*.6);nc+=vec3(1.,.5,.9)*pow(max(0.,1.-abs(d.y-.25-.12*sin(d.x*3.+d.z*2.))*9.),3.)*.35*smoothstep(-.2,.5,d.x);vec3 cl=floor(d*220.);float st2=step(.992,hsh(cl))*(.4+.6*hsh(cl+2.));nc+=vec3(.9,.85,1.)*st2;c=mix(c,nc,rift);}gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,32,16),skyMat);sky.renderOrder=-1;scene.add(sky);

/* ---------- procedural textures ---------- */
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t}
const R0=mulberry(1234);
const TEX={
  grain:canvasTex(512,512,(g,w,h)=>{g.fillStyle='#c8c8c8';g.fillRect(0,0,w,h);for(let i=0;i<2600;i++){const v=150+R0()*105,x=R0()*w,y=R0()*h,a=10+R0()*26,b=4+R0()*9,r=R0()*3.14;g.fillStyle=`rgba(${v},${v},${v},.5)`;for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();g.ellipse(x+ox,y+oy,a,b,r,0,7);g.fill()}}for(let i=0;i<9000;i++){const v=120+R0()*140;g.fillStyle=`rgba(${v},${v},${v},.35)`;g.fillRect(R0()*w,R0()*h,2,3)}}),
  brick:canvasTex(256,256,(g,w,h)=>{g.fillStyle='#4a4640';g.fillRect(0,0,w,h);const bh=32;for(let r=0;r<h/bh;r++){const off=(r%2)*32;for(let c=-1;c<w/64+1;c++){const v=110+R0()*60;g.fillStyle=`rgb(${v},${v*.96},${v*.9})`;g.fillRect(c*64+off+2,r*bh+2,60,bh-4);g.fillStyle='rgba(0,0,0,.12)';for(let k=0;k<6;k++)g.fillRect(c*64+off+2+R0()*56,r*bh+2+R0()*24,4,3)}}}),
  tile:canvasTex(256,256,(g,w,h)=>{g.fillStyle='#3a3732';g.fillRect(0,0,w,h);for(let r=0;r<4;r++)for(let c=0;c<4;c++){const v=95+R0()*45;g.fillStyle=`rgb(${v},${v*.97},${v*.92})`;g.fillRect(c*64+2,r*64+2,60,60);g.strokeStyle='rgba(0,0,0,.25)';g.beginPath();g.moveTo(c*64+R0()*60,r*64+2);g.lineTo(c*64+R0()*60,r*64+62);g.stroke()}}),
  cobble:canvasTex(256,256,(g,w,h)=>{g.fillStyle='#5f5952';g.fillRect(0,0,w,h);for(let i=0;i<150;i++){const v=135+R0()*50,x=R0()*w,y=R0()*h,a=9+R0()*7,b=7+R0()*5,r=R0()*3;g.fillStyle=`rgb(${v},${v*.95},${v*.88})`;for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();g.ellipse(x+ox,y+oy,a,b,r,0,7);g.fill()}}}),
  shingle:canvasTex(128,128,(g,w,h)=>{g.fillStyle='#fff';g.fillRect(0,0,w,h);for(let r=0;r<8;r++)for(let c=0;c<9;c++){const v=170+R0()*85;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(c*16-(r%2)*8,r*16,15,14);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(c*16-(r%2)*8,r*16+12,15,3)}}),
  wood:canvasTex(128,128,(g,w,h)=>{for(let x=0;x<w;x+=16){const v=150+R0()*80;g.fillStyle=`rgb(${v},${v},${v})`;g.fillRect(x,0,16,h);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,0,1,h);for(let k=0;k<8;k++){g.fillStyle='rgba(0,0,0,.08)';g.fillRect(x+2+R0()*12,R0()*h,1,20+R0()*40)}}}),
  plaster:canvasTex(128,128,(g,w,h)=>{const d=g.createImageData(w,h);for(let i=0;i<w*h;i++){const v=225+fbm((i%w)*.2,Math.floor(i/w)*.2)*30+R0()*8;d.data[i*4]=v;d.data[i*4+1]=v;d.data[i*4+2]=v;d.data[i*4+3]=255}g.putImageData(d,0,0)}),
  /* 'hand-painted' penseelstreken voor het terrein: zachte ellipsen in warme/koele tinten, vermenigvuldigd met de vertexkleur */
  paint:canvasTex(1024,1024,(g,w,h)=>{g.fillStyle='#bdbdb8';g.fillRect(0,0,w,h);
    for(let i=0;i<5200;i++){const v=165+R0()*95,x=R0()*w,y=R0()*h,a=14+R0()*44,b=5+R0()*14,r=R0()*3.14,warm=R0()<.5;const col=warm?`rgba(${v},${v*.97},${v*.86},.55)`:`rgba(${v*.9},${v*.98},${v},.55)`;g.fillStyle=col;for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();g.ellipse(x+ox,y+oy,a,b,r,0,7);g.fill()}}
    for(let i=0;i<2600;i++){const v=200+R0()*55,x=R0()*w,y=R0()*h,a=3+R0()*9,b=1.2+R0()*2.2,r=-.6+R0()*1.2;g.fillStyle=`rgba(${v},${v},${v*.92},.5)`;for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();g.ellipse(x+ox,y+oy,b,a,r,0,7);g.fill()}}
    for(let i=0;i<1400;i++){const v=120+R0()*60,x=R0()*w,y=R0()*h,a=6+R0()*18,b=3+R0()*7,r=R0()*3.14;g.fillStyle=`rgba(${v},${v*1.02},${v*.9},.35)`;for(const ox of[-w,0,w])for(const oy of[-h,0,h]){g.beginPath();g.ellipse(x+ox,y+oy,a,b,r,0,7);g.fill()}}}),
  stripe:canvasTex(64,64,(g,w,h)=>{for(let i=0;i<4;i++){g.fillStyle=i%2?'#fff':'#c9c9c9';g.fillRect(i*16,0,16,h)}})
};
const matCache=new Map();const NIGHT_MATS=new Set();
/* toon ramp: four hard light steps, WoW-achtig */
const RAMP=(()=>{const d=new Uint8Array([70,120,185,255]);const t=new THREE.DataTexture(d,4,1,THREE.RedFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t})();
const BUMPY={brick:.08,cobble:.1,wood:.05,tile:.06,plaster:.03,shingle:.06,grain:.02};
function mat(color,o={}){const k=color+'|'+JSON.stringify(o);let m=matCache.get(k);if(!m){const p={color,gradientMap:RAMP};if(o.e)p.emissive=new THREE.Color(o.e),p.emissiveIntensity=o.ei??1;if(o.m>=.6){p.color=new THREE.Color(color).lerp(new THREE.Color(0xffffff),.12).getHex();p.emissive=p.emissive||new THREE.Color(color).multiplyScalar(.12);p.emissiveIntensity=p.emissiveIntensity||1}
  if(o.tex){const t=TEX[o.tex].clone();t.needsUpdate=true;t.repeat.set(o.rx||1,o.ry||1);p.map=t;if(BUMPY[o.tex]){p.bumpMap=t;p.bumpScale=BUMPY[o.tex]}}
  if(o.t)p.transparent=true,p.opacity=o.t,p.depthWrite=false;if(o.side)p.side=THREE.DoubleSide;m=new THREE.MeshToonMaterial(p);m.flatShading=o.tex?false:(o.flat??true);matCache.set(k,m)}return m}
const OUTLINE_M=new THREE.MeshBasicMaterial({color:0x1a120c,side:THREE.BackSide});
function outline(g,w=.045){return;const add=[];g.traverse(m=>{if(!m.isMesh||m.userData.noOutline||m.material===OUTLINE_M||(m.material.isMeshBasicMaterial)||(m.material.emissiveIntensity||0)>1.5)return;add.push(m)});
  for(const m of add){const o=new THREE.Mesh(m.geometry,OUTLINE_M);m.geometry.computeBoundingSphere();const r=Math.max(.05,m.geometry.boundingSphere.radius);const sx=m.scale.x||1,sy=m.scale.y||1,sz=m.scale.z||1;o.scale.set(1+w/(r*sx),1+w/(r*sy),1+w/(r*sz));o.castShadow=false;o.receiveShadow=false;o.userData.outline=1;m.add(o)}}
/* PROC: label voor procedurele onderdelen die later door gedownloade modellen vervangen worden (zie 2e_visual.js) */
let PROC=null;
function mesh(geo,m,x=0,y=0,z=0,par=null,cast=true,recv=true){const o=new THREE.Mesh(geo,m);if(PROC)o.userData.proc=PROC;o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=recv;if(par)par.add(o);return o}

/* ---------- height field ---------- */
const WSIZE=640,SEG=200,CELL=WSIZE/SEG,HN=SEG+1;
const LAKE={x:-150,z:60,r:46};
const PATHS=[[[0,86],[44,84],[84,80],[150,88],[228,100],[262,104]],[[0,0],[0,-60],[-12,-120],[-80,-178],[-158,-204]],[[0,0],[62,-32],[128,-88],[176,-140],[200,-168]],[[0,0],[0,70],[8,140]],[[0,0],[-62,22],[-104,44]],
  /* arena road (east gate) and the lane to the Artisans' Yard */[[0,0],[62,12],[80,30],[97,36]],[[-84,33],[-96,14],[-100,8]]];
function segDist(px,pz,ax,az,bx,bz){const dx=bx-ax,dz=bz-az,t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(px-ax-dx*t,pz-az-dz*t)}
function pathDist(x,z){let m=1e9;for(const p of PATHS)for(let i=0;i<p.length-1;i++){const d=segDist(x,z,p[i][0],p[i][1],p[i+1][0],p[i+1][1]);if(d<m)m=d}return m}
const CRAFT={x:-108,z:-6,r:15};/* Artisans' Yard: smithy, tannery, loom and sawmill west of town */
const ARENA={x:126,z:36,r:17};const TOWN={x:0,z:0,r:74,wall:74},CAMP={x:150,z:-100,r:26},CRYPT={x:-172,z:-222},FARM={x:10,z:125},CAVE={x:206,z:-182};
function baseH(x,z){
  let h=(fbm(x*.011+3.1,z*.011+7.7)-.5)*16+(fbm(x*.045,z*.045)-.5)*3;
  h+=Math.max(0,1-Math.hypot(x+180,z+240)/95)**1.3*22;
  h+=Math.max(0,1-Math.hypot(x-200,z+190)/90)*14;
  const e=Math.max(Math.abs(x),Math.abs(z));if(e>235)h+=(e-235)*.26;
  return h}
/* park pond inside Silverbrook (south-west) */
const POND={x:-38,z:46,r:8.5};function pondDist(x,z){return Math.max(0,Math.hypot((x-POND.x)/1.25,z-POND.z)-POND.r)}
const FLAT=[{x:0,z:0,r:104,h:1.2,in:80},{x:CAMP.x,z:CAMP.z,r:34},{x:CRYPT.x,z:CRYPT.z+4,r:20},{x:FARM.x,z:FARM.z,r:52},{x:CAVE.x-4,z:CAVE.z+10,r:22},{x:219,z:100,r:18},{x:CRAFT.x,z:CRAFT.z,r:CRAFT.r+5},{x:ARENA.x,z:ARENA.z,r:48,in:38}];
for(const f of FLAT)if(f.h==null)f.h=baseH(f.x,f.z);
function rawH(x,z){
  let h=baseH(x,z);
  const pd=pathDist(x,z);if(pd<9)h=lerp(h*.55+.3,h,smooth(pd/9));
  for(const f of FLAT){const d=Math.hypot(x-f.x,z-f.z);if(d<f.r){const i0=f.in??f.r*.65;h=lerp(f.h,h,smooth(clamp((d-i0)/(f.r-i0),0,1)))}}
  {const pd2=pondDist(x,z);if(pd2<3)h=lerp(h,-.9,smooth(clamp(1-pd2/3,0,1)))}
  const ld=Math.hypot(x-LAKE.x,z-LAKE.z)/LAKE.r;if(ld<1.5)h=lerp(-4.5,h,smooth(clamp((ld-.5)/1,0,1)));
  return h}
const HM=new Float32Array(HN*HN);
for(let i=0;i<HN;i++)for(let j=0;j<HN;j++)HM[i*HN+j]=rawH(-WSIZE/2+j*CELL,-WSIZE/2+i*CELL);
const DUN={x:1000,z:0,c:6};
function groundH(x,z){
  if(x>700)return 0;if(x<-5000)return riftH(x,z);if(x<-2600)return elvH(x,z);if(x<-1000)return drkH(x,z);
  const fx=clamp((x+WSIZE/2)/CELL,0,SEG-.001),fz=clamp((z+WSIZE/2)/CELL,0,SEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;
  const a=HM[i*HN+j],b=HM[i*HN+j+1],c=HM[(i+1)*HN+j],d=HM[(i+1)*HN+j+1];
  return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
function inForest(x,z){return z<-52&&z>-262&&x<112&&x>-250}
function zoneAt(x,z){
  if(x>2800)return D5.name;if(x>2200)return'Thornroot Hollow';if(x>1700)return'Heart of the Volcano';if(x<-5000)return riftZone(x,z);if(x<-2600)return elvZone(x,z);if(x<-1000)return drkZone(x,z);if(x>1250)return'Ignaroth\'s Fire Cave';if(x>700)return'Crypt of Kaal-Morath';
  if(Math.hypot(x-CAVE.x,z-CAVE.z)<60)return'Ashen Hills';if(x>196&&Math.abs(z-100)<26)return'Dragon Pass';
  if(Math.hypot((x-ARENA.x)/1.0,(z-ARENA.z)/1.09)<ARENA.r+14)return'Arena of Silverbrook';
  if(Math.hypot(x-CRAFT.x,z-CRAFT.z)<CRAFT.r+4)return"Artisans' Yard";
  if(Math.hypot(x,z)<TOWN.wall+4)return'Silverbrook';
  if(Math.hypot(x-CRYPT.x,z-CRYPT.z)<70)return'Bone Hills';
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<75)return'Mirror Lake';
  if(x>105&&z<-20)return'Bandit Heath';
  if(inForest(x,z))return'Twilight Wood';
  if(z>60)return'Golden Fields';
  return'Silverdale'}

/* ---------- terrain mesh ---------- */
const terrain=(()=>{
  const geo=new THREE.PlaneGeometry(WSIZE,WSIZE,SEG,SEG);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3),c=new THREE.Color(),t=new THREE.Color();
  const PONDB=new THREE.Color(0x24463e),MUD=new THREE.Color(0x6f6a45),G1=new THREE.Color(0x5e8f36),G2=new THREE.Color(0x86ad48),F1=new THREE.Color(0x3c5e26),F2=new THREE.Color(0x4f5f2a),DIRT=new THREE.Color(0x8d7351),SAND=new THREE.Color(0xc8b27e),ROCK=new THREE.Color(0x77736a),HEATH=new THREE.Color(0x9c9a52),COB=new THREE.Color(0x8e877a),DEAD=new THREE.Color(0x5d5a40),FIELD=new THREE.Color(0x7a6a3a),ASH=new THREE.Color(0x5a4a42);
  for(let k=0;k<pos.count;k++){
    const i=Math.floor(k/HN),j=k%HN,x=-WSIZE/2+j*CELL,z=-WSIZE/2+i*CELL,h=HM[k];pos.setY(k,h);
    const n=fbm(x*.05,z*.05),n2=vnoise(x*.3,z*.3);
    c.copy(G1).lerp(G2,n);
    if(inForest(x,z)){t.copy(F1).lerp(F2,n2);c.lerp(t,smooth(clamp((-52-z)/14,0,1)))}
    if(x>100&&z<-10){t.copy(HEATH).lerp(G2,n2*.5);c.lerp(t,smooth(clamp((x-100)/30,0,1))*.8)}
    const cd=Math.hypot(x-CRYPT.x,z-CRYPT.z);if(cd<60)c.lerp(DEAD,smooth(1-cd/60)*.9);const vd=Math.hypot(x-CAVE.x,z-CAVE.z);if(vd<70)c.lerp(ASH,smooth(1-vd/70)*.85);
    if(Math.abs(x-FARM.x+5)<46&&z>92&&z<165&&((Math.floor((x+200)/9))%2===0))c.lerp(FIELD,.65);
    const hx=HM[i*HN+Math.min(j+1,SEG)]-h,hz=HM[Math.min(i+1,SEG)*HN+j]-h,slope=Math.hypot(hx,hz)/CELL;
    if(slope>.55||h>26)c.lerp(ROCK,clamp((slope-.45)*2.5+(h>26?(h-26)/10:0),0,1));
    const pd=pathDist(x,z);if(pd<4.2)c.lerp(Math.hypot(x,z)<TOWN.wall?COB:DIRT,smooth(clamp(1-(pd-2)/2.2,0,1))*.9);
    if(h<.2&&Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.6)c.lerp(SAND,clamp((.2-h)/1.2,0,1));
    const td=Math.hypot(x,z);if(td<24)c.lerp(COB,smooth(clamp((24-td)/3,0,1)));if(td<TOWN.wall){const pdd=pondDist(x,z);if(pdd<2.5)c.lerp(MUD,smooth(clamp(1-pdd/2.5,0,1))*.6);if(h<.5)c.lerp(PONDB,clamp((.5-h)/.8,0,1))}
    const jit=.92+hash(i,j)*.16;col[k*3]=c.r*jit;col[k*3+1]=c.g*jit;col[k*3+2]=c.b*jit}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
  const tex=TEX.paint.clone();tex.needsUpdate=true;tex.repeat.set(36,36);
  const m=new THREE.Mesh(geo,new THREE.MeshToonMaterial({vertexColors:true,map:tex,bumpMap:tex,bumpScale:.08,gradientMap:RAMP}));m.receiveShadow=true;scene.add(m);return m})();
/* plaza cobbles */
{const g=new THREE.CircleGeometry(23,56);g.rotateX(-Math.PI/2);mesh(g,mat(0xc8c0b0,{tex:'cobble',rx:18,ry:18}),0,1.23,0,scene,false,true)}
/* water: eigen shader met golvende normalen, fresnel-reflectie van de lucht, zonneglans en schuim langs de oever */
/* ---------- portals: an arch-shaped swirl of light (gate to the Dragon Realm, crypt and dungeon doors) ---------- */
const PORTAL_U={time:{value:0}};
const PORTAL_VS='varying vec2 vU;void main(){vU=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const PORTAL_NOISE='float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n1(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1.,0.)),f.x),mix(h1(i+vec2(0.,1.)),h1(i+vec2(1.,1.)),f.x),f.y);}'+
  'float archD(vec2 p){return p.y>.25?length(vec2(p.x,p.y-.25)):abs(p.x);}';
/* D_Arch (KayKit Dungeon): the opening is 1.12 wide each side of the centre, straight up to 1.92 and then a half circle */
const ARCH_HW=1.12,ARCH_SH=1.92;
function portalMat(col,hw,sh){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
  uniforms:{time:PORTAL_U.time,col:{value:new THREE.Color(col)},hw:{value:hw},sh:{value:sh}},vertexShader:PORTAL_VS,
  fragmentShader:'uniform float time,hw,sh;uniform vec3 col;varying vec2 vU;'+PORTAL_NOISE+`void main(){float H=sh+hw;float x=(vU.x-.5)*2.*hw,y=vU.y*H;
    float d=y>sh?length(vec2(x,y-sh)):abs(x);float m=1.-smoothstep(hw*.94,hw,d);if(m<=0.)discard;
    vec2 p=vec2(x,y-H*.46)/hw;float r=length(p),a=atan(p.y,p.x);
    float s=n1(vec2(a*2.2+time*.7+r*3.,r*3.-time*1.6))*.65+n1(vec2(a*5.-time*1.1,r*7.-time*2.4))*.35;
    float rim=smoothstep(hw*.7,hw,d);float core=pow(max(0.,1.-r*.55),3.);float ring=smoothstep(.55,1.,sin(r*8.-time*3.))*(1.-min(r,1.)*.6);
    vec3 c=mix(col*.1,col*(.45+s*1.05),.5+.5*s)+col*rim*1.5+col*ring*.3+vec3(1.)*core*.25*(.75+.25*sin(time*2.));
    gl_FragColor=vec4(c,m*(.86+.14*s));}`})}
/* a portal that exactly fills the opening of a D_Arch of scale s, standing on the ground at (x,y,z) */
function portalMesh(col,s,x,y,z,ry,par=scene){const hw=ARCH_HW*s*.985,sh=ARCH_SH*s;const g=new THREE.PlaneGeometry(2*hw,sh+hw);g.translate(0,(sh+hw)/2,0);
  const m=mesh(g,portalMat(col,hw,sh),x,y-.05,z,par,false,false);delete m.userData.proc;m.rotation.y=ry;m.userData.dyn=1;m.userData.portal={col,hw,sh};PORTALS.push(m);return m}
const PORTALS=[];
/* the dark mouth of a cave: black, with an ember glow breathing up from below */
function caveMouthMat(col){return new THREE.ShaderMaterial({transparent:true,depthWrite:true,side:THREE.DoubleSide,
  uniforms:{time:PORTAL_U.time,col:{value:new THREE.Color(col)}},vertexShader:PORTAL_VS,
  fragmentShader:'uniform float time;uniform vec3 col;varying vec2 vU;'+PORTAL_NOISE+`void main(){vec2 p=vU*2.-1.;p.y*=1.25;float d=archD(p);float m=1.-smoothstep(.9,1.,d);if(m<=.01)discard;
    float g=pow(1.-vU.y,2.2)*(.75+.25*sin(time*3.1)+.12*n1(vec2(vU.x*6.,time*2.)));float depth=smoothstep(1.,.2,d);
    vec3 c=col*g*.9*depth+col*.05;gl_FragColor=vec4(c,m);}`})}
const waterMat=new THREE.ShaderMaterial({transparent:true,fog:true,
  uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0},deep:{value:new THREE.Color(0x1d4f6e)},shallow:{value:new THREE.Color(0x3f8fb0)},skyCol:{value:new THREE.Color(0xcfe2f2)},sunDir:{value:new THREE.Vector3(.5,.8,.3)},sunCol:{value:new THREE.Color(1,.9,.7)},night:{value:0},radius:{value:1}}]),
  vertexShader:`#include <fog_pars_vertex>
    uniform float time;attribute float dep;varying vec3 vW;varying vec2 vUv2;varying float vH;varying float vDep;
    float wave(vec2 p,vec2 d,float f,float sp){return sin(dot(p,d)*f+time*sp);}
    void main(){vec3 p=position;vec2 q=p.xz;float h=wave(q,vec2(1.,.3),.55,1.4)*.06+wave(q,vec2(-.4,1.),.9,1.9)*.04+wave(q,vec2(.7,-.8),1.7,2.6)*.02;p.y+=h;vH=h;vDep=dep;vW=(modelMatrix*vec4(p,1.)).xyz;vUv2=q;
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader:`#include <fog_pars_fragment>
    uniform float time,night,radius;uniform vec3 deep,shallow,skyCol,sunDir,sunCol;varying vec3 vW;varying vec2 vUv2;varying float vH;varying float vDep;
    vec3 nrm(vec2 q){float e=.15;float h0=sin(dot(q,vec2(1.,.3))*.55+time*1.4)*.06+sin(dot(q,vec2(-.4,1.))*.9+time*1.9)*.04+sin(dot(q,vec2(.7,-.8))*1.7+time*2.6)*.02+sin(dot(q,vec2(2.3,1.7))*1.6+time*3.2)*.004;
      float hx=sin(dot(q+vec2(e,0.),vec2(1.,.3))*.55+time*1.4)*.06+sin(dot(q+vec2(e,0.),vec2(-.4,1.))*.9+time*1.9)*.04+sin(dot(q+vec2(e,0.),vec2(.7,-.8))*1.7+time*2.6)*.02+sin(dot(q+vec2(e,0.),vec2(2.3,1.7))*1.6+time*3.2)*.004;
      float hz=sin(dot(q+vec2(0.,e),vec2(1.,.3))*.55+time*1.4)*.06+sin(dot(q+vec2(0.,e),vec2(-.4,1.))*.9+time*1.9)*.04+sin(dot(q+vec2(0.,e),vec2(.7,-.8))*1.7+time*2.6)*.02+sin(dot(q+vec2(0.,e),vec2(2.3,1.7))*1.6+time*3.2)*.004;
      return normalize(vec3(-(hx-h0)/e*1.1,1.,-(hz-h0)/e*1.1));}
    void main(){vec3 n=nrm(vUv2);vec3 v=normalize(cameraPosition-vW);float fres=pow(1.-max(dot(n,v),0.),4.)*.42+.06;
      float d=length(vUv2)/radius;/* 0 midden .. 1 oever */
      vec3 col=mix(deep,shallow,max(smoothstep(.45,1.,d)*.6,smoothstep(2.2,.3,vDep)));
      vec3 h=normalize(sunDir+v);float spec=pow(max(dot(n,h),0.),320.)*1.2+pow(max(dot(n,h),0.),40.)*.08;
      vec3 c=mix(col,skyCol,fres)+sunCol*spec*(1.-night*.7);
      /* schuim langs de echte oever (diepte per vertex) */float fl=.32+sin(vUv2.x*.9+time*1.3)*.06+sin(vUv2.y*1.1-time*1.7)*.05+vH*.8;float foam=smoothstep(fl,0.,vDep)*.85;c=mix(c,vec3(.92,.96,.98),foam*.75);
      /* lichtkringen */float ca=sin(vUv2.x*2.1+time*.9)*sin(vUv2.y*2.4-time*1.1);c+=vec3(.05,.08,.09)*smoothstep(.6,1.,ca)*(1.-d)*(1.-night);
      c*=1.-night*.55;float a=.72+fres*.25+foam*.2;
      gl_FragColor=vec4(c,a);
      #include <fog_fragment>
    }`});
/* water surface as a grid with the water depth per vertex, so foam and colour follow the real shore */
function waterGeo(cx,cz,rx,rz,wy,seg=120){const g=new THREE.PlaneGeometry(rx*2,rz*2,seg,seg);g.rotateX(-Math.PI/2);const p=g.attributes.position,dp=new Float32Array(p.count);
  for(let i=0;i<p.count;i++)dp[i]=wy-groundH(cx+p.getX(i),cz+p.getZ(i));g.setAttribute('dep',new THREE.BufferAttribute(dp,1));
  /* drop the triangles that lie well under the ground, so there is no hidden water far inland */const ix=g.index.array,keep=[];for(let i=0;i<ix.length;i+=3)if(dp[ix[i]]>-.6||dp[ix[i+1]]>-.6||dp[ix[i+2]]>-.6)keep.push(ix[i],ix[i+1],ix[i+2]);g.setIndex(keep);return g}
const water=(()=>{const g=waterGeo(LAKE.x,LAKE.z,LAKE.r*1.3,LAKE.r*1.3,-.7);const m=new THREE.Mesh(g,waterMat);m.position.set(LAKE.x,-.7,LAKE.z);waterMat.uniforms.radius.value=LAKE.r*1.25;m.receiveShadow=false;scene.add(m);return m})();

/* ---------- colliders ---------- */
const CG=new Map(),BOXES=[];
function addCol(x,z,r,tree,cam){const k=Math.floor(x/10)+','+Math.floor(z/10);let a=CG.get(k);if(!a)CG.set(k,a=[]);a.push(cam?{x,z,r,tree,cam}:{x,z,r,tree})}
function camBlocked(x,y,z){if(x>700)return false;const cx=Math.floor(x/10),cz=Math.floor(z/10);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const arr=CG.get((cx+a)+','+(cz+b));if(!arr)continue;for(const c of arr){if(c.cam){if((x-c.x)**2+(z-c.z)**2<(c.r+.4)**2&&y<groundH(c.x,c.z)+c.cam)return true;continue}if(!c.tree)continue;const R=c.tree*c.r;if((x-c.x)**2+(z-c.z)**2<R*R&&y<groundH(c.x,c.z)+c.r*17)return true}}if(typeof ARENA_RX!=='undefined'){const u=(x-ARENA.x)/ARENA_RX,v=(z-ARENA.z)/ARENA_RZ,rn=Math.hypot(u,v);if(rn>1.06&&rn<1.75&&y<ARENA_H+3+(rn-1)*16)return true}for(const b of BOXES)if(x>b.x0-.3&&x<b.x1+.3&&z>b.z0-.3&&z<b.z1+.3&&y<groundH(x,z)+11)return true;return false}
function addBox(x,z,w,d){BOXES.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2})}
function collide(p,r){
  if(p.x>2800){D5.collide(p,r);return}if(p.x>2200){D4.collide(p,r);return}if(p.x>1700){D3.collide(p,r);return}if(p.x>1250){D2.collide(p,r);return}if(p.x>700){dunCollide(p,r);return}
  const cx=Math.floor(p.x/10),cz=Math.floor(p.z/10);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const arr=CG.get((cx+a)+','+(cz+b));if(!arr)continue;for(const c of arr){const dx=p.x-c.x,dz=p.z-c.z,rr=c.r+r,dd=dx*dx+dz*dz;if(dd<rr*rr&&dd>1e-6){const d=Math.sqrt(dd),k=(rr-d)/d;p.x+=dx*k;p.z+=dz*k}}}
  for(const b of BOXES){if(p.x<b.x0-r||p.x>b.x1+r||p.z<b.z0-r||p.z>b.z1+r)continue;const qx=clamp(p.x,b.x0,b.x1),qz=clamp(p.z,b.z0,b.z1),dx=p.x-qx,dz=p.z-qz,dd=dx*dx+dz*dz;
    if(dd>1e-6){const d=Math.sqrt(dd);if(d<r){p.x+=dx/d*(r-d);p.z+=dz/d*(r-d)}}else{const l=p.x-b.x0,rr=b.x1-p.x,t=p.z-b.z0,bb=b.z1-p.z,m=Math.min(l,rr,t,bb);if(m===l)p.x=b.x0-r;else if(m===rr)p.x=b.x1+r;else if(m===t)p.z=b.z0-r;else p.z=b.z1+r}}
  if(p.x<-5000){riftCollide(p,r);return}if(p.x<-2600){elvCollide(p,r);return}if(p.x<-1000){drkCollide(p,r);return}
  p.x=clamp(p.x,-255,255);p.z=clamp(p.z,-262,255);
  if(Math.hypot(p.x-LAKE.x,p.z-LAKE.z)<LAKE.r*.86){const a=Math.atan2(p.z-LAKE.z,p.x-LAKE.x);p.x=LAKE.x+Math.cos(a)*LAKE.r*.86;p.z=LAKE.z+Math.sin(a)*LAKE.r*.86}
}
/* light anchors: a small pool of point lights is assigned to the nearest anchors each frame */
const LANCH=[];
function addLight(x,y,z,color,int,dist,flick=true){LANCH.push({x,y,z,color:new THREE.Color(color),int,dist,flick,ph:Math.random()*10})}
const flames=[];
function addFlame(par,x,y,z,s=1,color=0xffa030){const f=mesh(new THREE.ConeGeometry(.16*s,.5*s,10),new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(2.6),fog:false}),x,y,z,par,false,false);flames.push(f);return f}

/* ---------- vegetation ---------- */
const RV=mulberry(777);
const pineT=[],oakT=[],rockT=[],grassT=[],flowerT=[],deadT=[];
function okSpot(x,z,pathClear=6){return pathDist(x,z)>pathClear&&Math.hypot(x-CRAFT.x,z-CRAFT.z)>CRAFT.r+6&&Math.hypot(x-ARENA.x,z-ARENA.z)>42&&Math.hypot(x-CAVE.x,z-CAVE.z)>26&&Math.hypot(x,z)>TOWN.wall+12&&Math.hypot(x-CAMP.x,z-CAMP.z)>32&&Math.hypot(x-CRYPT.x,z-CRYPT.z)>24&&Math.hypot(x-LAKE.x,z-LAKE.z)>LAKE.r*1.15&&!(Math.abs(x-FARM.x)<56&&Math.abs(z-FARM.z)<44)}
for(let i=0;i<5200;i++){const x=rand(-250,250),z=rand(-262,250);const x2=-250+RV()*500,z2=-262+RV()*512;
  if(inForest(x2,z2)&&okSpot(x2,z2)&&RV()<.62)pineT.push([x2,z2,.8+RV()*.7,RV()*6.28]);
  else if(!inForest(x2,z2)&&okSpot(x2,z2,5)&&RV()<.09&&Math.hypot(x2-CRYPT.x,z2-CRYPT.z)>60)oakT.push([x2,z2,.8+RV()*.6,RV()*6.28]);
  if(Math.hypot(x2-CRYPT.x,z2-CRYPT.z)<60&&okSpot(x2,z2)&&RV()<.06)deadT.push([x2,z2,.8+RV()*.5,RV()*6.28]);
  void x;void z}
for(let i=0;i<420;i++){const x=-250+RV()*500,z=-262+RV()*512;if(okSpot(x,z,4)&&(RV()<.5||x>100))rockT.push([x,z,.5+RV()*1.8,RV()*6.28])}
for(let i=0;i<14000&&grassT.length<8000;i++){const x=-240+RV()*480,z=-250+RV()*490;if(pathDist(x,z)>3&&Math.hypot(x-LAKE.x,z-LAKE.z)>LAKE.r*1.05&&Math.hypot(x,z)>21&&Math.hypot(x-ARENA.x,z-ARENA.z)>38&&!(x>100&&z<-10&&RV()<.6))grassT.push([x,z,.6+RV()*.8,RV()*6.28])}
for(let i=0;i<1500&&flowerT.length<700;i++){const x=-220+RV()*440,z=-60+RV()*300;if(!inForest(x,z)&&pathDist(x,z)>3&&Math.hypot(x-LAKE.x,z-LAKE.z)>LAKE.r*1.1&&Math.hypot(x,z)>21)flowerT.push([x,z,.6+RV()*.6,RV()*6.28])}
function tuftGeo(){const pos=[],col=[];const base=new THREE.Color().setRGB(.42,.5,.3),tip=new THREE.Color().setRGB(1.05,1.08,.9);for(let k=0;k<5;k++){const a=k/5*Math.PI*2+.3,lean=.12+(k%2)*.1,w=.035,h=.42+(k%3)*.1,cx=Math.cos(a)*.05,cz=Math.sin(a)*.05,tx=Math.cos(a)*lean,tz=Math.sin(a)*lean,px=-Math.sin(a)*w,pz=Math.cos(a)*w;
  pos.push(cx-px,0,cz-pz, cx+px,0,cz+pz, cx+tx,h,cz+tz);col.push(base.r,base.g,base.b,base.r,base.g,base.b,tip.r,tip.g,tip.b)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_e=new THREE.Euler(),_c=new THREE.Color();
const VEG_IM=[];
function instance(geo,material,list,fn,cast=true){const im=new THREE.InstancedMesh(geo,material,list.length);VEG_IM.push({im,list,proc:PROC});if(PROC)im.userData.proc=PROC;list.forEach((t,i)=>{const o=fn(t,i);_p.set(t[0],groundH(t[0],t[1])+(o.y||0),t[1]);_e.set(o.rx||0,t[3],o.rz||0);_q.setFromEuler(_e);_s.set(o.sx||t[2],o.sy||t[2],o.sz||t[2]);_m.compose(_p,_q,_s);im.setMatrixAt(i,_m);if(o.c!=null)im.setColorAt(i,_c.setHex(o.c).multiplyScalar(o.cm||1))});im.castShadow=cast;im.receiveShadow=true;if(im.instanceColor)im.instanceColor.needsUpdate=true;scene.add(im);return im}
const pineCols=[0x2f5a2e,0x3a6a33,0x27502c,0x456f35];
instance(new THREE.CylinderGeometry(.16,.3,3,8).translate(0,1.5,0),mat(0x5a3f28,{flat:false}),pineT,()=>({}));
instance(new THREE.ConeGeometry(2.3,4.2,10).translate(0,4.2,0),mat(0xffffff,{flat:false,r:.9}),pineT,(t,i)=>({c:pineCols[i%4]}));
instance(new THREE.ConeGeometry(1.7,3.4,10).translate(0,6.2,0),mat(0xffffff,{flat:false,r:.9}),pineT,(t,i)=>({c:pineCols[(i+1)%4],cm:1.1}));
instance(new THREE.ConeGeometry(1.0,2.4,10).translate(0,7.9,0),mat(0xffffff,{flat:false,r:.9}),pineT,(t,i)=>({c:pineCols[(i+2)%4],cm:1.2}));
instance(new THREE.CylinderGeometry(.22,.42,3.2,8).translate(0,1.6,0),mat(0x6a4a30,{flat:false}),oakT,()=>({}));
const oakCols=[0x5e8f2e,0x6f9d35,0x4f7f2a,0x86a83a];
instance(new THREE.IcosahedronGeometry(2.6,3).translate(0,4.6,0),mat(0xffffff,{flat:false,r:.9}),oakT,(t,i)=>({c:oakCols[i%4]}));
instance(new THREE.IcosahedronGeometry(1.8,3).translate(1.3,5.6,.6),mat(0xffffff,{flat:false,r:.9}),oakT,(t,i)=>({c:oakCols[(i+2)%4],cm:1.08}));
instance(new THREE.CylinderGeometry(.15,.32,4,5).translate(0,2,0),mat(0x3d3428),deadT,()=>({rz:.1}));
instance(new THREE.CylinderGeometry(.05,.12,2,4).translate(0,1,0),mat(0x3d3428),deadT,()=>({y:2.2,rz:.9}));
instance(new THREE.CylinderGeometry(.05,.12,1.8,4).translate(0,.9,0),mat(0x3d3428),deadT,()=>({y:2.8,rz:-.8}));
instance(new THREE.DodecahedronGeometry(1,1),mat(0xffffff,{r:.95}),rockT,t=>({sy:t[2]*.65,y:t[2]*.2,c:[0x8a867c,0x77736a,0x9a9488][Math.floor(t[2]*10)%3]}));
const grassIM=instance(tuftGeo(),new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.95}),grassT,t=>({c:inForest(t[0],t[1])?0x46702c:(t[0]>100&&t[1]<-10?0xa3a050:0x79a83e),rz:(t[2]-1)*.4}),false);
instance(new THREE.IcosahedronGeometry(.1,1).translate(0,.34,0),mat(0xffffff,{e:0x222222,flat:false}),flowerT,(t,i)=>({c:[0xff5a6a,0xffe066,0xffffff,0xb07aff,0xff9a3a][i%5]}),false);
for(const t of pineT)addCol(t[0],t[1],.55*t[2],3.6);for(const t of oakT)addCol(t[0],t[1],.6*t[2],4);for(const t of deadT)addCol(t[0],t[1],.35);for(const t of rockT)if(t[2]>1)addCol(t[0],t[1],t[2]*.85);

/* ---------- clouds ---------- */
const clouds=new THREE.Group();scene.add(clouds);
{const cm=new THREE.MeshToonMaterial({color:0xffffff,fog:false,emissive:0x8899aa,emissiveIntensity:.35,gradientMap:RAMP});
for(let i=0;i<22;i++){const g=new THREE.Group();const n=3+Math.floor(RV()*4);for(let k=0;k<n;k++){const m=new THREE.Mesh(new THREE.IcosahedronGeometry(8+RV()*9,2),cm.clone());m.position.set(k*11-n*5,RV()*4,RV()*10-5);m.scale.y=.5;g.add(m)}g.position.set(-500+RV()*1000,120+RV()*40,-500+RV()*1000);clouds.add(g)}}

/* ---------- buildings ---------- */
const HOUSES=[],STALLS=[],CRATES=[];
function house(x,z,w,d,h,rot,roof=0x8a3b2a,wall=0xe8dcc0,par=scene){
  const g=new THREE.Group();g.position.set(x,groundH(x,z),z);g.rotation.y=rot?Math.PI/2:0;par.add(g);HOUSES.push({g,x,z,w,d,h,rot,par});
  mesh(new THREE.BoxGeometry(w+.6,.8,d+.6),mat(0x8a8478,{tex:'brick',rx:w/3,ry:.4}),0,.2,0,g);
  mesh(new THREE.BoxGeometry(w,h,d),mat(wall,{tex:'plaster',rx:w/4,ry:h/4}),0,h/2+.5,0,g);
  const beam=mat(0x4a3220,{tex:'wood',rx:.2,ry:1});
  for(const sx of[-1,1])for(const sz of[-1,1])mesh(new THREE.BoxGeometry(.35,h,.35),beam,sx*w/2,h/2+.5,sz*d/2,g);
  for(const sz of[-1,1]){mesh(new THREE.BoxGeometry(w+.1,.3,.3),beam,0,h*.5+.5,sz*d/2,g);mesh(new THREE.BoxGeometry(w+.1,.3,.3),beam,0,h+.4,sz*d/2,g);
    for(let k=-1;k<=1;k+=2){const b=mesh(new THREE.BoxGeometry(.25,h*.62,.25),beam,k*w/4,h*.75+.45,sz*d/2,g);b.rotation.z=k*.6}}
  const rh=Math.max(w,d)*.42+1.2;
  const roofG=new THREE.CylinderGeometry(0,1,1,4,1);roofG.rotateY(Math.PI/4);
  const r=mesh(roofG,mat(roof,{tex:'shingle',rx:4,ry:3}),0,h+.5+rh/2,0,g);r.scale.set((w+1.6)*.71,rh,(d+1.6)*.71);
  mesh(new THREE.BoxGeometry(.9,2.4,.9),mat(0x7a7468,{tex:'brick',rx:.5,ry:1}),w*.25,h+rh*.6+.5,d*.15,g);
  mesh(new THREE.BoxGeometry(1.5,2.4,.2),mat(0x5a3a22,{tex:'wood',rx:.5,ry:1}),0,1.7,d/2+.02,g);
  const win=mat(0xffd27a,{e:0xffb347,ei:.7});NIGHT_MATS.add(win);
  for(const sx of[-1,1]){mesh(new THREE.BoxGeometry(1.1,1.1,.12),win,sx*w*.3,h*.55+.5,d/2+.02,g,false);mesh(new THREE.BoxGeometry(1.1,1.1,.12),win,sx*w*.3,h*.55+.5,-d/2-.02,g,false)}
  if(rot)addBox(x,z,d+.6,w+.6);else addBox(x,z,w+.6,d+.6);
  return g}
function tower(x,z,r,h,roof=0x2a3f6a){const g=new THREE.Group();g.position.set(x,groundH(x,z),z);scene.add(g);mesh(new THREE.CylinderGeometry(r,r*1.1,h,10),mat(0x9a948a,{tex:'brick',rx:3,ry:h/3}),0,h/2,0,g);mesh(new THREE.ConeGeometry(r*1.35,r*2.2,10),mat(roof,{tex:'shingle',rx:4,ry:2}),0,h+r*1.1,0,g);addCol(x,z,r+.2);return g}
/* fountain (procedural fallback; replaced by the Kenney fountain in buildTown) */
{PROC='fountain';const g=new THREE.Group();g.position.set(0,1.2,0);scene.add(g);mesh(new THREE.CylinderGeometry(4.2,4.5,1,20),mat(0xc8c0b0,{tex:'brick',rx:8,ry:.5,flat:false}),0,.5,0,g);mesh(new THREE.TorusGeometry(4.2,.22,6,32).rotateX(Math.PI/2),mat(0xd8d0c0),0,1,0,g);
  const w=mesh(new THREE.CylinderGeometry(3.7,3.7,.2,20),new THREE.MeshStandardMaterial({color:0x5fb0d8,roughness:.05,metalness:.2,transparent:true,opacity:.85}),0,.85,0,g,false);
  mesh(new THREE.CylinderGeometry(.5,.8,3,8),mat(0xd8d0c0),0,2,0,g);mesh(new THREE.CylinderGeometry(1.6,.4,.5,12),mat(0xd8d0c0),0,3.3,0,g);mesh(new THREE.SphereGeometry(.45,10,8),mat(0xe0e8f0,{m:.8,r:.2}),0,3.9,0,g);addCol(0,0,5.2);void w;PROC=null}
let FOUNT_Y=4.1;const fountainDrops=(()=>{const n=160,g=new THREE.BufferGeometry(),p=new Float32Array(n*3),v=[];for(let i=0;i<n;i++){v.push({t:Math.random()*1.2,a:Math.random()*6.28,s:rand(1.2,2.2)})}g.setAttribute('position',new THREE.BufferAttribute(p,3));const pts=new THREE.Points(g,new THREE.PointsMaterial({color:0xcfefff,size:.18,transparent:true,opacity:.8}));scene.add(pts);return{g,p,v,n}})();
function lamp(x,z){const y=groundH(x,z);mesh(new THREE.CylinderGeometry(.08,.12,3.6,6),mat(0x2a2a2a,{m:.6,r:.4}),x,y+1.8,z);{const lm=mat(0xffd27a,{e:0xffa030,ei:1.6});NIGHT_MATS.add(lm);mesh(new THREE.BoxGeometry(.3,.4,.3),lm,x,y+3.7,z,scene,false)}mesh(new THREE.ConeGeometry(.3,.3,4).rotateY(Math.PI/4),mat(0x222222,{m:.6,r:.4}),x,y+4.05,z,scene,false);addLight(x,y+3.8,z,0xffb050,22,18)}
function stall(x,z,rot,col){const g=new THREE.Group();g.position.set(x,groundH(x,z),z);g.rotation.y=rot;scene.add(g);STALLS.push({g,x,z,rot,i:STALLS.length});const wd=mat(0x6a4a2a,{tex:'wood'});
  for(const sx of[-1,1])for(const sz of[-1,1])mesh(new THREE.BoxGeometry(.18,2.6,.18),wd,sx*1.6,1.3,sz*1,g);mesh(new THREE.BoxGeometry(3.4,.9,1.6),wd,0,.45,0,g);
  const aw=mesh(new THREE.BoxGeometry(3.8,.12,2.6),mat(col,{tex:'stripe',rx:4}),0,2.7,0,g);aw.rotation.x=-.18;
  for(let i=0;i<5;i++)mesh(new THREE.SphereGeometry(.18,6,5),mat(pick([0xd94a3a,0xe8b23a,0x7ab83a,0xa05ad0])),-1.2+i*.6,1,0,g);addCol(x,z,1.6)}
function flagPole(x,z,col){const y=groundH(x,z);mesh(new THREE.CylinderGeometry(.07,.07,6,6),mat(0x5a4a3a),x,y+3,z);const b=mesh(new THREE.PlaneGeometry(1.2,2.4),mat(col,{side:1}),x+.62,y+4.6,z,scene);b.userData.wave=1;flags.push(b);mesh(new THREE.CircleGeometry(.32,12),mat(0xe8e8f0,{side:1,m:.6,r:.3}),x+.62,y+4.8,z+.01,scene,false)}
const flags=[];
function crate(x,z,s=1){const m=mesh(new THREE.BoxGeometry(s,s,s),mat(0x9a7444,{tex:'wood',rx:1,ry:1}),x,groundH(x,z)+s/2,z);m.rotation.y=Math.random();CRATES.push({m,x,z,ry:m.rotation.y,s,kind:'crate'});addCol(x,z,s*.6)}
function barrel(x,z){const m=mesh(new THREE.CylinderGeometry(.45,.45,1.1,10),mat(0x7a5432,{tex:'wood',rx:2}),x,groundH(x,z)+.55,z);CRATES.push({m,x,z,ry:0,s:1.1,kind:'barrel'});addCol(x,z,.5)}
/* ===================== Silverbrook: the walled town (upgrade) =====================
   Layout only: colliders, simple fallback boxes and lists of what goes where. buildTown() (2b_env.js) puts the
   downloaded CC0 models on these spots: KayKit Medieval Hexagon Pack (buildings, walls, towers, props) and the
   Kenney Fantasy Town Kit (fountain, lanterns, market stalls, hedges, trees, banners, benches, carts). */
const TOWN_B=[],TOWN_P=[],TOWN_L=[],TOWN_T=[],TOWN_SMOKE=[];
/* footprints (model units) and chimney tops (for smoke) of the KayKit buildings */
const TFP={castle:[1.98,2.26],church:[1.02,1.16],tavern:[1.17,1.33],market:[1.8,1.32],home_A:[.8,.86],home_B:[.88,1.1],well:[.65,.76],barracks:[1.44,1.57],watermill:[1.05,1.24],tower_A:[1,1.15],tower_B:[1.2,1.38],tower_base:[.92,1.11]};
const TCH={home_A:[-.049,.93,-.301],home_B:[.091,1.28,-.371],tavern:[-.14,.913,-.35]};
const tkey=(T,m)=>Object.keys(T).find(k=>m.startsWith(k));
/* q = quarter turns; the door side of a KayKit building is +z, so q=0 faces south, 1 east, 2 north, 3 west */
function tbuild(m,x,z,q,s,col=.84){const fp=TFP[tkey(TFP,m)]||[1,1];const w=fp[0]*s,d=fp[1]*s;const sw=q%2?d:w,sd=q%2?w:d;const ck=tkey(TCH,m);
  const b={m:'H_'+m,x,z,q,s,w:sw,d:sd,ch:ck?TCH[ck]:null};TOWN_B.push(b);if(col)addBox(x,z,sw*col,sd*col);
  PROC='town';b.proc=mesh(new THREE.BoxGeometry(sw*.86,s*.8,sd*.86),mat(0xd8cbb0,{tex:'plaster',rx:2,ry:2}),x,groundH(x,z)+s*.4,z);PROC=null;return b}
/* landmarks */
tbuild('castle_blue',30,-46,3,7.5);            /* the keep / town hall, north-east */
tbuild('church_blue',40,28,3,12);              /* the church of the Light, east of the square (Brother Anselm) */
tbuild('tavern_red',-34,-17,0,11);             /* The Silver Tankard on Market Street */
tbuild('barracks_blue',50,-6,3,8);             /* the watch barracks by the east gate */
/* Market Street (the west road) */
tbuild('market_red',-34,24,2,7);tbuild('market_blue',-56,4,0,7);
/* houses */
tbuild('home_B_red',-16,-32,1,10);tbuild('home_A_yellow',-16,-48,1,10);tbuild('home_B_green',-34,-40,0,10);tbuild('home_A_blue',-50,-30,0,10);tbuild('home_A_red',-28,-56,1,10);tbuild('home_B_yellow',-52,-14,0,10);
tbuild('home_A_green',14,-36,3,10);tbuild('home_B_blue',14,-54,3,10);
tbuild('home_A_yellow',20,36,2,10);tbuild('home_B_red',22,52,3,10);tbuild('home_A_blue',40,46,2,10);
tbuild('home_A_red',-16,30,1,10);tbuild('home_B_yellow',-16,58,1,10);
/* park: the mill pond with a watermill, trees and benches */
tbuild('watermill_yellow',-22,46,3,8,.7);
tbuild('tower_A_blue',13,-20,0,4.5);tbuild('well_blue',14,18,0,4);
/* the stable (Quaternius, 4.7 x 3.3 model units): long side along x, scaled 2.6; a paddock fence, hay bales and the
   stablemaster's animals in front of it */
const STABLE_S=2.6;addBox(STABLE.x,STABLE.z,4.7*STABLE_S*.9,3.3*STABLE_S*.85);for(const p of STABLE_PETS)addCol(STABLE.x+p.dx,STABLE.z+p.dz,1);
/* cobbled streets inside the walls (same cobbles as the square) */
{const cm=mat(0xc8c0b0,{tex:'cobble',rx:1,ry:1});const W=TOWN.wall+3,Y=1.236;
  for(const p of PATHS)for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],inn=t=>{const q=at(t),r=Math.hypot(q[0],q[1]);return r>21.5&&r<W};
    let t0=-1,t1=-1;for(let k=0;k<=400;k++){const t=k/400;if(inn(t)){if(t0<0)t0=t;t1=t}}if(t0<0)continue;
    const[ax,az]=at(t0),[bx,bz]=at(t1);const L=Math.hypot(bx-ax,bz-az);if(L<1)continue;
    const g=new THREE.PlaneGeometry(7,L+.1);g.rotateX(-Math.PI/2);const uv=g.attributes.uv;for(let k=0;k<uv.count;k++)uv.setXY(k,uv.getX(k)*7/2.6,uv.getY(k)*L/2.6);
    const m=mesh(g,cm,(ax+bx)/2,Y,(az+bz)/2,scene,false,true);m.rotation.y=Math.atan2(bx-ax,bz-az);
    if(t1<1&&Math.hypot(bx,bz)<W-1){const c=new THREE.CircleGeometry(3.5,16);c.rotateX(-Math.PI/2);mesh(c,cm,bx,Y+.002,bz,scene,false,true)}}}
/* pond water (same shader as Mirror Lake, own radius) */
{const g=waterGeo(POND.x,POND.z,POND.r*1.25+3,POND.r+3,.62,48);const pm=new THREE.ShaderMaterial({transparent:true,fog:true,uniforms:{...waterMat.uniforms,radius:{value:POND.r*1.25+2.6}},vertexShader:waterMat.vertexShader,fragmentShader:waterMat.fragmentShader});
  const m=new THREE.Mesh(g,pm);m.position.set(POND.x,.62,POND.z);m.receiveShadow=false;scene.add(m)}
/* gates: where a road crosses the wall */
const TOWN_GATES=[];{const W=TOWN.wall;for(const p of PATHS)for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];const ra=Math.hypot(a[0],a[1]),rb=Math.hypot(b[0],b[1]);if((ra-W)*(rb-W)>0)continue;
  let lo=0,hi=1;for(let k=0;k<30;k++){const t=(lo+hi)/2;const r=Math.hypot(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);if((r<W)===(ra<W))lo=t;else hi=t}
  const ang=Math.atan2(a[1]+(b[1]-a[1])*lo,a[0]+(b[0]-a[0])*lo);if(!TOWN_GATES.some(g=>Math.abs(angDiff(g,ang))<.05))TOWN_GATES.push(ang)}}
/* the wall: segments, wall towers and gate towers (colliders + procedural fallback) */
const TOWN_WALL={seg:[],tow:[],gate:[]};{const W=TOWN.wall,N=64;const gap=a=>TOWN_GATES.some(g=>Math.abs(angDiff(a,g))<.118);PROC='twall';const wm=mat(0xa49c8e,{tex:'brick',rx:2,ry:1.2});
  for(let i=0;i<N;i++){const a=(i+.5)/N*Math.PI*2;if(gap(a))continue;const x=Math.cos(a)*W,z=Math.sin(a)*W,y=groundH(x,z);TOWN_WALL.seg.push({x,y,z,ry:-a-Math.PI/2});
    const s=mesh(new THREE.BoxGeometry(7.3,4.6,2.4),wm,x,y+2.3,z,scene);s.rotation.y=-a-Math.PI/2;
    for(let k=-1;k<=1;k++)addCol(x-Math.sin(a)*k*2.45,z+Math.cos(a)*k*2.45,1.9,false,5.6);
    if(i%8===4&&!gap(a+.1)&&!gap(a-.1))TOWN_WALL.tow.push({x:Math.cos(a)*(W+.4),y,z:Math.sin(a)*(W+.4),ry:-a+Math.PI/2})}
  for(const t of TOWN_WALL.tow)addCol(t.x,t.z,2.6,false,9);
  for(const g of TOWN_GATES)for(const sd of[-1,1]){const a=g+sd*.105,x=Math.cos(a)*W,z=Math.sin(a)*W;TOWN_WALL.gate.push({x,z,ry:-g+Math.PI/2,sd,g});addCol(x,z,3.1,false,12);
    mesh(new THREE.CylinderGeometry(2.6,2.9,10,10),wm,x,groundH(x,z)+5,z,scene);addLight(Math.cos(g)*(W-3)+Math.cos(g+Math.PI/2)*sd*4,groundH(x,z)+5,Math.sin(g)*(W-3)+Math.sin(g+Math.PI/2)*sd*4,0xffa040,30,22)}
  PROC=null}
/* streets: lanterns along the roads inside the walls and around the square */
const clearOf=(x,z,r)=>!BOXES.some(b=>x>b.x0-r&&x<b.x1+r&&z>b.z0-r&&z<b.z1+r)&&Math.hypot(x,z)<TOWN.wall-5;
{let k=0;for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.31,x=Math.cos(a)*21.5,z=Math.sin(a)*21.5;if(pathDist(x,z)<4.5)continue;TOWN_L.push({x,z,light:k++%2===0})}
  for(const p of PATHS)for(let i=0;i<p.length-1;i++){const a=p[i],b=p[i+1];const L=Math.hypot(b[0]-a[0],b[1]-a[1]),dx=(b[0]-a[0])/L,dz=(b[1]-a[1])/L;
    for(let t=8;t<L;t+=15){const cx=a[0]+dx*t,cz=a[1]+dz*t;const r=Math.hypot(cx,cz);if(r<27||r>TOWN.wall-6)continue;const sd=(Math.round(t/15)%2)?1:-1;const x=cx-dz*5.4*sd,z=cz+dx*5.4*sd;
      if(clearOf(x,z,1.2)&&pathDist(x,z)>4.4&&!TOWN_L.some(l=>Math.hypot(l.x-x,l.z-z)<9))TOWN_L.push({x,z,light:k++%2===0})}}
  for(const l of TOWN_L){addCol(l.x,l.z,.35);if(l.light)addLight(l.x,groundH(l.x,l.z)+3.7,l.z,0xffb050,22,18)}}
/* greenery: park trees around the pond, trees along the inside of the wall, hedges and benches */
{const R=mulberry(1717);const tryT=(x,z,m,s)=>{if(!clearOf(x,z,2.5)||pathDist(x,z)<6||pondDist(x,z)<1.5||Math.hypot(x,z)<26||TOWN_T.some(t=>Math.hypot(t.x-x,t.z-z)<5.5)||TOWN_L.some(l=>Math.hypot(l.x-x,l.z-z)<3))return;TOWN_T.push({x,z,m,s,ry:R()*6.28});addCol(x,z,.6,true)};
  for(let i=0;i<14;i++){const a=i/14*Math.PI*2+R()*.2;tryT(POND.x+Math.cos(a)*(POND.r*1.25+5+R()*3),POND.z+Math.sin(a)*(POND.r+5+R()*3),R()<.5?'T_tree-high-round':'H_tree_single_B',.9+R()*.4)}
  for(let i=0;i<90;i++){const a=i/90*Math.PI*2,r=TOWN.wall-8-R()*5;tryT(Math.cos(a)*r,Math.sin(a)*r,['T_tree','T_tree-high-round','H_tree_single_A','H_tree_single_B'][Math.floor(R()*4)],.8+R()*.5)}}
/* props: stalls on the square and Market Street, barrels, crates, carts, benches, banners */
{const R=mulberry(1818);const P=(m,x,z,ry,s,c=0)=>{TOWN_P.push({m,x,z,ry,s});if(c)addCol(x,z,c)};
  P('T_stall-red',-8,-13.5,0,3.6,1.5);P('T_stall-green',-15,1,Math.PI/2,3.6,1.5);P('T_stall-red',14,-12,0,3.6,1.5);
  /* Market Street: stalls on both sides of the west road */
  {const d=[-.942,.334],n=[.334,.942];let i=0;for(const t of[30,38,46,54])for(const sd of[-1,1]){const x=d[0]*t+n[0]*7.2*sd,z=d[1]*t+n[1]*7.2*sd;if(!clearOf(x,z,1.5))continue;P(i++%2?'T_stall-green':'T_stall-red',x,z,Math.atan2(-n[0]*sd,-n[1]*sd),3.6,1.5)}}
  for(const[x,z]of[[-27,-6],[-26,-7.4],[-41.5,-9],[-12,-16],[-11,-17],[18,-14],[44,-1],[44,-12.5],[-48,10],[-29,30],[-17,40]])P(R()<.5?'H_barrel':'H_crate_A_big',x,z,R()*6,5.2,.55);
  P('H_weaponrack',44,-9,Math.PI/2,6,.5);P('H_weaponrack',44,-4,Math.PI/2,6,.5);P('H_wheelbarrow',-46,-22,1.2,5,.6);P('T_cart',-12,-26,.4,3.2,1.4);P('T_cart-high',-62,14,2.2,3.2,1.4);
  P('H_resource_lumber',-14,46,.3,6,1);P('H_sack',-28,-8,0,8,.3);P('H_crate_open',-44,-8,.6,5,.6);
  for(const[x,z,ry]of[[-38,32,0],[-50,38,1.3],[-48,56,2.2],[-30,59,3.1],[11.5,11.5,-.785],[-11.5,11.5,.785],[11.5,-11.5,.785],[-11.5,-11.5,-.785]])P('T_stall-bench',x,z,ry,3.2,.6);
}

/* ---------- farm ---------- */
{PROC='wheat';const wheat=[];for(let x=-36;x<50;x+=1.1)for(let z=96;z<162;z+=1.1){if(Math.floor((x+200)/9)%2===0&&pathDist(x,z)>3&&RV()<.85)wheat.push([x+RV()*.6,z+RV()*.6,.7+RV()*.5,RV()*6])}
  instance(new THREE.CylinderGeometry(.02,.07,1,4).translate(0,.5,0),mat(0xffffff),wheat,(t,i)=>({c:[0xd9b84a,0xe6c65a,0xc9a83a][i%3],sx:1,sz:1,sy:t[2]*1.1,rz:(t[2]-.95)*.5}),false);instance(new THREE.ConeGeometry(.09,.32,4).translate(0,1.12,0),mat(0xffffff),wheat,(t,i)=>({c:0xe8c860,sx:1,sz:1,sy:t[2],rz:(t[2]-.95)*.5}),false);PROC=null;window.__wheat=wheat;
  const fm=mat(0x7a5a3a,{tex:'wood'});for(let x=-42;x<=56;x+=4){for(const z of[90,166]){if(pathDist(x,z)<3)continue;mesh(new THREE.BoxGeometry(.2,1.2,.2),fm,x,groundH(x,z)+.6,z);mesh(new THREE.BoxGeometry(4,.15,.12),fm,x+2,groundH(x,z)+.9,z)}}
  house(46,108,12,9,6,1,0x9a2a1a,0xb04a2a);
  const mill=new THREE.Group();const mx=-34,mz=118;mill.position.set(mx,groundH(mx,mz),mz);scene.add(mill);mesh(new THREE.CylinderGeometry(2.6,3.4,10,8),mat(0xe0d6c0,{tex:'plaster',rx:3,ry:3}),0,5,0,mill);mesh(new THREE.ConeGeometry(3.4,4,8),mat(0x7a4a2a,{tex:'shingle',rx:3,ry:2}),0,12,0,mill);addCol(mx,mz,3.4);
  const blades=new THREE.Group();blades.position.set(0,9.5,3.2);mill.add(blades);for(let i=0;i<4;i++){const b=new THREE.Group();b.rotation.z=i*Math.PI/2;blades.add(b);mesh(new THREE.BoxGeometry(.3,7,.15),fm,0,3.5,0,b);mesh(new THREE.BoxGeometry(1.6,5.5,.06),mat(0xf0e8d8,{side:1}),.9,4,0,b)}
  mill.userData.blades=blades;window.__mill=blades;
  for(let i=0;i<6;i++)crate(52+rand(-3,3),118+rand(-2,2),.9);}

/* ---------- bandit camp ---------- */
{PROC='camp';const g=new THREE.Group();g.position.set(CAMP.x,FLAT[1].h,CAMP.z);scene.add(g);
  const lm=mat(0x6a4a2a,{tex:'wood',rx:.3,ry:1});
  for(let a=0;a<Math.PI*2;a+=.13){if(Math.abs(angDiff(a,Math.atan2(32,-60)))<.35)continue;const x=Math.cos(a)*25,z=Math.sin(a)*25,h=3+Math.random()*1.2;mesh(new THREE.CylinderGeometry(.35,.4,h,6),lm,x,h/2,z,g);mesh(new THREE.ConeGeometry(.36,.8,6),lm,x,h+.4,z,g);addCol(CAMP.x+x,CAMP.z+z,.5)}
  const tents=[[-8,-8,0xa08a5a],[9,-6,0x8a5a3a],[-6,10,0x7a6a4a],[11,9,0x9a7a4a],[0,-14,0x6a4a3a]];
  for(const[x,z,c]of tents){mesh(new THREE.ConeGeometry(3.4,4,4).rotateY(Math.PI/4),mat(c,{tex:'stripe',rx:2}),x,2,z,g);addCol(CAMP.x+x,CAMP.z+z,2.6)}
  mesh(new THREE.CylinderGeometry(1.4,1.6,.4,10),mat(0x4a4440),0,.2,0,g);for(let i=0;i<5;i++){const l=mesh(new THREE.CylinderGeometry(.15,.15,1.8,5),mat(0x4a3020),0,.5,0,g);l.rotation.set(Math.PI/2,0,i*1.2)}
  addFlame(g,0,.9,0,3,0xff7a20);addFlame(g,.4,.7,.2,2,0xffb030);addFlame(g,-.4,.7,-.2,2,0xffa020);addLight(CAMP.x,FLAT[1].h+2.5,CAMP.z,0xff8a30,60,32);addCol(CAMP.x,CAMP.z,1.6);
  for(let i=0;i<8;i++){const a=i*.8;crate(CAMP.x+Math.cos(a)*18,CAMP.z+Math.sin(a)*18,1+Math.random()*.3)}
  mesh(new THREE.CylinderGeometry(.08,.08,7,6),lm,4,3.5,3,g);const fl=mesh(new THREE.PlaneGeometry(1.4,2.2),mat(0x1a1a1a,{side:1}),4.72,6,3,g);flags.push(fl);PROC=null}

/* ---------- crypt entrance ---------- */
const CRYPT_H=FLAT[2].h;
{PROC='cryptgate';const g=new THREE.Group();g.position.set(CRYPT.x,CRYPT_H,CRYPT.z);scene.add(g);const st=mat(0x6a6660,{tex:'brick',rx:1,ry:2});
  for(const s of[-1,1]){mesh(new THREE.BoxGeometry(2,8,2),st,s*4,4,0,g);mesh(new THREE.BoxGeometry(2.6,.8,2.6),st,s*4,8.2,0,g);mesh(new THREE.SphereGeometry(.6,8,6),mat(0xd8d2b8),s*4,9.2,0,g);addCol(CRYPT.x+s*4,CRYPT.z,1.4)}
  mesh(new THREE.BoxGeometry(11,1.6,2.4),st,0,8.6,0,g);mesh(new THREE.BoxGeometry(14,10,6),mat(0x5a5650,{tex:'brick',rx:3,ry:3}),0,5,-4,g);addBox(CRYPT.x,CRYPT.z-4,14,6);
  mesh(new THREE.PlaneGeometry(5.8,7.4),new THREE.MeshBasicMaterial({color:0x000000,fog:false}),0,3.7,-.95,g,false,false);
  const portal=portalMesh(0x3aff8a,2.3,CRYPT.x,groundH(CRYPT.x,CRYPT.z-1.4),CRYPT.z-1.4,0);window.__cportal=portal;
  for(let i=0;i<3;i++)mesh(new THREE.BoxGeometry(7-i*.6,.3,1),st,0,.15+i*.3,1.8-i*.8,g);
  for(const s of[-1,1]){mesh(new THREE.CylinderGeometry(.12,.12,2.2,6),mat(0x2a2a2a),s*5.6,1.1,2,g);addFlame(g,s*5.6,2.4,2,1.6,0x6aff8a);addLight(CRYPT.x+s*5.6,CRYPT_H+2.6,CRYPT.z+2,0x5aff8a,25,16)}
  PROC=null;const graves=[];for(let i=0;i<46;i++){const a=RV()*6.28,r=10+RV()*26,x=CRYPT.x+Math.cos(a)*r,z=CRYPT.z+12+Math.sin(a)*r*.8;if(pathDist(x,z)<3)continue;graves.push([x,z,.8+RV()*.4,RV()*.6-.3])}
  PROC='graves';window.__graves=graves;instance(new THREE.BoxGeometry(1,1.4,.3).translate(0,.6,0),mat(0x8a867e,{r:1}),graves,t=>({rz:t[3]*.3}));PROC='cryptfence';for(const t of graves)addCol(t[0],t[1],.5);
  const fm=mat(0x222222,{m:.7,r:.5});for(let x=-20;x<=20;x+=1.2){if(Math.abs(x)<3.5)continue;const y=groundH(CRYPT.x+x,CRYPT.z+30);mesh(new THREE.BoxGeometry(.08,1.6,.08),fm,CRYPT.x+x,y+.8,CRYPT.z+30,scene,false)}PROC=null}

/* ---------- dungeon ---------- */
const DMAP=[
'#####################',
'####.............####',
'####.............####',
'####......B......####',
'####.............####',
'####m...........m####',
'#######.......#######',
'#########...#########',
'#########...#########',
'###.......s.......###',
'###..s.........s..###',
'###.......m.......###',
'#######.......#######',
'#######...s...#######',
'#######.......#######',
'#########...#########',
'###..m...........####',
'###......s....s..####',
'###..s...........####',
'#########...#########',
'#########.E.#########',
'#####################'];
const DR=DMAP.length,DC=DMAP[0].length;
const dunCell=(x,z)=>{const c=Math.floor((x-DUN.x)/DUN.c+DC/2),r=Math.floor((z-DUN.z)/DUN.c+DR/2);if(r<0||r>=DR||c<0||c>=DC)return'#';return DMAP[r][c]};
const dunPos=(c,r)=>[DUN.x+(c-DC/2+.5)*DUN.c,DUN.z+(r-DR/2+.5)*DUN.c];
function dunCollide(p,r){for(let it=0;it<2;it++)for(const[ox,oz]of[[r,0],[-r,0],[0,r],[0,-r]]){if(dunCell(p.x+ox,p.z+oz)==='#'){const cx=Math.floor((p.x+ox-DUN.x)/DUN.c+DC/2),cz=Math.floor((p.z+oz-DUN.z)/DUN.c+DR/2);const x0=DUN.x+(cx-DC/2)*DUN.c,z0=DUN.z+(cz-DR/2)*DUN.c;if(ox>0)p.x=Math.min(p.x,x0-r-.001);if(ox<0)p.x=Math.max(p.x,x0+DUN.c+r+.001);if(oz>0)p.z=Math.min(p.z,z0-r-.001);if(oz<0)p.z=Math.max(p.z,z0+DUN.c+r+.001)}}}
const DSPAWN=[],DUN_ENTRY={},DUN_EXIT={};
const dungeon=new THREE.Group();scene.add(dungeon);
{PROC=null;const fl=window.__cryptFloor=mesh(new THREE.PlaneGeometry(DC*DUN.c,DR*DUN.c).rotateX(-Math.PI/2),mat(0x8a8478,{tex:'tile',rx:DC*1.5,ry:DR*1.5}),DUN.x,0,DUN.z,dungeon,false,true);void fl;PROC='crypt';
  const walls=[];for(let r=0;r<DR;r++)for(let c=0;c<DC;c++){if(DMAP[r][c]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=c+b;if(rr>=0&&rr<DR&&cc>=0&&cc<DC&&DMAP[rr][cc]!=='#')nb=true}if(nb)walls.push([c,r])}
  const wim=new THREE.InstancedMesh(new THREE.BoxGeometry(DUN.c,9,DUN.c),mat(0x8a8276,{tex:'brick',rx:2,ry:3}),walls.length);walls.forEach(([c,r],i)=>{const[x,z]=dunPos(c,r);_m.makeTranslation(x,4.5,z);wim.setMatrixAt(i,_m)});wim.castShadow=true;wim.receiveShadow=true;wim.userData.proc='crypt';dungeon.add(wim);
  const caps=new THREE.InstancedMesh(new THREE.BoxGeometry(DUN.c+.4,.6,DUN.c+.4),mat(0x5a544c),walls.length);walls.forEach(([c,r],i)=>{const[x,z]=dunPos(c,r);_m.makeTranslation(x,9.2,z);caps.setMatrixAt(i,_m)});caps.userData.proc='crypt';dungeon.add(caps);
  let tor=0;
  for(let r=0;r<DR;r++)for(let c=0;c<DC;c++){const ch=DMAP[r][c];const[x,z]=dunPos(c,r);
    if(ch==='s'||ch==='m'||ch==='B')DSPAWN.push({t:ch==='s'?'knekel':ch==='m'?'kmagier':'boss',x,z});
    if(ch==='E'){DUN_EXIT.x=x;DUN_EXIT.z=z;DUN_ENTRY.x=x;DUN_ENTRY.z=z-7}
    if(ch!=='#'&&DMAP[r][c-1]==='#'&&(r+c)%3===0&&tor<40){tor++;const tx=x-DUN.c/2+.35;mesh(new THREE.BoxGeometry(.3,.6,.3),mat(0x2a2a2a),tx,3.4,z,dungeon,false);addFlame(dungeon,tx+.1,4,z,1.5,0x8aff6a);addLight(tx+.6,4.2,z,0x7aff7a,30,15)}
    if(ch!=='#'&&DMAP[r][c+1]==='#'&&(r+c)%3===1&&tor<40){tor++;const tx=x+DUN.c/2-.35;mesh(new THREE.BoxGeometry(.3,.6,.3),mat(0x2a2a2a),tx,3.4,z,dungeon,false);addFlame(dungeon,tx-.1,4,z,1.5,0xffa040);addLight(tx-.6,4.2,z,0xff9040,30,15)}}
  /* boss hall decor */
  const[bx,bz]=dunPos(10,2);const th=new THREE.Group();th.position.set(bx,0,bz-3);dungeon.add(th);
  mesh(new THREE.BoxGeometry(8,1,5),mat(0x4a4450,{tex:'brick',rx:2}),0,.5,0,th);mesh(new THREE.BoxGeometry(3.4,1.2,2.4),mat(0x2a2030),0,1.6,-.6,th);mesh(new THREE.BoxGeometry(3.4,5,.6),mat(0x2a2030),0,3.5,-1.6,th);
  for(const s of[-1,1]){mesh(new THREE.ConeGeometry(.5,2,5),mat(0xd8d2b8),s*1.8,6,-1.6,th);addFlame(th,s*3.2,2.6,.8,2.2,0xb06aff);addLight(bx+s*3.2,3,bz-2,0xa060ff,40,22)}
  PROC=null;const rune=mesh(new THREE.RingGeometry(8,9,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xa05aff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}),bx,.03,bz+6,dungeon,false,false);rune.userData.spin=1;window.__rune=rune;
  PROC='crypt';for(let i=0;i<10;i++){const[c,r]=[4+Math.floor(RV()*13),9+Math.floor(RV()*10)];if(DMAP[r][c]==='.'){const[x,z]=dunPos(c,r);const b=mesh(new THREE.BoxGeometry(1.2,.9,2.4),mat(0x5a4a3a,{tex:'wood'}),x+rand(-1.5,1.5),.45,z+rand(-1.5,1.5),dungeon);b.rotation.y=RV()*3}}
  for(let i=0;i<40;i++){const[c,r]=[4+Math.floor(RV()*13),1+Math.floor(RV()*19)];if(DMAP[r]&&DMAP[r][c]==='.'){const[x,z]=dunPos(c,r);mesh(new THREE.CylinderGeometry(.05,.05,.7,4),mat(0xe8e0c8),x+rand(-2.5,2.5),.05,z+rand(-2.5,2.5),dungeon,false).rotation.set(Math.PI/2,0,RV()*3)}}PROC=null;
  const ex=portalMesh(0x5affa0,1.75,DUN_EXIT.x,0,DUN_EXIT.z+1.9,0,dungeon);window.__dportal=ex}
/* ---------- Asbergen: cave entrance ---------- */
const CAVE_H=FLAT[4].h;
{const g=new THREE.Group();g.position.set(CAVE.x,CAVE_H,CAVE.z);scene.add(g);const rk=mat(0x4a3a34,{r:1});PROC='cave';
  for(let i=0;i<13;i++){const a=Math.PI*(.05+i/12*.9);const r=mesh(new THREE.DodecahedronGeometry(1.8+Math.random()*1.1,1),rk,Math.cos(a)*5.6,Math.sin(a)*6.6,-2.4+Math.random()*.6,g);r.scale.set(1,1.1,1)}
  mesh(new THREE.DodecahedronGeometry(7,1),rk,0,4,-10.5,g).scale.set(1.6,1.25,.8);
  for(const s of[-1,1])mesh(new THREE.CylinderGeometry(.12,.12,2.4,8),mat(0x2a2a2a),s*6.6,1.2,2.4,g);PROC=null;
  addBox(CAVE.x,CAVE.z-7.5,22,10);for(const s of[-1,1])addCol(CAVE.x+s*5.4,CAVE.z-1,2.4,false,9);
  /* the cave mouth: dark, with the glow of the fire cave below (models frame it, see 2e_visual.js) */
  const mo=mesh(new THREE.PlaneGeometry(7.2,9),caveMouthMat(0xff6a20),0,4.5,-2.6,g,false,false);
  for(const s of[-1,1]){addFlame(g,s*6.6,2.6,2.4,1.8,0xff7a20);addLight(CAVE.x+s*6.6,CAVE_H+2.8,CAVE.z+2.4,0xff7a30,30,18)}
  addLight(CAVE.x,CAVE_H+1.5,CAVE.z-1.5,0xff6a20,18,10);
  for(let i=0;i<4;i++)crate(CAVE.x-7.6+(i%2)*1.3,CAVE.z+5+Math.floor(i/2)*1.4,1);barrel(CAVE.x-8.2,CAVE.z+8.6);barrel(CAVE.x+7.8,CAVE.z+6.4);
  const rail=mat(0x5a5a5a,{m:.7,r:.4});for(const s of[-1,1])mesh(new THREE.BoxGeometry(.12,.1,14),rail,s*.7,.06,5,g,false);for(let k=0;k<12;k++)mesh(new THREE.BoxGeometry(2,.08,.25),mat(0x5a3a22,{tex:'wood'}),0,.02,-1.4+k*1.2,g,false)}
/* ---------- dungeon 2: Vuurgrot ---------- */
const D2MAP=[
'#####################',
'#####.....B.....#####',
'####...~.....~...####',
'####.............####',
'####g....~~~....g####',
'#######.......#######',
'########.....########',
'#####~...i.i...~#####',
'####.....~.~.....####',
'####.g.........g.####',
'#######..i.i..#######',
'#########...#########',
'###~~...........~~###',
'###..i....g....i..###',
'###...~~.....~~...###',
'#########...#########',
'######..i...i..######',
'######.........######',
'#########...#########',
'#########.E.#########',
'#####################'];
function buildDun(def){const M=def.map,R=M.length,C=M[0].length,c=def.c,X=def.x,Z=def.z;
  const cell=(x,z)=>{const cc=Math.floor((x-X)/c+C/2),r=Math.floor((z-Z)/c+R/2);if(r<0||r>=R||cc<0||cc>=C)return'#';return M[r][cc]};
  const pos=(cc,r)=>[X+(cc-C/2+.5)*c,Z+(r-R/2+.5)*c];
  function collide(p,rad){for(let it=0;it<2;it++)for(const[ox,oz]of[[rad,0],[-rad,0],[0,rad],[0,-rad]]){if(cell(p.x+ox,p.z+oz)==='#'){const cx=Math.floor((p.x+ox-X)/c+C/2),cz=Math.floor((p.z+oz-Z)/c+R/2);const x0=X+(cx-C/2)*c,z0=Z+(cz-R/2)*c;if(ox>0)p.x=Math.min(p.x,x0-rad-.001);if(ox<0)p.x=Math.max(p.x,x0+c+rad+.001);if(oz>0)p.z=Math.min(p.z,z0-rad-.001);if(oz<0)p.z=Math.max(p.z,z0+c+rad+.001)}}}
  const grp=new THREE.Group();scene.add(grp);const spawns=[],entry={},exit={},lava=[];
  mesh(new THREE.PlaneGeometry(C*c,R*c).rotateX(-Math.PI/2),mat(def.floor,{tex:'tile',rx:C*1.5,ry:R*1.5}),X,0,Z,grp,false,true);
  const walls=[];for(let r=0;r<R;r++)for(let k=0;k<C;k++){if(M[r][k]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<R&&cc>=0&&cc<C&&M[rr][cc]!=='#')nb=true}if(nb)walls.push([k,r])}
  const wim=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(c*.78,1),mat(def.wall,{r:1}),walls.length);walls.forEach(([k,r],i)=>{const[x,z]=pos(k,r);_m.compose(_p.set(x,3.5,z),_q.setFromEuler(_e.set(hash(k,r)*3,hash(r,k)*6,0)),_s.set(1,1.9+hash(k+3,r)*.6,1));wim.setMatrixAt(i,_m)});wim.castShadow=true;wim.receiveShadow=true;grp.add(wim);
  let tor=0;
  for(let r=0;r<R;r++)for(let k=0;k<C;k++){const ch=M[r][k];const[x,z]=pos(k,r);
    if(def.spawn[ch]){const s=def.spawn[ch];spawns.push(typeof s==='string'?{t:s,x,z}:{t:s[0],lv:[s[1],s[2]],x,z})}
    if(ch==='E'){exit.x=x;exit.z=z;entry.x=x;entry.z=z-7}
    if(ch==='~'){const l=mesh(new THREE.PlaneGeometry(c,c).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:def.pool!=null?new THREE.Color(def.pool):new THREE.Color().setRGB(.9,.2,.02)}),x,.04,z,grp,false,false);lava.push(l);if((r*7+k)%3===0)addLight(x,1.2,z,def.poolLight??0xff5a20,24,12,true)}
    if(ch==='.'&&!def.noCrystal&&((r*5+k*3)%11===0)&&tor<30){tor++;const cr=mesh(new THREE.ConeGeometry(.35,1.6,6),mat(def.crystal,{e:def.crystal,ei:1.6}),x+rand(-2,2),.6,z+rand(-2,2),grp,false);cr.rotation.z=rand(-.4,.4);if(tor%3===0)addLight(cr.position.x,1.5,cr.position.z,def.crystal,22,12)}}
  const img=document.createElement('canvas');img.width=C*12;img.height=R*12;{const g=img.getContext('2d');g.fillStyle='#140c0a';g.fillRect(0,0,img.width,img.height);for(let r=0;r<R;r++)for(let k=0;k<C;k++)if(M[r][k]!=='#'){g.fillStyle=M[r][k]==='~'?(def.mapPool||'#c8501a'):(def.mapFloor||'#5a4a44');g.fillRect(k*12,r*12,12,12)}}
  const ex=portalMesh(def.portal||0xffa040,1.75,exit.x,0,exit.z+2.3,0,grp);
  return{X,Z,c,R,C,map:M,cell,pos,collide,spawns,entry,exit,img,lava,portal:ex,name:def.name,grp,wim}}
const D2=buildDun({x:1400,z:0,c:6,map:D2MAP,floor:0x7a5a48,wall:0x3a2a26,crystal:0xff7a30,spawn:{i:'vuurimp',g:'lavagolem',B:'ignaroth'},name:'Ignaroth\'s Fire Cave'});
/* ---------- life-skill stations ---------- */
/* werkplaatsen; de modellen komen uit 2f_craft.js, de eenvoudige vormen hieronder zijn alleen de reserve zonder modellen */
const STATIONS=[{k:'fire',x:-12,z:16,n:'Cooking Fire'},{k:'fire',x:CAMP.x,z:CAMP.z,n:'Campfire'},{k:'cauldron',x:-19,z:8,n:'Alchemy Cauldron'},{k:'fire',x:CAVE.x-9,z:CAVE.z+12,n:'Cooking Fire'},
  {k:'forge',x:CRAFT.x-8,z:CRAFT.z-7,n:'Forge',r:5.5},{k:'tannery',x:CRAFT.x+8,z:CRAFT.z-7,n:'Tannery',r:5.5},{k:'loom',x:CRAFT.x+10,z:CRAFT.z+4,n:"Tailor's Table",r:5},{k:'sawmill',x:CRAFT.x-10,z:CRAFT.z+6,n:'Sawmill',r:6.5},{k:'fire',x:CRAFT.x+1,z:CRAFT.z+8,n:'Cooking Fire'}];
PROC='station';
for(const st of STATIONS){if(st.x===CAMP.x||Math.hypot(st.x-CRAFT.x,st.z-CRAFT.z)<CRAFT.r)continue;const y=groundH(st.x,st.z);
  if(st.k==='fire'){const g=new THREE.Group();g.position.set(st.x,y,st.z);scene.add(g);for(let i=0;i<8;i++){const a=i/8*6.28;mesh(new THREE.DodecahedronGeometry(.25,0),mat(0x6a6660),Math.cos(a)*.75,.12,Math.sin(a)*.75,g)}for(let i=0;i<4;i++){const l=mesh(new THREE.CylinderGeometry(.08,.08,1.1,6),mat(0x4a3020),0,.25,0,g);l.rotation.set(Math.PI/2,0,i*.8)}addFlame(g,0,.55,0,2.2,0xff7a20);addFlame(g,.2,.45,.1,1.4,0xffb030);
    const pot=mesh(new THREE.SphereGeometry(.4,14,10,0,Math.PI*2,Math.PI*.35,Math.PI*.65),mat(0x2a2a2a,{m:.6,r:.5,flat:false}),0,1.25,0,g);void pot;for(const s of[-1,1])mesh(new THREE.CylinderGeometry(.04,.04,1.6,6),mat(0x4a3020),s*.8,.8,0,g);mesh(new THREE.CylinderGeometry(.03,.03,1.7,6).rotateZ(Math.PI/2),mat(0x4a3020),0,1.6,0,g);addLight(st.x,y+1.4,st.z,0xff8a30,26,14);addCol(st.x,st.z,.9)}
  else{const g=new THREE.Group();g.position.set(st.x,y,st.z);g.rotation.y=.6;scene.add(g);mesh(new THREE.BoxGeometry(2,.12,1),mat(0x6a4a2a,{tex:'wood'}),0,.9,0,g);for(const a of[-1,1])for(const b of[-1,1])mesh(new THREE.BoxGeometry(.1,.9,.1),mat(0x4a3020),a*.9,.45,b*.4,g);
    const cols=[0xff4a4a,0x4a8aff,0x7aff6a,0xd88aff];for(let i=0;i<4;i++){mesh(new THREE.SphereGeometry(.12,10,8),mat(cols[i],{e:cols[i],ei:.8,flat:false}),-.6+i*.4,1.08,-.1+(i%2)*.2,g,false);mesh(new THREE.CylinderGeometry(.03,.04,.14,8),mat(0xdddddd,{t:.6}),-.6+i*.4,1.22,-.1+(i%2)*.2,g,false)}
    mesh(new THREE.CylinderGeometry(.2,.15,.3,12),mat(0x7a6a5a,{flat:false}),.7,1.1,.1,g);addCol(st.x,st.z,1.1)}}
PROC=null;
/* grass sway */
const WIND={value:0};
grassIM.material.onBeforeCompile=sh=>{sh.uniforms.uT=WIND;sh.vertexShader='uniform float uT;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfloat wph=instanceMatrix[3].x*.35+instanceMatrix[3].z*.27;float wsw=(sin(uT*1.7+wph)+sin(uT*2.9+wph*1.7)*.5)*.09*smoothstep(.05,.45,position.y);transformed.x+=wsw;transformed.z+=wsw*.4;')};
/* fireflies & embers */
function makeSparkles(list,col,size){const g=new THREE.BufferGeometry();const p=new Float32Array(list.length*3);list.forEach((v,i)=>{p[i*3]=v[0];p[i*3+1]=v[1];p[i*3+2]=v[2]});g.setAttribute('position',new THREE.BufferAttribute(p,3));const m=new THREE.Points(g,new THREE.PointsMaterial({color:col,size,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));m.userData.base=list;scene.add(m);return m}
const FIRE=[];{const r=mulberry(515);for(let i=0;i<420;i++){const x=-230+r()*460,z=-250+r()*480;if(pathDist(x,z)<4||Math.hypot(x,z)<40||Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*.9)continue;FIRE.push([x,groundH(x,z)+.6+r()*1.6,z])}}
const fireflies=makeSparkles(FIRE,0xd8ff70,.32);
const EMB=[];{const r=mulberry(616);for(let i=0;i<260;i++){const c=4+Math.floor(r()*13),rr=1+Math.floor(r()*19);if(D2MAP[rr]&&D2MAP[rr][c]!=='#'){const[x,z]=D2.pos(c,rr);EMB.push([x+r()*5-2.5,.3+r()*6,z+r()*5-2.5])}}}
const embers=makeSparkles(EMB,0xff8a30,.22);embers.material.opacity=.9;
/* moon */
const moon=new THREE.Mesh(new THREE.SphereGeometry(18,20,14),new THREE.MeshBasicMaterial({color:0xe8eef8,fog:false}));moon.renderOrder=-1;scene.add(moon);
/* day cycle: 24 real minutes, in sync for everyone */
const DAY_LEN=24*60;
const PH=[/* phase: top, horizon, suncol, sunInt, hemiSky, hemiGround, hemiInt, fog, night */
 {p:0.00,top:0x2b4f8a,hor:0xf0b890,sun:0xffc090,si:1.4,hs:0xffd8b0,hg:0x4a3a30,hi:.85,fog:0xd8b8a8,n:.15},
 {p:0.12,top:0x2a62c4,hor:0xb8d4ee,sun:0xfff0d4,si:2.4,hs:0xd6e8ff,hg:0x5a4a2a,hi:1.0,fog:0xa9c6e2,n:0},
 {p:0.42,top:0x2a62c4,hor:0xbcd6ee,sun:0xfff0d4,si:2.4,hs:0xd6e8ff,hg:0x5a4a2a,hi:1.0,fog:0xaac6e0,n:0},
 {p:0.54,top:0x3a4488,hor:0xf0a070,sun:0xffb080,si:1.5,hs:0xffc8a0,hg:0x3a3038,hi:.85,fog:0xc8a898,n:.2},
 {p:0.64,top:0x0c1430,hor:0x2e3a66,sun:0xa8b6ee,si:1.1,hs:0x7f93c8,hg:0x2c2e42,hi:1.0,fog:0x27304e,n:1},
 {p:0.90,top:0x0c1430,hor:0x2e3a66,sun:0xa8b6ee,si:1.1,hs:0x7f93c8,hg:0x2c2e42,hi:1.0,fog:0x27304e,n:1},
 {p:1.00,top:0x2b4f8a,hor:0xf0b890,sun:0xffc090,si:1.4,hs:0xffd8b0,hg:0x4a3a30,hi:.85,fog:0xd8b8a8,n:.15}];
const _ca=new THREE.Color(),_cb=new THREE.Color();
const lerpCol=(a,b,t,out)=>out.setHex(a).lerp(_cb.setHex(b),t);
const DAY={night:0,phase:0};
function updDayNight(){const p=((Date.now()/1000)%DAY_LEN)/DAY_LEN;DAY.phase=p;let i=0;while(PH[i+1].p<p)i++;const A=PH[i],B=PH[i+1],t=smooth((p-A.p)/(B.p-A.p));const L=(x,y)=>lerp(x,y,t);
  skyMat.uniforms.top.value.copy(lerpCol(A.top,B.top,t,_ca));skyMat.uniforms.hor.value.copy(lerpCol(A.hor,B.hor,t,_ca));skyMat.uniforms.sunCol.value.copy(lerpCol(A.sun,B.sun,t,_ca));
  const night=L(A.n,B.n);DAY.night=night;skyMat.uniforms.night.value=night;waterMat.uniforms.night.value=night;waterMat.uniforms.skyCol.value.copy(skyMat.uniforms.top.value).lerp(skyMat.uniforms.hor.value,.45);waterMat.uniforms.sunDir.value.copy(skyMat.uniforms.sunDir.value);waterMat.uniforms.sunCol.value.copy(skyMat.uniforms.sunCol.value);
  const ang=p*Math.PI*2-Math.PI*.1;const sunDir=new THREE.Vector3(Math.cos(ang)*.7,Math.sin(ang),.45).normalize();const moonDir=sunDir.clone().negate();moonDir.z=Math.abs(moonDir.z)+.2;moonDir.normalize();
  skyMat.uniforms.sunDir.value.copy(sunDir);skyMat.uniforms.moonDir.value.copy(moonDir);
  const useMoon=sunDir.y<.08;const dir=useMoon?moonDir:sunDir;SUN_OFF.copy(dir).multiplyScalar(120);if(SUN_OFF.y<30)SUN_OFF.y=30;
  DAY.sunInt=L(A.si,B.si);DAY.sunCol=lerpCol(A.sun,B.sun,t,new THREE.Color());if(useMoon)DAY.sunCol.set(0xb4c0ee);
  DAY.hemiInt=L(A.hi,B.hi);hemi.color.copy(lerpCol(A.hs,B.hs,t,_ca));hemi.groundColor.copy(lerpCol(A.hg,B.hg,t,_ca));
  FOG_DAY.copy(lerpCol(A.fog,B.fog,t,_ca));
  moon.position.copy(camera.position).addScaledVector(moonDir,800);moon.visible=night>.05;moon.material.color.setScalar(.6+night*.5);
  for(const m of NIGHT_MATS)m.emissiveIntensity=.35+night*1.6;
  fireflies.material.opacity=night*.95}
const pointPool=[];for(let i=0;i<5;i++){const l=new THREE.PointLight(0xffaa50,0,20,1.6);scene.add(l);pointPool.push(l)}
const torchLight=new THREE.PointLight(0xffc080,0,26,1.4);scene.add(torchLight);
/* graphics quality: hoog / middel / laag */
const GFX={rs:1,q:(()=>{try{return localStorage.getItem('velmora-gfx')}catch(e){return null}})()||(isTouch?'middel':'hoog'),auto:0};
const GFX_N={hoog:'High',middel:'Medium',laag:'Low'};
function applyGfx(){const q=GFX.q;const dpr=devicePixelRatio||1;
  /* op telefoons/tablets lager, en GFX.rs (dynamische resolutie) schaalt mee als de framerate zakt */
  renderer.setPixelRatio((isTouch?(q==='hoog'?Math.min(dpr,1.5):q==='middel'?Math.min(dpr,1):Math.min(dpr,1)*.75):(q==='hoog'?Math.min(dpr,1.75):q==='middel'?Math.min(dpr,1.25):Math.min(dpr,1)*.8))*GFX.rs);
  const sh=q!=='laag';renderer.shadowMap.enabled=sh;renderer.shadowMap.type=q==='hoog'?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;sun.castShadow=sh;
  const ms=isTouch?(q==='hoog'?2048:1024):q==='hoog'?4096:q==='middel'?2048:1024;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  GFX.post=q!=='laag';bloom.enabled=q==='hoog';gtao.enabled=q==='hoog'&&!isTouch;smaa.enabled=!isTouch||q==='hoog';const nl=q==='hoog'?5:q==='middel'?(isTouch?2:3):2;
  /* mobiel: schaduwkaart om het andere frame bijwerken */renderer.shadowMap.autoUpdate=!isTouch;renderer.shadowMap.needsUpdate=true;pointPool.forEach((l,i)=>l.visible=i<nl);grassIM.visible=q!=='laag';
  scene.traverse(o=>{if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)}});
  try{localStorage.setItem('velmora-gfx',q)}catch(e){}if(typeof resize==='function')resize()}
applyGfx();
