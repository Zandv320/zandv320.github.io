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
  {id:'wapens',n:'Wapens',ic:['sword','#e0b45a','#4a1a06'],d:'Zware slagen en kritieke treffers.',nodes:[
   {id:'k_kling',n:'Scherpe Kling',t:0,max:3,mod:{wdmg:.04},d:'+{4}% schade met je wapen.',ic:['sword','#e8d7a0','#3d2a0f']},
   {id:'k_wonden',n:'Diepe Wonden',t:0,max:3,mod:{'slag.dmg':.10},d:'Heldhaftige Slag doet {10}% meer schade.',ic:['sword','#ff8a6a','#4a0d06']},
   {id:'k_meester',n:'Wapenmeester',t:1,max:3,mod:{crit:2},d:'+{2}% kritieke kans.',ic:['star','#ffd36a','#4a2a00']},
   {id:'k_snel',n:'Snelle Slagen',t:1,max:2,mod:{haste:.05},d:'+{5}% aanvalssnelheid.',ic:['charge','#e8e0c8','#3a3020']},
   {id:'k_doodsslag',n:'Doodsslag',t:2,max:1,skill:{id:'doodsslag',n:'Doodsslag',cd:6,cost:25,range:3.4,need:1,ic:['skull','#ff6a4a','#3a0605'],d:'Een vernietigende slag voor 250% wapenschade.'},d:'Leert je Doodsslag: een vernietigende slag voor 250% wapenschade (6 s afkoeltijd).',ic:['skull','#ff6a4a','#3a0605']},
   {id:'k_bloeddorst',n:'Bloeddorst',t:2,max:2,mod:{'slag.leech':.03},d:'Heldhaftige Slag herstelt {3}% van je levenspunten.',ic:['heart','#ff5a5a','#3a0505']},
   {id:'k_genadeloos',n:'Genadeloos',t:3,max:2,mod:{critdmg:.10},d:'Kritieke treffers doen {10}% extra schade.',ic:['star','#ff8a40','#4a1500']},
   {id:'k_storm',n:'Strijdroes',t:3,max:2,mod:{'werv.cd':1.5},d:'Wervelwind is {1.5} s eerder klaar.',ic:['whirl','#cfd6e0','#2b3342']},
   {id:'k_klievstorm',n:'Klievende Storm',t:4,max:1,skill:{id:'klievstorm',n:'Klievende Storm',cd:40,cost:40,range:0,ic:['whirl','#ffb060','#4a1a00'],d:'Draai 4 seconden lang rond: elke halve seconde 70% wapenschade aan alles binnen 6 meter.'},d:'Leert je Klievende Storm: 4 seconden ronddraaien met schade rondom je.',ic:['whirl','#ffb060','#4a1a00']}]},
  {id:'woede',n:'Woede',ic:['shout','#ff6a3a','#4a0d00'],d:'Snelheid, energie en genadeloze aanvallen.',nodes:[
   {id:'k_kracht',n:'Woeste Kracht',t:0,max:3,mod:{powp:.03},d:'+{3}% kracht.',ic:['shout','#ffcf4d','#7a2a00']},
   {id:'k_razernij',n:'Razernij',t:0,max:3,mod:{rage:2},d:'Je gewone aanvallen geven {2} extra energie.',ic:['charge','#ff8a40','#4a1500']},
   {id:'k_onverzet',n:'Onverzettelijk',t:1,max:3,mod:{hpp:.05},d:'+{5}% levenspunten.',ic:['heart','#ff7a7a','#3a0808']},
   {id:'k_bloedroes',n:'Bloedroes',t:1,max:2,mod:{'kreet.cd':10},d:'Strijdkreet is {10} s eerder klaar.',ic:['shout','#ff6a3a','#3a0d00']},
   {id:'k_sprong',n:'Razende Sprong',t:2,max:1,skill:{id:'razsprong',n:'Razende Sprong',cd:20,cost:10,range:25,min:3,need:1,ic:['leap','#ff9a4a','#4a1a00'],d:'Spring naar je doelwit en raak alles binnen 5 meter voor 120% wapenschade.'},d:'Leert je Razende Sprong: spring naar je doelwit en sla in met schade rondom.',ic:['leap','#ff9a4a','#4a1a00']},
   {id:'k_wreed',n:'Wrede Kracht',t:2,max:2,mod:{exec:.08},d:'{8}% meer schade tegen vijanden onder 35% levens.',ic:['skull','#e0b0a0','#3a1a10']},
   {id:'k_adrenaline',n:'Adrenaline',t:3,max:2,mod:{'storm.cd':3},d:'Stormloop is {3} s eerder klaar.',ic:['charge','#e0632a','#3d0d06']},
   {id:'k_eindeloos',n:'Eindeloze Woede',t:3,max:2,mod:{'werv.cost':5},d:'Wervelwind kost {5} minder energie.',ic:['whirl','#ffb080','#4a2010']},
   {id:'k_roekeloos',n:'Roekeloosheid',t:4,max:1,skill:{id:'roekeloos',n:'Roekeloosheid',cd:60,cost:0,range:0,ic:['shout','#ff3a2a','#2a0000'],d:'10 seconden lang +30% kritieke kans en +20% aanvalssnelheid.'},d:'Leert je Roekeloosheid: 10 seconden +30% kritieke kans en sneller aanvallen.',ic:['shout','#ff3a2a','#2a0000']}]},
  {id:'bescherming',n:'Bescherming',ic:['shield','#a8c0e0','#1a2a40'],d:'Taai, onverwoestbaar en moeilijk te raken.',nodes:[
   {id:'k_taai',n:'Taai',t:0,max:3,mod:{armp:.08},d:'+{8}% pantser.',ic:['shield','#c8d0d8','#2a3038']},
   {id:'k_stevig',n:'Stevig',t:0,max:3,mod:{hpp:.04},d:'+{4}% levenspunten.',ic:['heart','#ff9a8a','#3a1010']},
   {id:'k_schildwal',n:'Schildwal',t:1,max:3,mod:{dr:.03},d:'Je krijgt {3}% minder schade.',ic:['shield','#a8c0e0','#1a2a40']},
   {id:'k_spaarzaam',n:'Spaarzaam',t:1,max:2,mod:{'slag.cost':3},d:'Heldhaftige Slag kost {3} minder energie.',ic:['sword','#c8c0a0','#2a2818']},
   {id:'k_schildslag',n:'Schildslag',t:2,max:1,skill:{id:'schildslag',n:'Schildslag',cd:10,cost:15,range:3.4,need:1,ic:['shield','#ffd36a','#3a2a00'],d:'Ram je schild tegen je doelwit: 140% wapenschade en 2 seconden verdoofd.'},d:'Leert je Schildslag: schade en een verdoving van 2 seconden.',ic:['shield','#ffd36a','#3a2a00']},
   {id:'k_bastion',n:'Laatste Bastion',t:2,max:2,mod:{'kreet.heal':.10},d:'Strijdkreet herstelt {10}% extra levens.',ic:['heart','#ffd070','#3a2a00']},
   {id:'k_ijzerwil',n:'IJzeren Wil',t:3,max:2,mod:{regen:.004},d:'In gevecht herstel je {0.4}% levens per seconde.',ic:['heart','#7ad87a','#0d3a0d']},
   {id:'k_standvastig',n:'Standvastig',t:3,max:2,mod:{dodge:.05},d:'{5}% kans om een aanval volledig te blokkeren.',ic:['shield','#e0e0e0','#202020']},
   {id:'k_onbreekbaar',n:'Onbreekbaar',t:4,max:1,skill:{id:'onbreekbaar',n:'Onbreekbaar',cd:60,cost:0,range:0,ic:['shield','#7ae0ff','#0d2a3a'],d:'8 seconden lang 50% minder schade.'},d:'Leert je Onbreekbaar: 8 seconden de helft minder schade.',ic:['shield','#7ae0ff','#0d2a3a']}]}],
 magier:[
  {id:'vuur',n:'Vuur',ic:['fire','#ffb02e','#7a1500'],d:'Brandende spreuken en grote explosies.',nodes:[
   {id:'m_brand',n:'Brandend Vuur',t:0,max:3,mod:{'vuur.dmg':.08},d:'Vuurschicht doet {8}% meer schade.',ic:['fire','#ffb02e','#7a1500']},
   {id:'m_ontsteking',n:'Ontsteking',t:0,max:3,mod:{crit:2},d:'+{2}% kritieke kans.',ic:['star','#ffb040','#4a1500']},
   {id:'m_snel',n:'Snelle Spreuk',t:1,max:2,mod:{'vuur.cast':.2},d:'Vuurschicht is {0.2} s sneller.',ic:['fire','#ffe08a','#5a2a00']},
   {id:'m_hitte',n:'Hitte',t:1,max:3,mod:{powp:.03},d:'+{3}% spreukkracht.',ic:['fire','#ff7a3a','#3a0a00']},
   {id:'m_vlammenzee',n:'Vlammenzee',t:2,max:1,skill:{id:'vlammenzee',n:'Vlammenzee',cd:12,cost:30,range:30,need:1,ic:['fire','#ff5a1a','#3a0500'],d:'Een zuil van vuur bij je doelwit: 180% schade aan alles binnen 6 meter.'},d:'Leert je Vlammenzee: direct vuur rond je doelwit.',ic:['fire','#ff5a1a','#3a0500']},
   {id:'m_meteoregen',n:'Sterrenval',t:2,max:2,mod:{'meteoor.cd':4},d:'Meteoor is {4} s eerder klaar.',ic:['meteor','#ff7a2e','#4a0d00']},
   {id:'m_verbranding',n:'Verbranding',t:3,max:2,mod:{critdmg:.10},d:'Kritieke treffers doen {10}% extra schade.',ic:['star','#ff6a2a','#3a0800']},
   {id:'m_smeltpunt',n:'Smeltpunt',t:3,max:2,mod:{'meteoor.dmg':.10},d:'Meteoor doet {10}% meer schade.',ic:['meteor','#ffb060','#5a1a00']},
   {id:'m_drakenadem',n:'Drakenadem',t:4,max:1,skill:{id:'drakenadem',n:'Drakenadem',cd:25,cost:30,range:0,ic:['fire','#ff3a10','#200000'],d:'Spuw vuur voor je uit: 220% schade aan alles in een kegel tot 10 meter.'},d:'Leert je Drakenadem: een kegel van vuur voor je uit.',ic:['fire','#ff3a10','#200000']}]},
  {id:'vorst',n:'Vorst',ic:['frost','#a8e4ff','#0d3a66'],d:'Bevriezen, vertragen en ijzige precisie.',nodes:[
   {id:'m_ijsgeest',n:'IJskoude Geest',t:0,max:3,mod:{mpp:.05},d:'+{5}% mana.',ic:['frost','#c8f0ff','#0d2a4a']},
   {id:'m_permafrost',n:'Permafrost',t:0,max:3,mod:{'nova.root':1},d:'Vorstnova bevriest {1} s langer.',ic:['frost','#7ad0ff','#0d2a5a']},
   {id:'m_aderen',n:'IJzige Aderen',t:1,max:2,mod:{'nova.cd':2},d:'Vorstnova is {2} s eerder klaar.',ic:['frost','#a8e4ff','#0d3a66']},
   {id:'m_precisie',n:'Koude Precisie',t:1,max:3,mod:{crit:2},d:'+{2}% kritieke kans.',ic:['star','#a8e4ff','#0d2a4a']},
   {id:'m_ijslans',n:'IJslans',t:2,max:1,skill:{id:'ijslans',n:'IJslans',cd:0,cost:10,range:30,need:1,ic:['bolt','#c8f0ff','#0d2a5a'],d:'Een snelle ijslans voor 140% schade, dubbel tegen bevroren vijanden.'},d:'Leert je IJslans: direct, en dubbele schade tegen bevroren vijanden.',ic:['bolt','#c8f0ff','#0d2a5a']},
   {id:'m_rijp',n:'Rijp',t:2,max:2,mod:{hpp:.06},d:'+{6}% levenspunten.',ic:['heart','#a8e4ff','#0d2a4a']},
   {id:'m_splinters',n:'Splinters',t:3,max:2,mod:{'ijslans.dmg':.15},d:'IJslans doet {15}% meer schade.',ic:['bolt','#7ad0ff','#0d1a3a']},
   {id:'m_winterwacht',n:'Winterwacht',t:3,max:2,mod:{dr:.04},d:'Je krijgt {4}% minder schade.',ic:['shield','#a8e4ff','#0d2a4a']},
   {id:'m_sneeuwstorm',n:'Sneeuwstorm',t:4,max:1,skill:{id:'sneeuwstorm',n:'Sneeuwstorm',cd:30,cost:40,range:30,need:1,ic:['frost','#ffffff','#1a3a6a'],d:'8 seconden lang ijs rond je doelwit: elke seconde 60% schade binnen 7 meter en vijanden bevriezen kort.'},d:'Leert je Sneeuwstorm: een ijsstorm die 8 seconden schade doet.',ic:['frost','#ffffff','#1a3a6a']}]},
  {id:'arcaan',n:'Arcaan',ic:['blink','#d9a8ff','#3a1266'],d:'Pure magie, snelle spreuken en minder kosten.',nodes:[
   {id:'m_arcgeest',n:'Arcane Geest',t:0,max:3,mod:{powp:.04},d:'+{4}% spreukkracht.',ic:['blink','#d9a8ff','#3a1266']},
   {id:'m_focus',n:'Focus',t:0,max:3,mod:{costall:.04},d:'Alle spreuken kosten {4}% minder mana.',ic:['eye','#c08aff','#2a0a4a']},
   {id:'m_verschuiving',n:'Verschuiving',t:1,max:2,mod:{'flits.cd':3},d:'Flits is {3} s eerder klaar.',ic:['blink','#e0c0ff','#2a0a4a']},
   {id:'m_manabron',n:'Manabron',t:1,max:3,mod:{mregen:.15},d:'Je mana herstelt {15}% sneller.',ic:['potion','#7aa0ff','#0a1a4a']},
   {id:'m_raket',n:'Arcane Raketten',t:2,max:1,skill:{id:'arcraket',n:'Arcane Raketten',cd:8,cost:20,range:30,need:1,ic:['multi','#e0a8ff','#2a0a4a'],d:'Vijf arcane raketten op je doelwit, elk 55% schade.'},d:'Leert je Arcane Raketten: vijf raketten achter elkaar.',ic:['multi','#e0a8ff','#2a0a4a']},
   {id:'m_stroom',n:'Spreukstroom',t:2,max:2,mod:{wdmg:.06},d:'Je gewone aanval doet {6}% meer schade.',ic:['blink','#b080ff','#1a0a3a']},
   {id:'m_tijd',n:'Tijdverschuiving',t:3,max:2,mod:{cdall:.05},d:'Al je vaardigheden zijn {5}% sneller klaar.',ic:['clock','#d9a8ff','#2a0a4a']},
   {id:'m_aura',n:'Aura',t:3,max:2,mod:{crit:3},d:'+{3}% kritieke kans.',ic:['star','#d9a8ff','#2a0a4a']},
   {id:'m_tijdsprong',n:'Arcane Kracht',t:4,max:1,skill:{id:'arckracht',n:'Arcane Kracht',cd:60,cost:0,range:0,ic:['clock','#ff9aff','#3a0a3a'],d:'12 seconden lang 35% meer schade.'},d:'Leert je Arcane Kracht: 12 seconden 35% meer schade.',ic:['clock','#ff9aff','#3a0a3a']}]}],
 jager:[
  {id:'scherpschutter',n:'Scherpschutter',ic:['arrow','#e8d7a0','#3d2a0f'],d:'Precisie van ver en enorme losse schoten.',nodes:[
   {id:'j_hand',n:'Vaste Hand',t:0,max:3,mod:{crit:2},d:'+{2}% kritieke kans.',ic:['eye','#e8d7a0','#3d2a0f']},
   {id:'j_doorboren',n:'Doorboren',t:0,max:3,mod:{'schot.dmg':.10},d:'Gericht Schot doet {10}% meer schade.',ic:['arrow','#ffd36a','#4a2a00']},
   {id:'j_valkenoog',n:'Valkenoog',t:1,max:2,mod:{'schot.cost':3},d:'Gericht Schot kost {3} minder focus.',ic:['eye','#ffd36a','#3a2a00']},
   {id:'j_precisie',n:'Precisie',t:1,max:3,mod:{wdmg:.04},d:'+{4}% schade met je wapen.',ic:['arrow','#e0e0c0','#2a2a1a']},
   {id:'j_dodelijk',n:'Dodelijk Schot',t:2,max:1,skill:{id:'dodelijk',n:'Dodelijk Schot',cd:10,cost:30,range:34,need:1,cast:1.5,ic:['arrow','#ff5a3a','#3a0500'],d:'Een zorgvuldig gericht schot voor 320% wapenschade.'},d:'Leert je Dodelijk Schot: 1,5 s richten voor 320% wapenschade.',ic:['arrow','#ff5a3a','#3a0500']},
   {id:'j_geduld',n:'Geduld',t:2,max:2,mod:{critdmg:.10},d:'Kritieke treffers doen {10}% extra schade.',ic:['star','#ffd36a','#3a2a00']},
   {id:'j_pijlstorm',n:'Pijlstorm',t:3,max:2,mod:{'regen.cd':3},d:'Pijlregen is {3} s eerder klaar.',ic:['rain','#ffd36a','#4a2a00']},
   {id:'j_pees',n:'Snelle Pees',t:3,max:2,mod:{haste:.05},d:'+{5}% aanvalssnelheid.',ic:['boog','#e0c890','#3a2a10']},
   {id:'j_genade',n:'Genadeschot',t:4,max:1,skill:{id:'genadeschot',n:'Genadeschot',cd:12,cost:20,range:34,need:1,cond:'exec',ic:['skull','#ffe0a0','#3a1a00'],d:'Alleen op vijanden onder 30% levens: 400% wapenschade.'},d:'Leert je Genadeschot: 400% schade tegen vijanden onder 30% levens.',ic:['skull','#ffe0a0','#3a1a00']}]},
  {id:'overleving',n:'Overleving',ic:['leaf','#9be07a','#173d0d'],d:'Taai, wendbaar en vol vallen en gif.',nodes:[
   {id:'j_huid',n:'Taaie Huid',t:0,max:3,mod:{hpp:.04},d:'+{4}% levenspunten.',ic:['heart','#9be07a','#173d0d']},
   {id:'j_wendbaar',n:'Wendbaar',t:0,max:3,mod:{dodge:.02},d:'{2}% kans om een aanval te ontwijken.',ic:['leap','#9be07a','#173d0d']},
   {id:'j_vluchtig',n:'Vluchtig',t:1,max:2,mod:{'sprong.cd':3},d:'Terugsprong is {3} s eerder klaar.',ic:['leap','#7ad0e0','#0d3340']},
   {id:'j_leer',n:'Gehard Leer',t:1,max:3,mod:{armp:.06},d:'+{6}% pantser.',ic:['shield','#c8a878','#3a2a10']},
   {id:'j_explosief',n:'Explosief Schot',t:2,max:1,skill:{id:'explosief',n:'Explosief Schot',cd:12,cost:25,range:32,need:1,ic:['meteor','#ffb040','#3a1500'],d:'Een pijl die ontploft: 180% schade aan je doelwit en 90% aan alles binnen 5 meter.'},d:'Leert je Explosief Schot: een ontploffende pijl.',ic:['meteor','#ffb040','#3a1500']},
   {id:'j_herstel',n:'Herstel',t:2,max:2,mod:{regen:.004},d:'In gevecht herstel je {0.4}% levens per seconde.',ic:['heart','#7ad87a','#0d3a0d']},
   {id:'j_drang',n:'Overlevingsdrang',t:3,max:2,mod:{dr:.03},d:'Je krijgt {3}% minder schade.',ic:['shield','#9be07a','#173d0d']},
   {id:'j_splijt',n:'Splijtpijl',t:3,max:2,mod:{'multi.dmg':.15},d:'Meervoudig Schot doet {15}% meer schade.',ic:['multi','#9be07a','#173d0d']},
   {id:'j_gifpijl',n:'Gifpijl',t:4,max:1,skill:{id:'gifpijl',n:'Gifpijl',cd:6,cost:20,range:32,need:1,ic:['arrow','#7aff5a','#0d3a05'],d:'Een vergiftigde pijl: 300% wapenschade verspreid over 12 seconden.'},d:'Leert je Gifpijl: 300% schade over 12 seconden.',ic:['arrow','#7aff5a','#0d3a05']}]},
  {id:'wildernis',n:'Wildernis',ic:['wing','#ffd36a','#3a2a00'],d:'De kracht van de natuur en snelle reflexen.',nodes:[
   {id:'j_natuur',n:'Natuurkracht',t:0,max:3,mod:{powp:.03},d:'+{3}% kracht.',ic:['leaf','#9be07a','#173d0d']},
   {id:'j_instinct',n:'Jachtinstinct',t:0,max:3,mod:{crit:1.5},d:'+{1.5}% kritieke kans.',ic:['eye','#9be07a','#173d0d']},
   {id:'j_snelvoet',n:'Snelvoetig',t:1,max:2,mod:{speed:.05},d:'Je loopt {5}% sneller.',ic:['leap','#e0e0a0','#2a2a10']},
   {id:'j_focusbron',n:'Focusbron',t:1,max:3,mod:{mregen:.10},d:'Je focus herstelt {10}% sneller.',ic:['potion','#ff9a4a','#3a1a00']},
   {id:'j_wortels',n:'Verstrikkende Wortels',t:2,max:1,skill:{id:'wortels',n:'Verstrikkende Wortels',cd:18,cost:25,range:0,ic:['leaf','#7ad05a','#0d2a05'],d:'Wortels grijpen alle vijanden binnen 8 meter: 5 seconden vast en 60% schade.'},d:'Leert je Verstrikkende Wortels: houdt vijanden om je heen vast.',ic:['leaf','#7ad05a','#0d2a05']},
   {id:'j_bloedspoor',n:'Bloedspoor',t:2,max:2,mod:{'multi.targets':1},d:'Meervoudig Schot raakt {1} vijand extra.',ic:['multi','#ff8a6a','#3a0d05']},
   {id:'j_reflex',n:'Snelle Reflexen',t:3,max:2,mod:{cdall:.05},d:'Al je vaardigheden zijn {5}% sneller klaar.',ic:['clock','#9be07a','#173d0d']},
   {id:'j_roedel',n:'Wilde Kracht',t:3,max:2,mod:{exec:.06},d:'{6}% meer schade tegen vijanden onder 35% levens.',ic:['skull','#c8e0a0','#1a2a0d']},
   {id:'j_valk',n:'Valk van Velmora',t:4,max:1,skill:{id:'valk',n:'Valk van Velmora',cd:45,cost:30,range:32,need:1,ic:['wing','#ffd36a','#3a2a00'],d:'Je valk duikt 8 seconden lang elke seconde op je doelwit voor 60% wapenschade.'},d:'Leert je Valk van Velmora: 8 seconden aanvallen van je valk.',ic:['wing','#ffd36a','#3a2a00']}]}]
};
