/* ===================== Heroic bodies (beta): Quaternius "RPG Characters" (CC0, Nov 2020) =====================
   A second look for player characters, next to the KayKit adventurers. It is a choice per hero (P.bd='rpg'); the
   KayKit models and everything built on them (outfits, helmets, shoulder pads, capes) stay as they are.
   Six models with their own skeleton, textures and animations: Warrior, Wizard, Ranger, Rogue, Cleric, Monk.
   Each class picks one of two models (P.rm). For now each model wears its own outfit and weapon; armour from the bag
   does not change the look yet. The models have no jump, riding or crafting clips, so those use the nearest clip. */
const RPG_MODELS=['Warrior','Wizard','Ranger','Rogue','Cleric','Monk'];
const RPG_CLS={krijger:['Warrior','Monk'],paladijn:['Cleric','Warrior'],magier:['Wizard','Cleric'],jager:['Ranger','Rogue']};
const RPG_DEF={
  Warrior:{w:'Warrior_Sword',cidle:'Idle_Weapon',run:'Run_Weapon',atk:['Sword_Attack','Sword_AttackFast'],cast:'Idle_Attacking'},
  Wizard:{w:'Wizard_Staff',cidle:'Idle_Weapon',run:'Run_Weapon',atk:['Spell1','Spell2','Staff_Attack'],cast:'Spell2'},
  Ranger:{w:'Ranger_Bow',cidle:'Idle_Weapon',run:'Run',atk:['Bow_Attack_Shoot'],cast:'Bow_Attack_Draw'},
  Rogue:{w:'Rogue_Dagger',cidle:'Attacking_Idle',run:'Run',atk:['Dagger_Attack','Dagger_Attack2'],cast:'Attacking_Idle'},
  Cleric:{w:'Cleric_Staff',cidle:'Idle_Weapon',run:'Run_Weapon',atk:['Staff_Attack','Spell1'],cast:'Spell2'},
  Monk:{w:null,cidle:'Idle_Attacking',run:'Run',atk:['Attack','Attack2','Punch'],cast:'Idle_Attacking'}};
function rpgModelFor(p){const L=RPG_CLS[p.cls]||RPG_CLS.krijger;return L.includes(p.rm)?p.rm:L[0]}
function rpgClips(name){const D=RPG_DEF[name];const a=D.atk;
  return{idle:'Idle',cidle:D.cidle,walk:'Walk',run:D.run,jumpS:'Roll',jumpI:D.cidle,land:null,cast:D.cast,die:'Death',hit:'RecieveHit',work:'PickUp',
    atk:{krijger:a,paladijn:a,magier:a,jager:a,bijl:a,staf:a,boog:a,zwaard:a,ak:a,def:a}}}
/* once per model: the true height (the face and gear are separate meshes on the bones, not part of the skin), and a
   little more light in the colours, which are darker than the KayKit atlas */
const _rpgPrep=new Map();
function rpgPrep(name){let p=_rpgPrep.get(name);if(p)return p;
  p=loadGltf('rpg/RPG_'+name).then(g=>{if(!g||g.userData.rpg)return g;const sc=g.scene;sc.updateMatrixWorld(true);const bb=new THREE.Box3();
    sc.traverse(o=>{if(o.isMesh){o.visible=true;bb.expandByObject(o)}});g.userData.h=Math.max(.3,bb.max.y-bb.min.y);g.userData.y0=bb.min.y;
    const done=new Set();sc.traverse(o=>{if(o.isMesh&&!done.has(o.material)){done.add(o.material);if(o.material.color)o.material.color.setScalar(1.5)}});
    g.userData.props=[];sc.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh)g.userData.props.push(o.name)});g.userData.rpg=1;return g});
  _rpgPrep.set(name,p);return p}
function buildRpgChar(o){const name=RPG_MODELS.includes(o.rm)?o.rm:rpgModelFor(o);const D=RPG_DEF[name];const R=RACES[o.race]||RACES.mens;const s0=o.scale||1;
  /* placeholder until the model is ready, then the rig is built (the height must be known first) */
  const g=new THREE.Group();const r={g,gltf:true,rpg:true,h:1.84*R.h*s0,ph:Math.random()*6,wt:o.wt,o:{...o,gear:null},cm:rpgClips(name),st:{land:0,idle:0},cur:null,acts:{},ready:false};r.body=g;
  rpgPrep(name).then(src=>{if(!src)return;const props=src.userData.props.filter(n=>n!==D.w||(o.wt&&o.wt!=='none'));
    const inner=buildGltfRig({model:'rpg/RPG_'+name,h:r.h,props,weaponMesh:o.wt&&o.wt!=='none'?D.w:null,wr:o.wr,cm:r.cm,o:r.o,onReady:x=>{
      r.m=x.m;r.s=x.s;r.mixer=x.mixer;r.clips=x.clips;r.weapon=x.weapon;g.add(x.g);r.ready=true;if(o.onReady)o.onReady(r)}})});
  return r}
