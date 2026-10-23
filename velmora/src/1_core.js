import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
/* ===================== utils ===================== */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, smooth=t=>t*t*(3-2*t);
const rand=(a,b)=>a+Math.random()*(b-a), randi=(a,b)=>Math.floor(a+Math.random()*(b-a+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const d2=(ax,az,bx,bz)=>(ax-bx)*(ax-bx)+(az-bz)*(az-bz);
const angDiff=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
function mulberry(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(x,z){let h=(Math.imul(x|0,374761393)+Math.imul(z|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);return lerp(lerp(hash(xi,zi),hash(xi+1,zi),u),lerp(hash(xi,zi+1),hash(xi+1,zi+1),u),v)}
function fbm(x,z){let s=0,a=1,f=1,n=0;for(let i=0;i<4;i++){s+=vnoise(x*f,z*f)*a;n+=a;a*=.5;f*=2.03}return s/n}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isTouch=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window&&navigator.maxTouchPoints>0);
if(isTouch)document.body.classList.add('touch');
let uidN=Date.now()%100000;const uid=()=>(uidN++).toString(36)+Math.random().toString(36).slice(2,6);

/* ===================== data ===================== */
const RACES={
  mens:{n:'Human',skin:0xe2b48e,desc:'Versatile humans from the coastal kingdoms. Quick learners: +10% experience.',xp:1.1,h:1,w:1,hair:[0x3b2414,0xc79a4b,0x1b1b1b,0x8a3b1c]},
  dwerg:{n:'Dwarf',skin:0xd99b7a,desc:'Hardy mountain dwarves from Karak Duun. Sturdily built: +12% health.',hp:1.12,h:.8,w:1.18,hair:[0xb5541c,0x6b4a2b,0xd9d0c0,0x262626]},
  orc:{n:'Orc',skin:0x6f9a4a,desc:'Tusked warriors from the badlands beyond Ashen Hills. Thick-skinned and hard-hitting: +10% health and +3% damage. The colour you pick is your skin.',hp:1.1,dmg:1.03,h:1.06,w:1.1,orc:1,hair:[0x7aa84c,0x9aa646,0x6c9078,0xa8784e]},
  undead:{n:'Undead',skin:0xe8e0cc,desc:'Restless dead who broke free from the crypt of Kaal-Morath. Undying: +6% health and +5% damage. The colour you pick is the glow of your eyes.',hp:1.06,dmg:1.05,h:1,w:1,undead:1,hair:[0x6ad8ff,0x7aff5a,0xc06aff,0xff6a3a]}
};
const CLASSES={
  krijger:{n:'Warrior',desc:'Fights up close with sword and axe. Lots of health and heavy blows. Uses energy.',res:'energie',hp:90,hpL:22,sta:10,staL:2.2,pow:12,powL:3,range:3.2,spd:2.3,cape:0x8c1f1f,chest:0x7a7f88,pants:0x3d3a36,wt:'zwaard',armorK:3,col:'#c79c6e'},
  magier:{n:'Mage',desc:'Commands fire and frost from afar. Little health, enormous damage. Uses mana.',res:'mana',hp:70,hpL:15,sta:8,staL:1.6,pow:14,powL:3.6,range:28,spd:1.9,cape:0x2a3f9a,chest:0x4b3a8c,pants:0x2b2340,wt:'staf',armorK:1,col:'#69ccf0'},
  paladijn:{n:'Paladin',desc:'A holy knight with hammer and shield. Protects, heals and smites with the Light: Protection, Holy or Retribution. Uses mana.',res:'mana',hp:86,hpL:21,sta:10,staL:2.1,pow:12,powL:3.1,range:3.2,spd:2.4,cape:0xe8e2cc,chest:0xc8ccd6,pants:0x2c3a6a,wt:'zwaard',armorK:3,col:'#f58cba'},
  jager:{n:'Hunter',desc:'A marksman with bow and arrow. Fast, agile and deadly at range. Uses focus.',res:'focus',hp:80,hpL:18,sta:9,staL:1.9,pow:13,powL:3.3,range:30,spd:2.2,cape:0x2f5a2a,chest:0x6b4b2a,pants:0x3b3022,wt:'boog',armorK:2,col:'#abd473'}
};
const RES_COL={energie:'enb',mana:'mpb',focus:'fob'};
/* ability icons are drawn procedurally: [glyph, color1, color2] */
const ABIL={
  krijger:[
    {id:'slag',n:'Heroic Strike',lvl:1,cd:0,cost:15,range:3.4,need:1,ic:['sword','#d9a441','#5a2a0a'],d:'A powerful blow that deals 150% weapon damage.'},
    {id:'storm',n:'Charge',lvl:2,cd:12,cost:0,range:25,min:5,need:1,ic:['charge','#e0632a','#3d0d06'],d:'Charge at your target and stun it for 1.5 seconds.'},
    {id:'werv',n:'Whirlwind',lvl:4,cd:8,cost:30,range:0,ic:['whirl','#cfd6e0','#2b3342'],d:'Spin around, hitting all enemies within 6 metres for 110% weapon damage.'},
    {id:'kreet',n:'Battle Cry',lvl:6,cd:45,cost:0,range:0,ic:['shout','#ffcf4d','#7a2a00'],d:'Restores 25% health and grants 25% more damage for 12 seconds.'},
    {id:'donder',n:'Thunder Clap',lvl:30,cd:12,cost:25,range:0,ic:['shout','#9ad0ff','#0d2a4a'],d:'Slam the ground: 130% weapon damage to all enemies within 8 metres, stunning them for 1.5 seconds.'},
    {id:'executie',n:'Execute',lvl:40,cd:6,cost:20,range:3.4,need:1,cond:'exec',ic:['skull','#ff5a3a','#3a0505'],d:'Only on enemies below 30% health: a finishing blow for 380% weapon damage.'},
    {id:'avatar',n:'Avatar of the Rift',lvl:50,cd:120,cost:0,range:0,ic:['star','#c08aff','#2a0a4a'],d:'Become an avatar of the void for 15 seconds: 30% more damage, 25% less damage taken and 20% faster attacks.'}],
  magier:[
    {id:'vuur',n:'Firebolt',lvl:1,cd:0,cost:12,range:30,need:1,cast:1.3,ic:['fire','#ffb02e','#7a1500'],d:'Hurls a firebolt that deals 170% spell power as damage.'},
    {id:'nova',n:'Frost Nova',lvl:2,cd:14,cost:22,range:0,ic:['frost','#a8e4ff','#0d3a66'],d:'Freezes all enemies within 9 metres for 4 seconds and deals light damage.'},
    {id:'flits',n:'Blink',lvl:4,cd:15,cost:15,range:0,ic:['blink','#d9a8ff','#3a1266'],d:'Teleport 13 metres forward.'},
    {id:'meteoor',n:'Meteor',lvl:6,cd:20,cost:35,range:30,need:1,cast:1.8,ic:['meteor','#ff7a2e','#4a0d00'],d:'A meteor strikes your target: 260% damage to everything within 6 metres.'},
    {id:'ijsbarriere',n:'Ice Barrier',lvl:30,cd:30,cost:25,range:0,ic:['shield','#bfeaff','#0d3a66'],d:'Encase yourself in a barrier of ice: 40% less damage taken for 10 seconds, and enemies next to you are frozen for 2 seconds.'},
    {id:'kettingblik',n:'Chain Lightning',lvl:40,cd:9,cost:30,range:30,need:1,cast:1.2,ic:['charge','#c8e0ff','#1a1a5a'],d:'Lightning strikes your target for 180% spell power and jumps to up to 4 nearby enemies, losing 15% per jump.'},
    {id:'rifscheur',n:'Rift Collapse',lvl:50,cd:45,cost:45,range:30,need:1,cast:2,ic:['blink','#ff6ad8','#2a053a'],d:'Tear open a rift at your target. A moment later it collapses: 420% damage to the target and 220% to everything within 7 metres.'}],
  paladijn:[
    {id:'kruis',n:'Crusader Strike',lvl:1,cd:0,cost:10,range:3.4,need:1,ic:['hammer','#ffe08a','#5a3a06'],d:'Strike with the Light for 140% weapon damage and restore 2% of your mana.'},
    {id:'oordeel',n:'Judgement',lvl:2,cd:8,cost:15,range:22,need:1,ic:['sun','#fff0a8','#6a4a06'],d:'Unleash a hammer of light at your target: 160% weapon damage as holy damage.'},
    {id:'flits_licht',n:'Flash of Light',lvl:4,cd:0,cost:22,range:30,heal:1,cast:1.5,ic:['cross','#fff6c8','#7a5a10'],d:'Heal your friendly target (or yourself) for a large amount. Click a group member to heal them.'},
    {id:'godschild',n:'Divine Shield',lvl:6,cd:90,cost:0,range:0,ic:['shield','#ffe9a0','#6a4a00'],d:'A shield of holy light makes you immune to all damage for 8 seconds.'},
    {id:'wijding',n:'Consecration',lvl:30,cd:15,cost:25,range:0,ic:['sun','#ffe08a','#4a3a06'],d:'Consecrate the ground beneath you for 8 seconds: every second 45% weapon damage to enemies within 7 metres.'},
    {id:'handoplegging',n:'Lay on Hands',lvl:40,cd:180,cost:0,range:30,heal:1,ic:['heart','#fff2b0','#6a4a06'],d:'Heal your friendly target (or yourself) for an enormous amount, without using mana.'},
    {id:'hemelhamer',n:'Hammer of the Heavens',lvl:50,cd:40,cost:40,range:30,need:1,ic:['hammer','#fff6c8','#5a4a10'],d:'Eight hammers of light fall around your target over 4 seconds, each dealing 90% weapon damage within 4 metres.'}],
  jager:[
    {id:'schot',n:'Aimed Shot',lvl:1,cd:0,cost:15,range:32,need:1,ic:['arrow','#e8d7a0','#3d2a0f'],d:'A carefully aimed shot for 150% weapon damage.'},
    {id:'multi',n:'Multi-Shot',lvl:2,cd:8,cost:25,range:32,need:1,ic:['multi','#9be07a','#173d0d'],d:'Hits your target and up to four nearby enemies for 95% weapon damage.'},
    {id:'sprong',n:'Disengage',lvl:4,cd:15,cost:0,range:0,ic:['leap','#7ad0e0','#0d3340'],d:'Leap 11 metres backwards, away from danger.'},
    {id:'regen',n:'Arrow Rain',lvl:6,cd:18,cost:35,range:32,need:1,ic:['rain','#ffd36a','#4a2a00'],d:'A rain of arrows: 230% damage to everything within 6 metres of your target.'},
    {id:'ijsval',n:'Frost Trap',lvl:30,cd:20,cost:20,range:0,ic:['frost','#bfeaff','#0d3340'],d:'Drop a trap at your feet. After a second it bursts: 80% weapon damage to enemies within 7 metres, freezing them for 5 seconds.'},
    {id:'snelvuur',n:'Rapid Fire',lvl:40,cd:20,cost:30,range:32,need:1,ic:['multi','#ffe0a0','#3a2a05'],d:'Fire eight arrows in quick succession at your target, each for 55% weapon damage.'},
    {id:'riftsalvo',n:'Void Barrage',lvl:50,cd:45,cost:40,range:32,need:1,ic:['rain','#c08aff','#1a0a3a'],d:'Three waves of void arrows rain down around your target: each wave deals 170% damage to everything within 7 metres.'}]
};
const COMMON_ABIL=[
  {id:'drank',n:'Healing Potion',lvl:1,cd:20,cost:0,item:'heal',ic:['potion','#ff4b4b','#3d0505'],d:'Instantly restores 45% of your health.'},
  {id:'mdrank',n:'Power Potion',lvl:1,cd:20,cost:0,item:'mana',ic:['potion','#4b8bff','#05153d'],d:'Instantly restores 50% of your mana, energy or focus.'},
  {id:'thuis',n:'Hearthstone',lvl:1,cd:60,cost:0,cast:4,ic:['hearth','#7cf0ff','#0b2a3a'],d:'Return home after 4 seconds: the square of Silverbrook, or the inn you made your home (WindStorm or Riftwatch).'}
];
const MON={
  ever:{n:'Wild Boar',kind:'boar',col:0x6b4a32,lv:[1,2],aggro:0,spd:5.2,size:1,xpM:1},
  wolf:{n:'Dusk Wolf',kind:'wolf',col:0x5d6470,lv:[2,4],aggro:11,spd:6.5,size:1,xpM:1},
  spin:{n:'Forest Spider',kind:'spider',col:0x3a2a4a,lv:[4,6],aggro:11,spd:5.6,size:1.15,xpM:1},
  rover:{n:'Highwayman',kind:'human',col:0x8a2020,lv:[5,7],aggro:13,spd:5.8,size:1,xpM:1,wt:'zwaard'},
  grisk:{n:'Bandit Chief Grisk',kind:'human',col:0xb08a20,lv:[8,8],aggro:14,spd:5.8,size:1.3,elite:1,xpM:1,wt:'bijl',respawn:90},
  knekel:{n:'Bone Warden',kind:'skel',col:0xe6e0cc,lv:[8,9],aggro:13,spd:5.4,size:1,xpM:1,wt:'zwaard'},
  kmagier:{n:'Bone Mage',kind:'skel',col:0xe6e0cc,lv:[9,9],aggro:16,spd:5,size:1,xpM:1.1,wt:'staf',ranged:20,robe:0x4a1f6a},
  boss:{n:'Kaal-Morath the Bone King',kind:'skel',col:0xd9d2b0,lv:[10,10],aggro:18,spd:5.2,size:2.3,boss:1,elite:1,xpM:1,wt:'bijl',robe:0x2a0d3a,respawn:120},
  dienaar:{n:'Summoned Servant',kind:'skel',col:0xbfb8a0,lv:[8,8],aggro:40,spd:6,size:.9,xpM:.3,wt:'zwaard',add:1},
  vuurimp:{n:'Fire Imp',kind:'imp',col:0xc8401a,lv:[10,11],aggro:15,spd:6.2,size:.8,xpM:1,ranged:16,proj:'fire'},
  lavagolem:{n:'Lava Golem',kind:'golem',col:0x3a302a,lv:[11,12],aggro:12,spd:4.4,size:1.35,xpM:1.5,hpM:1.7},
  ignaroth:{n:'Ignaroth the Molten',kind:'golem',col:0x2a201c,lv:[12,12],aggro:18,spd:4.8,size:2.6,boss:1,elite:1,xpM:1.2,respawn:120,fire:1,hpM:1.5},
  vonk:{n:'Spark Imp',kind:'imp',col:0xff7a2a,lv:[10,10],aggro:40,spd:7,size:.65,xpM:.3,ranged:14,proj:'fire',add:1},
  /* Drakenrijk (niveau 13–20) */
  raptor:{n:'Ash Raptor',kind:'raptor',col:0x5a5550,lv:[13,14],aggro:15,spd:7.4,size:1.1,xpM:1},
  vleer:{n:'Fire Bat',kind:'bat',col:0x3a1410,lv:[14,15],aggro:15,spd:6.8,size:.9,xpM:1,hover:1.6},
  welp:{n:'Dragon Whelp',kind:'dragon',col:0xb83a1a,lv:[15,16],aggro:15,spd:6.2,size:1.25,xpM:1.05,ranged:14,proj:'fire'},
  drakonier:{n:'Dragon Priest',kind:'human',col:0x8a2a1a,lv:[16,17],aggro:17,spd:5.4,size:1,xpM:1.1,ranged:18,proj:'fire',wt:'staf'},
  lavadrake:{n:'Lava Drake',kind:'trex',col:0x2a1a16,lv:[17,18],aggro:16,spd:5.8,size:2.3,elite:1,xpM:1,hpM:1.2,respawn:75},
  broedling:{n:'Fire Broodling',kind:'dragon',col:0xd85a1a,lv:[19,19],aggro:40,spd:7.2,size:.95,xpM:.3,ranged:12,proj:'fire',add:1},
  /* the Woods of Elvia (level 20–25) */
  elvwolf:{n:'Thornfang Wolf',kind:'wolf',col:0x5a6a4a,lv:[20,21],aggro:14,spd:7.2,size:1.15,xpM:1},
  elvspider:{n:'Silkweaver',kind:'spider',col:0x2a4a3a,lv:[21,22],aggro:13,spd:6,size:1.3,xpM:1.05},
  elvbandit:{n:'Greenwood Outlaw',kind:'human',col:0x3a5a2a,lv:[21,22],aggro:15,spd:6,size:1,xpM:1.05,wt:'zwaard'},
  outlawking:{n:'Rook, the Greenwood King',kind:'human',col:0x2a4a1a,lv:[23,23],aggro:16,spd:6,size:1.35,elite:1,xpM:1,wt:'bijl',respawn:120},
  fenraptor:{n:'Fen Raptor',kind:'raptor',col:0x4a6a3a,lv:[22,23],aggro:16,spd:8,size:1.2,xpM:1.05},
  mossbrute:{n:'Moss Brute',kind:'golem',col:0x5a6a3a,lv:[22,24],aggro:13,spd:5,size:1.45,xpM:1.3,hpM:1.6},
  elvwisp:{n:'Silverfall Wisp',kind:'imp',col:0x9affd8,lv:[23,24],aggro:16,spd:6.4,size:.9,xpM:1.1,ranged:18,hover:1.4},
  elderstag:{n:'Elder Stag',kind:'boar',col:0xc8b8a0,lv:[24,24],aggro:10,spd:7,size:1.6,elite:1,xpM:1,respawn:90},
  oakheart:{n:'Oakheart the Ancient',kind:'trex',col:0x3a5a2a,lv:[25,25],aggro:18,spd:5.6,size:3.4,elite:1,xpM:1.4,hpM:2.6,dmgM:1.25,respawn:240},
  /* the Thornroot Hollow (dungeon under Thornwood, level 23–25) */
  thornspider:{n:'Thornroot Lurker',kind:'spider',col:0x2a3a22,lv:[23,24],aggro:14,spd:6.4,size:1.45,xpM:1.15},
  blightseer:{n:'Blighted Seer',kind:'human',col:0x4a3a5a,lv:[24,24],aggro:17,spd:5.4,size:1,xpM:1.2,ranged:18,proj:'venom',wt:'staf'},
  brambleguard:{n:'Bramble Guardian',kind:'golem',col:0x4a3a22,lv:[24,25],aggro:13,spd:5,size:1.6,xpM:1.45,hpM:1.8},
  thornwarden:{n:'The Thornwarden',kind:'golem',col:0x3a2a16,lv:[25,25],aggro:16,spd:5.2,size:2.2,elite:1,xpM:1.3,hpM:2.6,dmgM:1.2,respawn:150},
  silkling:{n:'Silkling',kind:'spider',col:0x8aa86a,lv:[24,24],aggro:40,spd:7.2,size:.75,xpM:.3,add:1},
  silkmother:{n:'Veyrith the Silkmother',kind:'spider',col:0x1a2a14,lv:[25,25],aggro:24,spd:5.8,size:3.6,boss:1,elite:1,dmgM:1.5,xpM:1.8,hpM:4.4,respawn:300},
  /* the Nether Rift (level 25–50) */
  riftwraith:{n:'Rift Wraith',kind:'imp',col:0x5a3a8a,lv:[25,27],aggro:15,spd:6.2,size:1,xpM:1,ranged:18,proj:'shadow',hover:1.1},
  voidimp:{n:'Void Imp',kind:'imp',col:0x6a2a9a,lv:[26,28],aggro:15,spd:6.8,size:.95,xpM:1,hover:1.3},
  voidooze:{n:'Void Ooze',kind:'golem',col:0x7a2a8a,lv:[27,29],aggro:12,spd:4.8,size:1.15,xpM:1.1,hpM:1.4},
  grimshard:{n:'Grimshard the Hungering',kind:'golem',col:0x4a2a7a,lv:[30,30],aggro:16,spd:5.2,size:2.2,elite:1,xpM:1.2,hpM:2.2,dmgM:1.15,respawn:120},
  shardgnasher:{n:'Shard Gnasher',kind:'golem',col:0x7ab8e8,lv:[30,32],aggro:13,spd:5,size:1.2,xpM:1.1,hpM:1.4},
  prismraptor:{n:'Prism Raptor',kind:'raptor',col:0x8ac8ff,lv:[31,33],aggro:16,spd:8,size:1.15,xpM:1},
  shardling:{n:'Shardling',kind:'imp',col:0x9ad8ff,lv:[32,34],aggro:16,spd:6.4,size:1,xpM:1,ranged:18,proj:'frost',hover:1.4},
  crystalbehemoth:{n:'Crystal Behemoth',kind:'golem',col:0xa8d0ff,lv:[33,35],aggro:13,spd:5,size:1.5,xpM:1.35,hpM:1.7},
  colossus:{n:'The Prismatic Colossus',kind:'golem',col:0xc8e8ff,lv:[35,35],aggro:17,spd:5.2,size:2.5,elite:1,xpM:1.3,hpM:2.6,dmgM:1.2,respawn:150},
  voidspore:{n:'Voidspore',kind:'golem',col:0x5a3a7a,lv:[35,37],aggro:13,spd:5.2,size:1.15,xpM:1.05,hpM:1.2},
  mirelurker:{n:'Mire Lurker',kind:'human',col:0x2a7a7a,lv:[36,38],aggro:15,spd:6,size:1.15,xpM:1.05},
  netherray:{n:'Nether Ray',kind:'imp',col:0x9a3aa8,lv:[37,39],aggro:16,spd:6.6,size:1.1,xpM:1.05,ranged:18,proj:'venom',hover:1.6},
  hollowskull:{n:'Hollow Skull',kind:'imp',col:0xd8c8a8,lv:[38,40],aggro:17,spd:6.4,size:1.05,xpM:1.1,ranged:20,proj:'shadow',hover:1.3},
  vashk:{n:'Mycelord Vashk',kind:'human',col:0x6a3a8a,lv:[40,40],aggro:17,spd:5.6,size:2,elite:1,xpM:1.3,hpM:2.6,dmgM:1.2,respawn:150},
  voidstalker:{n:'Void Stalker',kind:'human',col:0x4a2a6a,lv:[40,42],aggro:16,spd:6.8,size:1.1,xpM:1.05},
  riftwalker:{n:'Riftwalker',kind:'human',col:0x2a4a8a,lv:[41,43],aggro:15,spd:6,size:1.2,xpM:1.15,hpM:1.3},
  voidassassin:{n:'Void Assassin',kind:'human',col:0x1a1a2a,lv:[42,44],aggro:17,spd:7.4,size:1,xpM:1.05},
  sentinel:{n:'Voidspire Sentinel',kind:'imp',col:0x8a6a3a,lv:[43,45],aggro:18,spd:6,size:1.15,xpM:1.1,ranged:22,proj:'arcane',hover:1.5},
  morvane:{n:'High Cultist Morvane',kind:'human',col:0x3a1a5a,lv:[45,45],aggro:18,spd:5.6,size:1.4,elite:1,xpM:1.3,hpM:2.4,dmgM:1.25,ranged:20,proj:'shadow',wt:'staf',respawn:150},
  voiddrake:{n:'Void Drake',kind:'dragon',col:0x3a1a5a,lv:[45,47],aggro:17,spd:6.6,size:1.4,xpM:1.1,ranged:16,proj:'shadow',hover:1.8},
  voidhorror:{n:'Voidspawn Horror',kind:'imp',col:0x6a1a8a,lv:[46,48],aggro:16,spd:6.4,size:1.3,xpM:1.15,hpM:1.3,hover:1.4},
  dreadlord:{n:'Dreadlord',kind:'human',col:0x5a1a2a,lv:[47,49],aggro:16,spd:6,size:1.35,xpM:1.3,hpM:1.6,dmgM:1.1},
  xalthuun:{n:"Xal'thuun the Void Wyrm",kind:'dragon',col:0x2a0a3a,lv:[50,50],aggro:22,spd:6.4,size:4.2,elite:1,xpM:3,hpM:7,dmgM:1.45,ranged:24,proj:'shadow',hover:2.6,respawn:600},
  voidchanter:{n:'Choir Voidchanter',kind:'human',col:0x3a1a5a,lv:[46,47],aggro:17,spd:5.6,size:1.05,xpM:1.2,hpM:1.2,ranged:20,proj:'arcane',wt:'staf'},
  sanctumknight:{n:'Hollow Knight of the Song',kind:'human',col:0x2a2a3a,lv:[47,48],aggro:16,spd:5.8,size:1.2,xpM:1.3,hpM:1.6,dmgM:1.1},
  korvax:{n:'Korvax the Shardbound',kind:'golem',col:0x3a2a6a,lv:[48,48],aggro:20,spd:5.2,size:2.8,boss:1,elite:1,dmgM:1.4,xpM:2,hpM:5,respawn:300},
  ilvaya:{n:'Seer Ilvaya',kind:'human',col:0x5a2a7a,lv:[49,49],aggro:22,spd:5.6,size:1.7,boss:1,elite:1,dmgM:1.45,xpM:2.2,hpM:4.6,ranged:22,proj:'arcane',wt:'staf',respawn:300},
  nyxathar:{n:'Nyxathar, the First Voice',kind:'human',col:0x1a0a2a,lv:[50,50],aggro:24,spd:6,size:3.4,boss:1,elite:1,dmgM:1.6,xpM:3,hpM:7.5,respawn:300},
  vyraxion:{n:'Vyraxion the Ash Queen',kind:'dragon',col:0x8a1a12,lv:[22,22],aggro:26,spd:6,size:4.2,boss:1,elite:1,dragon:1,dmgM:1.6,xpM:1.6,hpM:4,respawn:300,fire:1}
};
const QUESTS=[
  {id:'q1',n:'Boar Plague',giver:'wilma',lvl:1,txt:'Those wild boars plough up my fields before I can sow them! Please chase five of them off the fields south of the village.',obj:{kill:['ever'],n:5,lbl:'Wild Boar slain'},xp:160,gold:6,item:1,done:'Ha! Peace on my fields at last. Take this, it was lying in the barn.'},
  {id:'q2',n:'Wolves at the Gate',giver:'aldren',lvl:2,txt:'Dusk wolves creep closer to Silverbrook every night. Go into Twilight Wood, north of the village, and kill six of them.',obj:{kill:['wolf'],n:6,lbl:'Dusk Wolf slain'},xp:280,gold:10,item:1,done:'Good work, recruit. The watch will sleep a lot easier tonight.'},
  {id:'q3',n:'Spider Venom',giver:'mirla',lvl:3,txt:'For my healing draughts I need venom glands from the Forest Spiders deep in Twilight Wood, to the northwest. Bring me five.',obj:{collect:['spin'],n:5,chance:.6,lbl:'Venom Gland collected',item:'Venom Gland'},xp:420,gold:14,item:1,pots:3,done:'Splendid, and still fresh! Here, some potions for the road.'},
  {id:'q4',n:'The Bandit Camp',giver:'aldren',lvl:5,req:'q2',txt:'Bandits have pitched camp east of here and are raiding our caravans. Defeat six Highwaymen and their leader, Grisk.',obj:{kill:['rover','grisk'],n:7,lbl:'Bandits defeated'},xp:750,gold:25,item:2,done:'Grisk defeated? Then the roads are safe again. You\'ve earned this reward.'},
  {id:'q5',n:'Rest for the Dead',giver:'anselm',lvl:7,txt:'In the Crypt of Kaal-Morath, in the hills to the northwest, the dead are rising. Lay eight of them back to rest.',obj:{kill:['knekel','kmagier'],n:8,lbl:'Undead laid to rest'},xp:1100,gold:35,item:2,done:'Thank the Light. But I sense their master is still watching…'},
  {id:'ql1',n:'Herb Lore',giver:'mirla',lvl:1,txt:'Want to learn how to brew your own potions? Start at the beginning: pick six Sunleaf. You\'ll find those yellow, glowing little plants in the fields around the village. Walk up to one and press F (or tap Action).',obj:{gather:'Sunleaf',n:6,lbl:'Sunleaf picked'},xp:140,gold:4,life:{herbalism:60},done:'Nicely picked! Open your crafting book with K to see what you can make with it.'},
  {id:'ql2',n:'Fresh Fish',giver:'bram',lvl:1,txt:'My customers want fresh fish from Mirror Lake, west of the village. Stand on the shore, press F to fish and strike as soon as you get a bite. Catch three.',obj:{fish:1,n:3,lbl:'Fish caught'},xp:180,gold:12,life:{fishing:80},done:'What a catch! I\'ll sell those today.'},
  {id:'ql3',n:'A Taste of Cooking',giver:'wilma',lvl:2,req:'ql2',txt:'A hungry farmer is a lazy farmer. Grill two fish at the cooking fire next to the fountain. Grilled fish gives you extra health, by the way.',obj:{craft:'gvis',n:2,lbl:'Grilled Fish cooked'},xp:220,gold:10,life:{cooking:90},done:'Delicious! You\'ll make a real cook yet.'},
  {id:'q6',n:'The Bone King',giver:'anselm',lvl:8,req:'q5',txt:'Kaal-Morath, the Bone King, sits on his throne deep in the crypt. As long as he exists, the dead will keep rising. Gather allies and defeat him.',obj:{kill:['boss'],n:1,lbl:'Kaal-Morath defeated'},xp:2400,gold:80,item:3,done:'You have done the impossible. Silverbrook will sing your name, hero!'},
  {id:'q7',n:'Fire in the Deep',giver:'dorrik',lvl:10,txt:'Ever since the mine broke through into the Fire Cave, imps and lava golems have been crawling out. Go into the cave behind me and defeat ten of them.',obj:{kill:['vuurimp','lavagolem'],n:10,lbl:'Fire creatures defeated'},xp:2600,gold:60,item:2,done:'That cools things down a bit. But the heart of the cave is still glowing…'},
  {id:'d1',n:'Raptors on the Plain',giver:'vaelra',lvl:13,txt:'Welcome to the Dragon Realm, adventurer. First things first: packs of Ash Raptors hunt anything that moves north of our camp. Thin them out: ten of them.',obj:{kill:['raptor'],n:10,lbl:'Ash Raptor slain'},xp:3200,gold:70,item:2,done:'Fast and vicious, those beasts. Good work. Now we can look further.'},
  {id:'d2',n:'Fire in the Sky',giver:'vaelra',lvl:14,req:'d1',txt:'Above the Fire Fields, north of the volcano, Fire Bats swarm. Every night they nearly set our camp ablaze. Bring eight of them down.',obj:{kill:['vleer'],n:8,lbl:'Fire Bat slain'},xp:3700,gold:80,item:2,done:'Finally a night without a rain of sparks. Thank you.'},
  {id:'d3',n:'The Brood of Vyraxion',giver:'vaelra',lvl:15,req:'d2',txt:'In the nests south of the volcano, Vyraxion\'s eggs have hatched. If those whelps grow up, we are lost. Defeat ten Dragon Whelps.',obj:{kill:['welp'],n:10,lbl:'Dragon Whelp defeated'},xp:4300,gold:95,item:2,done:'The brood has been thinned. But the mother… she will not forget this.'},
  {id:'d4',n:'The Dragon Priests',giver:'vaelra',lvl:16,req:'d3',txt:'At the shrines in the east, fanatical Dragon Priests worship the Ash Queen and feed her with their fire. Break their power: defeat eight of them.',obj:{kill:['drakonier'],n:8,lbl:'Dragon Priest defeated'},xp:4900,gold:110,item:3,done:'Their chants have fallen silent. You are stronger than I thought.'},
  {id:'d5',n:'Giants of Lava',giver:'vaelra',lvl:17,req:'d4',txt:'Lava Drakes stomp around the flanks of the volcano: huge beasts with a hide of cooled rock. Defeat three of them. Bring potions.',obj:{kill:['lavadrake'],n:3,lbl:'Lava Drake defeated'},xp:5600,gold:130,item:3,done:'Three! You are ready for what is to come.'},
  {id:'d6',n:'The Heart of the Volcano',giver:'vaelra',lvl:19,req:'d5',txt:'Halfway up the western flank of the volcano lies the entrance to its heart. There Vyraxion the Ash Queen lies upon her hoard. She takes flight, breathes fire and calls her brood. Dodge her breath, stay out of the fire, and defeat her. Whoever fells her receives a legendary piece of gear from her hoard.',obj:{kill:['vyraxion'],n:1,lbl:'Vyraxion defeated'},xp:12000,gold:400,item:3,done:'Vyraxion has fallen! The Dragon Realm is free, and your name will be sung in every song, Dragonslayer.'},
  {id:'c1',n:'Fire in the Forge',giver:'hilde',lvl:2,txt:'Every smith starts with a bar. Mine Iron Ore from the veins in the hills and around the old mine, then smelt three Iron Bars at my forge here in the Artisans\' Yard.',obj:{craft:'ironbar',n:3,lbl:'Iron Bar smelted'},xp:260,gold:8,life:{smithing:120},done:'Good, solid bars. You have the arms for this work.'},
  {id:'c2',n:'Hides and Threads',giver:'hilde',lvl:3,req:'c1',txt:'Leather is just as important as steel. Loot a boar or a wolf, press F on its body to skin it, and tan two pieces of Leather at the tannery.',obj:{craft:'leather',n:2,lbl:'Leather tanned'},xp:320,gold:10,life:{leatherworking:120,skinning:80},done:'Nicely tanned. Soft, but it will stop a claw.'},
  {id:'c3',n:'Your First Masterpiece',giver:'hilde',lvl:4,req:'c2',txt:'Now make something worth wearing. Craft any Tier I armour piece or weapon: plate at the forge, leather at the tannery or cloth at the tailor\'s table. With luck it turns out Rare, or even a Masterwork!',obj:{craft:'gear1',n:1,lbl:'Tier I item crafted'},xp:480,gold:15,life:{tailoring:100},done:'Now that is craftsmanship! Keep at it and one day you will forge with Emberstone from the Dragon Realm.'},
  {id:'q8',n:'The Molten Heart',giver:'dorrik',lvl:11,req:'q7',txt:'Deep in the cave lives Ignaroth, a golem of lava as old as the mountains. As long as he lives, the cave keeps melting further. Bring friends and put out his fire.',obj:{kill:['ignaroth'],n:1,lbl:'Ignaroth defeated'},xp:5200,gold:150,item:3,done:'Ignaroth has been extinguished! The Ashen Hills are forever grateful, hero.'},
  /* ---- the Woods of Elvia: WindStorm's questline (level 20–25) ---- */
  {id:'en1',n:'The Arcane Arts',giver:'ysolde',lvl:2,txt:'Enchanting starts with taking things apart. Open your bag, click a piece of gear you no longer need and choose Disenchant. Do it twice and bring me what you learn.',obj:{dis:1,n:2,lbl:'Items disenchanted'},xp:240,gold:8,life:{enchanting:120},done:'See how the dust glimmers? That is the magic that was bound inside. Now we bind it again.'},
  {id:'en2',n:'A Spark of Power',giver:'ysolde',lvl:3,req:'en1',txt:'Stand at my altar, open your crafting book (K), choose Enchanting and give your weapon the Flametongue enchantment. Watch it burn!',obj:{craft:'ench',n:1,lbl:'Weapon enchanted'},xp:420,gold:12,life:{enchanting:160},done:'Beautiful! Every element has its own light. Find Archmage Sabine in WindStorm one day; her altar draws on far older magic.'},
  {id:'e1',n:'A Capital in the Woods',giver:'corwin',lvl:19,txt:'So you crossed the Dragon Realm to reach us? Then you are no ordinary sellsword. The Thornfang wolves of the Whispering Glade, west of the city, have been dragging off our woodcutters. Thin the pack: eight of them.',obj:{kill:['elvwolf'],n:8,lbl:'Thornfang Wolf slain'},xp:5200,gold:60,item:2,done:'Eight! The woodcutters will sing your name tonight. WindStorm needs heroes like you.'},
  {id:'e2',n:'Silk and Venom',giver:'liora',lvl:20,txt:'The Silkweavers of Thornwood, east of the city, spin webs across our patrol paths. My rangers need antivenom, and for that we need their glands. Bring me six.',obj:{collect:['elvspider'],n:6,chance:.6,lbl:'Silkweaver Gland collected',item:'Silkweaver Gland'},xp:5600,gold:65,pots:3,done:'Good hunting. These will save lives out in Thornwood.'},
  {id:'e3',n:'Outlaws of Fernwater',giver:'liora',lvl:21,req:'e2',txt:'An outlaw band has made camp on the shore of Fernwater, far to the south-west. They rob every caravan to the Dragon Realm. Break them: seven outlaws and their self-crowned king, Rook.',obj:{kill:['elvbandit','outlawking'],n:8,lbl:'Outlaws defeated'},xp:7400,gold:90,item:2,done:'Rook\'s crown of twigs, ha! The roads are safe again. Well done.'},
  {id:'e4',n:'The Moss Brutes',giver:'corwin',lvl:22,req:'e1',txt:'Up in the Elvian Highlands, north of the waterfalls, Moss Brutes are tearing down our watchtowers. Take the path up the cliffs east of Moonmere and destroy seven of them.',obj:{kill:['mossbrute'],n:7,lbl:'Moss Brute destroyed'},xp:8200,gold:100,item:2,done:'The towers stand again. The Highlands are ours once more.'},
  {id:'e5',n:'Wisps of Silverfall',giver:'sabine',lvl:22,txt:'The wisps around Silverfall Lake have turned hostile, and the cathedral\'s wards are failing. Something has poisoned the falls. Dispel six wisps so I can study the residue.',obj:{kill:['elvwisp'],n:6,lbl:'Wisp dispelled'},xp:8000,gold:95,pots:3,done:'Fascinating… this is old magic, older than WindStorm itself. Keep your eyes open, hero.'},
  {id:'e6',n:'Lake Bounty',giver:'tomas',lvl:19,txt:'The harbour market wants fresh fish from the lakes of Elvia. Fish from the shore of any lake here, Lake Elvia right outside the harbour is fine. Five fish will do.',obj:{fish:1,n:5,lbl:'Fish caught'},xp:3200,gold:45,life:{fishing:200},done:'Silverfins as long as my arm! You have a gift, friend.'},
  {id:'e7',n:'Moonpetals',giver:'elinor',lvl:19,txt:'Moonpetal only grows in the deep woods of Elvia and it is the base of every remedy we make. Pick six for me. You will need some skill in herbalism.',obj:{gather:'Moonpetal',n:6,lbl:'Moonpetal picked'},xp:3400,gold:45,life:{herbalism:220},done:'Lovely and fresh! Come back to me whenever you need potions.'},
  {id:'e8',n:'Fen Raptors',giver:'sabine',lvl:23,req:'e5',txt:'Raptors from the fens near Moonmere have started hunting the wisps\' poison, and it makes them savage. Cull eight of them before they reach the farms.',obj:{kill:['fenraptor'],n:8,lbl:'Fen Raptor slain'},xp:9600,gold:110,item:2,done:'Their blood glows… the poison spreads. We must find its source.'},
  {id:'e9',n:'The Elder Stags',giver:'liora',lvl:24,req:'e3',txt:'Even the Elder Stags west of Lake Elvia have gone mad. It breaks my heart, but they must be put to rest. Bring me four of their great antlers.',obj:{collect:['elderstag'],n:4,chance:1,lbl:'Antler collected',item:'Antler of the Elder Stag'},xp:10800,gold:130,item:3,done:'Rest now, old ones. Thank you, hero. I could not have done it myself.'},
  {id:'e10',n:'Oakheart the Ancient',giver:'corwin',lvl:25,req:'e4',txt:'Our scouts saw it at last: Oakheart, an ancient beast of moss and bark that walks the western Highlands. It is the heart of the poison. Gather your friends and bring it down.',obj:{kill:['oakheart'],n:1,lbl:'Oakheart defeated'},xp:14000,gold:250,item:3,done:'Oakheart has fallen! By the King\'s command, you are named a Champion of WindStorm.'},
  {id:'e11',n:'The Roots of the Poison',giver:'sabine',lvl:24,req:'e8',txt:'I followed the residue from the falls, and it does not end with Oakheart. It seeps up from beneath Thornwood, from the Thornroot Hollow under the roots of a dead giant in the far south-east. Take the road through Thornwood, go down into the Hollow and clear its tunnels: twelve of the creatures that guard it.',obj:{kill:['thornspider','blightseer','brambleguard'],n:12,lbl:'Hollow creatures slain'},xp:12500,gold:160,pots:4,done:'Seers… elves who drank from the poison and became its servants. Then something down there is feeding it. Something old.'},
  {id:'e12',n:'Veyrith the Silkmother',giver:'corwin',lvl:25,req:'e11',txt:'Sabine says the poison is spun, not brewed: a spider queen older than WindStorm, Veyrith the Silkmother, nests at the bottom of the Thornroot Hollow. Her guardian, the Thornwarden, blocks the way. Take your strongest friends, cut through, and end her.',obj:{kill:['silkmother'],n:1,lbl:'Silkmother slain'},xp:18000,gold:320,item:3,done:'The rivers run clear again. Elvia is free, and so is WindStorm. Whatever you ask of this city, hero, it is yours.'},
  /* ---- the Nether Rift: "The Song of the Void" (level 25–50) ---- */
  {id:'r1',n:'Beyond the Gate',giver:'kaelen',lvl:25,txt:'So the Gate let you through. Good. Riftwatch holds, but only just: Rift Wraiths drift in from the Shattered Approach, west of here, and feed on anything warm. Cross the western bridges and lay eight of them to rest.',obj:{kill:['riftwraith'],n:8,lbl:'Rift Wraith dispelled'},xp:3800,gold:70,item:2,done:'Eight! The watch on the west wall will sleep tonight. Welcome to the Rift Wardens, hero.'},
  {id:'r2',n:'Imps in the Stores',giver:'tessa',lvl:26,txt:'Void Imps! Little horned thieves, they come over the western bridges at night and chew through my crates. Their horns are worth something to the Voidseer, so bring me six while you are at it.',obj:{collect:['voidimp'],n:6,chance:.6,lbl:'Imp Horn collected',item:'Imp Horn'},xp:4000,gold:75,pots:4,done:'Six horns, and not a crate chewed tonight. Take some potions, on the house.'},
  {id:'r3',n:'Echoes in the Ooze',giver:'nyra',lvl:27,txt:'The Void Oozes of the Shattered Approach hum the same note as the crystals, only lower, like an echo. I need to hear it up close. Burst eight of them and let me listen to what is left.',obj:{kill:['voidooze'],n:8,lbl:'Void Ooze burst'},xp:4300,gold:80,item:2,done:'Yes… a deep, slow note. The whole Rift is singing one song, and something far away is conducting it.'},
  {id:'r4',n:'Grimshard the Hungering',giver:'kaelen',lvl:29,req:'r1',txt:'Our scouts found the reason the Approach is crawling with creatures: Grimshard, a mass of void-crystal that eats everything that moves, on the westernmost island. Take friends. Break it.',obj:{kill:['grimshard'],n:1,lbl:'Grimshard shattered'},xp:11000,gold:180,item:3,done:'Grimshard is shards and dust. The Approach is ours. Now go north: Warden Sela holds a camp on the Crystal Wastes and she needs help.'},
  {id:'r5',n:'The Singing Shards',giver:'sela',lvl:30,txt:'Welcome to the Wastes. Everything here sings, and the Shard Gnashers sing loudest: they swarm anyone who walks between the crystals. Clear ten of them so my wardens can scout.',obj:{kill:['shardgnasher'],n:10,lbl:'Shard Gnasher shattered'},xp:5200,gold:95,item:2,done:'Quieter already. You hear how the crystals hum on? That is not the Gnashers. That is the island itself.'},
  {id:'r6',n:'Prism Hunt',giver:'sela',lvl:31,txt:'Prism Raptors run the Wastes in packs. Their scales split light like glass, and Riftwatch\'s armourer wants them to temper his steel. Bring me six Prismatic Scales.',obj:{collect:['prismraptor'],n:6,chance:.55,lbl:'Prismatic Scale collected',item:'Prismatic Scale'},xp:5500,gold:100,item:2,done:'Beautiful. Oswin will be pleased, and so am I: fewer raptors, fewer funerals.'},
  {id:'r7',n:'Wings of Glass',giver:'nyra',lvl:32,txt:'Shardlings, little winged things of crystal, carry the song from island to island. If we silence enough of them, perhaps I can hear where it comes from. Eight should do.',obj:{kill:['shardling'],n:8,lbl:'Shardling silenced'},xp:5800,gold:105,item:2,done:'There. A gap in the song, and through the gap… a heartbeat, far to the north-east. Under the Throne of the Void.'},
  {id:'r8',n:'Behemoths of the Wastes',giver:'sela',lvl:33,req:'r5',txt:'On the high island east of the Wastes walk the Crystal Behemoths: beasts of ice-blue crystal that crush tents for sport. My wardens will not go there. Six of them, and we can build a second camp.',obj:{kill:['crystalbehemoth'],n:6,lbl:'Crystal Behemoth felled'},xp:6300,gold:115,item:2,done:'Six! You fight like a whole squad of wardens.'},
  {id:'r9',n:'The Prismatic Colossus',giver:'sela',lvl:35,req:'r8',txt:'In the middle of the eastern island stands the Prismatic Colossus, the largest crystal beast we have ever seen. Every Behemoth on that island answers to it. Bring a group and bring it down.',obj:{kill:['colossus'],n:1,lbl:'Colossus felled'},xp:15000,gold:260,item:3,done:'The Colossus has fallen and the Wastes are silent for the first time. Druid Fennick in the Twisted Grove, east of Riftwatch, sent word: something is rotting there.'},
  {id:'r10',n:'Rot in the Roots',giver:'fennick',lvl:35,txt:'Ah, a hero, at last. The trees of the Grove were already strange when they fell into the Rift, but now Voidspores grow between their roots and poison everything. Pull up ten of them.',obj:{kill:['voidspore'],n:10,lbl:'Voidspore uprooted'},xp:6900,gold:120,item:2,done:'Already the leaves look brighter. Well, brighter for leaves that glow purple.'},
  {id:'r11',n:'Lurkers in the Mire',giver:'fennick',lvl:36,txt:'Mire Lurkers creep out of the dark pools between the trees and drag my seedlings into the water. Eight of them, please, before they reach my camp.',obj:{kill:['mirelurker'],n:8,lbl:'Mire Lurker slain'},xp:7300,gold:125,item:2,done:'Wet work, but well done.'},
  {id:'r12',n:'Barbs of the Nether Ray',giver:'nyra',lvl:37,txt:'Nether Rays glide over the Grove, and the barbs on their tails are hollow: they carry the song like a flute. Bring me six barbs and I will build something that can listen to it from far away.',obj:{collect:['netherray'],n:6,chance:.55,lbl:'Ray Barb collected',item:'Ray Barb'},xp:7700,gold:130,item:2,done:'A listening crystal… listen. It is coming from the Throne, as I feared. And someone is singing along. From the Voidspire Ruins.'},
  {id:'r13',n:'Hollow Skulls',giver:'fennick',lvl:38,req:'r10',txt:'On the north-eastern island of the Grove float the Hollow Skulls: dead things filled with void-fire. My druid sense says they guard something. Clear eight.',obj:{kill:['hollowskull'],n:8,lbl:'Hollow Skull extinguished'},xp:8300,gold:140,item:2,done:'They guarded a ring of mushrooms… and in the middle of it sits something that thinks it is a king.'},
  {id:'r14',n:'Mycelord Vashk',giver:'fennick',lvl:40,req:'r13',txt:'Mycelord Vashk, a mushroom grown fat on the void, rules the north-eastern island. Every spore in the Grove is his. Gather friends and cut him down at the stem.',obj:{kill:['vashk'],n:1,lbl:'Vashk cut down'},xp:19000,gold:320,item:3,done:'Vashk is compost! The Grove can breathe. Archivist Pell, in the Voidspire Ruins south of Riftwatch, has been asking for you.'},
  {id:'r15',n:'The Fallen City',giver:'pell',lvl:40,txt:'These ruins were a city once, Voidspire, before the Rift swallowed it. I came to read its walls, but Void Stalkers hunt between them. Ten of them, please, so I can work.',obj:{kill:['voidstalker'],n:10,lbl:'Void Stalker slain'},xp:9000,gold:150,item:2,done:'Thank you. The walls speak of a cult that opened the Rift on purpose. And they are still here.'},
  {id:'r16',n:'Riftwalkers',giver:'pell',lvl:41,txt:'Riftwalkers stride through the ruins as if they own them. Perhaps they did, once. They tear down every wall I am still reading. Eight of them.',obj:{kill:['riftwalker'],n:8,lbl:'Riftwalker slain'},xp:9500,gold:160,item:2,done:'The inscriptions are safe. And they name the cult: the Choir of the Void.'},
  {id:'r17',n:'The Choir\'s Cipher',giver:'nyra',lvl:42,txt:'The Choir of the Void writes in a cipher. Its Assassins and Sentinels on the southern islands carry pages of it. Bring me six pages and I will read what they are singing for.',obj:{collect:['voidassassin','sentinel'],n:6,chance:.5,lbl:'Cipher Page collected',item:'Cipher Page'},xp:10000,gold:170,item:2,done:'They sing to wake it. Xal\'thuun, the Void Wyrm, sleeping beneath the Throne. Every note brings it closer to waking.'},
  {id:'r18',n:'Sentinels of the Spire',giver:'pell',lvl:43,req:'r15',txt:'Masked Sentinels guard the high island of the ruins, where the Choir\'s leader hides. Bring down six so we can get close.',obj:{kill:['sentinel'],n:6,lbl:'Sentinel downed'},xp:10600,gold:180,item:2,done:'The way is open. At the top waits High Cultist Morvane, the Choir\'s voice.'},
  {id:'r19',n:'High Cultist Morvane',giver:'pell',lvl:45,req:'r18',txt:'Morvane leads the Choir from the high island of the Voidspire Ruins. Silence her, and the song loses its voice. Take your strongest friends.',obj:{kill:['morvane'],n:1,lbl:'Morvane silenced'},xp:24000,gold:400,item:3,done:'Morvane is silent. But the song does not stop… it sings by itself now. Captain Ardyn, at the bridge to the Throne, waits for you.'},
  {id:'r20',n:'Drakes of the Void',giver:'ardyn',lvl:45,txt:'You are the one who silenced Morvane? Then you can help me. Void Drakes circle the Throne of the Void, north-east of here across the long bridge. Bring down ten.',obj:{kill:['voiddrake'],n:10,lbl:'Void Drake downed'},xp:11300,gold:190,item:2,done:'Ten drakes! The bridge is ours again.'},
  {id:'r21',n:'Horrors from Below',giver:'ardyn',lvl:46,txt:'Voidspawn Horrors crawl up from beneath the Throne island. Nyra says they are the Wyrm\'s dreams, given teeth. Eight of them.',obj:{kill:['voidhorror'],n:8,lbl:'Voidspawn Horror slain'},xp:11900,gold:200,item:2,done:'If those are its dreams, I do not want to see it awake.'},
  {id:'r22',n:'The Dreadlords',giver:'ardyn',lvl:47,req:'r20',txt:'Dreadlords guard the Throne: demons that once served the Choir and now serve only the Wyrm. Seven of them, hero. After that, only the Wyrm remains.',obj:{kill:['dreadlord'],n:7,lbl:'Dreadlord slain'},xp:12600,gold:220,item:3,done:'The guards have fallen. Commander Kaelen wants you back at Riftwatch. It is time.'},
  {id:'r23',n:'The Song Ends',giver:'kaelen',lvl:48,req:'r22',txt:'Xal\'thuun has woken. It circles the Throne of the Void, and as long as it lives, the Rift keeps growing. Gather the strongest heroes you know, cross the long bridge, and end the song. All of Velmora is counting on you.',obj:{kill:['xalthuun'],n:1,lbl:'Xal\'thuun slain'},xp:52000,gold:1200,item:4,done:'The Wyrm is dead and the song has stopped. Listen… for the first time, the Rift is silent. By order of Riftwatch, you are named Voidbreaker. No one in Velmora will forget this.'},
  {id:'r24',n:'Beneath the Throne',giver:'nyra',lvl:48,req:'r23',txt:'The Wyrm is dead, yet I can still hear it: the Song. It comes from beneath the Throne of the Void. On the far side of the island, away from the long bridge, a gate has opened that was not there before: the Sanctum of the Silent Song, where the Choir first sang. Its door is held by Korvax, a guardian grown from the crystal of the Rift. Break him.',obj:{kill:['korvax'],n:1,lbl:'Korvax shattered'},xp:30000,gold:500,item:3,done:'Korvax is broken? Then the Sanctum is open. I have read every page of the Cipher, and one name keeps coming back: Ilvaya.'},
  {id:'r25',n:'Keepers of the Sanctum',giver:'ardyn',lvl:47,req:'r23',txt:'Riftwatch scouts say the Sanctum beneath the Throne is full of the Choir\'s dead: chanters still singing with no breath in them, and hollow knights in rusted plate. Put ten of them to rest.',obj:{kill:['voidchanter','sanctumknight'],n:10,lbl:'Sanctum keepers defeated'},xp:14000,gold:240,item:3,done:'Ten fewer voices in that choir. Good. Every one counts.'},
  {id:'r26',n:'The Last Seer',giver:'nyra',lvl:49,req:'r24',txt:'Ilvaya was the first Seer of the Choir, Morvane\'s sister. She did not die when the Rift opened: she became part of the Song. She waits in the great hall of the Sanctum, among the void pools. She steps through the Rift as easily as you walk, so do not stand where she stood.',obj:{kill:['ilvaya'],n:1,lbl:'Ilvaya silenced'},xp:36000,gold:600,item:3,done:'Her last words are in my notes now… "The Voice was here before us." Go to Kaelen. I fear what comes next.'},
  {id:'r27',n:'The First Voice',giver:'kaelen',lvl:50,req:'r26',txt:'Nyra is right: the Choir did not make the Song, they only answered it. At the bottom of the Sanctum sings Nyxathar, the First Voice, the thing that broke our sky. Gather the strongest heroes of Velmora, go down, and silence it forever. When the Song falls silent, run from where the void erupts.',obj:{kill:['nyxathar'],n:1,lbl:'Nyxathar silenced'},xp:60000,gold:2000,item:4,done:'It is over. Truly over this time; listen, the Rift is quiet to its very roots. Riftwatch has no title high enough for you, so we made a new one: Voice of Velmora.'},
];
/* the stable in Silverbrook (model: Quaternius, placed in 2_world.js) and Stablemaster Hob in front of it */
const STABLE={x:56,z:27,ry:0};const STABLE_PETS=[{id:'whitehorse',dx:-8,dz:-8,ry:2.5},{id:'donkey',dx:10,dz:-1,ry:-2.3}];const STABLE_NPC=[56,17.4,Math.PI*.92];
const NPCS=[
  {id:'aldren',n:'Captain Aldren',t:'Captain of the Watch',x:6,z:-14,ry:Math.PI,look:{skin:0xd9a98a,hair:0x5a4a3a,chest:0x3f5a9a,pants:0x2a2a30,cape:0x2a4a9a,wt:'zwaard',helm:1,beard:1},hi:'Keep your sword sharp and your eyes open, adventurer.'},
  {id:'mirla',n:'Herbwife Mirla',t:'Alchemist',x:-15,z:4,ry:Math.PI/2,look:{skin:0xf0d2b8,hair:0xd8d8e8,chest:0x4a7a3a,pants:0x3a5a2a,cape:0x2a4a2a,wt:'staf',ears:1},hi:'Herbs, roots and a pinch of magic. What can I do for you?'},
  {id:'wilma',n:'Farmer Wilma',t:'Farmer',x:4,z:44,ry:Math.PI,look:{skin:0xe2b48e,hair:0xc79a4b,chest:0x9a6a3a,pants:0x5a4a3a,wt:'none'},hi:'A fine day for ploughing, if it weren\'t for those boars.'},
  {id:'anselm',n:'Brother Anselm',t:'Priest of the Light',x:22,z:12,ry:-Math.PI/2,look:{skin:0xe2b48e,hair:0xd9d9d9,chest:0xe8e2d0,pants:0xd0c8b0,cape:0xd9b44a,wt:'staf',beard:1},hi:'May the Light illuminate your path, child.'},
  {id:'bram',n:'Merchant Bram',t:'Merchant',x:-8,z:-10,ry:0,look:{skin:0xd99b7a,hair:0xb5541c,chest:0x8a5a2a,pants:0x4a3a2a,wt:'none',beard:1,dwarf:1},hi:'Potions, fresh from the kettle! And I\'ll buy all your old junk.',shop:1},
  {id:'dorrik',n:'Miner Dorrik',t:'Mine Boss',x:198,z:-166,ry:Math.PI*.2,look:{skin:0xd99b7a,hair:0x6b4a2b,chest:0x6a5a4a,pants:0x3a3028,wt:'bijl',beard:1,dwarf:1,helm:1},hi:'Mind the heat, friend. Behind me lies Ignaroth\'s Fire Cave.'},
  {id:'vaelra',n:'Vaelra the Dragonhunter',t:'Dragonhunters\' Camp',x:-1736,z:20,ry:-Math.PI/2,look:{skin:0xd9a98a,hair:0x9a2a1a,chest:0x6a2a1a,pants:0x3a2a20,cape:0x6a1a10,wt:'boog'},hi:'Welcome to the Dragon Realm. Stay out of the lava, and always look up.'},
  {id:'hilde',n:'Forgemistress Hilde',t:'Master Artisan',x:-113.2,z:-10.4,ry:-2.78,look:{skin:0xe2b48e,hair:0xb04a1c,chest:0x6a4a3a,pants:0x3a3028,wt:'bijl',dwarf:1},hi:'Welcome to the Artisans\' Yard! Ore, hides and cloth go in; armour and weapons come out.'},
  {id:'thorne',n:'Warden Thorne',t:'Crypt Warden',x:-160,z:-196,ry:Math.PI*.85,look:{skin:0x6f9a4a,hair:0x1d1d1d,chest:0x5a5a5a,pants:0x2a2a2a,cape:0x5a1a1a,wt:'bijl',helm:1,tusks:1},hi:'The crypt behind me is no place for weaklings. Go with a group, or don\'t go at all.'},
  {id:'ysolde',n:'Enchantress Ysolde',t:'Master Enchanter',x:-104.6,z:-15.2,ry:-2.2,look:{skin:0xf0d2b8,hair:0x2a1a3a,chest:0x4a2a7a,pants:0x2a1a3a,cape:0x6a3aa8,wt:'staf',ears:1},hi:'Every blade remembers the hand that forged it. I teach it to remember fire, frost and starlight as well.'},
  {id:'hob',n:'Stablemaster Hob',t:'Stablemaster',x:STABLE_NPC[0],z:STABLE_NPC[1],ry:STABLE_NPC[2],look:{skin:0xd9a98a,hair:0x8a5a2a,chest:0x7a5a34,pants:0x3a3028,wt:'none',beard:1},hi:'Every hero needs a good mount. Mine are fed, shod and ready for the road. Pick one, and press R to ride!',stable:1}
];
/* tekstkleuren: licht genoeg voor de bruine panelen (met donkere schaduw), en verzadigd genoeg om ze te herkennen */
const RARITY=[{n:'Common',c:'#ffffff'},{n:'Uncommon',c:'#5dff73'},{n:'Rare',c:'#7cc0ff'},{n:'Epic',c:'#e0a3ff'},{n:'Legendary',c:'#ffab4a'}];
const SLOTS=['hoofd','schouders','rug','borst','handen','benen','voeten','ring','wapen','offhand'];
const SLOT_NL={wapen:'Main Hand',offhand:'Off Hand',hoofd:'Head',schouders:'Shoulders',rug:'Cloak',borst:'Chest',handen:'Hands',benen:'Legs',voeten:'Feet',ring:'Finger'};
const MAT={paladijn:['Blessed','Silvered','Consecrated','Templar'],krijger:['Iron','Steel','Chainmail','Battered'],magier:['Silk','Linen','Runic','Stardust'],jager:['Leather','Wolfhide','Scaled','Falconfeather']};
const BASE={offhand:{krijger:'Shield',paladijn:'Shield',magier:'Tome',jager:'Quiver'},schouders:{krijger:'Pauldrons',magier:'Mantle',jager:'Spaulders',paladijn:'Spaulders'},rug:{krijger:'Cape',magier:'Cloak',jager:'Cloak',paladijn:'Tabard Cape'},hoofd:{krijger:'Helm',magier:'Pointed Hat',jager:'Hood',paladijn:'Helm'},borst:{krijger:'Breastplate',magier:'Robe',jager:'Tunic',paladijn:'Chestguard'},handen:{krijger:'Gloves',magier:'Gloves',jager:'Gloves',paladijn:'Gauntlets'},benen:{krijger:'Legplates',magier:'Trousers',jager:'Trousers',paladijn:'Legguards'},voeten:{krijger:'Boots',magier:'Sandals',jager:'Boots',paladijn:'Sabatons'}};
const WEAP={paladijn:[['Warhammer','zwaard'],['Mace','zwaard'],['Greathammer','bijl'],['Greatsword','bijl']],krijger:[['Sword','zwaard'],['Axe','zwaard'],['Battleaxe','bijl'],['Greatsword','bijl']],magier:[['Staff','staf'],['Wand','zwaard']],jager:[['Bow','boog'],['Longbow','boog']]};
const SUFFIX=[['of the Bear',0,1],['of the Tiger',1,0],['of the Eagle',.6,.6],['of the Owl',.8,.3],['of the Wolf',.5,.7],['of the Light',.7,.5]];
const JUNK={ever:['Boar Tusk','Boar Bristles'],wolf:['Tattered Wolf Pelt','Broken Fang'],spin:['Cobweb Clump','Chitin Plate'],rover:['Stolen Handkerchief','Dice'],grisk:['Grisk\'s Earring'],knekel:['Yellowed Bone','Rusty Buckle'],kmagier:['Dusty Parchment'],boss:['Crown Shard'],dienaar:['Bone Splinter'],
  riftwraith:['Wisp of Shadow','Torn Shroud'],voidimp:['Imp Horn','Void-Singed Tail'],voidooze:['Glob of Void Slime'],grimshard:['Hungering Shard'],shardgnasher:['Cracked Shard','Crystal Tooth'],prismraptor:['Prismatic Scale','Glass Claw'],shardling:['Shardling Wing'],crystalbehemoth:['Crystal Knuckle','Shattered Geode'],colossus:['Heart of the Colossus'],
  voidspore:['Spore Sac','Rotten Cap'],mirelurker:['Slick Fin','Mire Pearl'],netherray:['Ray Barb','Iridescent Skin'],hollowskull:['Hollow Skull Fragment','Cold Ember'],vashk:["Vashk's Crown of Spores"],voidstalker:['Stalker Tendril','Void-Black Eye'],riftwalker:['Riftwalker Horn','Warped Club'],voidassassin:['Shadowsilk Mask','Notched Blade'],sentinel:['Sentinel Mask Shard','Gilded Feather'],morvane:["Morvane's Codex"],
  voiddrake:['Void Drake Fang','Night Scale'],voidhorror:['Writhing Tentacle'],dreadlord:['Dreadlord Horn','Infernal Chain'],xalthuun:["Xal'thuun's Eye"],voidchanter:['Choir Hymnal','Tattered Choir Robe'],sanctumknight:['Hollow Helm Shard','Song-Etched Bone'],korvax:['Shardbound Heart'],ilvaya:["Ilvaya's Veil"],nyxathar:['Echo of the First Voice']};
const ARM_SLOT={offhand:0,schouders:.8,rug:.5,hoofd:.9,borst:1.4,handen:.6,benen:1.1,voeten:.7,ring:0,wapen:0};
const xpNeed=l=>40*l+15*l*l;
const MAXLVL=50;
/* ===== life skills: gathering (mining, woodcutting, herbalism, skinning, fishing) and crafting (smithing, leatherworking,
   tailoring, cooking, alchemy). Icons with m: are thumbnails rendered from the downloaded 3D models. ===== */
const RANKS=['Novice','Apprentice','Journeyman','Expert','Artisan','Master','Grandmaster'];
const LIFE={
  mining:{n:'Mining',ic:'m:KT_pickaxe',kind:'gather',d:'Swing a pickaxe at ore veins.'},
  woodcutting:{n:'Woodcutting',ic:'m:KT_axe',kind:'gather',d:'Chop fallen trunks and saw planks at the sawmill.'},
  herbalism:{n:'Herbalism',ic:'m:KN_flower_yellowA|#ffd94a',kind:'gather',d:'Pick herbs and flax, grind herb powder anywhere.'},
  skinning:{n:'Skinning',ic:'m:KT_knife',kind:'gather',d:'Skin beasts you have looted for hides, silk and scales.'},
  fishing:{n:'Fishing',ic:'m:KS_fish',kind:'gather',d:'Cast a line from the shore of Mirror Lake.'},
  smithing:{n:'Smithing',ic:'m:KT_anvil',kind:'craft',st:'forge',d:'Smelt bars and forge plate armour, weapons and rings.'},
  leatherworking:{n:'Leatherworking',ic:'m:Q_Armor_Leather',kind:'craft',st:'tannery',d:'Tan hides and craft leather armour and bows.'},
  tailoring:{n:'Tailoring',ic:'m:KT_scissors',kind:'craft',st:'loom',d:'Weave cloth and sew robes and staves.'},
  cooking:{n:'Cooking',ic:'m:KF_pot-stew',kind:'craft',st:'fire',d:'Cook meals that grant buffs.'},
  alchemy:{n:'Alchemy',ic:'m:Q_Cauldron',kind:'craft',st:'cauldron',d:'Brew potions and elixirs.'}};
const LIFE_OLD={verzamelen:['mining','woodcutting','herbalism'],vissen:['fishing'],bewerken:['smithing'],koken:['cooking'],alchemie:['alchemy']};
const lifeNeed=l=>50+l*18;const rankOf=l=>RANKS[Math.min(6,Math.floor(l/10))]+' '+(l%10+1);
const MATS={
  'Iron Ore':{m:'Q_Mineral',t:'#c87a4a',price:1,tag:'ore'},'Silver Ore':{m:'Q_Mineral',t:'#dfe8f4',price:3,r:1,tag:'ore'},'Emberstone':{m:'Q_Mineral',t:'#ff6a2a',price:6,r:2,tag:'ore'},
  'Iron Bar':{m:'Q_Gold_Ingots',t:'=#8a9098',price:7},'Silver Bar':{m:'Q_Gold_Ingots',t:'=#dfe6ee',price:16,r:1},'Emberstone Bar':{m:'Q_Gold_Ingots',t:'=#e8622a',price:30,r:2},
  'Wood':{m:'KS_resource-wood',price:1,tag:'wood'},'Sturdy Wood':{m:'KS_resource-wood',t:'#8a6a50',price:4,tag:'wood',r:1},'Ashwood':{m:'KS_resource-wood',t:'#6a5a58',price:7,r:2},
  'Planks':{m:'KS_resource-planks',price:5},
  'Sunleaf':{m:'KN_flower_yellowA',t:'#ffe060',price:1,tag:'herb'},'Moonbloom':{m:'KN_flower_purpleA',t:'#8ab8ff',price:2,tag:'herb'},'Bloodroot':{m:'KN_flower_redA',t:'#ff6060',price:3,tag:'herb',r:1},
  'Fireblossom':{m:'KN_flower_redB',t:'#ffa040',price:7,tag:'herb',r:2},'Flax':{m:'KN_plant_flatTall',t:'#d8e8b0',price:1},
  'Herb Powder':{m:'KF_mortar-pestle',price:4},
  'Rough Hide':{m:'Q_Bag',t:'#9a7450',price:2},'Thick Hide':{m:'Q_Bag',t:'#6a4a34',price:5,r:1},'Drake Scale':{m:'Q_Crystal5',t:'#ff5a2a',price:9,r:2},'Spider Silk':{m:'KT_rope_bundle_A',t:'#f4f4ff',price:3},
  'Leather':{m:'Q_Bags',t:'#b07444',price:6},'Thick Leather':{m:'Q_Bags',t:'#74492c',price:14,r:1},'Drakeskin':{m:'Q_Bags',t:'#c0482a',price:28,r:2},
  'Linen':{m:'Q_Bag',t:'#f0e6cc',price:5},'Silk Cloth':{m:'Q_Bag',t:'#e8e4ff',price:13,r:1},'Emberweave':{m:'Q_Bag',t:'#ff7a4a',price:27,r:2},
  'Perch':{m:'KS_fish',t:'#a0b878',price:2,tag:'fish'},'Carp':{m:'KS_fish',t:'#d0a860',price:3,tag:'fish'},'Pike':{m:'KS_fish',t:'#709070',price:4,tag:'fish'},'Golden Perch':{m:'KS_fish',t:'#ffd040',price:12,tag:'fish',r:2},'Lake Phantom':{m:'KS_fish',t:'#c8a8ff',price:40,tag:'fish',r:3},
  'Raw Meat':{m:'KF_meat-raw',price:1},
  'Grilled Fish':{m:'KF_fish',t:'#d89050',price:6,food:{hp:.1,dur:600,d:'+10% health'}},"Hunter's Stew":{m:'KF_pot-stew',price:9,food:{pow:.08,dur:600,d:'+8% power'}},
  'Fish Soup':{m:'KF_pan-stew',price:18,r:1,food:{hp:.15,pow:.05,dur:900,d:'+15% health and +5% power'}},'Ember Roast':{m:'KF_meat-raw',t:'#c86a3a',price:30,r:2,food:{hp:.12,pow:.12,dur:1200,d:'+12% health and +12% power'}},
  'Elixir of Fury':{m:'KS_bottle',t:'#ff6a4a',price:14,r:1,elixir:{dmg:.15,dur:600,d:'+15% damage'}},'Elixir of Ironskin':{m:'KS_bottle',t:'#a8c0e0',price:14,r:1,elixir:{arm:.3,dur:600,d:'+30% armour'}},
  'Dragonfire Elixir':{m:'KS_bottle-large',t:'#ff8a30',price:36,r:2,elixir:{dmg:.12,arm:.2,dur:900,d:'+12% damage and +20% armour'}},
  /* the Woods of Elvia (tier IV) */
  'Mithril Ore':{m:'Q_Mineral',t:'#8ae0f0',price:10,r:3,tag:'ore'},'Mithril Bar':{m:'Q_Gold_Ingots',t:'=#a8e8f4',price:48,r:3},
  'Elderwood':{m:'KS_resource-wood',t:'#d8b884',price:11,r:3,tag:'wood'},'Moonpetal':{m:'KN_flower_purpleA',t:'#e0c8ff',price:11,tag:'herb',r:3},
  'Elvian Hide':{m:'Q_Bag',t:'#7a8a5a',price:9,r:2},'Elvenhide Leather':{m:'Q_Bags',t:'#6a7a44',price:44,r:3},'Moonsilk Thread':{m:'KT_rope_bundle_A',t:'#d8e4ff',price:8,r:2},'Moonsilk Cloth':{m:'Q_Bag',t:'#c8d8ff',price:44,r:3},
  'Silverfin Trout':{m:'KS_fish',t:'#c8dce8',price:6,tag:'fish',r:1},'Moonmere Eel':{m:'KS_fish',t:'#6a7aa8',price:9,tag:'fish',r:1},'Elvian Salmon':{m:'KS_fish',t:'#ff9a7a',price:16,tag:'fish',r:2},'Crown Pike':{m:'KS_fish',t:'#ffe08a',price:55,tag:'fish',r:3},
  'Silkweaver Gland':{m:'KS_bottle',t:'#8aff6a',price:4},'Imp Horn':{m:'D_Bones',t:'#8a5ad8',price:6},'Prismatic Scale':{m:'Q_Crystal5',t:'#aee8ff',price:9,r:1},'Ray Barb':{m:'D_Bones',t:'#d07aff',price:10,r:1},'Cipher Page':{m:'Q_Parchment',t:'#c8b8ff',price:12,r:1},'Antler of the Elder Stag':{m:'D_Bones',t:'#e8dcc0',price:20,r:2},
  'Elvian Feast':{m:'KF_pot-stew',t:'#a8c870',price:46,r:3,food:{hp:.16,pow:.14,dur:1500,d:'+16% health and +14% power'}},
  'Elixir of the Grove':{m:'KS_bottle-large',t:'#8affa8',price:50,r:3,elixir:{dmg:.15,arm:.25,dur:1200,d:'+15% damage and +25% armour'}},
  /* the Nether Rift (tiers V and VI) */
  'Riftstone Ore':{m:'Q_Mineral',t:'#9a7aff',price:14,r:3,tag:'ore'},'Riftsteel Bar':{m:'Q_Gold_Ingots',t:'=#a890ff',price:64,r:3},
  'Voidcrystal':{m:'Q_Crystal5',t:'#ff5ab8',price:22,r:4,tag:'ore'},'Voidforged Bar':{m:'Q_Gold_Ingots',t:'=#ff6ac8',price:95,r:4},
  'Voidwood':{m:'KS_resource-wood',t:'#7a5a9a',price:15,r:3,tag:'wood'},'Voidbloom':{m:'KN_flower_purpleA',t:'#c06aff',price:15,tag:'herb',r:3},'Starpetal':{m:'KN_flower_yellowA',t:'#aef4ff',price:24,tag:'herb',r:4},
  'Void Hide':{m:'Q_Bag',t:'#5a3a7a',price:13,r:3},'Voidhide Leather':{m:'Q_Bags',t:'#6a4a9a',price:60,r:3},'Wyrm Scale':{m:'Q_Crystal5',t:'#3a1a5a',price:24,r:4},'Wyrmscale Leather':{m:'Q_Bags',t:'#4a2a7a',price:92,r:4},
  'Starsilk Thread':{m:'KT_rope_bundle_A',t:'#c8f4ff',price:12,r:3},'Starweave Cloth':{m:'Q_Bag',t:'#aee8ff',price:60,r:3},'Nether Silk':{m:'KT_rope_bundle_A',t:'#ff9ae8',price:20,r:4},'Nethersilk Cloth':{m:'Q_Bag',t:'#e88ae8',price:92,r:4},
  "Riftwarden's Stew":{m:'KF_pot-stew',t:'#9a6ac8',price:60,r:3,food:{hp:.18,pow:.15,dur:1800,d:'+18% health and +15% power'}},'Starlight Feast':{m:'KF_pan-stew',t:'#aef4ff',price:90,r:4,food:{hp:.22,pow:.18,dur:2400,d:'+22% health and +18% power'}},
  'Elixir of the Void':{m:'KS_bottle-large',t:'#b06aff',price:64,r:3,elixir:{dmg:.18,arm:.28,dur:1500,d:'+18% damage and +28% armour'}},'Elixir of Starlight':{m:'KS_bottle-large',t:'#aef8ff',price:96,r:4,elixir:{dmg:.22,arm:.32,dur:1800,d:'+22% damage and +32% armour'}}
};
/* old Dutch item names → new names (save migration) */
const MAT_OLD={'Hout':'Wood','Stevig hout':'Sturdy Wood','IJzererts':'Iron Ore','Zilvererts':'Silver Ore','Zonnekruid':'Sunleaf','Maanbloem':'Moonbloom','Bloedwortel':'Bloodroot','Baars':'Perch','Karper':'Carp','Snoek':'Pike','Goudbaars':'Golden Perch','Meerspook':'Lake Phantom','Rauw vlees':'Raw Meat','Planken':'Planks','IJzerstaaf':'Iron Bar','Zilverstaaf':'Silver Bar','Kruidenpoeder':'Herb Powder','Gegrilde vis':'Grilled Fish','Jagersstoofpot':"Hunter's Stew",'Vissoep':'Fish Soup','Elixir van Woede':'Elixir of Fury','Elixir van IJzerhuid':'Elixir of Ironskin','Ruwe everhuid':'Rough Hide','Wolfspels':'Rough Hide','Spinrag':'Spider Silk'};
/* processing and consumables. st = station; tag = any material with that tag */
const RECIPES=[
  {id:'planks',sk:'woodcutting',st:'sawmill',out:'Planks',q:1,in:[['Wood',3,'wood']],lv:0,t:2.2},
  {id:'powder',sk:'herbalism',out:'Herb Powder',q:1,in:[['Herb',3,'herb']],lv:0,t:1.6},
  {id:'ironbar',sk:'smithing',st:'forge',out:'Iron Bar',q:1,in:[['Iron Ore',3]],lv:0,t:2.2},
  {id:'silverbar',sk:'smithing',st:'forge',out:'Silver Bar',q:1,in:[['Silver Ore',3]],lv:10,t:2.4},
  {id:'emberbar',sk:'smithing',st:'forge',out:'Emberstone Bar',q:1,in:[['Emberstone',3],['Wood',1,'wood']],lv:22,t:2.6},
  {id:'leather',sk:'leatherworking',st:'tannery',out:'Leather',q:1,in:[['Rough Hide',2]],lv:0,t:2.2},
  {id:'thickleather',sk:'leatherworking',st:'tannery',out:'Thick Leather',q:1,in:[['Thick Hide',2]],lv:10,t:2.4},
  {id:'drakeskin',sk:'leatherworking',st:'tannery',out:'Drakeskin',q:1,in:[['Drake Scale',2],['Fireblossom',1]],lv:22,t:2.6},
  {id:'linen',sk:'tailoring',st:'loom',out:'Linen',q:1,in:[['Flax',3]],lv:0,t:2.2},
  {id:'silk',sk:'tailoring',st:'loom',out:'Silk Cloth',q:1,in:[['Spider Silk',3]],lv:10,t:2.4},
  {id:'emberweave',sk:'tailoring',st:'loom',out:'Emberweave',q:1,in:[['Silk Cloth',2],['Fireblossom',1]],lv:22,t:2.6},
  {id:'gvis',sk:'cooking',st:'fire',out:'Grilled Fish',q:1,in:[['Fish',1,'fish'],['Sunleaf',1]],lv:0,t:2},
  {id:'stoof',sk:'cooking',st:'fire',out:"Hunter's Stew",q:1,in:[['Raw Meat',2],['Moonbloom',1]],lv:4,t:2.2},
  {id:'soep',sk:'cooking',st:'fire',out:'Fish Soup',q:1,in:[['Fish',2,'fish'],['Bloodroot',1],['Herb Powder',1]],lv:12,t:2.6},
  {id:'roast',sk:'cooking',st:'fire',out:'Ember Roast',q:1,in:[['Raw Meat',2],['Fireblossom',1],['Herb Powder',1]],lv:24,t:2.8},
  {id:'heal',sk:'alchemy',st:'cauldron',out:'Healing Potion',q:2,in:[['Sunleaf',2],['Herb Powder',1]],lv:0,t:2,potion:'heal'},
  {id:'mana',sk:'alchemy',st:'cauldron',out:'Power Potion',q:2,in:[['Moonbloom',2],['Herb Powder',1]],lv:2,t:2,potion:'mana'},
  {id:'woede',sk:'alchemy',st:'cauldron',out:'Elixir of Fury',q:1,in:[['Bloodroot',2],['Iron Bar',1]],lv:8,t:2.6},
  {id:'ijzerhuid',sk:'alchemy',st:'cauldron',out:'Elixir of Ironskin',q:1,in:[['Iron Bar',1],['Moonbloom',2],['Herb Powder',1]],lv:10,t:2.6},
  {id:'drakvuur',sk:'alchemy',st:'cauldron',out:'Dragonfire Elixir',q:1,in:[['Fireblossom',2],['Drake Scale',1],['Herb Powder',1]],lv:24,t:3},
  {id:'mithrilbar',sk:'smithing',st:'forge',out:'Mithril Bar',q:1,in:[['Mithril Ore',3],['Elderwood',1]],lv:34,t:2.8},
  {id:'elvleather',sk:'leatherworking',st:'tannery',out:'Elvenhide Leather',q:1,in:[['Elvian Hide',2],['Moonpetal',1]],lv:34,t:2.8},
  {id:'moonsilk',sk:'tailoring',st:'loom',out:'Moonsilk Cloth',q:1,in:[['Moonsilk Thread',3],['Moonpetal',1]],lv:34,t:2.8},
  {id:'feast',sk:'cooking',st:'fire',out:'Elvian Feast',q:1,in:[['Fish',2,'fish'],['Raw Meat',1],['Moonpetal',1]],lv:36,t:3},
  {id:'grove',sk:'alchemy',st:'cauldron',out:'Elixir of the Grove',q:1,in:[['Moonpetal',2],['Silkweaver Gland',1],['Herb Powder',1]],lv:36,t:3.2},
  {id:'riftbar',sk:'smithing',st:'forge',out:'Riftsteel Bar',q:1,in:[['Riftstone Ore',3],['Voidwood',1]],lv:46,t:3},
  {id:'voidbar',sk:'smithing',st:'forge',out:'Voidforged Bar',q:1,in:[['Voidcrystal',3],['Riftsteel Bar',1]],lv:58,t:3.2},
  {id:'voidleather',sk:'leatherworking',st:'tannery',out:'Voidhide Leather',q:1,in:[['Void Hide',2],['Voidbloom',1]],lv:46,t:3},
  {id:'wyrmleather',sk:'leatherworking',st:'tannery',out:'Wyrmscale Leather',q:1,in:[['Wyrm Scale',2],['Voidhide Leather',1]],lv:58,t:3.2},
  {id:'starweave',sk:'tailoring',st:'loom',out:'Starweave Cloth',q:1,in:[['Starsilk Thread',3],['Voidbloom',1]],lv:46,t:3},
  {id:'nethersilk',sk:'tailoring',st:'loom',out:'Nethersilk Cloth',q:1,in:[['Nether Silk',3],['Starweave Cloth',1]],lv:58,t:3.2},
  {id:'riftstew',sk:'cooking',st:'fire',out:"Riftwarden's Stew",q:1,in:[['Raw Meat',2],['Voidbloom',1],['Herb Powder',1]],lv:48,t:3.2},
  {id:'starfeast',sk:'cooking',st:'fire',out:'Starlight Feast',q:1,in:[['Fish',2,'fish'],['Raw Meat',2],['Starpetal',1]],lv:60,t:3.4},
  {id:'voidelix',sk:'alchemy',st:'cauldron',out:'Elixir of the Void',q:1,in:[['Voidbloom',2],['Prismatic Scale',1],['Herb Powder',1]],lv:48,t:3.4},
  {id:'starelix',sk:'alchemy',st:'cauldron',out:'Elixir of Starlight',q:1,in:[['Starpetal',2],['Voidcrystal',1],['Herb Powder',1]],lv:60,t:3.6}
];
/* craftable gear: three tiers per profession. The armour type follows the class that wears it. */
const GEAR_SETS={
  smithing:{cls:'krijger',alt:{cls:'paladijn',weap:[['Warhammer','zwaard'],['Greathammer','bijl'],['Greatsword','bijl']]},weap:[['Sword','zwaard'],['Battleaxe','bijl'],['Greatsword','bijl']],tiers:[
    {lv:0,il:5,pre:'Iron',mat:'Iron Bar',x:null,w:['Planks',2]},
    {lv:12,il:10,pre:'Silversteel',mat:'Silver Bar',x:['Iron Bar',2],w:['Planks',2]},
    {lv:25,il:16,pre:'Emberforged',mat:'Emberstone Bar',x:['Silver Bar',2],w:['Ashwood',2]},
    {lv:38,il:23,pre:'Mithril',mat:'Mithril Bar',x:['Emberstone Bar',2],w:['Elderwood',2]},
    {lv:50,il:34,pre:'Riftsteel',mat:'Riftsteel Bar',x:['Mithril Bar',2],w:['Voidwood',2]},
    {lv:62,il:46,pre:'Voidforged',mat:'Voidforged Bar',x:['Riftsteel Bar',2],w:['Voidwood',3]}]},
  leatherworking:{cls:'jager',weap:[['Bow','boog']],tiers:[
    {lv:0,il:5,pre:'Tanned',mat:'Leather',x:null,w:['Planks',3]},
    {lv:12,il:10,pre:'Hardened',mat:'Thick Leather',x:['Leather',2],w:['Sturdy Wood',3]},
    {lv:25,il:16,pre:'Drakeskin',mat:'Drakeskin',x:['Thick Leather',2],w:['Ashwood',3]},
    {lv:38,il:23,pre:'Elvenhide',mat:'Elvenhide Leather',x:['Drakeskin',2],w:['Elderwood',3]},
    {lv:50,il:34,pre:'Voidhide',mat:'Voidhide Leather',x:['Elvenhide Leather',2],w:['Voidwood',3]},
    {lv:62,il:46,pre:'Wyrmscale',mat:'Wyrmscale Leather',x:['Voidhide Leather',2],w:['Voidwood',3]}]},
  tailoring:{cls:'magier',weap:[['Staff','staf']],tiers:[
    {lv:0,il:5,pre:'Linen',mat:'Linen',x:null,w:['Planks',2]},
    {lv:12,il:10,pre:'Silken',mat:'Silk Cloth',x:['Linen',2],w:['Sturdy Wood',2]},
    {lv:25,il:16,pre:'Emberweave',mat:'Emberweave',x:['Silk Cloth',2],w:['Ashwood',2]},
    {lv:38,il:23,pre:'Moonsilk',mat:'Moonsilk Cloth',x:['Emberweave',2],w:['Elderwood',2]},
    {lv:50,il:34,pre:'Starweave',mat:'Starweave Cloth',x:['Moonsilk Cloth',2],w:['Voidwood',2]},
    {lv:62,il:46,pre:'Nethersilk',mat:'Nethersilk Cloth',x:['Starweave Cloth',2],w:['Voidwood',2]}]}};
const GEAR_BASE={paladijn:{offhand:'Shield',rug:'Tabard Cape',hoofd:'Helm',borst:'Chestguard',handen:'Gauntlets',benen:'Legguards',voeten:'Sabatons'},krijger:{offhand:'Shield',rug:'Cape',hoofd:'Helm',borst:'Breastplate',handen:'Gauntlets',benen:'Legplates',voeten:'Sabatons'},jager:{offhand:'Quiver',rug:'Cloak',hoofd:'Hood',borst:'Tunic',handen:'Gloves',benen:'Leggings',voeten:'Boots'},magier:{offhand:'Tome',rug:'Cloak',hoofd:'Hat',borst:'Robe',handen:'Handwraps',benen:'Trousers',voeten:'Sandals'}};
const GEAR_SLOT={offhand:[3,1],hoofd:[3,0],rug:[2,1],handen:[2,1],voeten:[2,2],benen:[4,3],wapen:[4,4],borst:[5,5]};/* [materiaal, extra vaardigheidsniveau] */
/* a profession can also make the same gear for a second class (smithing: plate for warriors and paladins) */
for(const sk in GEAR_SETS){const S0=GEAR_SETS[sk];for(const S of[S0,...(S0.alt?[{...S0,...S0.alt,suf:'p'}]:[])])S0.tiers.forEach((T,ti)=>{
  for(const slot in GEAR_SLOT){const[q,dl]=GEAR_SLOT[slot];const big=slot==='borst'||slot==='benen'||slot==='wapen';
    const wl=slot==='wapen'?S.weap:[[GEAR_BASE[S.cls][slot],null]];
    wl.forEach(([bn,wt],wi)=>{const ins=[[T.mat,q]];if(T.x&&big)ins.push([T.x[0],T.x[1]]);if(slot==='wapen')ins.push([T.w[0],T.w[1]]);if(slot==='wapen'&&sk==='tailoring')ins.push([['Moonbloom','Bloodroot','Fireblossom','Moonpetal','Voidbloom','Starpetal'][ti],2]);
      RECIPES.push({id:sk+ti+slot+(wi||'')+(S.suf||''),sk,st:LIFE[sk].st,gear:{slot,cls:S.cls,il:T.il,wt,tier:ti},out:T.pre+' '+bn,q:1,in:ins,lv:T.lv+dl+(wi?1:0),t:3.2+ti*.4})})}})}
/* rings, smithed for your own class */
RECIPES.push({id:'ring1',sk:'smithing',st:'forge',gear:{slot:'ring',cls:null,il:10,tier:1},out:'Silver Band',q:1,in:[['Silver Bar',3],['Moonbloom',2]],lv:15,t:3.4},
  {id:'ring2',sk:'smithing',st:'forge',gear:{slot:'ring',cls:null,il:16,tier:2},out:'Ember Signet',q:1,in:[['Emberstone Bar',3],['Silver Bar',1]],lv:28,t:3.8},
  {id:'ring3',sk:'smithing',st:'forge',gear:{slot:'ring',cls:null,il:23,tier:3},out:'Mithril Crown Ring',q:1,in:[['Mithril Bar',3],['Moonpetal',2]],lv:42,t:4},
  {id:'ring4',sk:'smithing',st:'forge',gear:{slot:'ring',cls:null,il:36,tier:4},out:'Riftsteel Band',q:1,in:[['Riftsteel Bar',3],['Voidbloom',2]],lv:54,t:4.2},
  {id:'ring5',sk:'smithing',st:'forge',gear:{slot:'ring',cls:null,il:48,tier:5},out:'Voidforged Signet',q:1,in:[['Voidforged Bar',3],['Starpetal',2]],lv:66,t:4.4});
const FISH=[['Perch',45],['Carp',30],['Pike',17],['Golden Perch',6],['Lake Phantom',2]];
const ELV_FISH=[['Silverfin Trout',44],['Moonmere Eel',30],['Elvian Salmon',18],['Golden Perch',6],['Crown Pike',2]];
/* beasts you can skin after looting: [material, chance, extra material at higher skill] */
const SKIN={ever:{it:'Rough Hide',lv:0},wolf:{it:'Rough Hide',lv:0,x:['Thick Hide',8]},spin:{it:'Spider Silk',lv:5},raptor:{it:'Drake Scale',lv:20,x:['Thick Hide',0]},vleer:{it:'Thick Hide',lv:15},welp:{it:'Drake Scale',lv:20},lavadrake:{it:'Drake Scale',lv:22,n:3},broedling:{it:'Drake Scale',lv:20},
  elvwolf:{it:'Elvian Hide',lv:30},elvspider:{it:'Moonsilk Thread',lv:30,n:2},fenraptor:{it:'Elvian Hide',lv:32,x:['Drake Scale',0]},elderstag:{it:'Elvian Hide',lv:34,n:3},oakheart:{it:'Elvian Hide',lv:30,n:5},thornspider:{it:'Moonsilk Thread',lv:30,n:2},silkmother:{it:'Moonsilk Thread',lv:30,n:6},
  prismraptor:{it:'Void Hide',lv:40},crystalbehemoth:{it:'Void Hide',lv:42,n:2},mirelurker:{it:'Void Hide',lv:40},voidstalker:{it:'Void Hide',lv:44},netherray:{it:'Starsilk Thread',lv:40,n:2},voidspore:{it:'Starsilk Thread',lv:40},voidhorror:{it:'Nether Silk',lv:52,n:2},voiddrake:{it:'Wyrm Scale',lv:52},xalthuun:{it:'Wyrm Scale',lv:50,n:8},colossus:{it:'Void Hide',lv:40,n:4}};
const BAG=36;
