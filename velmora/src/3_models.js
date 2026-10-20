
/* ===================== character models ===================== */
function weaponMesh(wt,rar=0){
  const g=new THREE.Group();const glow=[0,0,0x2a5aff,0xa04aff,0xff6a00][rar]||0;
  const metal=mat(rar>=3?0xc9a8ff:rar>=2?0xbcd4ff:0xc8ccd2,{m:.85,r:.3,e:glow||undefined,ei:glow?.5:undefined}),grip=mat(0x4a2a18),gold=mat(0xd9a441,{m:.9,r:.3});
  if(wt==='zwaard'){mesh(new THREE.BoxGeometry(.1,1.15,.03),metal,0,.75,0,g);mesh(new THREE.ConeGeometry(.07,.2,4),metal,0,1.42,0,g);mesh(new THREE.BoxGeometry(.42,.07,.1),gold,0,.18,0,g);mesh(new THREE.CylinderGeometry(.04,.04,.3,6),grip,0,0,0,g);g.rotation.x=.55}
  else if(wt==='bijl'){mesh(new THREE.CylinderGeometry(.04,.05,1.3,10),grip,0,.5,0,g);const h=mesh(new THREE.CylinderGeometry(.42,.42,.08,12,1,false,0,Math.PI),metal,.02,1.0,0,g);h.rotation.z=Math.PI/2;h.rotation.y=Math.PI/2;mesh(new THREE.ConeGeometry(.06,.25,4),metal,0,1.25,0,g);g.rotation.x=.5}
  else if(wt==='staf'){mesh(new THREE.CylinderGeometry(.035,.05,2,10),sm(0x5a3a22),0,.35,0,g);const orb=mesh(new THREE.IcosahedronGeometry(.15,3),mat(rar>=3?0xd08aff:0x7ad8ff,{e:rar>=3?0xb04aff:0x3aa8ff,ei:2.6,flat:false}),0,1.42,0,g,false);orb.userData.orb=1;for(let i=0;i<3;i++){const p=mesh(new THREE.ConeGeometry(.03,.3,4),gold,Math.cos(i*2.1)*.1,1.3,Math.sin(i*2.1)*.1,g);p.rotation.z=Math.cos(i*2.1)*.4}}
  else if(wt==='ak'){/* AK-47: loop langs +y, greep bij de oorsprong */const gun=mat(0x1f1f22,{m:.8,r:.35,flat:false}),wd=mat(0x6a3f1e,{r:.7,flat:false});
    mesh(new THREE.BoxGeometry(.07,.62,.11),gun,0,.28,0,g);/* kast */mesh(new THREE.CylinderGeometry(.018,.018,.5,8),gun,0,.82,.02,g);/* loop */mesh(new THREE.BoxGeometry(.05,.3,.07),wd,0,.6,.0,g);/* handgreep voor */
    const magz=mesh(new THREE.BoxGeometry(.05,.22,.08),gun,0,.3,-.1,g);magz.rotation.x=-.5;/* banaanmagazijn */mesh(new THREE.BoxGeometry(.06,.36,.09),wd,0,-.2,-.03,g);/* kolf */mesh(new THREE.BoxGeometry(.045,.12,.06),wd,0,.08,-.1,g);/* pistoolgreep */
    mesh(new THREE.BoxGeometry(.03,.06,.04),gun,0,.9,.06,g);/* korrel */g.rotation.x=.1}
  else if(wt==='boog'){const b=mesh(new THREE.TorusGeometry(.62,.032,8,28,Math.PI*1.1),sm(0x6a4422),0,0,0,g);b.rotation.z=-Math.PI*.55;const s=mesh(new THREE.CylinderGeometry(.006,.006,1.15,3),mat(0xeeeeee),-.19,0,0,g,false);void s;g.rotation.y=Math.PI/2}
  return g}
const sm=(c,o={})=>mat(c,{...o,flat:false});
const CAP=(r,l)=>new THREE.CapsuleGeometry(r,l,4,10);
const SPH=(r,ws=14,hs=10,p0=0,pl=Math.PI*2,t0=0,tl=Math.PI)=>new THREE.SphereGeometry(r,ws,hs,p0,pl,t0,tl);
function capeGeo(w,h){const g=new THREE.PlaneGeometry(w,h,4,8);g.translate(0,-h/2,0);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),f=-y/h;p.setX(i,x*(1+f*.45));p.setZ(i,-Math.pow(x/(w*.5),2)*.05-f*.04)}g.computeVertexNormals();return g}
function buildHand(hg,side,grip,ctx){const{o,W,H,skin,handM,bone}=ctx;/* palm + four fingers + thumb; grip curls the fingers around a weapon */
    if(o.golem){mesh(SPH(.17,10,8),skin,0,-.02,0,hg);return}
    const pw=bone?.05:.075,pd=bone?.02:.03;const palm=mesh(new THREE.BoxGeometry(pw*W,.075*H,pd),handM,0,-.03*H,0,hg);palm.geometry.translate(0,0,0);
    const fl=.042*H,fr=bone?.009:.012;const curl=grip?1.5:.35;
    for(let i=0;i<4;i++){const fg=new THREE.Group();fg.position.set((-1.5+i)*pw*W*.42,-.068*H,.005);hg.add(fg);fg.rotation.x=-curl*(.85+i*.05);fg.rotation.z=(i-1.5)*.05*side;
      mesh(new THREE.CapsuleGeometry(fr,fl*.6,3,6),handM,0,-fl*.3,0,fg);const f2=new THREE.Group();f2.position.y=-fl*.6;fg.add(f2);f2.rotation.x=-curl*.9;mesh(new THREE.CapsuleGeometry(fr*.92,fl*.5,3,6),handM,0,-fl*.25,0,f2)}
    const th=new THREE.Group();th.position.set(-side*pw*W*.55,-.02*H,.012);hg.add(th);th.rotation.set(-.5-curl*.4,0,-side*(1.1-curl*.3));mesh(new THREE.CapsuleGeometry(fr*1.05,fl*.55,3,6),handM,0,-fl*.28,0,th)}

/* ===================== Krijger: detailed hero model (reference: knight with lion pauldron, heater shield, greatsword) ===================== */
function heaterShieldGeo(w,h,d){const s=new THREE.Shape();s.moveTo(-w/2,h*.42);s.quadraticCurveTo(-w/2,h*.5,-w/2+.06,h*.5);s.lineTo(w/2-.06,h*.5);s.quadraticCurveTo(w/2,h*.5,w/2,h*.42);s.quadraticCurveTo(w/2,-h*.1,0,-h/2);s.quadraticCurveTo(-w/2,-h*.1,-w/2,h*.42);
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelThickness:.015,bevelSize:.018,bevelSegments:2,curveSegments:10});g.translate(0,0,-d/2);return g}
function greatswordMesh(rar){
  const g=new THREE.Group();const glow=[0,0,0x2a5aff,0xa04aff][rar]||0;
  const steel=mat(rar>=3?0xcdb0ff:0xcfd6de,{m:.9,r:.3,flat:false,e:glow||undefined,ei:glow?.5:undefined}),dark=mat(0x3a3f48,{m:.8,r:.4,flat:false}),gold=mat(0xd9a441,{m:.9,r:.3,flat:false}),grip=sm(0x3a2416);
  const blade=mesh(new THREE.BoxGeometry(.16,1.55,.035),steel,0,1.03,0,g);void blade;mesh(new THREE.BoxGeometry(.045,1.3,.04),dark,0,.98,0,g);/* fuller */
  mesh(new THREE.ConeGeometry(.11,.28,4).rotateY(Math.PI/4),steel,0,1.94,0,g).scale.set(1,1,.3);
  mesh(new THREE.BoxGeometry(.58,.08,.1),steel,0,.25,0,g);for(const s of[-1,1]){const t=mesh(new THREE.BoxGeometry(.12,.14,.1),steel,s*.31,.19,0,g);t.rotation.z=s*.5}
  mesh(new THREE.CylinderGeometry(.042,.048,.4,10),grip,0,0,0,g);mesh(new THREE.TorusGeometry(.045,.012,6,14).rotateX(Math.PI/2),gold,0,.12,0,g);mesh(new THREE.SphereGeometry(.065,10,8),gold,0,-.25,0,g);
  return g}
function lionPauldron(side){const g=new THREE.Group();const st=mat(0xc8ccd2,{m:.9,r:.3,flat:false}),dk=mat(0x8a9098,{m:.85,r:.35,flat:false});
  const base=mesh(SPH(.17,16,10,0,Math.PI*2,0,Math.PI/2),st,0,0,0,g);base.scale.set(1.25,.9,1.15);
  const head=new THREE.Group();head.position.set(side*.03,.1,.06);head.rotation.x=-.35;g.add(head);
  mesh(SPH(.11,14,10),st,0,0,0,head);const mz=mesh(new THREE.BoxGeometry(.1,.08,.1),st,0,-.04,.1,head);void mz;mesh(new THREE.BoxGeometry(.11,.025,.06),dk,0,-.085,.12,head);/* open jaw */
  for(const s of[-1,1]){mesh(new THREE.ConeGeometry(.03,.06,8),st,s*.07,.1,-.02,head);mesh(SPH(.02,8,6),mat(0x3a3f48,{m:.6}),s*.045,.03,.1,head,false)}
  const mane=mesh(new THREE.TorusGeometry(.12,.045,8,18),dk,0,0,-.03,head);mane.scale.set(1,1.05,.6);
  for(let i=0;i<7;i++){const a=Math.PI*.15+i/6*Math.PI*.7;const sp=mesh(new THREE.ConeGeometry(.025,.1,6),dk,Math.cos(a)*.15,Math.sin(a)*.15,-.04,head);sp.rotation.z=a-Math.PI/2}
  mesh(new THREE.TorusGeometry(.19,.02,6,24).rotateX(Math.PI/2),mat(0xd9a441,{m:.9,r:.3,flat:false}),0,-.02,0,g).scale.set(1.25,1,1.15);return g}
function buildWarrior(o){
  const R=RACES[o.race]||RACES.mens;const H=(o.h??R.h)*1.04,W=(o.w??R.w)*1.08;
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const skin=sm(o.skin??R.skin,{r:.7}),hairM=sm(o.hair??0xc9a24a,{r:.55}),dark=sm(0x151010,{r:.3});
  const leather=sm(o.chest??0xb8864f,{r:.7}),leatherD=sm(0x6b4322,{r:.7}),strap=sm(0x4a2e18,{r:.6}),cloth=sm(o.pants??0x5a5652,{r:.8}),cape=sm(o.cape??0x262a4c,{side:1,r:.75}),capeIn=sm(0x4a3a6a,{r:.75});
  const steel=mat(0xc8ccd2,{m:.9,r:.3,flat:false}),steelD=mat(0x8a9098,{m:.85,r:.35,flat:false}),gold=mat(0xd9a441,{m:.9,r:.3,flat:false}),gem=mat(0x4ad8ff,{e:0x2aa8ff,ei:1.6,flat:false});
  const handM=sm(o.gloves??0x6b4322,{r:.65});
  /* ---- legs ---- */
  const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(.13*W,.95*H,0);legR.position.set(-.13*W,.95*H,0);body.add(legL,legR);
  const kneeL=new THREE.Group(),kneeR=new THREE.Group(),ankleL=new THREE.Group(),ankleR=new THREE.Group();
  for(const[lg,kn,an,side]of[[legL,kneeL,ankleL,1],[legR,kneeR,ankleR,-1]]){
    mesh(CAP(.085*W,.34*H),cloth,0,-.22*H,0,lg);/* trousers */
    const thighPl=mesh(new THREE.CylinderGeometry(.1*W,.095*W,.16*H,14,1,false,-Math.PI*.6,Math.PI*1.2),steel,0,-.33*H,0,lg);void thighPl;/* tasset */
    kn.position.set(0,-.46*H,0);lg.add(kn);
    const cop=mesh(SPH(.085*W,12,8),leather,0,0,.015,kn);cop.scale.set(1.1,1,.9);/* leather knee cover */
    mesh(new THREE.BoxGeometry(.09*W,.05,.06),leatherD,0,-.06,.07,kn);mesh(new THREE.BoxGeometry(.07*W,.04,.05),steel,0,.03,.08,kn);
    mesh(new THREE.CylinderGeometry(.078*W,.07*W,.3*H,14),steel,0,-.2*H,0,kn);/* greave */
    mesh(new THREE.BoxGeometry(.03,.28*H,.02),steelD,0,-.2*H,.07*W,kn);/* shin ridge */
    const flap=mesh(new THREE.CylinderGeometry(.095*W,.085*W,.08*H,12,1,true),leather,0,-.08*H,0,kn);void flap;
    an.position.set(0,-.40*H,0);kn.add(an);
    const sab=mesh(CAP(.075*W,.14),steel,0,-.02,.07,an);sab.rotation.x=Math.PI/2;sab.scale.set(1.2,1,.8);
    mesh(new THREE.ConeGeometry(.06*W,.1,8).rotateX(Math.PI/2),steel,0,-.03,.19,an);/* pointed toe */
    for(let i=0;i<3;i++)mesh(new THREE.TorusGeometry(.078*W,.012,6,14).rotateX(Math.PI/2),steelD,0,-.015,.02+i*.05,an).scale.set(1.15,1,.8)}
  /* ---- torso ---- */
  const torso=new THREE.Group();torso.position.y=.95*H;body.add(torso);
  const ch=mesh(CAP(.19,.3*H),leather,0,.38*H,0,torso);ch.scale.set(W*1.4,1,.95);
  const hp=mesh(SPH(.18),cloth,0,.06*H,0,torso);hp.scale.set(W*1.22,.72,.92);
  /* straps across chest */
  for(const s of[-1,1]){const st=mesh(new THREE.BoxGeometry(.05,.56*H,.015),strap,s*.12*W,.4*H,.19,torso);st.rotation.z=s*.32;mesh(new THREE.BoxGeometry(.05,.04,.02),gold,s*.05*W,.5*H,.21,torso)}
  mesh(new THREE.BoxGeometry(.3*W,.05,.02),strap,0,.3*H,.2,torso);mesh(new THREE.BoxGeometry(.06,.07,.025),gold,0,.3*H,.21,torso);
  /* belt with buckles and pouches */
  const belt=mesh(new THREE.CylinderGeometry(.21,.21,.09,20),leatherD,0,.12*H,0,torso);belt.scale.set(W*1.2,1,.9);
  mesh(new THREE.BoxGeometry(.09,.07,.03),gold,0,.12*H,.19,torso);mesh(new THREE.CylinderGeometry(.205,.205,.035,20),strap,0,.06*H,0,torso).scale.set(W*1.2,1,.9);
  for(const[x,z]of[[.17,.1],[-.17,.1],[.1,-.17]]){const p=mesh(new THREE.BoxGeometry(.09,.1,.07),leather,x*W,.03*H,z,torso);p.rotation.y=Math.atan2(x,z);mesh(new THREE.BoxGeometry(.09,.035,.075),leatherD,x*W,.07*H,z,torso).rotation.y=Math.atan2(x,z)}
  /* tunic skirt flaps */
  for(const s of[-1,1]){const f=mesh(new THREE.BoxGeometry(.13*W,.16*H,.03),leather,s*.1*W,-.04*H,.12,torso);f.rotation.x=.12}
  const neckY=.72*H;mesh(new THREE.CylinderGeometry(.06,.075,.14,10),skin,0,neckY+.04,0,torso);
  /* high collar */
  const collar=mesh(new THREE.CylinderGeometry(.19,.16,.15,18,1,true,Math.PI*.38,Math.PI*1.24),cape,0,neckY+.1,-.03,torso);collar.scale.set(W*1.1,1,1);
  /* ---- head ---- */
  const head=new THREE.Group();head.position.y=neckY+.2;torso.add(head);
  const hd=mesh(SPH(.16,20,14),skin,0,.05,0,head);hd.scale.set(1,1.12,1.02);
  for(const s of[-1,1]){mesh(SPH(.03,10,8),mat(0xffffff,{r:.3,flat:false}),s*.06,.075,.135,head,false);mesh(SPH(.017,8,6),mat(0x3a7ad0,{flat:false}),s*.06,.075,.158,head,false);mesh(SPH(.009,6,4),dark,s*.06,.075,.172,head,false);const br=mesh(CAP(.011,.05),hairM,s*.06,.125,.15,head,false);br.rotation.z=Math.PI/2+s*.2}
  const ns=mesh(SPH(.028,8,6),skin,0,.03,.165,head,false);ns.scale.set(.9,1.3,1);mesh(new THREE.BoxGeometry(.05,.012,.01),mat(0x8a4a3a,{flat:false}),0,-.02,.165,head,false);
  /* blond swept hair: cap + fringe spikes */
  const cap=mesh(SPH(.175,20,12,0,Math.PI*2,0,Math.PI*.55),hairM,0,.07,-.015,head);cap.rotation.x=-.3;cap.scale.set(1.04,1.1,1.06);
  for(let i=0;i<7;i++){const a=-.9+i*.3;const sp=mesh(new THREE.ConeGeometry(.045,.16,6),hairM,Math.sin(a)*.14,.16,Math.cos(a)*.13,head);sp.rotation.set(.9+Math.abs(a)*.3,a,0)}
  for(const s of[-1,1]){const sd=mesh(new THREE.ConeGeometry(.04,.14,6),hairM,s*.15,.02,.02,head);sd.rotation.z=s*2.6}
  /* circlet with gem */
  mesh(new THREE.TorusGeometry(.165,.012,8,30).rotateX(Math.PI/2),steel,0,.1,0,head).scale.set(1.02,1,1.02);mesh(new THREE.OctahedronGeometry(.025,0),gem,0,.1,.165,head,false).scale.set(1,1.4,.7);
  /* ---- arms ---- */
  const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(.29*W,neckY-.03,0);armR.position.set(-.29*W,neckY-.03,0);torso.add(armL,armR);
  const elbowL=new THREE.Group(),elbowR=new THREE.Group(),handL=new THREE.Group(),handR=new THREE.Group();
  for(const[ar,el,hg,side]of[[armL,elbowL,handL,1],[armR,elbowR,handR,-1]]){
    mesh(CAP(.07,.22*H),leather,0,-.14*H,0,ar);/* sleeve */
    el.position.set(0,-.30*H,0);ar.add(el);mesh(SPH(.065,10,8),leather,0,0,0,el);
    mesh(CAP(.06,.2*H),skin,0,-.15*H,0,el);
    const vamb=mesh(new THREE.CylinderGeometry(.068,.075,.16*H,14),side<0?steel:leatherD,0,-.2*H,0,el);void vamb;/* bracer */
    if(side<0){mesh(new THREE.TorusGeometry(.072,.01,6,16).rotateX(Math.PI/2),gold,0,-.13*H,0,el);mesh(new THREE.TorusGeometry(.078,.01,6,16).rotateX(Math.PI/2),gold,0,-.27*H,0,el)}
    else for(let i=0;i<2;i++)mesh(new THREE.TorusGeometry(.074,.009,6,16).rotateX(Math.PI/2),strap,0,-.15*H-i*.09,0,el);
    hg.position.set(0,-.33*H,0);el.add(hg);
    buildHand(hg,side,true,{o,W,H,skin,handM,bone:false})}
  /* lion pauldron right, cape clasp left */
  const paul=lionPauldron(-1);paul.position.set(-.3*W,neckY+.02,0);paul.rotation.z=.25;torso.add(paul);
  mesh(SPH(.1,12,8,0,Math.PI*2,0,Math.PI/2),leather,.3*W,neckY,0,torso).scale.set(1.2,.8,1.1);
  mesh(new THREE.OctahedronGeometry(.035,0),gem,.12*W,neckY-.02,.19,torso,false);mesh(new THREE.TorusGeometry(.04,.008,6,16),gold,.12*W,neckY-.02,.19,torso,false);
  /* cape: long, with inner lining and gentle flare */
  const capeG=new THREE.Group();capeG.position.set(0,neckY+.02,-.17);torso.add(capeG);
  const cg=capeGeo(.5*W,1.45*H);mesh(cg,cape,0,0,0,capeG).userData.noOutline=1;const inner=mesh(cg,capeIn,0,0,.012,capeG);inner.userData.noOutline=1;inner.scale.set(.97,.99,1);
  /* weapon & shield */
  let weapon=null,shieldG=null;const wt=o.wt||'zwaard';
  if(wt==='bijl'){weapon=weaponMesh('bijl',o.wr||0);weapon.position.set(0,-.045*H,.03);handR.add(weapon)}
  else{weapon=greatswordMesh(o.wr||0);weapon.position.set(0,-.045*H,.045);handR.add(weapon);
    /* heater shield on the left forearm */
    const sh=new THREE.Group();sh.position.set(.03,-.16*H,.09);elbowL.add(sh);shieldG=sh;
    const shBody=mesh(heaterShieldGeo(.62,.86,.05),steelD,0,0,0,sh);void shBody;
    const rim=mesh(heaterShieldGeo(.56,.78,.012),steel,0,0,.032,sh);rim.scale.set(1,1,1);
    mesh(new THREE.TorusGeometry(.14,.018,8,24),gold,0,.05,.05,sh);mesh(SPH(.075,12,8),gold,0,.07,.06,sh).scale.set(1,1.1,.6);mesh(new THREE.ConeGeometry(.03,.06,6),gold,0,.14,.06,sh);
    for(const s of[-1,1]){mesh(new THREE.ConeGeometry(.025,.05,6),gold,s*.045,.13,.06,sh)}
    for(let i=0;i<6;i++)mesh(new THREE.BoxGeometry(.03,.03,.01),mat(0xa8b0b8,{m:.7,flat:false}),-.22+i*.088,.36,.06,sh).rotation.z=Math.PI/4;
    for(let i=0;i<5;i++)mesh(new THREE.OctahedronGeometry(.016,0),steel,-.18+i*.09,-.1,.06,sh)}
  g.traverse(m=>{if(m.isMesh){m.castShadow=true}});
  const s=o.scale||1;g.scale.setScalar(s);
  return{g,body,legL,legR,kneeL,kneeR,ankleL,ankleR,armL,armR,elbowL,elbowR,handL,handR,torso,head,cape:capeG,weapon,shield:shieldG,wings:[],wt,warrior:true,h:H*1.85*s,ph:Math.random()*6}}

function buildHumanoid(o){if(o.cls&&GLTF_MODELS[o.cls]&&!o.noGltf&&!window.__NOGLTF)return buildGltfChar(o);return buildHumanoidProc(o)}
function buildHumanoidProc(o){
  if(o.warrior)return buildWarrior(o);
  const R=RACES[o.race]||RACES.mens;const H=o.h??R.h,W=o.w??R.w;
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  const skin=o.golem?mat(o.skin,{e:0xff5a10,ei:.28,r:1}):sm(o.skin??R.skin,{r:.7}),chestM=o.chestMetal?mat(o.chest,{m:.75,r:.35,flat:false}):sm(o.chest??0x777777,{r:.65}),pantsM=o.legPlate?mat(o.pants,{m:.7,r:.4,flat:false}):sm(o.pants??0x333333),bootM=sm(o.boots??0x3a2818,{r:.55}),hairM=sm(o.hair??0x3b2414,{r:.55}),dark=sm(0x151010,{r:.3});
  const bone=o.bone||o.golem;const lr=o.golem?.14:o.bone?.035:.075;
  const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(.12*W,.92*H,0);legR.position.set(-.12*W,.92*H,0);body.add(legL,legR);
  const kneeL=new THREE.Group(),kneeR=new THREE.Group(),ankleL=new THREE.Group(),ankleR=new THREE.Group();
  for(const[lg,kn,an]of[[legL,kneeL,ankleL],[legR,kneeR,ankleR]]){mesh(CAP(lr*1.15*W,.34*H),bone?skin:pantsM,0,-.23*H,0,lg);kn.position.set(0,-.46*H,0);lg.add(kn);
    mesh(SPH(lr*1.1*W,10,8),bone?skin:pantsM,0,0,0,kn);mesh(CAP(lr*W,.28*H),bone?skin:pantsM,0,-.19*H,0,kn);an.position.set(0,-.40*H,0);kn.add(an);
    const bt=mesh(CAP(.075*W,.13),bone?skin:bootM,0,-.02,.06,an);bt.rotation.x=Math.PI/2;bt.scale.set(1.15,1,.85);if(o.bootsBig&&!bone){mesh(new THREE.CylinderGeometry(.095*W,.085*W,.2*H,14),bootM,0,-.28*H,0,kn)}if(o.legPlate&&!bone){const k2=mesh(SPH(.075,10,8),pantsM,0,.01,.05,kn);k2.scale.set(1,1,.75)}}
  const torso=new THREE.Group();torso.position.y=.92*H;body.add(torso);
  if(o.golem){const ch=mesh(new THREE.DodecahedronGeometry(.34,1),skin,0,.4*H,0,torso);ch.scale.set(W*1.5,1.15,1.05);mesh(new THREE.DodecahedronGeometry(.24,1),skin,0,.05,0,torso).scale.set(W*1.4,.8,1);for(let i=0;i<5;i++){const v=mesh(new THREE.BoxGeometry(.04,.3,.02),mat(0xff8a20,{e:0xff6a10,ei:2.5}),(-.2+i*.1)*W,.35+(i%2)*.12,.31,torso,false);v.rotation.z=(i-2)*.3}}
  else if(bone){for(let i=0;i<4;i++){const r=mesh(new THREE.TorusGeometry(.13*W-i*.012,.018,5,14,Math.PI*1.4),skin,0,.25+i*.09,0,torso);r.rotation.set(Math.PI/2,0,Math.PI*.8);r.scale.z=.8}
    mesh(new THREE.CylinderGeometry(.03,.03,.62,6),skin,0,.35,-.08,torso);const pel=mesh(SPH(.13),skin,0,.03,0,torso);pel.scale.set(W*1.2,.5,.8)}
  else{const ch=mesh(CAP(.17,.3*H),chestM,0,.38*H,0,torso);ch.scale.set(W*1.38,1,.9);const hp=mesh(SPH(.17),pantsM,0,.06,0,torso);hp.scale.set(W*1.2,.72,.9);
    const belt=mesh(new THREE.CylinderGeometry(.205,.205,.08,18),o.trim?mat(0x3a2414,{e:o.trim,ei:.9,flat:false}):sm(0x3a2414,{r:.5}),0,.11,0,torso);if(o.trim){const tr=mesh(new THREE.TorusGeometry(.2,.012,6,24).rotateX(Math.PI/2),mat(o.trim,{e:o.trim,ei:1.6,flat:false}),0,.6*H,0,torso);tr.scale.set(W*1.32,1,.86)}belt.scale.set(W*1.18,1,.88);mesh(new THREE.BoxGeometry(.09,.08,.04),mat(0xd9a441,{m:.85,r:.3}),0,.11,.18,torso)}
  if(o.robe){mesh(new THREE.CylinderGeometry(.21*W,.4*W,.92*H,20,1,true),sm(o.robe,{side:1}),0,-.28*H,0,torso).userData.noOutline=1}
  const neckY=.7*H;mesh(new THREE.CylinderGeometry(.06,.07,.14,10),skin,0,neckY+.04,0,torso);
  const head=new THREE.Group();head.position.y=neckY+.2;torso.add(head);
  if(o.golem){mesh(new THREE.DodecahedronGeometry(.2,1),skin,0,.04,0,head);for(const s of[-1,1])mesh(SPH(.04,8,6),mat(0xffb030,{e:0xff8a10,ei:3}),s*.07,.06,.17,head,false);if(o.fire){for(let i=0;i<5;i++){const f=mesh(new THREE.ConeGeometry(.07,.35,8),new THREE.MeshBasicMaterial({color:new THREE.Color(0xff6a10).multiplyScalar(2.4)}),Math.cos(i*1.26)*.12,.28,Math.sin(i*1.26)*.12,head,false);flames.push(f)}}}
  else if(bone){const sk=mesh(SPH(.17),skin,0,.06,0,head);sk.scale.set(1,1.05,1.05);for(const s of[-1,1]){mesh(SPH(.045,8,6),dark,s*.065,.07,.135,head,false);mesh(SPH(.022,6,4),mat(o.eye??0x6aff6a,{e:o.eye??0x6aff6a,ei:3}),s*.065,.07,.16,head,false)}const jw=mesh(SPH(.1),skin,0,-.07,.05,head);jw.scale.set(1,.6,1)}
  else{const hd=mesh(SPH(.165,18,14),skin,0,.05,0,head);hd.scale.set(1,1.1,1.02);
    for(const s of[-1,1]){mesh(SPH(.03,10,8),mat(0xffffff,{r:.3,flat:false}),s*.062,.075,.135,head,false);mesh(SPH(.017,8,6),dark,s*.062,.075,.158,head,false);const br=mesh(CAP(.012,.05),hairM,s*.062,.125,.15,head,false);br.rotation.z=Math.PI/2+s*.15}
    const ns=mesh(SPH(.03,8,6),skin,0,.03,.165,head,false);ns.scale.set(1,1.2,1);
    if(!o.helm&&!o.hat&&!o.hood){const hr=mesh(SPH(.178,18,12,0,Math.PI*2,0,Math.PI*.55),hairM,0,.07,-.015,head);hr.rotation.x=-.35;hr.scale.set(1.04,1.08,1.05);if(o.race==='elf'||o.longhair){const lh=mesh(CAP(.09,.28),hairM,0,-.1,-.13,head);lh.scale.set(1.5,1,.6)}}
    if(o.ears||o.race==='elf')for(const s of[-1,1]){const e=mesh(new THREE.ConeGeometry(.035,.22,8),skin,s*.18,.08,-.02,head);e.rotation.z=-s*1.2}
    if(o.tusks||o.race==='grol')for(const s of[-1,1]){const t=mesh(new THREE.ConeGeometry(.02,.09,8),sm(0xf0ead8),s*.06,-.03,.14,head,false);t.rotation.x=-.2}
    if(o.beard||o.race==='dwerg'){const bd=mesh(SPH(.15),hairM,0,-.1,.08,head);bd.scale.set(1,1.15,.7);const bt=mesh(new THREE.ConeGeometry(.09,.24,12),hairM,0,-.3,.11,head);bt.rotation.x=Math.PI+.2}}
  const metal=mat(0x8f969e,{m:.85,r:.32,flat:false}),helmM=mat(o.helmCol??0x8f969e,{m:.8,r:.32,flat:false});
  if(o.helm){mesh(SPH(.195,18,12,0,Math.PI*2,0,Math.PI*.58),helmM,0,.09,0,head);mesh(new THREE.TorusGeometry(.19,.018,6,24).rotateX(Math.PI/2),mat(0xd9a441,{m:.85,r:.3,flat:false}),0,.1,0,head);mesh(new THREE.BoxGeometry(.03,.14,.03),metal,0,.04,.19,head);const cr=mesh(CAP(.02,.2),metal,0,.27,-.02,head);cr.rotation.x=Math.PI/2}
  if(o.hat){mesh(new THREE.CylinderGeometry(.34,.34,.025,24),sm(o.hat),0,.19,0,head);const c=mesh(new THREE.ConeGeometry(.19,.62,20),sm(o.hat),0,.5,-.05,head);c.rotation.x=-.25}
  if(o.hood){mesh(SPH(.205,18,12,0,Math.PI*2,0,Math.PI*.62),sm(o.hood),0,.07,-.02,head).rotation.x=-.25;const tp=mesh(new THREE.ConeGeometry(.1,.25,12),sm(o.hood),0,.17,-.2,head);tp.rotation.x=-1}
  if(o.horns)for(const s of[-1,1]){const hn=mesh(new THREE.ConeGeometry(.04,.22,8),sm(0x2a1a14),s*.1,.2,0,head);hn.rotation.z=-s*.5}
  if(o.crown){for(let i=0;i<6;i++){const a=i/6*Math.PI*2;mesh(new THREE.ConeGeometry(.035,.16,8),mat(0xffd34d,{m:.9,r:.25,e:0x6a4a00,ei:.5,flat:false}),Math.cos(a)*.14,.28,Math.sin(a)*.14,head)}mesh(new THREE.CylinderGeometry(.16,.17,.06,20),mat(0xffd34d,{m:.9,r:.25,flat:false}),0,.2,0,head)}
  const armL=new THREE.Group(),armR=new THREE.Group();armL.position.set(.27*W,neckY-.03,0);armR.position.set(-.27*W,neckY-.03,0);torso.add(armL,armR);
  const elbowL=new THREE.Group(),elbowR=new THREE.Group();const handL=new THREE.Group(),handR=new THREE.Group();
  const handM=o.gloves?sm(o.gloves):skin;
  for(const[ar,el,hg,side]of[[armL,elbowL,handL,1],[armR,elbowR,handR,-1]]){mesh(CAP(lr*.88,.22*H),bone?skin:chestM,0,-.14*H,0,ar);el.position.set(0,-.30*H,0);ar.add(el);
    mesh(SPH(lr*.9,10,8),bone?skin:chestM,0,0,0,el);mesh(CAP(lr*.78,.2*H),skin,0,-.15*H,0,el);hg.position.set(0,-.33*H,0);el.add(hg);
    const grip=!!(o.wt&&o.wt!=='none')&&(o.wt==='boog'?side>0:side<0)||!!(o.shield&&side>0);buildHand(hg,side,grip,{o,W,H,skin,handM,bone});
    if(o.gloves&&!bone){mesh(new THREE.CylinderGeometry(o.glovesBig?.075:.062,o.glovesBig?.068:.058,.12*H,12),o.glovesBig?mat(o.gloves,{m:.75,r:.35,flat:false}):sm(o.gloves),0,-.30*H,0,el)}}
  if(o.pads){for(const[ar,s]of[[armL,1],[armR,-1]]){const p=mesh(SPH(.13,14,8,0,Math.PI*2,0,Math.PI/2),o.padsMetal===false?sm(o.pads):mat(o.pads,{m:o.padsMetal?.75:.2,r:.4,flat:false}),s*.02,.0,0,ar);p.scale.set(1.15,.85,1.1);if(o.trim){const t=mesh(new THREE.TorusGeometry(.13,.012,6,20).rotateX(Math.PI/2),mat(o.trim,{e:o.trim,ei:1.6,flat:false}),s*.02,0,0,ar);t.scale.set(1.15,1,1.1)}}}
  const wings=[];if(o.wings){for(const s of[-1,1]){const w=mesh(new THREE.CircleGeometry(.42,10,0,Math.PI*.7),mat(0x6a1a10,{side:1,flat:false}),s*.12,neckY-.1,-.16,torso);w.rotation.set(0,s*.6,s>0?-.3:Math.PI+.3);w.userData.wing=s;w.userData.noOutline=1;wings.push(w)}}
  let cape=null;if(o.cape){cape=new THREE.Group();cape.position.set(0,neckY-.02,-.15);torso.add(cape);mesh(capeGeo(.42*W,1*H),sm(o.cape,{side:1}),0,0,0,cape).userData.noOutline=1}
  let weapon=null;if(o.wt&&o.wt!=='none'){weapon=weaponMesh(o.wt,o.wr||0);weapon.position.set(0,-.045*H,.03);handR.add(weapon);if(o.wt==='boog'){handR.remove(weapon);handL.add(weapon);weapon.position.set(0,-.03*H,.05)}}
  if(o.shield){const s=mesh(new THREE.CylinderGeometry(.3,.3,.06,24),sm(0x6a5a3a),0,-.15*H,.11,elbowL);s.rotation.x=Math.PI/2;mesh(new THREE.TorusGeometry(.3,.025,6,24),metal,0,-.15*H,.11,elbowL);mesh(SPH(.07,10,8),metal,0,-.15*H,.15,elbowL)}
  g.traverse(m=>{if(m.isMesh){m.castShadow=true}});outline(g,o.golem?.07:.04);
  const s=o.scale||1;g.scale.setScalar(s);
  return{g,body,legL,legR,kneeL,kneeR,ankleL,ankleR,armL,armR,elbowL,elbowR,handL,handR,torso,head,cape,weapon,wings,wt:o.wt,h:H*1.8*s,ph:Math.random()*6}}
function buildQuad(o){/* boar & wolf */
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);const c=sm(o.col,{r:.8}),d=sm(new THREE.Color(o.col).multiplyScalar(.7).getHex(),{r:.8});const wolf=o.kind==='wolf';
  const L=wolf?1.25:1.1,Hh=wolf?.72:.6;
  const tb=mesh(CAP(wolf?.26:.32,L*.6),c,0,Hh+.12,0,body);tb.rotation.x=Math.PI/2;tb.scale.set(1,1,wolf?.92:1);
  const ch=mesh(SPH(wolf?.32:.36),wolf?c:d,0,Hh+.18,L*.28,body);ch.scale.set(1,1.05,1.1);
  if(wolf){const mn=mesh(SPH(.3),d,0,Hh+.2,L*.38,body);mn.scale.set(1.05,1,.8)}
  const head=new THREE.Group();head.position.set(0,Hh+.3,L*.55);body.add(head);
  mesh(SPH(wolf?.2:.24),c,0,0,.08,head);const sn=mesh(CAP(wolf?.085:.12,wolf?.22:.18),wolf?c:d,0,-.06,.32,head);sn.rotation.x=Math.PI/2;
  if(wolf){for(const s of[-1,1]){const e=mesh(new THREE.ConeGeometry(.065,.2,10),c,s*.11,.2,0,head);e.rotation.z=-s*.2}mesh(SPH(.035,8,6),dark(),0,-.04,.5,head,false);for(const s of[-1,1])mesh(SPH(.035,8,6),mat(0xffd34d,{e:0xffb000,ei:2.5}),s*.09,.05,.22,head,false)}
  else{mesh(new THREE.CylinderGeometry(.11,.11,.05,14).rotateX(Math.PI/2),sm(0xd9a98a),0,-.06,.47,head);for(const s of[-1,1]){const t=mesh(new THREE.ConeGeometry(.03,.18,8),sm(0xf5ecd8),s*.12,-.08,.36,head);t.rotation.x=-.9}for(const s of[-1,1])mesh(SPH(.03,8,6),dark(),s*.1,.07,.22,head,false);for(const s of[-1,1]){const e=mesh(new THREE.ConeGeometry(.07,.14,8),d,s*.13,.2,.0,head);e.rotation.z=-s*.6}const mane=mesh(CAP(.05,.5),d,0,Hh+.42,0,body);mane.rotation.x=Math.PI/2}
  const legs=[];for(const[x,z]of[[-.17,L*.36],[.17,L*.36],[-.17,-L*.36],[.17,-L*.36]]){const lg=new THREE.Group();lg.position.set(x,Hh,z);body.add(lg);mesh(CAP(.07,Hh*.62),d,0,-Hh*.45,0,lg);mesh(SPH(.075,8,6),dark(),0,-Hh+.05,.02,lg);legs.push(lg)}
  let tail=null;if(wolf){tail=new THREE.Group();tail.position.set(0,Hh+.25,-L*.48);body.add(tail);const t=mesh(new THREE.ConeGeometry(.09,.6,10),c,0,0,-.3,tail);t.rotation.x=-Math.PI/2;tail.rotation.x=.5}
  g.traverse(m=>{if(m.isMesh)m.castShadow=true});outline(g,.04);g.scale.setScalar(o.scale||1);
  return{g,body,head,legs,tail,quad:1,h:1.3*(o.scale||1),ph:Math.random()*6}}
function dark(){return mat(0x111111)}
function buildSpider(o){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);const c=sm(o.col,{r:.5}),mk=mat(0xb02a2a,{e:0x5a0a0a,ei:.6});
  const ab=mesh(SPH(.55,18,14),c,0,.85,-.55,body);ab.scale.set(1,.8,1.2);mesh(new THREE.SphereGeometry(.18,8,6),mk,0,1.2,-.6,body,false);
  mesh(SPH(.35,16,12),c,0,.75,.2,body);
  for(let i=0;i<4;i++)for(const s of[-1,1])mesh(new THREE.SphereGeometry(.045,6,4),mat(0xff3030,{e:0xff1010,ei:3}),s*(.06+i%2*.08),.88+(i>1?.06:0),.5,body,false);
  const legs=[];for(let i=0;i<4;i++)for(const s of[-1,1]){const lg=new THREE.Group();lg.position.set(s*.25,.8,.35-i*.22);lg.rotation.y=s*(-.5+i*.35)+(s<0?Math.PI:0);body.add(lg);const up=mesh(CAP(.04,.7),c,.36,.22,0,lg);up.rotation.z=.6-Math.PI/2;const lo=mesh(new THREE.ConeGeometry(.04,.9,8),c,.95,-.08,0,lg);lo.rotation.z=-1.05-Math.PI/2;legs.push(lg)}
  g.traverse(m=>{if(m.isMesh)m.castShadow=true});outline(g,.04);g.scale.setScalar(o.scale||1);
  return{g,body,legs,spider:1,h:1.4*(o.scale||1),ph:Math.random()*6}}
function buildMonster(type,lvl){const t=MON[type];const sc=(t.size||1)*(1+(lvl-t.lv[0])*.04);if(!window.__NOGLTF){const r=buildGltfMon(type,lvl,sc);if(r)return r}return compactRig(buildMonsterProc(type,lvl))}
function buildMonsterProc(type,lvl){
  const t=MON[type];const sc=(t.size||1)*(1+(lvl-t.lv[0])*.04);
  if(t.kind==='boar'||t.kind==='wolf'||t.kind==='raptor')return buildQuad({kind:t.kind==='raptor'?'wolf':t.kind,col:t.col,scale:sc});
  if(t.kind==='bat'||t.kind==='dragon')return buildHumanoid({race:'mens',skin:t.col,hair:0x2a1a14,chest:0x7a2010,pants:0x3a1008,wt:'none',horns:1,wings:1,scale:sc*(t.kind==='bat'?.7:1),tusks:1});
  if(t.kind==='trex')return buildHumanoid({race:'dwerg',golem:1,skin:t.col,wt:'none',scale:sc,fire:1,h:1,w:1.2});
  if(t.kind==='spider')return buildSpider({col:t.col,scale:sc});
  if(t.kind==='human')return buildHumanoid({race:'mens',skin:0xc89070,hair:0x2a1a10,chest:type==='grisk'?0x5a3a1a:0x4a3a2a,pants:0x2a2a22,hood:type==='grisk'?null:t.col,helm:type==='grisk',pads:type==='grisk'?0xb08a20:null,cape:type==='grisk'?0x6a1a1a:null,wt:t.wt,scale:sc,beard:type==='grisk'});
  if(t.kind==='imp')return buildHumanoid({race:'mens',skin:t.col,hair:0x2a1a14,chest:0x7a2010,pants:0x3a1008,wt:'none',horns:1,wings:1,scale:sc,tusks:1});
  if(t.kind==='golem')return buildHumanoid({race:'dwerg',golem:1,skin:t.col,wt:'none',scale:sc,fire:t.fire,h:1,w:1.2});
  if(t.kind==='skel')return buildHumanoid({race:'mens',bone:1,skin:t.col,wt:t.wt,robe:t.robe,crown:t.boss,eye:t.boss?0x7aff5a:type==='kmagier'?0xc06aff:0x6ad8ff,scale:sc,shield:type==='knekel',cape:t.boss?0x3a0d4a:null,wr:t.boss?3:0})}
/* procedural animation */
/* ===================== skeletal animation (procedural) =====================
   Conventions (model faces +z): hip/shoulder rotation.x NEGATIVE swings the limb forward, POSITIVE backward.
   knee bend = positive rotation (shin goes back), elbow bend = negative rotation (forearm comes forward).
   r: rig with hip/knee/ankle/shoulder/elbow joints. a:{spd (0..1+), atk (0..1|-1), ranged, cast, dead, air, vy, hurt, turn, wt} */
const ease=(a,b,k)=>a+(b-a)*k;
const _bv=new THREE.Vector3(),_Y=new THREE.Vector3(0,1,0),_qRoot=new THREE.Quaternion(),_qP=new THREE.Quaternion(),_qA=new THREE.Quaternion(),_qW=new THREE.Quaternion(),_eA=new THREE.Euler();
function gaitCurves(ph,amt,run){
  /* one stride = 2π. Left leg: heel strike at ph=0 (leg forward), toe-off at ~π·0.6, swing π·0.6→2π. */
  const s=Math.sin(ph),c=Math.cos(ph);
  const A=run?.9:.62;                    /* hip swing amplitude */
  const hip=-s*A;                        /* forward (negative) at ph=π/2 */
  const swing=Math.max(0,-c);            /* 1 while leg travels forward (mid swing) */
  const stance=Math.max(0,c);            /* 1 at mid stance */
  const knee=.08+swing*swing*(run?1.55:1.15)*amt+stance*(run?.35:.18)*amt*Math.max(0,s*-1+.3);
  /* ankle: toes down at toe-off (just before swing), level in stance, slightly up before heel strike */
  const ankle=(-Math.max(0,Math.sin(ph-.5))*.45+Math.max(0,Math.sin(ph+2.2))*.25)*amt;
  return{hip,knee,ankle}}
function animRig(r,a,dt){
  if(r.gltf){animGltf(r,a,dt);return}
  const mv=clamp(a.spd||0,0,1.6),amt=Math.min(mv,1);const now=performance.now()*.001;
  r.st=r.st||{idle:0,land:0,prevAir:false,capeA:0,capeV:0,capeZ:0,hurt:0,lean:0,amt:0};const S=r.st;
  S.hurt=Math.max(0,S.hurt-dt);if(a.hurt&&S.hurt<=0)S.hurt=.35;
  S.amt=ease(S.amt,amt,clamp(dt*8,0,1));const am=S.amt;const run=am>.62;
  const freq=mv>.03?(run?7.2+3.5*amt:5.6+2.4*amt):0;const prevPh=r.ph;r.ph+=dt*freq;
  if(r.legL&&!a.air&&am>.25&&Math.floor(prevPh/Math.PI)!==Math.floor(r.ph/Math.PI)){if(a.onStep)a.onStep(Math.floor(r.ph/Math.PI)%2===0?-1:1)}
  if(r.legL){
    const ph=r.ph;const k=clamp(dt*18,0,1);
    const L=gaitCurves(ph,am,run),R=gaitCurves(ph+Math.PI,am,run);
    let hipL=L.hip,hipR=R.hip,kneeL=L.knee,kneeR=R.knee,ankL=L.ankle,ankR=R.ankle;
    if(a.air){const up=(a.vy||0)>0;hipL=up?-.75:-.35;hipR=up?-.25:.05;kneeL=up?1.5:.6;kneeR=up?1.1:.45;ankL=up?.3:-.4;ankR=up?.3:-.4}
    if(a.dead){hipL=-.25;hipR=.2;kneeL=1.2;kneeR=.9}
    if(am<.05&&!a.air&&!a.dead){/* idle: knees relaxed, feet flat, slight weight shift */const w=Math.sin(now*.6);hipL=.02+w*.02;hipR=.02-w*.02;kneeL=.06+Math.max(0,w)*.06;kneeR=.06+Math.max(0,-w)*.06;ankL=ankR=0}
    /* warrior stance: bent knees, wide feet, hunched shoulders (heavier in combat) */
    const WS=r.warrior&&!a.dead&&!a.air?{knee:(a.combat?.6:.12)*(1-am*.6),hip:(a.combat?-.35:-.06)*(1-am*.6),splay:a.combat?.22:.06,lean:a.combat?.22:.04,drop:(a.combat?.1:.02)*(1-am*.6)}:null;
    if(WS){hipL+=WS.hip;hipR+=WS.hip;kneeL+=WS.knee;kneeR+=WS.knee;ankL+=WS.knee*.45;ankR+=WS.knee*.45}
    r.legL.rotation.x=ease(r.legL.rotation.x,hipL,k);r.legR.rotation.x=ease(r.legR.rotation.x,hipR,k);
    r.kneeL.rotation.x=ease(r.kneeL.rotation.x,kneeL,k);r.kneeR.rotation.x=ease(r.kneeR.rotation.x,kneeR,k);
    if(r.ankleL){r.ankleL.rotation.x=ease(r.ankleL.rotation.x,ankL,k);r.ankleR.rotation.x=ease(r.ankleR.rotation.x,ankR,k)}
    /* legs splay a touch outward when standing */
    const spl=WS?WS.splay:.04*(1-am);r.legL.rotation.z=ease(r.legL.rotation.z,spl,k);r.legR.rotation.z=ease(r.legR.rotation.z,-spl,k);
    /* ---- pelvis & torso ---- */
    const bob=(Math.abs(Math.sin(ph))*(run?.075:.04)-(run?.03:0))*am;
    S.idle=am<.05&&a.atk<0&&!a.cast?S.idle+dt:0;
    const breathe=Math.sin(now*1.9)*.012;
    if(S.prevAir&&!a.air)S.land=.22;S.prevAir=!!a.air;const landK=S.land>0?Math.sin(Math.min(1,S.land/.22)*Math.PI)*.16:0;S.land=Math.max(0,S.land-dt);
    r.torso.position.y=r.legL.position.y+bob-landK*.5-(WS?WS.drop:0);
    r.body.scale.y=ease(r.body.scale.y,1-landK*.5+breathe,clamp(dt*14,0,1));r.body.scale.x=r.body.scale.z=1-(r.body.scale.y-1)*.5;
    /* pelvis yaw follows the legs, shoulders counter-rotate */
    const pelvisYaw=Math.sin(ph)*.09*am;r.body.rotation.y=ease(r.body.rotation.y,pelvisYaw,k);
    const leanT=a.dead?0:(am*(run?.18:.06)+(a.air?.1:0)+(WS?WS.lean:0)+(S.hurt>0?-.3*Math.sin(S.hurt/.35*Math.PI):0));S.lean=ease(S.lean,leanT,clamp(dt*8,0,1));
    const twist=-Math.sin(ph)*.16*am;const sway=Math.cos(ph)*.035*am;
    r.torso.rotation.x=S.lean;r.torso.rotation.y=ease(r.torso.rotation.y,twist-pelvisYaw+(a.turn||0)*.06,k);r.torso.rotation.z=ease(r.torso.rotation.z,sway,k);
    /* head stays level and looks ahead; idle look-around */
    let headY=-(r.torso.rotation.y+r.body.rotation.y)*.8,headX=-S.lean*.6-am*.04-(r.warrior&&a.combat?.15:0);if(S.idle>1.5){const f=Math.min(1,(S.idle-1.5)/1.5);headY+=Math.sin(S.idle*.5)*.4*f;headX+=Math.sin(S.idle*.33)*.08*f}
    r.head.rotation.y=ease(r.head.rotation.y,headY,clamp(dt*6,0,1));r.head.rotation.x=ease(r.head.rotation.x,headX,clamp(dt*6,0,1));r.head.rotation.z=ease(r.head.rotation.z,-sway*.5,k);
    /* ---- arms: counter-swing, elbows bend on the forward swing, run pumps the arms ---- */
    const sw=Math.sin(ph)*(run?.95:.5)*am;
    let shL=sw+.05,shR=-sw+.05;            /* left arm forward (negative) when left leg is back (hip positive) */
    let elL=(run?.9:.25)+Math.max(0,sw)*(run?.4:.55),elR=(run?.9:.25)+Math.max(0,-sw)*(run?.4:.55);
    let shLz=.12+am*.05,shRz=-.12-am*.05,twistA=0;
    if(S.idle>0){shL+=Math.sin(now*1.2)*.025;shR+=Math.cos(now*1.2)*.025;elL=.22+Math.sin(now*1.1)*.03;elR=.22+Math.cos(now*1.1)*.03}
    if(a.air){shL=-.9;shR=-.9;elL=.5;elR=.5;shLz=.55;shRz=-.55}
    const wt=a.wt||r.wt||'zwaard';let bladeDir=null,shieldYaw=.3;
    if(a.cast){const w=Math.sin(now*9)*.08;shL=-1.9+w;shR=-1.8-w;elL=1.3;elR=1.3;shLz=.35;shRz=-.35}
    if(a.atk>=0){const p=a.atk;
      if(a.ranged&&wt==='boog'){/* draw: left arm out, right hand to the cheek, then release */shL=-1.55;shLz=.08;elL=.08;if(p<.55){const q=p/.55;shR=ease(-.6,-1.35,q);elR=ease(.6,2.3,q);shRz=-.25;twistA=.4*q}else{const q=(p-.55)/.45;shR=ease(-1.35,-1.5,q);elR=ease(2.3,.4,Math.min(1,q*1.8));twistA=.4*(1-q)}}
      else if(a.ranged){/* staff: gather, then thrust forward */if(p<.45){const q=p/.45;shR=ease(-.3,-2.2,q);elR=ease(.4,1.2,q);shL=ease(0,-1.5,q);elL=.9;twistA=-.3*q}else{const q=(p-.45)/.55;shR=ease(-2.2,-1.4,Math.min(1,q*2));elR=ease(1.2,.1,Math.min(1,q*2));shL=ease(-1.5,-.3,q);elL=.4;twistA=ease(-.3,.3,q)}}
      else if(r.warrior&&wt!=='bijl'){/* MELEE COMBO: 0 horizontal, 1 upward, 2 downward; blade direction is keyframed in body space */
        const c=(a.combo||0)%3;const w=p<.3?p/.3:0,st=clamp((p-.3)/.3,0,1),rec=clamp((p-.6)/.4,0,1);shL=-.95;shLz=.08;elL=1.3;shieldYaw=.15;
        const L3=(A,B,t)=>[ease(A[0],B[0],t),ease(A[1],B[1],t),ease(A[2],B[2],t)];const G=[-.12,1,.18];
        if(c===0){/* horizontal: wind out to the right, sweep across to the left */shR=ease(ease(-.5,-.3,w),-1.0,st);shRz=ease(ease(-.3,-1.2,w),.8,st);elR=ease(ease(1.55,.4,w),.3,st);twistA=ease(ease(0,.55,w),-.7,st);bladeDir=L3(L3(G,[-1,.25,-.3],w),[1,.05,.5],st)}
        else if(c===1){/* upward: dip low-right, rip up and over the left shoulder */shR=ease(ease(-.5,.3,w),-2.4,st);shRz=ease(ease(-.3,-.7,w),.4,st);elR=ease(ease(1.55,.5,w),.3,st);twistA=ease(ease(0,.4,w),-.55,st);S.lean=ease(S.lean,ease(.45,-.1,st),.4);bladeDir=L3(L3(G,[-.6,-.6,.6],w),[.6,1,-.1],st)}
        else{/* downward: raise overhead, slam down and forward with a deep knee */shR=ease(ease(-.5,-3.0,w),-.5,st);shRz=ease(ease(-.3,-.15,w),.1,st);elR=ease(ease(1.55,.8,w),.2,st);twistA=ease(ease(0,-.25,w),.35,st);S.lean=ease(S.lean,ease(-.15,.5,st),.5);bladeDir=L3(L3(G,[0,1,-.5],w),[.2,-.7,1],st)}
        if(rec>0){shR=ease(shR,-.5,rec);shRz=ease(shRz,-.3,rec);elR=ease(elR,1.55,rec);twistA=ease(twistA,0,rec);bladeDir=L3(bladeDir,G,rec)}}
      else if(wt==='bijl'){/* two-handed overhead chop (axe) */if(p<.42){const q=p/.42;shR=ease(0,-3.25,q);elR=ease(.3,1.0,q);shL=ease(0,-3.0,q);elL=1.0;twistA=-.15*q;S.lean=ease(S.lean,-.2,.3)}else{const q=clamp((p-.42)/.28,0,1);shR=ease(-3.25,-.6,q);elR=ease(1.0,.2,q);shL=ease(-3.0,-.4,q);elL=.3;twistA=ease(-.15,.12,q);S.lean=ease(S.lean,.35,.5)}}
      else{/* sword: wind up behind the shoulder, slash across the body */if(p<.3){const q=p/.3;shR=ease(0,-3.3,q);shRz=ease(-.12,-.7,q);elR=ease(.3,1.5,q);twistA=-.6*q;shL=ease(.05,-.5,q);elL=1.0}else{const q=clamp((p-.3)/.3,0,1);shR=ease(-3.3,-.9,q);shRz=ease(-.7,.7,q);elR=ease(1.5,.15,q);twistA=ease(-.6,.55,q);shL=ease(-.5,.4,q);elL=.5}}
      r.torso.rotation.y=ease(r.torso.rotation.y,-twistA,clamp(dt*22,0,1));r.torso.rotation.x=S.lean}
    if(r.warrior&&a.atk<0&&!a.cast&&!a.dead&&!a.air){
      const bw=Math.sin(now*2)*.03;
      if(a.combat){/* READY / GUARD: low wide stance, sword upright beside the right shoulder, shield squared forward */
        shR=-.5+bw;shRz=-.3;elR=1.55;shL=-.95-bw;shLz=.08;elL=1.3;bladeDir=[-.12,1,.18];shieldYaw=.15}
      else if(am<.08){/* IDLE: upright, arm relaxed, blade straight up beside the hip, shield resting across the chest */
        shR=.04+bw;shRz=-.14;elR=.22;shL=-.5-bw*.5;shLz=-.12;elL=1.25;bladeDir=[.08,1,.12];shieldYaw=.45}
      else{/* WALK / RUN: shield pushed forward, blade pointing ahead and up, arms steady */
        shR=-.3-sw*.1;shRz=-.22;elR=.55;shL=-.8+sw*.1;shLz=.06;elL=1.05;bladeDir=[-.05,.55,1];shieldYaw=.2}}
    if(a.dead){shL=-.3;shR=-.2;shLz=1.1;shRz=-1.2;elL=.2;elR=.3}
    if(r.warrior){S.blade=S.blade||new THREE.Vector3(.08,1,.12);S.shy=S.shy??.3;if(bladeDir)S.blade.lerp(_bv.set(bladeDir[0],bladeDir[1],bladeDir[2]),clamp(dt*(a.atk>=0?22:9),0,1));S.shy=ease(S.shy,shieldYaw,clamp(dt*8,0,1));r.aimLater=true}
    const ka=clamp(dt*(a.atk>=0?26:14),0,1);
    r.armL.rotation.x=ease(r.armL.rotation.x,shL,ka);r.armR.rotation.x=ease(r.armR.rotation.x,shR,ka);r.armL.rotation.z=ease(r.armL.rotation.z,shLz,ka);r.armR.rotation.z=ease(r.armR.rotation.z,shRz,ka);
    r.elbowL.rotation.x=ease(r.elbowL.rotation.x,-elL,ka);r.elbowR.rotation.x=ease(r.elbowR.rotation.x,-elR,ka);
    /* wrists follow through a little */
    if(r.handL){r.handL.rotation.x=ease(r.handL.rotation.x,-.15-elL*.1,ka);r.handR.rotation.x=ease(r.handR.rotation.x,-.15-elR*.1,ka)}
    if(r.aimLater){/* world-space aiming of sword & shield: they follow the hand but keep their own heading */
      r.g.updateWorldMatrix(true,true);r.g.getWorldQuaternion(_qRoot);
      if(r.weapon&&r.weapon.parent){r.weapon.parent.getWorldQuaternion(_qP);_qA.setFromUnitVectors(_Y,_bv.copy(S.blade).normalize());r.weapon.quaternion.copy(_qP.invert()).multiply(_qW.copy(_qRoot).multiply(_qA))}
      if(r.shield&&r.shield.parent){r.shield.parent.getWorldQuaternion(_qP);_qA.setFromEuler(_eA.set(.1,S.shy,0));r.shield.quaternion.copy(_qP.invert()).multiply(_qW.copy(_qRoot).multiply(_qA))}}
    /* ---- cape: spring that trails movement and turning ---- */
    if(r.cape){const tgt=.1+am*.75+(a.air?.5:0)+(S.hurt>0?.3:0);const cdt=Math.min(dt,.04);const acc=(tgt-S.capeA)*60-S.capeV*9;S.capeV+=acc*cdt;S.capeA=clamp(S.capeA+S.capeV*cdt,-.2,1.5);r.cape.rotation.x=S.capeA+Math.sin(now*3.1)*.03*(1+am);S.capeZ=ease(S.capeZ,-(a.turn||0)*.35,clamp(dt*6,0,1));r.cape.rotation.z=S.capeZ+Math.sin(now*2.3)*.02}
    /* ---- death ---- */
    const dead=a.dead?1:0;r.body.rotation.x=ease(r.body.rotation.x,dead?-Math.PI/2*.92:0,clamp(dt*5,0,1));r.body.position.y=ease(r.body.position.y,dead?.28:0,clamp(dt*5,0,1));
    if(r.wings)for(const w of r.wings){w.rotation.z=(w.userData.wing>0?-.3:Math.PI+.3)+Math.sin(now*14)*.5*w.userData.wing}
  } else if(r.quad){
    const ph=r.ph,gallop=am>.72;
    r.legs.forEach((l,i)=>{const front=i<2,right=i%2===1;let off=gallop?(front?0:Math.PI*.9)+(right?.35:0):((i===0||i===3)?0:Math.PI);const sw=Math.sin(ph+off)*(gallop?.95:.7)*am;l.rotation.x=ease(l.rotation.x,sw,clamp(dt*18,0,1))});
    const bounce=gallop?Math.max(0,Math.sin(ph))*.16*am:Math.abs(Math.sin(ph))*.05*am;r.body.position.y=ease(r.body.position.y,bounce,clamp(dt*16,0,1));
    r.body.rotation.x=ease(r.body.rotation.x,gallop?Math.cos(ph)*.12*am:0,clamp(dt*12,0,1));
    if(r.tail)r.tail.rotation.y=Math.sin(now*6)*.3+Math.sin(ph)*.2*am;
    S.idle=am<.05?S.idle+dt:0;
    if(a.atk>=0){const p=a.atk;r.head.rotation.x=p<.4?-.6*p/.4:ease(-.6,.35,clamp((p-.4)/.3,0,1));r.body.position.z=p<.5?p*.5:.25-(p-.5)*.5}else{r.head.rotation.x=ease(r.head.rotation.x,-Math.cos(ph)*.08*am+(S.idle>2?Math.sin(now*.7)*.15:0),dt*8);r.body.position.z=ease(r.body.position.z,0,dt*8);r.head.rotation.y=ease(r.head.rotation.y,S.idle>2?Math.sin(now*.5)*.4:0,dt*4)}
    r.body.rotation.z=ease(r.body.rotation.z,a.dead?Math.PI/2.2:0,clamp(dt*6,0,1));
  }
  else if(r.spider){const ph=r.ph*1.4;r.legs.forEach((l,i)=>{const grp=(i%2===0)!==(i<4)?0:Math.PI;const lift=Math.max(0,Math.sin(ph+grp))*.45*am;l.rotation.z=lift;l.rotation.y=(l.userData.by??(l.userData.by=l.rotation.y))+Math.cos(ph+grp)*.22*am});r.body.position.y=Math.sin(ph*2)*.04*am+Math.sin(now*2)*.01;
    if(a.atk>=0){r.body.rotation.x=a.atk<.4?-.4:ease(-.4,0,(a.atk-.4)/.6)}else r.body.rotation.x=ease(r.body.rotation.x,0,dt*8);
    r.body.rotation.z=ease(r.body.rotation.z,a.dead?Math.PI/2.2:0,clamp(dt*6,0,1))}
  if(r.weapon)r.weapon.traverse(m=>{if(m.userData.orb){m.rotation.y+=dt*2;m.material.emissiveIntensity=a.cast?3.5+Math.sin(now*12):2.6}})}
/* class/race appearance for players */
const GEAR_PAL={krijger:[0x9aa2ac,0x6f7680,0xa8875a,0x4a505c,0xb8b0a0],magier:[0x4b3a8c,0x2a5a9a,0x8a2a4a,0x2a6a5a,0xd8d0b8,0x5a2a7a],jager:[0x6b4b2a,0x4a3a22,0x3e5a2a,0x7a5a3a,0x5a4a3a]};
const RCOL=[0,0x2bd94a,0x3b8cff,0xb65cff,0xff8000];
function strHash(t){let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return h>>>0}
function gearCol(it,cls){if(!it)return null;if(it.c!=null)return it.c;const pal=GEAR_PAL[cls]||GEAR_PAL.krijger;const col=new THREE.Color(pal[strHash(String(it.n||it.id||''))%pal.length]);const rc=RCOL[it.r|0];if(rc)col.lerp(new THREE.Color(rc),.08+(it.r|0)*.05);return col.getHex()}
function playerLook(p){/* p: {race,cls,hair,eq}; every equipped slot changes the model */
  const C=CLASSES[p.cls];const R=RACES[p.race];const eq=p.eq||{};const cls=p.cls;
  const ch=eq.borst,hd=eq.hoofd,gl=eq.handen,lg=eq.benen,ft=eq.voeten;
  const best=Math.max(-1,...['borst','hoofd','handen','benen','voeten','wapen'].map(k=>eq[k]?eq[k].r|0:-1));
  const o={cls,eqHead:!!hd,eqChest:!!ch,rar:Math.max(0,best),gear:{hoofd:gearDesc(hd,cls),borst:gearDesc(ch,cls),handen:gearDesc(gl,cls),benen:gearDesc(lg,cls),voeten:gearDesc(ft,cls)},wvis:eq.wapen&&eq.wapen.vis?gearDesc(eq.wapen,cls):null,race:p.race,skin:R.orc?R.hair[p.hair||0]:R.skin,hair:R.orc?0x1c1712:R.hair[p.hair||0],chest:gearCol(ch,cls)??C.chest,pants:gearCol(lg,cls)??C.pants,cape:C.cape,sp:eq.schouders?(eq.schouders.spt||clamp(eq.schouders.r|0,1,4)):0,wt:eq.wapen?eq.wapen.wt:'none',ench:eq.wapen&&eq.wapen.ench||'',awt:C.wt,wr:eq.wapen?eq.wapen.r:0,
    boots:gearCol(ft,cls)??0x3a2818,bootsBig:!!ft,gloves:gearCol(gl,cls),glovesBig:!!gl&&cls==='krijger',legPlate:!!lg&&cls==='krijger',chestMetal:!!ch&&cls==='krijger',trim:best>=2?RCOL[best]:0};
  Object.assign(o,outfitLook(p,cls));
  if(ch&&ch.r>=2){const cc=new THREE.Color(C.cape).lerp(new THREE.Color(RCOL[ch.r]),.35);o.cape=cc.getHex()}
  if(cls==='krijger'){o.warrior=true;o.chest=gearCol(ch,cls)??0xb8864f;o.pants=gearCol(lg,cls)??0x5a5652;o.cape=ch&&ch.r>=2?o.cape:0x262a4c;o.gloves=gearCol(gl,cls)??0x6b4322;if(!o.hair||o.hair===R.hair[0])o.hair=R.hair[p.hair||0]}
  if(cls==='magier'){o.robe=gearCol(ch,cls)??0x3a2a6a;if(ch)o.pads=gearCol(ch,cls);if(hd)o.hat=gearCol(hd,cls)}
  if(cls==='jager'){if(hd)o.hood=gearCol(hd,cls);o.pads=ch?gearCol(ch,cls):null}
  return o}
/* icon painter (2D canvas) */
const iconCache=new Map();
function drawIcon(cv,ic,sz=64){
  const g=cv.getContext('2d');const[k,c1,c2]=ic;const gr=g.createRadialGradient(sz*.35,sz*.3,2,sz/2,sz/2,sz*.75);gr.addColorStop(0,c1);gr.addColorStop(1,c2);g.fillStyle=gr;g.fillRect(0,0,sz,sz);
  if(k&&k.startsWith&&k.startsWith('m:')){/* 3D-miniatuur van een gedownload model */const img=modelIcon(k,cv,ic,sz);if(img){g.drawImage(img,sz*.04,sz*.04,sz*.92,sz*.92);return}if(img===false)return;g.globalAlpha=.35;g.fillStyle='#fff';g.beginPath();g.arc(sz/2,sz/2,sz*.18,0,7);g.fill();g.globalAlpha=1;return}
  g.save();g.scale(sz/64,sz/64);g.lineCap='round';g.lineJoin='round';g.strokeStyle='#fff';g.fillStyle='#fff';g.shadowColor='rgba(0,0,0,.6)';g.shadowBlur=4;g.lineWidth=5;
  const P=(...pts)=>{g.beginPath();g.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i],pts[i+1])};
  if(k==='sword'||k==='zwaard'){P(16,48,46,18);g.stroke();P(12,40,24,52);g.stroke();g.lineWidth=3;P(46,18,50,14);g.stroke()}
  else if(k==='ak'){g.lineWidth=5;P(10,40,50,22);g.stroke();g.lineWidth=7;P(16,38,40,28);g.stroke();g.lineWidth=4;P(14,42,8,52);g.stroke();P(28,34,30,46);g.stroke()}
  else if(k==='bijl'){g.lineWidth=4;P(18,50,44,18);g.stroke();g.beginPath();g.moveTo(36,12);g.quadraticCurveTo(58,18,52,38);g.lineTo(40,24);g.closePath();g.fill()}
  else if(k==='staf'){g.lineWidth=4;P(18,52,42,22);g.stroke();g.beginPath();g.arc(45,18,8,0,7);g.fill()}
  else if(k==='boog'||k==='arrow'){if(k==='boog'){g.lineWidth=4;g.beginPath();g.arc(20,32,24,-1.2,1.2);g.stroke();g.lineWidth=1.5;P(28,10,28,54);g.stroke()}else{g.lineWidth=4;P(12,52,48,16);g.stroke();g.beginPath();g.moveTo(52,12);g.lineTo(38,16);g.lineTo(48,26);g.closePath();g.fill();g.lineWidth=3;P(12,52,10,42);g.stroke();P(12,52,22,54);g.stroke()}}
  else if(k==='charge'){for(let i=0;i<3;i++){P(10+i*14,18,22+i*14,32,10+i*14,46);g.stroke()}}
  else if(k==='whirl'){g.lineWidth=4;g.beginPath();for(let a=0;a<12;a+=.2){const r=4+a*1.9;g.lineTo(32+Math.cos(a)*r,32+Math.sin(a)*r)}g.stroke()}
  else if(k==='shout'){g.beginPath();g.moveTo(14,26);g.lineTo(26,26);g.lineTo(38,14);g.lineTo(38,50);g.lineTo(26,38);g.lineTo(14,38);g.closePath();g.fill();g.lineWidth=3;for(const r of[8,14])g.beginPath(),g.arc(38,32,r+6,-.7,.7),g.stroke()}
  else if(k==='fire'||k==='meteor'){g.beginPath();g.moveTo(32,8);g.quadraticCurveTo(54,30,44,46);g.quadraticCurveTo(32,60,20,46);g.quadraticCurveTo(12,32,26,22);g.quadraticCurveTo(28,32,34,30);g.quadraticCurveTo(38,20,32,8);g.fill();if(k==='meteor'){g.lineWidth=3;P(8,8,20,20);g.stroke();P(16,6,26,16);g.stroke()}g.fillStyle=c1;g.beginPath();g.arc(32,44,7,0,7);g.fill()}
  else if(k==='frost'){g.lineWidth=3.5;for(let i=0;i<3;i++){const a=i*Math.PI/3;P(32+Math.cos(a)*22,32+Math.sin(a)*22,32-Math.cos(a)*22,32-Math.sin(a)*22);g.stroke()}g.lineWidth=2.5;for(let i=0;i<6;i++){const a=i*Math.PI/3,x=32+Math.cos(a)*14,y=32+Math.sin(a)*14;P(x+Math.cos(a+.8)*6,y+Math.sin(a+.8)*6,x,y,x+Math.cos(a-.8)*6,y+Math.sin(a-.8)*6);g.stroke()}}
  else if(k==='blink'){for(let i=0;i<4;i++){g.globalAlpha=.3+i*.23;g.beginPath();g.arc(14+i*11,32,6+i,0,7);g.fill()}g.globalAlpha=1}
  else if(k==='multi'){g.lineWidth=3;for(const dy of[-14,0,14]){P(10,32+dy*.2,50,32+dy);g.stroke();g.beginPath();g.moveTo(54,32+dy);g.lineTo(44,28+dy);g.lineTo(44,36+dy);g.fill()}}
  else if(k==='leap'){g.lineWidth=4;g.beginPath();g.moveTo(50,48);g.quadraticCurveTo(32,4,14,40);g.stroke();g.beginPath();g.moveTo(10,46);g.lineTo(8,32);g.lineTo(20,38);g.fill()}
  else if(k==='rain'){g.lineWidth=2.5;for(let i=0;i<6;i++){const x=12+i*8,y=8+(i%2)*10;P(x,y,x-4,y+22);g.stroke();g.beginPath();g.moveTo(x-5,y+26);g.lineTo(x-7,y+18);g.lineTo(x-1,y+20);g.fill()}}
  else if(k==='potion'){g.beginPath();g.arc(32,40,15,0,7);g.fill();g.fillRect(27,14,10,14);g.fillStyle=c1;g.beginPath();g.arc(32,42,11,0,7);g.fill();g.fillStyle='#8a5a2a';g.fillRect(26,10,12,6)}
  else if(k==='hearth'){g.beginPath();g.ellipse(32,34,16,20,0,0,7);g.fill();g.fillStyle=c2;g.beginPath();g.ellipse(32,34,8,11,0,0,7);g.fill()}
  else if(k==='schouders'){for(const s of[-1,1]){g.beginPath();g.ellipse(32+s*13,34,12,9,s*.35,Math.PI,0);g.lineTo(32+s*24,40);g.lineTo(32+s*2,40);g.closePath();g.fill()}g.fillStyle=c2;g.fillRect(29,26,6,20)}
  else if(k==='hoofd'){g.beginPath();g.arc(32,34,17,Math.PI,0);g.lineTo(49,44);g.lineTo(15,44);g.closePath();g.fill();g.fillStyle=c2;g.fillRect(22,36,20,4)}
  else if(k==='borst'){g.beginPath();g.moveTo(14,16);g.lineTo(26,12);g.lineTo(32,18);g.lineTo(38,12);g.lineTo(50,16);g.lineTo(46,30);g.lineTo(46,52);g.lineTo(18,52);g.lineTo(18,30);g.closePath();g.fill()}
  else if(k==='handen'){g.beginPath();g.roundRect(18,22,26,30,6);g.fill();for(let i=0;i<4;i++){g.beginPath();g.roundRect(18+i*7,10,6,16,3);g.fill()}g.beginPath();g.roundRect(42,28,12,8,4);g.fill()}
  else if(k==='benen'){g.beginPath();g.moveTo(18,12);g.lineTo(46,12);g.lineTo(48,54);g.lineTo(36,54);g.lineTo(32,26);g.lineTo(28,54);g.lineTo(16,54);g.closePath();g.fill()}
  else if(k==='voeten'){g.beginPath();g.moveTo(20,10);g.lineTo(34,10);g.lineTo(34,38);g.lineTo(52,44);g.lineTo(52,54);g.lineTo(18,54);g.closePath();g.fill()}
  else if(k==='ring'){g.lineWidth=6;g.beginPath();g.arc(32,38,14,0,7);g.stroke();g.beginPath();g.moveTo(32,10);g.lineTo(40,20);g.lineTo(32,28);g.lineTo(24,20);g.closePath();g.fill()}
  else if(k==='junk'){g.beginPath();g.moveTo(16,40);g.quadraticCurveTo(20,14,40,16);g.quadraticCurveTo(54,30,44,48);g.quadraticCurveTo(30,56,16,40);g.fill()}
  else if(k==='log'){g.fillStyle=c1;g.beginPath();g.ellipse(32,32,22,10,-.5,0,7);g.fill();g.fillStyle='#e8c890';g.beginPath();g.ellipse(48,22,6,9,-.5,0,7);g.fill();g.strokeStyle='#6a4a2a';g.lineWidth=1.5;g.beginPath();g.ellipse(48,22,3,5,-.5,0,7);g.stroke()}
  else if(k==='ore'){g.fillStyle='#7a7670';g.beginPath();g.moveTo(10,46);g.lineTo(20,20);g.lineTo(42,14);g.lineTo(56,34);g.lineTo(46,52);g.closePath();g.fill();g.fillStyle=c1;for(const[x,y]of[[26,30],[40,26],[36,42]]){g.beginPath();g.moveTo(x,y-7);g.lineTo(x+5,y);g.lineTo(x,y+7);g.lineTo(x-5,y);g.closePath();g.fill()}}
  else if(k==='herb'){g.strokeStyle='#5ab83a';g.lineWidth=3;P(32,56,32,26);g.stroke();P(32,40,20,30);g.stroke();P(32,36,44,26);g.stroke();g.fillStyle=c1;for(const[x,y]of[[32,20],[18,26],[46,22]]){g.beginPath();g.arc(x,y,6,0,7);g.fill()}}
  else if(k==='fish'){g.fillStyle=c1;g.beginPath();g.ellipse(30,32,18,10,0,0,7);g.fill();g.beginPath();g.moveTo(46,32);g.lineTo(58,22);g.lineTo(58,42);g.closePath();g.fill();g.fillStyle='#111';g.beginPath();g.arc(20,30,2.5,0,7);g.fill()}
  else if(k==='meat'){g.fillStyle=c1;g.beginPath();g.ellipse(28,34,16,12,-.4,0,7);g.fill();g.fillStyle='#f0e8d8';g.fillRect(40,18,6,16);g.beginPath();g.arc(43,16,5,0,7);g.fill()}
  else if(k==='plank'){g.fillStyle=c1;for(let i=0;i<3;i++)g.fillRect(10,16+i*12,44,9);g.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<3;i++)g.fillRect(10,23+i*12,44,2)}
  else if(k==='ingot'){g.fillStyle=c1;g.beginPath();g.moveTo(10,44);g.lineTo(20,28);g.lineTo(50,28);g.lineTo(56,44);g.closePath();g.fill();g.fillStyle='rgba(255,255,255,.4)';g.fillRect(22,30,26,4)}
  else if(k==='powder'){g.fillStyle='#d8c8a0';g.beginPath();g.moveTo(14,40);g.quadraticCurveTo(32,58,50,40);g.lineTo(14,40);g.fill();g.fillStyle=c1;g.beginPath();g.ellipse(32,38,14,7,0,0,7);g.fill()}
  else if(k==='food'){g.fillStyle='#e8e0d0';g.beginPath();g.ellipse(32,42,22,8,0,0,7);g.fill();g.fillStyle=c1;g.beginPath();g.ellipse(32,36,14,9,0,0,7);g.fill();g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=2;for(const x of[26,32,38]){P(x,24,x+2,14);g.stroke()}}
  else if(k==='elixir'){g.beginPath();g.moveTo(26,10);g.lineTo(38,10);g.lineTo(38,24);g.lineTo(48,50);g.lineTo(16,50);g.lineTo(26,24);g.closePath();g.fill();g.fillStyle=c1;g.beginPath();g.moveTo(22,36);g.lineTo(42,36);g.lineTo(47,48);g.lineTo(17,48);g.closePath();g.fill()}
  else if(k==='shield'){g.beginPath();g.moveTo(32,8);g.lineTo(52,16);g.quadraticCurveTo(52,44,32,56);g.quadraticCurveTo(12,44,12,16);g.closePath();g.fill();g.fillStyle=c2;g.beginPath();g.moveTo(32,16);g.lineTo(44,21);g.quadraticCurveTo(44,40,32,48);g.closePath();g.fill()}
  else if(k==='skull'){g.beginPath();g.arc(32,28,18,Math.PI*.85,Math.PI*2.15);g.lineTo(42,52);g.lineTo(22,52);g.closePath();g.fill();g.fillStyle=c2;for(const x of[25,39]){g.beginPath();g.arc(x,30,5,0,7);g.fill()}g.beginPath();g.moveTo(32,36);g.lineTo(29,42);g.lineTo(35,42);g.fill();g.fillRect(26,46,2,6);g.fillRect(31,46,2,6);g.fillRect(36,46,2,6)}
  else if(k==='heart'){g.beginPath();g.moveTo(32,54);g.bezierCurveTo(4,34,12,8,32,22);g.bezierCurveTo(52,8,60,34,32,54);g.fill()}
  else if(k==='star'){g.beginPath();for(let i=0;i<10;i++){const r=i%2?10:24,a=-Math.PI/2+i*Math.PI/5;g.lineTo(32+Math.cos(a)*r,33+Math.sin(a)*r)}g.closePath();g.fill()}
  else if(k==='bolt'){g.beginPath();g.moveTo(36,6);g.lineTo(16,36);g.lineTo(30,36);g.lineTo(24,58);g.lineTo(48,26);g.lineTo(34,26);g.closePath();g.fill()}
  else if(k==='eye'){g.beginPath();g.moveTo(6,32);g.quadraticCurveTo(32,6,58,32);g.quadraticCurveTo(32,58,6,32);g.fill();g.fillStyle=c2;g.beginPath();g.arc(32,32,10,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(29,29,3,0,7);g.fill()}
  else if(k==='leaf'){g.beginPath();g.moveTo(12,52);g.quadraticCurveTo(10,12,54,10);g.quadraticCurveTo(52,52,12,52);g.fill();g.strokeStyle=c2;g.lineWidth=2.5;P(14,50,44,20);g.stroke()}
  else if(k==='wing'){g.beginPath();g.moveTo(10,46);g.quadraticCurveTo(20,10,56,10);g.quadraticCurveTo(50,20,46,22);g.quadraticCurveTo(52,26,44,32);g.quadraticCurveTo(46,38,36,40);g.quadraticCurveTo(30,48,10,46);g.fill()}
  else if(k==='clock'){g.lineWidth=5;g.beginPath();g.arc(32,32,20,0,7);g.stroke();g.lineWidth=4;P(32,18,32,32,42,38);g.stroke()}
  else if(k==='class'){g.font='800 34px Cinzel,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(c1==='#c79c6e'?'K':c1==='#69ccf0'?'M':'J',32,34)}
  else{g.font='800 30px serif';g.textAlign='center';g.textBaseline='middle';g.fillText(k[0]||'?',32,34)}
  g.restore();g.strokeStyle='rgba(0,0,0,.6)';g.lineWidth=2;g.strokeRect(1,1,sz-2,sz-2)}
function iconCanvas(ic,sz=64){const c=document.createElement('canvas');c.width=c.height=sz;drawIcon(c,ic,sz);return c}
const itemIcon=it=>{if(it.kind==='mat'){const M=MATS[it.n]||{};if(M.m)return['m:'+M.m+(M.t?'|'+M.t:''),M.r>=2?'#4a3a6a':M.r?'#2a4a6a':'#5a4a3a','#140e0a'];return[M.ic||'junk',M.c1||'#aaa','#1a140e']}if(it.kind==='potion')return['potion',it.pt==='mana'?'#4b8bff':'#ff4b4b',it.pt==='mana'?'#05153d':'#3d0505'];if(it.kind==='junk')return['junk','#9a8a7a','#2a2420'];const rc=['#7a7a7a','#2f8a3a','#2a5aa8','#7a3aa8','#b0661a'][Math.min(it.r||0,4)];return[it.s==='wapen'?it.wt:it.s,'#d8d8d8',rc]};
