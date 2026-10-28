/* Runeveld – spelregels: joblevels en de skill tree van de zwaardvechter.
   Pure data en functies zonder browser- of netwerkcode. */

export const MAX_JOB=20;
export const jobExpVoor=l=>Math.round(30*Math.pow(l,1.5));
export const JOB_EXP_DEEL=.6;      /* deel van de basis-exp dat ook als job-exp telt */

export const SKILLS={
  beuk:{naam:'Beuk',icoon:'⚔️',max:10,eis:{},
    beschr:'Een harde slag op je doelwit.',
    sp:l=>5+l,mult:l=>1+.3*l,cd:1.2,
    tekst:l=>`${Math.round((1+.3*l)*100)}% schade · ${5+l} SP`},
  vuurkring:{naam:'Vuurkring',icoon:'🔥',max:10,eis:{beuk:5},
    beschr:'Een kring van vuur die alle monsters om je heen raakt. INT maakt hem sterker.',
    sp:l=>10+l*2,mult:l=>1.2+.2*l,straal:3,cd:5,
    tekst:l=>`${Math.round((1.2+.2*l)*100)}% schade in een kring · ${10+l*2} SP`},
  zwaardbeheersing:{naam:'Zwaardbeheersing',icoon:'🗡️',max:10,eis:{},passief:true,
    beschr:'Passief: je slaat harder met elk zwaard.',
    atk:l=>4*l,
    tekst:l=>`ATK +${4*l}`},
  hpherstel:{naam:'HP-herstel',icoon:'❤️',max:10,eis:{},passief:true,
    beschr:'Passief: je herstelt sneller HP, ook als je zit.',
    regen:l=>.25*l,
    tekst:l=>`+${Math.round(25*l)}% HP-herstel`},
  provocatie:{naam:'Provocatie',icoon:'😤',max:5,eis:{beuk:3},
    beschr:'Lokt alle monsters in de buurt naar je toe. Handig om een groep te verzamelen voor Vuurkring.',
    sp:l=>6,straal:l=>5+l,cd:8,
    tekst:l=>`bereik ${5+l} · 6 SP`},
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
