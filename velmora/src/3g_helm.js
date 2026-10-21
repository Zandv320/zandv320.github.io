/* ===================== Helmets in the style of the shoulder tiers =====================
   Every helmet is built from the helmets and hats that already sit on the KayKit heads (Knight helmet, Barbarian horned
   hat, Mage hat, Skeleton warrior helmet, Skeleton mage hat, Skeleton rogue hood, bear hat), taken in the space of the
   head bone of the model they came from. All KayKit characters share one skeleton, so the pieces fit every head exactly.
   Pieces are cut, recoloured and combined; tier IV glows (enchanting shell) and sheds sparks, just like the shoulders. */
const HORN=(x,y,z)=>y>.45&&(x<.16||x>.84),HORN2=(x,y,z)=>y>.58&&(x<.12||x>.88);
const HL_DEF={
  /* warrior: only whole helmets, no cut pieces, so every silhouette stays clean */
  krijger:[
    [{f:'Knight',n:'Knight_Helmet',mul:0xe4e8f0}],
    [{f:'outfit/O_Knight',n:'Knight_Helmet',mul:0xd8e0f0},{f:'outfit/O_Knight',n:'Knight_HelmetVisor',mul:0xd8e0f0}],
    [{f:'Skeleton_Warrior',n:'Skeleton_Warrior_Helmet',mul:0xffd468,emi:0x5a3a00,ei:.2}],
    [{f:'Skeleton_Warrior',n:'Skeleton_Warrior_Helmet',flat:0x8a2418,emi:0x5a0a00,ei:.35,glow:0xff5a14,gi:.32}]],
  jager:[
    [{f:'outfit/O_Skeleton_Rogue',n:'Skeleton_Rogue_Hood',flat:0x8a6a48}],
    [{f:'outfit/O_Skeleton_Rogue',n:'Skeleton_Rogue_Hood',flat:0x2f7380},{f:'outfit/O_Rogue_Hooded',n:'RogueHooded_Mask',flat:0x2a2420}],
    [{f:'outfit/O_Barbarian',n:'Barbarian_BearHat'},{f:'outfit/O_Rogue_Hooded',n:'RogueHooded_Mask',flat:0x3a2a1c}],
    [{f:'outfit/O_Barbarian',n:'Barbarian_BearHat',mul:0xc8e8a8,glow:0x5aff2a,gi:.18},{f:'outfit/O_Rogue_Hooded',n:'RogueHooded_Mask',flat:0x1e2a14}]],
  magier:[
    [{f:'Mage',n:'Mage_Hat'}],
    [{f:'Skeleton_Mage',n:'Skeleton_Mage_Hat',flat:0x3a4aa8},{f:'env/Q_Crystal5',n:null,crystal:[.75,1.0,0,.16],col:0x8ae0ff,emi:0x3aa8ff,ei:1.1,orbit:1}],
    [{f:'Mage',n:'Mage_Hat',mul:0x5a7aff},{f:'env/Q_Crystal5',n:null,crystal:[0,1.62,0,.32],col:0x8ae0ff,emi:0x3aa8ff,ei:1.2,spin:1},{f:'env/Q_Crystal5',n:null,crystal:[.85,1.0,0,.17],col:0x8ae0ff,emi:0x3aa8ff,ei:1.2,orbit:1},{f:'env/Q_Crystal5',n:null,crystal:[-.85,1.0,0,.17],col:0x8ae0ff,emi:0x3aa8ff,ei:1.2,orbit:1}],
    [{f:'Mage',n:'Mage_Hat',mul:0x9a6aff,glow:0xb07aff},{f:'env/Q_Crystal5',n:null,crystal:[0,1.68,0,.34],col:0xd8a0ff,emi:0xa04aff,ei:1.4,spin:1},
      {f:'env/Q_Crystal5',n:null,crystal:[.9,1.0,0,.2],col:0xd8a0ff,emi:0xa04aff,ei:1.4,orbit:1},{f:'env/Q_Crystal5',n:null,crystal:[-.45,1.0,.78,.2],col:0xd8a0ff,emi:0xa04aff,ei:1.4,orbit:1},{f:'env/Q_Crystal5',n:null,crystal:[-.45,1.0,-.78,.2],col:0xd8a0ff,emi:0xa04aff,ei:1.4,orbit:1}]]};
const HL_ITEMS={krijger:['Iron Sallet','Visored Greathelm','Gilded Warhelm','Horned Helm of the Ash Queen'],jager:['Leather Hood','Stalker\'s Hood','Bearclaw Cowl','Cowl of the Dire Beast'],magier:['Pointed Hat','Runed Hat','Crystalweave Hat','Starfall Crown']};
const HL_LEG={krijger:{mods:{crit:5,rage:3},leg:'Legendary: +5% critical chance and your attacks grant 3 extra energy. Embers smoulder between the horns.'},
  jager:{mods:{crit:6,exec:.15},leg:'Legendary: +6% critical chance and 15% more damage to enemies below 35% health. The beast still hunts.'},
  magier:{mods:{cdall:.1,critdmg:.15},leg:'Legendary: all cooldowns 10% shorter and critical hits +15% damage. Three falling stars circle your brow.'}};
/* geometry of a model piece in the space of its head bone (float copy first: KayKit meshes are quantized) */
function floatGeo(src){const g=new THREE.BufferGeometry();for(const an of['position','normal','uv','color']){const a=src.attributes[an];if(!a)continue;const it=a.itemSize,f=new Float32Array(a.count*it),gc=['getX','getY','getZ','getW'];for(let i=0;i<a.count;i++)for(let c=0;c<it;c++)f[i*it+c]=a[gc[c]](i);g.setAttribute(an,new THREE.BufferAttribute(f,it))}if(src.index)g.setIndex(src.index.clone());return g}
const _hlGeo=new Map();
function hlPiece(P){const key=P.f+'|'+P.n+'|'+P.keep;let e=_hlGeo.get(key);if(e)return e;
  e=loadGltf(P.f).then(g=>{if(!g)return null;g.scene.updateMatrixWorld(true);let m=null,head=null;g.scene.traverse(o=>{if(o.isMesh&&!m&&(P.n==null||o.name===P.n))m=o;if(o.isBone&&o.name==='head'&&!head)head=o});if(!m)return null;
    let geo=floatGeo(m.geometry);if(geo.index)geo=geo.toNonIndexed();
    if(P.n==null){geo.computeBoundingBox();const b=geo.boundingBox,c=b.getCenter(new THREE.Vector3()),s=b.getSize(new THREE.Vector3());geo.translate(-c.x,-c.y,-c.z);const k=1/Math.max(s.x,s.y,s.z);geo.scale(k,k,k)}
    else{let M;if(m.isSkinnedMesh){const i=m.skeleton.bones.findIndex(b=>b.name==='head');M=new THREE.Matrix4().multiplyMatrices(m.skeleton.boneInverses[i],m.bindMatrix)}else M=new THREE.Matrix4().copy(head.matrixWorld).invert().multiply(m.matrixWorld);geo.applyMatrix4(M)}
    if(P.keep){geo.computeBoundingBox();const bb=geo.boundingBox,sz=bb.getSize(new THREE.Vector3()),Pa=geo.attributes.position,keep=[];
      for(let i=0;i<Pa.count;i+=3){let cx=0,cy=0,cz=0;for(let k=0;k<3;k++){cx+=Pa.getX(i+k);cy+=Pa.getY(i+k);cz+=Pa.getZ(i+k)}if(P.keep((cx/3-bb.min.x)/sz.x,(cy/3-bb.min.y)/sz.y,(cz/3-bb.min.z)/sz.z))keep.push(i)}
      const ng=new THREE.BufferGeometry();for(const an in geo.attributes){const a=geo.attributes[an],it=a.itemSize,arr=new Float32Array(keep.length*3*it);let o=0;for(const i of keep)for(let k=0;k<3;k++)for(let c=0;c<it;c++)arr[o++]=a.array[(i+k)*it+c];ng.setAttribute(an,new THREE.BufferAttribute(arr,it))}geo=ng}
    geo.computeVertexNormals();geo.computeBoundingSphere();return{geo,mat:Array.isArray(m.material)?m.material[0]:m.material}});
  _hlGeo.set(key,e);return e}
async function attachHelm(r,m,o){const tier=clamp(o.hl|0,0,4);if(!tier)return;const cls=HL_DEF[o.cls]?o.cls:'krijger';const D=HL_DEF[cls][tier-1];
  const parts=await Promise.all(D.map(hlPiece));if(!r.m||r.m!==m||parts.some(p=>!p))return;const head=m.getObjectByName('head');if(!head||head.userData.helm)return;head.userData.helm=1;
  /* the old helmet, hat or hood goes; hair is tucked under */
  m.traverse(x=>{if(!x.isMesh||x.userData.helm)return;if(!x.isSkinnedMesh&&/Helmet|Hat|Hood/i.test(x.name))x.visible=false;if(x.userData.outfitSlot==='hoofd')x.visible=false;if(x.isSkinnedMesh&&/_Head(_Hooded)?$/.test(x.name)&&typeof tuckHair==='function')tuckHair(x)});
  const grp=new THREE.Group();grp.userData.helm=1;head.add(grp);r._hl={grp,tier,cls,pts:[],acc:0};
  D.forEach((P,i)=>{const{geo,mat}=parts[i];const mt=mat.clone();if(P.flat!=null){mt.map=null;mt.vertexColors=false;mt.color.setHex(P.flat);mt.needsUpdate=true}if(P.col!=null)mt.color.setHex(P.col);if(P.mul!=null)mt.color.multiply(new THREE.Color(P.mul));if(P.emi!=null){mt.emissive=new THREE.Color(P.emi);mt.emissiveIntensity=P.ei??1}
    const mm=new THREE.Mesh(geo,mt);mm.castShadow=true;mm.userData.helm=1;if(P.sc){mm.scale.setScalar(P.sc);mm.position.y=(1-P.sc)*.55}if(P.dy)mm.position.y+=P.dy;
    if(P.crystal){const[x,y,z,s]=P.crystal;mm.position.set(x,y,z);mm.scale.setScalar(s);if(P.orbit)mm.userData.orbit={a:Math.atan2(z,x),r:Math.hypot(x,z),y}}if(P.spin)mm.userData.spin=1;grp.add(mm);
    if(P.glow&&typeof enchShellMat==='function'){const sh=new THREE.Mesh(geo,enchShellMat(P.glow,.03,P.gi??.5));sh.userData.eglow=1;sh.renderOrder=3;mm.add(sh)}
    if(tier===4)for(let q=0;q<10;q++){const pa=geo.attributes.position,j=Math.floor(Math.random()*pa.count);r._hl.pts.push([mm,pa.getX(j),pa.getY(j),pa.getZ(j)])}})}
const _hlv=new THREE.Vector3();
function helmFx(r,dt){const H=r&&r._hl;if(!H)return;const t=performance.now()*.001;for(const c of H.grp.children){if(c.userData.spin){c.rotation.y+=dt*1.4;c.position.y+=Math.sin(t*2.2)*.0012}const O=c.userData.orbit;if(O){O.a+=dt*.9;c.position.set(Math.cos(O.a)*O.r,O.y+Math.sin(t*2+O.a)*.06,Math.sin(O.a)*O.r);c.rotation.y+=dt*2}}
  if(H.tier<4||!H.pts.length||typeof enchSpark!=='function')return;H.grp.getWorldPosition(_hlv);if(Math.abs(_hlv.x-camTarget.x)+Math.abs(_hlv.z-camTarget.z)>45)return;
  H.acc+=dt*(GFX.q==='laag'?6:12);let n=Math.min(3,Math.floor(H.acc));H.acc-=n;const type=SP_FX[H.cls];
  for(let i=0;i<n;i++){const[mm,x,y,z]=H.pts[Math.floor(Math.random()*H.pts.length)];_hlv.set(x,y,z);mm.localToWorld(_hlv);enchSpark(type,_hlv.x,_hlv.y,_hlv.z,2,ENCH_TYPES[type])}}
/* items: the same bosses as the shoulders; the Ash Queen's legendary helms become tier IV */
function makeHelm(cls,tier){const il=[8,11,15,24][tier-1];const it=makeGear('hoofd',il,Math.min(tier,3),cls);it.r=tier;it.hlt=tier;it.n=HL_ITEMS[cls][tier-1];it.req=Math.max(1,il-1);
  if(tier===4){const L=HL_LEG[cls];it.mods={...L.mods};it.leg=L.leg;it.pow=Math.round((it.pow||0)*1.2+6);it.sta=Math.round((it.sta||0)*1.2+6);it.arm=Math.round((it.arm||0)*1.3);it.price*=2}return it}
const HL_DROPS={grisk:[1,.35],boss:[2,.35],outlawking:[3,.22],ignaroth:[3,.3],lavadrake:[3,.05],vyraxion:[4,.25],oakheart:[4,.22],thornwarden:[3,.28],silkmother:[4,.28]};
function helmDrop(type){const d=HL_DROPS[type];if(!d||Math.random()>d[1])return null;return makeHelm(P.cls,d[0])}
/* which helmet tier an equipped head item shows (0 = the normal outfit) */
function helmTier(it){if(!it)return 0;if(it.hlt)return it.hlt;if(it.leg&&it.s==='hoofd')return 4;return 0}
