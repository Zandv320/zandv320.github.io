/* ===================== The Sanctum of the Silent Song: the dungeon of the Nether Rift =====================
   Beneath the Throne of the Void lies the hall where the Choir first sang the Song that tore the Rift open. Xal'thuun was
   only its vessel; the Song itself still lives down here, in Nyxathar, the First Voice. Level 46–50, for a group.
   Three bosses: Korvax the Shardbound (a crystal guardian), Seer Ilvaya (the last founder of the Choir) and Nyxathar.
   Everything you see is built from the downloaded packs already in the game (Quaternius, KayKit, Kenney and the Rift
   crystals; CC0). The shapes made by buildDun are only the fallback while the models load.
   Layout: entrance corridor (south), Korvax's crystal cavern, Ilvaya's hall with void pools, Nyxathar's chamber (north). */
const D5MAP=[
'###########################',
'#########.........#########',
'#######.............#######',
'######....~.....~....######',
'#####.................#####',
'#####........B........#####',
'#####.................#####',
'######....~.....~....######',
'#######..h.......h..#######',
'##########.......##########',
'############...############',
'############.d.############',
'############...############',
'########.v.......v.########',
'###.....................###',
'##.~~.................~~.##',
'##.~.........S.........~.##',
'##.~~.................~~.##',
'###...k.............k...###',
'#######.............#######',
'############...############',
'############.v.############',
'############...############',
'#######.c.........c.#######',
'####...................####',
'###....~...........~....###',
'###..........K..........###',
'###....~...........~....###',
'####..c.............c..####',
'#######.............#######',
'###########.....###########',
'############...############',
'###########.....###########',
'############...############',
'############...############',
'############.E.############',
'###########################'];
const D5=buildDun({x:3000,z:0,c:6,map:D5MAP,floor:0x2a2238,wall:0x1c1428,crystal:0xc08aff,pool:0x14061f,poolLight:0xb05aff,mapPool:'#7a3ac8',mapFloor:'#3e3654',portal:0xc08aff,noCrystal:1,
  spawn:{v:['voidchanter',46,47],k:['sanctumknight',47,48],c:['crystalbehemoth',46,47],h:['voidhorror',48,49],d:['dreadlord',48,49],K:'korvax',S:'ilvaya',B:'nyxathar'},name:'Sanctum of the Silent Song'});
const D5_AT=ch=>{for(let r=0;r<D5.R;r++){const k=D5.map[r].indexOf(ch);if(k>=0){const[x,z]=D5.pos(k,r);return{x,z}}}return{x:D5.X,z:D5.Z}};
const D5_KORVAX=D5_AT('K'),D5_ILVAYA=D5_AT('S'),D5_NYX=D5_AT('B');
const inSanctum=x=>x>2800;
/* ---- the gate on the Throne island ---- */
const SANCTUM_S=2.6;
const SANCTUM_PORTAL=portalMesh(0xff6ad8,SANCTUM_S,SANCTUM_GATE.x,riftH(SANCTUM_GATE.x,SANCTUM_GATE.z),SANCTUM_GATE.z,SANCTUM_GATE.ry);
const SANCTUM_SIDE=sd=>{const g=SANCTUM_GATE,px=Math.cos(g.ry),pz=-Math.sin(g.ry);return{x:g.x+px*sd,z:g.z+pz*sd}};
{const g=SANCTUM_GATE,y=riftH(g.x,g.z);for(const sd of[-1,1]){const a=SANCTUM_SIDE(sd*1.58*SANCTUM_S);addCol(a.x,a.z,.46*SANCTUM_S);const c=SANCTUM_SIDE(sd*(2.05*SANCTUM_S+1.4));addCol(c.x,c.z,1.1);addFlame(scene,c.x,y+6.35,c.z,1.6,0xff6ad8);addLight(c.x,y+6.8,c.z,0xff5ac8,26,16)}
  /* you can't walk round the back of the arch */for(const sd of[-4.5,-2,0,2,4.5]){const b=SANCTUM_SIDE(sd);addCol(b.x-Math.sin(g.ry)*2.6,b.z-Math.cos(g.ry)*2.6,1.6)}
  addLight(g.x+Math.sin(g.ry)*1.5,y+2,g.z+Math.cos(g.ry)*1.5,0xff6ad8,18,10)}
/* ---- travel ---- */
function enterSanctum(){teleport(D5.entry.x,D5.entry.z-6);ME.ry=Math.PI;cam.yaw=0;log('The Song is louder here, in the stone itself: you descend into the Sanctum of the Silent Song…','sys');if(P.level<46)log('Beware: the Sanctum is meant for a group of heroes of level 46 or higher.','err')}
function leaveSanctum(){const g=SANCTUM_GATE;teleport(g.x+Math.sin(g.ry)*8,g.z+Math.cos(g.ry)*8);ME.ry=g.ry;cam.yaw=g.ry-Math.PI}
function sanctumPortals(x,z){if(inRift(x)&&Math.hypot(x-SANCTUM_GATE.x,z-SANCTUM_GATE.z)<2.4){enterSanctum();return true}if(inSanctum(x)&&Math.hypot(x-D5.exit.x,z-(D5.exit.z+1.4))<2){leaveSanctum();return true}return false}
function sanctumInteract(x,z){if(inRift(x)&&Math.hypot(x-SANCTUM_GATE.x,z-SANCTUM_GATE.z)<7){enterSanctum();return true}if(inSanctum(x)&&Math.hypot(x-D5.exit.x,z-D5.exit.z)<6){leaveSanctum();return true}return false}
function sanctumRespawn(){if(!inSanctum(ME.pos.x))return false;teleport(D5.entry.x,D5.entry.z-6);ME.ry=Math.PI;cam.yaw=0;return true}
/* ---- per frame: the void pools burn, motes of the Song drift upward ---- */
function updSanctum(dt,t){if(!inSanctum(camTarget.x))return;
  for(const l of D5.lava)l.material.color.setRGB(.07+Math.sin(t*1.2+l.position.x)*.025,.015,.11+Math.sin(t*1.7+l.position.z)*.035);
  if(P&&!ME.dead&&!ME.air&&!S.god&&D5.cell(ME.pos.x,ME.pos.z)==='~'){ME.voidT=(ME.voidT||0)-dt;if(ME.voidT<=0){ME.voidT=.5;const d=Math.round(ST.maxhp*.04);P.hp-=d;ME.combat=6;floatText('me','-'+d+' void','hurt');if(P.hp<=0){P.hp=0;die()}}}else ME.voidT=0;
  if(typeof emitP==='function'){const q=GFX.q==='laag'?.3:1;if(Math.random()<dt*14*q){const x=camTarget.x+rand(-18,18),z=camTarget.z+rand(-18,18);if(D5.cell(x,z)!=='#')emitP({x,y:rand(.3,3),z,vy:rand(.3,.8),vx:rand(-.3,.3),life:rand(2.5,4),size:.1,size1:.03,col:Math.random()<.6?0xc08aff:0xff8ad8,a:.9,a1:0,cell:FXC.glint})}
    for(const l of D5.lava)if(Math.random()<dt*.5*q&&Math.abs(l.position.x-camTarget.x)+Math.abs(l.position.z-camTarget.z)<40)emitP({x:l.position.x+rand(-2.5,2.5),y:.15,z:l.position.z+rand(-2.5,2.5),vy:rand(.5,1.2),life:rand(.8,1.4),size:.24,size1:.05,col:0xb05aff,a:.7,a1:0,cell:FXC.soft})}}
/* ---- the three bosses: their words and what they do on top of the usual boss abilities (4_game.js bossAbilities) ---- */
function bossBurst(m,spots,r,mul,d=2){for(const[x,z]of spots){teleFx(x,z,r,d);netEmit('fx',{k:'tele',x,z,r,d});PENDING.push({t:d,fn:()=>{for(const p of players())if(!p.dead&&Math.hypot(p.x-x,p.z-z)<r)hitPlayer(p.id,monDmg(m.t,m.lvl)*mul,m)}})}}
const SANCTUM_BOSS={
  korvax:{nm:'Korvax the Shardbound',col:'#a8c8ff',all:1,
    L:{hi:'The Song made me from the bones of the world. You will not pass.',tele:'The crystal remembers your weight!',sum:'Shards, wake and cut!',enr:'I WILL SHATTER, AND TAKE YOU WITH ME!',add:'shardling',alv:46,bolt:'frost'},
    /* Shatter: a ring of crystal bursts around him, every 16 seconds */
    extra(m,B,dt){B.x1=(B.x1??12)-dt;if(B.x1<=0){B.x1=16;const o=rand(0,6.28),sp=[];for(let i=0;i<7;i++){const a=o+i/7*6.28;sp.push([m.x+Math.cos(a)*10,m.z+Math.sin(a)*10])}bossBurst(m,sp,3.6,1.6);bossSay('Shatter!','korvax')}}},
  ilvaya:{nm:'Seer Ilvaya',col:'#ff8ad8',all:1,
    L:{hi:'You silenced my sister Morvane. I will sing you into nothing.',tele:'Hear the Song beneath your feet!',sum:'Choir, rise once more!',enr:'The Song does not end. It only waits.',add:'voidchanter',alv:46,bolt:'arcane'},
    /* Riftstep: she vanishes and reappears elsewhere in her hall; where she stood, the void bursts open */
    extra(m,B,dt){B.x1=(B.x1??10)-dt;if(B.x1<=0){B.x1=13;bossBurst(m,[[m.x,m.z]],5.5,1.7);burst(m.x,1.4,m.z,0xff6ad8,28,4);
      for(let i=0;i<20;i++){const a=rand(0,6.28),d=rand(6,15),x=m.sx+Math.cos(a)*d,z=m.sz+Math.sin(a)*d*.6;if(D5.cell(x,z)==='.'||D5.cell(x,z)==='S'){m.x=x;m.z=z;break}}burst(m.x,1.4,m.z,0xc08aff,28,4)}}},
  nyxathar:{nm:'Nyxathar',col:'#c08aff',all:0,
    L:{hi:'At last, an audience. Listen. This is the Song that broke your sky.',tele:'Kneel before the First Voice!',sum:'My dreams have teeth. Feed them!',enr:'THE RIFT IS MY THROAT, AND I WILL SWALLOW VELMORA!',add:'voidhorror',alv:47,bolt:'shadow'},
    /* The Silent Song: the void erupts all over the chamber and under every hero, every 17 seconds */
    extra(m,B,dt,alive){B.x1=(B.x1??8)-dt;if(B.x1<=0){B.x1=17;const sp=alive.map(p=>[p.x,p.z]);for(let i=0;i<7;i++){const a=rand(0,6.28),d=rand(6,18);sp.push([m.x+Math.cos(a)*d,m.z+Math.sin(a)*d*.7])}bossBurst(m,sp,4.5,2.2,2.2);
      netEmit('bossmsg',{t:'The Song falls silent… run!',b:'nyxathar'});bossSay('The Song falls silent… run!','nyxathar')}}}};
/* ---- models (async, while loading) ---- */
async function buildSanctum(){if(window.__NOGLTF)return;const R=mulberry(5151);const jobs=[];
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  const STONE=new THREE.Color(.5,.44,.66),DARK=new THREE.Color(.34,.3,.44);
  const glow=(o,col,ei=1.2)=>{if(o)o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.vertexColors=false;m.material.color.setHex(col);m.material.emissive=new THREE.Color(col);m.material.emissiveIntensity=ei;m.castShadow=false}});return o};
  const crystals=['../rift/Crystal_1','../rift/Crystal_3','../rift/Crystal_6','../rift/Crystal_7'];
  /* -- the gate on the Throne island: an arch of dark stone between two columns -- */
  {const g=SANCTUM_GATE;jobs.push(put('D_Arch',g.x,g.z,g.ry,SANCTUM_S).then(o=>tintObj(o,STONE)));
    for(const sd of[-1,1]){const c=SANCTUM_SIDE(sd*(2.05*SANCTUM_S+1.4));jobs.push(envPlace('D_Column',c.x,c.z,0,()=>[1.2,1.5,1.2]).then(o=>recolorObj(o,0xff6ad8)))}
    const C=[];for(const sd of[-4.6,-2.4,2.4,4.6]){const b=SANCTUM_SIDE(sd);C.push({x:b.x-Math.sin(g.ry)*2.4,z:b.z-Math.cos(g.ry)*2.4,ry:R()*6.28,s:.18+R()*.12})}
    jobs.push(riftInst('../rift/Crystal_1',C,{col:0xff8ad8,glow:0xff2a8a,gi:.8}))}
  /* -- inside: dark rock walls and a tiled floor -- */
  {const L=[];for(let r=0;r<D5.R;r++)for(let k=0;k<D5.C;k++){if(D5.map[r][k]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D5.R&&cc>=0&&cc<D5.C&&D5.map[rr][cc]!=='#')nb=true}if(!nb)continue;
      const[x,z]=D5.pos(k,r);let ox=0,oz=0;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D5.R&&cc>=0&&cc<D5.C&&D5.map[rr][cc]!=='#'){ox-=b;oz-=a}}const ol=Math.hypot(ox,oz)||1;
      for(let i=0;i<2;i++){let rx=x+(R()-.5)*1.6+ox/ol*1.4,rz=z+(R()-.5)*1.6+oz/ol*1.4;const sc=2.3+R()*1.3;
        const px=D5.exit.x,pz=D5.exit.z+2.3,dx=rx-px,dz=rz-pz,dd=Math.hypot(dx,dz);if(dd<7.5){const k2=7.5/Math.max(dd,.01);rx=px+dx*k2;rz=pz+(dd<.01?7.5:dz*k2);if(rz<pz+3.4)rz=pz+3.4}
        L.push([rx,rz,sc,R()*6.28])}}
    jobs.push(envInstances(['Rock_3','Rock_5','Rock_6','Rock_7'],L,(t,i)=>i,(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=D5.c*1.25*t[2]/2.6/w;return[k,k*(1.6+t[2]*.3),k]},true,new THREE.Color(.36,.3,.48)).then(ok=>{if(ok&&D5.wim)D5.wim.visible=false}));
    const F=[];for(let r=0;r<D5.R;r++)for(let k=0;k<D5.C;k++){const ch=D5.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D5.pos(k,r);F.push({x,y:-.74,z,s:3,ry:((r+k)%2)*Math.PI/2})}
    jobs.push(instModel('D_Floor_Modular',F,{cast:false,tint:new THREE.Color(.62,.56,.82)}).then(fl=>{if(fl&&D5.grp&&D5.grp.children[0]){const f0=D5.grp.children[0];f0.material=f0.material.clone();f0.material.map=null;f0.material.color.setHex(0x0c0814);f0.position.y-=.75}}))}
  /* -- the way out -- */
  jobs.push(put('D_Arch',D5.exit.x,D5.exit.z+2.3,0,1.75).then(o=>tintObj(o,STONE)));
  /* -- void crystals growing from the walls, violet-burning torches, bones of the Choir's victims -- */
  {const CR=[];let n=0;for(let r=1;r<D5.R-1;r++)for(let k=1;k<D5.C-1;k++){const ch=D5.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D5.pos(k,r);
      for(const dx of[-1,1])if(D5.map[r][k+dx]==='#'&&R()<.32){CR.push({x:x+dx*(D5.c/2-.2),z:z+(R()-.5)*3,y:0,ry:R()*6.28,s:.12+R()*.1,rz:dx*(.2+R()*.3)})}
      if(D5.map[r][k-1]==='#'&&(r+k)%4===0){const tx=x-D5.c/2+.6;jobs.push(put('D_Torch',tx,z,Math.PI/2,1.5));addFlame(scene,tx+.15,2.1,z,1.1,0xc07aff);addLight(tx+.6,2.4,z,0xb06aff,22,13)}
      if(D5.map[r][k+1]==='#'&&(r+k)%4===2){const tx=x+D5.c/2-.6;jobs.push(put('D_Torch',tx,z,-Math.PI/2,1.5));addFlame(scene,tx-.15,2.1,z,1.1,0xc07aff);addLight(tx-.6,2.4,z,0xb06aff,22,13)}
      if(ch==='.'&&R()<.08){const b=R()<.7;jobs.push(put(b?'D_Bones':'D_Skull',x+(R()-.5)*4,z+(R()-.5)*4,R()*6.28,b?.6+R()*.2:.9))}
      if(ch==='.'&&((r*5+k*3)%13===0)&&n<12){n++;addLight(x,1.6,z,0xc08aff,18,12)}}
    const by=crystals.map(()=>[]);CR.forEach((t,i)=>by[i%crystals.length].push(t));crystals.forEach((c,i)=>jobs.push(riftInst(c,by[i],{col:0xc8a8ff,glow:0x8a4aff,gi:.9,cast:false})))}
  /* -- Korvax's cavern: great crystal clusters and broken columns -- */
  {const{x:kx,z:kz}=D5_KORVAX;const C=[];for(let k=0;k<12;k++){const a=k/12*6.28+.2,x=kx+Math.cos(a)*24,z=kz+Math.sin(a)*13;if(D5.cell(x,z)!=='.')continue;C.push({x,z,y:0,ry:R()*6.28,s:.3+R()*.16});addCol(x,z,1.4)}
    jobs.push(riftInst('../rift/Crystal_6',C.filter((t,i)=>i%2),{col:0xa8d0ff,glow:0x5a9aff,gi:.9}));jobs.push(riftInst('../rift/Crystal_7',C.filter((t,i)=>!(i%2)),{col:0xc8b0ff,glow:0x8a5aff,gi:.9}));
    for(const sd of[-1,1]){addLight(kx+sd*14,3.5,kz,0x8ab8ff,30,22)}addLight(kx,4,kz-6,0xc8d8ff,26,18)}
  /* -- Ilvaya's hall: a double row of columns, the Choir's lecterns -- */
  {const{x:sx,z:sz}=D5_ILVAYA;for(const sd of[-1,1])for(const dx of[8,20]){const x=sx+sd*dx,z=sz-7;jobs.push(put(dx===20?'MD_Column_Broken':'MD_Column',x,z,R()*6,1.7).then(o=>tintObj(o,DARK)));addCol(x,z,.9);addFlame(scene,x,4.6,z,1.3,0xff7ad8);
      const z2=sz+7;jobs.push(put('MD_Column',x,z2,R()*6,1.7).then(o=>tintObj(o,DARK)));addCol(x,z2,.9)}
    for(const sd of[-1,1]){jobs.push(put('D_Pedestal',sx+sd*4,sz-3,0,[.6,.55,.6]).then(o=>tintObj(o,STONE)));jobs.push(riftInst('../rift/Crystal_8',[{x:sx+sd*4,z:sz-3,y:1.25,ry:R()*6,s:.16}],{col:0xffb0e8,glow:0xff4ab0,gi:1}))}
    for(const sd of[-1,1])addLight(sx+sd*16,3.5,sz,0xff6ad8,30,22);addLight(sx,4,sz,0xd8a8ff,26,18)}
  /* -- Nyxathar's chamber: a ring of obelisks round a well of void light, the Choir's hoard -- */
  {const{x:hx,z:hz}=D5_NYX;for(let k=0;k<10;k++){const a=k/10*6.28;const x=hx+Math.cos(a)*20,z=hz+Math.sin(a)*14;if(D5.cell(x,z)!=='.'||Math.sin(a)>.8)continue;
      jobs.push(put('K_pillar-obelisk',x,z,-a,3.6).then(o=>tintObj(o,new THREE.Color(.4,.3,.55))));addCol(x,z,1);addLight(x,3.5,z,0xff3aa0,16,12)}
    jobs.push(riftInst('../rift/Crystal_9',[{x:hx,z:hz-21,y:0,ry:0,s:.45}],{col:0xd8b0ff,glow:0xa05aff,gi:1.1}));
    for(let k=0;k<3;k++)jobs.push(put('D_Chest_Gold',hx-6+k*6,hz-14,Math.PI,1.5));for(let k=0;k<5;k++)jobs.push(put('D_Coin_Pile',hx-8+k*4,hz-12+(k%2)*1.4,R()*6,2));
    for(const sd of[-1,1])addLight(hx+sd*12,3.5,hz,0xc06aff,30,22);addLight(hx,4,hz-8,0xff8ad8,26,18)}
  await Promise.all(jobs)}
