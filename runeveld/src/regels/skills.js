/* Runeveld – spelregels: joblevels en de skill tree van de zwaardvechter.
   Pure data en functies zonder browser- of netwerkcode. */

export const MAX_JOB=20;
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
};
export const SKILL_VOLGORDE=['beuk','zwaardbeheersing','hpherstel','vuurkring','provocatie'];

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
