/* ===================== Tier sets: the five legendary pieces of every class =====================
   The highest tier of every class is a set of five: helmet, shoulders, cloak, chest and gloves (all legendary). Each
   piece's tooltip shows the set, which pieces you wear (x/5) and the two set bonuses: one at 3 pieces and one at 5.
   The bonuses use the same keys as talents (see 1b_talents.js), so they work everywhere talents do. */
const SETS={
  krijger:{n:'Battlegear of the Ash Queen',items:{hoofd:'Horned Helm of the Ash Queen',schouders:'Pauldrons of the Ash Queen',rug:'Warbanner of the Ash Queen',borst:'Scale Harness of Vyraxion',handen:'Claws of the Dragon Brood'},
    b3:{mods:{crit:4,hpp:.05},d:'+4% critical chance and +5% health.'},b5:{mods:{'slag.dmg':.25,dr:.06,'werv.cd':2},d:'Heroic Strike deals 25% more damage, Whirlwind is ready 2 s sooner and you take 6% less damage.'}},
  paladijn:{n:'Dawnbringer Plate',items:{hoofd:'Crown of the Dawn',schouders:'Pauldrons of the Dawn',rug:'Mantle of the Dawn',borst:'Dragonforged Aegis of Light',handen:'Gauntlets of the Sun King'},
    b3:{mods:{heal:.08,hpp:.05},d:'Your heals restore 8% more and you have 5% more health.'},b5:{mods:{'kruis.dmg':.25,dr:.05,heal:.10,'oordeel.cd':2},d:'Crusader Strike deals 25% more damage, Judgement is ready 2 s sooner, you heal 10% more and take 5% less damage.'}},
  magier:{n:'Regalia of Falling Stars',items:{hoofd:'Starfall Crown',schouders:'Starfall Mantle',rug:'Shroud of Falling Stars',borst:'Robe of Glowing Scales',handen:'Sparkgrips'},
    b3:{mods:{mpp:.08,crit:3},d:'+8% mana and +3% critical chance.'},b5:{mods:{'meteoor.dmg':.30,'vuur.dmg':.15,cdall:.08},d:'Meteor deals 30% and Firebolt 15% more damage, and all cooldowns are 8% shorter.'}},
  jager:{n:'Garb of the Dire Beast',items:{hoofd:'Cowl of the Dire Beast',schouders:'Mantle of the Dire Beast',rug:'Cloak of the Dire Beast',borst:'Coat of Dragonhide',handen:'Gloves of the Falconer'},
    b3:{mods:{haste:.06,crit:3},d:'+6% attack speed and +3% critical chance.'},b5:{mods:{'multi.dmg':.25,'schot.dmg':.15,exec:.12},d:'Multi-Shot deals 25% and Aimed Shot 15% more damage, and you deal 12% more damage to enemies below 35% health.'}}};
const SET_SLOTS=['hoofd','schouders','rug','borst','handen'];
/* all set tables (the Rift's Voidbreaker sets are added in 4r_rift.js) */
const ALL_SETS=()=>[SETS,typeof RSETS!=='undefined'?RSETS:{}];
/* which set an item belongs to (by its name and slot) */
function setOf(it){if(!it||it.kind!=='gear')return null;for(const T of ALL_SETS())for(const c in T){const S=T[c];if(S.items[it.s]===it.n)return{cls:c,S}}return null}
/* how many pieces of a set you wear */
function setCountOf(S){if(!S||!P||!P.eq)return 0;let n=0;for(const s of SET_SLOTS){const it=P.eq[s];if(it&&it.n===S.items[s])n++}return n}
function setCount(cls){return setCountOf(SETS[cls])}
/* add the active set bonuses to the talent/mod sums (called from TM) */
function setMods(T){if(!P)return;for(const TB of ALL_SETS()){const S=TB[P.cls];if(!S)continue;const n=setCountOf(S);for(const b of[n>=3?S.b3:null,n>=5?S.b5:null])if(b)for(const k in b.mods)T[k]=(T[k]||0)+b.mods[k]}}
/* the set block in an item tooltip */
function setHtml(it){const f=setOf(it);if(!f)return'';const S=f.S;const mine=P&&P.cls===f.cls;const n=mine?setCountOf(S):0;
  let h='<div class="tset"><div class="tsetn">'+esc(S.n)+' ('+n+'/5)</div>';
  for(const s of SET_SLOTS){const on=mine&&P.eq[s]&&P.eq[s].n===S.items[s];h+='<div class="'+(on?'tseton':'tsetoff')+'">'+esc(S.items[s])+'</div>'}
  for(const[k,b]of[[3,S.b3],[5,S.b5]])h+='<div class="'+(n>=k?'tsetb':'tsetoff')+'">('+k+') Set: '+esc(b.d)+'</div>';
  return h+'</div>'}
