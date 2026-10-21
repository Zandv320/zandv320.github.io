/* ===================== The Thornroot Hollow: the dungeon of the Woods of Elvia (part 3) =====================
   Under the roots of a dead giant in the far south-east of Thornwood lies the source of Elvia's poison: Veyrith the
   Silkmother, a spider queen older than WindStorm, guarded by the Thornwarden and the Blighted Seers (elves who drank
   the poison). Level 23–25, for a group.
   Everything you see is built from the downloaded model packs (Quaternius, KayKit, Kenney; CC0): mossy rock walls, tiled
   floors, ruined columns, dead trees as roots, cobwebs, bones, crystals, torches. The rock/tile shapes made in code
   (buildDun) are only the fallback while the models load.
   Layout (map below): the entrance tunnels with Lurkers and Seers, the Bramble Guardians' gallery, the Thornwarden's
   hall with its venom pools, and at the top the Silkmother's web chamber. */
const D4MAP=[
'#######################',
'########.......########',
'#####.............#####',
'####...............####',
'####.......B.......####',
'####...............####',
'#####.............#####',
'######s.........s######',
'##########...##########',
'##########.d.##########',
'###~~.s.........s.~~###',
'###~...d...W...d...~###',
'###.......~~~.......###',
'###..s....~~~....s..###',
'#######.........#######',
'#########..b..#########',
'####......#.#......####',
'####.s..d.....d..s.####',
'####~~...........~~####',
'#######....b....#######',
'#########.....#########',
'##########...##########',
'##########...##########',
'##########.E.##########',
'#######################'];
const D4=buildDun({x:2300,z:0,c:6,map:D4MAP,floor:0x4a4a32,wall:0x26301e,crystal:0x7aff8a,pool:0x0a2a06,poolLight:0x7aff3a,mapPool:'#5ab82a',mapFloor:'#46523a',portal:0x7aff5a,noCrystal:1,
  spawn:{s:'thornspider',d:'blightseer',b:'brambleguard',W:'thornwarden',B:'silkmother'},name:'Thornroot Hollow'});
const D4_HALL=(()=>{const[x,z]=D4.pos(11,4);return{x,z}})(),D4_WARDEN=(()=>{const[x,z]=D4.pos(11,11);return{x,z}})();
/* ---- the gate in Thornwood: a stone arch under the roots of the dead giant, the portal fills its opening ---- */
const HOLLOW_S=2.4;
const HOLLOW_PORTAL=portalMesh(0x7aff5a,HOLLOW_S,HOLLOW.x,elvH(HOLLOW.x,HOLLOW.z),HOLLOW.z,Math.PI);
{const y=elvH(HOLLOW.x,HOLLOW.z);for(const sd of[-1,1]){addCol(HOLLOW.x+sd*1.58*HOLLOW_S,HOLLOW.z,.46*HOLLOW_S);const cx=HOLLOW.x+sd*(2.05*HOLLOW_S+1.4);addCol(cx,HOLLOW.z,1.1);addFlame(scene,cx,y+6.35,HOLLOW.z,1.6,0x9aff5a);addLight(cx,y+6.8,HOLLOW.z,0x8aff6a,26,16)}
  /* the mound behind the gate: you can't walk round the back of the arch */for(let k=0;k<9;k++){const a=Math.PI*(.08+k/8*.84);addCol(HOLLOW.x+Math.cos(a)*8.5,HOLLOW.z+2+Math.sin(a)*6.5,2.6,false,9)}
  addLight(HOLLOW.x,y+2,HOLLOW.z-1.5,0x7aff5a,18,10)}
/* ---- travel ---- */
function enterHollow(){teleport(D4.entry.x,D4.entry.z);ME.ry=Math.PI;cam.yaw=0;log('Damp air, the smell of rot and silk: you descend into the Thornroot Hollow…','sys');if(P.level<23)log('Beware: the Thornroot Hollow is meant for a group of heroes of level 23 or higher.','err')}
function leaveHollow(){teleport(HOLLOW.x,HOLLOW.z-8);ME.ry=Math.PI;cam.yaw=0}
const inHollow=x=>x>2200;
/* walking through a portal (called from drakePortals) and pressing F (from drakeInteract) */
function hollowPortals(x,z){if(inElv(x)&&Math.hypot(x-HOLLOW.x,z-HOLLOW.z)<2.3){enterHollow();return true}if(inHollow(x)&&Math.hypot(x-D4.exit.x,z-(D4.exit.z+1.4))<2){leaveHollow();return true}return false}
function hollowInteract(x,z){if(inElv(x)&&Math.hypot(x-HOLLOW.x,z-HOLLOW.z)<7){enterHollow();return true}if(inHollow(x)&&Math.hypot(x-D4.exit.x,z-D4.exit.z)<6){leaveHollow();return true}return false}
function hollowRespawn(){if(!inHollow(ME.pos.x))return false;teleport(D4.entry.x,D4.entry.z);ME.ry=Math.PI;cam.yaw=0;return true}
/* ---- per frame: the venom pools burn, spores drift ---- */
function updHollow(dt,t){if(!inHollow(camTarget.x))return;
  for(const l of D4.lava)l.material.color.setRGB(.028+Math.sin(t*1.3+l.position.x)*.008,.1+Math.sin(t*1.9+l.position.z)*.025,.012);
  if(P&&!ME.dead&&!ME.air&&!S.god&&D4.cell(ME.pos.x,ME.pos.z)==='~'){ME.venomT=(ME.venomT||0)-dt;if(ME.venomT<=0){ME.venomT=.5;const d=Math.round(ST.maxhp*.035);P.hp-=d;ME.combat=6;floatText('me','-'+d+' venom','hurt');if(P.hp<=0){P.hp=0;die()}}}else ME.venomT=0;
  if(typeof emitP==='function'){const q=GFX.q==='laag'?.3:1;if(Math.random()<dt*14*q){const x=camTarget.x+rand(-18,18),z=camTarget.z+rand(-18,18);if(D4.cell(x,z)!=='#')emitP({x,y:rand(.3,3),z,vy:rand(.2,.6),vx:rand(-.3,.3),life:rand(2.5,4),size:.09,size1:.03,col:Math.random()<.7?0xb8ff6a:0xe8ffc8,a:.9,a1:0,cell:FXC.glint})}
    for(const l of D4.lava)if(Math.random()<dt*.5*q&&Math.abs(l.position.x-camTarget.x)+Math.abs(l.position.z-camTarget.z)<40)emitP({x:l.position.x+rand(-2.5,2.5),y:.15,z:l.position.z+rand(-2.5,2.5),vy:rand(.4,1),life:rand(.8,1.4),size:.22,size1:.05,col:0x9aff4a,a:.7,a1:0,cell:FXC.soft})}}
/* ---- models (async, while loading) ---- */
async function buildHollow(){if(window.__NOGLTF)return;const R=mulberry(4242);const jobs=[];
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  const MOSS=new THREE.Color(.62,.78,.56),DARK=new THREE.Color(.42,.5,.4);
  const glow=(o,col,ei=1.2)=>{if(o)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.vertexColors=false;m.material.color.setHex(col);m.material.emissive=new THREE.Color(col);m.material.emissiveIntensity=ei;m.castShadow=false}});return o};
  /* -- the gate in Thornwood -- */
  {const X=HOLLOW.x,Z=HOLLOW.z,s=HOLLOW_S;
    jobs.push(put('D_Arch',X,Z,Math.PI,s).then(o=>tintObj(o,MOSS)));
    for(const sd of[-1,1])jobs.push(envPlace('D_Column',X+sd*(2.05*s+1.4),Z,0,()=>[1.2,1.5,1.2]).then(o=>tintObj(o,DARK)));
    /* the gate is cut into a mossy hill; on top of it stands the dead giant whose roots hold the Hollow */
    jobs.push(envPlace('Mountain_Single',X,Z+16,0,sz=>[46/sz[0],17/sz[1],30/sz[2]],scene,-1.2).then(o=>tintObj(o,new THREE.Color(.5,.66,.44))));addCol(X,Z+16,11,false,15);
    jobs.push(envPlace('CommonTree_Dead_4',X+3,Z+15,.7,sz=>[24/sz[1],24/sz[1],24/sz[1]],scene,7).then(o=>tintObj(o,new THREE.Color(.62,.55,.48))));
    for(const sd of[-1,1])jobs.push(put('Rock_Moss_1',X+sd*9.5,Z+2.5,sd*1.3,4.2));
    /* dead trees around the clearing */
    for(const[dx,dz,ry,sc,m]of[[-15,4,1.2,2.4,'CommonTree_Dead_2'],[16,6,2.4,2.6,'CommonTree_Dead_4'],[-20,-10,.3,2.2,'BirchTree_Dead_1'],[22,-8,4,2.1,'CommonTree_Dead_5'],[-11,15,5.1,2.8,'CommonTree_Dead_3'],[13,16,.9,2.6,'BirchTree_Dead_2']]){
      jobs.push(put(m,X+dx,Z+dz,ry,sc));addCol(X+dx,Z+dz,1)}
    /* the mound: mossy boulders over the arch's back */
    for(let k=0;k<9;k++){const a=Math.PI*(.06+k/8*.88),rr=12+R()*3;jobs.push(put(['Rock_Moss_1','Rock_Moss_2','Rock_Moss_3'][k%3],X+Math.cos(a)*rr,Z+6+Math.sin(a)*rr*.7,R()*6.28,2.6+R()*1.8))}
    for(const sd of[-1,1])jobs.push(put('Rock_Moss_2',X+sd*7.8,Z-.6,R()*6,1.8));
    /* webs over the arch, bones and skulls in front of it, green-burning torches along the road */
    for(const sd of[-1,1])jobs.push(put(sd<0?'D_Cobweb':'D_Cobweb2',X+sd*(1.3*s),Z-.5,sd<0?Math.PI:Math.PI/2,2.6,4.1*s));
    jobs.push(put('D_Skull',X+.3,Z+.1,Math.PI,2.4,6.6*s/2.6));
    for(let k=0;k<7;k++)jobs.push(put(k%3?'D_Bones':'D_Skull',X+(R()-.5)*14,Z-4-R()*9,R()*6.28,k%3?.6+R()*.2:.9));
    for(const[dx,dz]of[[-5,-12],[5,-12],[-5,-22],[5,-22]]){const x=X+dx,z=Z+dz;jobs.push(put('D_Torch',x,z,dx<0?Math.PI/2:-Math.PI/2,1.5));addFlame(scene,x,elvH(x,z)+2.1,z,1.1,0x9aff5a);addLight(x,elvH(x,z)+2.4,z,0x8aff6a,16,12);addCol(x,z,.4)}
    for(let k=0;k<4;k++){const a=R()*6.28,d=11+R()*6;jobs.push(put('D_Cobweb2',X+Math.cos(a)*d,Z+Math.sin(a)*d*.6,R()*6.28,2.8+R()))}
    for(let k=0;k<6;k++){const a=R()*6.28,d=9+R()*10;jobs.push(put('Q_Crystal5',X+Math.cos(a)*d,Z-2+Math.sin(a)*d*.7,R()*6.28,.7+R()*.5).then(o=>glow(o,0x8aff7a,.9)))}}
  /* -- inside: rock walls (mossy boulders) and a tiled floor -- */
  {const L=[];for(let r=0;r<D4.R;r++)for(let k=0;k<D4.C;k++){if(D4.map[r][k]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D4.R&&cc>=0&&cc<D4.C&&D4.map[rr][cc]!=='#')nb=true}if(!nb)continue;
      const[x,z]=D4.pos(k,r);/* lean the boulders back into the rock, away from the open cells next to them */let ox=0,oz=0;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D4.R&&cc>=0&&cc<D4.C&&D4.map[rr][cc]!=='#'){ox-=b;oz-=a}}const ol=Math.hypot(ox,oz)||1;
      for(let i=0;i<2;i++){let rx=x+(R()-.5)*1.6+ox/ol*1.4,rz=z+(R()-.5)*1.6+oz/ol*1.4;const sc=2.3+R()*1.3;
        const px=D4.exit.x,pz=D4.exit.z+2.3,dx=rx-px,dz=rz-pz,dd=Math.hypot(dx,dz);if(dd<7.5){const k2=7.5/Math.max(dd,.01);rx=px+dx*k2;rz=pz+(dd<.01?7.5:dz*k2);if(rz<pz+3.4)rz=pz+3.4}
        L.push([rx,rz,sc,R()*6.28])}}
    jobs.push(envInstances(['Rock_Moss_1','Rock_Moss_2','Rock_Moss_3','Rock_3','Rock_5'],L,(t,i)=>i,(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=D4.c*1.25*t[2]/2.6/w;return[k,k*(1.6+t[2]*.3),k]},true,new THREE.Color(.5,.58,.46)).then(ok=>{if(ok&&D4.wim)D4.wim.visible=false}));
    const F=[];for(let r=0;r<D4.R;r++)for(let k=0;k<D4.C;k++){const ch=D4.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D4.pos(k,r);F.push({x,y:-.74,z,s:3,ry:((r+k)%2)*Math.PI/2})}
    jobs.push(instModel('D_Floor_Modular',F,{cast:false,tint:new THREE.Color(.78,.88,.66)}).then(fl=>{if(fl&&D4.grp&&D4.grp.children[0]){const f0=D4.grp.children[0];f0.material=f0.material.clone();f0.material.map=null;f0.material.color.setHex(0x0e140a);f0.position.y-=.75}}))}
  /* -- the way out: a mossy arch against the end wall -- */
  jobs.push(put('D_Arch',D4.exit.x,D4.exit.z+2.3,0,1.75).then(o=>tintObj(o,MOSS)));
  /* -- roots breaking through the walls: dead trees standing against the rock, webs in the corners -- */
  {const roots=['CommonTree_Dead_1','CommonTree_Dead_2','CommonTree_Dead_3','Willow_Dead_3','BirchTree_Dead_2'];let n=0;
    for(let r=1;r<D4.R-1;r++)for(let k=1;k<D4.C-1;k++){const ch=D4.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D4.pos(k,r);
      for(const[dx,dz]of[[1,0],[-1,0]])if(D4.map[r][k+dx]==='#'&&D4.map[r-1][k]==='#'&&R()<.6){jobs.push(put(R()<.5?'D_Cobweb':'D_Cobweb2',x+dx*(D4.c/2-.6),z-D4.c/2+.6,dx>0?Math.PI/2:0,2.4,5.4));break}
      if(n<22&&R()<.16){const dx=D4.map[r][k-1]==='#'?-1:D4.map[r][k+1]==='#'?1:0;if(dx){n++;jobs.push(put(roots[n%roots.length],x+dx*(D4.c/2-.4),z+(R()-.5)*2,R()*6.28,1.5+R()*.8).then(o=>tintObj(o,new THREE.Color(.55,.5,.42))))}}
      if(R()<.1){const b=R()<.7;jobs.push(put(b?'D_Bones':'D_Skull',x+(R()-.5)*4,z+(R()-.5)*4,R()*6.28,b?.6+R()*.2:.9))}}}
  /* -- crystals of poison light and torches with green flames -- */
  {let n=0;for(let r=1;r<D4.R-1;r++)for(let k=1;k<D4.C-1;k++){if(D4.map[r][k]!=='.')continue;const[x,z]=D4.pos(k,r);
      if(((r*5+k*3)%9===0)&&n<26){n++;const cx=x+(R()-.5)*3,cz=z+(R()-.5)*3;jobs.push(put('Q_Crystal5',cx,cz,R()*6.28,.8+R()*.7).then(o=>glow(o,n%3?0x8aff7a:0x6ae8ff,1)));if(n%2===0)addLight(cx,1.4,cz,0x7aff8a,20,12)}
      if(D4.map[r][k-1]==='#'&&(r+k)%4===0){const tx=x-D4.c/2+.6;jobs.push(put('D_Torch',tx,z,Math.PI/2,1.5));addFlame(scene,tx+.15,2.1,z,1.1,0x9aff5a);addLight(tx+.6,2.4,z,0x8aff6a,22,13)}
      if(D4.map[r][k+1]==='#'&&(r+k)%4===2){const tx=x+D4.c/2-.6;jobs.push(put('D_Torch',tx,z,-Math.PI/2,1.5));addFlame(scene,tx-.15,2.1,z,1.1,0x9aff5a);addLight(tx-.6,2.4,z,0x8aff6a,22,13)}}}
  /* -- the Thornwarden's hall: ruined elven columns round the venom pools -- */
  {const{x:wx,z:wz}=D4_WARDEN;for(const sx of[-1,1])for(const dz of[-6,6]){jobs.push(put(dz<0?'MD_Column':'MD_Column_Broken',wx+sx*14,wz+dz,R()*6,1.6).then(o=>tintObj(o,MOSS)));addCol(wx+sx*14,wz+dz,.9)}
    for(const sx of[-1,1]){jobs.push(put('MD_Column_Broken2',wx+sx*7,wz-9,R()*6,1.5).then(o=>tintObj(o,MOSS)));addCol(wx+sx*7,wz-9,.8)}
    for(let k=0;k<5;k++)jobs.push(put('D_Bones',wx+(R()-.5)*20,wz+(R()-.5)*10,R()*6.28,.7))}
  /* -- the Silkmother's chamber: a ring of webbed columns, egg clutches, the hoard of her victims -- */
  {const{x:hx,z:hz}=D4_HALL;for(let k=0;k<10;k++){const a=k/10*6.28;const x=hx+Math.cos(a)*26,z=hz+Math.sin(a)*13;if(D4.cell(x,z)!=='.'||Math.sin(a)>.75)continue;
      jobs.push(put(k%2?'MD_Column_Broken':'MD_Column',x,z,a,1.7).then(o=>tintObj(o,DARK)));addCol(x,z,.9);jobs.push(put('D_Cobweb2',x,z,a+Math.PI/2,3.6,1.5));addFlame(scene,x,4.6,z,1.4,0x9aff5a)}
    for(let k=0;k<14;k++){const a=R()*6.28,d=15+R()*9;const x=hx+Math.cos(a)*d,z=hz+Math.sin(a)*d*.55;if(D4.cell(x,z)!=='.')continue;jobs.push(put('Q_Mineral',x,z,R()*6.28,1.4+R()*1.2).then(o=>{if(o)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.vertexColors=false;m.material.color.setHex(0xdce8c4);m.material.emissive=new THREE.Color(0x9aff6a);m.material.emissiveIntensity=.22}});return o}))}
    for(let k=0;k<3;k++)jobs.push(put('D_Chest_Gold',hx-6+k*6,hz-10,Math.PI,1.5));for(let k=0;k<5;k++)jobs.push(put('D_Coin_Pile',hx-8+k*4,hz-8+(k%2)*1.4,R()*6,2));
    for(let k=0;k<12;k++)jobs.push(put(k%4?'D_Bones':'D_Skull',hx+(R()-.5)*34,hz+(R()-.5)*16,R()*6.28,k%4?.7+R()*.2:1));
    for(const sd of[-1,1])addLight(hx+sd*12,3.5,hz,0x9aff6a,30,22);addLight(hx,4,hz-8,0xc8ff8a,26,18)}
  await Promise.all(jobs)}
