/* Runeveld – spelregels: raken, missen, schade en verdediging.
   Pure functies; `rng` is een functie die een getal in [0,1) geeft, zodat de server deterministisch kan testen. */

/* kans om te raken, zoals in RO: 80% plus het verschil tussen raakkans en ontwijken */
export function raakKans(hit,flee){return Math.max(.15,Math.min(1,.8+(hit-flee)/100))}

/* een slag: mist, raakt of raakt kritiek. mult: vermenigvuldiger van een skill (1 = gewone slag) */
export function slag({atk,hit,crit=0,mult=1},{flee},rng=Math.random){
  if(rng()>raakKans(hit,flee))return{mis:true,dmg:0,crit:false};
  const kritiek=rng()*100<crit;
  const dmg=Math.max(1,Math.round(atk*mult*(kritiek?1.5:1)*(0.9+rng()*0.2)));
  return{mis:false,dmg,crit:kritiek};
}

/* een spreuk: mist nooit, geen kritieke treffers; mult: vermenigvuldiger van de skill */
export function spreuk({matk,mult=1},rng=Math.random){return{mis:false,dmg:Math.max(1,Math.round(matk*mult*(0.9+rng()*0.2))),crit:false,magie:true}}

/* schade die overblijft na verdediging */
export function naVerdediging(dmg,def){return Math.max(1,Math.round(dmg*100/(100+def*5)))}

/* raakkans en ontwijken van een monster volgen uit zijn level */
export function monsterGevecht(spec){return{hit:15+spec.lvl*3,flee:2+spec.lvl*2}}
