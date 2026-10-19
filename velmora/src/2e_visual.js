/* ===================== Visuele opknapbeurt: alles met gedownloade CC0-modellen (Quaternius) =====================
   - Bergketens rond Velmora en het Drakenrijk (RTS-pack bergen) in plaats van de kale grijze terreinwand
   - Wolken (Platformer-pack wolken) in plaats van de bollen-wolken
   - Crypte: stenen muren, tegelvloer, wandfakkels, zuilen, kisten, botten en spinnenwebben (Modular Dungeon-packs)
   - Vuurgrot en Hart van de Vulkaan: grotwanden van rotsmodellen
   - Crypte-ingang als mausoleum met boog, zuilen en schedels
   - Roverskamp met palissade, tenten, kampvuur en boomstammen (Survival / RTS-pack)
   - Graanvelden met tarwemodellen (Crops / Nature-pack), arena met stenen kantelen, poorten en zuilen (Medieval-pack)
   Elk procedureel onderdeel dat vervangen wordt heeft userData.proc (zie PROC in 2_world.js) en wordt pas verborgen
   als het model echt geladen is, zodat er nooit gaten vallen. */
function hideProc(key){const fl=new Set(flames);scene.traverse(o=>{if(o.userData&&o.userData.proc===key&&!fl.has(o))o.visible=false});for(const r of VEG_IM)if(r.proc===key)r.im.visible=false}
/* veel kopieën van één model als InstancedMesh (één draw call); items: [{x,y,z,ry,sx,sy,sz}] */
async function instModel(name,items,{cast=true,tint=null,layer=null}={}){if(!items.length)return null;const g=await loadEnv(name);if(!g)return null;const geo=envMerged(g);
  if(tint){const c=geo.attributes.color.array;for(let i=0;i<c.length;i+=3){c[i]*=tint.r;c[i+1]*=tint.g;c[i+2]*=tint.b}}
  const im=new THREE.InstancedMesh(geo,ENV_MAT,items.length);items.forEach((t,i)=>{_p.set(t.x,t.y,t.z);_e.set(t.rx||0,t.ry||0,0);_q.setFromEuler(_e);_s.set(t.sx||t.s||1,t.sy||t.s||1,t.sz||t.s||1);_m.compose(_p,_q,_s);im.setMatrixAt(i,_m)});
  im.castShadow=cast;im.receiveShadow=true;im.computeBoundingSphere();scene.add(im);return im}
const tintObj=(o,c)=>{if(o)o.traverse(x=>{if(x.isMesh){x.material=x.material.clone();x.material.color.multiply(c)}});return o};
const noShadow=o=>{if(o)o.traverse(x=>{if(x.isMesh)x.castShadow=false});return o};
async function buildVisualEnv(){if(window.__NOGLTF)return;const R=mulberry(5151);const jobs=[];
  const place=(n,x,z,ry,s,y=0,par=scene)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],par,y);
  /* ---------- bergketens ---------- */
  const MT=['Mountain_Group_1','Mountain_Group_2','MountainLarge_Single','Mountain_Single'],MS={Mountain_Group_1:30,Mountain_Group_2:34,MountainLarge_Single:44,Mountain_Single:42};
  const MFP={Mountain_Group_1:2.45,Mountain_Group_2:1.87,MountainLarge_Single:.56,Mountain_Single:.96};/* halve breedte van elk model */
  const ring=(cx,cz,e0,e1,step,skip,tint,sc=1)=>{for(let row=0;row<2;row++){const e=row?e1:e0;for(let side=0;side<4;side++)for(let t=-e;t<e;t+=step*(row?1.3:1)){const tt=t+R()*step*.5;const lx=side===0?e:side===1?-e:tt,lz=side===2?e:side===3?-e:tt;
      let x=cx+lx+(R()-.5)*12,z=cz+lz+(R()-.5)*12;const n=MT[Math.floor(R()*MT.length)];const s=MS[n]*(.75+R()*.6)*(row?1.35:1)*sc;
      /* de pas vrijhouden: een berg die over de doorgang zou vallen schuift opzij, zodat hij de pas flankeert */if(skip){const r=MFP[n]*s,q=skip(x,z,r);if(q===false)continue;if(q){x=q[0];z=q[1]}}
      /* voet van de berg op de laagste grond eromheen, zodat de rand nergens zweeft */let gy=1e9;for(const rr of[.8,1.6,2.3])for(let a=0;a<6.28;a+=.7)gy=Math.min(gy,groundH(x+Math.cos(a)*s*rr,z+Math.sin(a)*s*rr));
      jobs.push(envPlace(n,x,z,R()*6.28,()=>[s,s,s],scene,gy-groundH(x,z)-6).then(o=>{noShadow(o);if(tint)tintObj(o,tint)}))}}};
  ring(0,0,272,308,46,(x,z,r)=>x-r<DRK_GATE.x+26&&Math.abs(z-DRK_GATE.z)<r+18?[x,DRK_GATE.z+Math.sign(z-DRK_GATE.z||1)*(r+18)]:null);/* opening voor de Drakenpas */
  ring(DRK.x,DRK.z,192,222,46,(x,z,r)=>x+r>DRK_ENTRY.x-26&&Math.abs(z-DRK_ENTRY.z)<r+18?[x,DRK_ENTRY.z+Math.sign(z-DRK_ENTRY.z||1)*(r+18)]:null,new THREE.Color(.42,.36,.33),.5);
  /* ---------- wolken ---------- */
  {const CL=['CL_Cloud_1','CL_Cloud_2','CL_Cloud_3'];const src=await Promise.all(CL.map(loadEnv));if(src.every(Boolean)){
    const cm=new THREE.MeshToonMaterial({color:0xffffff,fog:false,emissive:0x8899aa,emissiveIntensity:.35,gradientMap:RAMP});
    clouds.children.forEach((g,i)=>{for(const m of[...g.children])g.remove(m);const o=envClone(src[i%src.length]);const s=7+R()*6;o.scale.set(s*1.3,s*.75,s);o.rotation.y=R()*6.28;o.traverse(x=>{if(x.isMesh){x.material=cm;x.castShadow=false;x.receiveShadow=false}});g.add(o)})}}
  /* ---------- crypte (kerker) ---------- */
  jobs.push((async()=>{const walls=[],tops=[],floors=[];const c=DUN.c,s=c/2.04;
    for(let r=0;r<DR;r++)for(let k=0;k<DC;k++){const[x,z]=dunPos(k,r);
      floors.push({x,y:-.74,z,s:3,ry:((r+k)%2)*Math.PI/2});if(DMAP[r][k]==='#')continue;
      for(const[dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]]){const nc=k+dx,nr=r+dz;if(nr<0||nr>=DR||nc<0||nc>=DC||DMAP[nr][nc]!=='#')continue;const wx=x+dx*c/2,wz=z+dz*c/2,ry=dx>0?Math.PI:dx<0?0:dz>0?Math.PI/2:-Math.PI/2;
        walls.push({x:wx,y:0,z:wz,ry,s});tops.push({x:wx,y:2.04*s,z:wz,ry,s})}}
    const ok=await Promise.all([instModel('MD_ModularStoneWall',walls),instModel('MD_ModularStoneWall_top',tops),instModel('D_Floor_Modular',floors,{cast:false})]);if(!ok.every(Boolean))return;
    hideProc('crypt');/* de oude vloer blijft als donkere voeg onder de stenen tegels */const cf=window.__cryptFloor;if(cf){cf.material=cf.material.clone();cf.material.map=null;cf.material.color.setHex(0x16130f);cf.position.y=-.8}
    /* wandfakkels op dezelfde plekken als de oude houders */let tor=0;const P=[];
    for(let r=0;r<DR;r++)for(let k=0;k<DC;k++){const ch=DMAP[r][k];const[x,z]=dunPos(k,r);
      if(ch!=='#'&&DMAP[r][k-1]==='#'&&(r+k)%3===0&&tor<40){tor++;P.push(place('MD_Torch_wall',x-c/2+.4,z,0,1.3,2.6))}
      if(ch!=='#'&&DMAP[r][k+1]==='#'&&(r+k)%3===1&&tor<40){tor++;P.push(place('MD_Torch_wall',x+c/2-.4,z,Math.PI,1.3,2.6))}}
    /* zuilen, kisten, botten en spinnenwebben */
    for(let i=0;i<70;i++){const k=1+Math.floor(R()*(DC-2)),r=1+Math.floor(R()*(DR-2));if(DMAP[r][k]!=='.')continue;const[x,z]=dunPos(k,r);const v=R();
      if(v<.35)P.push(place('D_Bones',x+R()*4-2,z+R()*4-2,R()*6,1.6).then(o=>tintObj(o,new THREE.Color(.8,.74,.62))));
      else if(v<.5)P.push(place(R()<.5?'D_Chest':'Barrel',x+R()*3-1.5,z+R()*3-1.5,R()*6,1.3));
      else if(v<.62)P.push(place('MD_Column_Broken'+(R()<.5?'':'2'),x+R()*3-1.5,z+R()*3-1.5,R()*6,1.2))}
    for(let r=1;r<DR-1;r++)for(let k=1;k<DC-1;k++){if(DMAP[r][k]==='#'||R()>.22)continue;const[x,z]=dunPos(k,r);for(const[dx,dz]of[[1,0],[-1,0]])if(DMAP[r][k+dx]==='#'&&DMAP[r-1][k]==='#'){P.push(place(R()<.5?'D_Cobweb':'D_Cobweb2',x+dx*(c/2-.6),z-c/2+.6,dx>0?Math.PI/2:0,2.2,6.5));break}}
    /* troonzaal: zuilen, wapenrekken en een schat */
    {const[bx,bz]=dunPos(10,2);for(const sx of[-1,1])for(const dz of[0,8,16]){P.push(place('MD_Column',bx+sx*9,bz+dz,0,1.6));}P.push(place('D_Pedestal',bx,bz-3,0,2.6));P.push(place('D_Chest_Gold',bx-4,bz-3,Math.PI,1.4));P.push(place('D_Chest_Gold',bx+4,bz-3,Math.PI,1.4));
      for(const sx of[-1,1])P.push(place('D_Sword_WallMount',bx+sx*5,bz-5.6,0,2,3.5))}
    await Promise.all(P)})());
  /* ---------- grotwanden van rotsmodellen: Vuurgrot en Hart van de Vulkaan ---------- */
  const caveWalls=async(D,tint)=>{const L=[];for(let r=0;r<D.R;r++)for(let k=0;k<D.C;k++){if(D.map[r][k]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D.R&&cc>=0&&cc<D.C&&D.map[rr][cc]!=='#')nb=true}if(!nb)continue;
      const[x,z]=D.pos(k,r);for(let i=0;i<2;i++)L.push([x+(R()-.5)*3,z+(R()-.5)*3,2.6+R()*1.6,R()*6.28])}
    const ok=await envInstances(['Rock_1','Rock_2','Rock_3','Rock_4','Rock_5','Rock_6','Rock_7'],L,(t,i)=>i,(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=D.c*1.25*t[2]/2.6/w;return[k,k*(1.6+t[2]*.3),k]},true,tint);
    if(ok&&D.wim)D.wim.visible=false;
    /* vloer van tegelmodellen */const F=[];for(let r=0;r<D.R;r++)for(let k=0;k<D.C;k++){const ch=D.map[r][k];if(ch==='~')continue;const[x,z]=D.pos(k,r);F.push({x,y:-.74,z,s:3,ry:((r+k)%2)*Math.PI/2})}
    const fl=await instModel('D_Floor_Modular',F,{cast:false,tint:new THREE.Color(tint.r*1.9,tint.g*1.7,tint.b*1.6)});if(fl&&D.grp&&D.grp.children[0]){const f0=D.grp.children[0];f0.material=f0.material.clone();f0.material.map=null;f0.material.color.setHex(0x140c08);f0.position.y-=.75}};
  jobs.push(caveWalls(D2,new THREE.Color(.55,.38,.3)));jobs.push(caveWalls(D3,new THREE.Color(.45,.32,.28)));
  /* ---------- crypte-ingang: mausoleum ---------- */
  jobs.push((async()=>{const x0=CRYPT.x,z0=CRYPT.z,y=CRYPT_H;const P=[];
    P.push(place('D_Arch',x0,z0-1.4,0,2.3));P.push(place('MD_ModularStoneWall',x0,z0-4.2,-Math.PI/2,2.6));P.push(place('MD_ModularStoneWall_top',x0,z0-4.2,-Math.PI/2,2.6,5.3));
    for(const sx of[-1,1]){for(const k of[1,2])P.push(place('MD_ModularStoneWall',x0+sx*(2.4+k*4.1),z0-1.6,-Math.PI/2,2.05));for(const k of[1,2])P.push(place('MD_ModularStoneWall_top',x0+sx*(2.4+k*4.1),z0-1.6,-Math.PI/2,2.05,4.18));
      P.push(place('MD_Column',x0+sx*4.8,z0+1.2,0,1.75));P.push(place('D_Skull',x0+sx*4.8,z0+1.2,0,1.3,8.7).then(o=>tintObj(o,new THREE.Color(.8,.74,.62))))}
    for(const sx of[-1,1])P.push(place('S_WoodenTorch_Fire',x0+sx*5.6,z0+2,0,.8));
    const r=await Promise.all(P);if(r[0])hideProc('cryptgate')})());
  /* ---------- kerkhof bij de crypte: grafstenen, hekwerk, obelisken (Kenney Graveyard Kit) ---------- */
  if(window.__graves)jobs.push(envInstances(['K_gravestone-round','K_gravestone-cross','K_gravestone-bevel','K_gravestone-broken','K_gravestone-wide','K_gravestone-decorative','K_gravestone-cross-large'],window.__graves,(t,i)=>i,(t,bb)=>{const k=1.5*t[2]/(bb.max.y-bb.min.y);return[k,k,k]},true,new THREE.Color(0xc8bfb0)).then(ok=>{if(ok)hideProc('graves')}));
  jobs.push((async()=>{const P=[];for(let x=-20;x<=20;x+=2.2){if(Math.abs(x)<3.5)continue;P.push(place(Math.abs(x)>16&&x>0?'K_iron-fence-damaged':'K_iron-fence',CRYPT.x+x,CRYPT.z+30,0,[2.3,1.8,2]))}
    for(const sx of[-1,1]){P.push(place('K_pillar-obelisk',CRYPT.x+sx*4.2,CRYPT.z+30,0,2.2));P.push(place('K_lantern-candle',CRYPT.x+sx*4.2,CRYPT.z+29,0,1.6,0))}
    for(let i=0;i<6;i++){const a=R()*6.28,r=14+R()*18;P.push(place(R()<.5?'K_cross-column':'K_grave',CRYPT.x+Math.cos(a)*r,CRYPT.z+12+Math.sin(a)*r*.8,R()*.6-.3,1.6))}
    const r=await Promise.all(P);if(r.filter(Boolean).length>10)hideProc('cryptfence')})());
  /* ---------- arenakist: gouden kist met scharnierend deksel ---------- */
  jobs.push((async()=>{const g=await loadEnv('D_Chest_Gold');if(!g)return;const o=envClone(g);const sz=o.userData.size;const s=1.65/Math.max(sz[0],sz[2]);o.scale.setScalar(s);arenaChest.g.add(o);
    const top=o.getObjectByName('Chest_Top');for(const c of arenaChest.g.children)if(c!==o&&c!==arenaChest.glow&&!(c.geometry&&c.geometry.type==='RingGeometry'))c.visible=false;
    if(top){const bx=top.rotation.x;arenaChest.lid={rotation:{set x(v){top.rotation.x=bx+v},get x(){return top.rotation.x-bx}}}}})());
  /* ---------- roverskamp ---------- */
  jobs.push((async()=>{const cx=CAMP.x,cz=CAMP.z;const P=[];const gap=Math.atan2(32,-60);
    for(let a=0;a<Math.PI*2;a+=.21){if(Math.abs(angDiff(a,gap))<.4)continue;const x=cx+Math.cos(a)*25,z=cz+Math.sin(a)*25;const tower=Math.round(a/.21)%6===0;P.push(place(tower?'WallTowers_FirstAge':'Wall_FirstAge',x,z,-a-Math.PI/2,tower?[2.9,6.5,4]:[3.9,6.2,4]))}
    for(const s of[-1,1]){const a=gap+s*.44;P.push(place('WallTowers_Door_FirstAge',cx+Math.cos(a)*25,cz+Math.sin(a)*25,-a-Math.PI/2,[2.9,6.5,4]))}
    for(const[x,z,rot]of[[-8,-8,.6],[9,-6,-.8],[-6,10,2.4],[11,9,-2.2],[0,-14,0]])P.push(place('S_Tent',cx+x,cz+z,rot,.27).then(o=>tintObj(o,new THREE.Color(.95,.8,.65))));
    P.push(place('D_Woodfire',cx,cz,0,2.2));for(let i=0;i<4;i++){const a=i*1.57+.4;P.push(place('S_WoodLog',cx+Math.cos(a)*4.2,cz+Math.sin(a)*4.2,a,.5))}
    P.push(place('D_Banner',cx+4,cz+3,0,2.4));for(const s of[-1,1]){const a=gap+s*.62;P.push(place('S_WoodenTorch_Fire',cx+Math.cos(a)*27,cz+Math.sin(a)*27,0,1.2))}
    const r=await Promise.all(P);if(r.filter(Boolean).length>20)hideProc('camp')})());
  /* ---------- graanvelden ---------- */
  if(window.__wheat)jobs.push(envInstances(['N_Wheat','C_Wheat_4'],window.__wheat,(t,i)=>i%5===0?1:0,(t,bb)=>{const k=1.25*t[2]/(bb.max.y-bb.min.y);return[k*1.4,k,k*1.4]},false).then(ok=>{if(ok)hideProc('wheat')}));
  /* ---------- arena ---------- */
  /* arena: a downloaded low-poly colosseum (CreativeTrio, CC0, via Poly Pizza), sunk so its pit floor is at ground level,
     with two gate tunnels cut through the stands along x and lined with dungeon stone (Quaternius Modular Dungeon) */
  jobs.push((async()=>{const ax=ARENA.x,az=ARENA.z,y=ARENA_H,S=ARENA_S;const SAND=new THREE.Color(1.08,.98,.84),STONE=new THREE.Color(1.75,1.55,1.3);
    const col=await place('A_Colosseum',ax,az,0,S,-.2*S);if(!col)return;tintObj(col,SAND);
    const P=[];const L=ARENA_RX*.72,GW=ARENA_GW;
    for(const s of[-1,1]){const xm=ax+s*(ARENA_RX*.98+L/2);
      for(const sz of[-1,1])P.push(place('MM_Wall',xm,az+sz*(GW+.3),0,[L/1.54,4.6/1.55,1.6],0).then(o=>tintObj(o,SAND)));
      P.push(place('D_Floor_Modular',xm,az,0,[L/2,1.6,(GW*2+1.4)/2],4.5).then(o=>tintObj(o,new THREE.Color(.95,.88,.78))));
      for(const xe of[ARENA_RX*.98,ARENA_RX*.98+L])P.push(place('MM_TallWallEntrance',ax+s*xe,az,Math.PI/2,[(GW*2+1.6)/1.52,7.4/2.35,1.4/.42]).then(o=>tintObj(o,SAND)));
      for(const dz of[-GW-1.6,GW+1.6])P.push(place('D_Banner',ax+s*(ARENA_RX*.98+L+.9),az+dz,s>0?Math.PI/2:-Math.PI/2,2.6))}
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2+Math.PI/10;P.push(place('S_WoodenTorch_Fire',ax+Math.cos(a)*ARENA_RX*.97,az+Math.sin(a)*ARENA_RZ*.97,0,.75,.2))}
    await Promise.all(P);hideProc('arena')})());
  await Promise.all(jobs)}
