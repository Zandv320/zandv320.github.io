/* ===================== Cloaks =====================
   A separate armour slot ('rug', shown as Cloak). The capes are the cape meshes of the downloaded KayKit characters
   (Adventurers 2.0 and Skeletons, CC0). They used to be part of the chest outfits; now the chest only carries the body
   and the cape comes from this slot. Every cape is skinned to the shared Rig_Medium skeleton, so it is bound to the
   wearer's own bones and hangs exactly as on its original character: no gaps, no seams.
   Look per rarity:
     common/uncommon  cape in the item colour, hem a darker shade
     rare             hem in rare blue
     epic             purple hem plus a shoulder mantle (the KayKit skeleton shroud) in the hem colour
     legendary        orange-gold hem, mantle, a faint glow and sparks drifting off the hem */
const CLOAKS=[['O_Mage','Mage_Cape'],['O_Rogue','Rogue_Cape'],['O_Ranger','Ranger_Cape'],['O_Rogue_Hooded','RogueHooded_Cape'],['O_Knight','Knight_Cape']];
const CLOAK_MANTLE=['O_Skeleton_Minion','Skeleton_Minion_Cloak'];
/* per class: which capes a cloak can have */
const CLOAK_CLS={krijger:[4,1],magier:[0,3],jager:[2,1,3]};
function cloakFor(it,cls){if(!it)return null;if(it.ck!=null&&CLOAKS[it.ck])return it.ck;const L=CLOAK_CLS[cls]||CLOAK_CLS.krijger;return L[strHash(String(it.n||it.id||''))%L.length]}
/* which atlas cell carries most of a cape's cloth: that cell takes the item colour, the others are the hem */
const _ckMain=new Map();
function cloakMainCell(geo){let c=_ckMain.get(geo.uuid);if(c)return c;const U=geo.attributes.uv,cnt=new Map();
  if(U)for(let i=0;i<U.count;i++){const k=Math.min(7,Math.floor(U.getX(i)*8))+','+Math.min(7,Math.floor(U.getY(i)*8));cnt.set(k,(cnt.get(k)||0)+1)}
  let best='0,0',bn=-1;for(const[k,n]of cnt)if(n>bn){bn=n;best=k}c=best.split(',').map(Number);_ckMain.set(geo.uuid,c);return c}
/* cloak colours: a cloth palette of its own (the armour palettes are too dark for a big cape); legendaries are fixed */
const CK_PAL=[0xd04848,0x4a78d8,0x4aa858,0x9058c8,0xc89848,0x40a8b0,0xc04888,0x7a8298,0xe0d0b0];
const CK_LEG_COL={krijger:[0xa82820,0xffc050],magier:[0x5a30a8,0xd8a8ff],jager:[0x2a7034,0xe0ff70]};
function cloakTint(it,cls){if((it.r|0)>=4)return(CK_LEG_COL[cls]||CK_LEG_COL.krijger)[0];const pal=(typeof CK_PAL_C!=='undefined'&&CK_PAL_C[cls])||CK_PAL;return it.c!=null?it.c:pal[strHash(String(it.n||it.id||''))%pal.length]}
function cloakColors(o){const r=o.ckr|0;const main=new THREE.Color(o.ckc??0x6a3a8e);/* a cape is seen mostly from behind, in its own shade: keep it light enough to read */const hsl={};main.getHSL(hsl);main.setHSL(hsl.h,Math.min(hsl.s,.62),Math.max(hsl.l,.46));const dark=main.clone().multiplyScalar(.62);
  let hem=dark;if(r>=4)hem=new THREE.Color((CK_LEG_COL[o.cls]||CK_LEG_COL.krijger)[1]);else if(r>=2)hem=dark.clone().lerp(new THREE.Color(RCOL[r]),.5);return[main.getHex(),hem.getHex()]}
/* recolour the cape's atlas cells: every cell keeps its own shading, measured against its brightest pixel, so the
   item colour comes out at full strength instead of being darkened by the dark side of the cell */
const _ckTex=new Map();
function cloakMap(src,mapping,key){const k=src.uuid+'|'+key;let t=_ckTex.get(k);if(t)return t;const img=src.image;const W=img.width||1024,H=img.height||1024,cw=W/8,ch=H/8;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  for(let cy=0;cy<8;cy++)for(let cx=0;cx<8;cx++){const col=mapping(cx,cy);if(col==null)continue;const c=new THREE.Color(col);const d=g.getImageData(cx*cw,cy*ch,cw,ch),p=d.data;let mx=1;
    for(let i=0;i<p.length;i+=4)mx=Math.max(mx,p[i]*.3+p[i+1]*.59+p[i+2]*.11);
    for(let i=0;i<p.length;i+=4){const l=.78+.22*(p[i]*.3+p[i+1]*.59+p[i+2]*.11)/mx;p[i]=Math.min(255,c.r*255*l);p[i+1]=Math.min(255,c.g*255*l);p[i+2]=Math.min(255,c.b*255*l)}g.putImageData(d,cx*cw,cy*ch)}
  t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;t.flipY=src.flipY;t.minFilter=THREE.LinearMipmapLinearFilter;t.anisotropy=4;_ckTex.set(k,t);return t}
function recolorCloak(mesh,cols,key){const mt=mesh.material;if(!mt.map)return;const[mx,my]=cloakMainCell(mesh.geometry);
  mt.map=cloakMap(mt.map,(cx,cy)=>cx===mx&&cy===my?cols[0]:cols[1],key+'|'+cols.join('|'));
  /* a cape mostly shows its back to the camera, away from the sun: a little self-light (its own colours) keeps it from going black */
  mt.emissiveMap=mt.map;mt.emissive=new THREE.Color(0xffffff);mt.emissiveIntensity=.36;mt.needsUpdate=true}
const CK_FX={krijger:'flame',jager:'venom',magier:'shadow'};
async function attachCloak(r,m,o){if(o.ck==null||!CLOAKS[o.ck])return;const[f,n]=CLOAKS[o.ck];const rar=o.ckr|0;
  const[src,msrc]=await Promise.all([outfitSrc(f),rar>=3?outfitSrc(CLOAK_MANTLE[0]):null]);if(!src||!r.m||r.m!==m)return;
  /* the wearer's own cape or shroud makes way */
  m.traverse(x=>{if(x.isMesh&&!x.userData.outfit&&/_Cape$|_Cloak$/.test(x.name))x.visible=false});
  const cols=cloakColors(o);const c=partClone(m,src,n,Math.min(rar,3),new Map(),null);if(!c)return;c.userData.cloak=1;recolorCloak(c,cols,n);
  const S={cape:c,pts:[],acc:0,cls:o.cls,rar};r._ck=S;
  if(msrc){const mc=partClone(m,msrc,CLOAK_MANTLE[1],Math.min(rar,3),new Map(),null);if(mc){mc.userData.cloak=1;recolorCloak(mc,[cols[1],cols[0]],'mantle');S.mantle=mc}}
  if(rar>=4){c.material.emissiveIntensity=.42;
    /* spark points: hem vertices (the lowest part of the cape) */const P=c.geometry.attributes.position;let lo=1e9,hi=-1e9;for(let i=0;i<P.count;i++){lo=Math.min(lo,P.getY(i));hi=Math.max(hi,P.getY(i))}
    for(let i=0;i<P.count;i++)if(P.getY(i)<lo+(hi-lo)*.3)S.pts.push(i)}}
/* per frame: legendary cloaks shed sparks from the hem */
const _ckv=new THREE.Vector3();
function cloakFx(r,dt){const S=r&&r._ck;if(!S||S.rar<4||!S.pts.length||typeof enchSpark!=='function')return;const c=S.cape;if(!c.parent)return;
  c.getWorldPosition(_ckv);if(Math.abs(_ckv.x-camTarget.x)+Math.abs(_ckv.z-camTarget.z)>45)return;
  S.acc+=dt*(GFX.q==='laag'?5:10);let n=Math.min(3,Math.floor(S.acc));S.acc-=n;const type=CK_FX[S.cls]||'flame';
  for(let k=0;k<n;k++){const i=S.pts[Math.floor(Math.random()*S.pts.length)];_ckv.fromBufferAttribute(c.geometry.attributes.position,i);c.applyBoneTransform(i,_ckv);_ckv.applyMatrix4(c.matrixWorld);
    enchSpark(type,_ckv.x,_ckv.y,_ckv.z,1,ENCH_TYPES[type])}}
/* ---- legendary cloaks, dropped by the great bosses ---- */
const CK_LEG={krijger:{n:'Warbanner of the Ash Queen',mods:{critdmg:.08},leg:'Legendary: critical hits deal 8% extra damage. The hem still smoulders.'},
  jager:{n:'Cloak of the Dire Beast',mods:{haste:.04},leg:'Legendary: +4% attack speed. Venom drips from the hem.'},
  magier:{n:'Shroud of Falling Stars',mods:{mpp:.06},leg:'Legendary: 6% more mana. Shadows trail behind you.'}};
function makeCloak(cls,r){const il=[8,10,13,17,24][clamp(r,0,4)];const it=makeGear('rug',il,Math.min(r,3),cls);it.r=r;
  if(r>=4){const L=CK_LEG[cls]||CK_LEG.krijger;it.n=L.n;it.mods={...L.mods};it.leg=L.leg;it.pow=Math.round((it.pow||0)*1.2+4);it.sta=Math.round((it.sta||0)*1.2+4);it.arm=Math.round((it.arm||0)*1.3);it.price*=2}return it}
const CK_DROPS={vyraxion:.2,oakheart:.18,lavadrake:.05,silkmother:.25};
function cloakDrop(type){const p=CK_DROPS[type];if(!p||Math.random()>p)return null;return makeCloak(P.cls,4)}
