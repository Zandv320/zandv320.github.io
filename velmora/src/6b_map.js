/* ===================== World map (atlas) =====================
   An illustrated map of Velmora, painted once into a canvas from the real world data (heights, terrain colours,
   roads, trees, rocks, water, the town and its buildings), plus a live layer on top that is redrawn every frame
   while the map is open: your position and heading, group members, other players, quest givers and quest areas.
   The map can be zoomed (wheel, pinch, + / −) and dragged; "Follow" keeps you in the middle. */
const ATLAS={c:null,N:0,k:0,busy:false};
const MAPST={zoom:0,cx:0,cz:0,follow:true,src:null,drag:null,pinch:null,dpr:1,w:0,h:0,t:0};
function atlasBuild(){if(ATLAS.c)return;if(!ATLAS.gen)ATLAS.gen=atlasGen();while(!ATLAS.gen.next().done){}}
/* painted in slices of rows, so it can also run in idle moments without a hitch */
function* atlasGen(){const t0=performance.now();
  const N=isTouch?1280:2048,k=N/640;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const col=terrain.geometry.attributes.color.array;
  /* bilinear samples of the terrain colour grid and the height map */
  const samp=(x,z,o)=>{const fx=clamp((x+WSIZE/2)/CELL,0,SEG-.001),fz=clamp((z+WSIZE/2)/CELL,0,SEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;const a=(i*HN+j)*3,b=a+3,cc=a+HN*3,d=cc+3;for(let n=0;n<3;n++)o[n]=(col[a+n]*(1-u)+col[b+n]*u)*(1-v)+(col[cc+n]*(1-u)+col[d+n]*u)*v;return o};
  const img=g.createImageData(N,N),D=img.data,o=[0,0,0],L=[-.55,-.62,.56];const ll=Math.hypot(...L);L[0]/=ll;L[1]/=ll;L[2]/=ll;
  const PAPER=[236,222,188];const step=640/N;
  for(let py=0;py<N;py++){if(py%48===47)yield;const z=-320+(py+.5)*step;for(let px=0;px<N;px++){const x=-320+(px+.5)*step;
    const h=groundH(x,z),hx=groundH(x+1.2,z)-groundH(x-1.2,z),hz=groundH(x,z+1.2)-groundH(x,z-1.2);
    samp(x,z,o);let r=Math.pow(o[0],1/2.2)*255,gg=Math.pow(o[1],1/2.2)*255,b=Math.pow(o[2],1/2.2)*255;
    /* water */
    const lk=Math.hypot(x-LAKE.x,z-LAKE.z);const wet=(lk<LAKE.r*1.25&&h<-.7)||(pondDist(x,z)<.2&&h<.62&&Math.hypot(x,z)<TOWN.wall);
    if(wet){const depth=lk<LAKE.r*1.25?clamp((-.7-h)/3.6,0,1):clamp((.62-h)/1.4,0,1);r=lerp(118,46,depth);gg=lerp(184,108,depth);b=lerp(212,160,depth);
      const band=(depth*9)%1;if(band<.09&&depth<.8){r+=18;gg+=18;b+=14}}
    else{/* hill shading and contour lines */const nx=-hx/2.4,nz=-hz/2.4,nl=Math.hypot(nx,1,nz);const sh=clamp((nx*L[0]+L[2]+nz*L[1])/nl,0,1);const f=.72+sh*.48;r*=f;gg*=f;b*=f;
      const slope=Math.hypot(hx,hz)/2.4;if(slope>.04){const ci=Math.floor(h/2.5),cn=Math.floor(groundH(x+step,z)/2.5),cd=Math.floor(groundH(x,z+step)/2.5);if(ci!==cn||ci!==cd){r*=.84;gg*=.82;b*=.78}}}
    /* a touch of parchment and paper grain */
    const grain=(hash(px,py)-.5)*10;r=lerp(r,PAPER[0],.16)+grain;gg=lerp(gg,PAPER[1],.16)+grain;b=lerp(b,PAPER[2],.16)+grain;
    const i=(py*N+px)*4;D[i]=r;D[i+1]=gg;D[i+2]=b;D[i+3]=255}}
  g.putImageData(img,0,0);
  g.setTransform(k,0,0,k,320*k,320*k);g.lineCap='round';g.lineJoin='round';
  const poly=(pts,close)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(close)g.closePath()};
  /* shorelines */
  g.strokeStyle='rgba(40,70,90,.55)';g.lineWidth=.8;{g.beginPath();for(let a=0;a<=6.3;a+=.02){let r=LAKE.r*1.25;for(let s=0;s<40;s++){const rr=LAKE.r*.3+s*1.2;if(groundH(LAKE.x+Math.cos(a)*rr,LAKE.z+Math.sin(a)*rr)>-.7){r=rr;break}}const x=LAKE.x+Math.cos(a)*r,z=LAKE.z+Math.sin(a)*r;a?g.lineTo(x,z):g.moveTo(x,z)}g.stroke()}
  g.beginPath();g.ellipse(POND.x,POND.z,POND.r*1.25+.6,POND.r+.6,0,0,7);g.stroke();
  /* roads: dark edge, sandy middle; cobbles inside the walls */
  for(const[w,cl]of[[6.4,'rgba(92,70,44,.85)'],[4.6,'#d6bd86']]){g.strokeStyle=cl;g.lineWidth=w;for(const p of PATHS){poly(p);g.stroke()}}
  g.save();g.beginPath();g.arc(0,0,TOWN.wall,0,7);g.clip();g.strokeStyle='#bdb3a2';g.lineWidth=4.6;for(const p of PATHS){poly(p);g.stroke()}g.restore();
  g.strokeStyle='rgba(120,96,64,.35)';g.lineWidth=.35;g.setLineDash([.9,1.1]);for(const p of PATHS){poly(p);g.stroke()}g.setLineDash([]);
  /* fields: crop rows */
  g.strokeStyle='rgba(150,118,40,.35)';g.lineWidth=.45;for(let x=-36;x<50;x+=1.6){if(Math.floor((x+200)/9)%2)continue;g.beginPath();g.moveTo(x,96);g.lineTo(x,162);g.stroke()}
  /* trees: shadow, canopy, highlight */
  const tree=(x,z,r,c1,c2,pine)=>{g.fillStyle='rgba(30,40,20,.28)';g.beginPath();g.arc(x+r*.35,z+r*.35,r,0,7);g.fill();
    g.fillStyle=c1;if(pine){g.beginPath();for(let i=0;i<7;i++){const a=i/7*6.283,rr=i%2?r*.72:r;i?g.lineTo(x+Math.cos(a)*rr,z+Math.sin(a)*rr):g.moveTo(x+Math.cos(a)*rr,z+Math.sin(a)*rr)}g.closePath();g.fill()}else{g.beginPath();g.arc(x,z,r,0,7);g.fill()}
    g.fillStyle=c2;g.beginPath();g.arc(x-r*.3,z-r*.3,r*.45,0,7);g.fill();g.strokeStyle='rgba(20,35,15,.5)';g.lineWidth=.25;g.beginPath();g.arc(x,z,r,0,7);g.stroke()};
  for(const t of pineT)tree(t[0],t[1],1.9*t[2],'#3f6a37','#5f8a4a',true);for(const t of oakT)tree(t[0],t[1],2.4*t[2],'#5f8e3f','#86b15a');for(const t of deadT)tree(t[0],t[1],1.5*t[2],'#7a6a4a','#95856a');
  for(const t of TOWN_T)tree(t.x,t.z,2*t.s,'#5a9a46','#83c160');
  /* rocks */
  for(const t of rockT){const s=t[2];g.fillStyle='rgba(30,30,30,.25)';g.beginPath();g.ellipse(t[0]+.4*s,t[1]+.4*s,1.1*s,.8*s,t[3],0,7);g.fill();g.fillStyle='#9a958a';g.beginPath();g.ellipse(t[0],t[1],1.1*s,.8*s,t[3],0,7);g.fill();g.fillStyle='#c4beb1';g.beginPath();g.ellipse(t[0]-.3*s,t[1]-.25*s,.5*s,.35*s,t[3],0,7);g.fill()}
  /* buildings: shadow, roof in the model's colour, ridge line */
  const ROOF={red:'#b8432f',blue:'#3f6fb8',yellow:'#d9a43a',green:'#4f9a4a'};
  const bld=(x,z,w,d,ry,roof,ridge=true)=>{g.save();g.translate(x,z);g.rotate(ry);g.fillStyle='rgba(30,25,15,.35)';g.fillRect(-w/2+.8,-d/2+.8,w,d);g.fillStyle=roof;g.fillRect(-w/2,-d/2,w,d);if(ridge){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(-w/2,0,w,d/2);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(-w/2,-d/2,w,d/2)}
    g.strokeStyle='rgba(40,25,15,.75)';g.lineWidth=.35;g.strokeRect(-w/2,-d/2,w,d);if(ridge){g.strokeStyle='rgba(255,255,255,.35)';g.beginPath();g.moveTo(-w/2+.6,0);g.lineTo(w/2-.6,0);g.stroke()}g.restore()};
  for(const b of TOWN_B){const cl=Object.keys(ROOF).find(k=>b.m.endsWith(k));const grey=/castle|tower|well/.test(b.m);const w=b.q%2?b.d:b.w,d=b.q%2?b.w:b.d;
    if(/castle/.test(b.m)){bld(b.x,b.z,b.w*.8,b.d*.8,0,'#9a9890',false);for(const[sx,sz]of[[-1,-1],[1,-1],[-1,1],[1,1]]){g.fillStyle='#3f6fb8';g.beginPath();g.arc(b.x+sx*b.w*.36,b.z+sz*b.d*.36,1.9,0,7);g.fill();g.strokeStyle='#223';g.lineWidth=.3;g.stroke()}}
    else if(/tower|well/.test(b.m)){g.fillStyle='#3f6fb8';g.beginPath();g.arc(b.x,b.z,Math.min(b.w,b.d)*.42,0,7);g.fill();g.strokeStyle='#223';g.lineWidth=.3;g.stroke()}
    else bld(b.x,b.z,w*.82,d*.82,b.q*Math.PI/2,cl?ROOF[cl]:grey?'#8a8880':'#a0603a')}
  for(const h of HOUSES)bld(h.x,h.z,h.w+1,h.d+1,h.rot?Math.PI/2:0,'#a3402c');
  bld(STABLE.x,STABLE.z,4.7*STABLE_S*.9,3.3*STABLE_S*.85,STABLE.ry,'#2f6a78');
  {g.fillStyle='#e0d6c0';g.beginPath();g.arc(-34,118,3.2,0,7);g.fill();g.strokeStyle='#5a4030';g.lineWidth=.4;g.stroke();g.strokeStyle='#6a4a2a';g.lineWidth=.6;for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;g.beginPath();g.moveTo(-34,118);g.lineTo(-34+Math.cos(a)*6,118+Math.sin(a)*6);g.stroke()}}
  /* market stalls and benches */
  for(const p of TOWN_P){if(/stall-(red|green)/.test(p.m)){g.save();g.translate(p.x,p.z);g.rotate(-p.ry);g.fillStyle=p.m.includes('red')?'#d0503c':'#3aa08a';g.fillRect(-1.7,-1.7,3.4,3.4);g.strokeStyle='#fff';g.lineWidth=.3;for(let s=-1.2;s<1.7;s+=.8){g.beginPath();g.moveTo(s,-1.7);g.lineTo(s,1.7);g.stroke()}g.restore()}}
  /* the square and the fountain */
  g.fillStyle='rgba(205,195,175,.9)';g.beginPath();g.arc(0,0,23,0,7);g.fill();g.strokeStyle='rgba(110,95,70,.6)';g.lineWidth=.5;g.stroke();
  g.fillStyle='#e8e2d4';g.beginPath();g.arc(0,0,5.3,0,7);g.fill();g.fillStyle='#5aa8d0';g.beginPath();g.arc(0,0,4,0,7);g.fill();g.fillStyle='#e8e2d4';g.beginPath();g.arc(0,0,1.4,0,7);g.fill();
  for(const l of TOWN_L){g.fillStyle='#ffd27a';g.beginPath();g.arc(l.x,l.z,.55,0,7);g.fill()}
  /* town wall with towers and gates */
  {const G=[...TOWN_GATES].sort((a,b)=>a-b);const arcs=G.map((g0,i)=>[g0+.118,(G[i+1]??G[0]+Math.PI*2)-.118]);
    const ring=(r,w,col,dash)=>{g.strokeStyle=col;g.lineWidth=w;g.setLineDash(dash||[]);for(const[a0,a1]of arcs){g.beginPath();g.arc(0,0,r,a0,a1);g.stroke()}g.setLineDash([])};
    ring(TOWN.wall+.7,4.4,'rgba(30,25,20,.45)');ring(TOWN.wall,3.2,'#a8a296');ring(TOWN.wall+1.2,.7,'#6e695f',[.9,.9]);ring(TOWN.wall-1.1,.35,'#e2dccf');
    for(const t of[...TOWN_WALL.tow,...TOWN_WALL.gate]){const r=t.g!==undefined?3:2.5;g.fillStyle='rgba(30,25,20,.4)';g.beginPath();g.arc(t.x+.7,t.z+.7,r,0,7);g.fill();g.fillStyle=t.g!==undefined?'#3f6fb8':'#9a968c';g.beginPath();g.arc(t.x,t.z,r,0,7);g.fill();g.strokeStyle='#2a2a30';g.lineWidth=.35;g.stroke()}}
  /* Artisans' Yard: fence and workshops */
  {g.strokeStyle='#6a4a2a';g.lineWidth=.7;g.setLineDash([1.6,.7]);const op=Math.atan2(14-CRAFT.z,-96-CRAFT.x);g.beginPath();g.arc(CRAFT.x,CRAFT.z,CRAFT.r+2,op+.5,op-.5+Math.PI*2);g.stroke();g.setLineDash([]);
    for(const s of STATIONS)if(Math.hypot(s.x-CRAFT.x,s.z-CRAFT.z)<CRAFT.r){bld(s.x,s.z,3.4,3,0,'#8a6a4a',false)}
    const f=STATIONS.find(s=>s.k==='forge');if(f)bld(f.x-3,f.z-6,8,6.5,.47,'#a3402c')}
  /* arena: stands and sand */
  {const A=ARENA,rx=ARENA_RX,rz=ARENA_RZ;const el=(k,col)=>{g.fillStyle=col;g.beginPath();g.ellipse(A.x,A.z,rx*k,rz*k,0,0,7);g.fill()};
    g.fillStyle='rgba(30,25,20,.35)';g.beginPath();g.ellipse(A.x+1.2,A.z+1.2,rx*1.66,rz*1.66,0,0,7);g.fill();el(1.66,'#a99c84');el(1.5,'#c9bca2');
    g.strokeStyle='rgba(90,75,55,.55)';g.lineWidth=.3;for(let k=1.08;k<1.48;k+=.07){g.beginPath();g.ellipse(A.x,A.z,rx*k,rz*k,0,0,7);g.stroke()}
    el(1.04,'#8f8a7e');el(1,'#e2cc98');g.fillStyle='#e2cc98';for(const s2 of[-1,1])g.fillRect(A.x+s2*rx*1.36-rx*.36,A.z-ARENA_GW,rx*.72,ARENA_GW*2);
    g.strokeStyle='rgba(60,50,40,.7)';g.lineWidth=.45;g.beginPath();g.ellipse(A.x,A.z,rx*1.66,rz*1.66,0,0,7);g.stroke();g.fillStyle='#d8a641';g.fillRect(A.x-1,A.z-.7,2,1.4)}
  /* bandit camp: palisade and tents */
  {g.strokeStyle='#5a3a20';g.lineWidth=.9;g.setLineDash([.5,.5]);const gap=Math.atan2(32,-60);g.beginPath();g.arc(CAMP.x,CAMP.z,25,gap+.35,gap-.35+Math.PI*2);g.stroke();g.setLineDash([]);
    for(const[x,z,c]of[[-8,-8,'#b09a6a'],[9,-6,'#9a6a4a'],[-6,10,'#8a7a5a'],[11,9,'#aa8a5a'],[0,-14,'#7a5a4a']]){g.fillStyle='rgba(30,20,10,.35)';g.beginPath();g.moveTo(CAMP.x+x+.8,CAMP.z+z-2.5);g.lineTo(CAMP.x+x+3.3,CAMP.z+z+3);g.lineTo(CAMP.x+x-1.7,CAMP.z+z+3);g.fill();g.fillStyle=c;g.beginPath();g.moveTo(CAMP.x+x,CAMP.z+z-3);g.lineTo(CAMP.x+x+2.6,CAMP.z+z+2.4);g.lineTo(CAMP.x+x-2.6,CAMP.z+z+2.4);g.closePath();g.fill();g.strokeStyle='#3a2a1a';g.lineWidth=.3;g.stroke()}
    g.fillStyle='#ff8a30';g.beginPath();g.arc(CAMP.x,CAMP.z,1.4,0,7);g.fill()}
  /* crypt: mausoleum, graves, fence */
  {bld(CRYPT.x,CRYPT.z-4,14,6,0,'#6a6660',false);g.fillStyle='#1a1a1a';g.fillRect(CRYPT.x-3,CRYPT.z-1.2,6,1.4);g.fillStyle='#a8a49a';for(const t of(window.__graves||[])){g.fillRect(t[0]-.5,t[1]-.2,1,.5)}
    g.strokeStyle='#2a2a2a';g.lineWidth=.35;g.beginPath();g.moveTo(CRYPT.x-20,CRYPT.z+30);g.lineTo(CRYPT.x-3.5,CRYPT.z+30);g.moveTo(CRYPT.x+3.5,CRYPT.z+30);g.lineTo(CRYPT.x+20,CRYPT.z+30);g.stroke()}
  /* cave mouth and the Dragon Pass */
  for(const[x,z,c]of[[CAVE.x,CAVE.z,'#3a2014'],[DRK_GATE.x,DRK_GATE.z,'#5a2010']]){g.fillStyle=c;g.beginPath();g.arc(x,z,3.4,Math.PI,0);g.lineTo(x+3.4,z+1.6);g.lineTo(x-3.4,z+1.6);g.closePath();g.fill();g.strokeStyle='#d8c8a0';g.lineWidth=.5;g.stroke()}
  /* vignette and frame */
  g.setTransform(1,0,0,1,0,0);const vg=g.createRadialGradient(N/2,N/2,N*.38,N/2,N/2,N*.75);vg.addColorStop(0,'rgba(80,50,20,0)');vg.addColorStop(1,'rgba(80,50,20,.45)');g.fillStyle=vg;g.fillRect(0,0,N,N);
  ATLAS.c=c;ATLAS.N=N;ATLAS.k=k;ATLAS.ms=Math.round(performance.now()-t0);window.__ATLASMS=ATLAS.ms}

/* the Dragon Realm in the same illustrated style: ash plains, glowing lava rivers, the volcano, camp and paths */
const DATLAS={c:null};
function drkAtlasBuild(){if(DATLAS.c)return DATLAS.c;if(!DATLAS.gen)DATLAS.gen=drkAtlasGen();while(!DATLAS.gen.next().done){}return DATLAS.c}
function* drkAtlasGen(){const N=isTouch?760:1024,k=N/DSZ,X0=DRK.x-DSZ/2,Z0=DRK.z-DSZ/2;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const col=drkTerrain.geometry.attributes.color.array;const img=g.createImageData(N,N),D=img.data,step=DSZ/N;
  /* lava and river glow on the coarse grid (riverDist is costly), then sampled per pixel */
  const LV=new Float32Array(DHN*DHN),GL=new Float32Array(DHN*DHN);for(let i=0;i<DHN;i++){for(let j=0;j<DHN;j++){const x=X0+j*DCELL,z=Z0+i*DCELL;LV[i*DHN+j]=drkLava(x,z)?1:0;const[rd,rw]=riverDist(x,z);GL[i*DHN+j]=smooth(clamp(1-(rd-rw)/6,0,1))}if(i%24===23)yield}
  const bil=(A,x,z)=>{const fx=clamp((x-X0)/DCELL,0,DSEG-.001),fz=clamp((z-Z0)/DCELL,0,DSEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i,a=i*DHN+j;return(A[a]*(1-u)+A[a+1]*u)*(1-v)+(A[a+DHN]*(1-u)+A[a+DHN+1]*u)*v};
  for(let py=0;py<N;py++){if(py%32===31)yield;const z=Z0+(py+.5)*step;for(let px=0;px<N;px++){const x=X0+(px+.5)*step;
    const fx=clamp((x-X0)/DCELL,0,DSEG-.001),fz=clamp((z-Z0)/DCELL,0,DSEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;const a=(i*DHN+j)*3,b=a+3,cc=a+DHN*3,d=cc+3;
    let rgb=[0,1,2].map(n=>Math.pow((col[a+n]*(1-u)+col[b+n]*u)*(1-v)+(col[cc+n]*(1-u)+col[d+n]*u)*v,1/2.2)*255);
    const h=drkH(x,z),hx=drkH(x+1.2,z)-drkH(x-1.2,z),hz=drkH(x,z+1.2)-drkH(x,z-1.2);const nl=Math.hypot(hx/2.4,1,hz/2.4);const sh=clamp((-hx/2.4*-.55+.56-hz/2.4*-.62)/nl,0,1);const f=.62+sh*.62;rgb=rgb.map(q=>q*f);
    const slope=Math.hypot(hx,hz)/2.4;if(slope>.05&&Math.floor(h/3)!==Math.floor(drkH(x+step,z)/3)){rgb=rgb.map(q=>q*.8)}
    if(bil(LV,x,z)>.5){const t=(Math.sin(x*.7)+Math.sin(z*.9+x*.3))*.25+.5;rgb=[255,lerp(110,190,t),lerp(20,60,t)]}
    else{const k2=bil(GL,x,z);if(k2>0)rgb=[lerp(rgb[0],255,k2*.55),lerp(rgb[1],120,k2*.4),lerp(rgb[2],40,k2*.3)]}
    const e=Math.max(Math.abs(x-DRK.x),Math.abs(z-DRK.z));if(e>168)rgb=rgb.map(q=>q*.55);
    const gr=(hash(px+900,py)-.5)*10;const o=(py*N+px)*4;D[o]=rgb[0]+gr;D[o+1]=rgb[1]+gr;D[o+2]=rgb[2]+gr;D[o+3]=255}}
  g.putImageData(img,0,0);g.setTransform(k,0,0,k,-X0*k,-Z0*k);g.lineCap='round';g.lineJoin='round';
  for(const[w,cl]of[[5.4,'rgba(40,28,20,.85)'],[3.8,'#b49a76']]){g.strokeStyle=cl;g.lineWidth=w;for(const p of DRK_PATHS){g.beginPath();p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()}}
  /* crater rim and the glow of the volcano */
  {const gl=g.createRadialGradient(VOLC.x,VOLC.z,2,VOLC.x,VOLC.z,VOLC.r*.5);gl.addColorStop(0,'rgba(255,140,40,.55)');gl.addColorStop(1,'rgba(255,90,20,0)');g.fillStyle=gl;g.beginPath();g.arc(VOLC.x,VOLC.z,VOLC.r*.5,0,7);g.fill();
    g.strokeStyle='#2a1a14';g.lineWidth=1.4;g.beginPath();g.arc(VOLC.x,VOLC.z,VOLC.cr+1,0,7);g.stroke()}
  /* camp tents, gate and the volcano door */
  for(let i=0;i<6;i++){const a=i/6*6.28,x=DRK_CAMP.x+Math.cos(a)*11,z=DRK_CAMP.z+Math.sin(a)*11;g.fillStyle='#a8865a';g.beginPath();g.moveTo(x,z-2.6);g.lineTo(x+2.3,z+2);g.lineTo(x-2.3,z+2);g.closePath();g.fill();g.strokeStyle='#3a2a1a';g.lineWidth=.3;g.stroke()}
  g.fillStyle='#ff8a30';g.beginPath();g.arc(DRK_CAMP.x,DRK_CAMP.z,1.4,0,7);g.fill();
  for(const[x,z,c2]of[[DRK_EXIT.x,DRK_EXIT.z,'#6ac8ff'],[VOLC_DOOR.x,VOLC_DOOR.z,'#ff5a1a']]){g.fillStyle='#1a1210';g.beginPath();g.arc(x,z,3.4,Math.PI,0);g.lineTo(x+3.4,z+1.6);g.lineTo(x-3.4,z+1.6);g.closePath();g.fill();g.strokeStyle=c2;g.lineWidth=.6;g.stroke()}
  g.setTransform(1,0,0,1,0,0);const vg=g.createRadialGradient(N/2,N/2,N*.38,N/2,N/2,N*.75);vg.addColorStop(0,'rgba(20,10,5,0)');vg.addColorStop(1,'rgba(20,10,5,.5)');g.fillStyle=vg;g.fillRect(0,0,N,N);
  DATLAS.c=c}
/* ---- the Woods of Elvia: shaded terrain, lakes, rivers and waterfalls, roads, WindStorm's walls and buildings ---- */
const EATLAS={c:null};
function elvAtlasBuild(){if(EATLAS.c)return EATLAS.c;if(!EATLAS.gen)EATLAS.gen=elvAtlasGen();while(!EATLAS.gen.next().done){}return EATLAS.c}
function* elvAtlasGen(){const N=isTouch?900:1400,k=N/ESZ,X0=ELV.x-ESZ/2,Z0=ELV.z-ESZ/2;const c=document.createElement('canvas');c.width=c.height=N;const g=c.getContext('2d');
  const col=elvTerrain.geometry.attributes.color.array;const img=g.createImageData(N,N),D=img.data,step=ESZ/N;
  const WT=new Float32Array(EHN*EHN);for(let i=0;i<EHN;i++){for(let j=0;j<EHN;j++){const x=X0+j*ECELL,z=Z0+i*ECELL;let w=elvLake(x,z)?1:0;if(!w){const[rd,,rw]=elvRiver(x,z);w=rd<rw?1:0}WT[i*EHN+j]=w}if(i%30===29)yield}
  const bil=(A,x,z)=>{const fx=clamp((x-X0)/ECELL,0,ESEG-.001),fz=clamp((z-Z0)/ECELL,0,ESEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i,a=i*EHN+j;return(A[a]*(1-u)+A[a+1]*u)*(1-v)+(A[a+EHN]*(1-u)+A[a+EHN+1]*u)*v};
  for(let py=0;py<N;py++){if(py%32===31)yield;const z=Z0+(py+.5)*step;for(let px=0;px<N;px++){const x=X0+(px+.5)*step;
    const fx=clamp((x-X0)/ECELL,0,ESEG-.001),fz=clamp((z-Z0)/ECELL,0,ESEG-.001),j=Math.floor(fx),i=Math.floor(fz),u=fx-j,v=fz-i;const a=(i*EHN+j)*3,b=a+3,cc=a+EHN*3,d=cc+3;
    let rgb=[0,1,2].map(n=>Math.pow((col[a+n]*(1-u)+col[b+n]*u)*(1-v)+(col[cc+n]*(1-u)+col[d+n]*u)*v,1/2.2)*255);
    const hx=elvH(x+1.5,z)-elvH(x-1.5,z),hz=elvH(x,z+1.5)-elvH(x,z-1.5);const nl=Math.hypot(hx/3,1,hz/3);const sh=clamp((-hx/3*-.55+.56-hz/3*-.62)/nl,0,1);rgb=rgb.map(q=>q*(.62+sh*.62));
    const w=bil(WT,x,z);if(w>.45){const t=(Math.sin(x*.35+z*.2)*.5+.5)*.12;rgb=[lerp(70,95,t),lerp(140,165,t),lerp(172,196,t)]}
    const e=Math.max(Math.abs(x-ELV.x),Math.abs(z-ELV.z));if(e>420)rgb=rgb.map(q=>q*.55);
    const gr=(hash(px+1900,py)-.5)*9;const o=(py*N+px)*4;D[o]=rgb[0]+gr;D[o+1]=rgb[1]+gr;D[o+2]=rgb[2]+gr;D[o+3]=255}}
  g.putImageData(img,0,0);g.setTransform(k,0,0,k,-X0*k,-Z0*k);g.lineCap='round';g.lineJoin='round';
  /* forest canopy: soft dark blobs */{const R=mulberry(77);for(let i=0;i<2600;i++){const x=X0+20+R()*(ESZ-40),z=Z0+20+R()*(ESZ-40);if(Math.hypot(x-WS.x,z-WS.z)<WS.R+16||elvLake(x,z)||elvPathDist(x,z)<6)continue;const dn=fbm((x-ELV.x)*.01+3,(z-ELV.z)*.01+8);if(R()>dn*1.5-.2)continue;g.fillStyle='rgba(20,52,24,.28)';g.beginPath();g.arc(x,z,2.6+R()*1.6,0,7);g.fill()}}
  for(const[w,cl]of[[6,'rgba(40,30,20,.8)'],[4.2,'#c4ac82']]){g.strokeStyle=cl;g.lineWidth=w;for(const p of ELV_ROADS){g.beginPath();p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()}}
  for(const f of ELV_FALLS){g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(f.x,f.z,2.4,0,7);g.fill()}
  /* WindStorm: streets, walls, buildings */
  g.fillStyle='#b8ae9c';g.beginPath();g.arc(WS.x,WS.z,WS.R,0,7);g.fill();
  for(const[w,cl]of[[6,'#8a8070'],[4.6,'#d4cab4']]){g.strokeStyle=cl;g.lineWidth=w;for(const p of WS_STREETS){g.beginPath();p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke()}}
  g.fillStyle='#d8ceb8';g.beginPath();g.arc(WS.x,WS.z,WS.plaza,0,7);g.fill();g.fillStyle='#6ab0d8';g.beginPath();g.arc(WS.x,WS.z,4.5,0,7);g.fill();
  const ROOF={red:'#b8432f',blue:'#3f6fb8',yellow:'#d9a43a',green:'#4f9a4a'};
  for(const b of WS_B){const cl=Object.keys(ROOF).find(q=>b.m.endsWith(q));g.save();g.translate(b.x,b.z);g.rotate(-b.ry);g.fillStyle='rgba(30,25,15,.35)';g.fillRect(-b.w/2+.8,-b.d/2+.8,b.w*.86,b.d*.86);g.fillStyle=/castle|tower/.test(b.m)?'#9a9890':cl?ROOF[cl]:'#a0603a';g.fillRect(-b.w*.43,-b.d*.43,b.w*.86,b.d*.86);g.strokeStyle='rgba(40,25,15,.7)';g.lineWidth=.4;g.strokeRect(-b.w*.43,-b.d*.43,b.w*.86,b.d*.86);g.restore()}
  g.strokeStyle='#6e6a62';g.lineWidth=4;g.beginPath();g.arc(WS.x,WS.z,WS.R,0,7);g.stroke();g.lineWidth=2.4;g.beginPath();g.arc(WS_CIT.x,WS_CIT.z,WS_CIT.r,0,7);g.stroke();
  for(const t of[...WS_WALL.tow,...WS_WALL.gate]){g.fillStyle='#3f6fb8';g.beginPath();g.arc(t.x,t.z,3,0,7);g.fill()}
  for(const d of[-22,0,22]){g.fillStyle='#8a6a4a';g.fillRect(WS.x+d-3,WS.z+WS.R+20,6,20)}
  /* the gate back and the waystone */g.fillStyle='#1a1210';g.beginPath();g.arc(ELV_EXIT.x,ELV_EXIT.z,4,0,7);g.fill();g.strokeStyle='#ff7a30';g.lineWidth=.8;g.stroke();
  const wsn=WAYSTONES.find(w=>w.id==='ws');g.fillStyle='#7ad8ff';g.beginPath();g.arc(wsn.x,wsn.z,2.4,0,7);g.fill();
  g.setTransform(1,0,0,1,0,0);const vg=g.createRadialGradient(N/2,N/2,N*.4,N/2,N/2,N*.75);vg.addColorStop(0,'rgba(10,20,10,0)');vg.addColorStop(1,'rgba(10,20,10,.45)');g.fillStyle=vg;g.fillRect(0,0,N,N);
  EATLAS.c=c}
/* which picture the map shows where you are: Velmora, the Dragon Realm or a dungeon (world rectangle in metres) */
function mapSource(){const x=ME.pos.x;
  if(x>1250){const D=x>1700?D3:D2;return{key:D.name,img:D.img,x0:D.X-D.C/2*D.c,z0:D.Z-D.R/2*D.c,w:D.C*D.c,h:D.R*D.c,title:D.name,dun:1}}
  if(x>700)return{key:'crypt',img:dunImg,x0:DUN.x-DC/2*DUN.c,z0:DUN.z-DR/2*DUN.c,w:DC*DUN.c,h:DR*DUN.c,title:'Crypt of Kaal-Morath',dun:1};
  if(inElv(x))return{key:'elv',img:elvAtlasBuild(),x0:ELV.x-ESZ/2,z0:ELV.z-ESZ/2,w:ESZ,h:ESZ,title:'The Woods of Elvia'};
  if(inDrk(x))return{key:'drk',img:drkAtlasBuild(),x0:DRK.x-DSZ/2,z0:DRK.z-DSZ/2,w:DSZ,h:DSZ,title:'The Dragon Realm'};
  atlasBuild();return{key:'vel',img:ATLAS.c,x0:-320,z0:-320,w:640,h:640,title:'Map of Velmora'}}
/* labels: region names (always), places (from a little zoom), buildings (zoomed in) */
const MAP_LABELS={vel:[[0,'Twilight Wood',-30,-150],[0,'Ashen Hills',205,-215],[0,'Bandit Heath',165,-140],[0,'Bone Hills',-170,-250],[0,'Mirror Lake',-150,128],[0,'Golden Fields',10,178],[0,'Silverdale',175,65],[0,'Silverbrook',0,-86],
    [1,"Artisans' Yard",-108,-28],[1,'Arena',126,-24],[1,'Bandit Camp',150,-132],[1,'Crypt of Kaal-Morath',-172,-236],[1,"Ignaroth's Fire Cave",206,-196],[1,'Dragon Pass ➜',228,88],[1,'Farm',46,96],[1,'Mill',-34,108],
    [2,'The Keep',30,-58],[2,'Church of the Light',40,14],[2,'Silver Tankard',-34,-30],[2,'Market Street',-40,15],[2,'Barracks',50,-18],[2,'Mill Pond',-38,46],[2,'Town Square',0,-27],[2,'Stables',58,40]],
  elv:[[0,'WindStorm',WS.x,WS.z-WS.R-14],[0,'Elvian Highlands',ELV.x+40,ELV.z-300],[0,'Silverfall Lake',ELV.x-100,ELV.z-100],[0,'Moonmere',ELV.x+250,ELV.z-108],[0,'Lake Elvia',ELV.x+70,ELV.z+262],[0,'Fernwater',ELV.x-300,ELV.z+250],[0,'Whispering Glade',ELV.x-330,ELV.z-60],[0,'Thornwood',ELV.x+330,ELV.z+120],
    [1,'⬅ To the Dragon Realm',ELV_EXIT.x+40,ELV_EXIT.z-12],[1,'Silverfalls',ELV.x-104,ELV.z-178],[1,'Moonfall',ELV.x+256,ELV.z-178],[1,'Harbour',WS.x,WS.z+WS.R+44],[1,'Citadel',WS_CIT.x,WS_CIT.z-WS_CIT.r-6],[1,'Outlaw Camp',ELV_CAMP.x,ELV_CAMP.z-20],[1,'Oakheart\'s Grove',ELV.x-210,ELV.z-336],
    [2,'Royal Castle',WS_CIT.x,WS_CIT.z+4],[2,'Cathedral',WS.x-55,WS.z-74],[2,'Grand Plaza',WS.x,WS.z-30],[2,'Market',WS.x-36,WS.z-36],[2,'The Gilded Gryphon',WS.x-50,WS.z+76],[2,'Barracks',WS.x+86,WS.z-38],[2,'Waystone',WS.x+15,WS.z+24]],
  drk:[[1,'⬅ To Silverdale',-170,-10],[1,'Volcano door',-50,-12],[0,"Dragonhunters' Camp",-138,48],[0,'Mount Dragonrest',0,-24],[0,'Dragon Nests',10,150],[0,'Shrines',122,-62],[0,'Fire Fields',0,-150],[0,'Ash Plains',-95,-110]]};
function mapFit(){const S=MAPST.src;return Math.min(MAPST.w/S.w,MAPST.h/S.h)}
function mapResize(){const c=$('#bigmap');const r=c.getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);const w=Math.max(200,Math.round(r.width)),h=Math.max(200,Math.round(r.height));
  if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}MAPST.dpr=dpr;MAPST.w=w;MAPST.h=h}
function mapOpen(){mapResize();const S=mapSource();if(!MAPST.src||MAPST.src.key!==S.key||!MAPST.zoom){MAPST.src=S;MAPST.zoom=clamp(isTouch?2.2:2.6,mapFit(),14);MAPST.follow=true}MAPST.src=S;if(MAPST.follow){MAPST.cx=ME.pos.x;MAPST.cz=ME.pos.z}
  $('#mapTitle').textContent=S.title;updMapBtns();drawBigMap()}
function updMapBtns(){const f=$('#mapFollow');if(f)f.classList.toggle('on',MAPST.follow)}
function mapClampView(){const S=MAPST.src,z=MAPST.zoom;const hw=MAPST.w/2/z,hh=MAPST.h/2/z;
  MAPST.cx=S.w<=hw*2?S.x0+S.w/2:clamp(MAPST.cx,S.x0+hw,S.x0+S.w-hw);MAPST.cz=S.h<=hh*2?S.z0+S.h/2:clamp(MAPST.cz,S.z0+hh,S.z0+S.h-hh)}
function mapZoomAt(f,sx,sy){const z0=MAPST.zoom,z1=clamp(z0*f,mapFit(),14);if(z1===z0)return;const wx=MAPST.cx+(sx-MAPST.w/2)/z0,wz=MAPST.cz+(sy-MAPST.h/2)/z0;MAPST.zoom=z1;
  if(!MAPST.follow){MAPST.cx=wx-(sx-MAPST.w/2)/z1;MAPST.cz=wz-(sy-MAPST.h/2)/z1}drawBigMap()}
/* the live drawing: called when the map opens and every frame while it is open */
function drawBigMap(){const pm=$('#pMap');if(!pm||pm.hidden)return;const c=$('#bigmap'),g=c.getContext('2d');if(!MAPST.src||MAPST.src.key!==mapSource().key){MAPST.src=null;mapOpen();return}
  const S=MAPST.src,z=MAPST.zoom,dpr=MAPST.dpr,W=MAPST.w,H=MAPST.h;if(MAPST.follow){MAPST.cx=ME.pos.x;MAPST.cz=ME.pos.z}mapClampView();
  const tf=(x,zz)=>[(x-MAPST.cx)*z+W/2,(zz-MAPST.cz)*z+H/2];
  g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle=S.dun?'#0e0b10':'#cbb68a';g.fillRect(0,0,W,H);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';{const[a,b]=tf(S.x0,S.z0);g.drawImage(S.img,a,b,S.w*z,S.h*z)}
  const vis=(a,b,m=20)=>a>-m&&b>-m&&a<W+m&&b<H+m;
  const label=(t,x,zz,size,col='#3a2510',halo='rgba(250,240,215,.85)',style='')=>{const[a,b]=tf(x,zz);if(!vis(a,b,120))return;g.font=style+' '+size+'px Cinzel,serif';g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';g.strokeStyle=halo;g.lineWidth=Math.max(3,size*.28);g.strokeText(t,a,b);g.fillStyle=col;g.fillText(t,a,b)};
  /* place names */
  const LB=MAP_LABELS[S.key]||[];const ox=S.key==='drk'?DRK.x:0,oz=S.key==='drk'?DRK.z:0;for(const[lv,t,x0,z0]of LB){const x=x0+ox,zz=z0+oz;if(lv===1&&z<1.3)continue;if(lv===2&&z<3.2)continue;const size=lv===0?clamp(13+z*2.4,15,28):lv===1?13:12;label(lv===0?t.toUpperCase():t,x,zz,size,lv===0?'#3a2510':'#4a2e14',undefined,lv===0?'700':lv===1?'600':'600')}
  /* quest areas */
  if(P&&S.key!=='crypt'){g.setLineDash([6,5]);for(const q of QUESTS){const st=P.quests[q.id];if(!st||st.n>=q.obj.n)continue;let pts=[];
      if(q.obj.kill)pts=MONS.filter(m=>q.obj.kill.includes(m.type)&&(mapSource().key==='vel'?m.x<700&&m.x>-1000:true)).map(m=>[m.x,m.z]);
      else if(q.obj.gather)pts=NODES.filter(n=>n.item===q.obj.gather).map(n=>[n.x,n.z]);else if(q.obj.fish)pts=[[LAKE.x,LAKE.z]];
      pts=pts.filter(([x,zz])=>x>=S.x0&&x<=S.x0+S.w&&zz>=S.z0&&zz<=S.z0+S.h);if(!pts.length)continue;
      const mx=pts.reduce((s,p)=>s+p[0],0)/pts.length,mz=pts.reduce((s,p)=>s+p[1],0)/pts.length;let rr=q.obj.fish?LAKE.r:Math.min(70,Math.max(12,Math.max(...pts.map(p=>Math.hypot(p[0]-mx,p[1]-mz)))*.85));
      const[a,b]=tf(mx,mz);g.fillStyle='rgba(255,200,40,.13)';g.strokeStyle='rgba(255,190,30,.95)';g.lineWidth=2;g.beginPath();g.arc(a,b,rr*z,0,7);g.fill();g.stroke();
      g.setLineDash([]);label(q.n,mx,mz-rr*.0,12,'#5a3a00','rgba(255,240,190,.92)','700 italic');g.setLineDash([6,5])}g.setLineDash([])}
  /* gather nodes when zoomed in */
  if(z>3.5&&S.key!=='crypt')for(const n of NODES){if(n.down)continue;const[a,b]=tf(n.x,n.z);if(!vis(a,b))continue;g.fillStyle=n.type==='kruid'?'#d8f060':n.type==='erts'?'#c8c8d8':'#b8844a';g.strokeStyle='#2a2010';g.lineWidth=1;g.beginPath();g.arc(a,b,3,0,7);g.fill();g.stroke()}
  /* monsters around you */
  if(z>1.6)for(const m of MONS){if(m.dead||Math.abs(m.x-ME.pos.x)>140||Math.abs(m.z-ME.pos.z)>140)continue;const[a,b]=tf(m.x,m.z);if(!vis(a,b))continue;g.fillStyle=m.t.boss?'#c040ff':'#d23a2a';g.strokeStyle='rgba(40,10,10,.8)';g.lineWidth=1;g.beginPath();g.arc(a,b,m.t.boss?5:m.t.elite?3.6:2.6,0,7);g.fill();g.stroke()}
  /* people: NPCs (quest marks), other players, group members */
  for(const n of NPCOBJ){const[a,b]=tf(n.x,n.z);if(!vis(a,b))continue;if(n.mark==='!'||n.mark==='?'){g.font='900 20px Cinzel,serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=4;g.strokeStyle='#2a1a00';g.strokeText(n.mark,a,b);g.fillStyle='#ffd100';g.fillText(n.mark,a,b)}
    else{g.fillStyle='#ffd34d';g.strokeStyle='#3a2a00';g.lineWidth=1.2;g.beginPath();g.arc(a,b,3.6,0,7);g.fill();g.stroke()}
    if(z>4.5)label(n.n,n.x,n.z+11/z,11,'#4a2e14')}
  for(const r of REMOTES.values()){const[a,b]=tf(r.x,r.z);if(!vis(a,b))continue;const grp=GROUP&&GROUP.members.includes(r.id);g.fillStyle=grp?'#40e090':pvpHostile(r)?'#ff4040':'#4aa0ff';g.strokeStyle='#fff';g.lineWidth=1.6;g.beginPath();g.arc(a,b,grp?5.5:4.5,0,7);g.fill();g.stroke();if(grp||z>3)label(r.n||'',r.x,r.z-12/z,11,grp?'#0a5a30':'#123a6a')}
  /* you: pulsing ring and an arrow pointing where you face */
  {MAPST.t+=.016;const[a,b]=tf(ME.pos.x,ME.pos.z);const pr=(MAPST.t*1.2)%1;g.strokeStyle='rgba(255,255,255,'+(1-pr)*.8+')';g.lineWidth=2;g.beginPath();g.arc(a,b,8+pr*16,0,7);g.stroke();
    g.save();g.translate(a,b);g.rotate(-ME.ry+Math.PI);g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=4;g.fillStyle='#e8402a';g.strokeStyle='#ffffff';g.lineWidth=2.6;g.beginPath();g.moveTo(0,-15);g.lineTo(10,11);g.lineTo(0,5.5);g.lineTo(-10,11);g.closePath();g.fill();g.stroke();g.restore()}
  /* compass rose and scale bar */
  {const x=W-34,y=34;g.save();g.translate(x,y);g.fillStyle='rgba(250,240,215,.85)';g.beginPath();g.arc(0,0,22,0,7);g.fill();g.strokeStyle='#6a4a22';g.lineWidth=1.4;g.stroke();
    for(let i=0;i<4;i++){g.rotate(Math.PI/2);g.fillStyle=i===3?'#b0301c':'#4a2e14';g.beginPath();g.moveTo(0,-18);g.lineTo(4,0);g.lineTo(-4,0);g.closePath();g.fill()}
    g.restore();g.font='700 11px Cinzel,serif';g.textAlign='center';g.fillStyle='#b0301c';g.fillText('N',x,y-27+2)}
  {const nice=[5,10,20,25,50,100,200];let m=nice.find(v=>v*z>=70)||200;const L=m*z,x=14,y=H-16;g.fillStyle='rgba(250,240,215,.85)';g.fillRect(x-6,y-16,L+44,24);g.fillStyle='#3a2510';g.fillRect(x,y-3,L,4);g.fillStyle='#f4e8cc';g.fillRect(x+L/2,y-2,L/2-1,2);
    g.font='600 11px Cinzel,serif';g.textAlign='left';g.textBaseline='alphabetic';g.fillStyle='#3a2510';g.fillText(m+' m',x+L+6,y+2)}}
/* map controls: wheel and pinch zoom, drag to pan, buttons */
{const c=$('#bigmap');
  c.addEventListener('wheel',ev=>{ev.preventDefault();const r=c.getBoundingClientRect();mapZoomAt(Math.exp(-Math.sign(ev.deltaY)*.18),ev.clientX-r.left,ev.clientY-r.top)},{passive:false});
  const P2=new Map();c.addEventListener('pointerdown',ev=>{c.setPointerCapture(ev.pointerId);P2.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});if(P2.size===2){const[a,b]=[...P2.values()];MAPST.pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}}else MAPST.drag={x:ev.clientX,y:ev.clientY,moved:0}});
  c.addEventListener('pointermove',ev=>{if(!P2.has(ev.pointerId))return;const prev=P2.get(ev.pointerId);P2.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
    if(P2.size===2&&MAPST.pinch){const[a,b]=[...P2.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);const r=c.getBoundingClientRect();if(MAPST.pinch.d>0)mapZoomAt(d/MAPST.pinch.d,(a.x+b.x)/2-r.left,(a.y+b.y)/2-r.top);MAPST.pinch.d=d;return}
    if(MAPST.drag){const dx=ev.clientX-prev.x,dy=ev.clientY-prev.y;MAPST.drag.moved+=Math.abs(dx)+Math.abs(dy);if(MAPST.drag.moved>6){if(MAPST.follow){MAPST.follow=false;updMapBtns()}MAPST.cx-=dx/MAPST.zoom;MAPST.cz-=dy/MAPST.zoom;drawBigMap()}}});
  const up=ev=>{P2.delete(ev.pointerId);if(P2.size<2)MAPST.pinch=null;if(!P2.size)MAPST.drag=null};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
  c.addEventListener('dblclick',ev=>{const r=c.getBoundingClientRect();mapZoomAt(1.8,ev.clientX-r.left,ev.clientY-r.top)});
  $('#mapIn').addEventListener('click',()=>mapZoomAt(1.4,MAPST.w/2,MAPST.h/2));$('#mapOut').addEventListener('click',()=>mapZoomAt(1/1.4,MAPST.w/2,MAPST.h/2));
  $('#mapFollow').addEventListener('click',()=>{MAPST.follow=!MAPST.follow;updMapBtns();drawBigMap()});
  $('#mapAll').addEventListener('click',()=>{MAPST.follow=false;MAPST.zoom=mapFit();updMapBtns();drawBigMap()});
  addEventListener('resize',()=>{if(!$('#pMap').hidden){mapResize();drawBigMap()}})}
setInterval(()=>{if(DATLAS.c||!ME||!inDrk(ME.pos.x))return;if(!DATLAS.gen)DATLAS.gen=drkAtlasGen();const t=performance.now();while(performance.now()-t<12)if(DATLAS.gen.next().done)break},250);
/* paint the atlas in a quiet moment after loading, so opening the map is instant */
setTimeout(()=>{if(!ATLAS.gen)ATLAS.gen=atlasGen();const step=dl=>{if(ATLAS.c)return;try{let n=0;do{if(ATLAS.gen.next().done)return}while(dl&&dl.timeRemaining&&dl.timeRemaining()>8&&++n<6)}catch(e){console.warn('map',e);return}
  if(window.requestIdleCallback)requestIdleCallback(step,{timeout:500});else setTimeout(step,30)};step()},5000);
