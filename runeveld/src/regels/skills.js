/* Runeveld – spelregels: joblevels en de skill trees van de zwaardvechter en de magiër.
   Pure data en functies zonder browser- of netwerkcode. */

export const MAX_JOB=20;                 /* eerste klassen; tweede klassen gaan tot 50 */
export const MAX_JOB_TIER={1:20,2:50};
export const jobExpVoor=l=>Math.round(30*Math.pow(l,1.5));
export const JOB_EXP_DEEL=.6;      /* deel van de basis-exp dat ook als job-exp telt */

export const SKILLS={
  /* ---- zwaardvechter ---- */
  beuk:{naam:'Crushing Blow',icoon:'⚔️',max:10,eis:{},
    beschr:'A heavy two-handed blow on your target. The bread and butter of every swordsman.',
    sp:l=>4+l,mult:l=>1.2+.25*l,cd:1,
    tekst:l=>`${Math.round((1.2+.25*l)*100)}% damage · ${4+l} SP`},
  vuurkring:{naam:'Flame Sweep',icoon:'🔥',max:10,eis:{beuk:5},
    beschr:'A sweeping strike that bursts into a ring of fire around you. INT makes it stronger.',
    sp:l=>10+l*2,mult:l=>1.1+.2*l,straal:3,cd:5,
    tekst:l=>`${Math.round((1.1+.2*l)*100)}% damage in a ring · ${10+l*2} SP`},
  zwaardbeheersing:{naam:'Blade Mastery',icoon:'🗡️',max:10,eis:{},passief:true,
    beschr:'Passive: years of drills. You hit harder with any sword.',
    atk:l=>5*l,
    tekst:l=>`ATK +${5*l}`},
  hpherstel:{naam:'Second Wind',icoon:'❤️',max:10,eis:{},passief:true,
    beschr:'Passive: you catch your breath faster and recover HP quicker, especially while sitting.',
    regen:l=>.25*l,
    tekst:l=>`+${Math.round(25*l)}% HP recovery`},
  provocatie:{naam:'War Cry',icoon:'😤',max:5,eis:{beuk:3},
    beschr:'A roar that draws every monster nearby to you. Gather a group, then sweep them with fire.',
    sp:l=>6,straal:l=>5+l,cd:8,
    tekst:l=>`range ${5+l} · 6 SP`},
  wapenversnelling:{naam:'Quickening',icoon:'⏩',max:5,eis:{zwaardbeheersing:3},
    beschr:'Your sword arm moves faster for a while: more attacks per second.',
    sp:l=>10,duur:l=>20+5*l,factor:l=>1-.05*l,cd:35,
    tekst:l=>`${Math.round(5*l)}% faster attacks for ${20+5*l}s · 10 SP`},
  ijzerhuid:{naam:'Stoneskin',icoon:'🪨',max:5,eis:{hpherstel:2},passief:true,
    beschr:'Passive: your skin hardens like rock. Extra DEF.',
    def:l=>3*l,
    tekst:l=>`DEF +${3*l}`},
  doodslag:{naam:'Stunning Strike',icoon:'💥',max:5,eis:{vuurkring:3},passief:true,
    beschr:'Passive: Crushing Blow has a chance to stun the target for a moment.',
    kans:l=>.06*l,
    tekst:l=>`${Math.round(6*l)}% stun chance on Crushing Blow`},
  /* ---- magiër ---- */
  vuurpijl:{naam:'Ember Bolt',icoon:'🔥',max:10,eis:{},
    beschr:'Hurls a bolt of fire at your target from a distance. Never misses.',
    sp:l=>6+l,mult:l=>1.3+.25*l,bereik:7,cd:.9,
    tekst:l=>`${Math.round((1.3+.25*l)*100)}% MATK · range 7 · ${6+l} SP`},
  vorstnova:{naam:'Frostburst',icoon:'❄️',max:10,eis:{vuurpijl:3},
    beschr:'A burst of frost around you: damages every monster nearby and freezes them in place for a moment.',
    sp:l=>14+l*2,mult:l=>.9+.15*l,straal:3.5,bevries:l=>1.5+.2*l,cd:7,
    tekst:l=>`${Math.round((.9+.15*l)*100)}% MATK in a ring · freeze ${(1.5+.2*l).toFixed(1)}s · ${14+l*2} SP`},
  barriere:{naam:'Mana Ward',icoon:'🛡️',max:5,eis:{vuurpijl:1},
    beschr:'A shimmering ward that lets your SP absorb part of every blow for a while.',
    sp:l=>15,duur:l=>15+l*3,deel:l=>.3+.05*l,cd:25,
    tekst:l=>`absorbs ${Math.round((.3+.05*l)*100)}% of damage with SP for ${15+l*3}s · 15 SP`},
  ijsbout:{naam:'Ice Shard',icoon:'🧊',max:10,eis:{vuurpijl:3},
    beschr:'A shard of ice that chills the target: damage and a short freeze.',
    sp:l=>8+l,mult:l=>1.1+.2*l,bereik:7,bevries:l=>.5+.1*l,cd:1.4,
    tekst:l=>`${Math.round((1.1+.2*l)*100)}% MATK · freeze ${(.5+.1*l).toFixed(1)}s · ${8+l} SP`},
  zielsslag:{naam:'Spirit Volley',icoon:'👻',max:10,eis:{meditatie:2},
    beschr:'Spirit bolts fly at your target one after another. More bolts as you level it.',
    sp:l=>12+l*2,mult:l=>.55+.07*l,bouten:l=>2+Math.floor(l/4),bereik:7,cd:2.5,
    tekst:l=>`${2+Math.floor(l/4)} bolts of ${Math.round((.55+.07*l)*100)}% MATK · range 7 · ${12+l*2} SP`},
  spreukfocus:{naam:'Clear Mind',icoon:'🎯',max:5,eis:{stafbeheersing:3},passief:true,
    beschr:'Passive: a calm mind casts cheaper. Your spells cost less SP.',
    korting:l=>.04*l,
    tekst:l=>`spells cost ${Math.round(4*l)}% less SP`},
  stafbeheersing:{naam:'Arcane Mastery',icoon:'🪄',max:10,eis:{},passief:true,
    beschr:'Passive: your spells hit harder with any staff.',
    matk:l=>6*l,
    tekst:l=>`MATK +${6*l}`},
  meditatie:{naam:'Inner Calm',icoon:'🧘',max:10,eis:{},passief:true,
    beschr:'Passive: you recover SP faster, especially while sitting.',
    regen:l=>.25*l,
    tekst:l=>`+${Math.round(25*l)}% SP recovery`},
  /* ---- knight ---- */
  doorboor:{naam:'Piercing Thrust',icoon:'🗡️',max:10,eis:{beuk:5},
    beschr:'A lunging thrust that goes straight through any armor. Never misses.',
    sp:l=>8+l,mult:l=>1.5+.3*l,cd:1.5,
    tekst:l=>`${Math.round((1.5+.3*l)*100)}% damage · never misses · ${8+l} SP`},
  rolstoot:{naam:'Whirlwind Sweep',icoon:'🎳',max:10,eis:{doorboor:3},
    beschr:'A spinning blow that hits every monster around you and sends them flying.',
    sp:l=>14+l*2,mult:l=>1.2+.2*l,straal:2.6,cd:6,
    tekst:l=>`${Math.round((1.2+.2*l)*100)}% damage in a ring · knockback · ${14+l*2} SP`},
  volharden:{naam:'Iron Resolve',icoon:'🧱',max:5,eis:{},
    beschr:'For a while nothing moves you: no knockback, and extra DEF.',
    sp:l=>12,duur:l=>20+4*l,def:l=>5*l,cd:30,
    tekst:l=>`DEF +${5*l}, no knockback for ${20+4*l}s · 12 SP`},
  spiraal:{naam:'Spiral Lance',icoon:'🌀',max:5,eis:{rolstoot:3},
    beschr:'Three spinning thrusts in a row on one target.',
    sp:l=>14+l*2,mult:l=>.8+.15*l,slagen:3,cd:5,
    tekst:l=>`3 hits of ${Math.round((.8+.15*l)*100)}% damage · ${14+l*2} SP`},
  /* ---- crusader ---- */
  heiligkruis:{naam:'Radiant Cross',icoon:'✝️',max:10,eis:{beuk:5},
    beschr:'A cross-shaped strike of blessed steel. Your INT adds to it.',
    sp:l=>9+l,mult:l=>1.4+.3*l,cd:1.6,
    tekst:l=>`${Math.round((1.4+.3*l)*100)}% damage (+INT) · ${9+l} SP`},
  schildstoot:{naam:'Shield Rush',icoon:'🛡️',max:5,eis:{heiligkruis:3},
    beschr:'Rush at your target behind your shield and stun it for a moment.',
    sp:l=>12,mult:l=>1+.2*l,bereik:4,bevries:l=>1.5+.3*l,cd:8,
    tekst:l=>`${Math.round((1+.2*l)*100)}% damage · stun ${(1.5+.3*l).toFixed(1)}s · 12 SP`},
  genezing:{naam:'Mending Light',icoon:'💚',max:10,eis:{},
    beschr:'A prayer of light that mends your wounds.',
    sp:l=>10+l*2,deel:l=>.12+.03*l,cd:8,
    tekst:l=>`heals ${Math.round((.12+.03*l)*100)}% of your HP · ${10+l*2} SP`},
  heiligeschild:{naam:'Aegis of Light',icoon:'🔆',max:5,eis:{genezing:3},passief:true,
    beschr:'Passive: a shield of light returns part of every blow to the attacker.',
    deel:l=>.06*l,
    tekst:l=>`reflects ${Math.round(6*l)}% of damage taken`},
  /* ---- wizard ---- */
  bliksem:{naam:'Thunderclap',icoon:'⚡',max:10,eis:{vuurpijl:5},
    beschr:'Calls a bolt of lightning down on a single target from afar.',
    sp:l=>12+l*2,mult:l=>2+.35*l,bereik:8,cd:2.5,
    tekst:l=>`${Math.round((2+.35*l)*100)}% MATK · range 8 · ${12+l*2} SP`},
  stormvlaag:{naam:'Blizzard',icoon:'🌪️',max:10,eis:{vorstnova:3},
    beschr:'A howling blizzard around you: heavy damage and a long freeze on everything nearby.',
    sp:l=>24+l*3,mult:l=>1.4+.25*l,straal:5,bevries:l=>2+.3*l,cd:12,
    tekst:l=>`${Math.round((1.4+.25*l)*100)}% MATK in a wide ring · freeze ${(2+.3*l).toFixed(1)}s · ${24+l*3} SP`},
  energiemantel:{naam:'Mana Shell',icoon:'🔵',max:5,eis:{barriere:1},
    beschr:'A shell of pure energy: your SP absorbs most of every blow.',
    sp:l=>20,duur:l=>25+l*5,deel:l=>.5+.05*l,cd:40,
    tekst:l=>`absorbs ${Math.round((.5+.05*l)*100)}% of damage with SP for ${25+l*5}s · 20 SP`},
  meteoor:{naam:'Starfall',icoon:'☄️',max:5,eis:{stormvlaag:3},
    beschr:'Pulls a burning star down on your target. Everything around the impact burns.',
    sp:l=>30+l*4,mult:l=>2.4+.4*l,straal:3,bereik:8,cd:14,
    tekst:l=>`${Math.round((2.4+.4*l)*100)}% MATK in a ring of 3 around the target · ${30+l*4} SP`},
  /* ---- sage ---- */
  aardspies:{naam:'Stone Spires',icoon:'🪨',max:10,eis:{vuurpijl:5},
    beschr:'Spires of stone burst from the ground under your target.',
    sp:l=>10+l*2,mult:l=>1.8+.3*l,bereik:7,cd:1.8,
    tekst:l=>`${Math.round((1.8+.3*l)*100)}% MATK · range 7 · ${10+l*2} SP`},
  manaspiegel:{naam:'Mana Echo',icoon:'🪞',max:5,eis:{aardspies:3},passief:true,
    beschr:'Passive: an echo of every spell flows back to you as SP.',
    deel:l=>.015*l,
    tekst:l=>`${(1.5*l).toFixed(1)}% of spell damage returns as SP`},
  manabron:{naam:'Wellspring',icoon:'💧',max:5,eis:{meditatie:1},
    beschr:'Draw on the land itself to refill part of your SP.',
    sp:l=>0,deel:l=>.1+.04*l,cd:20,
    tekst:l=>`restores ${Math.round((.1+.04*l)*100)}% of your SP · free`},
};
/* de volgorde in het characterscherm en de drie actieve skills op de balk, per klasse */
export const SKILL_VOLGORDE=['beuk','zwaardbeheersing','hpherstel','vuurkring','provocatie'];
/* De talent trees: per klasse de skills op een rooster van drie takken (x 0..2) en rijen (y). De lijnen in het
   characterscherm volgen de vereisten (eis). Een tweede klasse neemt de boom van de eerste over en bouwt eronder verder. */
const ZW={beuk:[0,0],zwaardbeheersing:[1,0],hpherstel:[2,0],vuurkring:[0,1],wapenversnelling:[1,1],provocatie:[2,1],doodslag:[0,2],ijzerhuid:[2,2]};
const MG={vuurpijl:[0,0],stafbeheersing:[1,0],meditatie:[2,0],vorstnova:[0,1],spreukfocus:[1,1],zielsslag:[2,1],ijsbout:[0,2],barriere:[1,2]};
export const BOMEN={
  swordsman:ZW,mage:MG,
  knight:{...ZW,doorboor:[0,3],volharden:[2,3],rolstoot:[0,4],spiraal:[1,4]},
  crusader:{...ZW,heiligkruis:[0,3],genezing:[2,3],schildstoot:[0,4],heiligeschild:[2,4]},
  wizard:{...MG,bliksem:[0,3],energiemantel:[1,3],stormvlaag:[0,4],meteoor:[2,4]},
  sage:{...MG,aardspies:[0,3],genezing:[2,3],manaspiegel:[0,4],manabron:[1,4]},
};
/* de takken heten per klasse */
export const TAKKEN={swordsman:['Offense','Mastery','Defense'],mage:['Fire & Ice','Focus','Spirit'],knight:['Offense','Mastery','Defense'],crusader:['Offense','Mastery','Faith'],wizard:['Elements','Focus','Spirit'],sage:['Earth','Focus','Spirit']};
/* volgorde (voor lijsten) en de actieve skills op de balk, in boomvolgorde; passieve skills staan niet op de balk */
function volgorde(boom){return Object.keys(boom).sort((a,b)=>boom[a][1]-boom[b][1]||boom[a][0]-boom[b][0])}
function balk(boom){return volgorde(boom).filter(id=>!SKILLS[id].passief)}
export const SKILLS_VAN={};
for(const k of Object.keys(BOMEN))SKILLS_VAN[k]={volgorde:volgorde(BOMEN[k]),balk:balk(BOMEN[k])};

/* skillpunten die een speler in totaal heeft verdiend op dit joblevel */
/* één punt per joblevel en een extra punt om de twee levels: op job 20 (eerste klasse) 29 punten, op job 50 nog 74 erbij */
export const skillPuntenVoor=job=>Math.max(0,job-1+Math.floor(job/2));
export const skillPuntenBesteed=skills=>Object.values(skills).reduce((t,l)=>t+(l||0),0);

/* mag deze skill nog een level omhoog? */
export function kanLeren(skills,id){
  const sk=SKILLS[id];if(!sk)return false;
  if((skills[id]||0)>=sk.max)return false;
  for(const[eis,l]of Object.entries(sk.eis))if((skills[eis]||0)<l)return false;
  return true;
}
