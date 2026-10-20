/* ===================== The Woods of Elvia and WindStorm, capital of the humans =====================
   A zone of its own far to the west in world space (x≈-3400), reached by crossing the Dragon Realm straight on: a gate
   on its east side leads here. 900 × 900 m of rolling forest with the Elvian Highlands in the north; their cliffs drop
   in waterfalls into Silverfall Lake and Moonmere, rivers run from there to Lake Elvia, and on its north shore lies
   WindStorm: double walls, a citadel with the royal castle, a cathedral, a grand plaza, market, harbour and districts.
   Everything is built from the downloaded CC0 packs that Velmora already uses (KayKit Medieval Hexagon, Kenney Fantasy
   Town, Quaternius nature, dungeon and survival packs). Level 20–25 content follows in the next update. */
const ELV={x:-3400,z:0},ESZ=900,ESEG=300,ECELL=ESZ/ESEG,EHN=ESEG+1;
const inElv=x=>x<-2600;
const E=(u,v)=>[ELV.x+u,ELV.z+v];/* zone-local (u,v) to world (x,z) */
/* landmarks in world space */
const WS={x:ELV.x+60,z:ELV.z+20,R:118,H:3,plaza:26,ring:58};
const ELV_EXIT={x:ELV.x-436,z:ELV.z};                  /* gate back to the Dragon Realm */
const ELV_ENTRY={x:ELV.x-422,z:ELV.z+3};
const ELV_LAKES=[{n:'Silverfall Lake',x:ELV.x-100,z:ELV.z-100,r:45,wl:-1},{n:'Moonmere',x:ELV.x+250,z:ELV.z-108,r:38,wl:-1},{n:'Lake Elvia',x:ELV.x+70,z:ELV.z+262,r:98,wl:-1.2},{n:'Fernwater',x:ELV.x-300,z:ELV.z+250,r:40,wl:-.6}];
/* the cliff of the Elvian Highlands: the plateau lies north of this line */
const elvCliff=u=>-172+18*Math.sin(u*.012)+8*Math.sin(u*.031);
/* rivers (zone-local polylines with a width): three fall from the highlands, two run on to Lake Elvia */
const ELV_RIVERS_L=[
  {w:5,p:[[-190,-388],[-160,-340],[-128,-262],[-112,-205],[-104,-160],[-100,-140]]},
  {w:4,p:[[-10,-388],[-34,-330],[-52,-240],[-66,-190],[-76,-148]]},
  {w:4.5,p:[[310,-388],[286,-330],[266,-230],[256,-175],[252,-142]]},
  {w:5.5,p:[[-112,-58],[-132,0],[-124,60],[-86,118],[-36,166],[2,190]]},
  {w:5,p:[[256,-72],[244,-8],[224,60],[186,138],[150,184]]},
  {w:3.5,p:[[-300,-388],[-310,-330],[-330,-200],[-320,-60],[-300,100],[-300,210]]}];
/* roads (world space). the city streets are added further on */
const ELV_ROADS=[[E(-430,0),E(-330,6),E(-220,18),E(-120,20),[WS.x-WS.R-30,WS.z]],
  [[WS.x,WS.z-WS.R-20],E(40,-142),E(-20,-152),E(-58,-148)],[E(70,-140),E(150,-132),E(205,-124)],
  [[WS.x+WS.R+20,WS.z],E(262,30),E(330,-40),E(360,-180),E(372,-300)],
  /* up the cliff to the highlands */[E(150,-132),E(170,-180),E(150,-226),E(110,-262)],
  [E(-220,18),E(-262,120),E(-282,206)]];
/* ---- rivers: sampled every 2 m with a water level that only ever falls; a coarse grid finds the nearest sample fast ---- */
const ELV_RIV=[];const ELV_RIVG=new Map();
function elvBase(x,z){const u=x-ELV.x,v=z-ELV.z;
  let h=(fbm(u*.008+21,v*.008+4)-.5)*22+(fbm(u*.03+5,v*.03+9)-.5)*5;
  const c=elvCliff(u);h+=26*smooth(clamp((c+5-v)/10,0,1));/* the highland plateau */
  const e=Math.max(Math.abs(u),Math.abs(v));if(e>392)h+=(e-392)*.65;
  return h}
/* nearest river sample within reach: [distance, water level, width] */
function elvRiver(x,z){let best=1e9,wy=0,w=4;const cx=Math.floor(x/16),cz=Math.floor(z/16);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const L=ELV_RIVG.get((cx+a)+','+(cz+b));if(!L)continue;for(const[ri,k]of L){const S=ELV_RIV[ri].S,s=S[k],t=S[k+1]||s;const d=segDist(x,z,s.x,s.z,t.x,t.z);if(d<best){best=d;wy=s.wy;w=s.w}}}
  return[best,wy,w]}
/* ---- WindStorm streets: four from the gates to the plaza, and a ring street ---- */
const WS_STREETS=[[[WS.x-WS.R-30,WS.z],[WS.x-WS.plaza,WS.z]],[[WS.x+WS.plaza,WS.z],[WS.x+WS.R+20,WS.z]],[[WS.x,WS.z-WS.R-20],[WS.x,WS.z-WS.plaza]],[[WS.x,WS.z+WS.plaza],[WS.x,WS.z+WS.R+22]]];
{const ring=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;ring.push([WS.x+Math.cos(a)*WS.ring,WS.z+Math.sin(a)*WS.ring])}WS_STREETS.push(ring)}
const ELV_PATHS=[...ELV_ROADS,...WS_STREETS];
function elvPathDist(x,z){let m=1e9;for(const p of ELV_PATHS)for(let i=0;i<p.length-1;i++){const d=segDist(x,z,p[i][0],p[i][1],p[i+1][0],p[i+1][1]);if(d<m)m=d}return m}
/* the citadel hill inside the city, north-east of the plaza */
const WS_CIT={x:WS.x+46,z:WS.z-72,r:25};
/* ---- height field ---- */
function elvPre(x,z){const u=x-ELV.x,v=z-ELV.z;let h=elvBase(x,z);
  /* WindStorm: one level, with the citadel hill */const dc=Math.hypot(x-WS.x,z-WS.z);if(dc<WS.R+36)h=lerp(WS.H,h,smooth(clamp((dc-WS.R-6)/30,0,1)));
  {const d=Math.hypot(x-WS_CIT.x,z-WS_CIT.z);if(d<WS_CIT.r+14)h+=5.5*smooth(clamp(1-(d-WS_CIT.r*.55)/(WS_CIT.r*.45+14),0,1))}
  /* gentle roads and the arrival square */const pd=elvPathDist(x,z);if(pd<10&&dc>WS.R+4)h=lerp(h*.6+WS.H*.4,h,smooth(pd/10));
  {const d=Math.hypot(x-ELV_EXIT.x-10,z-ELV_EXIT.z);if(d<22)h=lerp(2,h,smooth(clamp((d-12)/10,0,1)))}
  /* lakes: a rim just above the water, a bowl inside */for(const l of ELV_LAKES){const d=Math.hypot(x-l.x,z-l.z)/l.r;if(d<1.7){if(d>1)h=Math.max(h,lerp(l.wl+.7,h,clamp((d-1)/.7,0,1)));h=lerp(-6,h,smooth(clamp((d-.45)/.6,0,1)))}}
  return h}
{const R=mulberry(5511);for(const rv of ELV_RIVERS_L){const pts=rv.p.map(([u,v])=>E(u,v));const S=[];let wy=1e9;
  for(let i=0;i<pts.length-1;i++){const[ax,az]=pts[i],[bx,bz]=pts[i+1];const L=Math.hypot(bx-ax,bz-az),n=Math.ceil(L/2);for(let s=0;s<n;s++){const f=s/n;const x=lerp(ax,bx,f)+(R()-.5)*.6,z=lerp(az,bz,f)+(R()-.5)*.6;
    const b=elvPre(x,z);let lk=null;for(const l of ELV_LAKES)if(Math.hypot(x-l.x,z-l.z)<l.r*.9)lk=l;wy=Math.min(wy-.015,b-.7);if(lk)wy=Math.max(wy,lk.wl);S.push({x,z,wy,w:rv.w*(.9+.2*Math.sin(i+f*3))})}}
  const ri=ELV_RIV.length;ELV_RIV.push({w:rv.w,S});S.forEach((s,k)=>{const key=Math.floor(s.x/16)+','+Math.floor(s.z/16);let a=ELV_RIVG.get(key);if(!a)ELV_RIVG.set(key,a=[]);a.push([ri,k])})}}
function elvRaw(x,z){let h=elvPre(x,z);
  /* rivers carve their bed below their water level */const[rd,wy,rw]=elvRiver(x,z);if(rd<rw+7){const bed=wy-1.6*(1-Math.min(1,(rd/rw)**2));if(rd<rw)h=Math.min(h,bed);else h=lerp(wy+.35,h,smooth((rd-rw)/7))}/* banks meet the water: never lower, so the river never floats */
  return h}
const EHM=new Float32Array(EHN*EHN);for(let i=0;i<EHN;i++)for(let j=0;j<EHN;j++)EHM[i*EHN+j]=elvRaw(ELV.x-ESZ/2+j*ECELL,ELV.z-ESZ/2+i*ECELL);
/* bridges where a road crosses a river: the deck is walkable (elvH returns its height) */
const ELV_BRIDGES=[];
function elvBridgeH(x,z){for(const b of ELV_BRIDGES){const dx=x-b.x,dz=z-b.z;if(Math.abs(dx)+Math.abs(dz)>b.len)continue;const al=dx*Math.sin(b.ry)+dz*Math.cos(b.ry),ac=dx*Math.cos(b.ry)-dz*Math.sin(b.ry);if(Math.abs(al)<b.len/2&&Math.abs(ac)<b.w/2){const e=Math.abs(al)/(b.len/2);return b.y+.25*(1-e*e)}}return null}
function elvH(x,z){if(ELV_BRIDGES.length){const bh=elvBridgeH(x,z);if(bh!=null){const t=elvHT(x,z);return Math.max(bh,t)}}return elvHT(x,z)}
function elvHT(x,z){const fx=clamp((x-ELV.x+ESZ/2)/ECELL,0,ESEG-.001),fz=clamp((z-ELV.z+ESZ/2)/ECELL,0,ESEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;
  const a=EHM[i*EHN+j],b=EHM[i*EHN+j+1],c=EHM[(i+1)*EHN+j],d=EHM[(i+1)*EHN+j+1];return u+v<1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
{for(const p of ELV_ROADS)for(let i=0;i<p.length-1;i++){const[ax,az]=p[i],[bx,bz]=p[i+1];const L=Math.hypot(bx-ax,bz-az);let last=-99;for(let t=0;t<L;t+=1){const x=ax+(bx-ax)*t/L,z=az+(bz-az)*t/L;const[rd,wy,rw]=elvRiver(x,z);
  if(rd<1.2&&t-last>24&&!ELV_LAKES.some(l=>Math.hypot(x-l.x,z-l.z)<l.r*1.1)){last=t;const ry=Math.atan2(bx-ax,bz-az),len=rw*2+12,ex=Math.sin(ry)*len/2,ez=Math.cos(ry)*len/2;ELV_BRIDGES.push({x,z,ry,len,w:8,y:Math.max(wy+.9,Math.min(elvPre(x+ex,z+ez),elvPre(x-ex,z-ez))+.15)})}}}}
function elvLake(x,z){for(const l of ELV_LAKES)if(Math.hypot(x-l.x,z-l.z)<l.r*.9)return l;return null}
function elvZone(x,z){if(Math.hypot(x-WS.x,z-WS.z)<WS.R+8)return'WindStorm';for(const l of ELV_LAKES)if(Math.hypot(x-l.x,z-l.z)<l.r*1.25)return l.n;
  const u=x-ELV.x,v=z-ELV.z;if(v<elvCliff(u)-4)return'Elvian Highlands';if(u<-250)return'Whispering Glade';if(u>200)return'Thornwood';return'Woods of Elvia'}
function elvCollide(p,r){p.x=clamp(p.x,ELV.x-438,ELV.x+430);p.z=clamp(p.z,ELV.z-432,ELV.z+432);
  /* you can wade into the shallows but not walk across a lake */for(const l of ELV_LAKES){const d=Math.hypot(p.x-l.x,p.z-l.z);if(d<l.r*.8){const a=Math.atan2(p.z-l.z,p.x-l.x);p.x=l.x+Math.cos(a)*l.r*.8;p.z=l.z+Math.sin(a)*l.r*.8}}}
/* ---- terrain ---- */
const elvTerrain=(()=>{const geo=new THREE.PlaneGeometry(ESZ,ESZ,ESEG,ESEG);geo.rotateX(-Math.PI/2);geo.translate(ELV.x,0,ELV.z);
  const pos=geo.attributes.position,col=new Float32Array(pos.count*3),c=new THREE.Color();
  const G1=new THREE.Color(0x3f7a2c),G2=new THREE.Color(0x67a03a),MOSS=new THREE.Color(0x2f5a26),FLOOR=new THREE.Color(0x45542a),HI=new THREE.Color(0x7aa84a),ROCK=new THREE.Color(0x77736a),DIRT=new THREE.Color(0x8a7050),SAND=new THREE.Color(0xc8b47e),MUD=new THREE.Color(0x5a5a3a),COB=new THREE.Color(0x9a948a);
  for(let k=0;k<pos.count;k++){const i=Math.floor(k/EHN),j=k%EHN,x=ELV.x-ESZ/2+j*ECELL,z=ELV.z-ESZ/2+i*ECELL,h=EHM[k];pos.setY(k,h);
    const n=fbm(x*.03,z*.03),n2=vnoise(x*.2,z*.2);c.copy(G1).lerp(G2,n*.9);if(n2>.6)c.lerp(MOSS,.45);if(fbm(x*.011+40,z*.011)>.55)c.lerp(FLOOR,.4);
    const u=x-ELV.x,v=z-ELV.z;if(v<elvCliff(u)-6)c.lerp(HI,.35);
    const hx=EHM[i*EHN+Math.min(j+1,ESEG)]-h,hz=EHM[Math.min(i+1,ESEG)*EHN+j]-h,slope=Math.hypot(hx,hz)/ECELL;if(slope>.5)c.lerp(ROCK,clamp((slope-.45)*1.6,0,.95));
    for(const l of ELV_LAKES){const d=Math.hypot(x-l.x,z-l.z)/l.r;if(d<1.12)c.lerp(d<.95?MUD:SAND,d<.95?.6:smooth(clamp((1.12-d)/.17,0,1))*.8)}
    const[rd,,rw]=elvRiver(x,z);if(rd<rw+2.5)c.lerp(MUD,smooth(clamp(1-(rd-rw)/2.5,0,1))*.7);
    const dc=Math.hypot(x-WS.x,z-WS.z);const pd=elvPathDist(x,z);if(dc<WS.R-2&&dc>WS.plaza+1)c.lerp(G1,.2);if(pd<4.2)c.lerp(dc<WS.R?COB:DIRT,smooth(clamp(1-(pd-2.2)/2,0,1))*.85);if(dc<WS.plaza+1)c.lerp(COB,.8);
    const jit=.9+hash(i+9100,j)*.18;col[k*3]=c.r*jit;col[k*3+1]=c.g*jit;col[k*3+2]=c.b*jit}
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.computeVertexNormals();
  const tex=TEX.paint.clone();tex.needsUpdate=true;tex.repeat.set(52,52);
  const m=new THREE.Mesh(geo,new THREE.MeshToonMaterial({vertexColors:true,map:tex,bumpMap:tex,bumpScale:.1,gradientMap:RAMP}));m.receiveShadow=true;scene.add(m);return m})();
/* ---- lakes (same water as Mirror Lake, depth per vertex) ---- */
for(const l of ELV_LAKES){const g=waterGeo(l.x,l.z,l.r*1.3,l.r*1.3,l.wl,Math.min(150,Math.round(l.r*1.6)));const m=new THREE.Mesh(g,new THREE.ShaderMaterial({transparent:true,fog:true,uniforms:{...waterMat.uniforms,radius:{value:l.r*1.25}},vertexShader:waterMat.vertexShader,fragmentShader:waterMat.fragmentShader}));m.position.set(l.x,l.wl,l.z);m.receiveShadow=false;m.userData.dyn=1;scene.add(m)}
/* ---- rivers and waterfalls: ribbons that follow the water level; where it drops the water turns white and runs fast ---- */
const RIVER_MAT=new THREE.ShaderMaterial({transparent:true,fog:true,depthWrite:false,uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
  vertexShader:`#include <fog_pars_vertex>
    attribute float stp;varying vec2 vU;varying float vS;void main(){vU=uv;vS=stp;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader:`#include <fog_pars_fragment>
    uniform float time;varying vec2 vU;varying float vS;
    float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n1(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1.,0.)),f.x),mix(h1(i+vec2(0.,1.)),h1(i+vec2(1.,1.)),f.x),f.y);}
    void main(){float sp=mix(.35,2.6,vS);float y=vU.y-time*sp;float a=n1(vec2(vU.x*5.,y*3.)),b=n1(vec2(vU.x*13.,y*7.+3.));
      vec3 deep=vec3(.1,.32,.44),shal=vec3(.22,.52,.6);float edge=abs(vU.x-.5)*2.;vec3 c=mix(deep,shal,edge*.7+a*.3);
      float foam=smoothstep(.66,.92,a*.55+b*.45+edge*.3)*.3+vS*(.55+.45*b);c=mix(c,vec3(.93,.97,1.),clamp(foam,0.,1.));
      gl_FragColor=vec4(c,mix(.78,.95,vS)*(1.-smoothstep(.85,1.,edge)*.6));
      #include <fog_fragment>
    }`});
const ELV_FALLS=[];/* foot of every waterfall: mist and spray */
{const P=[],U=[],ST=[],I=[];let base=0;
  for(const rv of ELV_RIV){const S=rv.S;let along=0,started=false,first=base;
    for(let i=0;i<S.length;i++){const s=S[i];if(ELV_LAKES.some(l=>Math.hypot(s.x-l.x,s.z-l.z)<l.r*.8)){started=false;continue}
      const nx=S[Math.min(i+1,S.length-1)],px=S[Math.max(i-1,0)];const dx=nx.x-px.x,dz=nx.z-px.z,L=Math.hypot(dx,dz)||1;const ox=-dz/L*s.w,oz=dx/L*s.w;
      const y=s.wy+.12,drop=Math.max(0,(S[Math.max(i-1,0)].wy-s.wy)),stp=clamp((drop-.45)/1.2,0,1);if(i)along+=Math.hypot(s.x-S[i-1].x,s.z-S[i-1].z)+drop*1.5;
      P.push(s.x+ox,y,s.z+oz,s.x-ox,y,s.z-oz);U.push(0,along/8,1,along/8);ST.push(stp,stp);const vi=P.length/3-2;if(started)I.push(vi-2,vi,vi-1,vi-1,vi,vi+1);started=true;
      if(drop>1.2){let k=i;while(k<S.length-1&&S[k].wy-S[k+1].wy>.3)k++;const f=S[k];if(!ELV_FALLS.some(q=>Math.hypot(q.x-f.x,q.z-f.z)<14))ELV_FALLS.push({x:f.x,y:f.wy,z:f.z,w:s.w,top:s.wy+drop*3})}}
    base=P.length/3}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.setAttribute('stp',new THREE.Float32BufferAttribute(ST,1));g.setIndex(I);
  const m=new THREE.Mesh(g,RIVER_MAT);m.renderOrder=1;m.userData.dyn=1;scene.add(m);
  for(const f of ELV_FALLS)addLight(f.x,f.y+2,f.z,0xbfe8ff,10,14,false)}
/* ---- WindStorm: layout (colliders, procedural fallbacks and lists of what goes where; models come in buildElvia) ---- */
const WS_B=[],WS_PROPS=[],WS_LAMPS=[],WS_TREES=[],WS_RES=[];/* WS_RES: reserved circles [x,z,r] */
const wsFree=(x,z,r)=>Math.hypot(x-WS.x,z-WS.z)<WS.R-10-r*.4&&Math.hypot(x-WS.x,z-WS.z)>WS.plaza+r+4&&elvPathDist(x,z)>r+4.2&&!WS_RES.some(q=>Math.hypot(q[0]-x,q[1]-z)<q[2]+r+1.2);
/* a building: model, position, rotation (radians, door side faces +z when ry=0), scale; colliders as a row of circles */
function wsBuild(m,x,z,ry,s,fp=[1,1]){const w=fp[0]*s,d=fp[1]*s,r=Math.max(w,d)/2;WS_RES.push([x,z,r*.92]);const b={m:'H_'+m,x,z,ry,s,w,d,y:elvH(x,z)};WS_B.push(b);
  const ax=Math.cos(ry),az=-Math.sin(ry),n=Math.max(1,Math.round(w/Math.min(w,d)));const cr=Math.min(w,d)*.44;for(let k=0;k<n;k++){const o=(k-(n-1)/2)*(w/n);addCol(x+ax*o,z+az*o,cr,false,s*.9)}
  PROC='ws';b.proc=mesh(new THREE.BoxGeometry(w*.86,s*.8,d*.86),mat(0xd8cbb0,{tex:'plaster',rx:2,ry:2}),x,b.y+s*.4,z);b.proc.rotation.y=ry;PROC=null;return b}
const faceTo2=(x,z,tx,tz)=>Math.atan2(tx-x,tz-z);
/* landmarks */
{const P=(u,v)=>[WS.x+u,WS.z+v];
  let[x,z]=[WS_CIT.x,WS_CIT.z];wsBuild('castle_blue',x,z,faceTo2(x,z,WS.x,WS.z),12.5,TFP.castle);
  [x,z]=P(-55,-60);wsBuild('church_blue',x,z,faceTo2(x,z,WS.x,WS.z),17,TFP.church);
  [x,z]=P(-50,62);wsBuild('tavern_red',x,z,faceTo2(x,z,WS.x,WS.z),14,TFP.tavern);
  [x,z]=P(-36,-24);wsBuild('market_red',x,z,faceTo2(x,z,WS.x,WS.z),7.5,TFP.market);
  [x,z]=P(38,32);wsBuild('market_blue',x,z,faceTo2(x,z,WS.x,WS.z),7.5,TFP.market);
  [x,z]=P(-34,30);wsBuild('market_yellow',x,z,faceTo2(x,z,WS.x,WS.z),7.5,TFP.market);
  [x,z]=P(-84,-30);wsBuild('blacksmith_red',x,z,faceTo2(x,z,WS.x,WS.z),10,[1.3,1.25]);
  [x,z]=P(86,-24);wsBuild('barracks_blue',x,z,faceTo2(x,z,WS.x,WS.z),11,TFP.barracks);
  [x,z]=P(82,38);wsBuild('archeryrange_green',x,z,faceTo2(x,z,WS.x,WS.z),9,[1.67,1.55]);
  [x,z]=P(-78,48);wsBuild('home_B_blue',x,z,faceTo2(x,z,WS.x,WS.z),10,TFP.home_B);
  for(const[u,v,m,s]of[[-22,-42,'tower_A_blue',6],[96,4,'tower_B_blue',5],[-100,6,'tower_A_blue',5.5],[30,-96,'tower_B_blue',5]]){[x,z]=P(u,v);if(wsFree(x,z,4))wsBuild(m,x,z,0,s,TFP[m.slice(0,7)]||[1,1.15])}}
/* the bell tower, stable, wells, statues and the harbour */
{const R=mulberry(6161);const put=(m,u,v,ry,s,col,rr)=>{const x=WS.x+u,z=WS.z+v;WS_PROPS.push({m,x,z,ry,s});if(col)addCol(x,z,col,false,s*2);if(rr)WS_RES.push([x,z,rr])};
  put('Bell_Tower',40,-38,0,3.4,3.2,6);put('Stable',-96,-58,.6,2.6,0,9);addBox(WS.x-96,WS.z-58,10,7);
  put('T_fountain-round-detail',0,0,0,[8.5,6.5,8.5],7.2,10);
  for(const a of[.785,2.356,3.927,5.498]){const u=Math.cos(a)*19,v=Math.sin(a)*19;put('D_Statue_Horse',u,v,-a+Math.PI/2,1.5,1.4,3)}
  for(const[u,v]of[[-62,-8],[24,74],[74,-52],[-14,-84]])put('H_well_blue',u,v,R()*6,4,1.4,3);
  put('H_stage_A',0,-38,Math.PI,[11,6,9],0,7);addBox(WS.x,WS.z-38,10,8);
  /* stalls around the plaza */for(let i=0;i<10;i++){const a=i/10*Math.PI*2+.31;if([0,1,2,3].some(k=>Math.abs(angDiff(a,k*Math.PI/2))<.3))continue;put(i%2?'T_stall-red':'T_stall-green',Math.cos(a)*30,Math.sin(a)*30,-a-Math.PI/2,3.8,1.5,3)}
  /* the harbour on Lake Elvia: three long docks from the south gate */for(const du of[-22,0,22])WS_PROPS.push({m:'Q_Dock_Long',x:WS.x+du,z:WS.z+WS.R+30,ry:0,s:.9,dock:1});
  for(let i=0;i<10;i++)WS_PROPS.push({m:R()<.5?'Barrel':'Crate',x:WS.x-30+R()*60,z:WS.z+WS.R+12+R()*6,ry:R()*6,s:R()<.5?1:1.2})}
/* ---- the people of WindStorm: quest givers, traders and services (spots are reserved before the houses go in) ---- */
const WS_NPC_SPOTS={};{const toP=(x,z,d)=>{const a=Math.atan2(WS.z-z,WS.x-x);return[x+Math.cos(a)*d,z+Math.sin(a)*d]};const B=m=>WS_B.find(b=>b.m==='H_'+m);
  const spot=(id,x,z,face)=>{WS_NPC_SPOTS[id]={x,z,ry:face!=null?face:Math.atan2(WS.x-x,WS.z-z)};WS_RES.push([x,z,2.2])};
  {const[x,z]=toP(WS_CIT.x,WS_CIT.z,WS_CIT.r+5);spot('corwin',x,z)}
  spot('liora',WS.x-WS.R+17,WS.z-7,Math.PI/2);
  {const c=B('church_blue'),[x,z]=toP(c.x,c.z,c.d/2+5);spot('sabine',x,z);const a=Math.atan2(WS.z-c.z,WS.x-c.x)+Math.PI/2;spot('aurelia',x+Math.cos(a)*5,z+Math.sin(a)*5)}
  spot('tomas',WS.x+10,WS.z+WS.R+12,0);
  spot('elinor',WS.x-22,WS.z-6);
  {const m=B('market_red'),[x,z]=toP(m.x,m.z,m.d/2+3.5);spot('gerrit',x,z)}
  {const m=B('blacksmith_red'),[x,z]=toP(m.x,m.z,m.d/2+3.5);spot('brannoc',x,z)}
  spot('wren',WS.x-86,WS.z-47);
  {const m=B('tavern_red'),[x,z]=toP(m.x,m.z,m.d/2+4);spot('mabel',x,z)}}
const WS_NPCS=[
  {id:'corwin',n:'Lord Marshal Corwin',t:'Marshal of WindStorm',look:{skin:0xd9a98a,hair:0x6a5a4a,chest:0x3f5a9a,pants:0x2a2a30,cape:0x2a4a9a,wt:'zwaard',helm:1,beard:1},hi:'Welcome to WindStorm, traveller. The capital stands, but the woods around us grow darker by the day.'},
  {id:'liora',n:'Ranger-Captain Liora',t:'Rangers of Elvia',look:{skin:0xf0d2b8,hair:0x2a3a1a,chest:0x3a5a2a,pants:0x2a3a20,cape:0x2a4a1a,wt:'boog',ears:1},hi:'Keep your bowstring dry and your eyes on the treetops. Elvia does not forgive the careless.'},
  {id:'sabine',n:'Archmage Sabine',t:'Circle of the Falls',look:{skin:0xe8c8a8,hair:0xe8e8f0,chest:0x3a3a8a,pants:0x2a2a5a,cape:0x5a3a9a,wt:'staf'},hi:'The waters of Elvia remember everything. Lately, they have been whispering of poison.'},
  {id:'aurelia',n:'High Priestess Aurelia',t:'Cathedral of the Light',look:{skin:0xf0d2b8,hair:0xd8b860,chest:0xe8e2d0,pants:0xd0c8b0,cape:0xd9b44a,wt:'staf'},hi:'The Light shines brightest in the darkest woods. How may the cathedral serve you?',priest:1},
  {id:'tomas',n:'Harbourmaster Tomas',t:'Harbour of WindStorm',look:{skin:0xc8906a,hair:0x8a8a8a,chest:0x2a4a6a,pants:0x3a3028,wt:'none',beard:1},hi:'Ships, nets and fish, that is my life. And the best fish in the realm swim in Lake Elvia!'},
  {id:'elinor',n:'Herbalist Elinor',t:'Herbs and Potions',look:{skin:0xf0d2b8,hair:0xb04a1c,chest:0x4a7a3a,pants:0x3a5a2a,wt:'none'},hi:'Roots, petals and a drop of moonlight. My potions are the finest in WindStorm.',shop:1},
  {id:'gerrit',n:'Merchant Gerrit',t:'General Goods',look:{skin:0xd99b7a,hair:0x4a3020,chest:0x8a5a2a,pants:0x4a3a2a,wt:'none',beard:1},hi:'Potions, provisions, and I buy whatever you dragged out of the woods!',shop:1},
  {id:'brannoc',n:'Armorer Brannoc',t:'Arms and Armour',look:{skin:0xd99b7a,hair:0x2a1a10,chest:0x5a4a3a,pants:0x3a3028,wt:'bijl',dwarf:1,beard:1},hi:'Finest steel this side of the Dragon Realm. Have a look, but don\'t touch the edges.',gearshop:1},
  {id:'wren',n:'Stablemistress Wren',t:'Royal Stables',look:{skin:0xe2b48e,hair:0xc79a4b,chest:0x7a5a34,pants:0x3a3028,wt:'none'},hi:'The royal stables have the best mounts in the realm. Fancy a drake?',stable:1},
  {id:'mabel',n:'Innkeeper Mabel',t:'The Gilded Gryphon',look:{skin:0xe2b48e,hair:0x8a3a1a,chest:0x8a3a2a,pants:0x3a2a20,wt:'none'},hi:'Welcome to the Gilded Gryphon! A warm bed, a hot meal, and your hearthstone set to WindStorm if you like.',inn:1}];
for(const n of WS_NPCS){const s=WS_NPC_SPOTS[n.id];NPCS.push({...n,x:s.x,z:s.z,ry:s.ry})}
/* the outlaw camp on the shore of Fernwater */
const ELV_CAMP={x:ELV.x-246,z:ELV.z+222};
/* houses along every street and in the rings between them */
{const R=mulberry(6262);const HM2=['home_A_red','home_A_blue','home_A_yellow','home_A_green','home_B_red','home_B_blue','home_B_yellow','home_B_green'];
  const tryHouse=(x,z,ry)=>{const m=HM2[Math.floor(R()*HM2.length)],s=9.5+R()*1.5,fp=TFP[m.startsWith('home_A')?'home_A':'home_B'];if(!wsFree(x,z,Math.max(fp[0],fp[1])*s/2))return false;wsBuild(m,x,z,ry,s,fp);return true};
  for(const st of WS_STREETS)for(let i=0;i<st.length-1;i++){const[ax,az]=st[i],[bx,bz]=st[i+1];const L=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/L,dz=(bz-az)/L;
    for(let t=6;t<L;t+=st.length>10?7:13)for(const sd of[-1,1]){const cx=ax+dx*t,cz=az+dz*t,x=cx-dz*12*sd,z=cz+dx*12*sd;tryHouse(x,z,faceTo2(x,z,cx,cz))}}
  for(let k=0;k<600;k++){const a=R()*Math.PI*2,d=WS.plaza+12+R()*(WS.R-WS.plaza-22);const x=WS.x+Math.cos(a)*d,z=WS.z+Math.sin(a)*d;tryHouse(x,z,faceTo2(x,z,WS.x,WS.z)+(R()<.5?0:Math.PI))}
  /* gardens: trees where nothing else fits */for(let k=0;k<500&&WS_TREES.length<70;k++){const a=R()*Math.PI*2,d=WS.plaza+8+R()*(WS.R-WS.plaza-14);const x=WS.x+Math.cos(a)*d,z=WS.z+Math.sin(a)*d;if(!wsFree(x,z,2.2)||WS_TREES.some(t=>Math.hypot(t.x-x,t.z-z)<5))continue;WS_TREES.push({x,z,s:.8+R()*.5,ry:R()*6,m:R()<.5?'T_tree-high-round':'H_tree_single_B'});addCol(x,z,.6,true)}}
/* street lanterns */
for(const st of WS_STREETS)for(let i=0;i<st.length-1;i++){const[ax,az]=st[i],[bx,bz]=st[i+1];const L=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/L,dz=(bz-az)/L;
  for(let t=5;t<L;t+=st.length>10?11:16){const sd=(Math.round(t/9)%2)?1:-1;const x=ax+dx*t-dz*5.6*sd,z=az+dz*t+dx*5.6*sd;if(Math.hypot(x-WS.x,z-WS.z)>WS.R-6||WS_LAMPS.some(l=>Math.hypot(l.x-x,l.z-z)<8)||WS_RES.some(q=>Math.hypot(q[0]-x,q[1]-z)<q[2]+.5))continue;WS_LAMPS.push({x,z,light:WS_LAMPS.length%2===0});addCol(x,z,.35)}}
for(const l of WS_LAMPS)if(l.light)addLight(l.x,elvH(l.x,l.z)+3.7,l.z,0xffb050,22,18);
/* the city wall: taller than Silverbrook's, with four gates and towers; the citadel gets a ring of its own */
const WS_GATES=[0,Math.PI/2,Math.PI,-Math.PI/2];
const WS_WALL={seg:[],tow:[],gate:[],cit:[]};{const W=WS.R,N=80;const gap=a=>WS_GATES.some(g=>Math.abs(angDiff(a,g))<.085);PROC='wswall';const wm=mat(0xa49c8e,{tex:'brick',rx:2,ry:1.2});
  for(let i=0;i<N;i++){const a=(i+.5)/N*Math.PI*2;if(gap(a))continue;const x=WS.x+Math.cos(a)*W,z=WS.z+Math.sin(a)*W,y=elvH(x,z);WS_WALL.seg.push({x,y,z,ry:-a-Math.PI/2});
    const s=mesh(new THREE.BoxGeometry(9.4,6.4,3),wm,x,y+3.2,z,scene);s.rotation.y=-a-Math.PI/2;for(let k=-1;k<=1;k++)addCol(x-Math.sin(a)*k*3.1,z+Math.cos(a)*k*3.1,2.2,false,7.5);
    if(i%6===3&&!gap(a+.12)&&!gap(a-.12))WS_WALL.tow.push({x:WS.x+Math.cos(a)*(W+.5),y,z:WS.z+Math.sin(a)*(W+.5),ry:-a+Math.PI/2})}
  for(const t of WS_WALL.tow)addCol(t.x,t.z,3.4,false,12);
  for(const g of WS_GATES)for(const sd of[-1,1]){const a=g+sd*.085,x=WS.x+Math.cos(a)*W,z=WS.z+Math.sin(a)*W;WS_WALL.gate.push({x,z,ry:-g+Math.PI/2,sd,g});addCol(x,z,4,false,15);
    mesh(new THREE.CylinderGeometry(3.4,3.8,13,10),wm,x,elvH(x,z)+6.5,z,scene);addLight(WS.x+Math.cos(g)*(W-4)+Math.cos(g+Math.PI/2)*sd*5.4,elvH(x,z)+6,WS.z+Math.sin(g)*(W-4)+Math.sin(g+Math.PI/2)*sd*5.4,0xffa040,30,24)}
  /* citadel ring with a gate towards the plaza */const cg=Math.atan2(WS.z-WS_CIT.z,WS.x-WS_CIT.x);
  for(let i=0;i<22;i++){const a=(i+.5)/22*Math.PI*2;if(Math.abs(angDiff(a,cg))<.32)continue;const x=WS_CIT.x+Math.cos(a)*WS_CIT.r,z=WS_CIT.z+Math.sin(a)*WS_CIT.r;WS_WALL.cit.push({x,y:elvH(x,z),z,ry:-a-Math.PI/2});addCol(x,z,1.9,false,5.6)}
  PROC=null}
/* ---- portals: back to the Dragon Realm ---- */
const ELV_PORTAL=portalMesh(0xff7a30,2.6,ELV_EXIT.x,elvH(ELV_EXIT.x,ELV_EXIT.z),ELV_EXIT.z,Math.PI/2);
for(const sd of[-1,1]){addCol(ELV_EXIT.x,ELV_EXIT.z+sd*1.58*2.6,.46*2.6);const cz=ELV_EXIT.z+sd*(2.05*2.6+1.4),y=elvH(ELV_EXIT.x,ELV_EXIT.z);addCol(ELV_EXIT.x,cz,1.1);addFlame(scene,ELV_EXIT.x,y+6.35,cz,1.6,0xff8a30);addLight(ELV_EXIT.x,y+6.8,cz,0xff8a40,26,16)}
/* ---- waystones: fast travel between Silverbrook and WindStorm ---- */
const WAYSTONES=[{id:'sb',n:'Silverbrook',x:9,z:9},{id:'ws',n:'WindStorm',x:WS.x+15,z:WS.z+15}];
for(const w of WAYSTONES){addCol(w.x,w.z,.9);const y=groundH(w.x,w.z);addLight(w.x,y+3,w.z,0x7ad8ff,18,10)}
/* ---- overview picture for the minimap ---- */
const elvImg=(()=>{const W=450,c=document.createElement('canvas');c.width=c.height=W;const g=c.getContext('2d');const d=g.createImageData(W,W);const col=elvTerrain.geometry.attributes.color.array;
  for(let y=0;y<W;y++)for(let x=0;x<W;x++){const j=Math.min(ESEG,Math.round(x/W*ESEG)),i=Math.min(ESEG,Math.round(y/W*ESEG)),k=(i*EHN+j)*3;let r=Math.pow(col[k],1/2.2)*255,gg=Math.pow(col[k+1],1/2.2)*255,b=Math.pow(col[k+2],1/2.2)*255;
    const wx=ELV.x-ESZ/2+x*ESZ/W,wz=ELV.z-ESZ/2+y*ESZ/W;if(elvLake(wx,wz)){r=70;gg=140;b=170}else{const[rd,,rw]=elvRiver(wx,wz);if(rd<rw){r=90;gg=160;b=190}}
    const o=(y*W+x)*4;d.data[o]=r;d.data[o+1]=gg;d.data[o+2]=b;d.data[o+3]=255}g.putImageData(d,0,0);return c})();
/* ---- models (async, while loading) ---- */
async function buildElvia(){if(window.__NOGLTF)return;const R=mulberry(7373);const jobs=[];const STONE=new THREE.Color(1.08,.96,.8);
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  /* the forest: thousands of trees, bushes, mossy rocks, logs and flowers (instanced, with LOD) */
  const okF=(x,z,clear=6)=>{if(Math.hypot(x-WS.x,z-WS.z)<WS.R+18)return false;if(elvPathDist(x,z)<clear)return false;for(const l of ELV_LAKES)if(Math.hypot(x-l.x,z-l.z)<l.r*1.12)return false;const[rd,,rw]=elvRiver(x,z);if(rd<rw+3)return false;
    if(Math.hypot(x-ELV_EXIT.x,z-ELV_EXIT.z)<24||Math.hypot(x-ELV_CAMP.x,z-ELV_CAMP.z)<24)return false;const u=x-ELV.x,v=z-ELV.z;if(Math.max(Math.abs(u),Math.abs(v))>425)return false;
    const hx=elvH(x+1.5,z)-elvH(x-1.5,z),hz=elvH(x,z+1.5)-elvH(x,z-1.5);return Math.hypot(hx,hz)/3<.7};
  const common=[],pine=[],bush=[],rock=[],logs=[],flow=[],giant=[];
  for(let i=0;i<26000&&common.length+pine.length<3600;i++){const x=ELV.x-430+R()*860,z=ELV.z-430+R()*860;const dens=fbm((x-ELV.x)*.01+3,(z-ELV.z)*.01+8);if(R()>dens*1.55-.2||!okF(x,z))continue;
    const hi=(z-ELV.z)<elvCliff(x-ELV.x)-4;(hi||R()<.32?pine:common).push([x,z,.85+R()*.6,R()*6.28])}
  for(let i=0;i<6000&&giant.length<40;i++){const x=ELV.x-400+R()*800,z=ELV.z-400+R()*800;if(okF(x,z,10)&&!giant.some(t=>Math.hypot(t[0]-x,t[1]-z)<40))giant.push([x,z,2.1+R()*.7,R()*6.28])}
  for(let i=0;i<9000&&bush.length<900;i++){const x=ELV.x-430+R()*860,z=ELV.z-430+R()*860;if(okF(x,z,4))bush.push([x,z,.8+R()*.7,R()*6.28])}
  for(let i=0;i<6000&&rock.length<420;i++){const x=ELV.x-430+R()*860,z=ELV.z-430+R()*860;if(okF(x,z,4))rock.push([x,z,.6+R()*2,R()*6.28])}
  for(let i=0;i<4000&&logs.length<120;i++){const x=ELV.x-420+R()*840,z=ELV.z-420+R()*840;if(okF(x,z,5))logs.push([x,z,1+R()*.6,R()*6.28])}
  for(let i=0;i<9000&&flow.length<700;i++){const x=ELV.x-430+R()*860,z=ELV.z-430+R()*860;if(okF(x,z,3)&&fbm(x*.02,z*.02)>.5)flow.push([x,z,.9+R()*.6,R()*6.28])}
  const LUSH=new THREE.Color(.92,1.04,.9),DEEP=new THREE.Color(.8,.95,.85);
  jobs.push(envInstances(['CommonTree_1','CommonTree_2','CommonTree_3'],common,(t,i)=>i,(t,bb)=>{const k=7.5*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},true,LUSH));
  jobs.push(envInstances(['PineTree_1','PineTree_2','PineTree_3'],pine,(t,i)=>i,(t,bb)=>{const k=9*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},true,DEEP));
  jobs.push(envInstances(['CommonTree_2','CommonTree_3'],giant,(t,i)=>i,(t,bb)=>{const k=9*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},true,new THREE.Color(.85,1,.82)));
  jobs.push(envInstances(['Bush_1','Bush_2','BushBerries_1'],bush,(t,i)=>i,(t,bb)=>{const k=1.6*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},false,LUSH));
  jobs.push(envInstances(['Rock_Moss_1','Rock_Moss_2','Rock_Moss_3','Rock_2','Rock_5'],rock,(t,i)=>Math.floor(t[2]*29+i),(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=2*t[2]/w;return[k,k*.8,k]},true));
  jobs.push(envInstances(['KN_log_large','TreeStump'],logs,(t,i)=>i,(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=4*t[2]/w;return[k,k,k]},true,new THREE.Color(.85,.75,.62)));
  jobs.push(envInstances(['Flowers','KN_flower_purpleA','KN_flower_yellowA','KN_flower_redA','KN_plant_flatTall'],flow,(t,i)=>i,(t,bb)=>{const k=.9*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},false));
  for(const t of common)addCol(t[0],t[1],.45*t[2],true);for(const t of pine)addCol(t[0],t[1],.45*t[2],true);for(const t of giant)addCol(t[0],t[1],.8*t[2],true);for(const t of rock)if(t[2]>1.1)addCol(t[0],t[1],.7*t[2]);for(const t of logs)addCol(t[0],t[1],.6*t[2]);
  /* WindStorm: buildings, walls and towers, props, gardens, lanterns, banners */
  for(const b of WS_B)jobs.push(put(b.m,b.x,b.z,b.ry,b.s,b.y-groundH(b.x,b.z)).then(o=>{if(!o)return;b.proc.visible=false;b.model=o}));
  jobs.push((async()=>{const seg=await instModel('H_wall_straight',WS_WALL.seg.map(t=>({...t,sx:4.9,sy:6.1,sz:4.2})));
    const tw=await instModel('H_tower_base_blue',WS_WALL.tow.map(t=>({...t,s:6.6})));const cit=await instModel('H_wall_straight',WS_WALL.cit.map(t=>({...t,sx:3.6,sy:4.2,sz:3.2})));
    const gt=await Promise.all(WS_WALL.gate.map(t=>put('H_tower_B_blue',t.x,t.z,t.ry,6.2)));
    for(const t of WS_WALL.gate){const a=t.g+t.sd*.085,R2=WS.R-4.5;jobs.push(put('T_banner-red',WS.x+Math.cos(a)*R2,WS.z+Math.sin(a)*R2,t.ry+Math.PI/2,4.2,6.4))}
    for(let i=0;i<WS_WALL.tow.length;i+=2){const t=WS_WALL.tow[i];jobs.push(put('H_flag_blue',t.x,t.z,t.ry,5,6.6*1.5))}
    if(seg&&tw&&gt.every(Boolean))hideProc('wswall')})());
  for(const p of WS_PROPS)jobs.push(put(p.m,p.x,p.z,p.ry,p.s,p.dock?ELV_LAKES[2].wl-2.6-groundH(p.x,p.z):0).then(o=>{if(o&&/fountain|well|stage|Bell/.test(p.m))tintObj(o,STONE)}));
  jobs.push(instModel('T_lantern',WS_LAMPS.map(l=>({x:l.x,y:elvH(l.x,l.z),z:l.z,ry:0,s:2.6})),{tint:STONE}));
  {const by={};for(const t of WS_TREES)(by[t.m]=by[t.m]||[]).push(t);for(const m in by){const H=m.startsWith('T_')?3.4:5.6;jobs.push(instModel(m,by[m].map(t=>({x:t.x,y:elvH(t.x,t.z),z:t.z,ry:t.ry,s:H*t.s}))))}}
  /* bridges: the deck sits at the height of the banks, so you walk straight across */
  for(const b of ELV_BRIDGES)jobs.push(envPlace('H_bridge_A',b.x,b.z,b.ry,()=>[b.w/1.34,2.6,b.len/1.92],scene,0).then(o=>{if(o)o.position.y=b.y+.12-1.25*2.6}));
  /* waterfalls: mossy boulders at the foot */
  for(const f of ELV_FALLS)for(let k=0;k<4;k++){const a=R()*6.28,d=f.w+1.5+R()*2;jobs.push(put(R()<.5?'Rock_Moss_1':'Rock_Moss_2',f.x+Math.cos(a)*d,f.z+Math.sin(a)*d,R()*6,2+R()*1.5))}
  /* the outlaw camp */
  {const cx=ELV_CAMP.x,cz=ELV_CAMP.z;jobs.push(put('D_Woodfire',cx,cz,0,2));{const f=new THREE.Group();f.position.set(cx,elvH(cx,cz)+.3,cz);scene.add(f);addFlame(f,0,.3,0,2.4,0xff8a30)}addLight(cx,elvH(cx,cz)+2,cz,0xffa050,30,18);addCol(cx,cz,1.3);
    for(let k=0;k<4;k++){const a=k*1.6+.4,tx=cx+Math.cos(a)*10,tz=cz+Math.sin(a)*10;jobs.push(put('S_Tent',tx,tz,a+Math.PI/2,.26).then(o=>tintObj(o,new THREE.Color(.55,.7,.45))));addCol(tx,tz,2.6)}
    for(let k=0;k<5;k++){const a=k*1.25,d=14+R()*3;jobs.push(put(k%2?'Barrel':'Crate',cx+Math.cos(a)*d,cz+Math.sin(a)*d,R()*3,1.1))}jobs.push(put('D_Banner',cx+3,cz-6,0,2.4))}
  /* the gate back to the Dragon Realm */
  jobs.push(put('D_Arch',ELV_EXIT.x,ELV_EXIT.z,Math.PI/2,2.6));for(const sd of[-1,1])jobs.push(envPlace('D_Column',ELV_EXIT.x,ELV_EXIT.z+sd*(2.05*2.6+1.4),0,()=>[1.2,1.5,1.2]).then(o=>recolorObj(o,0x6e5244)));
  /* waystones: an obelisk with a glowing crystal on top */
  for(const w of WAYSTONES){jobs.push(put('K_pillar-obelisk',w.x,w.z,0,3.2).then(o=>tintObj(o,new THREE.Color(.75,.85,1))));jobs.push(put('Q_Crystal5',w.x,w.z,0,1.4,3.5).then(o=>{if(o)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.color.setHex(0x8ae0ff);m.material.emissive=new THREE.Color(0x3aa8ff);m.material.emissiveIntensity=1.2}})}))}
  await Promise.all(jobs)}
/* ---- per frame: rivers flow, waterfalls spray ---- */
let _elvFx=0;
function updElvia(dt,t){RIVER_MAT.uniforms.time.value=t;if(!inElv(camTarget.x))return;if(P&&Math.hypot(ME.pos.x-WS.x,ME.pos.z-WS.z)<WS.R){P.disc=P.disc||{};P.disc.ws=1}_elvFx-=dt;if(_elvFx>0)return;_elvFx=GFX.q==='laag'?.12:.05;
  for(const f of ELV_FALLS){if(Math.abs(f.x-camTarget.x)+Math.abs(f.z-camTarget.z)>90)continue;
    emitP({x:f.x+FRN(-f.w,f.w)*.8,y:f.y+.3,z:f.z+FRN(-f.w,f.w)*.8,vx:FRN(-1,1),vy:FRN(1.5,3.5),vz:FRN(-1,1),life:FRN(1.2,2),size:1.4,size1:4,col:0xffffff,a:.35,a1:0,cell:FXC.smoke2,drag:.6,add:false});
    emitP({x:f.x+FRN(-f.w,f.w)*.6,y:f.y+.2,z:f.z+FRN(-f.w,f.w)*.6,vx:FRN(-2,2),vy:FRN(2,5),vz:FRN(-2,2),life:.7,size:.35,size1:.1,col:0xe8f6ff,a:.9,a1:0,grav:9})}
  for(const w of WAYSTONES){if(Math.abs(w.x-camTarget.x)+Math.abs(w.z-camTarget.z)>40)continue;if(Math.random()<.5)emitP({x:w.x+FRN(-.6,.6),y:groundH(w.x,w.z)+FRN(1,4.5),z:w.z+FRN(-.6,.6),vy:.8,life:1.4,size:.3,size1:.05,col:0x8ae0ff,a:.9,a1:0})}}
/* ---- travel ---- */
function enterElvia(){teleport(ELV_ENTRY.x,ELV_ENTRY.z);ME.ry=Math.PI/2;cam.yaw=-Math.PI/2;log('A cool wind smells of moss and rain: you enter the Woods of Elvia…','sys');if(P.level<20)log('Beware: the Woods of Elvia are meant for heroes of level 20 or higher.','err');P.disc=P.disc||{};P.disc.elvia=1}
function leaveElvia(){teleport(DRK_ARCH.elvia.x-9,DRK_ARCH.elvia.z);ME.ry=-Math.PI/2;cam.yaw=Math.PI/2}
function nearWaystone(){return WAYSTONES.find(w=>Math.hypot(ME.pos.x-w.x,ME.pos.z-w.z)<4)}
function useWaystone(w){P.disc=P.disc||{};if(w.id==='ws')P.disc.ws=1;const to=WAYSTONES.find(o=>o.id!==w.id);
  if(to.id==='ws'&&!P.disc.ws)return toast('The waystone is silent: you have not been to WindStorm yet');if(ME.combat>0)return toast('You cannot travel while in combat');if(ME.mounted)dismount();
  ME.cast={a:{n:'Travel to '+to.n,id:'waystone',way:to},t:0,dur:3,tg:null};$('#castbar').hidden=false}
function waystoneArrive(to){beamFx(ME.pos.x,ME.pos.z,0x7ad8ff,1.4);teleport(to.x+2.5,to.z+2.5);beamFx(ME.pos.x,ME.pos.z,0x7ad8ff,1.4);sfx('frost');log('The waystone carries you to '+to.n+'.','sys')}
function hearthTarget(){return P&&P.home==='ws'?[WS.x+rand(-3,3),WS.z+WS.plaza+4+rand(0,3)]:[rand(-3,3),rand(5,8)]}
function elvRespawn(){if(!inElv(ME.pos.x))return false;teleport(WS.x+rand(-3,3),WS.z+WS.plaza+6+rand(-2,2));return true}
