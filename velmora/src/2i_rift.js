/* ===================== The Nether Rift (level 25–50) =====================
   A torn-off piece of the world, far away in world space (x≈-7000), reached through the Rift Gate in the woods east of
   WindStorm. Islands of rock float above a bottomless violet void, joined by old stone bridges; crystals grow out of the
   ground and light the dark, and the sky is a nebula full of stars.
   Five regions, one per five levels, around the fortress of Riftwatch in the middle:
     Shattered Approach (25–30) west · Crystal Wastes (30–35) north · The Twisted Grove (35–40) east ·
     Voidspire Ruins (40–45) south · Throne of the Void (45–50), the highest island, far in the north-east.
   You cannot walk off an edge (the rim holds you back), but whoever flies a drake over the void and sinks too deep is
   spat back out by the Rift onto the last solid ground, a little worse for wear.
   Models: Quaternius (monsters, twisted trees, plants, mineral) and iPoly3D (crystals), all CC0 (models/rift/LICENSE.txt);
   islands, bridges, the void and the sky are generated here. */
const RIFT={x:-7000,z:0};const RSZ=1100;
const inRift=x=>x<-5000;
const RI=(u,v)=>[RIFT.x+u,RIFT.z+v];
const RIFT_VOID=-400;
/* islands: zone-local centre (u,v), radius, top height, region; s = shape seed */
const RIFT_ISLES=[
  {id:'hub',n:'Riftwatch',u:0,v:0,r:62,h:20,col:'hub'},
  {id:'a1',n:'Shattered Approach',u:-178,v:96,r:70,h:16,col:'sa'},
  {id:'a2',n:'Shattered Approach',u:-168,v:-98,r:62,h:24,col:'sa'},
  {id:'a3',n:'Shattered Approach',u:-325,v:8,r:58,h:19,col:'sa'},
  {id:'c1',n:'Crystal Wastes',u:30,v:-268,r:112,h:28,col:'cw'},
  {id:'c2',n:'Crystal Wastes',u:238,v:-218,r:68,h:34,col:'cw'},
  {id:'g1',n:'The Twisted Grove',u:268,v:46,r:104,h:22,col:'tg'},
  {id:'g2',n:'The Twisted Grove',u:398,v:178,r:60,h:27,col:'tg'},
  {id:'r1',n:'Voidspire Ruins',u:36,v:258,r:104,h:30,col:'vr'},
  {id:'r2',n:'Voidspire Ruins',u:-172,v:318,r:66,h:38,col:'vr'},
  {id:'t1',n:'Throne of the Void',u:398,v:-398,r:96,h:52,col:'tv'}];
/* small floating islets: only a flyer reaches them (a crystal or a rare vein on top) */
{const R=mulberry(9191);let k=0;for(let i=0;i<400&&k<16;i++){const u=-430+R()*860,v=-450+R()*900,r=7+R()*11;
  if(RIFT_ISLES.some(I=>Math.hypot(I.u-u,I.v-v)<I.r*1.3+r+18))continue;RIFT_ISLES.push({id:'s'+k,n:'The Void',u,v,r,h:12+R()*50,col:'islet',islet:1});k++}}
for(const I of RIFT_ISLES){[I.x,I.z]=RI(I.u,I.v);I.s=hash(Math.round(I.u),Math.round(I.v))*6.28;I.hill=I.islet?1.2:I.r>90?5:3.5}
const RISLE=Object.fromEntries(RIFT_ISLES.map(I=>[I.id,I]));
/* outline: the radius in direction a (radians) */
function riftR(I,a){return I.r*(1+.15*Math.sin(3*a+I.s)+.08*Math.sin(5*a+I.s*2.3)+.045*Math.sin(9*a+I.s*1.7))}
/* the top of an island at a point inside it (k = distance / outline radius) */
function riftTop(I,x,z,k){let h=I.h+(fbm(x*.018+I.s,z*.018-I.s)-.5)*I.hill*2;h-=2.4*smooth(clamp((k-.8)/.2,0,1));
  if(I.id==='hub'){const d=Math.hypot(x-I.x,z-I.z);h=lerp(I.h,h,smooth(clamp((d-34)/14,0,1)))}/* the fortress stands on level ground */
  return h}
/* bridges between the islands: from rim to rim, a little into each island */
const RIFT_BR=[];
for(const[a,b]of[['hub','a1'],['hub','a2'],['a1','a3'],['a2','a3'],['hub','c1'],['c1','c2'],['hub','g1'],['g1','g2'],['hub','r1'],['r1','r2'],['c2','t1'],['g1','c2'],['a2','c1'],['a1','r2']]){
  const A=RISLE[a],B=RISLE[b];const dx=B.x-A.x,dz=B.z-A.z,L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L;
  const ea=riftR(A,Math.atan2(dz,dx))-4,eb=riftR(B,Math.atan2(-dz,-dx))-4;const x0=A.x+ux*ea,z0=A.z+uz*ea,x1=B.x-ux*eb,z1=B.z-uz*eb;
  const y0=riftTop(A,x0,z0,ea/riftR(A,Math.atan2(dz,dx))),y1=riftTop(B,x1,z1,eb/riftR(B,Math.atan2(-dz,-dx)));
  RIFT_BR.push({a,b,x0,z0,y0,x1,z1,y1,w:7,len:Math.hypot(x1-x0,z1-z0),ux,uz})}
/* where you stand: an island, a bridge or nothing (the void) */
function riftIsle(x,z){for(const I of RIFT_ISLES){const dx=x-I.x,dz=z-I.z;if(Math.abs(dx)>I.r*1.3||Math.abs(dz)>I.r*1.3)continue;const d=Math.hypot(dx,dz),R=riftR(I,Math.atan2(dz,dx));if(d<R)return{I,d,R}}return null}
function riftBridge(x,z){let best=null;for(const B of RIFT_BR){const px=x-B.x0,pz=z-B.z0;const t=px*B.ux+pz*B.uz;if(t<-1||t>B.len+1)continue;const c=Math.abs(-px*B.uz+pz*B.ux);if(c>B.w/2)continue;const f=clamp(t/B.len,0,1);
  const y=lerp(B.y0,B.y1,smooth(f))+Math.sin(f*Math.PI)*Math.min(3,B.len*.03);if(!best||y>best.y)best={B,t,c,y}}return best}
function riftH(x,z){const s=riftIsle(x,z),b=riftBridge(x,z);if(s){const h=riftTop(s.I,x,z,s.d/s.R);return b?Math.max(h,b.y):h}return b?b.y:RIFT_VOID}
function riftWalk(x,z,m=0){const s=riftIsle(x,z);if(s&&s.d<s.R-m)return true;const b=riftBridge(x,z);return !!(b&&b.c<b.B.w/2-m)}
/* keep walkers on solid ground: a step over the edge is pushed back to the nearest rim or bridge side */
function riftCollide(p,r){p.x=clamp(p.x,RIFT.x-RSZ/2+10,RIFT.x+RSZ/2-10);p.z=clamp(p.z,RIFT.z-RSZ/2+10,RIFT.z+RSZ/2-10);const m=Math.min(.6,r*.8+.1);if(riftWalk(p.x,p.z,m))return;
  let bx=p.x,bz=p.z,bd=1e9;
  for(const I of RIFT_ISLES){const dx=p.x-I.x,dz=p.z-I.z;if(Math.abs(dx)>I.r*1.6+8||Math.abs(dz)>I.r*1.6+8)continue;const a=Math.atan2(dz,dx),R=riftR(I,a)-m-.05;const qx=I.x+Math.cos(a)*R,qz=I.z+Math.sin(a)*R,d=Math.hypot(p.x-qx,p.z-qz);if(d<bd){bd=d;bx=qx;bz=qz}}
  for(const B of RIFT_BR){const px=p.x-B.x0,pz=p.z-B.z0;const t=clamp(px*B.ux+pz*B.uz,0,B.len);let c=-px*B.uz+pz*B.ux;c=clamp(c,-(B.w/2-m-.05),B.w/2-m-.05);const qx=B.x0+B.ux*t-B.uz*c,qz=B.z0+B.uz*t+B.ux*c,d=Math.hypot(p.x-qx,p.z-qz);if(d<bd){bd=d;bx=qx;bz=qz}}
  if(bd<12){p.x=bx;p.z=bz}}
function riftZone(x,z){const s=riftIsle(x,z);if(s)return s.I.n;const b=riftBridge(x,z);if(b){const A=RISLE[b.B.a],B2=RISLE[b.B.b];return b.t<b.B.len/2?A.n:B2.n}return'The Void'}
/* landmarks */
const RIFT_W=riftR(RISLE.hub,Math.PI);
const RIFT_EXIT={x:RISLE.hub.x-(RIFT_W-8),z:RISLE.hub.z};/* the gate home, on the west rim of Riftwatch */
const RIFT_ENTRY={x:RIFT_EXIT.x+9,z:RIFT_EXIT.z+2};
const RIFT_GATE={x:ELV.x+175,z:ELV.z-60};/* in the woods east of WindStorm */
/* the gate down to the Sanctum of the Silent Song: on the Throne island, on the far side from the long bridge */
const SANCTUM_GATE=(()=>{const I=RISLE.t1,C=RISLE.c2;const a=Math.atan2(I.z-C.z,I.x-C.x);const d=Math.min(60,riftR(I,a)-16);return{x:I.x+Math.cos(a)*d,z:I.z+Math.sin(a)*d,ry:Math.atan2(-Math.cos(a),-Math.sin(a))}})();
/* the gate to the Void Citadel (the raid): also on the Throne island, a quarter turn further round */
const CITADEL_GATE=(()=>{const I=RISLE.t1,C=RISLE.c2;const a=Math.atan2(I.z-C.z,I.x-C.x)+1.6;const d=Math.min(60,riftR(I,a)-16);return{x:I.x+Math.cos(a)*d,z:I.z+Math.sin(a)*d,ry:Math.atan2(-Math.cos(a),-Math.sin(a))}})();
/* ---- materials: toon with vertex colours and a per-vertex glow (veins of light in the rock, cracks in the crystal fields) ---- */
function riftGlowMat(o={}){const m=new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP,...o});
  m.onBeforeCompile=sh=>{sh.vertexShader='attribute float glow;\nvarying float vGlow;\n'+sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow=glow;');
    sh.fragmentShader='varying float vGlow;\n'+sh.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vColor.rgb*vGlow*2.4;')};
  m.customProgramCacheKey=function(){return THREE.Material.prototype.customProgramCacheKey.call(this)+'|riftglow'};return m}
/* colours per region: ground a→b, patches, and the colour of the glowing cracks */
const RIFT_COL={hub:{a:0x5a5672,b:0x726c8e,p:0x7e7a96,g:0x9a7aff,gk:0},sa:{a:0x48466a,b:0x5e5a84,p:0x3a6a74,g:0xb07aff,gk:.5},cw:{a:0x6a70a0,b:0x9aa0d4,p:0xc8d0f8,g:0x8af4ff,gk:.9},
  tg:{a:0x2e4a4a,b:0x40645a,p:0x5e3470,g:0x6affc8,gk:.45},vr:{a:0x625c6e,b:0x7c7488,p:0x443a56,g:0xc06aff,gk:.6},tv:{a:0x3c3048,b:0x584268,p:0x7a2460,g:0xff4ab0,gk:.9},islet:{a:0x46425c,b:0x5c5676,p:0x7a5aa8,g:0xb07aff,gk:.3}};
const _rc=new THREE.Color(),_rc2=new THREE.Color();
/* ---- the islands: a top of solid ground and a jagged underside of rock hanging into the void ---- */
const riftLand=(()=>{const TP=[],TC=[],TU=[],TG=[],TI=[],UP=[],UC=[],UG=[],UI=[];const ROCK=new THREE.Color(0x7a7090),ROCK2=new THREE.Color(0x3a3050),RIM=new THREE.Color(0x6a6278);
  for(const I of RIFT_ISLES){const C=RIFT_COL[I.col],A=new THREE.Color(C.a),B=new THREE.Color(C.b),PT=new THREE.Color(C.p),GL=new THREE.Color(C.g);
    const NR=Math.max(4,Math.ceil(I.r/4.2)),NS=clamp(Math.round(I.r*1.4),28,150);
    /* top: a centre point and rings out to the rim */
    const base=TP.length/3;const top=(x,z,k)=>{const y=riftTop(I,x,z,k);TP.push(x,y,z);TU.push(x/16,z/16);
      const n=fbm(x*.03+I.s,z*.03),n2=vnoise(x*.15,z*.15);_rc.copy(A).lerp(B,n);if(n2>.64)_rc.lerp(PT,.5);if(fbm(x*.011+40,z*.011)>.58)_rc.lerp(PT,.3);if(k>.86)_rc.lerp(RIM,smooth((k-.86)/.14)*.7);
      const cr=(1-smooth(clamp(Math.abs(fbm(x*.06+I.s*3,z*.06)-.5)/.012,0,1)))*smooth(clamp((vnoise(x*.02+I.s,z*.02)-.35)/.2,0,1));const g=C.gk*cr*(k<.95?1:0);if(g>.02)_rc.lerp(GL,g*.8);
      const j=.92+hash(Math.round(x*7),Math.round(z*7))*.14;TC.push(_rc.r*j,_rc.g*j,_rc.b*j);TG.push(g*.4);return y};
    top(I.x,I.z,0);const rimY=[];
    for(let i=1;i<=NR;i++)for(let j=0;j<NS;j++){const a=j/NS*Math.PI*2,R=riftR(I,a)*(i/NR),x=I.x+Math.cos(a)*R,z=I.z+Math.sin(a)*R;const y=top(x,z,i/NR);if(i===NR)rimY.push(y)}
    for(let j=0;j<NS;j++){const j2=(j+1)%NS;TI.push(base,base+1+j2,base+1+j)}
    for(let i=1;i<NR;i++)for(let j=0;j<NS;j++){const j2=(j+1)%NS,a=base+1+(i-1)*NS+j,b=base+1+(i-1)*NS+j2,c=base+1+i*NS+j,d=base+1+i*NS+j2;TI.push(a,b,c,b,d,c)}
    /* underside: rings shrinking towards a point far below; ragged, with veins of light */
    const ub=UP.length/3,NU=I.islet?5:8,depth=I.r*(I.islet?1.5:1.0);
    for(let u=0;u<=NU;u++){const f=u/NU;for(let j=0;j<NS;j++){const a=j/NS*Math.PI*2,R=riftR(I,a);const jag=1+(vnoise(a*5+I.s,f*6+I.s)-.5)*.35*Math.min(1,f*3);const sc=Math.max(.02,(1-Math.pow(f,.85))*jag)*(u===0?1:.97);
      const x=I.x+Math.cos(a)*R*sc,z=I.z+Math.sin(a)*R*sc;const y=u===0?rimY[j]-.05:rimY[j]-depth*Math.pow(f,1.25)-(vnoise(a*9,f*11+I.s)-.5)*depth*.12*f;UP.push(x,y,z);
      _rc.copy(ROCK).lerp(ROCK2,Math.min(1,f*1.2));const vein=smooth(clamp((vnoise(a*7+I.s*2,f*9)-.66)/.08,0,1))*smooth(clamp((f-.08)/.2,0,1));if(vein>0)_rc.lerp(GL,vein*.7);UC.push(_rc.r,_rc.g,_rc.b);UG.push(.08+vein*.45)}}
    const tip=UP.length/3;UP.push(I.x,rimY[0]-depth*1.08,I.z);UC.push(ROCK2.r,ROCK2.g,ROCK2.b);UG.push(0);
    for(let u=0;u<NU;u++)for(let j=0;j<NS;j++){const j2=(j+1)%NS,a=ub+u*NS+j,b=ub+u*NS+j2,c=ub+(u+1)*NS+j,d=ub+(u+1)*NS+j2;UI.push(a,c,b,b,c,d)}
    for(let j=0;j<NS;j++){const j2=(j+1)%NS;UI.push(ub+NU*NS+j,tip,ub+NU*NS+j2)}}
  /* bridges: a paved deck with low kerbs, stone sides and a keel of rock underneath */
  const DECK=new THREE.Color(0x968ca8),KERB=new THREE.Color(0x7a7090),SIDE=new THREE.Color(0x5e5672);
  for(const Br of RIFT_BR){const n=Math.max(2,Math.ceil(Br.len/2)),px=-Br.uz,pz=Br.ux,hw=Br.w/2;const b0=TP.length/3;
    const yAt=f=>lerp(Br.y0,Br.y1,smooth(f))+Math.sin(f*Math.PI)*Math.min(3,Br.len*.03);
    const cols=[[-hw-.4,.35,KERB],[-hw,.35,KERB],[-hw,0,DECK],[hw,0,DECK],[hw,.35,KERB],[hw+.4,.35,KERB]];
    for(let i=0;i<=n;i++){const f=i/n,cx=Br.x0+Br.ux*Br.len*f,cz=Br.z0+Br.uz*Br.len*f,y=yAt(f)+.04;for(const[o,dy,col]of cols){const x=cx+px*o,z=cz+pz*o;TP.push(x,y+dy,z);TU.push(x/16,z/16);const j=.9+hash(i*3,Math.round(o*10))*.15;TC.push(col.r*j,col.g*j,col.b*j);TG.push(0)}}
    for(let i=0;i<n;i++)for(let k=0;k<5;k++){const a=b0+i*6+k,b=a+1,c=a+6,d=a+7;TI.push(a,c,b,b,c,d)}
    /* sides and keel */const s0=UP.length/3;
    for(let i=0;i<=n;i++){const f=i/n,cx=Br.x0+Br.ux*Br.len*f,cz=Br.z0+Br.uz*Br.len*f,y=yAt(f)+.39,keel=1.6+2.8*Math.sin(f*Math.PI)+(vnoise(i*.7,Br.len)-.5)*1.4;
      for(const[o,dy]of[[-hw-.4,0],[-hw-.4,-1.4],[0,-1.4-keel],[hw+.4,-1.4],[hw+.4,0]]){UP.push(cx+px*o,y+dy,cz+pz*o);_rc.copy(SIDE).lerp(ROCK2,clamp(-dy/4,0,1));UC.push(_rc.r,_rc.g,_rc.b);UG.push(.08)}}
    for(let i=0;i<n;i++)for(let k=0;k<4;k++){const a=s0+i*5+k,b=a+1,c=a+5,d=a+6;UI.push(a,b,c,b,d,c)}}
  const mk=(P,C,G,Ix,U)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('glow',new THREE.Float32BufferAttribute(G,1));if(U)g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setIndex(Ix);g.computeVertexNormals();return g};
  const tex=TEX.paint.clone();tex.needsUpdate=true;tex.repeat.set(1,1);
  const top=new THREE.Mesh(mk(TP,TC,TG,TI,TU),riftGlowMat({map:tex,bumpMap:tex,bumpScale:.1}));top.receiveShadow=true;scene.add(top);
  const under=new THREE.Mesh(mk(UP,UC,UG,UI),riftGlowMat({side:THREE.DoubleSide}));under.receiveShadow=false;scene.add(under);
  return{top,under}})();
/* ---- the void below: a slow swirl of violet and teal with stars, far under the islands ---- */
const RIFT_VOID_U={time:{value:0},vis:{value:0}};
const riftAbyss=(()=>{const g=new THREE.PlaneGeometry(5200,5200,1,1);g.rotateX(-Math.PI/2);
  const m=new THREE.ShaderMaterial({uniforms:RIFT_VOID_U,depthWrite:false,fog:false,transparent:false,
    vertexShader:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
    fragmentShader:`uniform float time,vis;varying vec3 vW;
      float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n1(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1.,0.)),f.x),mix(h1(i+vec2(0.,1.)),h1(i+vec2(1.,1.)),f.x),f.y);}
      float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=n1(p)*a;p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
      void main(){vec2 p=(vW.xz-vec2(${RIFT.x.toFixed(1)},${RIFT.z.toFixed(1)}))*.0022;float r=length(p);float a=atan(p.y,p.x);
        vec2 q=vec2(a*1.6+time*.012+r*2.2,r*3.-time*.02);float n=fb(q*2.2),m=fb(q*4.+n*1.6+vec2(time*.01,0.));
        vec3 c=mix(vec3(.025,.012,.05),vec3(.2,.07,.34),smoothstep(.35,.85,n));c=mix(c,vec3(.06,.36,.42),smoothstep(.58,.9,m)*.55);
        float st=step(.9975,h1(floor(vW.xz*.35)))*(.6+.4*sin(time*2.+h1(floor(vW.xz*.35))*40.));c+=vec3(.8,.75,1.)*st*.7;
        c*=1.-smoothstep(1.1,2.4,r)*.8;gl_FragColor=vec4(c*vis,1.);}`});
  const o=new THREE.Mesh(g,m);o.position.set(RIFT.x,-170,RIFT.z);o.renderOrder=-1;o.userData.dyn=1;o.frustumCulled=false;scene.add(o);return o})();
/* ---- Riftwatch: the fortress of the Rift Wardens on the middle island ---- */
const RW={x:RISLE.hub.x,z:RISLE.hub.z};const RW_H=RISLE.hub.h;
const RW_B=[];/* buildings: model, local position, rotation, scale, footprint */
{const B=(m,u,v,ry,s,fp)=>{const x=RW.x+u,z=RW.z+v,w=fp[0]*s,d=fp[1]*s;RW_B.push({m:'H_'+m,x,z,ry,s});const ax=Math.cos(ry),az=-Math.sin(ry),n=Math.max(1,Math.round(w/Math.min(w,d)));const cr=Math.min(w,d)*.44;for(let k=0;k<n;k++){const o=(k-(n-1)/2)*(w/n);addCol(x+ax*o,z+az*o,cr,false,s*.9)}};
  B('castle_blue',0,-24,0,11,TFP.castle);B('tavern_red',25,10,-Math.PI/2,11,TFP.tavern);B('barracks_blue',-26,-6,Math.PI/2,9,TFP.barracks);B('blacksmith_red',22,-16,-Math.PI/2*.8,8,[1.3,1.25]);
  for(const[u,v]of[[-31,-30],[31,-31],[-27,30],[29,30]])B('tower_A_blue',u,v,0,5.5,TFP.tower_A)}
const RW_NPC_SPOTS={kaelen:[0,-11,0],nyra:[7,9,-Math.PI*.75],oswin:[14,-16,Math.PI/2],tessa:[-13,15,Math.PI*.75],brom:[16,11,Math.PI/2],lyra:[-22,20,Math.PI*.6]};
const RW_NPCS=[
  {id:'kaelen',n:'Commander Kaelen Duskmantle',t:'Rift Wardens',look:{skin:0xd9a98a,hair:0x2a2a30,chest:0x3a2a5a,pants:0x22202a,cape:0x4a2a8a,wt:'zwaard',helm:1,beard:1},hi:'You came through the Gate? Good. Riftwatch needs every blade it can get. The Rift is spreading, and what crawls out of the void grows stronger the further you go.'},
  {id:'nyra',n:'Voidseer Nyra',t:'Circle of the Falls',look:{skin:0xe8c8a8,hair:0xd8e8ff,chest:0x2a2a6a,pants:0x1a1a3a,cape:0x5a3aaa,wt:'staf'},hi:'Listen… the crystals hum. Every island hums a different note. Somewhere out there, something is singing them all at once.'},
  {id:'oswin',n:'Quartermaster Oswin',t:'Arms of Riftwatch',look:{skin:0xd99b7a,hair:0x8a8a8a,chest:0x4a4a5a,pants:0x2a2a30,wt:'bijl',dwarf:1,beard:1},hi:'Steel tempered in void-light. It holds an edge out here, which is more than most things do.',gearshop:1},
  {id:'tessa',n:'Provisioner Tessa',t:'Supplies',look:{skin:0xe2b48e,hair:0x6a2a5a,chest:0x5a3a6a,pants:0x3a2a3a,wt:'none'},hi:'Potions, food, bandages. And I buy anything you bring back from the islands, crystals especially.',shop:1},
  {id:'brom',n:'Innkeeper Brom',t:'The Last Lantern',look:{skin:0xd9a98a,hair:0x4a3020,chest:0x6a3a2a,pants:0x3a2a20,wt:'none',beard:1},hi:'Welcome to the Last Lantern, the only warm hearth this side of the Gate. Rest here and your hearthstone brings you back.',inn:'rw'},
  {id:'lyra',n:'Skymistress Lyra',t:'Drake Roost',look:{skin:0xf0d2b8,hair:0x2a1a3a,chest:0x3a2a4a,pants:0x2a2030,cape:0x6a3aa8,wt:'none'},hi:'Out here a drake is not a luxury, it is how you get home when a bridge falls. The Nether Drakes were born in this light.',stable:1}];
/* field camps of the Rift Wardens, a little way in from the bridge that leads to each region */
const RIFT_CAMPS=(()=>{const at=(bi,end,d)=>{const B=RIFT_BR[bi];return end?{x:B.x1+B.ux*d,z:B.z1+B.uz*d,ry:Math.atan2(-B.ux,-B.uz)}:{x:B.x0-B.ux*d,z:B.z0-B.uz*d,ry:Math.atan2(B.ux,B.uz)}};
  return{sela:at(4,1,13),fennick:at(6,1,13),pell:at(8,1,13),ardyn:at(10,0,13)}})();
RW_NPCS.push(
  {id:'sela',n:'Warden Sela',t:'Rift Wardens · Crystal Wastes',look:{skin:0xe2b48e,hair:0xd8d8e8,chest:0x3a3a6a,pants:0x22222e,cape:0x4a6ab8,wt:'boog'},hi:'Mind the crystals. Some of them bite.'},
  {id:'fennick',n:'Druid Fennick',t:'The Twisted Grove',look:{skin:0xd9a98a,hair:0x6a5a3a,chest:0x3a5a4a,pants:0x2a3a2a,cape:0x2a6a5a,wt:'staf',beard:1},hi:'Even here, in the void, trees want to grow. I mean to let them.'},
  {id:'pell',n:'Archivist Pell',t:'Voidspire Ruins',look:{skin:0xf0d2b8,hair:0x8a8a8a,chest:0x5a4a3a,pants:0x3a3028,wt:'none',beard:1},hi:'Every wall here is a page. Most of them are screaming.'},
  {id:'ardyn',n:'Captain Ardyn',t:'Rift Wardens · the long bridge',look:{skin:0xc8906a,hair:0x1a1a1a,chest:0x4a2a3a,pants:0x2a2028,cape:0x6a1a3a,wt:'zwaard',helm:1},hi:'Beyond this bridge lies the Throne of the Void. Nothing comes back from there unless we bring it back.'});
for(const id in RIFT_CAMPS){const c=RIFT_CAMPS[id];RW_NPC_SPOTS[id]=null;addLight(c.x,riftH(c.x,c.z)+2,c.z,0xffb060,24,14);addCol(c.x+Math.sin(c.ry+1.2)*5,c.z+Math.cos(c.ry+1.2)*5,2.2)}
for(const n of RW_NPCS)if(RIFT_CAMPS[n.id]){const c=RIFT_CAMPS[n.id];NPCS.push({...n,x:c.x,z:c.z,ry:c.ry})}
for(const n of RW_NPCS){if(RIFT_CAMPS[n.id])continue;const[u,v,ry]=RW_NPC_SPOTS[n.id];NPCS.push({...n,x:RW.x+u,z:RW.z+v,ry})}
/* the anchor: a great crystal floating above the plaza that holds the island together */
const RW_ANCHOR={x:RW.x,z:RW.z+4};addCol(RW_ANCHOR.x,RW_ANCHOR.z,2.4);addLight(RW_ANCHOR.x,RW_H+5,RW_ANCHOR.z,0x9a6aff,40,30,false);
for(const[u,v]of[[-12,-6],[12,-6],[-12,16],[12,16]]){addCol(RW.x+u,RW.z+v,.8);addLight(RW.x+u,RW_H+2.6,RW.z+v,0xb08aff,16,12)}
/* ---- the Rift Gate in Elvia and the gate home at Riftwatch ---- */
const RIFT_PORTAL=portalMesh(0xa05aff,2.6,RIFT_GATE.x,elvH(RIFT_GATE.x,RIFT_GATE.z),RIFT_GATE.z,Math.PI/2);
const RIFT_PORTAL2=portalMesh(0x7ad8ff,2.6,RIFT_EXIT.x,riftH(RIFT_EXIT.x,RIFT_EXIT.z),RIFT_EXIT.z,Math.PI/2);
for(const[gx,gz,gy,c]of[[RIFT_GATE.x,RIFT_GATE.z,elvH(RIFT_GATE.x,RIFT_GATE.z),0xb07aff],[RIFT_EXIT.x,RIFT_EXIT.z,riftH(RIFT_EXIT.x,RIFT_EXIT.z),0x7ad8ff]])for(const sd of[-1,1]){addCol(gx,gz+sd*1.58*2.6,.46*2.6);const cz=gz+sd*(2.05*2.6+1.4);addCol(gx,cz,1.1);addFlame(scene,gx,gy+6.35,cz,1.6,c);addLight(gx,gy+6.8,cz,c,26,16)}
/* ---- overview picture for the minimap and the world map ---- */
const riftImg=(()=>{const W=440,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');g.fillStyle='#120a1e';g.fillRect(0,0,W,W);const d=g.getImageData(0,0,W,W);
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const wx=RIFT.x-RSZ/2+x*RSZ/W,wz=RIFT.z-RSZ/2+y*RSZ/W;const o=(y*W+x)*4;const s=riftIsle(wx,wz);
    if(s){const C=RIFT_COL[s.I.col];_rc.setHex(C.b).lerp(_rc2.setHex(C.a),fbm(wx*.03,wz*.03));const e=s.d/s.R>.93?.6:1;d.data[o]=Math.pow(_rc.r,1/2.2)*255*e;d.data[o+1]=Math.pow(_rc.g,1/2.2)*255*e;d.data[o+2]=Math.pow(_rc.b,1/2.2)*255*e}
    else if(riftBridge(wx,wz)){d.data[o]=150;d.data[o+1]=140;d.data[o+2]=165}
    else{const n=fbm(wx*.006,wz*.006);d.data[o]=18+n*30;d.data[o+1]=10+n*10;d.data[o+2]=30+n*44}d.data[o+3]=255}
  g.putImageData(d,0,0);return c})();
/* ---- models (async, while loading) ---- */
const RIFT_SPIN=[];
/* many copies of one model, recoloured: the model's own shading (as brightness) times a colour, with an optional glow */
const _riftGeo=new Map();
async function riftGeoOf(name){let p=_riftGeo.get(name);if(!p){p=loadEnv(name).then(g=>g?envMerged(g):null);_riftGeo.set(name,p)}return p}
async function riftInst(name,items,{col=0xffffff,glow=null,gi=.6,cast=true,lum=true}={}){if(!items.length)return null;const src=await riftGeoOf(name);if(!src)return null;const geo=src.clone();
  const c=geo.attributes.color.array,C=new THREE.Color(col);let mx=0;for(let i=0;i<c.length;i+=3)mx=Math.max(mx,c[i]*.3+c[i+1]*.59+c[i+2]*.11);
  for(let i=0;i<c.length;i+=3){const l=lum?(c[i]*.3+c[i+1]*.59+c[i+2]*.11)/(mx||1)*.85+.15:1;c[i]=(lum?l:c[i])*C.r;c[i+1]=(lum?l:c[i+1])*C.g;c[i+2]=(lum?l:c[i+2])*C.b}
  const mt=glow!=null?new THREE.MeshToonMaterial({vertexColors:true,gradientMap:RAMP,emissive:new THREE.Color(glow),emissiveIntensity:gi}):ENV_MAT;
  const im=new THREE.InstancedMesh(geo,mt,items.length);items.forEach((t,i)=>{_p.set(t.x,t.y??riftH(t.x,t.z)-.1,t.z);_e.set(t.rx||0,t.ry||0,t.rz||0);_q.setFromEuler(_e);_s.set(t.sx||t.s||1,t.sy||t.s||1,t.sz||t.s||1);_m.compose(_p,_q,_s);im.setMatrixAt(i,_m)});
  im.castShadow=cast;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im);return im}
/* textured models (the twisted trees and big plants): one InstancedMesh per part, recoloured in the shader by brightness */
const _riftTexMat=new Map();
function riftTexMat(src,tint,leaf){const k=src.uuid+'|'+tint+'|'+leaf;let m=_riftTexMat.get(k);if(m)return m;
  m=new THREE.MeshToonMaterial({map:src.map||null,gradientMap:RAMP,alphaTest:leaf?.42:0,side:leaf?THREE.DoubleSide:THREE.FrontSide,transparent:false});if(m.map)m.map.colorSpace=THREE.SRGBColorSpace;
  const T={rT:{value:new THREE.Color(tint)}};m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,T);sh.fragmentShader='uniform vec3 rT;\n'+sh.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(.3,.59,.11)))*rT*(leafK);')};
  if(leaf){m.emissive=new THREE.Color(tint).multiplyScalar(.22)}m.onBeforeCompile=((ob)=>sh=>{ob(sh);sh.fragmentShader=sh.fragmentShader.replace('(leafK)',leaf?'4.2':'2.6')})(m.onBeforeCompile);
  m.customProgramCacheKey=function(){return THREE.Material.prototype.customProgramCacheKey.call(this)+'|rtex'+(leaf?'L':'B')};_riftTexMat.set(k,m);return m}
async function riftTexInst(file,node,items,{leaf=0x7a4aff,bark=0x6a5a7a,h=10}={}){if(!items.length)return;const g=await loadEnv(file);if(!g)return;const root=node?g.scene.getObjectByName(node):g.scene;if(!root)return;
  root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert();const parts=[];const box=new THREE.Box3();
  root.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.clone();geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));geo.computeBoundingBox();box.union(geo.boundingBox);parts.push({geo,src:o.material})});
  const nh=box.max.y-box.min.y||1;
  for(const P of parts){const isLeaf=/leaf|leaves/i.test(P.src.name)||P.src.alphaMode==='MASK'||P.src.transparent;const im=new THREE.InstancedMesh(P.geo,riftTexMat(P.src,isLeaf?leaf:bark,isLeaf),items.length);
    items.forEach((t,i)=>{const s=(t.h||h)/nh;_p.set(t.x,riftH(t.x,t.z)-.2-box.min.y*s,t.z);_e.set(0,t.ry||0,0);_q.setFromEuler(_e);_s.set(s,s,s);_m.compose(_p,_q,_s);im.setMatrixAt(i,_m)});
    im.castShadow=!isLeaf;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im)}}
async function buildRift(){if(window.__NOGLTF)return;const R=mulberry(8181);const jobs=[];const STONE=new THREE.Color(.74,.68,.92);
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  /* places on an island: away from its rim, the bridge heads and Riftwatch */
  const heads=RIFT_BR.flatMap(b=>[[b.x0,b.z0],[b.x1,b.z1]]);
  const okI=(I,x,z,clear=3)=>{const s=riftIsle(x,z);if(!s||s.I!==I||s.d>s.R-clear-1.5)return false;if(heads.some(h=>Math.hypot(h[0]-x,h[1]-z)<clear+7))return false;if(riftBridge(x,z))return false;if(I.id==='hub'&&Math.hypot(x-RW.x,z-RW.z)<52)return false;if(Math.hypot(x-SANCTUM_GATE.x,z-SANCTUM_GATE.z)<16||Math.hypot(x-CITADEL_GATE.x,z-CITADEL_GATE.z)<18)return false;return true};
  const scatter=(I,n,clear,f)=>{const L=[];for(let i=0;i<n*30&&L.length<n;i++){const a=R()*6.28,d=Math.sqrt(R())*I.r*1.15,x=I.x+Math.cos(a)*d,z=I.z+Math.sin(a)*d;if(!okI(I,x,z,clear))continue;if(L.some(t=>Math.hypot(t.x-x,t.z-z)<clear*1.6))continue;L.push(f?f(x,z):{x,z,ry:R()*6.28,s:1})}return L};
  const isles=k=>RIFT_ISLES.filter(I=>I.col===k);
  const crystals=['../rift/Crystal_1','../rift/Crystal_3','../rift/Crystal_6','../rift/Crystal_7','../rift/Crystal_2'],smallC=['../rift/Crystal_4','../rift/Crystal_8','../rift/Crystal_9','../rift/Crystal_5'];
  const crys=(names,list,col,glow,gi)=>{const by=names.map(()=>[]);list.forEach((t,i)=>by[i%names.length].push(t));names.forEach((n,i)=>jobs.push(riftInst(n,by[i],{col,glow,gi})))};
  const sz=(lo,hi)=>(x,z)=>({x,z,ry:R()*6.28,s:lo+R()*(hi-lo),rz:(R()-.5)*.25,rx:(R()-.5)*.25});
  /* Shattered Approach: broken ground, violet shards, strange plants and a few bare twisted trees */
  {const C=[],SC=[],RK=[],COL=[],PL=[],TR=[];for(const I of isles('sa')){C.push(...scatter(I,10,3,sz(.28,.5)));SC.push(...scatter(I,22,1.5,sz(.18,.35)));RK.push(...scatter(I,18,2.5,sz(1.2,3)));COL.push(...scatter(I,6,3,(x,z)=>({x,z,ry:R()*6.28,s:1})));PL.push(...scatter(I,40,1.2,sz(.9,1.5)));TR.push(...scatter(I,4,6,(x,z)=>({x,z,ry:R()*6.28,h:8+R()*3})))}
    crys(crystals,C,0xb08aff,0x7a3aff,.55);crys(smallC,SC,0xc8a0ff,0x8a4aff,.7);
    jobs.push(riftInst('Rock_2',RK.filter((t,i)=>i%2),{col:0x6a6080}));jobs.push(riftInst('Rock_5',RK.filter((t,i)=>!(i%2)),{col:0x5a5070}));
    for(const t of COL)jobs.push(put(R()<.5?'MD_Column_Broken':'MD_Column_Broken2',t.x,t.z,t.ry,[1.4,1.6,1.4]).then(o=>tintObj(o,STONE)));
    jobs.push(riftInst('../rift/Plant_1',PL.filter((t,i)=>i%2),{col:0xd08aff,glow:0x6a2a9a,gi:.4,cast:false}));jobs.push(riftInst('../rift/Plant_2',PL.filter((t,i)=>!(i%2)),{col:0x6ae8ff,glow:0x1a6a8a,gi:.4,cast:false}));
    jobs.push(riftTexInst('../rift/TwistedTrees','Tree2',TR,{leaf:0x3a2a5a,bark:0x4a4258,h:9}));
    for(const t of[...C,...RK.filter(t=>t.s>1.8)])addCol(t.x,t.z,1.2*(t.s||1))}
  /* Crystal Wastes: forests of glowing crystal, pale ground and pink mineral blooms */
  {const C=[],SC=[],MN=[],RK=[];for(const I of isles('cw')){C.push(...scatter(I,I.r>90?70:30,3.2,sz(.45,1.1)));SC.push(...scatter(I,60,1.4,sz(.2,.4)));MN.push(...scatter(I,26,1.5,sz(2.4,4)));RK.push(...scatter(I,14,3,sz(1.4,3)))}
    crys(crystals,C,0xa8e8ff,0x3ab0ff,.75);crys(smallC,SC,0xe0f4ff,0x6ad8ff,.85);jobs.push(riftInst('../rift/Mineral',MN,{col:0xffffff,lum:false,glow:0x8a1a6a,gi:.5}));jobs.push(riftInst('Rock_3',RK,{col:0x9a9ac0}));
    for(const t of C)addCol(t.x,t.z,2.8*t.s);for(const t of RK)if(t.s>2)addCol(t.x,t.z,1.1*t.s)}
  /* The Twisted Grove: a dark forest of twisted trees with teal and violet crowns, giant leaves and glowing petals */
  {const T=[],BG=[],PE=[],P3=[],SC=[];for(const I of isles('tg')){T.push(...scatter(I,I.r>90?42:18,5,(x,z)=>({x,z,ry:R()*6.28,h:10+R()*5})));BG.push(...scatter(I,45,2,sz(1,1.6)));PE.push(...scatter(I,40,1.5,sz(1.1,1.9)));P3.push(...scatter(I,50,1.2,sz(1,1.8)));SC.push(...scatter(I,25,1.5,sz(.18,.32)))}
    const tv=[[],[],[],[],[]];T.forEach((t,i)=>tv[i%5].push(t));tv.forEach((L,i)=>jobs.push(riftTexInst('../rift/TwistedTrees','Tree'+(i+1),L,{leaf:i%2?0x2ab8a8:0x8a3ad8,bark:0x4a3a4a})));
    jobs.push(riftTexInst('../rift/PlantBig_1',null,BG,{leaf:0x2a9a8a,bark:0x2a9a8a,h:3.2}));jobs.push(riftTexInst('../rift/Plant_3',null,P3,{leaf:0x5a3aa8,bark:0x5a3aa8,h:1.4}));
    jobs.push(riftInst('../rift/PlantBig_2',PE,{col:0xd06aff,glow:0x8a2ad8,gi:.6,cast:false,lum:false}));crys(smallC,SC,0x8affd8,0x2ad8a8,.8);
    for(const t of T)addCol(t.x,t.z,.9,true)}
  /* Voidspire Ruins: the walls, columns and arches of a city that fell into the Rift, overgrown with violet shards */
  {const W=[],COL=[],AR=[],OB=[],C=[],DT=[];for(const I of isles('vr')){W.push(...scatter(I,18,4,(x,z)=>({x,z,ry:R()*6.28})));COL.push(...scatter(I,24,2.5,(x,z)=>({x,z,ry:R()*6.28})));AR.push(...scatter(I,5,5,(x,z)=>({x,z,ry:R()*6.28})));OB.push(...scatter(I,8,3,(x,z)=>({x,z,ry:R()*6.28})));C.push(...scatter(I,24,2.5,sz(.3,.6)));DT.push(...scatter(I,10,4,sz(.9,1.3)))}
    for(const t of W){jobs.push(put(R()<.5?'MD_ModularStoneWall':'MD_ModularStoneWall_top',t.x,t.z,t.ry,[2.2,2.2+R()*1.4,2.2]).then(o=>tintObj(o,STONE)));addCol(t.x,t.z,2.2)}
    for(const t of COL){jobs.push(put(['MD_Column','MD_Column_Broken','MD_Column_Broken2'][Math.floor(R()*3)],t.x,t.z,t.ry,[1.6,1.8+R()*.8,1.6]).then(o=>tintObj(o,STONE)));addCol(t.x,t.z,.8)}
    for(const t of AR){jobs.push(put('D_Arch',t.x,t.z,t.ry,2.4).then(o=>tintObj(o,STONE)))}
    for(const t of OB){jobs.push(put('K_pillar-obelisk',t.x,t.z,t.ry,3.6).then(o=>tintObj(o,new THREE.Color(.6,.5,.85))));addCol(t.x,t.z,.9)}
    crys(crystals,C,0xc890ff,0x9a3aff,.6);jobs.push(riftInst('CommonTree_Dead_2',DT.filter((t,i)=>i%2),{col:0x5a4a6a}));jobs.push(riftInst('CommonTree_Dead_4',DT.filter((t,i)=>!(i%2)),{col:0x4a3a5a}));for(const t of C)addCol(t.x,t.z,2*t.s)}
  /* Throne of the Void: obsidian, blood-red crystal and a ring of obelisks around the place where the Void Wyrm lands */
  {const I=RISLE.t1;const RK=scatter(I,26,3,sz(2,4.5)),C=scatter(I,34,3,sz(.5,1.2));
    jobs.push(riftInst('Rock_6',RK.filter((t,i)=>i%2),{col:0x2a2030}));jobs.push(riftInst('Rock_7',RK.filter((t,i)=>!(i%2)),{col:0x34263c}));crys(crystals,C,0xff7ac8,0xff2a8a,.7);
    for(let k=0;k<8;k++){const a=k/8*6.28,x=I.x+Math.cos(a)*30,z=I.z+Math.sin(a)*30;jobs.push(put('K_pillar-obelisk',x,z,-a,4.8).then(o=>tintObj(o,new THREE.Color(.45,.35,.55))));addCol(x,z,1.1);addLight(x,riftH(x,z)+6,z,0xff3aa0,18,14)}
    for(const t of[...RK,...C])addCol(t.x,t.z,1.1*(t.s||1))}
  /* the islets: one crystal cluster each */
  {const C=[];for(const I of RIFT_ISLES.filter(I=>I.islet))C.push({x:I.x,z:I.z,ry:R()*6.28,s:.4+I.r*.03});crys(crystals,C,0xd8b0ff,0xa05aff,.8)}
  /* rocks drifting in the void */
  {const L=[];for(let i=0;i<3000&&L.length<90;i++){const x=RIFT.x-520+R()*1040,z=RIFT.z-520+R()*1040;if(RIFT_ISLES.some(I=>Math.hypot(I.x-x,I.z-z)<I.r*1.4+10)||RIFT_BR.some(B=>{const t=clamp((x-B.x0)*B.ux+(z-B.z0)*B.uz,0,B.len);return Math.hypot(B.x0+B.ux*t-x,B.z0+B.uz*t-z)<14}))continue;
    L.push({x,z,y:-50+R()*130,ry:R()*6.28,rx:R()*6.28,rz:R()*6.28,s:1.5+R()*6})}
    ['Rock_1','Rock_4','Rock_6','Rock_7'].forEach((n,i)=>jobs.push(riftInst(n,L.filter((t,k)=>k%4===i),{col:0x4a4060,cast:false})))}
  /* lamps along the bridges: a small floating crystal on each side, now and then */
  {const L=[];for(const B of RIFT_BR){for(let t=10;t<B.len-6;t+=22){const sd=Math.round(t/22)%2?1:-1,x=B.x0+B.ux*t-B.uz*(B.w/2+.2)*sd,z=B.z0+B.uz*t+B.ux*(B.w/2+.2)*sd;const y=riftBridge(B.x0+B.ux*t,B.z0+B.uz*t);if(!y)continue;L.push({x,z,y:y.y+2.2,ry:R()*6,s:.22});addLight(x,y.y+2.6,z,0x9a7aff,12,12)}}
    crys(['../rift/Crystal_4'],L,0xd0b8ff,0xa070ff,1.1)}
  /* Riftwatch: the fortress, its towers, crystal braziers, banners and the floating anchor */
  for(const b of RW_B)jobs.push(put(b.m,b.x,b.z,b.ry,b.s).then(o=>tintObj(o,STONE)));
  jobs.push(put('Stable',RW.x-26,RW.z+26,.5,2.4).then(o=>tintObj(o,STONE)));addCol(RW.x-26,RW.z+26,4.5);
  for(const[u,v]of[[-12,-6],[12,-6],[-12,16],[12,16]]){jobs.push(put('D_Pedestal',RW.x+u,RW.z+v,0,[.6,.55,.6]).then(o=>tintObj(o,STONE)));jobs.push(riftInst('../rift/Crystal_8',[{x:RW.x+u,z:RW.z+v,y:RW_H+1.25,ry:R()*6,s:.16}],{col:0xd0b0ff,glow:0xa070ff,gi:1}))}
  for(let i=0;i<6;i++){const a=i/6*Math.PI*2+.3,x=RW.x+Math.cos(a)*14,z=RW.z+4+Math.sin(a)*14;jobs.push(put(i%2?'T_stall-red':'T_stall-green',x,z,-a-Math.PI/2,3.6).then(o=>tintObj(o,new THREE.Color(.75,.62,.95))));addCol(x,z,1.4)}
  for(const sd of[-1,1])jobs.push(put('T_banner-red',RW.x+sd*7,RW.z-12,0,4.2).then(o=>tintObj(o,new THREE.Color(.55,.35,1.2))));
  {const g=new THREE.Group();g.position.set(RW_ANCHOR.x,RW_H+4.2,RW_ANCHOR.z);g.userData.dyn=1;scene.add(g);RIFT_SPIN.push(g);
    jobs.push(loadEnv('../rift/Crystal_9').then(src=>{if(!src)return;const o=envClone(src);const s=o.userData.size;o.scale.setScalar(5.5/s[1]);o.position.y=-2.4;o.traverse(m=>{if(m.isMesh){m.material=new THREE.MeshToonMaterial({color:0xc8a8ff,gradientMap:RAMP,emissive:new THREE.Color(0x8a4aff),emissiveIntensity:.9})}});g.add(o)}));
    const ring=new THREE.Mesh(new THREE.RingGeometry(3.4,4,64).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xa06aff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));ring.position.set(RW_ANCHOR.x,RW_H+.08,RW_ANCHOR.z);ring.userData.dyn=1;scene.add(ring);RIFT_SPIN.push(ring)}
  /* the wardens' camps: a tent, a campfire and a crate or two */
  for(const id in RIFT_CAMPS){const c=RIFT_CAMPS[id],a=c.ry+1.2;const tx=c.x+Math.sin(a)*5,tz=c.z+Math.cos(a)*5;jobs.push(put('S_Tent',tx,tz,c.ry+Math.PI,.24).then(o=>tintObj(o,new THREE.Color(.62,.55,.85))));
    const fx=c.x+Math.sin(c.ry-1.3)*3.4,fz=c.z+Math.cos(c.ry-1.3)*3.4;jobs.push(put('D_Woodfire',fx,fz,0,1.6));{const f=new THREE.Group();f.position.set(fx,riftH(fx,fz)+.25,fz);scene.add(f);addFlame(f,0,.25,0,2,0xff9a40)}addCol(fx,fz,.9);
    jobs.push(put('Crate',c.x+Math.sin(a+1.4)*4,c.z+Math.cos(a+1.4)*4,R()*3,1.1));jobs.push(put('T_banner-red',c.x+Math.sin(a-.6)*6,c.z+Math.cos(a-.6)*6,c.ry,3.4).then(o=>tintObj(o,new THREE.Color(.55,.35,1.2))))}
  /* the gates: an arch and two columns, like the gate of Elvia */
  for(const[gx,gz,c]of[[RIFT_GATE.x,RIFT_GATE.z,0x5a4a7a],[RIFT_EXIT.x,RIFT_EXIT.z,0x4a4a6a]]){jobs.push(put('D_Arch',gx,gz,Math.PI/2,2.6).then(o=>tintObj(o,STONE)));for(const sd of[-1,1])jobs.push(envPlace('D_Column',gx,gz+sd*(2.05*2.6+1.4),0,()=>[1.2,1.5,1.2]).then(o=>recolorObj(o,c)))}
  /* a ring of fallen stones and shards around the gate in Elvia */
  {const L=[];for(let k=0;k<7;k++){const a=k/7*6.28+.4,d=9+R()*3;L.push({x:RIFT_GATE.x+Math.cos(a)*d,z:RIFT_GATE.z+Math.sin(a)*d,ry:R()*6,s:.25+R()*.2})}for(const t of L)t.y=elvH(t.x,t.z)-.1;crys(smallC.slice(0,2),L,0xc8a0ff,0x8a4aff,.7)}
  await Promise.all(jobs)}
/* ---- per frame: the anchor turns, motes drift up from the void, and the void takes back whoever falls in ---- */
let _riftFx=0;const RIFT_SAFE={x:RIFT_ENTRY.x,z:RIFT_ENTRY.z};
function updRift(dt,t){for(const o of RIFT_SPIN)o.rotation.y+=dt*.35;if(RIFT_SPIN[0])RIFT_SPIN[0].position.y=RW_H+4.2+Math.sin(t*.8)*.35;RIFT_VOID_U.time.value=t;
  if(!inRift(camTarget.x))return;if(P){P.disc=P.disc||{};P.disc.rift=1}
  if(!ME.dead&&!ME.air&&riftWalk(ME.pos.x,ME.pos.z,1)){RIFT_SAFE.x=ME.pos.x;RIFT_SAFE.z=ME.pos.z}
  if(!ME.dead&&inRift(ME.pos.x)&&ME.pos.y<-45)riftVoidReturn();
  _riftFx-=dt;if(_riftFx>0)return;_riftFx=GFX.q==='laag'?.14:.06;const c=camTarget;
  for(let i=0;i<2;i++){const x=c.x+FRN(-45,45),z=c.z+FRN(-45,45);if(riftIsle(x,z))continue;emitP({x,y:c.y-FRN(5,30),z,vy:FRN(1.5,3.5),life:FRN(3,5),size:FRN(.25,.6),size1:.05,col:Math.random()<.6?0xb07aff:0x6ae8ff,a:.8,a1:0,cell:FXC.glint})}
  if(Math.abs(RW_ANCHOR.x-c.x)+Math.abs(RW_ANCHOR.z-c.z)<60)emitP({x:RW_ANCHOR.x+FRN(-2,2),y:RW_H+FRN(.5,6),z:RW_ANCHOR.z+FRN(-2,2),vy:.6,life:1.6,size:.35,size1:.05,col:0xc8a0ff,a:.9,a1:0,cell:FXC.glint})}
function riftVoidReturn(){const d=Math.round(ST.maxhp*.1);P.hp=Math.max(1,P.hp-d);if(ME.mounted&&!flyMount())dismount();teleport(RIFT_SAFE.x,RIFT_SAFE.z);ME.vy=0;ME.air=false;beamFx(ME.pos.x,ME.pos.z,0xa05aff,1.2);sfx('frost');log('The void spits you out onto solid ground. (−'+d+' health)','err')}
/* ---- travel ---- */
function enterRift(){teleport(RIFT_ENTRY.x,RIFT_ENTRY.z);ME.ry=Math.PI/2;cam.yaw=-Math.PI/2;log('The world tears open around you: you step into the Nether Rift…','sys');if(P.level<25)log('Beware: the Nether Rift is meant for heroes of level 25 or higher.','err');P.disc=P.disc||{};P.disc.rift=1}
function leaveRift(){teleport(RIFT_GATE.x+8,RIFT_GATE.z+1);ME.ry=Math.PI/2;cam.yaw=-Math.PI/2}
function riftPortals(x,z){if(inElv(x)&&Math.hypot(x-RIFT_GATE.x,z-RIFT_GATE.z)<2.4){enterRift();return true}if(inRift(x)&&Math.hypot(x-RIFT_EXIT.x,z-RIFT_EXIT.z)<2.4){leaveRift();return true}return false}
function riftInteract(x,z){if(inElv(x)&&Math.hypot(x-RIFT_GATE.x,z-RIFT_GATE.z)<7){enterRift();return true}if(inRift(x)&&Math.hypot(x-RIFT_EXIT.x,z-RIFT_EXIT.z)<7){leaveRift();return true}return false}
function riftRespawn(){if(!inRift(ME.pos.x))return false;teleport(RIFT_ENTRY.x+rand(2,5),RIFT_ENTRY.z+rand(-2,2));return true}
/* what the zone banner says when you arrive in a region */
const RIFT_BANDS={'Riftwatch':'The Nether Rift · a fortress at the edge of the void','Shattered Approach':'The Nether Rift · level 25–30','Crystal Wastes':'The Nether Rift · level 30–35','The Twisted Grove':'The Nether Rift · level 35–40','Voidspire Ruins':'The Nether Rift · level 40–45','Throne of the Void':"The Nether Rift · level 45–50 · Xal'thuun the Void Wyrm"};
