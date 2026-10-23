/* ===================== Talentbomen =====================
   Per klasse drie bomen. Je krijgt 1 punt per niveau vanaf niveau 2 (19 op niveau 20) en verdeelt ze vrij.
   Een rij gaat open als je genoeg punten in díe boom hebt gezet (TIER_REQ). Elke boom heeft op rij 3 en rij 5
   een talent dat een nieuwe vaardigheid geeft (skill); de rest zijn passieve bonussen (mod, per rang).
   Mod-sleutels (waarde per rang):
     powp hpp armp mpp     % kracht / levens / pantser / mana         (0.03 = 3%)
     crit                   kritieke kans in procentpunten              (2 = +2%)
     critdmg                extra kritieke schade                       (0.1 = +10%)
     wdmg haste speed       % schade / aanvalssnelheid / loopsnelheid
     dr dodge regen         % minder schade / kans ontwijken / levens per seconde in gevecht
     cdall costall mregen   % kortere afkoeltijd / minder kosten / sneller mana
     rage                   extra energie per aanval (krijger)
     exec                   % extra schade tegen doelwitten onder 35% levens
     <vaardigheid>.dmg/.cd/.cost/.cast/.root/.heal/.leech/.targets  bonus voor één vaardigheid */
const TIER_REQ=[0,3,6,9,12];
const TALENTS={
 krijger:[
  {id:'wapens',n:'Arms',ic:['sword','#e0b45a','#4a1a06'],d:'Heavy blows and critical hits.',nodes:[
   {id:'k_kling',n:'Keen Blade',t:0,max:3,mod:{wdmg:.04},d:'+{4}% weapon damage.',ic:['sword','#e8d7a0','#3d2a0f']},
   {id:'k_wonden',n:'Deep Wounds',t:0,max:3,mod:{'slag.dmg':.10},d:'Heroic Strike deals {10}% more damage.',ic:['sword','#ff8a6a','#4a0d06']},
   {id:'k_meester',n:'Weapon Master',t:1,max:3,mod:{crit:2},d:'+{2}% critical chance.',ic:['star','#ffd36a','#4a2a00']},
   {id:'k_snel',n:'Swift Strikes',t:1,max:2,mod:{haste:.05},d:'+{5}% attack speed.',ic:['charge','#e8e0c8','#3a3020']},
   {id:'k_doodsslag',n:'Mortal Strike',t:2,max:1,skill:{id:'doodsslag',n:'Mortal Strike',cd:6,cost:25,range:3.4,need:1,ic:['skull','#ff6a4a','#3a0605'],d:'A devastating blow for 250% weapon damage.'},d:'Teaches Mortal Strike: a devastating blow for 250% weapon damage (6 s cooldown).',ic:['skull','#ff6a4a','#3a0605']},
   {id:'k_bloeddorst',n:'Bloodthirst',t:2,max:2,mod:{'slag.leech':.03},d:'Heroic Strike restores {3}% of your health.',ic:['heart','#ff5a5a','#3a0505']},
   {id:'k_genadeloos',n:'Merciless',t:3,max:2,mod:{critdmg:.10},d:'Critical hits deal {10}% extra damage.',ic:['star','#ff8a40','#4a1500']},
   {id:'k_storm',n:'Battle Fever',t:3,max:2,mod:{'werv.cd':1.5},d:'Whirlwind is ready {1.5} s sooner.',ic:['whirl','#cfd6e0','#2b3342']},
   {id:'k_klievstorm',n:'Cleaving Storm',t:4,max:1,skill:{id:'klievstorm',n:'Cleaving Storm',cd:40,cost:40,range:0,ic:['whirl','#ffb060','#4a1a00'],d:'Spin for 4 seconds: every half second 70% weapon damage to everything within 6 metres.'},d:'Teaches Cleaving Storm: spin for 4 seconds, damaging everything around you.',ic:['whirl','#ffb060','#4a1a00']}]},
  {id:'woede',n:'Fury',ic:['shout','#ff6a3a','#4a0d00'],d:'Speed, energy and merciless attacks.',nodes:[
   {id:'k_kracht',n:'Savage Strength',t:0,max:3,mod:{powp:.03},d:'+{3}% power.',ic:['shout','#ffcf4d','#7a2a00']},
   {id:'k_razernij',n:'Frenzy',t:0,max:3,mod:{rage:2},d:'Your basic attacks grant {2} extra energy.',ic:['charge','#ff8a40','#4a1500']},
   {id:'k_onverzet',n:'Unyielding',t:1,max:3,mod:{hpp:.05},d:'+{5}% health.',ic:['heart','#ff7a7a','#3a0808']},
   {id:'k_bloedroes',n:'Blood Rush',t:1,max:2,mod:{'kreet.cd':10},d:'Battle Cry is ready {10} s sooner.',ic:['shout','#ff6a3a','#3a0d00']},
   {id:'k_sprong',n:'Raging Leap',t:2,max:1,skill:{id:'razsprong',n:'Raging Leap',cd:20,cost:10,range:25,min:3,need:1,ic:['leap','#ff9a4a','#4a1a00'],d:'Leap to your target and hit everything within 5 metres for 120% weapon damage.'},d:'Teaches Raging Leap: leap to your target and crash down, damaging all around.',ic:['leap','#ff9a4a','#4a1a00']},
   {id:'k_wreed',n:'Brutal Force',t:2,max:2,mod:{exec:.08},d:'{8}% more damage against enemies below 35% health.',ic:['skull','#e0b0a0','#3a1a10']},
   {id:'k_adrenaline',n:'Adrenaline',t:3,max:2,mod:{'storm.cd':3},d:'Charge is ready {3} s sooner.',ic:['charge','#e0632a','#3d0d06']},
   {id:'k_eindeloos',n:'Endless Rage',t:3,max:2,mod:{'werv.cost':5},d:'Whirlwind costs {5} less energy.',ic:['whirl','#ffb080','#4a2010']},
   {id:'k_roekeloos',n:'Recklessness',t:4,max:1,skill:{id:'roekeloos',n:'Recklessness',cd:60,cost:0,range:0,ic:['shout','#ff3a2a','#2a0000'],d:'+30% critical chance and +20% attack speed for 10 seconds.'},d:'Teaches Recklessness: +30% critical chance and faster attacks for 10 seconds.',ic:['shout','#ff3a2a','#2a0000']}]},
  {id:'bescherming',n:'Protection',ic:['shield','#a8c0e0','#1a2a40'],d:'Tough, indestructible and hard to hit.',nodes:[
   {id:'k_taai',n:'Tough',t:0,max:3,mod:{armp:.08},d:'+{8}% armour.',ic:['shield','#c8d0d8','#2a3038']},
   {id:'k_stevig',n:'Sturdy',t:0,max:3,mod:{hpp:.04},d:'+{4}% health.',ic:['heart','#ff9a8a','#3a1010']},
   {id:'k_schildwal',n:'Shield Wall',t:1,max:3,mod:{dr:.03},d:'You take {3}% less damage.',ic:['shield','#a8c0e0','#1a2a40']},
   {id:'k_spaarzaam',n:'Frugal',t:1,max:2,mod:{'slag.cost':3},d:'Heroic Strike costs {3} less energy.',ic:['sword','#c8c0a0','#2a2818']},
   {id:'k_schildslag',n:'Shield Bash',t:2,max:1,skill:{id:'schildslag',n:'Shield Bash',cd:10,cost:15,range:3.4,need:1,ic:['shield','#ffd36a','#3a2a00'],d:'Ram your shield into your target: 140% weapon damage and a 2-second stun.'},d:'Teaches Shield Bash: damage and a 2-second stun.',ic:['shield','#ffd36a','#3a2a00']},
   {id:'k_bastion',n:'Last Bastion',t:2,max:2,mod:{'kreet.heal':.10},d:'Battle Cry restores {10}% extra health.',ic:['heart','#ffd070','#3a2a00']},
   {id:'k_ijzerwil',n:'Iron Will',t:3,max:2,mod:{regen:.004},d:'In combat you regenerate {0.4}% health per second.',ic:['heart','#7ad87a','#0d3a0d']},
   {id:'k_standvastig',n:'Steadfast',t:3,max:2,mod:{dodge:.05},d:'{5}% chance to fully block an attack.',ic:['shield','#e0e0e0','#202020']},
   {id:'k_onbreekbaar',n:'Unbreakable',t:4,max:1,skill:{id:'onbreekbaar',n:'Unbreakable',cd:60,cost:0,range:0,ic:['shield','#7ae0ff','#0d2a3a'],d:'50% less damage taken for 8 seconds.'},d:'Teaches Unbreakable: half damage taken for 8 seconds.',ic:['shield','#7ae0ff','#0d2a3a']}]}],
 paladijn:[
  {id:'heilig',n:'Holy',ic:['cross','#fff6c8','#7a5a10'],d:'The healer: strong heals for yourself and your group.',nodes:[
   {id:'p_helend',n:'Healing Light',t:0,max:3,mod:{heal:.06},d:'Your heals restore {6}% more health.',ic:['cross','#fff6c8','#7a5a10']},
   {id:'p_wijsheid',n:'Divine Wisdom',t:0,max:3,mod:{mpp:.05},d:'+{5}% mana.',ic:['sun','#a8d0ff','#0d2a5a']},
   {id:'p_verlichting',n:'Illumination',t:1,max:3,mod:{mregen:.10},d:'You regenerate mana {10}% faster.',ic:['sun','#fff0a8','#5a4a10']},
   {id:'p_snellicht',n:'Swift Light',t:1,max:2,mod:{'flits_licht.cast':.3},d:'Flash of Light casts {0.3} s faster.',ic:['cross','#ffe9a0','#5a3a06']},
   {id:'p_heiliglicht',n:'Holy Light',t:2,max:1,skill:{id:'heiliglicht',n:'Holy Light',cd:0,cost:38,range:30,heal:1,cast:2.4,ic:['sun','#ffffff','#a07a10'],d:'A slow, powerful heal: restores a huge amount of health to your friendly target or yourself.'},d:'Teaches Holy Light: a slow but huge heal.',ic:['sun','#ffffff','#a07a10']},
   {id:'p_genade',n:'Divine Grace',t:2,max:2,mod:{'flits_licht.cost':4},d:'Flash of Light costs {4} less mana.',ic:['cross','#d8f0ff','#1a3a5a']},
   {id:'p_gezegend',n:'Blessed Life',t:3,max:2,mod:{hpp:.04},d:'+{4}% health.',ic:['heart','#ffe0a0','#5a3a10']},
   {id:'p_lichtgratie',n:'Light\'s Grace',t:3,max:2,mod:{'heiliglicht.cast':.4,'heiliglicht.cost':4},d:'Holy Light casts {0.4} s faster and costs {4} less mana.',ic:['sun','#fff8d8','#7a5a10']},
   {id:'p_dageraad',n:'Light of Dawn',t:4,max:1,skill:{id:'dageraad',n:'Light of Dawn',cd:18,cost:40,range:0,ic:['halo','#fff2b0','#8a6a10'],d:'A wave of light heals you and every group member within 18 metres.'},d:'Teaches Light of Dawn: heal your whole group around you.',ic:['halo','#fff2b0','#8a6a10']}]},
  {id:'bescherm',n:'Protection',ic:['shield','#a8c8ff','#1a2a5a'],d:'The tank: holds the enemy\'s attention and takes the blows.',nodes:[
   {id:'p_taai',n:'Toughness',t:0,max:3,mod:{armp:.08},d:'+{8}% armour.',ic:['shield','#d8e0ff','#2a3050']},
   {id:'p_schildkunde',n:'Shield Specialization',t:0,max:3,mod:{dr:.02},d:'You take {2}% less damage.',ic:['shield','#ffe08a','#4a3a10']},
   {id:'p_plicht',n:'Sacred Duty',t:1,max:3,mod:{hpp:.05},d:'+{5}% health.',ic:['heart','#fff0c0','#5a3a10']},
   {id:'p_behoed',n:'Guarded by the Light',t:1,max:2,mod:{regen:.004},d:'In combat you regenerate {0.4}% health per second.',ic:['cross','#c8f0ff','#1a3a5a']},
   {id:'p_wraakschild',n:'Avenger\'s Shield',t:2,max:1,skill:{id:'wraakschild',n:'Avenger\'s Shield',cd:12,cost:20,range:25,need:1,ic:['shield','#ffe9a0','#8a5a00'],d:'Hurl your shield: it strikes your target and bounces to 2 more enemies for 150% weapon damage, dazes them for 1.5 s and taunts them all onto you.'},d:'Teaches Avenger\'s Shield: a bouncing shield throw that taunts every enemy it hits.',ic:['shield','#ffe9a0','#8a5a00']},
   {id:'p_rechtvaardig',n:'Righteous Fury',t:2,max:2,mod:{'kruis.dmg':.12},d:'Crusader Strike deals {12}% more damage.',ic:['hammer','#ffd070','#4a2a00']},
   {id:'p_bolwerk',n:'Redoubt',t:3,max:2,mod:{dodge:.05},d:'{5}% chance to block an attack with your shield.',ic:['shield','#e8e8f0','#202030']},
   {id:'p_afrekening',n:'Reckoning',t:3,max:2,mod:{'wraakschild.cd':3},d:'Avenger\'s Shield is ready {3} s sooner.',ic:['shield','#ffc060','#4a2a00']},
   {id:'p_oudekoningen',n:'Guardian of Ancient Kings',t:4,max:1,skill:{id:'oudekoningen',n:'Guardian of Ancient Kings',cd:75,cost:0,range:0,ic:['wing','#ffe08a','#6a4a00'],d:'An ancient king of light stands guard over you: 60% less damage taken for 10 seconds.'},d:'Teaches Guardian of Ancient Kings: 60% less damage for 10 seconds.',ic:['wing','#ffe08a','#6a4a00']}]},
  {id:'vergelding',n:'Retribution',ic:['hammer','#ffb070','#5a1a00'],d:'The damage dealer: heavy holy blows with a great hammer.',nodes:[
   {id:'p_tweehand',n:'Two-Handed Mastery',t:0,max:3,mod:{wdmg:.04},d:'+{4}% weapon damage.',ic:['hammer','#e8d0a0','#3a2a10']},
   {id:'p_kruistocht',n:'Crusade',t:0,max:3,mod:{'kruis.dmg':.10},d:'Crusader Strike deals {10}% more damage.',ic:['hammer','#ffe08a','#5a3a06']},
   {id:'p_overtuiging',n:'Conviction',t:1,max:3,mod:{crit:2},d:'+{2}% critical chance.',ic:['star','#ffe08a','#4a3a00']},
   {id:'p_heiligvuur',n:'Sanctified Wrath',t:1,max:2,mod:{haste:.05},d:'+{5}% attack speed.',ic:['sun','#ffc070','#5a2a00']},
   {id:'p_goddelijkestorm',n:'Divine Storm',t:2,max:1,skill:{id:'goddelijkestorm',n:'Divine Storm',cd:9,cost:25,range:0,ic:['whirl','#fff0a0','#7a5a00'],d:'Spin your hammer in a storm of light: 130% weapon damage to every enemy within 7 metres, and you heal for 15% of it.'},d:'Teaches Divine Storm: holy damage to all enemies around you.',ic:['whirl','#fff0a0','#7a5a00']},
   {id:'p_bevel',n:'Seal of Command',t:2,max:2,mod:{critdmg:.10},d:'Critical hits deal {10}% extra damage.',ic:['star','#ffb060','#4a1a00']},
   {id:'p_oorlogskunst',n:'Art of War',t:3,max:2,mod:{'oordeel.cd':2},d:'Judgement is ready {2} s sooner.',ic:['sun','#ffe9a0','#6a4a06']},
   {id:'p_toorn',n:'Hammer of Wrath',t:3,max:2,mod:{exec:.08},d:'{8}% more damage against enemies below 35% health.',ic:['hammer','#ff9a5a','#4a1000']},
   {id:'p_wraak',n:'Avenging Wrath',t:4,max:1,skill:{id:'wraak',n:'Avenging Wrath',cd:75,cost:0,range:0,ic:['wing','#fff2a0','#8a5a00'],d:'Wings of light unfold: +30% damage and +30% healing for 20 seconds.'},d:'Teaches Avenging Wrath: wings of light, +30% damage and healing for 20 seconds.',ic:['wing','#fff2a0','#8a5a00']}]}],
 magier:[
  {id:'vuur',n:'Fire',ic:['fire','#ffb02e','#7a1500'],d:'Burning spells and big explosions.',nodes:[
   {id:'m_brand',n:'Searing Fire',t:0,max:3,mod:{'vuur.dmg':.08},d:'Firebolt deals {8}% more damage.',ic:['fire','#ffb02e','#7a1500']},
   {id:'m_ontsteking',n:'Ignition',t:0,max:3,mod:{crit:2},d:'+{2}% critical chance.',ic:['star','#ffb040','#4a1500']},
   {id:'m_snel',n:'Quick Cast',t:1,max:2,mod:{'vuur.cast':.2},d:'Firebolt is {0.2} s faster.',ic:['fire','#ffe08a','#5a2a00']},
   {id:'m_hitte',n:'Heat',t:1,max:3,mod:{powp:.03},d:'+{3}% spell power.',ic:['fire','#ff7a3a','#3a0a00']},
   {id:'m_vlammenzee',n:'Sea of Flames',t:2,max:1,skill:{id:'vlammenzee',n:'Sea of Flames',cd:12,cost:30,range:30,need:1,ic:['fire','#ff5a1a','#3a0500'],d:'A pillar of fire at your target: 180% damage to everything within 6 metres.'},d:'Teaches Sea of Flames: instant fire around your target.',ic:['fire','#ff5a1a','#3a0500']},
   {id:'m_meteoregen',n:'Starfall',t:2,max:2,mod:{'meteoor.cd':4},d:'Meteor is ready {4} s sooner.',ic:['meteor','#ff7a2e','#4a0d00']},
   {id:'m_verbranding',n:'Combustion',t:3,max:2,mod:{critdmg:.10},d:'Critical hits deal {10}% extra damage.',ic:['star','#ff6a2a','#3a0800']},
   {id:'m_smeltpunt',n:'Melting Point',t:3,max:2,mod:{'meteoor.dmg':.10},d:'Meteor deals {10}% more damage.',ic:['meteor','#ffb060','#5a1a00']},
   {id:'m_drakenadem',n:'Dragon\'s Breath',t:4,max:1,skill:{id:'drakenadem',n:'Dragon\'s Breath',cd:25,cost:30,range:0,ic:['fire','#ff3a10','#200000'],d:'Breathe fire ahead of you: 220% damage to everything in a cone up to 10 metres.'},d:'Teaches Dragon\'s Breath: a cone of fire in front of you.',ic:['fire','#ff3a10','#200000']}]},
  {id:'vorst',n:'Frost',ic:['frost','#a8e4ff','#0d3a66'],d:'Freezing, slowing and icy precision.',nodes:[
   {id:'m_ijsgeest',n:'Icy Mind',t:0,max:3,mod:{mpp:.05},d:'+{5}% mana.',ic:['frost','#c8f0ff','#0d2a4a']},
   {id:'m_permafrost',n:'Permafrost',t:0,max:3,mod:{'nova.root':1},d:'Frost Nova freezes {1} s longer.',ic:['frost','#7ad0ff','#0d2a5a']},
   {id:'m_aderen',n:'Icy Veins',t:1,max:2,mod:{'nova.cd':2},d:'Frost Nova is ready {2} s sooner.',ic:['frost','#a8e4ff','#0d3a66']},
   {id:'m_precisie',n:'Cold Precision',t:1,max:3,mod:{crit:2},d:'+{2}% critical chance.',ic:['star','#a8e4ff','#0d2a4a']},
   {id:'m_ijslans',n:'Ice Lance',t:2,max:1,skill:{id:'ijslans',n:'Ice Lance',cd:0,cost:10,range:30,need:1,ic:['bolt','#c8f0ff','#0d2a5a'],d:'A swift ice lance for 140% damage, doubled against frozen enemies.'},d:'Teaches Ice Lance: instant, and double damage against frozen enemies.',ic:['bolt','#c8f0ff','#0d2a5a']},
   {id:'m_rijp',n:'Rime',t:2,max:2,mod:{hpp:.06},d:'+{6}% health.',ic:['heart','#a8e4ff','#0d2a4a']},
   {id:'m_splinters',n:'Shatter',t:3,max:2,mod:{'ijslans.dmg':.15},d:'Ice Lance deals {15}% more damage.',ic:['bolt','#7ad0ff','#0d1a3a']},
   {id:'m_winterwacht',n:'Winter\'s Ward',t:3,max:2,mod:{dr:.04},d:'You take {4}% less damage.',ic:['shield','#a8e4ff','#0d2a4a']},
   {id:'m_sneeuwstorm',n:'Blizzard',t:4,max:1,skill:{id:'sneeuwstorm',n:'Blizzard',cd:30,cost:40,range:30,need:1,ic:['frost','#ffffff','#1a3a6a'],d:'Ice rains around your target for 8 seconds: 60% damage within 7 metres every second, briefly freezing enemies.'},d:'Teaches Blizzard: an ice storm that deals damage for 8 seconds.',ic:['frost','#ffffff','#1a3a6a']}]},
  {id:'arcaan',n:'Arcane',ic:['blink','#d9a8ff','#3a1266'],d:'Pure magic, fast spells and lower costs.',nodes:[
   {id:'m_arcgeest',n:'Arcane Mind',t:0,max:3,mod:{powp:.04},d:'+{4}% spell power.',ic:['blink','#d9a8ff','#3a1266']},
   {id:'m_focus',n:'Focus',t:0,max:3,mod:{costall:.04},d:'All spells cost {4}% less mana.',ic:['eye','#c08aff','#2a0a4a']},
   {id:'m_verschuiving',n:'Displacement',t:1,max:2,mod:{'flits.cd':3},d:'Blink is ready {3} s sooner.',ic:['blink','#e0c0ff','#2a0a4a']},
   {id:'m_manabron',n:'Mana Spring',t:1,max:3,mod:{mregen:.15},d:'Your mana regenerates {15}% faster.',ic:['potion','#7aa0ff','#0a1a4a']},
   {id:'m_raket',n:'Arcane Missiles',t:2,max:1,skill:{id:'arcraket',n:'Arcane Missiles',cd:8,cost:20,range:30,need:1,ic:['multi','#e0a8ff','#2a0a4a'],d:'Five arcane missiles at your target, each dealing 55% damage.'},d:'Teaches Arcane Missiles: five missiles in a row.',ic:['multi','#e0a8ff','#2a0a4a']},
   {id:'m_stroom',n:'Spell Flow',t:2,max:2,mod:{wdmg:.06},d:'Your basic attack deals {6}% more damage.',ic:['blink','#b080ff','#1a0a3a']},
   {id:'m_tijd',n:'Time Warp',t:3,max:2,mod:{cdall:.05},d:'All your abilities are ready {5}% sooner.',ic:['clock','#d9a8ff','#2a0a4a']},
   {id:'m_aura',n:'Aura',t:3,max:2,mod:{crit:3},d:'+{3}% critical chance.',ic:['star','#d9a8ff','#2a0a4a']},
   {id:'m_tijdsprong',n:'Arcane Power',t:4,max:1,skill:{id:'arckracht',n:'Arcane Power',cd:60,cost:0,range:0,ic:['clock','#ff9aff','#3a0a3a'],d:'35% more damage for 12 seconds.'},d:'Teaches Arcane Power: 35% more damage for 12 seconds.',ic:['clock','#ff9aff','#3a0a3a']}]}],
 jager:[
  {id:'scherpschutter',n:'Marksmanship',ic:['arrow','#e8d7a0','#3d2a0f'],d:'Precision from afar and enormous single shots.',nodes:[
   {id:'j_hand',n:'Steady Hand',t:0,max:3,mod:{crit:2},d:'+{2}% critical chance.',ic:['eye','#e8d7a0','#3d2a0f']},
   {id:'j_doorboren',n:'Pierce',t:0,max:3,mod:{'schot.dmg':.10},d:'Aimed Shot deals {10}% more damage.',ic:['arrow','#ffd36a','#4a2a00']},
   {id:'j_valkenoog',n:'Hawk Eye',t:1,max:2,mod:{'schot.cost':3},d:'Aimed Shot costs {3} less focus.',ic:['eye','#ffd36a','#3a2a00']},
   {id:'j_precisie',n:'Precision',t:1,max:3,mod:{wdmg:.04},d:'+{4}% weapon damage.',ic:['arrow','#e0e0c0','#2a2a1a']},
   {id:'j_dodelijk',n:'Killing Shot',t:2,max:1,skill:{id:'dodelijk',n:'Killing Shot',cd:10,cost:30,range:34,need:1,cast:1.5,ic:['arrow','#ff5a3a','#3a0500'],d:'A carefully aimed shot for 320% weapon damage.'},d:'Teaches Killing Shot: aim for 1.5 s for 320% weapon damage.',ic:['arrow','#ff5a3a','#3a0500']},
   {id:'j_geduld',n:'Patience',t:2,max:2,mod:{critdmg:.10},d:'Critical hits deal {10}% extra damage.',ic:['star','#ffd36a','#3a2a00']},
   {id:'j_pijlstorm',n:'Arrow Storm',t:3,max:2,mod:{'regen.cd':3},d:'Arrow Rain is ready {3} s sooner.',ic:['rain','#ffd36a','#4a2a00']},
   {id:'j_pees',n:'Quick String',t:3,max:2,mod:{haste:.05},d:'+{5}% attack speed.',ic:['boog','#e0c890','#3a2a10']},
   {id:'j_genade',n:'Coup de Grâce',t:4,max:1,skill:{id:'genadeschot',n:'Coup de Grâce',cd:12,cost:20,range:34,need:1,cond:'exec',ic:['skull','#ffe0a0','#3a1a00'],d:'Only on enemies below 30% health: 400% weapon damage.'},d:'Teaches Coup de Grâce: 400% damage against enemies below 30% health.',ic:['skull','#ffe0a0','#3a1a00']}]},
  {id:'overleving',n:'Survival',ic:['leaf','#9be07a','#173d0d'],d:'Tough, agile and full of traps and poison.',nodes:[
   {id:'j_huid',n:'Tough Hide',t:0,max:3,mod:{hpp:.04},d:'+{4}% health.',ic:['heart','#9be07a','#173d0d']},
   {id:'j_wendbaar',n:'Agile',t:0,max:3,mod:{dodge:.02},d:'{2}% chance to dodge an attack.',ic:['leap','#9be07a','#173d0d']},
   {id:'j_vluchtig',n:'Elusive',t:1,max:2,mod:{'sprong.cd':3},d:'Disengage is ready {3} s sooner.',ic:['leap','#7ad0e0','#0d3340']},
   {id:'j_leer',n:'Hardened Leather',t:1,max:3,mod:{armp:.06},d:'+{6}% armour.',ic:['shield','#c8a878','#3a2a10']},
   {id:'j_explosief',n:'Explosive Shot',t:2,max:1,skill:{id:'explosief',n:'Explosive Shot',cd:12,cost:25,range:32,need:1,ic:['meteor','#ffb040','#3a1500'],d:'An exploding arrow: 180% damage to your target and 90% to everything within 5 metres.'},d:'Teaches Explosive Shot: an exploding arrow.',ic:['meteor','#ffb040','#3a1500']},
   {id:'j_herstel',n:'Recovery',t:2,max:2,mod:{regen:.004},d:'In combat you regenerate {0.4}% health per second.',ic:['heart','#7ad87a','#0d3a0d']},
   {id:'j_drang',n:'Will to Survive',t:3,max:2,mod:{dr:.03},d:'You take {3}% less damage.',ic:['shield','#9be07a','#173d0d']},
   {id:'j_splijt',n:'Splitting Arrow',t:3,max:2,mod:{'multi.dmg':.15},d:'Multi-Shot deals {15}% more damage.',ic:['multi','#9be07a','#173d0d']},
   {id:'j_gifpijl',n:'Poison Arrow',t:4,max:1,skill:{id:'gifpijl',n:'Poison Arrow',cd:6,cost:20,range:32,need:1,ic:['arrow','#7aff5a','#0d3a05'],d:'A poisoned arrow: 300% weapon damage spread over 12 seconds.'},d:'Teaches Poison Arrow: 300% damage over 12 seconds.',ic:['arrow','#7aff5a','#0d3a05']}]},
  {id:'wildernis',n:'Wilderness',ic:['wing','#ffd36a','#3a2a00'],d:'The power of nature and quick reflexes.',nodes:[
   {id:'j_natuur',n:'Nature\'s Might',t:0,max:3,mod:{powp:.03},d:'+{3}% power.',ic:['leaf','#9be07a','#173d0d']},
   {id:'j_instinct',n:'Hunting Instinct',t:0,max:3,mod:{crit:1.5},d:'+{1.5}% critical chance.',ic:['eye','#9be07a','#173d0d']},
   {id:'j_snelvoet',n:'Fleet-footed',t:1,max:2,mod:{speed:.05},d:'You move {5}% faster.',ic:['leap','#e0e0a0','#2a2a10']},
   {id:'j_focusbron',n:'Focus Spring',t:1,max:3,mod:{mregen:.10},d:'Your focus regenerates {10}% faster.',ic:['potion','#ff9a4a','#3a1a00']},
   {id:'j_wortels',n:'Entangling Roots',t:2,max:1,skill:{id:'wortels',n:'Entangling Roots',cd:18,cost:25,range:0,ic:['leaf','#7ad05a','#0d2a05'],d:'Roots grab all enemies within 8 metres: rooted for 5 seconds and 60% damage.'},d:'Teaches Entangling Roots: holds enemies around you in place.',ic:['leaf','#7ad05a','#0d2a05']},
   {id:'j_bloedspoor',n:'Blood Trail',t:2,max:2,mod:{'multi.targets':1},d:'Multi-Shot hits {1} extra enemy.',ic:['multi','#ff8a6a','#3a0d05']},
   {id:'j_reflex',n:'Quick Reflexes',t:3,max:2,mod:{cdall:.05},d:'All your abilities are ready {5}% sooner.',ic:['clock','#9be07a','#173d0d']},
   {id:'j_roedel',n:'Wild Strength',t:3,max:2,mod:{exec:.06},d:'{6}% more damage against enemies below 35% health.',ic:['skull','#c8e0a0','#1a2a0d']},
   {id:'j_valk',n:'Falcon of Velmora',t:4,max:1,skill:{id:'valk',n:'Falcon of Velmora',cd:45,cost:30,range:32,need:1,ic:['wing','#ffd36a','#3a2a00'],d:'Your falcon dives at your target every second for 8 seconds for 60% weapon damage.'},d:'Teaches Falcon of Velmora: 8 seconds of falcon attacks.',ic:['wing','#ffd36a','#3a2a00']}]}]
};
/* ---- The Rift expansion: two more rows per tree, for the road to level 50 ----
   Row 6 opens at 16 points in a tree, row 7 (the capstone) at 20. With 49 points at level 50 you can fill one tree and most of a second. */
TIER_REQ.push(16,20);
const TAL_RIFT={
 wapens:[
  {id:'k_slachter',n:'Butcher',t:5,max:3,mod:{'executie.dmg':.12},d:'Execute deals {12}% more damage.',ic:['skull','#ff7a5a','#3a0805']},
  {id:'k_scherpte',n:'Razor Edge',t:5,max:2,mod:{'doodsslag.dmg':.12},d:'Mortal Strike deals {12}% more damage.',ic:['sword','#ffd0a0','#3a1a05']},
  {id:'k_meesterwapen',n:'Master of Arms',t:6,max:1,mod:{wdmg:.10,crit:4,'executie.cd':2},d:'Capstone: +10% weapon damage, +4% critical chance and Execute is ready 2 s sooner.',ic:['sword','#c08aff','#2a0a4a']}],
 woede:[
  {id:'k_donderslag',n:'Rolling Thunder',t:5,max:3,mod:{'donder.dmg':.12},d:'Thunder Clap deals {12}% more damage.',ic:['shout','#9ad0ff','#0d2a4a']},
  {id:'k_razend',n:'Frenzy',t:5,max:2,mod:{haste:.04},d:'+{4}% attack speed.',ic:['charge','#ff9a6a','#3a1005']},
  {id:'k_riftthart',n:'Heart of the Rift',t:6,max:1,mod:{'avatar.cd':30,powp:.06,rage:2},d:'Capstone: Avatar of the Rift is ready 30 s sooner, +6% power and +2 rage per attack.',ic:['star','#c08aff','#2a0a4a']}],
 bescherming:[
  {id:'k_rotswand',n:'Rock Wall',t:5,max:3,mod:{armp:.05},d:'+{5}% armour.',ic:['shield','#c8c0b0','#2a2620']},
  {id:'k_weerstand',n:'Stalwart',t:5,max:2,mod:{hpp:.04,'donder.cd':1.5},d:'+{4}% health and Thunder Clap is ready {1.5} s sooner.',ic:['heart','#ff8a6a','#3a0d06']},
  {id:'k_voidbolwerk',n:'Bulwark of the Void',t:6,max:1,mod:{dr:.08,dodge:.04,hpp:.06},d:'Capstone: you take 8% less damage, have a 4% chance to block and +6% health.',ic:['shield','#c08aff','#2a0a4a']}],
 heilig:[
  {id:'p_stralend',n:'Radiant Hands',t:5,max:3,mod:{heal:.05},d:'Your heals restore {5}% more.',ic:['cross','#fff6c8','#6a5010']},
  {id:'p_heiliggrond',n:'Hallowed Ground',t:5,max:2,mod:{'wijding.dmg':.15},d:'Consecration deals {15}% more damage.',ic:['sun','#ffe08a','#4a3a06']},
  {id:'p_lichtbron',n:'Font of the Light',t:6,max:1,mod:{heal:.12,mregen:.2,'handoplegging.cd':60},d:'Capstone: heals restore 12% more, mana regenerates 20% faster and Lay on Hands is ready 60 s sooner.',ic:['heart','#fff2b0','#6a4a06']}],
 bescherm:[
  {id:'p_wachter',n:'Sentinel',t:5,max:3,mod:{dr:.02},d:'You take {2}% less damage.',ic:['shield','#ffe9a0','#4a3a06']},
  {id:'p_standvast',n:'Sanctified Stand',t:5,max:2,mod:{armp:.04,'wijding.cd':1.5},d:'+{4}% armour and Consecration is ready {1.5} s sooner.',ic:['sun','#fff0a8','#3a2a06']},
  {id:'p_lichtbastion',n:'Bastion of Light',t:6,max:1,mod:{hpp:.1,dr:.05,dodge:.04},d:'Capstone: +10% health, you take 5% less damage and have a 4% chance to block.',ic:['shield','#fff6c8','#6a5010']}],
 vergelding:[
  {id:'p_hemelvuur',n:'Heaven\'s Fury',t:5,max:3,mod:{'hemelhamer.dmg':.12},d:'Hammer of the Heavens deals {12}% more damage.',ic:['hammer','#fff6c8','#5a4a10']},
  {id:'p_ijver',n:'Purifying Zeal',t:5,max:2,mod:{crit:1.5},d:'+{1.5}% critical chance.',ic:['star','#ffe08a','#4a3a06']},
  {id:'p_lichtbrenger',n:'Lightbringer',t:6,max:1,mod:{wdmg:.08,'oordeel.dmg':.25,'kruis.dmg':.15},d:'Capstone: +8% damage; Judgement deals 25% and Crusader Strike 15% more damage.',ic:['sun','#ffffff','#6a5010']}],
 vuur:[
  {id:'m_rifvuur',n:'Riftfire',t:5,max:3,mod:{'vuur.dmg':.06,'meteoor.dmg':.06},d:'Firebolt and Meteor deal {6}% more damage.',ic:['fire','#ff6ad8','#3a0530']},
  {id:'m_vonk',n:'Living Spark',t:5,max:2,mod:{critdmg:.08},d:'Critical hits deal {8}% extra damage.',ic:['star','#ffb060','#4a1a00']},
  {id:'m_feniks',n:'Heart of the Phoenix',t:6,max:1,mod:{crit:5,'vuur.cast':.3,'rifscheur.dmg':.2},d:'Capstone: +5% critical chance, Firebolt casts 0.3 s faster and Rift Collapse deals 20% more damage.',ic:['wing','#ff7a2e','#4a0d00']}],
 vorst:[
  {id:'m_ijshart',n:'Heart of Ice',t:5,max:3,mod:{'ijsbarriere.cd':3},d:'Ice Barrier is ready {3} s sooner.',ic:['shield','#bfeaff','#0d3a66']},
  {id:'m_poollicht',n:'Polar Light',t:5,max:2,mod:{'nova.root':1,'kettingblik.dmg':.1},d:'Frost Nova freezes {1} s longer and Chain Lightning deals {10}% more damage.',ic:['frost','#d8f6ff','#0d2a4a']},
  {id:'m_eeuwigwinter',n:'Eternal Winter',t:6,max:1,mod:{dr:.08,'sneeuwstorm.dmg':.3,'ijslans.dmg':.25},d:'Capstone: you take 8% less damage; Blizzard deals 30% and Ice Lance 25% more damage.',ic:['frost','#ffffff','#0d3a66']}],
 arcaan:[
  {id:'m_leegte',n:'Touch of the Void',t:5,max:3,mod:{'rifscheur.dmg':.1},d:'Rift Collapse deals {10}% more damage.',ic:['blink','#ff6ad8','#2a053a']},
  {id:'m_spanning',n:'Static Charge',t:5,max:2,mod:{'kettingblik.targets':1,'kettingblik.dmg':.05},d:'Chain Lightning jumps to {1} more enemy and deals {5}% more damage.',ic:['charge','#c8e0ff','#1a1a5a']},
  {id:'m_sterrenzanger',n:'Starsinger',t:6,max:1,mod:{mpp:.12,cdall:.08,'arcraket.dmg':.25},d:'Capstone: +12% mana, all abilities are ready 8% sooner and Arcane Missiles deal 25% more damage.',ic:['star','#d9a8ff','#3a1266']}],
 scherpschutter:[
  {id:'j_scherpoog',n:'Deadeye',t:5,max:3,mod:{'snelvuur.dmg':.1},d:'Rapid Fire deals {10}% more damage.',ic:['eye','#ffe0a0','#3a2a05']},
  {id:'j_adem',n:'Steady Breath',t:5,max:2,mod:{'schot.dmg':.08},d:'Aimed Shot deals {8}% more damage.',ic:['arrow','#e8d7a0','#3d2a0f']},
  {id:'j_leegteoog',n:'Eye of the Void',t:6,max:1,mod:{crit:5,critdmg:.15,'dodelijk.dmg':.25},d:'Capstone: +5% critical chance, critical hits deal 15% extra damage and Killing Shot deals 25% more.',ic:['eye','#c08aff','#2a0a4a']}],
 overleving:[
  {id:'j_valzetter',n:'Trapper',t:5,max:3,mod:{'ijsval.cd':2,'ijsval.root':1},d:'Frost Trap is ready {2} s sooner and freezes {1} s longer.',ic:['frost','#bfeaff','#0d3340']},
  {id:'j_gehard',n:'Hardened Hide',t:5,max:2,mod:{dr:.03},d:'You take {3}% less damage.',ic:['shield','#c8a070','#2a1a0a']},
  {id:'j_overlever',n:'Last Survivor',t:6,max:1,mod:{hpp:.1,'riftsalvo.dmg':.25,'explosief.dmg':.25},d:'Capstone: +10% health; Void Barrage and Explosive Shot deal 25% more damage.',ic:['heart','#9be07a','#173d0d']}],
 wildernis:[
  {id:'j_roedelleider',n:'Pack Leader',t:5,max:3,mod:{'valk.dmg':.12},d:'Falcon of Velmora deals {12}% more damage.',ic:['wing','#ffd36a','#3a2a00']},
  {id:'j_windloper',n:'Windrunner',t:5,max:2,mod:{speed:.04,haste:.03},d:'You move {4}% faster and attack {3}% faster.',ic:['leap','#e0e0a0','#2a2a10']},
  {id:'j_wildhart',n:'Wild Heart',t:6,max:1,mod:{wdmg:.08,exec:.1,'riftsalvo.cd':10},d:'Capstone: +8% damage, 10% more damage against enemies below 35% health and Void Barrage is ready 10 s sooner.',ic:['leaf','#9be07a','#0d2a05']}]};
for(const c in TALENTS)for(const t of TALENTS[c])if(TAL_RIFT[t.id])t.nodes.push(...TAL_RIFT[t.id]);
