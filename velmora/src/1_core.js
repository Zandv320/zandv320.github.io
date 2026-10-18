import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
/* ===================== utils ===================== */
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, smooth=t=>t*t*(3-2*t);
const rand=(a,b)=>a+Math.random()*(b-a), randi=(a,b)=>Math.floor(a+Math.random()*(b-a+1)), pick=a=>a[Math.floor(Math.random()*a.length)];
const d2=(ax,az,bx,bz)=>(ax-bx)*(ax-bx)+(az-bz)*(az-bz);
const angDiff=(a,b)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
function mulberry(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(x,z){let h=(Math.imul(x|0,374761393)+Math.imul(z|0,668265263))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967295}
function vnoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),xf=x-xi,zf=z-zi,u=xf*xf*(3-2*xf),v=zf*zf*(3-2*zf);return lerp(lerp(hash(xi,zi),hash(xi+1,zi),u),lerp(hash(xi,zi+1),hash(xi+1,zi+1),u),v)}
function fbm(x,z){let s=0,a=1,f=1,n=0;for(let i=0;i<4;i++){s+=vnoise(x*f,z*f)*a;n+=a;a*=.5;f*=2.03}return s/n}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isTouch=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window&&navigator.maxTouchPoints>0);
if(isTouch)document.body.classList.add('touch');
let uidN=Date.now()%100000;const uid=()=>(uidN++).toString(36)+Math.random().toString(36).slice(2,6);

/* ===================== data ===================== */
const RACES={
  mens:{n:'Mens',skin:0xe2b48e,desc:'Veelzijdige mensen uit de kustrijken. Leren snel: +10% ervaring.',xp:1.1,h:1,w:1,hair:[0x3b2414,0xc79a4b,0x1b1b1b,0x8a3b1c]},
  elf:{n:'Elf',skin:0xf0d2b8,desc:'Slanke woudelfen uit Lirhaven. Scherpe geest: +15% mana en kracht, iets sneller.',mp:1.15,pow:1.05,spd:1.05,h:1.06,w:.92,hair:[0xf2e2a0,0xd8d8e8,0x5a2d7a,0x2c4a2a]},
  dwerg:{n:'Dwerg',skin:0xd99b7a,desc:'Taaie bergdwergen uit Karak Duun. Stevig gebouwd: +12% levenspunten.',hp:1.12,h:.8,w:1.18,hair:[0xb5541c,0x6b4a2b,0xd9d0c0,0x262626]},
  grol:{n:'Grol',skin:0x6f9a4a,desc:'Trotse grollen van de Asvlakte. Woeste kracht: +10% schade.',dmg:1.1,h:1.04,w:1.12,hair:[0x1d1d1d,0x6a2b1b,0x3c3c3c,0xb8b8b8]}
};
const CLASSES={
  krijger:{n:'Krijger',desc:'Vecht van dichtbij met zwaard en bijl. Veel levenspunten en harde klappen. Gebruikt energie.',res:'energie',hp:90,hpL:22,sta:10,staL:2.2,pow:12,powL:3,range:3.2,spd:2.3,cape:0x8c1f1f,chest:0x7a7f88,pants:0x3d3a36,wt:'zwaard',armorK:3,col:'#c79c6e'},
  magier:{n:'Magiër',desc:'Beheerst vuur en vorst op afstand. Weinig levenspunten, enorme schade. Gebruikt mana.',res:'mana',hp:70,hpL:15,sta:8,staL:1.6,pow:14,powL:3.6,range:28,spd:1.9,cape:0x2a3f9a,chest:0x4b3a8c,pants:0x2b2340,wt:'staf',armorK:1,col:'#69ccf0'},
  jager:{n:'Jager',desc:'Een scherpschutter met pijl en boog. Snel, wendbaar en dodelijk op afstand. Gebruikt focus.',res:'focus',hp:80,hpL:18,sta:9,staL:1.9,pow:13,powL:3.3,range:30,spd:2.2,cape:0x2f5a2a,chest:0x6b4b2a,pants:0x3b3022,wt:'boog',armorK:2,col:'#abd473'}
};
const RES_COL={energie:'enb',mana:'mpb',focus:'fob'};
/* ability icons are drawn procedurally: [glyph, color1, color2] */
const ABIL={
  krijger:[
    {id:'slag',n:'Heldhaftige Slag',lvl:1,cd:0,cost:15,range:3.4,need:1,ic:['sword','#d9a441','#5a2a0a'],d:'Een krachtige slag die 150% wapenschade doet.'},
    {id:'storm',n:'Stormloop',lvl:2,cd:12,cost:0,range:25,min:5,need:1,ic:['charge','#e0632a','#3d0d06'],d:'Storm naar je doelwit en verdoof het 1,5 seconde.'},
    {id:'werv',n:'Wervelwind',lvl:4,cd:8,cost:30,range:0,ic:['whirl','#cfd6e0','#2b3342'],d:'Draai rond en raak alle vijanden binnen 6 meter voor 110% wapenschade.'},
    {id:'kreet',n:'Strijdkreet',lvl:6,cd:45,cost:0,range:0,ic:['shout','#ffcf4d','#7a2a00'],d:'Herstelt 25% levenspunten en geeft 12 seconden lang 25% meer schade.'}],
  magier:[
    {id:'vuur',n:'Vuurschicht',lvl:1,cd:0,cost:12,range:30,need:1,cast:1.3,ic:['fire','#ffb02e','#7a1500'],d:'Werpt een vuurschicht die 170% spreukkracht aan schade doet.'},
    {id:'nova',n:'Vorstnova',lvl:2,cd:14,cost:22,range:0,ic:['frost','#a8e4ff','#0d3a66'],d:'Bevriest alle vijanden binnen 9 meter 4 seconden en doet lichte schade.'},
    {id:'flits',n:'Flits',lvl:4,cd:15,cost:15,range:0,ic:['blink','#d9a8ff','#3a1266'],d:'Teleporteer 13 meter vooruit.'},
    {id:'meteoor',n:'Meteoor',lvl:6,cd:20,cost:35,range:30,need:1,cast:1.8,ic:['meteor','#ff7a2e','#4a0d00'],d:'Een meteoor slaat in bij je doelwit: 260% schade aan alles binnen 6 meter.'}],
  jager:[
    {id:'schot',n:'Gericht Schot',lvl:1,cd:0,cost:15,range:32,need:1,ic:['arrow','#e8d7a0','#3d2a0f'],d:'Een zorgvuldig gericht schot voor 150% wapenschade.'},
    {id:'multi',n:'Meervoudig Schot',lvl:2,cd:8,cost:25,range:32,need:1,ic:['multi','#9be07a','#173d0d'],d:'Raakt je doelwit en tot vier vijanden in de buurt voor 95% wapenschade.'},
    {id:'sprong',n:'Terugsprong',lvl:4,cd:15,cost:0,range:0,ic:['leap','#7ad0e0','#0d3340'],d:'Spring 11 meter naar achteren, weg van gevaar.'},
    {id:'regen',n:'Pijlregen',lvl:6,cd:18,cost:35,range:32,need:1,ic:['rain','#ffd36a','#4a2a00'],d:'Een regen van pijlen: 230% schade aan alles binnen 6 meter van je doelwit.'}]
};
const COMMON_ABIL=[
  {id:'drank',n:'Genezend drankje',lvl:1,cd:20,cost:0,item:'heal',ic:['potion','#ff4b4b','#3d0505'],d:'Herstelt direct 45% van je levenspunten.'},
  {id:'mdrank',n:'Krachtdrankje',lvl:1,cd:20,cost:0,item:'mana',ic:['potion','#4b8bff','#05153d'],d:'Herstelt direct 50% van je mana, energie of focus.'},
  {id:'thuis',n:'Thuissteen',lvl:1,cd:60,cost:0,cast:4,ic:['hearth','#7cf0ff','#0b2a3a'],d:'Keer na 4 seconden terug naar het plein van Zilverbron.'}
];
const MON={
  ever:{n:'Wilde Ever',kind:'boar',col:0x6b4a32,lv:[1,2],aggro:0,spd:5.2,size:1,xpM:1},
  wolf:{n:'Schemerwolf',kind:'wolf',col:0x5d6470,lv:[2,4],aggro:11,spd:6.5,size:1,xpM:1},
  spin:{n:'Woudspin',kind:'spider',col:0x3a2a4a,lv:[4,6],aggro:11,spd:5.6,size:1.15,xpM:1},
  rover:{n:'Struikrover',kind:'human',col:0x8a2020,lv:[5,7],aggro:13,spd:5.8,size:1,xpM:1,wt:'zwaard'},
  grisk:{n:'Roverhoofdman Grisk',kind:'human',col:0xb08a20,lv:[8,8],aggro:14,spd:5.8,size:1.3,elite:1,xpM:1,wt:'bijl',respawn:90},
  knekel:{n:'Knekelwachter',kind:'skel',col:0xe6e0cc,lv:[8,9],aggro:13,spd:5.4,size:1,xpM:1,wt:'zwaard'},
  kmagier:{n:'Knekelmagiër',kind:'skel',col:0xe6e0cc,lv:[9,9],aggro:16,spd:5,size:1,xpM:1.1,wt:'staf',ranged:20,robe:0x4a1f6a},
  boss:{n:'Kaal-Morath de Knekelkoning',kind:'skel',col:0xd9d2b0,lv:[10,10],aggro:18,spd:5.2,size:2.3,boss:1,elite:1,xpM:1,wt:'bijl',robe:0x2a0d3a,respawn:120},
  dienaar:{n:'Opgeroepen Dienaar',kind:'skel',col:0xbfb8a0,lv:[8,8],aggro:40,spd:6,size:.9,xpM:.3,wt:'zwaard',add:1},
  vuurimp:{n:'Vuurimp',kind:'imp',col:0xc8401a,lv:[10,11],aggro:15,spd:6.2,size:.8,xpM:1,ranged:16,proj:'fire'},
  lavagolem:{n:'Lavagolem',kind:'golem',col:0x3a302a,lv:[11,12],aggro:12,spd:4.4,size:1.35,xpM:1.5,hpM:1.7},
  ignaroth:{n:'Ignaroth de Smeltende',kind:'golem',col:0x2a201c,lv:[12,12],aggro:18,spd:4.8,size:2.6,boss:1,elite:1,xpM:1.2,respawn:120,fire:1,hpM:1.5},
  vonk:{n:'Vonkimp',kind:'imp',col:0xff7a2a,lv:[10,10],aggro:40,spd:7,size:.65,xpM:.3,ranged:14,proj:'fire',add:1},
  /* Drakenrijk (niveau 13–20) */
  raptor:{n:'Asraptor',kind:'raptor',col:0x5a5550,lv:[13,14],aggro:15,spd:7.4,size:1.1,xpM:1},
  vleer:{n:'Vuurvleermuis',kind:'bat',col:0x3a1410,lv:[14,15],aggro:15,spd:6.8,size:.9,xpM:1,hover:1.6},
  welp:{n:'Drakenwelp',kind:'dragon',col:0xb83a1a,lv:[15,16],aggro:15,spd:6.2,size:1.25,xpM:1.05,ranged:14,proj:'fire'},
  drakonier:{n:'Drakenpriester',kind:'human',col:0x8a2a1a,lv:[16,17],aggro:17,spd:5.4,size:1,xpM:1.1,ranged:18,proj:'fire',wt:'staf'},
  lavadrake:{n:'Lavadrake',kind:'trex',col:0x2a1a16,lv:[17,18],aggro:16,spd:5.8,size:2.3,elite:1,xpM:1,hpM:1.2,respawn:75},
  broedling:{n:'Vuurbroedling',kind:'dragon',col:0xd85a1a,lv:[19,19],aggro:40,spd:7.2,size:.95,xpM:.3,ranged:12,proj:'fire',add:1},
  vyraxion:{n:'Vyraxion de Asvorst',kind:'dragon',col:0x8a1a12,lv:[22,22],aggro:26,spd:6,size:4.2,boss:1,elite:1,dragon:1,dmgM:1.6,xpM:1.6,hpM:4,respawn:300,fire:1}
};
const QUESTS=[
  {id:'q1',n:'Everplaag',giver:'wilma',lvl:1,txt:'Die wilde evers ploegen mijn akkers om voor ik ze kan zaaien! Jaag er vijf weg van de velden ten zuiden van het dorp, alsjeblieft.',obj:{kill:['ever'],n:5,lbl:'Wilde Ever gedood'},xp:160,gold:6,item:1,done:'Ha! Eindelijk rust op mijn akkers. Neem dit, het lag nog in de schuur.'},
  {id:'q2',n:'Wolven aan de Poort',giver:'aldren',lvl:2,txt:'Schemerwolven sluipen elke nacht dichter naar Zilverbron. Ga het Schemerwoud in, ten noorden van het dorp, en dood er zes.',obj:{kill:['wolf'],n:6,lbl:'Schemerwolf gedood'},xp:280,gold:10,item:1,done:'Goed werk, rekruut. De wacht slaapt vannacht een stuk rustiger.'},
  {id:'q3',n:'Spinnengif',giver:'mirla',lvl:3,txt:'Voor mijn geneesdrankjes heb ik gifklieren nodig van de Woudspinnen diep in het Schemerwoud, in het noordwesten. Breng me er vijf.',obj:{collect:['spin'],n:5,chance:.6,lbl:'Gifklier verzameld',item:'Gifklier'},xp:420,gold:14,item:1,pots:3,done:'Prachtig, nog vers ook! Hier, wat drankjes voor onderweg.'},
  {id:'q4',n:'Het Roverkamp',giver:'aldren',lvl:5,req:'q2',txt:'Rovers hebben een kamp opgeslagen ten oosten van hier en overvallen onze karavanen. Versla zes Struikrovers en hun leider, Grisk.',obj:{kill:['rover','grisk'],n:7,lbl:'Rovers verslagen'},xp:750,gold:25,item:2,done:'Grisk verslagen? Dan zijn de wegen weer veilig. Je verdient deze beloning.'},
  {id:'q5',n:'Rust voor de Doden',giver:'anselm',lvl:7,txt:'In de Crypte van Kaal-Morath, in de heuvels in het noordwesten, staan de doden op. Breng acht van hen terug tot rust.',obj:{kill:['knekel','kmagier'],n:8,lbl:'Ondoden tot rust gebracht'},xp:1100,gold:35,item:2,done:'Het Licht zij dank. Maar ik voel dat hun meester nog altijd waakt…'},
  {id:'ql1',n:'Kruidenkennis',giver:'mirla',lvl:1,txt:'Wil je leren hoe je zelf drankjes maakt? Begin bij het begin: pluk zes Zonnekruiden. Je vindt die gele, gloeiende plantjes in de velden rond het dorp. Ga ernaartoe en druk op F (of tik op Actie).',obj:{gather:'Zonnekruid',n:6,lbl:'Zonnekruid geplukt'},xp:140,gold:4,life:{verzamelen:60},done:'Mooi geplukt! Open je ambachtsboek met K om te zien wat je ermee kunt maken.'},
  {id:'ql2',n:'Verse Vis',giver:'bram',lvl:1,txt:'Mijn klanten willen verse vis uit het Spiegelmeer, ten westen van het dorp. Ga aan de oever staan, druk op F om te vissen en sla toe zodra er beet is. Vang er drie.',obj:{fish:1,n:3,lbl:'Vissen gevangen'},xp:180,gold:12,life:{vissen:80},done:'Wat een vangst! Die verkoop ik nog vandaag.'},
  {id:'ql3',n:'Proef de Keuken',giver:'wilma',lvl:2,req:'ql2',txt:'Een hongerige boer is een luie boer. Bak twee gegrilde vissen bij het kookvuur naast de fontein. Gegrilde vis geeft je trouwens extra levenspunten.',obj:{craft:'gvis',n:2,lbl:'Gegrilde vis gebakken'},xp:220,gold:10,life:{koken:90},done:'Heerlijk! Je wordt nog eens een echte kok.'},
  {id:'q6',n:'De Knekelkoning',giver:'anselm',lvl:8,req:'q5',txt:'Kaal-Morath, de Knekelkoning, zit op zijn troon diep in de crypte. Zolang hij bestaat, zullen de doden blijven opstaan. Verzamel bondgenoten en versla hem.',obj:{kill:['boss'],n:1,lbl:'Kaal-Morath verslagen'},xp:2400,gold:80,item:3,done:'Je hebt het onmogelijke gedaan. Zilverbron zal je naam bezingen, held!'},
  {id:'q7',n:'Vuur in de Diepte',giver:'dorrik',lvl:10,txt:'Sinds de mijn openbrak naar de Vuurgrot, kruipen er imps en lavagolems naar buiten. Ga de grot in, hier achter mij, en versla er tien.',obj:{kill:['vuurimp','lavagolem'],n:10,lbl:'Vuurwezens verslagen'},xp:2600,gold:60,item:2,done:'Dat koelt de boel een beetje af. Maar het hart van de grot gloeit nog altijd…'},
  {id:'d1',n:'Asraptors op de Vlakte',giver:'vaelra',lvl:13,txt:'Welkom in het Drakenrijk, avonturier. Eerst het begin: roedels Asraptors jagen op alles wat beweegt, ten noorden van ons kamp. Dun ze uit: tien stuks.',obj:{kill:['raptor'],n:10,lbl:'Asraptor gedood'},xp:3200,gold:70,item:2,done:'Snel en vals, die beesten. Goed werk. Nu kunnen we verder kijken.'},
  {id:'d2',n:'Vuur in de Lucht',giver:'vaelra',lvl:14,req:'d1',txt:'Boven de Vuurvelden, ten noorden van de vulkaan, zwermen Vuurvleermuizen. Ze steken ons kamp elke nacht bijna in brand. Haal er acht uit de lucht.',obj:{kill:['vleer'],n:8,lbl:'Vuurvleermuis gedood'},xp:3700,gold:80,item:2,done:'Eindelijk een nacht zonder vonkenregen. Dank je.'},
  {id:'d3',n:'Het Broed van Vyraxion',giver:'vaelra',lvl:15,req:'d2',txt:'In de nesten ten zuiden van de vulkaan zijn de eieren van Vyraxion uitgekomen. Als die welpen opgroeien zijn we verloren. Versla tien Drakenwelpen.',obj:{kill:['welp'],n:10,lbl:'Drakenwelp verslagen'},xp:4300,gold:95,item:2,done:'Het broed is uitgedund. Maar de moeder… die zal dit niet vergeten.'},
  {id:'d4',n:'De Drakenpriesters',giver:'vaelra',lvl:16,req:'d3',txt:'Bij de schrijnen in het oosten aanbidden fanatieke Drakenpriesters de Asvorst en voeden hem met hun vuur. Breek hun macht: versla er acht.',obj:{kill:['drakonier'],n:8,lbl:'Drakenpriester verslagen'},xp:4900,gold:110,item:3,done:'Hun gezangen zwijgen. Je bent sterker dan ik dacht.'},
  {id:'d5',n:'Reuzen van Lava',giver:'vaelra',lvl:17,req:'d4',txt:'Op de flanken van de vulkaan stampen Lavadrakes rond: enorme beesten met een huid van gestold gesteente. Versla er drie. Neem drankjes mee.',obj:{kill:['lavadrake'],n:3,lbl:'Lavadrake verslagen'},xp:5600,gold:130,item:3,done:'Drie! Je bent klaar voor wat komen gaat.'},
  {id:'d6',n:'Het Hart van de Vulkaan',giver:'vaelra',lvl:19,req:'d5',txt:'Halverwege de westflank van de vulkaan ligt de ingang naar zijn hart. Daar ligt Vyraxion de Asvorst op haar schat. Ze vliegt op, spuwt vuur en roept haar broed. Ontwijk haar adem, blijf uit het vuur, en versla haar. Wie haar velt, krijgt een legendarisch wapenstuk uit haar schat.',obj:{kill:['vyraxion'],n:1,lbl:'Vyraxion verslagen'},xp:12000,gold:400,item:3,done:'Vyraxion is gevallen! Het Drakenrijk is vrij, en jouw naam wordt in elk lied bezongen, Drakendoder.'},
  {id:'q8',n:'Het Smeltende Hart',giver:'dorrik',lvl:11,req:'q7',txt:'Diep in de grot woont Ignaroth, een golem van lava zo oud als de bergen. Zolang hij leeft, smelt de grot steeds verder door. Neem vrienden mee en dooft zijn vuur.',obj:{kill:['ignaroth'],n:1,lbl:'Ignaroth verslagen'},xp:5200,gold:150,item:3,done:'Ignaroth is gedoofd! De Asbergen zijn je eeuwig dankbaar, held.'}
];
const NPCS=[
  {id:'aldren',n:'Kapitein Aldren',t:'Hoofd van de Wacht',x:6,z:-14,ry:Math.PI,look:{skin:0xd9a98a,hair:0x5a4a3a,chest:0x3f5a9a,pants:0x2a2a30,cape:0x2a4a9a,wt:'zwaard',helm:1,beard:1},hi:'Houd je zwaard scherp en je ogen open, avonturier.'},
  {id:'mirla',n:'Kruidenvrouw Mirla',t:'Alchemiste',x:-15,z:4,ry:Math.PI/2,look:{skin:0xf0d2b8,hair:0xd8d8e8,chest:0x4a7a3a,pants:0x3a5a2a,cape:0x2a4a2a,wt:'staf',ears:1},hi:'Kruiden, wortels en een snufje magie. Wat kan ik voor je doen?'},
  {id:'wilma',n:'Boerin Wilma',t:'Boerin',x:4,z:44,ry:Math.PI,look:{skin:0xe2b48e,hair:0xc79a4b,chest:0x9a6a3a,pants:0x5a4a3a,wt:'none'},hi:'Een mooie dag om te ploegen, als die evers er niet waren.'},
  {id:'anselm',n:'Broeder Anselm',t:'Priester van het Licht',x:22,z:12,ry:-Math.PI/2,look:{skin:0xe2b48e,hair:0xd9d9d9,chest:0xe8e2d0,pants:0xd0c8b0,cape:0xd9b44a,wt:'staf',beard:1},hi:'Moge het Licht je pad verlichten, kind.'},
  {id:'bram',n:'Handelaar Bram',t:'Koopman',x:-8,z:-10,ry:0,look:{skin:0xd99b7a,hair:0xb5541c,chest:0x8a5a2a,pants:0x4a3a2a,wt:'none',beard:1,dwarf:1},hi:'Drankjes, vers van de ketel! En ik koop al je oude rommel.',shop:1},
  {id:'dorrik',n:'Mijnwerker Dorrik',t:'Mijnbaas',x:198,z:-166,ry:Math.PI*.2,look:{skin:0xd99b7a,hair:0x6b4a2b,chest:0x6a5a4a,pants:0x3a3028,wt:'bijl',beard:1,dwarf:1,helm:1},hi:'Pas op voor de hitte, vriend. Achter mij ligt de Vuurgrot van Ignaroth.'},
  {id:'vaelra',n:'Vaelra de Drakenjager',t:'Drakenjagerskamp',x:-1736,z:20,ry:-Math.PI/2,look:{skin:0xd9a98a,hair:0x9a2a1a,chest:0x6a2a1a,pants:0x3a2a20,cape:0x6a1a10,wt:'boog'},hi:'Welkom in het Drakenrijk. Blijf uit de lava, en kijk altijd omhoog.'},
  {id:'thorne',n:'Wachter Thorne',t:'Cryptewachter',x:-160,z:-196,ry:Math.PI*.85,look:{skin:0x6f9a4a,hair:0x1d1d1d,chest:0x5a5a5a,pants:0x2a2a2a,cape:0x5a1a1a,wt:'bijl',helm:1,tusks:1},hi:'De crypte achter mij is geen plek voor zwakkelingen. Ga met een groep, of ga helemaal niet.'}
];
const RARITY=[{n:'Gewoon',c:'#ffffff'},{n:'Ongewoon',c:'#2bd94a'},{n:'Zeldzaam',c:'#3b8cff'},{n:'Episch',c:'#b65cff'},{n:'Legendarisch',c:'#ff8000'}];
const SLOTS=['hoofd','borst','handen','benen','voeten','ring','wapen'];
const SLOT_NL={wapen:'Wapen',hoofd:'Hoofd',borst:'Borst',handen:'Handen',benen:'Benen',voeten:'Voeten',ring:'Vinger'};
const MAT={krijger:['IJzeren','Stalen','Maliën','Gehavende'],magier:['Zijden','Linnen','Runen','Sterrenstof'],jager:['Leren','Wolfsleren','Schubben','Valkenveren']};
const BASE={hoofd:{krijger:'Helm',magier:'Puntmuts',jager:'Kap'},borst:{krijger:'Borstplaat',magier:'Gewaad',jager:'Tuniek'},handen:{krijger:'Handschoenen',magier:'Handschoenen',jager:'Handschoenen'},benen:{krijger:'Beenplaten',magier:'Broek',jager:'Broek'},voeten:{krijger:'Laarzen',magier:'Sandalen',jager:'Laarzen'}};
const WEAP={krijger:[['Zwaard','zwaard'],['Strijdbijl','bijl']],magier:[['Staf','staf'],['Toverstaf','staf']],jager:[['Boog','boog'],['Langboog','boog']]};
const SUFFIX=[['van de Beer',0,1],['van de Tijger',1,0],['van de Adelaar',.6,.6],['van de Uil',.8,.3],['van de Wolf',.5,.7],['van het Licht',.7,.5]];
const JUNK={ever:['Everslagtand','Ruwe everhuid'],wolf:['Wolfspels','Gebroken hoektand'],spin:['Spinrag','Chitineschild'],rover:['Gestolen zakdoek','Dobbelstenen'],grisk:['Grisks oorring'],knekel:['Vergeeld bot','Roestige gesp'],kmagier:['Stoffig perkament'],boss:['Kroonsplinter'],dienaar:['Botsplinter']};
const ARM_SLOT={hoofd:.9,borst:1.4,handen:.6,benen:1.1,voeten:.7,ring:0,wapen:0};
const xpNeed=l=>40*l+15*l*l;
const MAXLVL=20;
/* ===== life skills (inspired by Black Desert) ===== */
const RANKS=['Beginner','Leerling','Bekwaam','Vakkundig','Ambachtsman','Meester','Goeroe'];
const LIFE={verzamelen:{n:'Verzamelen',ic:'herb'},vissen:{n:'Vissen',ic:'fish'},bewerken:{n:'Bewerken',ic:'ingot'},koken:{n:'Koken',ic:'food'},alchemie:{n:'Alchemie',ic:'elixir'}};
const lifeNeed=l=>50+l*18;const rankOf=l=>RANKS[Math.min(6,Math.floor(l/10))]+' '+(l%10+1);
const MATS={
  'Hout':{ic:'log',c1:'#b07a44',price:1,tag:'hout'},'Stevig hout':{ic:'log',c1:'#7a4a24',price:4,tag:'hout',r:1},
  'IJzererts':{ic:'ore',c1:'#c87a3a',price:1},'Zilvererts':{ic:'ore',c1:'#d8e0ea',price:3,r:1},
  'Zonnekruid':{ic:'herb',c1:'#ffd94a',price:1,tag:'kruid'},'Maanbloem':{ic:'herb',c1:'#7ab8ff',price:2,tag:'kruid'},'Bloedwortel':{ic:'herb',c1:'#e04040',price:3,tag:'kruid'},
  'Baars':{ic:'fish',c1:'#9ab070',price:2,tag:'vis'},'Karper':{ic:'fish',c1:'#c8a050',price:3,tag:'vis'},'Snoek':{ic:'fish',c1:'#6a8a6a',price:4,tag:'vis'},'Goudbaars':{ic:'fish',c1:'#ffcf3a',price:12,tag:'vis',r:2},'Meerspook':{ic:'fish',c1:'#c8a8ff',price:40,tag:'vis',r:3},
  'Rauw vlees':{ic:'meat',c1:'#c8504a',price:1},
  'Planken':{ic:'plank',c1:'#c8945a',price:6},'IJzerstaaf':{ic:'ingot',c1:'#9aa0a8',price:7},'Zilverstaaf':{ic:'ingot',c1:'#e8eef4',price:16,r:1},'Kruidenpoeder':{ic:'powder',c1:'#9ad06a',price:4},
  'Gegrilde vis':{ic:'food',c1:'#d8904a',price:6,food:{hp:.1,dur:600,d:'+10% levenspunten'}},'Jagersstoofpot':{ic:'food',c1:'#a0603a',price:9,food:{pow:.08,dur:600,d:'+8% kracht'}},'Vissoep':{ic:'food',c1:'#e8d08a',price:18,r:1,food:{hp:.15,pow:.05,dur:900,d:'+15% levenspunten en +5% kracht'}},
  'Elixir van Woede':{ic:'elixir',c1:'#ff5a3a',price:14,r:1,elixir:{dmg:.15,dur:600,d:'+15% schade'}},'Elixir van IJzerhuid':{ic:'elixir',c1:'#a0b8d0',price:14,r:1,elixir:{arm:.3,dur:600,d:'+30% pantser'}}
};
const RECIPES=[
  {id:'plank',sk:'bewerken',out:'Planken',q:1,in:[['Hout',4,'hout']],lv:0,t:1.6},
  {id:'ijzer',sk:'bewerken',out:'IJzerstaaf',q:1,in:[['IJzererts',4]],lv:0,t:1.6},
  {id:'zilver',sk:'bewerken',out:'Zilverstaaf',q:1,in:[['Zilvererts',4]],lv:8,t:1.8},
  {id:'poeder',sk:'bewerken',out:'Kruidenpoeder',q:1,in:[['Kruid',3,'kruid']],lv:0,t:1.4},
  {id:'gvis',sk:'koken',st:'vuur',out:'Gegrilde vis',q:1,in:[['Vis',1,'vis'],['Zonnekruid',1]],lv:0,t:2},
  {id:'stoof',sk:'koken',st:'vuur',out:'Jagersstoofpot',q:1,in:[['Rauw vlees',2],['Maanbloem',1]],lv:4,t:2.2},
  {id:'soep',sk:'koken',st:'vuur',out:'Vissoep',q:1,in:[['Vis',2,'vis'],['Bloedwortel',1],['Kruidenpoeder',1]],lv:12,t:2.6},
  {id:'heal',sk:'alchemie',st:'tafel',out:'Genezend drankje',q:2,in:[['Zonnekruid',2],['Kruidenpoeder',1]],lv:0,t:2,potion:'heal'},
  {id:'mana',sk:'alchemie',st:'tafel',out:'Krachtdrankje',q:2,in:[['Maanbloem',2],['Kruidenpoeder',1]],lv:2,t:2,potion:'mana'},
  {id:'woede',sk:'alchemie',st:'tafel',out:'Elixir van Woede',q:1,in:[['Bloedwortel',2],['IJzerstaaf',1]],lv:8,t:2.6},
  {id:'ijzerhuid',sk:'alchemie',st:'tafel',out:'Elixir van IJzerhuid',q:1,in:[['IJzerstaaf',1],['Maanbloem',2],['Kruidenpoeder',1]],lv:10,t:2.6}
];
const FISH=[['Baars',45],['Karper',30],['Snoek',17],['Goudbaars',6],['Meerspook',2]];
const BAG=36;
