/* ===================== The Void Citadel: the raid of the Nether Rift =====================
   Beyond the Throne of the Void hangs the Citadel, the fortress from which the Riftlord Vorthax rules what is left of the
   Rift after the Song fell silent. A raid: four bosses, made for a large group (5 to 10 heroes of level 50); their health
   grows with every hero who joins the fight. Built, like the Sanctum, from the model packs already in the game.
   Layout (from the gate, north): the courtyard of Grakkus the Gatebreaker, the hall of Sareth and her Hollow Choir, a
   bridge over the void, the pit of Ghorzul the Devourer, and the Riftlord's arena with the void at its edges.
   Vorthax sometimes leaves behind a Riftwing egg: the flying mount of the Citadel (4t_cragle.js). */
const D6MAP=[
'###############################',
'#########.............#########',
'######..~.............~..######',
'####.~~.................~~.####',
'###.~.....................~.###',
'##.~.......................~.##',
'##.............V.............##',
'##.~.......................~.##',
'###.~.....................~.###',
'####.~~.................~~.####',
'######..~.............~..######',
'#########..f.......f..#########',
'#############.....#############',
'##############.f.##############',
'##############...##############',
'###########.o.....o.###########',
'#######.................#######',
'#####...~~...........~~...#####',
'####...........G...........####',
'#####...~~...........~~...#####',
'#######...o.........o...#######',
'###########.........###########',
'##############...##############',
'############~.....~############',
'############~.w...~############',
'############~.....~############',
'##############...##############',
'########.w...........w.########',
'####.......................####',
'###...~.................~...###',
'###............S............###',
'###...~.................~...###',
'####...f...............f...####',
'########...............########',
'##############...##############',
'##############.w.##############',
'##############...##############',
'#########.f.........f.#########',
'#####.....................#####',
'####...........K...........####',
'#####.....................#####',
'########...w.......w...########',
'#############.....#############',
'##############...##############',
'##############...##############',
'##############.E.##############',
'###############################'];
const D6=buildDun({x:3600,z:0,c:7,map:D6MAP,floor:0x262c40,wall:0x161a2a,crystal:0x8ad8ff,pool:0x060c1c,poolLight:0x5ab8ff,mapPool:'#3a7ac8',mapFloor:'#384058',portal:0x7ad8ff,noCrystal:1,
  spawn:{w:['citadelwarden',50,50],f:['dreadlord',50,50],o:['voidhorror',50,50],K:'grakkus',S:'sareth',G:'ghorzul',V:'vorthax'},name:'The Void Citadel'});
const D6_AT=ch=>{for(let r=0;r<D6.R;r++){const k=D6.map[r].indexOf(ch);if(k>=0){const[x,z]=D6.pos(k,r);return{x,z}}}return{x:D6.X,z:D6.Z}};
const D6_GRAK=D6_AT('K'),D6_SARETH=D6_AT('S'),D6_GHOR=D6_AT('G'),D6_VORTH=D6_AT('V');
const inCitadel=x=>x>3300;
/* ---- the gate on the Throne island ---- */
const CITADEL_S=3.1;
const CITADEL_PORTAL=portalMesh(0x7ad8ff,CITADEL_S,CITADEL_GATE.x,riftH(CITADEL_GATE.x,CITADEL_GATE.z),CITADEL_GATE.z,CITADEL_GATE.ry);
const CITADEL_SIDE=sd=>{const g=CITADEL_GATE,px=Math.cos(g.ry),pz=-Math.sin(g.ry);return{x:g.x+px*sd,z:g.z+pz*sd}};
{const g=CITADEL_GATE,y=riftH(g.x,g.z);for(const sd of[-1,1]){const a=CITADEL_SIDE(sd*1.58*CITADEL_S);addCol(a.x,a.z,.46*CITADEL_S);const c=CITADEL_SIDE(sd*(2.05*CITADEL_S+1.6));addCol(c.x,c.z,1.2);addFlame(scene,c.x,y+7.4,c.z,1.8,0x7ad8ff);addLight(c.x,y+7.8,c.z,0x6ac8ff,28,18)}
  for(const sd of[-5.5,-2.5,0,2.5,5.5]){const b=CITADEL_SIDE(sd);addCol(b.x-Math.sin(g.ry)*3,b.z-Math.cos(g.ry)*3,1.8)}
  addLight(g.x+Math.sin(g.ry)*1.5,y+2,g.z+Math.cos(g.ry)*1.5,0x7ad8ff,20,12)}
/* ---- travel ---- */
function enterCitadel(){teleport(D6.entry.x,D6.entry.z-6);ME.ry=Math.PI;cam.yaw=0;log('Cold blue light and silence: you enter the Void Citadel…','sys');if(P.level<50)log('Beware: the Void Citadel is a raid for a large group of heroes of level 50.','err');else if(!GROUP)log('The Void Citadel is a raid: gather a group of five to ten heroes before you face its masters.','err')}
function leaveCitadel(){const g=CITADEL_GATE;teleport(g.x+Math.sin(g.ry)*9,g.z+Math.cos(g.ry)*9);ME.ry=g.ry;cam.yaw=g.ry-Math.PI}
function citadelPortals(x,z){if(inRift(x)&&Math.hypot(x-CITADEL_GATE.x,z-CITADEL_GATE.z)<2.8){enterCitadel();return true}if(inCitadel(x)&&Math.hypot(x-D6.exit.x,z-(D6.exit.z+1.4))<2){leaveCitadel();return true}return false}
function citadelInteract(x,z){if(inRift(x)&&Math.hypot(x-CITADEL_GATE.x,z-CITADEL_GATE.z)<8){enterCitadel();return true}if(inCitadel(x)&&Math.hypot(x-D6.exit.x,z-D6.exit.z)<6){leaveCitadel();return true}return false}
function citadelRespawn(){if(!inCitadel(ME.pos.x))return false;teleport(D6.entry.x,D6.entry.z-6);ME.ry=Math.PI;cam.yaw=0;return true}
/* ---- per frame: the void at the edges burns cold, motes drift ---- */
function updCitadel(dt,t){if(!inCitadel(camTarget.x))return;
  for(const l of D6.lava)l.material.color.setRGB(.01,.04+Math.sin(t*1.1+l.position.x)*.015,.1+Math.sin(t*1.6+l.position.z)*.035);
  if(P&&!ME.dead&&!ME.air&&!S.god&&D6.cell(ME.pos.x,ME.pos.z)==='~'){ME.voidT=(ME.voidT||0)-dt;if(ME.voidT<=0){ME.voidT=.5;const d=Math.round(ST.maxhp*.06);P.hp-=d;ME.combat=6;floatText('me','-'+d+' void','hurt');if(P.hp<=0){P.hp=0;die()}}}else ME.voidT=0;
  if(typeof emitP==='function'){const q=GFX.q==='laag'?.3:1;if(Math.random()<dt*16*q){const x=camTarget.x+rand(-20,20),z=camTarget.z+rand(-20,20);if(D6.cell(x,z)!=='#')emitP({x,y:rand(.3,4),z,vy:rand(.3,.8),vx:rand(-.3,.3),life:rand(2.5,4),size:.1,size1:.03,col:Math.random()<.6?0x8ad8ff:0xc0a8ff,a:.9,a1:0,cell:FXC.glint})}
    for(const l of D6.lava)if(Math.random()<dt*.5*q&&Math.abs(l.position.x-camTarget.x)+Math.abs(l.position.z-camTarget.z)<44)emitP({x:l.position.x+rand(-3,3),y:.15,z:l.position.z+rand(-3,3),vy:rand(.5,1.2),life:rand(.8,1.4),size:.26,size1:.05,col:0x5ab8ff,a:.7,a1:0,cell:FXC.soft})}}
/* ---- the four masters of the Citadel (on top of the usual boss abilities; the table is shared with the Sanctum) ---- */
const _ringSpots=(x,z,r,n,o=rand(0,6.28))=>{const L=[];for(let i=0;i<n;i++){const a=o+i/n*6.28;L.push([x+Math.cos(a)*r,z+Math.sin(a)*r])}return L};
Object.assign(SANCTUM_BOSS,{
  grakkus:{raid:1,nm:'Grakkus the Gatebreaker',col:'#8ab8ff',all:1,
    L:{hi:'No one passes the gate of the Citadel. NO ONE!',tele:'The stones will break you!',sum:'Wardens, to the gate!',enr:'I AM THE GATE! I DO NOT FALL!',add:'citadelwarden',alv:50,bolt:'frost'},
    /* Earthshatter: two rings of shockwaves roll out from him, every 15 seconds; stand between them */
    extra(m,B,dt){B.x1=(B.x1??10)-dt;if(B.x1<=0){B.x1=15;bossBurst(m,_ringSpots(m.x,m.z,7,9),3.2,1.9);bossBurst(m,_ringSpots(m.x,m.z,15,15),3.2,1.9,3.2);netEmit('bossmsg',{t:'Earthshatter!',b:'grakkus'});bossSay('Earthshatter!','grakkus')}}},
  sareth:{raid:1,nm:'Sareth of the Hollow Choir',col:'#c0a8ff',all:1,
    L:{hi:'The Choir sang for Nyxathar. Now we sing for the Riftlord. Sing with us… forever.',tele:'Hush now.',sum:'Choir, rise and sing!',enr:'LET THE LAST NOTE TAKE THEM ALL!',add:'voidchanter',alv:50,bolt:'arcane'},
    /* Wail of the Choir: the void opens under every hero at once, every 12 seconds, and twice as fast when she is nearly dead */
    extra(m,B,dt,alive){B.x1=(B.x1??7)-dt;if(B.x1<=0){B.x1=m.hp/m.mhp<.3?6:12;bossBurst(m,alive.map(p=>[p.x,p.z]),4,1.8,1.8);netEmit('bossmsg',{t:'Hear the Wail of the Choir!',b:'sareth'});bossSay('Hear the Wail of the Choir!','sareth')}}},
  ghorzul:{raid:1,nm:'Ghorzul the Devourer',col:'#d88aff',all:0,
    L:{hi:'Food! So much food!',tele:'Ghorzul is HUNGRY!',sum:'Little Ghorzuls, eat!',enr:'EAT! EAT! EAT EVERYTHING!',add:'voidooze',alv:50,bolt:'venom'},
    /* Spew: void bile rains on the whole pit, every 13 seconds; and when no one stands close to him, he devours a voidling and heals */
    extra(m,B,dt,alive){B.x1=(B.x1??8)-dt;if(B.x1<=0){B.x1=13;const sp=[];for(let i=0;i<10;i++){const a=rand(0,6.28),d=rand(5,22);sp.push([m.x+Math.cos(a)*d,m.z+Math.sin(a)*d*.8])}for(const p of alive)sp.push([p.x,p.z]);bossBurst(m,sp,4.2,1.7,2.2);netEmit('bossmsg',{t:'Ghorzul spews void bile!',b:'ghorzul'});bossSay('Ghorzul spews void bile!','ghorzul')}
      B.x2=(B.x2??6)-dt;if(B.x2<=0){B.x2=6;if(!alive.some(p=>Math.hypot(p.x-m.x,p.z-m.z)<8)){m.hp=Math.min(m.mhp,m.hp+m.mhp*.03);burst(m.x,2,m.z,0xd88aff,24,4);netEmit('bossmsg',{t:'Ghorzul devours and grows stronger! Stay close to him!',b:'ghorzul'});bossSay('Ghorzul devours and grows stronger! Stay close to him!','ghorzul')}}}},
  vorthax:{raid:1,nm:'Vorthax the Riftlord',col:'#7ad8ff',all:0,
    L:{hi:'So. The little heroes who silenced the Song. I never needed it. The Rift is mine.',tele:'Burn in the cold of the Void!',sum:'Horrors, come to your lord!',enr:'IF I FALL, THE CITADEL FALLS WITH ME!',add:'voidhorror',alv:50,bolt:'shadow'},
    /* Riftstorm: from half health, the sky of the arena tears open every 10 seconds; the void at the edges is always deadly */
    extra(m,B,dt,alive){if(m.hp/m.mhp>.5)return;B.x1=(B.x1??3)-dt;if(B.x1<=0){B.x1=10;const sp=alive.map(p=>[p.x,p.z]);for(let i=0;i<12;i++){const a=rand(0,6.28),d=rand(4,30);sp.push([D6_VORTH.x+Math.cos(a)*d,D6_VORTH.z+Math.sin(a)*d*.75])}bossBurst(m,sp,4.6,2.3,2.4);
      if(!B.storm){B.storm=1;netEmit('bossmsg',{t:'The sky of the Citadel tears open: Riftstorm!',b:'vorthax'});bossSay('The sky of the Citadel tears open: Riftstorm!','vorthax')}}}}});
/* ---- models (async, while loading) ---- */
async function buildCitadel(){if(window.__NOGLTF)return;const R=mulberry(6161);const jobs=[];
  const put=(n,x,z,ry,s,y=0)=>envPlace(n,x,z,ry,()=>Array.isArray(s)?s:[s,s,s],scene,y);
  const STONE=new THREE.Color(.52,.58,.74),DARK=new THREE.Color(.32,.36,.48);
  /* -- the gate: a tall arch between two columns, blue-burning -- */
  {const g=CITADEL_GATE;jobs.push(put('D_Arch',g.x,g.z,g.ry,CITADEL_S).then(o=>tintObj(o,STONE)));
    for(const sd of[-1,1]){const c=CITADEL_SIDE(sd*(2.05*CITADEL_S+1.6));jobs.push(envPlace('D_Column',c.x,c.z,0,()=>[1.4,1.8,1.4]).then(o=>recolorObj(o,0x7ad8ff)))}
    const C=[];for(const sd of[-5.6,-3,3,5.6]){const b=CITADEL_SIDE(sd);C.push({x:b.x-Math.sin(g.ry)*2.8,z:b.z-Math.cos(g.ry)*2.8,ry:R()*6.28,s:.2+R()*.12})}
    jobs.push(riftInst('../rift/Crystal_3',C,{col:0x9ad8ff,glow:0x3a9aff,gi:.9}))}
  /* -- inside: dark rock walls and a tiled floor -- */
  {const L=[];for(let r=0;r<D6.R;r++)for(let k=0;k<D6.C;k++){if(D6.map[r][k]!=='#')continue;let nb=false;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D6.R&&cc>=0&&cc<D6.C&&D6.map[rr][cc]!=='#')nb=true}if(!nb)continue;
      const[x,z]=D6.pos(k,r);let ox=0,oz=0;for(const[a,b]of[[0,1],[1,0],[0,-1],[-1,0]]){const rr=r+a,cc=k+b;if(rr>=0&&rr<D6.R&&cc>=0&&cc<D6.C&&D6.map[rr][cc]!=='#'){ox-=b;oz-=a}}const ol=Math.hypot(ox,oz)||1;
      for(let i=0;i<2;i++){let rx=x+(R()-.5)*1.8+ox/ol*1.6,rz=z+(R()-.5)*1.8+oz/ol*1.6;const sc=2.4+R()*1.3;
        const px=D6.exit.x,pz=D6.exit.z+2.3,dx=rx-px,dz=rz-pz,dd=Math.hypot(dx,dz);if(dd<8.5){const k2=8.5/Math.max(dd,.01);rx=px+dx*k2;rz=pz+(dd<.01?8.5:dz*k2);if(rz<pz+3.6)rz=pz+3.6}
        L.push([rx,rz,sc,R()*6.28])}}
    jobs.push(envInstances(['Rock_3','Rock_5','Rock_6','Rock_7'],L,(t,i)=>i,(t,bb)=>{const w=Math.max(bb.max.x-bb.min.x,bb.max.z-bb.min.z);const k=D6.c*1.25*t[2]/2.6/w;return[k,k*(1.7+t[2]*.3),k]},true,new THREE.Color(.3,.34,.46)).then(ok=>{if(ok&&D6.wim)D6.wim.visible=false}));
    const F=[];for(let r=0;r<D6.R;r++)for(let k=0;k<D6.C;k++){const ch=D6.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D6.pos(k,r);F.push({x,y:-.74,z,s:3.5,ry:((r+k)%2)*Math.PI/2})}
    jobs.push(instModel('D_Floor_Modular',F,{cast:false,tint:new THREE.Color(.56,.64,.84)}).then(fl=>{if(fl&&D6.grp&&D6.grp.children[0]){const f0=D6.grp.children[0];f0.material=f0.material.clone();f0.material.map=null;f0.material.color.setHex(0x080c16);f0.position.y-=.75}}))}
  jobs.push(put('D_Arch',D6.exit.x,D6.exit.z+2.3,0,1.75).then(o=>tintObj(o,STONE)));
  /* -- blue-burning torches, ice-blue crystals along the walls, broken columns -- */
  {const CR=[];for(let r=1;r<D6.R-1;r++)for(let k=1;k<D6.C-1;k++){const ch=D6.map[r][k];if(ch==='#'||ch==='~')continue;const[x,z]=D6.pos(k,r);
      for(const dx of[-1,1])if(D6.map[r][k+dx]==='#'&&R()<.3)CR.push({x:x+dx*(D6.c/2-.2),z:z+(R()-.5)*3,y:0,ry:R()*6.28,s:.13+R()*.1,rz:dx*(.2+R()*.3)});
      if(D6.map[r][k-1]==='#'&&(r+k)%4===0){const tx=x-D6.c/2+.6;jobs.push(put('D_Torch',tx,z,Math.PI/2,1.6));addFlame(scene,tx+.15,2.2,z,1.2,0x7ad8ff);addLight(tx+.6,2.5,z,0x6ac8ff,22,14)}
      if(D6.map[r][k+1]==='#'&&(r+k)%4===2){const tx=x+D6.c/2-.6;jobs.push(put('D_Torch',tx,z,-Math.PI/2,1.6));addFlame(scene,tx-.15,2.2,z,1.2,0x7ad8ff);addLight(tx-.6,2.5,z,0x6ac8ff,22,14)}
      if(ch==='.'&&R()<.05){jobs.push(put(R()<.6?'MD_Column_Broken2':'D_Bones',x+(R()-.5)*4,z+(R()-.5)*4,R()*6.28,R()<.6?1.2:.7).then(o=>tintObj(o,DARK)))}}
    const crs=['../rift/Crystal_1','../rift/Crystal_3','../rift/Crystal_6'];const by=crs.map(()=>[]);CR.forEach((t,i)=>by[i%crs.length].push(t));crs.forEach((c,i)=>jobs.push(riftInst(c,by[i],{col:0xa8d8ff,glow:0x3a8aff,gi:.9,cast:false})))}
  /* -- each master's hall: a ring of columns or obelisks and its own light -- */
  const ring=(P,rx,rz,n,model,s,col,lc)=>{for(let k=0;k<n;k++){const a=k/n*6.28;const x=P.x+Math.cos(a)*rx,z=P.z+Math.sin(a)*rz;if(D6.cell(x,z)!=='.')continue;jobs.push(put(model,x,z,-a,s).then(o=>tintObj(o,col)));addCol(x,z,1.1);if(lc&&k%2===0)addLight(x,3.5,z,lc,18,14)}};
  ring(D6_GRAK,24,13,10,'MD_Column',1.9,STONE,0x6ac8ff);addLight(D6_GRAK.x,5,D6_GRAK.z,0x9ad8ff,34,26);
  ring(D6_SARETH,28,13,12,'MD_Column',1.9,DARK,0xa08aff);for(const sd of[-1,1]){jobs.push(put('D_Pedestal',D6_SARETH.x+sd*5,D6_SARETH.z-4,0,[.6,.55,.6]).then(o=>tintObj(o,STONE)));jobs.push(riftInst('../rift/Crystal_8',[{x:D6_SARETH.x+sd*5,z:D6_SARETH.z-4,y:1.25,ry:R()*6,s:.16}],{col:0xc8b0ff,glow:0x8a5aff,gi:1}))}addLight(D6_SARETH.x,5,D6_SARETH.z,0xb09aff,34,26);
  ring(D6_GHOR,24,15,10,'MD_Column_Broken',1.8,DARK,0xc07aff);addLight(D6_GHOR.x,5,D6_GHOR.z,0xd08aff,34,26);
  ring(D6_VORTH,40,30,14,'K_pillar-obelisk',4.2,new THREE.Color(.36,.42,.6),0x5ab8ff);addLight(D6_VORTH.x,6,D6_VORTH.z,0x8ad8ff,44,34);
  jobs.push(riftInst('../rift/Crystal_9',[{x:D6_VORTH.x,z:D6_VORTH.z-36,y:0,ry:0,s:.6}],{col:0xa8d8ff,glow:0x3a9aff,gi:1.1}));
  for(let k=0;k<3;k++)jobs.push(put('D_Chest_Gold',D6_VORTH.x-7+k*7,D6_VORTH.z-30,Math.PI,1.6));for(let k=0;k<6;k++)jobs.push(put('D_Coin_Pile',D6_VORTH.x-10+k*4,D6_VORTH.z-27+(k%2)*1.4,R()*6,2));
  await Promise.all(jobs)}
