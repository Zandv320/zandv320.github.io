/* ===================== Deeltjes en effecten (Kenney Particle Pack / Smoke Particles, CC0) =====================
   Eén atlas van 8×4 witte textuurtjes (fx/atlas.png) die per deeltje worden ingekleurd, plus een explosie-flipbook
   (fx/boom.png, 3×3). Alle deeltjes van één soort gaan in één THREE.Points met een eigen shader: per deeltje
   positie, grootte, kleur+alpha, draaiing en atlasvak. Drie lagen: optellend licht (gloed), normaal (rook) en de flipbook.
   Grondeffecten (magische cirkels, schroeiplekken, schokgolven) zijn platte vlakjes die even blijven liggen. */
const FXC={soft:0,glint:1,crit:2,flare:3,fire:4,flame:5,smoke:6,smoke2:7,slash:8,streak:9,bolt:10,rune:11,circle:12,ring:13,scorch:14,twirl:15,
  muzzle:16,halo:17,dirt:18,star:19,smokering:20,arc:21,shine:22,wisp:23,zap:24,burst:25,thinring:26,scorch2:27,trace:28,twirl2:29,jet:30,heart:31};
const FX_TEX=(()=>{const L=new THREE.TextureLoader();const a=L.load(new URL('fx/atlas.png',location.href).href),b=L.load(new URL('fx/boom.png',location.href).href);
  for(const t of[a,b]){t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter}return{atlas:a,boom:b}})();
function makePsys(cap,tex,cols,rows,blending,colored){
  const g=new THREE.BufferGeometry();const pos=new Float32Array(cap*3).fill(0),col=new Float32Array(cap*4),sz=new Float32Array(cap),rot=new Float32Array(cap),cell=new Float32Array(cap);
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('aCol',new THREE.BufferAttribute(col,4));g.setAttribute('aSize',new THREE.BufferAttribute(sz,1));g.setAttribute('aRot',new THREE.BufferAttribute(rot,1));g.setAttribute('aCell',new THREE.BufferAttribute(cell,1));
  for(const k in g.attributes)g.attributes[k].setUsage(THREE.DynamicDrawUsage);
  const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending,uniforms:{map:{value:tex},grid:{value:new THREE.Vector2(cols,rows)},scale:{value:600}},
    vertexShader:`attribute vec4 aCol;attribute float aSize,aRot,aCell;varying vec4 vCol;varying float vRot,vCell;uniform float scale;
      void main(){vCol=aCol;vRot=aRot;vCell=aCell;vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize>0.?min(512.,aSize*scale/max(.1,-mv.z)):0.;}`,
    fragmentShader:`uniform sampler2D map;uniform vec2 grid;varying vec4 vCol;varying float vRot,vCell;
      void main(){vec2 p=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);p=vec2(c*p.x-s*p.y,s*p.x+c*p.y)+.5;if(p.x<0.||p.x>1.||p.y<0.||p.y>1.)discard;
        float cx=mod(vCell,grid.x),cy=floor(vCell/grid.x);vec2 uv=vec2((cx+p.x)/grid.x,1.-(cy+p.y)/grid.y);vec4 t=texture2D(map,uv);
        ${colored?'gl_FragColor=vec4(t.rgb*vCol.rgb,t.a*vCol.a);':'gl_FragColor=vec4(vCol.rgb,t.a*vCol.a);'}if(gl_FragColor.a<.004)discard;}`});
  const pts=new THREE.Points(g,m);pts.frustumCulled=false;pts.renderOrder=5;scene.add(pts);
  const P=[];for(let i=0;i<cap;i++)P.push({life:0});
  return{g,m,pts,pos,col,sz,rot,cell,P,cap,i:0,alive:0}}
const PS_ADD=makePsys(2400,FX_TEX.atlas,8,4,THREE.AdditiveBlending,false);
const PS_NRM=makePsys(900,FX_TEX.atlas,8,4,THREE.NormalBlending,false);
const PS_BOOM=makePsys(80,FX_TEX.boom,3,3,THREE.NormalBlending,true);
const _pc=new THREE.Color(),_pc2=new THREE.Color();
/* één deeltje uitzenden.  o: x,y,z, vx,vy,vz, life, size→size1, col→col1 (hex), a→a1, cell, rot, vrot, grav, drag, frames(flipbook) */
function emitP(o,sys){const S=sys||(o.add===false?PS_NRM:PS_ADD);if(GFX.q==='laag'&&!o.must&&Math.random()<.45)return;
  const i=S.i++%S.cap;const p=S.P[i];p.x=o.x;p.y=o.y;p.z=o.z;p.vx=o.vx||0;p.vy=o.vy||0;p.vz=o.vz||0;p.life=p.max=o.life||.6;p.s0=o.size||.5;p.s1=o.size1??p.s0;
  _pc.setHex(o.col??0xffffff);p.r0=_pc.r;p.g0=_pc.g;p.b0=_pc.b;_pc.setHex(o.col1??o.col??0xffffff);p.r1=_pc.r;p.g1=_pc.g;p.b1=_pc.b;p.a0=o.a??1;p.a1=o.a1??0;
  p.cell=o.cell||0;p.rot=o.rot??Math.random()*6.283;p.vrot=o.vrot||0;p.grav=o.grav||0;p.drag=o.drag||0;p.frames=o.frames||0;p.fade=o.fade||0}
function updPsys(S,dt){const pos=S.pos,col=S.col,sz=S.sz,rot=S.rot,cell=S.cell;let any=0;
  for(let i=0;i<S.cap;i++){const p=S.P[i];if(p.life<=0){if(sz[i]!==0){sz[i]=0;any=1}continue}any=1;p.life-=dt;if(p.life<=0){sz[i]=0;continue}
    const k=1-p.life/p.max;if(p.drag){const d=Math.max(0,1-p.drag*dt);p.vx*=d;p.vy*=d;p.vz*=d}p.vy-=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.rot+=p.vrot*dt;
    pos[i*3]=p.x;pos[i*3+1]=p.y;pos[i*3+2]=p.z;sz[i]=p.s0+(p.s1-p.s0)*k;rot[i]=p.rot;
    const fa=p.fade?Math.min(1,k/p.fade):1;col[i*4]=p.r0+(p.r1-p.r0)*k;col[i*4+1]=p.g0+(p.g1-p.g0)*k;col[i*4+2]=p.b0+(p.b1-p.b0)*k;col[i*4+3]=(p.a0+(p.a1-p.a0)*k)*fa;
    cell[i]=p.frames?Math.min(p.frames-1,Math.floor(k*p.frames)):p.cell}
  if(any){for(const a of['position','aCol','aSize','aRot','aCell'])S.g.attributes[a].needsUpdate=true}}
/* grondeffecten: plat vlak met één atlasvak */
const _decalGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const DECALS=[];
function decal(x,z,o){const c=o.cell||0;const g=_decalGeo.clone();const uv=g.attributes.uv;const cx=c%8,cy=Math.floor(c/8);for(let i=0;i<uv.count;i++){uv.setXY(i,(cx+uv.getX(i))/8,1-(cy+1-uv.getY(i))/4)}
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:FX_TEX.atlas,color:o.col??0xffffff,transparent:true,opacity:o.a??1,depthWrite:false,blending:o.add===false?THREE.NormalBlending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2}));
  m.position.set(x,(o.y??groundH(x,z))+.06,z);m.rotation.y=o.rot??Math.random()*6.28;scene.add(m);DECALS.push({m,t:0,dur:o.life||1,s0:o.size||2,s1:o.size1??o.size??2,a0:o.a??1,spin:o.spin||0,hold:o.hold||0});return m}
function updDecals(dt){for(let i=DECALS.length-1;i>=0;i--){const d=DECALS[i];d.t+=dt;const k=Math.min(1,d.t/d.dur);const s=d.s0+(d.s1-d.s0)*Math.min(1,k*(d.hold?3:1));d.m.scale.set(s,1,s);d.m.rotation.y+=d.spin*dt;
  d.m.material.opacity=d.a0*(d.hold?(k<d.hold?1:1-(k-d.hold)/(1-d.hold)):1-k);if(k>=1){scene.remove(d.m);d.m.geometry.dispose();d.m.material.dispose();DECALS.splice(i,1)}}}
function updParticles(dt){const h=renderer.domElement.height;const sc=h/(2*Math.tan(camera.fov*Math.PI/360));for(const S of[PS_ADD,PS_NRM,PS_BOOM]){S.m.uniforms.scale.value=sc;updPsys(S,dt)}updDecals(dt)}
/* ---------------- effectbibliotheek ---------------- */
const FRN=(a,b)=>a+Math.random()*(b-a);
function sparks(x,y,z,col,n=10,sp=5,size=.35,life=.45){for(let i=0;i<n;i++){const a=FRN(0,6.283),u=FRN(-.2,1);emitP({x,y,z,vx:Math.cos(a)*sp*FRN(.4,1),vy:u*sp,vz:Math.sin(a)*sp*FRN(.4,1),grav:12,drag:2,life:life*FRN(.6,1.2),size,size1:size*.3,col,col1:col,cell:FXC.glint,vrot:FRN(-8,8)})}}
function puff(x,y,z,col=0xcab9a0,n=4,size=1,life=.9,sp=1){for(let i=0;i<n;i++)emitP({x:x+FRN(-.3,.3),y:y+FRN(0,.3),z:z+FRN(-.3,.3),vx:FRN(-sp,sp),vy:FRN(.3,1.2)*sp,vz:FRN(-sp,sp),drag:2.2,life:life*FRN(.7,1.2),size:size*.6,size1:size*1.6,col,a:.55,a1:0,cell:FRN(0,1)<.5?FXC.smoke:FXC.smoke2,vrot:FRN(-1,1),add:false})}
function flash(x,y,z,col,size=1.6,life=.14){emitP({x,y,z,life,size,size1:size*1.4,col,a:1,a1:0,cell:FXC.flare,must:1});emitP({x,y,z,life:life*1.4,size:size*.7,size1:size*1.2,col:0xffffff,a:.8,a1:0,cell:FXC.soft,must:1})}
function boom(x,y,z,size=4,life=.7){emitP({x,y,z,vy:1.2,life,size,size1:size*1.25,col:0xffffff,a:1,a1:.85,frames:9,rot:FRN(-.3,.3),must:1},PS_BOOM)}
/* melee: zwaardhaal + vonken bij het doelwit */
function hitFx(x,y,z,crit,col=0xfff0c8){emitP({x,y,z,life:.22,size:crit?3.4:2.4,size1:crit?4:2.8,col,col1:0xffc070,a:1,a1:0,cell:FRN(0,1)<.5?FXC.slash:FXC.arc,rot:FRN(0,6.28),vrot:FRN(-3,3),must:1});
  flash(x,y,z,crit?0xffd060:0xffe8b0,crit?2.4:1.4);sparks(x,y,z,crit?0xffd060:0xffe8c0,crit?18:9,crit?7:5);if(crit)emitP({x,y:y+.3,z,life:.5,size:2.2,size1:3.6,col:0xffe080,a:1,a1:0,cell:FXC.crit,vrot:2,must:1})}
/* zwaai voor de speler (zichtbaar ook als je mist) */
function swingFx(x,y,z,ry,combo){const fx=x+Math.sin(ry)*1.1,fz=z+Math.cos(ry)*1.1;emitP({x:fx,y:y+1.1,z:fz,life:.2,size:2.6,size1:3.1,col:0xe8f0ff,a:.85,a1:0,cell:FXC.arc,rot:[2.6,-.6,1.57][combo%3]+FRN(-.2,.2),must:1})}
function dustRing(x,z,r,n=12,col=0xc8b090){const y=groundH(x,z)+.2;for(let i=0;i<n;i++){const a=i/n*6.283;emitP({x:x+Math.cos(a)*r*.4,y,z:z+Math.sin(a)*r*.4,vx:Math.cos(a)*r*1.4,vy:FRN(.2,.8),vz:Math.sin(a)*r*1.4,drag:3,life:FRN(.5,.8),size:.8,size1:2.2,col,a:.5,a1:0,cell:FXC.smoke2,add:false})}}
function shockwave(x,z,r,col,life=.5){decal(x,z,{cell:FXC.ring,size:r*.3,size1:r*2.2,col,life,a:1})}
function runeCircle(x,z,r,col,life=1.2){decal(x,z,{cell:FXC.circle,size:r*1.6,size1:r*2.2,col,life,a:1,spin:1.2,hold:.6})}
function healFx(x,y,z,col=0x70ff8a){runeCircle(x,z,1,col,1.1);for(let i=0;i<14;i++){const a=FRN(0,6.28),r=FRN(.2,.9);emitP({x:x+Math.cos(a)*r,y:y+FRN(0,.4),z:z+Math.sin(a)*r,vy:FRN(1.5,3),drag:.6,life:FRN(.8,1.3),size:.7,size1:.2,col,a:1,a1:0,cell:FRN(0,1)<.5?FXC.star:FXC.glint,fade:.15})}}
function lvlFx(x,y,z){runeCircle(x,z,1.8,0xffd34d,1.8);shockwave(x,z,4,0xffe08a,.8);for(let i=0;i<40;i++){const a=FRN(0,6.28),r=FRN(.3,1.6);emitP({x:x+Math.cos(a)*r,y:y+FRN(0,1),z:z+Math.sin(a)*r,vx:Math.cos(a)*.6,vy:FRN(2,6),vz:Math.sin(a)*.6,drag:.8,life:FRN(1,1.8),size:FRN(.4,.9),size1:.1,col:0xffe080,col1:0xffffff,a:1,a1:0,cell:FRN(0,1)<.4?FXC.crit:FXC.star,vrot:FRN(-3,3),fade:.1,must:1})}}
function twirlFx(x,y,z,col){emitP({x,y,z,life:.55,size:3,size1:.5,col,a:1,a1:0,cell:FXC.twirl,vrot:-9,must:1});emitP({x,y,z,life:.45,size:.5,size1:3.2,col,a:.9,a1:0,cell:FXC.twirl2,vrot:7,must:1});sparks(x,y,z,col,14,3.5,.4,.6)}
/* projectielsporen en inslagen, per type */
function projTrail(type,p,dt){const x=p.x,y=p.y,z=p.z;
  if(type==='fire'){emitP({x,y,z,life:.09,size:2.2,size1:1.6,col:0xffb040,a:.9,a1:0,cell:FXC.soft});emitP({x,y,z,vx:FRN(-.6,.6),vy:FRN(-.3,.3),vz:FRN(-.6,.6),life:FRN(.2,.35),size:1.3,size1:.3,col:0xfff0a0,col1:0xff6a10,a:1,a1:0,cell:FXC.flame,vrot:FRN(-5,5)});if(Math.random()<.5)emitP({x,y,z,vx:FRN(-2,2),vy:FRN(0,2),vz:FRN(-2,2),grav:4,life:FRN(.3,.6),size:.25,size1:.05,col:0xffd060,a:1,a1:0,cell:FXC.glint});emitP({x,y,z,vx:FRN(-.4,.4),vy:FRN(.2,.9),vz:FRN(-.4,.4),life:FRN(.25,.4),size:.9,size1:.2,col:0xffd070,col1:0xff3a10,a:1,a1:0,cell:FXC.fire,vrot:FRN(-4,4)});if(Math.random()<.35)emitP({x,y,z,vy:.8,life:.7,size:.5,size1:1.2,col:0x4a4440,a:.35,a1:0,cell:FXC.smoke,add:false})}
  else if(type==='meteor'){for(let k=0;k<2;k++)emitP({x:x+FRN(-.5,.5),y:y+FRN(-.5,.5),z:z+FRN(-.5,.5),vx:FRN(-1,1),vy:FRN(1,2),vz:FRN(-1,1),life:FRN(.35,.6),size:2.6,size1:.6,col:0xffd060,col1:0xff3008,a:1,a1:0,cell:FXC.fire,vrot:FRN(-3,3)});emitP({x,y,z,vy:1.5,life:1.1,size:1.4,size1:3.2,col:0x3a3430,a:.5,a1:0,cell:FXC.smoke,add:false})}
  else if(type==='frost'){emitP({x,y,z,life:.08,size:1.6,size1:1.2,col:0x9ae0ff,a:.8,a1:0,cell:FXC.soft});emitP({x,y,z,vx:FRN(-.5,.5),vy:FRN(-.5,.5),vz:FRN(-.5,.5),life:.4,size:.6,size1:.1,col:0xc8f0ff,col1:0x4aa8ff,a:1,a1:0,cell:FXC.star,vrot:FRN(-5,5)})}
  else if(type==='arcane'||type==='shadow'){emitP({x,y,z,vx:FRN(-.6,.6),vy:FRN(-.6,.6),vz:FRN(-.6,.6),life:.45,size:.7,size1:.1,col:type==='shadow'?0xa060ff:0xe0b0ff,col1:0x7a2aff,a:1,a1:0,cell:FRN(0,1)<.5?FXC.glint:FXC.star,vrot:FRN(-6,6)})}
  else if(type==='kogel'){emitP({x,y,z,life:.07,size:.5,size1:.2,col:0xfff0b0,a:1,a1:0,cell:FXC.soft})}
  else if(type==='arrow'){emitP({x,y,z,life:.22,size:.45,size1:.05,col:0xfff2d0,col1:0xffc060,a:.9,a1:0,cell:FXC.soft});if(Math.random()<.3)emitP({x,y,z,vy:FRN(-.5,.5),life:.3,size:.18,size1:.02,col:0xffe8a0,a:1,a1:0,cell:FXC.glint})}
  else if(type==='holy'){emitP({x,y,z,vy:.5,life:.4,size:.6,size1:.1,col:0xfff0a0,a:1,a1:0,cell:FXC.star})}}
function projImpact(type,x,y,z){
  if(type==='fire'){boom(x,y,z,3.4,.55);flash(x,y,z,0xffa040,3);emitP({x,y,z,life:.35,size:.8,size1:4.2,col:0xffc060,a:1,a1:0,cell:FXC.burst,must:1});const gy=groundH(x,z);shockwave(x,z,2.6,0xff8a30,.4);decal(x,z,{cell:FXC.scorch2,size:2.2,col:0x1a0c06,a:.7,life:3,add:false,hold:.6});sparks(x,y,z,0xffa040,22,6,.45,.6);for(let i=0;i<8;i++)emitP({x:x+FRN(-.6,.6),y:gy+.2,z:z+FRN(-.6,.6),vy:FRN(1,2.5),life:FRN(.4,.7),size:1.1,size1:.2,col:0xffd070,col1:0xff3a10,a:1,a1:0,cell:FXC.flame,vrot:FRN(-3,3)});puff(x,y,z,0x3a3430,3,1.2,1)}
  else if(type==='meteor'){boom(x,y+.8,z,7,.9);boom(x+FRN(-1,1),y+.5,z+FRN(-1,1),5,.75);shockwave(x,z,6,0xff8a40,.6);decal(x,z,{cell:FXC.scorch,size:6,col:0x1a0c06,a:.85,life:6,add:false,hold:.7});
    sparks(x,y+.5,z,0xffb040,30,9,.5,.8);puff(x,y,z,0x3a3430,8,2.4,1.6,2.2);for(let i=0;i<10;i++)emitP({x,y:y+.3,z,vx:FRN(-6,6),vy:FRN(4,9),vz:FRN(-6,6),grav:18,life:FRN(.6,1),size:.5,size1:.4,col:0x8a6a4a,a:1,a1:.6,cell:FXC.dirt,add:false})}
  else if(type==='frost'){flash(x,y,z,0x9ae0ff,2.2);emitP({x,y,z,life:.4,size:.6,size1:3,col:0xc8f0ff,a:1,a1:0,cell:FXC.shine,must:1});sparks(x,y,z,0xc8f0ff,18,5,.45,.6)}
  else if(type==='arcane'||type==='shadow'){flash(x,y,z,0xc08aff,1.6);emitP({x,y,z,life:.4,size:.6,size1:2.4,col:0xc08aff,a:1,a1:0,cell:FXC.twirl2,vrot:6,must:1});sparks(x,y,z,0xe0b0ff,8,3.5)}
  else if(type==='kogel'){sparks(x,y,z,0xffe0a0,5,6,.25,.25);emitP({x,y,z,life:.08,size:.9,col:0xfff0c0,a:1,a1:0,cell:FXC.flare})}
  else if(type==='arrow'){sparks(x,y,z,0xfff0d0,8,4,.3,.35);emitP({x,y,z,life:.12,size:1.2,size1:1.6,col:0xfff0c0,a:.9,a1:0,cell:FXC.flare})}
  else if(type==='holy'){flash(x,y,z,0xffe08a,1.8);sparks(x,y,z,0xffe8a0,10,4)}}
function muzzleFx(from,dirX,dirZ){emitP({x:from.x+dirX*.4,y:from.y,z:from.z+dirZ*.4,life:.06,size:1.1,size1:1.4,col:0xffd070,a:1,a1:0,cell:FXC.burst,must:1});emitP({x:from.x+dirX*.7,y:from.y,z:from.z+dirZ*.7,life:.07,size:.9,size1:1.2,col:0xffe8a0,a:1,a1:0,cell:FXC.muzzle,rot:Math.atan2(dirX,dirZ)+1.57})}
/* vaardigheden met een eigen show */
function whirlFx(x,y,z){for(let i=0;i<10;i++){const a=i/10*6.283;emitP({x:x+Math.cos(a)*2.4,y:y+1,z:z+Math.sin(a)*2.4,vx:-Math.sin(a)*8,vz:Math.cos(a)*8,drag:3,life:.35,size:2.4,size1:3,col:0xe8f0ff,col1:0x9ab8ff,a:.9,a1:0,cell:FXC.arc,rot:-a,vrot:6,must:1})}for(let i=0;i<8;i++){const a=i/8*6.283+.4;emitP({x:x+Math.cos(a)*1.4,y:y+.6,z:z+Math.sin(a)*1.4,vx:-Math.sin(a)*6,vz:Math.cos(a)*6,drag:3,life:.3,size:2,size1:2.6,col:0xffffff,col1:0xc8d8ff,a:.8,a1:0,cell:FXC.slash,rot:-a,vrot:8,must:1})}sparks(x,y+1,z,0xe8f0ff,16,7,.35,.4);dustRing(x,z,4,14);shockwave(x,z,6,0xdde6ff,.45);shockwave(x,z,3.5,0xffffff,.3)}
function novaFx(x,z){const y=groundH(x,z);shockwave(x,z,9,0x9ae0ff,.6);runeCircle(x,z,2.5,0x6ac8ff,.9);for(let i=0;i<36;i++){const a=FRN(0,6.283),r=FRN(1,8.5);emitP({x:x+Math.cos(a)*r,y:y+FRN(.2,1.4),z:z+Math.sin(a)*r,vy:FRN(.2,1.2),life:FRN(.6,1.1),size:FRN(.4,.9),size1:.1,col:0xe8faff,col1:0x5ab0ff,a:1,a1:0,cell:FRN(0,1)<.5?FXC.star:FXC.crit,vrot:FRN(-4,4),fade:.1})}
  for(let i=0;i<12;i++){const a=i/12*6.283;emitP({x:x+Math.cos(a)*3,y:y+.4,z:z+Math.sin(a)*3,vx:Math.cos(a)*6,vz:Math.sin(a)*6,drag:2,life:.9,size:1.4,size1:3.2,col:0xd8f2ff,a:.4,a1:0,cell:FXC.smoke2,add:false})}
  flash(x,y+1,z,0xbfeaff,4,.2);shockwave(x,z,5,0xffffff,.35);decal(x,z,{cell:FXC.scorch,size:7,col:0x9ad8ff,a:.55,life:4,hold:.75});
  for(let i=0;i<26;i++){const a=FRN(0,6.283),s=FRN(8,15);emitP({x,y:y+.6,z,vx:Math.cos(a)*s,vy:FRN(1,5),vz:Math.sin(a)*s,grav:10,drag:1.6,life:FRN(.5,.8),size:FRN(.5,.9),size1:.2,col:0xffffff,col1:0x7ac8ff,a:1,a1:0,cell:FXC.shine,vrot:FRN(-8,8),must:1})}
  for(let i=0;i<10;i++)emitP({x:x+FRN(-.6,.6),y:y+FRN(0,1),z:z+FRN(-.6,.6),vy:FRN(3,6),drag:1.5,life:FRN(.7,1.1),size:1.2,size1:3,col:0xd8f2ff,a:.35,a1:0,cell:FXC.smoke,add:false})}
function shoutFx(x,y,z){shockwave(x,z,5,0xffc040,.7);runeCircle(x,z,1.4,0xffb030,1);for(let i=0;i<24;i++){const a=FRN(0,6.28);emitP({x:x+Math.cos(a)*.6,y:y+FRN(.2,1.6),z:z+Math.sin(a)*.6,vx:Math.cos(a)*FRN(1,3),vy:FRN(1,4),vz:Math.sin(a)*FRN(1,3),drag:1.5,life:FRN(.6,1),size:FRN(.3,.6),size1:.1,col:0xffd070,col1:0xff7a20,a:1,a1:0,cell:FXC.glint,fade:.1})}
  flash(x,y+1.2,z,0xffb030,3.5,.25);for(let i=0;i<8;i++){const a=i/8*6.283;for(let k=0;k<3;k++)emitP({x:x+Math.cos(a)*1.6,y:y+.2+k*.5,z:z+Math.sin(a)*1.6,vy:FRN(3,5),drag:1.2,life:FRN(.5,.8),size:1.3-k*.25,size1:.2,col:0xffe070,col1:0xff4a10,a:1,a1:0,cell:FXC.flame,vrot:FRN(-3,3),must:k===0})}}
function rainFx(x,z){runeCircle(x,z,2.4,0xffd36a,1);decal(x,z,{cell:FXC.thinring,size:12,size1:12,col:0xffd36a,life:1,a:.8})}
function chargeTrail(x,y,z){emitP({x:x+FRN(-.3,.3),y:y+.2,z:z+FRN(-.3,.3),vy:FRN(.3,1),drag:2,life:FRN(.5,.8),size:.8,size1:2,col:0xc8b090,a:.5,a1:0,cell:FXC.smoke2,add:false});if(Math.random()<.5)emitP({x,y:y+1,z,life:.25,size:1.2,size1:.4,col:0xffa050,a:.8,a1:0,cell:FXC.soft})}
/* ---- extra vaardigheidseffecten ---- */
/* opladen tijdens een spreuk: kleur volgt het pictogram van de vaardigheid */
let _castAcc=0;
function castFx(c,dt,x,y,z){_castAcc+=dt;if(_castAcc<.035)return;_castAcc=0;const col=new THREE.Color(c.a.ic&&c.a.ic[1]||'#ffd070').getHex();const k=Math.min(1,c.t/c.dur);
  for(let i=0;i<2;i++){const a=FRN(0,6.283),r=FRN(.6,1.2)*(1.2-k*.6);emitP({x:x+Math.cos(a)*r,y:y+FRN(-.5,.5),z:z+Math.sin(a)*r,vx:-Math.cos(a)*r*3,vy:FRN(-.3,.3),vz:-Math.sin(a)*r*3,life:.3,size:.35,size1:.05,col:0xffffff,col1:col,a:1,a1:0,cell:FXC.glint})}
  emitP({x,y,z,life:.08,size:.8+k*1.4,size1:.8+k*1.6,col,a:.7,a1:0,cell:FXC.soft});
  if(Math.random()<.25)decal(x,z,{y:groundH(x,z),cell:FXC.circle,size:1.4,size1:1.6,col,life:.5,a:.5,spin:2})}
/* Flits: spoor van arcane vonken tussen begin- en eindpunt */
function blinkFx(x0,y0,z0,x1,y1,z1){const n=18;for(let i=0;i<=n;i++){const f=i/n;emitP({x:x0+(x1-x0)*f,y:y0+(y1-y0)*f+FRN(-.2,.2)+.9,z:z0+(z1-z0)*f,vy:FRN(0,.8),life:FRN(.3,.55),size:FRN(.6,1),size1:.1,col:0xe8c8ff,col1:0x7a2aff,a:1,a1:0,cell:FRN(0,1)<.5?FXC.star:FXC.glint,vrot:FRN(-5,5),must:i%3===0})}
  emitP({x:x1,y:y1+1,z:z1,life:.3,size:4,size1:.5,col:0xc08aff,a:1,a1:0,cell:FXC.flare,must:1});shockwave(x1,z1,2.5,0xc08aff,.4)}
/* Heldhaftige Slag: grote gouden haal en een kleine schokgolf */
function slamFx(x,y,z,ry){emitP({x,y,z,life:.3,size:3.6,size1:4.4,col:0xfff0b0,col1:0xffa030,a:1,a1:0,cell:FXC.slash,rot:ry+2.4,must:1});emitP({x,y,z,life:.25,size:2.6,size1:3.6,col:0xffffff,a:.8,a1:0,cell:FXC.arc,rot:ry-.6,must:1});
  flash(x,y,z,0xffd060,2.6);sparks(x,y,z,0xffd070,16,6,.4,.5);shockwave(x,z,2.2,0xffd070,.3)}
/* Stormloop: inslag bij aankomst */
function chargeImpactFx(x,y,z){flash(x,y+1,z,0xffc070,3);shockwave(x,z,3.5,0xffc070,.4);emitP({x,y:y+1,z,life:.35,size:.8,size1:4,col:0xffe0a0,a:1,a1:0,cell:FXC.burst,must:1});sparks(x,y+1,z,0xffd080,14,6,.4,.5)}
/* Meteoor: gloeiende zuil en hitte op de grond tijdens de val */
function meteorWarnFx(x,z){const y=groundH(x,z);decal(x,z,{cell:FXC.circle,size:6,size1:7,col:0xff6a20,life:.9,a:.9,spin:2,hold:.8});for(let i=0;i<10;i++){const a=FRN(0,6.28),r=FRN(.5,5);emitP({x:x+Math.cos(a)*r,y:y+.2,z:z+Math.sin(a)*r,vy:FRN(1,3),life:FRN(.4,.8),size:.6,size1:.1,col:0xffb040,col1:0xff3010,a:1,a1:0,cell:FXC.flame})}}
/* omgeving: rook uit schoorstenen en vlammen bij fakkels, rond de camera */
const AMBIENT={smoke:[],flames:[],t:0};
function ambientInit(){AMBIENT.init=1;const v=new THREE.Vector3();
  for(const f of flames){let a=f,mob=false;while(a){if(a.userData&&a.userData.ent){mob=true;break}a=a.parent}if(mob||!f.parent)continue;f.updateWorldMatrix(true,false);f.getWorldPosition(v);const s=(f.geometry.parameters&&f.geometry.parameters.radius||.16)/.16;AMBIENT.flames.push({x:v.x,y:v.y,z:v.z,s:Math.min(2.5,s*f.getWorldScale(new THREE.Vector3()).x)})}
  for(const s of TOWN_SMOKE)AMBIENT.smoke.push(s);
  for(const h of HOUSES){const o=h.model||(h.g.visible?h.g:null);if(!o)continue;o.updateWorldMatrix(true,true);const b=new THREE.Box3().setFromObject(o);if(!isFinite(b.max.y))continue;
    const rot=h.rot?Math.PI/2:0;const ox=h.w*.25,oz=h.d*.15;AMBIENT.smoke.push({x:h.x+Math.cos(rot)*ox+Math.sin(rot)*oz,y:b.max.y-.3,z:h.z-Math.sin(rot)*ox+Math.cos(rot)*oz})}}
function ambientFx(dt,cx,cz){if(!AMBIENT.init){if(S.mode!=='play')return;ambientInit()}AMBIENT.t+=dt;if(AMBIENT.t<.12)return;const step=AMBIENT.t;AMBIENT.t=0;const q=GFX.q==='laag'?.35:GFX.q==='middel'?.7:1;
  for(const s of AMBIENT.smoke){if(Math.abs(s.x-cx)>70||Math.abs(s.z-cz)>70)continue;if(Math.random()<q*step*3)emitP({x:s.x+FRN(-.15,.15),y:s.y,z:s.z+FRN(-.15,.15),vx:FRN(.2,.6),vy:FRN(.9,1.4),vz:FRN(-.2,.2),drag:.3,life:FRN(3.5,5),size:1,size1:4.6,col:0x5e5a56,col1:0x9a968f,a:.62,a1:0,cell:FXC.smoke,vrot:FRN(-.3,.3),fade:.15,add:false,must:1})}
  for(const f of AMBIENT.flames){if(Math.abs(f.x-cx)>45||Math.abs(f.z-cz)>45)continue;if(Math.random()<q*step*14){const s=f.s||1;emitP({x:f.x+FRN(-.06,.06)*s,y:f.y-.1*s,z:f.z+FRN(-.06,.06)*s,vy:FRN(.8,1.6)*s,life:FRN(.3,.5),size:.75*s,size1:.15*s,col:0xffd27a,col1:0xff4a10,a:1,a1:0,cell:FRN(0,1)<.6?FXC.flame:FXC.fire,rot:FRN(-.3,.3),vrot:FRN(-1,1),must:1});if(Math.random()<.15)emitP({x:f.x,y:f.y+.3*s,z:f.z,vx:FRN(-.5,.5),vy:FRN(1,2.4),vz:FRN(-.5,.5),life:FRN(.6,1),size:.12,size1:.04,col:0xffb050,a:1,a1:0,cell:FXC.soft})}}}
/* portals: sparks drift out of the swirl on both sides (only for portals near the camera) */
let _ptT=0;const _pfV=new THREE.Vector3();
function portalFx(dt){_ptT-=dt;if(_ptT>0)return;_ptT=GFX.q==='laag'?.14:.06;
  for(const m of PORTALS){if(!m.parent||!m.visible)continue;m.getWorldPosition(_pfV);if(Math.abs(_pfV.x-camTarget.x)+Math.abs(_pfV.z-camTarget.z)>50)continue;const u=m.userData.portal;
    const t=(Math.random()-.5)*1.7*u.hw,h=.2+Math.random()*(u.sh+u.hw*.5),ry=m.rotation.y,nx=Math.sin(ry),nz=Math.cos(ry),sd=Math.random()<.5?1:-1;
    emitP({x:_pfV.x+Math.cos(ry)*t+nx*sd*.12,y:_pfV.y+h,z:_pfV.z-Math.sin(ry)*t+nz*sd*.12,vx:nx*sd*(.3+Math.random()*.6),vy:.35+Math.random()*.6,vz:nz*sd*(.3+Math.random()*.6),life:1.2,size:.28,size1:.04,col:u.col,a:.95,a1:0,drag:1.1})}}
