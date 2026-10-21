/* ===================== Shoulder pads =====================
   A new armour slot. Every pad is built from pieces of the downloaded models (KayKit shields and helmets, the outfit
   pack's bear hat and wizard hat, Quaternius crystals): a piece is cut out of a model (by a part of its bounding box),
   scaled, recoloured and stacked. Four tiers per class, small and plain up to huge and glowing:
     warrior: steel cap → crested plate → gilded spike-plate → horned Ash Queen plate with embers
     hunter:  leather wrap → hide shield-wrap → bear-head mantle → Dire Beast mantle with venom
     mage:    cloth collar → banded collar → collar with a floating crystal → Starfall mantle with three crystals
   Pads hang on the chest bone, at the shoulder joints. Tier IV glows with the enchanting shell and sheds sparks. */
const SP_DEF={
  krijger:[
    [{f:'outfit/O_Knight',n:'Knight_HelmetVisor',keep:(x,y,z)=>y>.38,s:[.44,.32,.44],mul:0xf0f2f8}],
    [{f:'Knight',n:'Round_Shield',keep:()=>true,s:[.5,.42,.5],p:[0,-.02,0]},{f:'outfit/O_Knight',n:'Knight_HelmetVisor',keep:(x,y,z)=>y>.38,s:[.44,.34,.44],p:[0,.04,0],mul:0xf0f2f8}],
    [{f:'Knight',n:'Spike_Shield',keep:()=>true,s:[.6,.6,.6],p:[0,-.02,0]},{f:'outfit/O_Knight',n:'Knight_HelmetVisor',keep:(x,y,z)=>y>.38,s:[.48,.36,.48],p:[0,.06,0],mul:0xf0c860}],
    [{f:'Knight',n:'Spike_Shield',keep:()=>true,s:[.58,.6,.58],p:[0,-.03,0],mul:0x6a2a20},{f:'Skeleton_Warrior',n:'Skeleton_Warrior_Helmet',keep:(x,y,z)=>y>.35,s:[.6,.5,.6],p:[0,.05,0],mul:0x8a3a2a,glow:0xff5a14}]],
  jager:[
    [{f:'Barbarian',n:'Barbarian_Round_Shield',keep:()=>true,s:[.36,.26,.36],mul:0xb08058},{f:'outfit/O_Ranger',n:'Ranger_Body',keep:(x,y,z)=>y>.72,s:[.34,.3,.34],p:[0,.03,0],mul:0xc89a6a}],
    [{f:'Barbarian',n:'Barbarian_Round_Shield',keep:()=>true,s:[.36,.3,.36],mul:0x9a7048,p:[0,-.02,0]},{f:'outfit/O_Ranger',n:'Ranger_Body',keep:(x,y,z)=>y>.72,s:[.38,.38,.38],p:[0,.03,0]}],
    [{f:'Barbarian',n:'Barbarian_Round_Shield',keep:()=>true,s:[.4,.34,.4],mul:0x7a5a3a,p:[0,-.02,0]},{f:'outfit/O_Barbarian',n:'Barbarian_BearHat',keep:(x,y,z)=>y>.3,s:[.46,.38,.46],p:[0,.05,0],r:[0,-1.57,0]}],
    [{f:'Knight',n:'Spike_Shield',keep:()=>true,s:[.55,.5,.55],p:[0,-.05,0],mul:0x3a4a2a},{f:'outfit/O_Barbarian',n:'Barbarian_BearHat',keep:()=>true,s:[.62,.56,.62],r:[0,-1.57,0],mul:0x6a7a52,glow:0x5aff2a}]],
  /* mage: whole wizard hats, squashed into closed conical mantles (no cut edges); higher tiers stack a second
     layer and carry crystals */
  magier:[
    [{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.34,.15,.34],flat:0xd9ccae},{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.36,.035,.36],p:[0,-.005,0],flat:0x8a6a48}],
    [{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.4,.1,.4],flat:0x2a3a8a},{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.29,.15,.29],p:[0,.05,0],flat:0x5a7ad8}],
    [{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.42,.11,.42],flat:0xd8a840,emi:0x4a3000,ei:.6},{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.31,.16,.31],p:[0,.055,0],flat:0x3a58d0},{f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.07,.1,.07],p:[0,.2,0],col:0x8ae0ff,emi:0x3aa8ff,ei:1.2,spin:1}],
    [{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.48,.12,.48],flat:0x3a1a6a},{f:'Mage',n:'Mage_Hat',keep:()=>true,ds:1,s:[.36,.19,.36],p:[0,.06,0],flat:0x8a5ae8,glow:0xb07aff},{f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.08,.12,.08],p:[0,.24,0],col:0xd8a0ff,emi:0xa04aff,ei:1.4,spin:1},
      {f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.055,.08,.055],p:[.05,.2,.17],col:0xd8a0ff,emi:0xa04aff,ei:1.4,spin:1},{f:'env/Q_Crystal5',n:null,keep:()=>true,s:[.055,.08,.055],p:[.05,.2,-.17],col:0xd8a0ff,emi:0xa04aff,ei:1.4,spin:1}]]};
const SP_FX={krijger:'flame',jager:'venom',magier:'shadow'};
/* placement per tier: outward from the shoulder joint, height, tilt (all in metres for a human, scaled with the rig) */
/* the mage's mantles sit lower and further out: they drape over the arm instead of rising beside the head */
const SP_FIT_C={magier:[{x:.25,y:-.035,t:.95},{x:.255,y:-.03,t:.92},{x:.26,y:-.025,t:.9},{x:.27,y:-.02,t:.86}]};
const SP_FIT=[{x:.21,y:.05,t:.72},{x:.22,y:.055,t:.7},{x:.23,y:.06,t:.64},{x:.24,y:.065,t:.58}];
/* a cut-out piece of a downloaded model, normalised to width 1 with its base at y=0 (cached per piece) */
const _spGeo=new Map();
function spPiece(P){const key=P.f+'|'+P.n+'|'+P.keep;let e=_spGeo.get(key);if(e)return e;
  e=loadGltf(P.f).then(g=>{if(!g)return null;let m=null;g.scene.traverse(o=>{if(o.isMesh&&!m&&(P.n==null||o.name===P.n))m=o});if(!m)return null;g.scene.updateMatrixWorld(true);
    let geo=P.ds?floatGeo(m.geometry):m.geometry.clone();if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(m.isSkinnedMesh?m.bindMatrix:m.matrixWorld);for(const a of['skinIndex','skinWeight'])if(geo.attributes[a])geo.deleteAttribute(a);
    geo.computeBoundingBox();const bb=geo.boundingBox,sz=bb.getSize(new THREE.Vector3());const Pa=geo.attributes.position,keep=[];
    for(let i=0;i<Pa.count;i+=3){let cx=0,cy=0,cz=0;for(let k=0;k<3;k++){cx+=Pa.getX(i+k);cy+=Pa.getY(i+k);cz+=Pa.getZ(i+k)}if(P.keep((cx/3-bb.min.x)/sz.x,(cy/3-bb.min.y)/sz.y,(cz/3-bb.min.z)/sz.z))keep.push(i)}
    const ng=new THREE.BufferGeometry(),gc=['getX','getY','getZ','getW'];for(const an in geo.attributes){const a=geo.attributes[an],it=a.itemSize,arr=new Float32Array(keep.length*3*it);let o=0;for(const i of keep)for(let k=0;k<3;k++)for(let c=0;c<it;c++)arr[o++]=a[gc[c]](i+k);ng.setAttribute(an,new THREE.BufferAttribute(arr,it))}
    ng.computeBoundingBox();const b2=ng.boundingBox,c2=b2.getCenter(new THREE.Vector3()),s2=b2.getSize(new THREE.Vector3());const k=1/Math.max(s2.x,s2.z);ng.translate(-c2.x,-b2.min.y,-c2.z);ng.scale(k,k,k);ng.computeVertexNormals();ng.computeBoundingSphere();
    return{geo:ng,mat:Array.isArray(m.material)?m.material[0]:m.material}});
  _spGeo.set(key,e);return e}
const SP_REF=.769;/* scale of the human rig: the sizes above are metres on that rig */
async function attachShoulders(r,m,o){const tier=clamp(o.sp|0,0,4);if(!tier)return;const cls=SP_DEF[o.cls]?o.cls:'krijger';const D=SP_DEF[cls][tier-1],F=(SP_FIT_C[cls]||SP_FIT)[tier-1];
  const parts=await Promise.all(D.map(spPiece));if(!r.m||r.m!==m||parts.some(p=>!p))return;
  m.updateMatrixWorld(true);const toM=new THREE.Matrix4().copy(m.matrixWorld).invert();const chest=m.getObjectByName('chest');if(!chest)return;
  const cp=chest.getWorldPosition(new THREE.Vector3()).applyMatrix4(toM);const k=1/SP_REF;r._sp={pads:[],tier,cls,pts:[],acc:0};
  for(const bn of['upperarml','upperarmr']){const bone=m.getObjectByName(bn);if(!bone)continue;const sp=bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(toM);
    const out=new THREE.Vector3().subVectors(sp,cp).setY(0).normalize();sp.addScaledVector(out,F.x*k);sp.y+=F.y*k;
    const up=new THREE.Vector3(0,1,0),Y=up.clone().multiplyScalar(Math.cos(F.t)).addScaledVector(out,Math.sin(F.t)).normalize(),Fw=new THREE.Vector3(0,0,1);const Z=Fw.addScaledVector(Y,-Fw.dot(Y)).normalize(),X=new THREE.Vector3().crossVectors(Y,Z);
    const padM=new THREE.Matrix4().makeBasis(X,Y,Z).setPosition(sp).scale(new THREE.Vector3(k,k,k));
    /* hung on the chest bone: the joint position is measured in the bind pose, where the arms point sideways */const boneM=new THREE.Matrix4().multiplyMatrices(toM,chest.matrixWorld);const loc=new THREE.Matrix4().copy(boneM).invert().multiply(padM);
    const pad=new THREE.Group();pad.userData.shoulder=1;loc.decompose(pad.position,pad.quaternion,pad.scale);
    D.forEach((P,i)=>{const{geo,mat}=parts[i];const mt=mat.clone();if(P.col!=null)mt.color.setHex(P.col);if(P.mul!=null)mt.color.multiply(new THREE.Color(P.mul));if(P.flat!=null){mt.map=null;mt.color.setHex(P.flat)}if(P.ds)mt.side=THREE.DoubleSide;if(P.emi!=null){mt.emissive=new THREE.Color(P.emi);mt.emissiveIntensity=P.ei??1}
      const mm=new THREE.Mesh(geo,mt);mm.castShadow=true;mm.scale.set(...P.s);if(P.p)mm.position.set(...P.p);if(P.r)mm.rotation.set(...P.r);if(P.spin)mm.userData.spin=1;pad.add(mm);
      if(P.glow&&typeof enchShellMat==='function'){const sh=new THREE.Mesh(geo,enchShellMat(P.glow,.03,.45));sh.userData.eglow=1;sh.renderOrder=3;mm.add(sh)}
      if(tier===4)for(let q=0;q<8;q++){const pa=geo.attributes.position,j=Math.floor(Math.random()*pa.count);r._sp.pts.push([mm,pa.getX(j),pa.getY(j),pa.getZ(j)])}});
    chest.add(pad);r._sp.pads.push(pad)}}
/* per frame: spinning crystals and, for tier IV, sparks */
const _spv=new THREE.Vector3();
function shoulderFx(r,dt){const S=r&&r._sp;if(!S)return;for(const p of S.pads)for(const c of p.children)if(c.userData.spin){c.rotation.y+=dt*1.6;c.position.y+=Math.sin(performance.now()*.003+c.position.x*9)*.0006}
  if(S.tier<4||!S.pts.length||typeof enchSpark!=='function')return;S.pads[0].getWorldPosition(_spv);if(Math.abs(_spv.x-camTarget.x)+Math.abs(_spv.z-camTarget.z)>45)return;
  S.acc+=dt*(GFX.q==='laag'?8:16);let n=Math.min(4,Math.floor(S.acc));S.acc-=n;const type=SP_FX[S.cls];
  for(let i=0;i<n;i++){const[m,x,y,z]=S.pts[Math.floor(Math.random()*S.pts.length)];_spv.set(x,y,z);m.localToWorld(_spv);enchSpark(type,_spv.x,_spv.y,_spv.z,2,ENCH_TYPES[type])}}
/* ---- the items: every tier comes from a boss ---- */
const SP_ITEMS={
  krijger:['Iron Pauldrons','Crested Steel Pauldrons','Gilded Spikeplate','Pauldrons of the Ash Queen'],
  jager:['Leather Spaulders','Hide-bound Spaulders','Bearclaw Mantle','Mantle of the Dire Beast'],
  magier:['Linen Mantle','Runed Mantle','Crystalweave Mantle','Starfall Mantle']};
const SP_LEG={krijger:{mods:{critdmg:.12,dr:.04},leg:'Legendary: critical hits deal 12% extra damage and you take 4% less damage. Embers of the Ash Queen cling to the plate.'},
  jager:{mods:{haste:.06,exec:.12},leg:'Legendary: +6% attack speed and 12% more damage to enemies below 35% health. The beast\'s venom never dries.'},
  magier:{mods:{mpp:.1,crit:4},leg:'Legendary: 10% more mana and +4% critical chance. Three crystals of falling stars circle your shoulders.'}};
function makeShoulders(cls,tier){const il=[8,11,15,24][tier-1],r=[1,2,3,4][tier-1];const it=makeGear('schouders',il,Math.min(r,3),cls);it.r=r;it.spt=tier;it.n=SP_ITEMS[cls][tier-1];it.req=Math.max(1,il-1);
  if(tier===4){const L=SP_LEG[cls];it.mods={...L.mods};it.leg=L.leg;it.pow=Math.round((it.pow||0)*1.2+6);it.sta=Math.round((it.sta||0)*1.2+6);it.arm=Math.round((it.arm||0)*1.3);it.price*=2}return it}
/* which boss drops which tier, and how often */
const SP_DROPS={grisk:[1,.4],boss:[2,.4],outlawking:[3,.25],ignaroth:[3,.35],lavadrake:[3,.06],vyraxion:[4,.3],oakheart:[4,.25]};
function shoulderDrop(type){const d=SP_DROPS[type];if(!d||Math.random()>d[1])return null;return makeShoulders(P.cls,d[0])}
