/* Runeveld – spelregels: joblevels en de skill trees van de zwaardvechter en de magiër.
   Pure data en functies zonder browser- of netwerkcode. */

export const MAX_JOB=20;                 /* eerste klassen; tweede klassen gaan tot 50 */
export const MAX_JOB_TIER={1:20,2:50};
export const jobExpVoor=l=>Math.round(30*Math.pow(l,1.5));
export const JOB_EXP_DEEL=.6;      /* deel van de basis-exp dat ook als job-exp telt */

export const SKILLS={
  beuk:{naam:'Bash',icoon:'⚔️',max:10,eis:{},
    beschr:'A hard blow to your target.',
    sp:l=>5+l,mult:l=>1+.3*l,cd:1.2,
    tekst:l=>`${Math.round((1+.3*l)*100)}% damage · ${5+l} SP`},
  vuurkring:{naam:'Magnum Break',icoon:'🔥',max:10,eis:{beuk:5},
    beschr:'A ring of fire that hits every monster around you. INT makes it stronger.',
    sp:l=>10+l*2,mult:l=>1.2+.2*l,straal:3,cd:5,
    tekst:l=>`${Math.round((1.2+.2*l)*100)}% damage in a ring · ${10+l*2} SP`},
  zwaardbeheersing:{naam:'Sword Mastery',icoon:'🗡️',max:10,eis:{},passief:true,
    beschr:'Passive: you hit harder with any sword.',
    atk:l=>4*l,
    tekst:l=>`ATK +${4*l}`},
  hpherstel:{naam:'HP Recovery',icoon:'❤️',max:10,eis:{},passief:true,
    beschr:'Passive: you recover HP faster, especially while sitting.',
    regen:l=>.25*l,
    tekst:l=>`+${Math.round(25*l)}% HP recovery`},
  provocatie:{naam:'Provoke',icoon:'😤',max:5,eis:{beuk:3},
    beschr:'Draws every monster nearby to you. Handy for gathering a group before a Magnum Break.',
    sp:l=>6,straal:l=>5+l,cd:8,
    tekst:l=>`range ${5+l} · 6 SP`},
  /* ---- magiër ---- */
  vuurpijl:{naam:'Fire Bolt',icoon:'🔥',max:10,eis:{},
    beschr:'Hurls a bolt of fire at your target from a distance. Never misses.',
    sp:l=>6+l,mult:l=>1.4+.25*l,bereik:7,cd:.9,
    tekst:l=>`${Math.round((1.4+.25*l)*100)}% MATK · range 7 · ${6+l} SP`},
  vorstnova:{naam:'Frost Nova',icoon:'❄️',max:10,eis:{vuurpijl:3},
    beschr:'A burst of frost around you: damages every monster nearby and freezes them in place for a moment.',
    sp:l=>14+l*2,mult:l=>.9+.15*l,straal:3.5,bevries:l=>1.5+.2*l,cd:7,
    tekst:l=>`${Math.round((.9+.15*l)*100)}% MATK in a ring · freeze ${(1.5+.2*l).toFixed(1)}s · ${14+l*2} SP`},
  barriere:{naam:'Arcane Barrier',icoon:'🛡️',max:5,eis:{vuurpijl:1},
    beschr:'A shimmering barrier that lets your SP absorb part of every blow for a while.',
    sp:l=>15,duur:l=>15+l*3,deel:l=>.3+.05*l,cd:25,
    tekst:l=>`absorbs ${Math.round((.3+.05*l)*100)}% of damage with SP for ${15+l*3}s · 15 SP`},
  stafbeheersing:{naam:'Staff Mastery',icoon:'🪄',max:10,eis:{},passief:true,
    beschr:'Passive: your spells hit harder with any staff.',
    matk:l=>5*l,
    tekst:l=>`MATK +${5*l}`},
  meditatie:{naam:'Meditation',icoon:'🧘',max:10,eis:{},passief:true,
    beschr:'Passive: you recover SP faster, especially while sitting.',
    regen:l=>.25*l,
    tekst:l=>`+${Math.round(25*l)}% SP recovery`},
  /* ---- knight ---- */
  doorboor:{naam:'Pierce',icoon:'🗡️',max:10,eis:{beuk:5},
    beschr:'A piercing thrust that goes through any armor.',
    sp:l=>8+l,mult:l=>1.6+.3*l,cd:1.5,
    tekst:l=>`${Math.round((1.6+.3*l)*100)}% damage · ${8+l} SP`},
  rolstoot:{naam:'Bowling Bash',icoon:'🎳',max:10,eis:{doorboor:3},
    beschr:'A sweeping blow that hits every monster around you and sends them flying.',
    sp:l=>14+l*2,mult:l=>1.3+.2*l,straal:2.6,cd:6,
    tekst:l=>`${Math.round((1.3+.2*l)*100)}% damage in a ring · knockback · ${14+l*2} SP`},
  volharden:{naam:'Endure',icoon:'🧱',max:5,eis:{},
    beschr:'For a while nothing moves you: no knockback, and extra DEF.',
    sp:l=>12,duur:l=>20+4*l,def:l=>5*l,cd:30,
    tekst:l=>`DEF +${5*l}, no knockback for ${20+4*l}s · 12 SP`},
  /* ---- crusader ---- */
  heiligkruis:{naam:'Holy Cross',icoon:'✝️',max:10,eis:{beuk:5},
    beschr:'A cross-shaped strike of holy steel. Your INT adds to it.',
    sp:l=>9+l,mult:l=>1.5+.3*l,cd:1.6,
    tekst:l=>`${Math.round((1.5+.3*l)*100)}% damage (+INT) · ${9+l} SP`},
  schildstoot:{naam:'Shield Charge',icoon:'🛡️',max:5,eis:{heiligkruis:3},
    beschr:'Charge at your target with your shield and stun it for a moment.',
    sp:l=>12,mult:l=>1+.2*l,bereik:4,bevries:l=>1.5+.3*l,cd:8,
    tekst:l=>`${Math.round((1+.2*l)*100)}% damage · stun ${(1.5+.3*l).toFixed(1)}s · 12 SP`},
  genezing:{naam:'Heal',icoon:'💚',max:10,eis:{},
    beschr:'Mends your wounds with a prayer.',
    sp:l=>10+l*2,deel:l=>.15+.04*l,cd:6,
    tekst:l=>`heals ${Math.round((.15+.04*l)*100)}% of your HP · ${10+l*2} SP`},
  /* ---- wizard ---- */
  bliksem:{naam:'Jupitel Thunder',icoon:'⚡',max:10,eis:{vuurpijl:5},
    beschr:'A ball of lightning that tears into a single target from afar.',
    sp:l=>12+l*2,mult:l=>2.2+.35*l,bereik:8,cd:2.5,
    tekst:l=>`${Math.round((2.2+.35*l)*100)}% MATK · range 8 · ${12+l*2} SP`},
  stormvlaag:{naam:'Storm Gust',icoon:'🌪️',max:10,eis:{vorstnova:3},
    beschr:'A blizzard around you: heavy damage and a long freeze on everything nearby.',
    sp:l=>24+l*3,mult:l=>1.4+.25*l,straal:5,bevries:l=>2+.3*l,cd:12,
    tekst:l=>`${Math.round((1.4+.25*l)*100)}% MATK in a wide ring · freeze ${(2+.3*l).toFixed(1)}s · ${24+l*3} SP`},
  energiemantel:{naam:'Energy Coat',icoon:'🔵',max:5,eis:{barriere:1},
    beschr:'A coat of pure energy: your SP absorbs most of every blow.',
    sp:l=>20,duur:l=>25+l*5,deel:l=>.5+.05*l,cd:40,
    tekst:l=>`absorbs ${Math.round((.5+.05*l)*100)}% of damage with SP for ${25+l*5}s · 20 SP`},
  /* ---- sage ---- */
  aardspies:{naam:'Earth Spike',icoon:'🪨',max:10,eis:{vuurpijl:5},
    beschr:'Spikes of stone burst from the ground under your target.',
    sp:l=>10+l*2,mult:l=>1.9+.3*l,bereik:7,cd:1.6,
    tekst:l=>`${Math.round((1.9+.3*l)*100)}% MATK · range 7 · ${10+l*2} SP`},
  manabron:{naam:'Mana Spring',icoon:'💧',max:5,eis:{meditatie:1},
    beschr:'Draw on the land itself to refill part of your SP.',
    sp:l=>0,deel:l=>.15+.05*l,cd:20,
    tekst:l=>`restores ${Math.round((.15+.05*l)*100)}% of your SP · free`},
};
/* de volgorde in het characterscherm en de drie actieve skills op de balk, per klasse */
export const SKILL_VOLGORDE=['beuk','zwaardbeheersing','hpherstel','vuurkring','provocatie'];
const ZW=['beuk','zwaardbeheersing','hpherstel','vuurkring','provocatie'],MG=['vuurpijl','stafbeheersing','meditatie','vorstnova','barriere'];
export const SKILLS_VAN={
  swordsman:{volgorde:ZW,balk:['beuk','vuurkring','provocatie']},
  mage:{volgorde:MG,balk:['vuurpijl','vorstnova','barriere']},
  knight:{volgorde:[...ZW,'doorboor','rolstoot','volharden'],balk:['beuk','vuurkring','provocatie','doorboor','rolstoot','volharden']},
  crusader:{volgorde:[...ZW,'heiligkruis','schildstoot','genezing'],balk:['beuk','vuurkring','provocatie','heiligkruis','schildstoot','genezing']},
  wizard:{volgorde:[...MG,'bliksem','stormvlaag','energiemantel'],balk:['vuurpijl','vorstnova','barriere','bliksem','stormvlaag','energiemantel']},
  sage:{volgorde:[...MG,'aardspies','manabron','genezing'],balk:['vuurpijl','vorstnova','barriere','aardspies','manabron','genezing']},
};

/* skillpunten die een speler in totaal heeft verdiend op dit joblevel */
export const skillPuntenVoor=job=>Math.max(0,job-1);
export const skillPuntenBesteed=skills=>Object.values(skills).reduce((t,l)=>t+(l||0),0);

/* mag deze skill nog een level omhoog? */
export function kanLeren(skills,id){
  const sk=SKILLS[id];if(!sk)return false;
  if((skills[id]||0)>=sk.max)return false;
  for(const[eis,l]of Object.entries(sk.eis))if((skills[eis]||0)<l)return false;
  return true;
}
