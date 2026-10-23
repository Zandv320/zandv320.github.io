/* ===================== Player housing: your own house, anywhere in the world =====================
   Buy a deed from Master Builder Orla (Artisans' Yard, Silverbrook), walk to any open spot in Velmora, the Dragon Realm,
   Elvia or on an island of the Rift, and place your house there. Three sizes: Cottage, House, Manor (upgrade at Orla).
   Inside you decorate freely: furniture bought from the catalogue, and statues of every great foe you have slain.
   Other players see your house while you are online, and can knock and walk in; the inside is sent to them by you.
   Models: KayKit Medieval Hexagon (the houses), KayKit Furniture Bits and Quaternius Ultimate House Interior (CC0).
   Data on the character: P.house={t,c,placed,x,z,ry,items:[[kind,lx,lz,ry],...]}, P.furn={kind:count} (bought but
   not placed), P.trophies=[monster types]. Inside coordinates are local to the room: x right, z towards the door. */
const HOUSE_TIERS=[
  {n:'Cottage',m:'home_A',s:9,fp:[.8,.86],price:600,lvl:10,max:25,room:[13,11]},
  {n:'House',m:'home_B',s:9.5,fp:[.88,1.1],price:3000,lvl:25,max:45,room:[17,14]},
  {n:'Manor',m:'tavern',s:9.5,fp:[1.17,1.33],price:12000,lvl:40,max:80,room:[24,18]}];
const HOUSE_COLS=['blue','green','red','yellow'];
const houseModel=(t,c)=>'H_'+HOUSE_TIERS[t].m+'_'+(HOUSE_TIERS[t].m==='tavern'?'red':HOUSE_COLS.includes(c)?c:'blue');
const houseFoot=t=>{const T=HOUSE_TIERS[t];return[T.fp[0]*T.s,T.fp[1]*T.s]};
/* furniture: model, scale, price, collision radius, wall = hangs on the nearest wall at height y */
const FURN={
  bed:{n:'Double Bed',m:'K_bed_double_A',s:.8,p:120,r:1.3,cat:'Bedroom'},bedsingle:{n:'Single Bed',m:'K_bed_single_A',s:.8,p:70,r:1,cat:'Bedroom'},
  bedking:{n:'Royal Bed',m:'Q_BedKing',s:.85,p:400,r:1.6,cat:'Bedroom'},bunk:{n:'Bunk Bed',m:'Q_BunkBed',s:.78,p:150,r:1.4,cat:'Bedroom'},
  nightstand:{n:'Night Stand',m:'Q_NightStand',s:.7,p:30,r:.4,cat:'Bedroom'},drawer:{n:'Chest of Drawers',m:'Q_Drawer',s:.7,p:90,r:1,cat:'Bedroom'},
  table:{n:'Table',m:'K_table_medium',s:.8,p:50,r:.9,cat:'Living'},tablelong:{n:'Long Table',m:'K_table_medium_long',s:.8,p:80,r:1.2,cat:'Living'},
  tablesmall:{n:'Small Table',m:'K_table_small',s:.8,p:25,r:.5,cat:'Living'},tablelow:{n:'Low Table',m:'K_table_low',s:.8,p:40,r:.9,cat:'Living'},
  tableround:{n:'Banquet Table',m:'Q_TableRound',s:.7,p:200,r:1.4,cat:'Living'},
  chair:{n:'Wooden Chair',m:'K_chair_A_wood',s:.8,p:20,r:.4,cat:'Living'},chair2:{n:'High-backed Chair',m:'K_chair_B_wood',s:.8,p:25,r:.4,cat:'Living'},
  stool:{n:'Stool',m:'K_chair_stool_wood',s:.8,p:10,r:.35,cat:'Living'},armchair:{n:'Armchair',m:'K_armchair',s:.8,p:90,r:.8,cat:'Living'},
  couch:{n:'Couch',m:'K_couch',s:.8,p:150,r:1.2,cat:'Living'},couchlarge:{n:'Grand Sofa',m:'Q_CouchLarge',s:.6,p:300,r:1.6,cat:'Living'},
  cabinet:{n:'Cabinet',m:'K_cabinet_medium',s:.8,p:60,r:.8,cat:'Storage'},cabinetsmall:{n:'Small Cabinet',m:'K_cabinet_small',s:.8,p:35,r:.5,cat:'Storage'},
  cabinetdeco:{n:'Dresser with Trinkets',m:'K_cabinet_medium_decorated',s:.8,p:110,r:.8,cat:'Storage'},
  shelf:{n:'Wall Shelf',m:'K_shelf_A_big',s:.9,p:30,r:0,wall:1,y:1.6,cat:'Storage'},shelfbooks:{n:'Bookshelf',m:'K_shelf_B_large_decorated',s:.9,p:80,r:0,wall:1,y:1.2,cat:'Storage'},
  shelfsmall:{n:'Small Bookshelf',m:'K_shelf_B_small_decorated',s:.9,p:45,r:0,wall:1,y:1.3,cat:'Storage'},shelflarge:{n:'Tall Shelves',m:'Q_ShelfLarge',s:.62,p:160,r:1,cat:'Storage'},
  rug:{n:'Rug',m:'K_rug_rectangle_A',s:.9,p:30,r:0,cat:'Decor'},rugstripes:{n:'Striped Rug',m:'K_rug_rectangle_stripes_A',s:.9,p:35,r:0,cat:'Decor'},
  rugoval:{n:'Oval Rug',m:'K_rug_oval_A',s:.9,p:35,r:0,cat:'Decor'},ruground:{n:'Round Rug',m:'Q_RoundRug',s:.9,p:40,r:0,cat:'Decor'},
  lamp:{n:'Standing Lamp',m:'K_lamp_standing',s:.75,p:45,r:.35,cat:'Decor',glow:1},lamptable:{n:'Table Lamp',m:'K_lamp_table',s:.6,p:25,r:.3,cat:'Decor',glow:1},
  lightstand:{n:'Candelabrum',m:'Q_LightStand',s:.65,p:70,r:.4,cat:'Decor',glow:1},chandelier:{n:'Chandelier',m:'Q_Chandelier',s:1.4,p:250,r:0,cat:'Decor',glow:1,hang:3.6},
  painting:{n:'Painting',m:'K_pictureframe_large_A',s:.9,p:60,r:0,wall:1,y:1.9,cat:'Decor'},paintingwide:{n:'Wide Painting',m:'K_pictureframe_large_B',s:.9,p:90,r:0,wall:1,y:1.9,cat:'Decor'},
  portrait:{n:'Portrait',m:'K_pictureframe_medium',s:.9,p:40,r:0,wall:1,y:1.9,cat:'Decor'},frame:{n:'Standing Frame',m:'K_pictureframe_standing_A',s:.8,p:20,r:0,cat:'Decor'},
  curtains:{n:'Curtains',m:'Q_Curtains',s:.55,p:60,r:0,wall:1,y:0,cat:'Decor'},books:{n:'Stack of Books',m:'K_book_set',s:.8,p:15,r:0,cat:'Decor'},
  plant:{n:'Cactus',m:'K_cactus_medium_A',s:.8,p:20,r:.35,cat:'Decor'},houseplant:{n:'Houseplant',m:'Q_Houseplant',s:2.6,p:20,r:.3,cat:'Decor'},
  pillow:{n:'Cushion',m:'K_pillow_A',s:.9,p:8,r:0,cat:'Decor'},column:{n:'Stone Pedestal',m:'Q_Column',s:.7,p:120,r:.6,cat:'Decor'},
  bathtub:{n:'Bathtub',m:'Q_Bathtub',s:.7,p:180,r:1.1,cat:'Bedroom'},
  /* from the game's own packs */
  chest:{n:'Treasure Chest',m:'D_Chest_Gold',s:1.3,p:150,r:.6,cat:'Storage',env:1},barrel:{n:'Barrel',m:'H_barrel',s:3,p:20,r:.5,cat:'Storage',env:1},
  crates:{n:'Crates',m:'H_crate_A_big',s:3,p:25,r:.7,cat:'Storage',env:1},weaponrack:{n:'Weapon Rack',m:'H_weaponrack',s:3,p:120,r:.7,cat:'Decor',env:1},
  coins:{n:'Pile of Gold',m:'D_Coin_Pile',s:2,p:500,r:.4,cat:'Decor',env:1}};
/* trophies: a bronze statue of every great foe you have slain (free, one of each) */
const TROPHIES=['boss','ignaroth','vyraxion','silkmother','outlawking','oakheart','grimshard','colossus','vashk','morvane','xalthuun','korvax','ilvaya','nyxathar','grakkus','sareth','ghorzul','vorthax'];
const furnDef=k=>k.startsWith('T:')?{n:'Statue: '+(MON[k.slice(2)]?MON[k.slice(2)].n:'?'),r:.8,trophy:k.slice(2),cat:'Trophies'}:FURN[k];
function houseInit(){if(!P)return;if(P.house&&!HOUSE_TIERS[P.house.t])P.house=null;if(P.house){P.house.items=Array.isArray(P.house.items)?P.house.items.filter(i=>Array.isArray(i)&&furnDef(i[0])):[]}P.furn=P.furn&&typeof P.furn==='object'?P.furn:{};P.trophies=Array.isArray(P.trophies)?P.trophies:[]}
function houseTrophy(m){if(!P||!TROPHIES.includes(m.type)||(P.trophies||[]).includes(m.type))return;P.trophies=P.trophies||[];P.trophies.push(m.type);log('Trophy earned: a statue of '+esc(m.t.n)+' for your house!','loot',true)}
/* ---------- houses in the world (yours and those of players online) ---------- */
const PHOUSES=new Map();/* key -> {key,owner,name,x,z,ry,t,c,obj,label,mine} */
const _hq=new THREE.Vector3();
function houseLabel(text){const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.font='bold 44px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.lineWidth=8;g.strokeStyle='rgba(30,16,4,.85)';g.strokeText(text,256,48);g.fillStyle='#ffe8b0';g.fillText(text,256,48);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthWrite:false,transparent:true}));s.scale.set(6,1.1,1);s.userData.dyn=1;return s}
function houseDoor(h){const[w,d]=houseFoot(h.t);const dz=d/2+1.2;return{x:h.x+Math.sin(h.ry)*dz,z:h.z+Math.cos(h.ry)*dz}}
function houseSync(key,rec){let H=PHOUSES.get(key);
  if(H&&(H.x!==rec.x||H.z!==rec.z||H.ry!==rec.ry||H.t!==rec.t||H.c!==rec.c)){houseRemove(key);H=null}
  if(H)return H;H={key,...rec,obj:null,label:null};PHOUSES.set(key,H);
  const y=groundH(rec.x,rec.z);const T=HOUSE_TIERS[rec.t];
  if(window.__NOGLTF){const[w,d]=houseFoot(rec.t);H.obj=mesh(new THREE.BoxGeometry(w,T.s*.8,d),mat(0xd8cbb0,{tex:'plaster'}),rec.x,y+T.s*.4,rec.z);H.obj.rotation.y=rec.ry}
  else envPlace(houseModel(rec.t,rec.c),rec.x,rec.z,rec.ry,()=>[T.s,T.s,T.s]).then(o=>{if(!o)return;if(PHOUSES.get(key)!==H){scene.remove(o);return}o.userData.dyn=1;o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});H.obj=o});
  const dr=houseDoor(H);H.label=houseLabel(rec.name+(rec.name.endsWith('s')?"'":"'s")+' '+T.n);H.label.position.set(dr.x,y+T.s*.55+1.5,dr.z);scene.add(H.label);
  /* a flat patch of ground and a little path in front of the door */
  H.path=mesh(new THREE.CircleGeometry(2.2,20).rotateX(-Math.PI/2),mat(0x9a8a6a,{tex:'cobble'}),dr.x,groundH(dr.x,dr.z)+.05,dr.z);H.path.userData.dyn=1;H.path.receiveShadow=true;
  return H}
function houseRemove(key){const H=PHOUSES.get(key);if(!H)return;if(H.obj)scene.remove(H.obj);if(H.label)scene.remove(H.label);if(H.path)scene.remove(H.path);PHOUSES.delete(key)}
/* walk round a house, not through it (an oriented box, a little smaller than the model) */
function houseCollide(p,r){for(const H of PHOUSES.values()){const[w,d]=houseFoot(H.t);const hw=w*.44,hd=d*.44;const dx=p.x-H.x,dz=p.z-H.z;if(Math.abs(dx)>hw+hd+r+2||Math.abs(dz)>hw+hd+r+2)continue;
  const c=Math.cos(H.ry),s=Math.sin(H.ry);let lx=dx*c-dz*s,lz=dx*s+dz*c;const qx=clamp(lx,-hw,hw),qz=clamp(lz,-hd,hd);let ex=lx-qx,ez=lz-qz;const dd=Math.hypot(ex,ez);
  if(dd>1e-6){if(dd>=r)continue;lx=qx+ex/dd*r;lz=qz+ez/dd*r}else{const m=Math.min(hw-lx,hw+lx,hd-lz,hd+lz);if(m===hw-lx)lx=hw+r;else if(m===hw+lx)lx=-hw-r;else if(m===hd-lz)lz=hd+r;else lz=-hd-r}
  p.x=H.x+lx*c+lz*s;p.z=H.z-lx*s+lz*c}}
/* may a house of tier t stand here? '' = yes, else the reason */
function houseSpotWhy(x,z,ry,t){if(x>700)return'You can only build outdoors';if(x<-5000&&!inRift(x))return'You cannot build here';
  if(overTown(x,z)||inDrk(x)&&Math.hypot(x-DRK_CAMP.x,z-DRK_CAMP.z)<55||inRift(x)&&Math.hypot(x-RW.x,z-RW.z)<75)return'Too close to a town or camp';
  if(Math.hypot(x-CRAFT.x,z-CRAFT.z)<CRAFT.r+12||Math.hypot(x-ARENA.x,z-ARENA.z)<55||Math.hypot(x-CAMP.x,z-CAMP.z)<40)return'Too close to a town or camp';
  for(const n of NPCOBJ)if(Math.hypot(n.x-x,n.z-z)<22)return'Too close to '+n.n;
  for(const g of[CRYPT,CAVE,typeof HOLLOW!=='undefined'?HOLLOW:null,typeof RIFT_GATE!=='undefined'?RIFT_GATE:null,typeof SANCTUM_GATE!=='undefined'?SANCTUM_GATE:null,typeof CITADEL_GATE!=='undefined'?CITADEL_GATE:null])if(g&&Math.hypot(g.x-x,g.z-z)<25)return'Too close to a gate';
  for(const H of PHOUSES.values()){if(H.mine)continue;if(Math.hypot(H.x-x,H.z-z)<22)return'Too close to another house'}
  const[w,d]=houseFoot(t);const c=Math.cos(ry),s=Math.sin(ry);let lo=1e9,hi=-1e9;
  for(const u of[-.5,0,.5])for(const v of[-.5,0,.5,.75]){const lx=u*w*1.05,lz=v*d*1.05;const px=x+lx*c+lz*s,pz=z-lx*s+lz*c;const h=groundH(px,pz);lo=Math.min(lo,h);hi=Math.max(hi,h);
    if(waterAt(px,pz)!=null)return'Not in water';if(inRift(px)&&!riftWalk(px,pz,2))return'Too close to the edge of the island';if(inDrk(px)&&typeof drkLava==='function'&&drkLava(px,pz))return'Not on lava'}
  if(hi-lo>2.4)return'The ground is too steep';
  const R=Math.hypot(w,d)/2+1;const cx=Math.floor(x/10),cz=Math.floor(z/10);
  for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const arr=CG.get((cx+a)+','+(cz+b));if(!arr)continue;for(const k of arr){const dx=k.x-x,dz=k.z-z;if(Math.abs(dx)>R+k.r||Math.abs(dz)>R+k.r)continue;
    const lx=dx*c-dz*s,lz=dx*s+dz*c;if(Math.abs(lx)<w/2+k.r+.4&&Math.abs(lz)<d/2+1.5+k.r)return k.tree?'Trees are in the way':'Something is in the way'}}
  for(const b of BOXES)if(x>b.x0-R&&x<b.x1+R&&z>b.z0-R&&z<b.z1+R)return'Something is in the way';
  return''}
/* ---------- placing (and moving) your house ---------- */
const HP={on:false,ry:0,ghost:null,ring:null,why:'',x:0,z:0};
function housePlaceStart(){if(!P||!P.house)return;if(ME.pos.x>700)return toast('Go outside first');HP.on=true;HP.ry=ME.ry;closePanel('pHouse');
  const T=HOUSE_TIERS[P.house.t];const[w,d]=houseFoot(P.house.t);HP.ring=new THREE.Mesh(new THREE.PlaneGeometry(w,d+2.4).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x6aff6a,transparent:true,opacity:.35,depthWrite:false}));HP.ring.userData.dyn=1;scene.add(HP.ring);
  if(!window.__NOGLTF)envPlace(houseModel(P.house.t,P.house.c),0,0,0,()=>[T.s,T.s,T.s]).then(o=>{if(!o)return;if(!HP.on){scene.remove(o);return}o.userData.dyn=1;o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.transparent=true;m.material.opacity=.55;m.castShadow=false}});HP.ghost=o});
  houseBar(true);log('Choose a spot for your house: walk around, turn it with ⟲ / ⟳ and press "Build here". Green means you can build.','sys')}
function housePlaceEnd(){HP.on=false;if(HP.ghost)scene.remove(HP.ghost);if(HP.ring)scene.remove(HP.ring);HP.ghost=HP.ring=null;houseBar(false)}
function housePlaceFrame(){if(!HP.on)return;if(!P||!P.house||ME.dead||ME.pos.x>700){housePlaceEnd();return}const[w,d]=houseFoot(P.house.t);const k=d/2+5;
  HP.x=ME.pos.x+Math.sin(ME.ry)*k;HP.z=ME.pos.z+Math.cos(ME.ry)*k;HP.why=houseSpotWhy(HP.x,HP.z,HP.ry,P.house.t);
  const y=groundH(HP.x,HP.z);HP.ring.position.set(HP.x+Math.sin(HP.ry)*1.2,y+.15,HP.z+Math.cos(HP.ry)*1.2);HP.ring.rotation.y=HP.ry;HP.ring.material.color.setHex(HP.why?0xff5a4a:0x6aff6a);
  if(HP.ghost){HP.ghost.position.set(HP.x,y,HP.z);HP.ghost.rotation.y=HP.ry;HP.ghost.traverse(m=>{if(m.isMesh)m.material.opacity=HP.why?.3:.6})}
  const msg=$('#hbMsg');if(msg)msg.textContent=HP.why||'You can build here';if(msg)msg.style.color=HP.why?'#ff9a8a':'#9aff9a'}
function housePlaceDo(){if(!HP.on)return;if(HP.why)return toast(HP.why);P.house.x=Math.round(HP.x*100)/100;P.house.z=Math.round(HP.z*100)/100;P.house.ry=Math.round(HP.ry*1000)/1000;P.house.placed=1;housePlaceEnd();
  houseSync('me',houseRecMine());sfx('quest');dustFx(P.house.x,P.house.z,20);banner('Your '+HOUSE_TIERS[P.house.t].n+' stands!','Walk to the door and press F to go in',3);saveGame(true);lastPres=''}
/* the little bar at the bottom while you place a house or a piece of furniture */
function houseBar(on,furn){let b=$('#houseBar');if(!on){if(b)b.remove();return}if(b)b.remove();b=document.createElement('div');b.id='houseBar';
  b.innerHTML='<span id="hbMsg"></span><button class="btn alt" data-r="-1">⟲</button><button class="btn alt" data-r="1">⟳</button><button class="btn" id="hbOk">'+(furn?'Place':'Build here')+'</button><button class="btn alt" id="hbNo">Cancel</button>';document.body.appendChild(b);
  b.querySelectorAll('[data-r]').forEach(x=>x.onclick=()=>{const v=+x.dataset.r*Math.PI/(furn?4:8);if(furn)FP.ry+=v;else HP.ry+=v});
  $('#hbOk').onclick=()=>furn?furnPlaceDo():housePlaceDo();$('#hbNo').onclick=()=>furn?furnPlaceEnd():housePlaceEnd()}
function houseRecMine(){const h=P.house;return{owner:'me',mine:1,name:P.name,x:h.x,z:h.z,ry:h.ry,t:h.t,c:h.c}}
/* ---------- the inside ---------- */
const INT={key:null,grp:null,owner:null,name:'',t:0,ox:0,oz:0,w:0,d:0,walls:[],cols:[],items:[],mine:false,img:null,lights:[]};
const inHouse=x=>x>4200;
function intOrigin(name){let h=7;for(const ch of String(name))h=(h*31+ch.charCodeAt(0))>>>0;const s=h%400;return[4400+(s%20)*90,-900+Math.floor(s/20)*90]}
function furnLoad(k){const D=furnDef(k);if(D.trophy)return null;return D.env?D.m:'../house/'+D.m}
function intBuild(owner,name,t,items,mine){intClear();const T=HOUSE_TIERS[t];const[w,d]=T.room;const[ox,oz]=intOrigin(name);Object.assign(INT,{key:owner+'|'+Date.now(),owner,name,t,ox,oz,w,d,mine,walls:[],cols:[],items:[]});
  const g=new THREE.Group();g.position.set(ox,0,oz);g.userData.dyn=1;scene.add(g);INT.grp=g;
  mesh(new THREE.PlaneGeometry(w,d).rotateX(-Math.PI/2),mat(0x8a6a48,{tex:'wood',rx:w/2,ry:d/2}),0,.01,0,g,false,true);
  /* walls: plaster on a stone footing; the south wall has the door in the middle */
  const wallM=()=>{const m=new THREE.MeshToonMaterial({color:0xe8dcc0,gradientMap:RAMP,transparent:true,opacity:1});return m};const H=4.6,th=.4;
  const wall=(x,z,ww,dd,side)=>{const m=mesh(new THREE.BoxGeometry(ww,H,dd),wallM(),x,H/2,z,g);m.userData.side=side;INT.walls.push(m);const f=mesh(new THREE.BoxGeometry(ww+.02,.5,dd+.02),mat(0x6a6058,{tex:'brick'}),x,.25,z,g);f.userData.side=side;f.material=f.material.clone();f.material.transparent=true;INT.walls.push(f)};
  wall(0,-d/2-th/2,w+th*2,th,'n');wall(-w/2-th/2,0,th,d,'w');wall(w/2+th/2,0,th,d,'e');const dw=2.4;wall(-(w/2+dw/2)/2-th/2,d/2+th/2,w/2-dw/2+th,th,'s');wall((w/2+dw/2)/2+th/2,d/2+th/2,w/2-dw/2+th,th,'s');
  /* fixtures: the hearth on the north wall, windows on the sides, the door out */
  const put=(name,x,z,ry,s,y=0)=>envPlace(name,ox+x,oz+z,ry,()=>[s,s,s],g===null?scene:scene,y).then(o=>{if(!o)return null;scene.remove(o);o.position.set(x,y,z);g.add(o);o.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});return o});
  if(!window.__NOGLTF){put('../house/Q_Fireplace',0,-d/2+.45,0,.62);addFlame(g,0,.5,-d/2+.65,1.4,0xff8a30);
    for(const sx of[-1,1])for(let i=0;i<(t?2:1);i++){const z=t?(-d/4+i*d/2):0;put('../house/Q_WindowLarge',sx*(w/2-.05),z,sx<0?Math.PI/2:-Math.PI/2,.9,1.3).then(o=>{if(o)o.traverse(m=>{if(m.isMesh&&/glass|window/i.test(m.material.name||'')){m.material=m.material.clone();m.material.emissive=new THREE.Color(0x9ac8ff);m.material.emissiveIntensity=.8}})})}
    put('../house/Q_Door',0,d/2+.05,0,.62)}
  INT.cols.push({x:0,z:-d/2+.6,r:1.4});
  INT.light=new THREE.PointLight(0xffa860,30,22,1.4);INT.light.position.set(0,2,-d/2+1.5);g.add(INT.light);INT.light2=new THREE.PointLight(0xffe0b0,14,30,1.2);INT.light2.position.set(0,3.8,0);g.add(INT.light2);
  for(const it of items)intAddItem(it);
  /* the floor plan for the map */
  const c=document.createElement('canvas');c.width=Math.round(w*8);c.height=Math.round(d*8);const cg=c.getContext('2d');cg.fillStyle='#8a6a48';cg.fillRect(0,0,c.width,c.height);cg.strokeStyle='#3a2a1a';cg.lineWidth=4;cg.strokeRect(2,2,c.width-4,c.height-4);INT.img=c}
function intClear(){if(INT.grp)scene.remove(INT.grp);INT.grp=null;INT.key=null;INT.items=[];INT.cols=[];INT.walls=[]}
function intAddItem(it){const[k,lx,lz,ry]=it;const D=furnDef(k);if(!D||!INT.grp)return;const E={it,obj:null};INT.items.push(E);if(D.r)INT.cols.push(E.col={x:lx,z:lz,r:D.r});
  const y=D.wall?(D.y||0):D.hang||0;
  if(D.trophy){const g=new THREE.Group();g.position.set(lx,0,lz);g.rotation.y=ry;INT.grp.add(g);E.obj=g;
    envPlace('D_Pedestal',0,0,0,()=>[.7,.6,.7]).then(o=>{if(!o)return;scene.remove(o);o.position.set(0,0,0);tintObj(o,new THREE.Color(.55,.5,.45));g.add(o)});
    try{const r=buildMonster(D.trophy,MON[D.trophy]?MON[D.trophy].lv[0]:1);const bb=()=>{const b=new THREE.Box3().setFromObject(r.g);return b};r.g.position.set(0,1.05,0);g.add(r.g);
      const bronze=new THREE.MeshToonMaterial({color:0xb08a4a,gradientMap:RAMP,emissive:new THREE.Color(0x2a1a08)});
      const fit=()=>{try{animRig(r,{spd:0,air:false,atk:-1,dead:false},.016)}catch(e){}r.g.traverse(m=>{if(m.isMesh){m.material=bronze;m.castShadow=true}});r.g.scale.setScalar(1);r.g.updateMatrixWorld(true);const b=bb();const h=b.max.y-b.min.y||1;r.g.scale.setScalar(Math.min(1.8/h,2.4/Math.max(b.max.x-b.min.x,b.max.z-b.min.z,1)))};
      fit();let n=0;const iv=setInterval(()=>{fit();if(++n>8)clearInterval(iv)},700)}catch(e){console.warn('statue',e)}return}
  const name=furnLoad(k);if(window.__NOGLTF)return;
  envPlace(name,0,0,0,()=>[D.s,D.s,D.s]).then(o=>{if(!o)return;scene.remove(o);if(!INT.grp||!INT.items.includes(E))return;o.position.set(lx,y,lz);o.rotation.y=ry;o.userData.dyn=1;o.traverse(m=>{if(m.isMesh){m.castShadow=!D.wall&&y<2;m.receiveShadow=true;if(D.glow&&/light|lamp|bulb|candle|flame|emiss|yellow/i.test(m.material.name||'')){m.material=m.material.clone();m.material.emissive=new THREE.Color(0xffd080);m.material.emissiveIntensity=1.2}}});INT.grp.add(o);E.obj=o})}
function intRemoveItem(E){const i=INT.items.indexOf(E);if(i<0)return;INT.items.splice(i,1);if(E.col){const j=INT.cols.indexOf(E.col);if(j>=0)INT.cols.splice(j,1)}if(E.obj&&INT.grp)INT.grp.remove(E.obj)}
function intCollide(p,r){if(!INT.grp){return}const lx=p.x-INT.ox,lz=p.z-INT.oz;let x=clamp(lx,-INT.w/2+r+.1,INT.w/2-r-.1),z=clamp(lz,-INT.d/2+r+.1,INT.d/2-r-.1);
  for(const c of INT.cols){const dx=x-c.x,dz=z-c.z,rr=c.r+r,dd=dx*dx+dz*dz;if(dd<rr*rr&&dd>1e-6){const q=Math.sqrt(dd),k=(rr-q)/q;x+=dx*k;z+=dz*k}}p.x=INT.ox+x;p.z=INT.oz+z}
/* walls between the camera and you turn see-through, so the room stays visible */
function intFrame(dt){if(!INT.grp)return;const c=camera.position;const lx=c.x-INT.ox,lz=c.z-INT.oz;
  for(const m of INT.walls){const s=m.userData.side;const out=s==='s'?lz>INT.d/2-.5:s==='n'?lz<-INT.d/2+.5:s==='e'?lx>INT.w/2-.5:s==='w'?lx<-INT.w/2+.5:false;const o=out?.12:1;m.material.opacity=lerp(m.material.opacity,o,clamp(dt*8,0,1));m.material.depthWrite=m.material.opacity>.9;m.castShadow=m.material.opacity>.9}}
function houseEnter(owner,name,t,items,mine){intBuild(owner,name,t,items,mine);teleport(INT.ox,INT.oz+INT.d/2-1.6);ME.ry=Math.PI;cam.yaw=0;S.house={owner,name,mine};sfx('loot');
  log(mine?'Welcome home.'+(isTouch?'':' Press H to decorate.'):'You step into '+esc(name)+(name.endsWith('s')?"'":"'s")+' '+HOUSE_TIERS[t].n+'.','sys');updZone(true)}
function houseLeave(){const H=S.house&&(S.house.mine?PHOUSES.get('me'):[...PHOUSES.values()].find(h=>h.owner===S.house.owner));S.house=null;furnPlaceEnd();
  if(H){const dr=houseDoor(H);teleport(dr.x+Math.sin(H.ry)*1.5,dr.z+Math.cos(H.ry)*1.5);ME.ry=H.ry;cam.yaw=H.ry+Math.PI}else teleport(rand(-3,3),rand(5,8));intClear();updZone(true)}
function houseDoorOut(){if(!P||!P.house||!P.house.placed)return null;const d=houseDoor(P.house);return[d.x+Math.sin(P.house.ry)*1.5,d.z+Math.cos(P.house.ry)*1.5]}
/* F at a door */
let _hreq=null;
function houseInteract(x,z){
  if(inHouse(x)&&INT.grp){if(Math.hypot(x-INT.ox,z-(INT.oz+INT.d/2))<3.2){houseLeave();return true}return false}
  for(const H of PHOUSES.values()){const dr=houseDoor(H);if(Math.hypot(dr.x-x,dr.z-z)>3.5)continue;
    if(H.mine){houseEnter('me',P.name,P.house.t,P.house.items,true);return true}
    if(_hreq&&performance.now()-_hreq.t<5000)return true;_hreq={owner:H.owner,t:performance.now()};netEmit('hreq',{to:H.owner});toast('You knock on the door…');
    setTimeout(()=>{if(_hreq&&_hreq.owner===H.owner&&!S.house){_hreq=null;toast('Nobody opens the door')}},5000);return true}
  return false}
/* network: a knock (hreq) is answered by the owner with the inside of the house (hdat) */
function houseOnReq(m){const d=m.data||{};if(d.to!==myId()||!P||!P.house||!P.house.placed)return;netEmit('hdat',{to:m.peer,t:P.house.t,n:P.name,it:P.house.items.slice(0,90)});
  const r=REMOTES.get(m.peer);log((r?esc(r.n):'Someone')+' visits your house.','sys')}
function houseOnDat(m){const d=m.data||{};if(d.to!==myId()||!_hreq||_hreq.owner!==m.peer)return;_hreq=null;const t=clamp(d.t|0,0,2);
  const items=(Array.isArray(d.it)?d.it:[]).filter(i=>Array.isArray(i)&&typeof i[0]==='string'&&furnDef(i[0])&&[1,2,3].every(j=>isFinite(i[j]))).slice(0,90).map(i=>[i[0],clamp(+i[1],-15,15),clamp(+i[2],-12,12),+i[3]]);
  const r=REMOTES.get(m.peer);houseEnter(m.peer,r?r.n:String(d.n||'Someone').slice(0,14),t,items,false)}
/* per frame: houses of players online, placing, the walls inside */
let _hsT=0;
function updHouse(dt){if(!P)return;housePlaceFrame();furnPlaceFrame();intFrame(dt);
  _hsT-=dt;if(_hsT>0)return;_hsT=1;
  if(P.house&&P.house.placed)houseSync('me',houseRecMine());else houseRemove('me');
  const seen=new Set(['me']);for(const r of REMOTES.values()){const h=r.hs;if(!Array.isArray(h)||h.length<5||!h.slice(0,3).every(isFinite))continue;const key='r:'+r.id;seen.add(key);houseSync(key,{owner:r.id,name:r.n||'Hero',x:+h[0],z:+h[1],ry:+h[2],t:clamp(h[3]|0,0,2),c:HOUSE_COLS[h[4]|0]||'blue'})}
  for(const k of[...PHOUSES.keys()])if(!seen.has(k))houseRemove(k)}
function housePres(){const h=P&&P.house;return h&&h.placed?[Math.round(h.x*10)/10,Math.round(h.z*10)/10,Math.round(h.ry*100)/100,h.t,Math.max(0,HOUSE_COLS.indexOf(h.c))]:0}
/* ---------- decorating ---------- */
const FP={on:false,k:null,ry:0,ghost:null,lx:0,lz:0,ok:false};
function furnPlaceStart(k){if(!S.house||!S.house.mine)return;const D=furnDef(k);const T=HOUSE_TIERS[P.house.t];
  if(P.house.items.length>=T.max)return toast('Your '+T.n+' holds at most '+T.max+' things. Upgrade it at Master Builder Orla.');
  if(k.startsWith('T:')&&P.house.items.some(i=>i[0]===k))return toast('That statue already stands in your house');
  if(!k.startsWith('T:')&&!(P.furn[k]>0)&&P.gold<D.p)return toast('Not enough gold');
  furnPlaceEnd();FP.on=true;FP.k=k;FP.ry=0;closePanel('pHouse');houseBar(true,true);
  if(D.trophy){FP.ghost=new THREE.Mesh(new THREE.CylinderGeometry(.7,.8,1.1,16),new THREE.MeshBasicMaterial({color:0xd8b070,transparent:true,opacity:.5}));FP.ghost.userData.dyn=1;INT.grp.add(FP.ghost)}
  else envPlace(furnLoad(k),0,0,0,()=>[D.s,D.s,D.s]).then(o=>{if(!o)return;scene.remove(o);if(!FP.on||FP.k!==k)return;o.traverse(m=>{if(m.isMesh){m.material=m.material.clone();m.material.transparent=true;m.material.opacity=.6;m.castShadow=false}});INT.grp.add(o);FP.ghost=o})}
function furnPlaceEnd(){if(FP.ghost&&FP.ghost.parent)FP.ghost.parent.remove(FP.ghost);FP.on=false;FP.ghost=null;if($('#houseBar')&&!HP.on)houseBar(false)}
function furnPlaceFrame(){if(!FP.on)return;if(!S.house||!INT.grp){furnPlaceEnd();return}const D=furnDef(FP.k);
  let lx=ME.pos.x-INT.ox+Math.sin(ME.ry)*2.4,lz=ME.pos.z-INT.oz+Math.cos(ME.ry)*2.4,ry=FP.ry,y=D.hang||0;
  const w=INT.w/2,d=INT.d/2;lx=clamp(lx,-w+.4,w-.4);lz=clamp(lz,-d+.4,d-.4);
  if(D.wall){const dn=[w-lx,w+lx,d+lz,d-lz];const m=Math.min(...dn);if(m===dn[0]){lx=w-.08;ry=-Math.PI/2}else if(m===dn[1]){lx=-w+.08;ry=Math.PI/2}else if(m===dn[2]){lz=-d+.08;ry=0}else{lz=d-.08;ry=Math.PI}y=D.y||0}
  FP.lx=lx;FP.lz=lz;FP.cur=ry;FP.ok=!(Math.abs(lz-d)<2&&Math.abs(lx)<2)&&!(Math.abs(lx)<2.2&&lz<-d+1.6&&!D.wall);
  if(FP.ghost){FP.ghost.position.set(lx,D.trophy?.55:y,lz);FP.ghost.rotation.y=ry}
  const msg=$('#hbMsg');if(msg){msg.textContent=FP.ok?D.n:'Keep the door and the hearth free';msg.style.color=FP.ok?'#9aff9a':'#ff9a8a'}}
function furnPlaceDo(){if(!FP.on||!FP.ok)return toast('You cannot place that here');const k=FP.k,D=furnDef(k);
  if(!k.startsWith('T:')){if(P.furn[k]>0)P.furn[k]--;else{if(P.gold<D.p)return toast('Not enough gold');P.gold-=D.p;refreshBag()}}
  const it=[k,Math.round(FP.lx*100)/100,Math.round(FP.lz*100)/100,Math.round(FP.cur*1000)/1000];P.house.items.push(it);intAddItem(it);sfx('loot');furnPlaceEnd();saveGame();
  if(!k.startsWith('T:')&&(P.furn[k]>0||P.gold>=D.p))furnPlaceStart(k)}
function furnPickUp(){if(!S.house||!S.house.mine)return;let best=null,bd=3.2;const fx=ME.pos.x-INT.ox+Math.sin(ME.ry)*1.2,fz=ME.pos.z-INT.oz+Math.cos(ME.ry)*1.2;
  for(const E of INT.items){const dd=Math.hypot(E.it[1]-fx,E.it[2]-fz);if(dd<bd){bd=dd;best=E}}if(!best)return toast('Stand in front of the thing you want to pick up');
  const k=best.it[0];intRemoveItem(best);const i=P.house.items.indexOf(best.it);if(i>=0)P.house.items.splice(i,1);if(!k.startsWith('T:'))P.furn[k]=(P.furn[k]||0)+1;sfx('swing');toast(furnDef(k).n+' picked up');saveGame();refreshHouse()}
/* ---------- the Home panel (H) ---------- */
let HCAT='Living';
function refreshHouse(){const b=$('#hBody');if(!b||!P)return;houseInit();const h=P.house;let s='';
  if(!h){s='<p>You do not own a house yet. <b>Master Builder Orla</b> in the Artisans\' Yard of Silverbrook sells deeds: build your own house anywhere in the world!</p>';b.innerHTML=s;return}
  const T=HOUSE_TIERS[h.t];s+='<p><b>Your '+T.n+'</b> · '+(h.placed?(zoneAt(h.x,h.z)||'Velmora'):'not built yet')+' · '+h.items.length+' / '+T.max+' things inside</p>';
  if(!S.house||!S.house.mine){
    if(T.m!=='tavern'){s+='<div class="row hcols">';for(const c of HOUSE_COLS)s+='<button class="btn'+(h.c===c?'':' alt')+'" data-col="'+c+'">'+c[0].toUpperCase()+c.slice(1)+' roof</button>';s+='</div>'}
    s+='<div class="row"><button class="btn" id="hPlace">'+(h.placed?'Move my house here (50 gold)':'Build my house here')+'</button></div>';
    s+='<p style="font-size:13px">'+(h.placed?'Your house stays standing while you are away; other players see it while you are online. Walk to the door and press F to go in.':'Walk to an open, fairly flat spot (not in a town, not in water, not between trees) and press the button.')+'</p>';
    s+='<div class="row"><button class="btn alt" id="hHome"'+(h.placed?'':' disabled')+'>'+(P.home==='house'?'Hearthstone: back to Silverbrook':'Hearthstone: make my house my home')+'</button></div>'}
  else{const cats=['Living','Bedroom','Storage','Decor','Trophies'];s+='<div class="row htabs">'+cats.map(c=>'<button class="btn'+(HCAT===c?'':' alt')+'" data-cat="'+c+'">'+c+'</button>').join('')+'</div><div class="hcat">';
    const list=HCAT==='Trophies'?P.trophies.map(t=>'T:'+t):Object.keys(FURN).filter(k=>FURN[k].cat===HCAT);
    if(!list.length)s+='<p style="font-size:13px">'+(HCAT==='Trophies'?'Defeat great foes (the bosses of dungeons and raids, and the elites of the Rift) to earn a statue of them.':'Nothing here.')+'</p>';
    for(const k of list){const D=furnDef(k);const own=k.startsWith('T:')?(P.house.items.some(i=>i[0]===k)?'placed':'free'):P.furn[k]>0?P.furn[k]+' owned':D.p+' gold';s+='<button class="hitem" data-k="'+k+'"><b>'+esc(D.n)+'</b><small>'+own+'</small></button>'}
    s+='</div><div class="row"><button class="btn alt" id="hPick">Pick up what is in front of me</button></div><p style="font-size:13px">Click a thing to place it in front of you. Wall things hang on the nearest wall. You have <b>'+P.gold+'</b> gold.</p>'}
  b.innerHTML=s;
  b.querySelectorAll('[data-col]').forEach(x=>x.onclick=()=>{h.c=x.dataset.col;if(h.placed)houseSync('me',houseRecMine());saveGame();lastPres='';refreshHouse()});
  b.querySelectorAll('[data-cat]').forEach(x=>x.onclick=()=>{HCAT=x.dataset.cat;refreshHouse()});
  b.querySelectorAll('[data-k]').forEach(x=>x.onclick=()=>furnPlaceStart(x.dataset.k));
  const hp=$('#hPlace');if(hp)hp.onclick=()=>{if(h.placed&&P.gold<50)return toast('Not enough gold');if(h.placed){P.gold-=50;h.placed=0;houseRemove('me');refreshBag()}housePlaceStart()};
  const hh=$('#hHome');if(hh)hh.onclick=()=>{P.home=P.home==='house'?'':'house';log(P.home?'Your house is now your home: your hearthstone takes you there.':'Silverbrook is your home again.','sys');saveGame();refreshHouse()};
  const pk=$('#hPick');if(pk)pk.onclick=furnPickUp}
/* ---------- Master Builder Orla ---------- */
function builderHtml(){houseInit();const h=P.house;let s='<b>Houses</b>';
  if(!h){const T=HOUSE_TIERS[0];s+='<p style="font-size:13px">A deed lets you build a '+T.n+' anywhere in the world, out of town and on fairly flat ground.</p><div class="row"><button class="btn" id="bDeed"'+(P.level<T.lvl?' disabled':'')+'>Buy a '+T.n+' deed ('+T.price+' gold'+(P.level<T.lvl?', level '+T.lvl:'')+')</button></div>'}
  else{const N=HOUSE_TIERS[h.t+1];s+='<p style="font-size:13px">You own a '+HOUSE_TIERS[h.t].n+(h.placed?'':' (not built yet: press H to build it)')+'.</p>';
    if(N)s+='<div class="row"><button class="btn" id="bUpg"'+(P.level<N.lvl?' disabled':'')+'>Upgrade to a '+N.n+' ('+N.price+' gold'+(P.level<N.lvl?', level '+N.lvl:'')+')</button></div><p style="font-size:13px">A '+N.n+' is bigger inside and holds up to '+N.max+' things.</p>';
    else s+='<p style="font-size:13px"><i>A Manor! There is nothing grander I can build for you.</i></p>'}
  return s+'<p style="font-size:13px">You have <b>'+P.gold+'</b> gold.</p>'}
function builderBind(n){const bd=$('#bDeed');if(bd)bd.onclick=()=>{const T=HOUSE_TIERS[0];if(P.gold<T.price)return toast('Not enough gold');P.gold-=T.price;P.house={t:0,c:'blue',placed:0,x:0,z:0,ry:0,items:[]};sfx('quest');banner('House deed bought!','Press H, walk to a good spot and build your house',3);refreshBag();saveGame();closePanel('pDialog');openPanel('pHouse')};
  const bu=$('#bUpg');if(bu)bu.onclick=()=>{const h=P.house,N=HOUSE_TIERS[h.t+1];if(!N)return;if(P.gold<N.price)return toast('Not enough gold');
    if(h.placed){houseRemove('me');const why=houseSpotWhy(h.x,h.z,h.ry,h.t+1);if(why){houseSync('me',houseRecMine());return toast('A '+N.n+' does not fit where your house stands ('+why.toLowerCase()+'). Move your house first (H).')}}
    P.gold-=N.price;h.t++;if(h.placed)houseSync('me',houseRecMine());sfx('lvl');banner('Your house is now a '+N.n+'!','',2.5);refreshBag();saveGame();lastPres='';openNpc(n,true)}}
