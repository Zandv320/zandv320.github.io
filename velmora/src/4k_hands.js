/* ===================== Main hand and off hand =====================
   Two weapon slots: Main Hand (P.eq.wapen) and Off Hand (P.eq.offhand).
   - One-handed weapons (sword, axe, hammer, mace, wand: wt 'zwaard') go in the main hand.
   - Two-handed weapons (battleaxe, greathammer, greatsword: wt 'bijl'; staff 'staf'; bow 'boog') take both hands:
     equipping one empties the off hand, and equipping an off-hand item puts a two-hander back in your bag.
   - Off hand: a shield (warrior, paladin), a tome (mage) or a quiver (hunter).
   - Warriors can dual wield: a second one-handed weapon in the off hand. It strikes along with every attack.
   Two-handers hit harder and slower than a one-hander with a shield; a wand is lighter than a staff, the tome makes up
   for it. */
const TWO_HAND=new Set(['bijl','staf','boog','ak']);
const isTwoHand=it=>!!(it&&it.s==='wapen'&&TWO_HAND.has(it.wt));
const canDual=cls=>cls==='krijger';
function offSub(cls){return cls==='magier'?'tome':cls==='jager'?'quiver':'shield'}
/* damage and speed of a weapon: two-handed (for the classes that can choose) harder and slower, the wand lighter */
function weaponStats(it,il,r,cls){const avg=(3+il*2.2)*(1+r*.22);let k=1,sp=CLASSES[cls].spd;
  if((cls==='krijger'||cls==='paladijn')&&it.wt==='bijl'){k=1.42;sp*=1.28}else if(cls==='magier'&&it.wt==='zwaard'){k=.82;sp*=.9}
  it.spd=+sp.toFixed(2);it.min=Math.round(avg*.75*k);it.max=Math.round(avg*1.25*k);return it}
function makeOneHand(il,r,cls){for(let i=0;i<20;i++){const it=makeGear('wapen',il,r,cls);if(it.wt==='zwaard')return it}const it=makeGear('wapen',il,r,cls);it.wt='zwaard';it.gs=0;weaponStats(it,il,r,cls);return it}
function starterShield(cls){let it;do{it=makeGear('offhand',1,0,cls)}while(it.s!=='offhand');it.n=cls==='paladijn'?'Initiate\'s Shield':'Wooden Buckler';it.req=1;return it}
/* characters from before the off hand: a warrior or paladin with a one-handed weapon gets a shield, once */
function handsMigrate(){if(!P||P.ohGiven)return;P.ohGiven=1;if((P.cls==='krijger'||P.cls==='paladijn')&&P.eq.wapen&&!isTwoHand(P.eq.wapen)&&!P.eq.offhand)P.eq.offhand=starterShield(P.cls)}
/* can this item go in this slot (for the current class)? */
function slotOk(it,slot){if(slot==='offhand'){if(it.s==='offhand')return true;return it.s==='wapen'&&canDual(P.cls)&&!isTwoHand(it)}return it.s===slot}
/* equip from the bag into a slot, freeing the other hand when needed */
function equipTo(i,slot){const it=P.inv[i];if(!it||it.kind!=='gear')return;slot=slot||it.s;
  if(it.cls!==P.cls&&it.cls!=='alle')return toast('This is not for your class');if(P.level<it.req)return toast('You must be level '+it.req);
  if(!slotOk(it,slot))return toast(it.s==='wapen'&&slot==='offhand'?(isTwoHand(it)?'A two-handed weapon needs both hands':'Only warriors can wield a weapon in the off hand'):'That doesn\'t go there');
  const free=[];if(slot==='wapen'&&isTwoHand(it)&&P.eq.offhand)free.push('offhand');if(slot==='offhand'&&isTwoHand(P.eq.wapen))free.push('wapen');
  const empty=P.inv.filter(x=>!x).length+(P.eq[slot]?0:1)-1;if(free.length>empty)return toast('Your bag is full');
  const old=P.eq[slot]||null;P.eq[slot]=it;P.inv[i]=old;for(const s of free){const k=P.inv.indexOf(null);P.inv[k]=P.eq[s];delete P.eq[s];log((s==='offhand'?'Your off-hand item':'Your two-handed weapon')+' went back into your bag.','sys')}
  const f=P.hp/ST.maxhp;calcStats();P.hp=Math.round(ST.maxhp*f);rebuildMe();refreshBag();refreshChar();sfx('loot');saveGame()}
/* dual wield: the off-hand weapon strikes right after the main hand, for half its damage */
function offhandSwing(tg){if(!ST.owmax||!tg)return;setTimeout(()=>{if(tg.dead||ME.dead)return;swingAnim(false);dealDamage(tg,(rand(ST.owmin,ST.owmax)+ST.pow*.25)*.5*ST.dmgMul*(1+TM('wdmg')+tbuff('dmg')));sfx('hit')},320)}
/* what the off hand shows (for outfitLook): shield model, a second weapon, or the mage's open tome */
function offhandLook(eq,cls,res){const oh=eq.offhand;if(!oh)return;
  if(oh.s==='wapen'){res.sm=weaponFor(oh,cls,oh.wt||'zwaard');return}
  if(oh.sub==='shield'){res.sm=cls==='paladijn'&&typeof palShieldFor==='function'?palShieldFor(oh):shieldFor(oh);res.shd=1}
  else if(oh.sub==='tome')res.om='XA_spellbook_open'}
