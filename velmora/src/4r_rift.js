/* ===================== Rift loot: the Voidbreaker sets and the Wyrm's weapons =====================
   Every class has a second tier set (item level 48, legendary): helmet, shoulders, cloak, chest and gloves, with bonuses
   at 3 and 5 pieces, like the sets of the Ash Queen (4l_sets.js). The pieces drop from the elites of the Rift (rarely)
   and from Xal'thuun the Void Wyrm (two at a time); the Wyrm also drops the legendary weapon of your class. */
const RSETS={
  krijger:{n:'Battlegear of the Voidbreaker',items:{hoofd:'Helm of the Voidbreaker',schouders:'Pauldrons of the Voidbreaker',rug:'Banner of the Silent Song',borst:'Breastplate of the Void Wyrm',handen:'Gauntlets of the Rift'},c:0x5a3a9a,
    b3:{mods:{wdmg:.06,hpp:.06},d:'+6% weapon damage and +6% health.'},b5:{mods:{'slag.dmg':.3,crit:4,dr:.06},d:'Heroic Strike deals 30% more damage, +4% critical chance and you take 6% less damage.'}},
  paladijn:{n:'Radiance of the Riftwarden',items:{hoofd:'Crown of the Riftwarden',schouders:'Spaulders of the Riftwarden',rug:'Tabard of the Silent Song',borst:'Aegis of the Void Wyrm',handen:'Gauntlets of Starlight'},c:0xd8c8ff,
    b3:{mods:{heal:.08,armp:.08},d:'Your heals restore 8% more and you have 8% more armour.'},b5:{mods:{'oordeel.dmg':.3,heal:.12,dr:.05},d:'Judgement deals 30% more damage, you heal 12% more and take 5% less damage.'}},
  magier:{n:'Vestments of the Starsinger',items:{hoofd:'Cowl of the Starsinger',schouders:'Mantle of the Starsinger',rug:'Veil of the Silent Song',borst:'Robe of the Void Wyrm',handen:'Handwraps of the Nebula'},c:0x6a3ad8,
    b3:{mods:{mpp:.1,crit:4},d:'+10% mana and +4% critical chance.'},b5:{mods:{'vuur.dmg':.2,'meteoor.dmg':.3,cdall:.1},d:'Firebolt deals 20% and Meteor 30% more damage, and all cooldowns are 10% shorter.'}},
  jager:{n:'Gear of the Void Stalker',items:{hoofd:'Hood of the Void Stalker',schouders:'Spaulders of the Void Stalker',rug:'Cloak of the Silent Song',borst:'Tunic of the Void Wyrm',handen:'Grips of the Rift'},c:0x3a2a5a,
    b3:{mods:{haste:.06,crit:4},d:'+6% attack speed and +4% critical chance.'},b5:{mods:{'schot.dmg':.25,'multi.dmg':.25,exec:.15},d:'Aimed Shot and Multi-Shot deal 25% more damage, and you deal 15% more damage to enemies below 35% health.'}}};
function makeRiftPiece(cls,slot){const S=RSETS[cls];slot=slot||pick(SET_SLOTS);const it=makeGear(slot,48,3,cls);it.r=4;it.n=S.items[slot];it.req=47;
  it.pow=Math.round((it.pow||0)*1.25+10);it.sta=Math.round((it.sta||0)*1.25+10);it.arm=Math.round((it.arm||0)*1.3);it.price*=3;it.vis={c:S.c};
  if(slot==='hoofd')it.hlt=4;if(slot==='schouders')it.spt=4;if(slot==='rug')it.c=S.c;return it}
const WYRM_WEAPONS={
  krijger:{n:'Songbreaker, Greatsword of the Void',wt:'bijl',gs:1,c:0x7a3ad8,mods:{'slag.dmg':.25,crit:5,wdmg:.08},leg:'Legendary: Heroic Strike +25% damage, +5% critical chance and +8% weapon damage.'},
  paladijn:{n:'Lightfall, Hammer of the Silent Song',wt:'zwaard',c:0xe8d8ff,mods:{'kruis.dmg':.25,heal:.12,haste:.05},leg:'Legendary: Crusader Strike +25% damage, heals restore 12% more and +5% attack speed.'},
  magier:{n:"Xal'thuun's Gaze",wt:'staf',c:0xff3ab0,mods:{'vuur.dmg':.25,crit:5,mpp:.1},leg:'Legendary: Firebolt +25% damage, +5% critical chance and +10% mana.'},
  jager:{n:'Wyrmstring, Bow of the Void',wt:'boog',c:0x5a2a9a,mods:{'schot.dmg':.25,haste:.08,exec:.12},leg:'Legendary: Aimed Shot +25% damage, +8% attack speed and 12% more damage below 35% health.'}};
function makeWyrmWeapon(cls){const d=WYRM_WEAPONS[cls]||WYRM_WEAPONS.krijger;let it;for(let i=0;i<30;i++){it=makeGear('wapen',52,3,cls);if(it.wt===d.wt)break}
  it.wt=d.wt;it.gs=d.gs?1:0;weaponStats(it,52,4,cls);it.r=4;it.n=d.n;it.mods={...d.mods};it.leg=d.leg;it.vis={c:d.c};it.req=49;it.pow=Math.round((it.pow||0)*1.25+12);it.sta=Math.round((it.sta||0)*1.25+12);it.price*=3;return it}
/* what the Rift's elites drop on top of their normal loot */
const RIFT_DROPS={colossus:{set:.12},vashk:{set:.15},morvane:{set:.22},xalthuun:{set:2,weapon:.25,epic:52},
  /* the Sanctum of the Silent Song */korvax:{set:1,epic:50},ilvaya:{set:1,epic:51},nyxathar:{set:2,weapon:.4,epic:52},sanctumknight:{set:.03},voidchanter:{set:.03},
  /* the Void Citadel (raid): every master drops two set pieces; the Riftlord also the legendary weapon, more often */grakkus:{set:2,epic:54},sareth:{set:2,epic:55},ghorzul:{set:2,epic:56},vorthax:{set:2,weapon:.6,epic:58},citadelwarden:{set:.04}};
function riftDrops(m){const D=RIFT_DROPS[m.type];const out=[];if(!D||!P)return out;
  if(D.set>=1){const slots=[...SET_SLOTS].sort(()=>Math.random()-.5);for(let i=0;i<D.set;i++)out.push(makeRiftPiece(P.cls,slots[i]))}else if(Math.random()<D.set)out.push(makeRiftPiece(P.cls));
  if(D.weapon&&Math.random()<D.weapon)out.push(makeWyrmWeapon(P.cls));if(D.epic)out.push(makeGear(randSlot(),D.epic,3,P.cls));return out}
