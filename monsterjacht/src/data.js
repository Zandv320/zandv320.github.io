/* Monsterjacht – spelgegevens: typen, monsters, aanvallen.
   Alle modellen zijn gedownloade assets van Sketchfab (CC-BY) en Gobkit (CC0), zie models/CREDITS.md. */

export const TYPES={
  Vuur:   {kleur:'#ff6a2b',sterk:['Gras'],zwak:['Water','Steen','Aarde']},
  Water:  {kleur:'#3aa0ff',sterk:['Vuur','Steen','Aarde'],zwak:['Gras','Elektro']},
  Gras:   {kleur:'#4fd35a',sterk:['Water','Aarde','Steen'],zwak:['Vuur','Spook']},
  Elektro:{kleur:'#ffd62b',sterk:['Water'],zwak:['Aarde']},
  Normaal:{kleur:'#d8d0bc',sterk:[],zwak:['Steen']},
  Steen:  {kleur:'#b08f6a',sterk:['Vuur','Elektro','Normaal'],zwak:['Water','Gras']},
  Aarde:  {kleur:'#d9a44f',sterk:['Elektro','Vuur'],zwak:['Water','Gras']},
  Spook:  {kleur:'#b07cff',sterk:['Gras','Normaal'],zwak:['Spook']},
};
export function effectiviteit(aanval,doel){
  const t=TYPES[aanval],d=TYPES[doel];if(!t||!d)return 1;
  let f=1;if(t.sterk.includes(doel)||d.zwak.includes(aanval))f*=1.8;
  if(d.sterk.includes(aanval))f*=0.6;
  return f;
}

/* Zones op het eiland en welke soorten daar in het hoge gras lopen. */
export const ZONES={
  weide: {naam:'Zonneweide',    soorten:['shibo','dikmuis','hampie','blauwvink','vosje','donutje','kwakkie','paddo','aardbeikat','nami']},
  strand:{naam:'Schelpenstrand',soorten:['octie','garnalo','zwemsaurus','kwalslijm','blobbel','zeedraakje','blauwtje','rikudrak','bananeend','blauwblaf']},
  bos:   {naam:'Gloedbos',      soorten:['uitje','bijtkelk','snapplant','blaadpad','hertkwak','vonkbot','sterslijm','lampkrab','paarsje','blauwzap','spookie','flapoog']},
  rots:  {naam:'Donderrotsen',  soorten:['rotsoog','pantserslijm','slaapdrak','spinnie','tentakul','modderbol','groenebeet','stekeldrak','vuurbok','oranjetje','rozebek','oogbol']},
  top:   {naam:'Schemertop',    soorten:['vlamdrak','gloeidraak','heksspook','huisspook','dikspook','dikvink','paddoking','zweefbot','spinnekoning']},
};

/* Per soort: naam, type, modelbestand, hoogte in meters, draai (rotY zodat het gezicht naar +Z wijst),
   zweef (hoogte boven de grond voor vliegers), basiswaarden op level 1, vangkans, evolutie. */
const M={};let dex=0;
function soort(id,naam,type,model,hoogte,basis,o={}){M[id]={id,naam,type,model:'models/monsters/'+model+'.glb',hoogte,basis,vang:o.vang??.5,rot:o.rot??0,zweef:o.zweef??0,evolutie:o.evolutie||null,omschrijving:o.om||'',dex:++dex,legendarisch:!!o.leg,maker:o.maker||''}}

soort('rooddraakje','Rooddraakje','Vuur','cute_pet_dragon_baby',0.9,{hp:44,atk:12,def:8,spd:1.0},{vang:.6,evolutie:{naar:'vlamdrak',level:16},om:'Een rood draakje dat nog oefent met vuur spuwen. Soms komt er alleen rook uit.',maker:'outcast945'});
soort('vlamdrak','Vlamdrak','Vuur','dragon_idle',1.5,{hp:66,atk:18,def:12,spd:1.0},{vang:.25,om:'Volgroeid Rooddraakje. Zijn gouden hoorns gloeien als hij boos is.',maker:'KaitlynAndrus'});
soort('vuurbok','Vuurbok','Vuur','fire_elemental_goat_model',1.3,{hp:58,atk:16,def:10,spd:1.05},{vang:.35,rot:Math.PI,om:'Een bok van levend vuur. Laat zwarte hoefafdrukken achter.',maker:'Crowkles'});
soort('gloeidraak','Gloeidraak','Vuur','west_dragon',1.3,{hp:60,atk:17,def:11,spd:1.1},{vang:.3,om:'Een westerse draak in zakformaat. Verzamelt glimmende steentjes.',maker:'mozyapene'});
soort('oranjetje','Oranjetje','Vuur','kit_monster_b',0.9,{hp:46,atk:13,def:8,spd:1.05},{vang:.55,om:'Een oranje monstertje met een eeuwige glimlach en hete handjes.',maker:'JoRCS'});
soort('rozebek','Rozebek','Vuur','cartoon_monster',1.2,{hp:56,atk:15,def:11,spd:0.9},{vang:.4,om:'Zijn roze stekels worden donkerrood vlak voor hij aanvalt.',maker:'emelyarules'});

soort('kwakkie','Kwakkie','Water','baby_duck',0.7,{hp:42,atk:10,def:8,spd:1.0},{vang:.65,rot:Math.PI/2,evolutie:{naar:'bananeend',level:14},om:'Een gele eend die overal water vindt, zelfs in de woestijn.',maker:'patspet'});
soort('bananeend','Bananeend','Water','banana_duck',1.3,{hp:60,atk:15,def:12,spd:1.0},{vang:.3,rot:Math.PI/2,om:'Volgroeid Kwakkie. Niemand weet waarom de schil erbij kwam.',maker:'catwithantlers'});
soort('octie','Octie','Water','cute_octopus',1.0,{hp:50,atk:12,def:10,spd:0.85},{vang:.5,zweef:0.2,om:'Acht armen, acht knuffels. Of acht klappen.',maker:'tadenstar'});
soort('garnalo','Garnalo','Water','ebi_shrimp_rigged',0.8,{hp:40,atk:13,def:7,spd:1.2},{vang:.55,rot:Math.PI,zweef:0.4,om:'Een garnaal die door de lucht zwemt. Snel en pittig.',maker:'zackw'});
soort('zwemsaurus','Zwemsaurus','Water','pistosaur_animated',1.3,{hp:62,atk:16,def:11,spd:1.0},{vang:.3,rot:Math.PI,zweef:0.5,om:'Een zeereptiel uit lang vervlogen tijden. Zwemt door gras alsof het water is.',maker:'ricksticky'});
soort('kwalslijm','Kwalslijm','Water','neco_slime',0.7,{hp:44,atk:9,def:11,spd:0.8},{vang:.65,om:'Een doorzichtig slijmpje met een kattengezicht erin.',maker:'lainwuw'});
soort('blobbel','Blobbel','Water','slime_groot',0.8,{hp:52,atk:9,def:13,spd:0.7},{vang:.6,om:'Een grote druppel die alles absorbeert wat erin valt.',maker:'MartinDL'});
soort('zeedraakje','Zeedraakje','Water','east_dragon',1.1,{hp:54,atk:14,def:11,spd:1.0},{vang:.35,om:'Een oosters draakje met pareloogjes. Brengt regen.',maker:'mozyapene'});
soort('blauwtje','Blauwtje','Water','kit_monster_a',0.9,{hp:46,atk:12,def:9,spd:1.05},{vang:.55,om:'Een blauw monstertje met één hoorn en een waterballon als buik.',maker:'JoRCS'});
soort('rikudrak','Rikudrak','Water','baby_dragon_riku',1.2,{hp:56,atk:15,def:10,spd:1.1},{vang:.35,om:'Een zeegroene draak die bellen blaast die knallen.',maker:'BlueMesh'});
soort('blauwblaf','Blauwblaf','Water','little_monster',0.9,{hp:50,atk:13,def:9,spd:1.1},{vang:.5,om:'Half pup, half golf. Spettert als hij blij is.',maker:'LizzyKoopa'});

soort('paddo','Paddo','Gras','mushy_buddy',0.9,{hp:46,atk:11,def:9,spd:0.95},{vang:.6,evolutie:{naar:'paddoking',level:16},om:'Een paars paddenstoeltje dat sporen schiet als het schrikt.',maker:'mossycrossings'});
soort('paddoking','Paddoking','Gras','mushroom_monster',1.5,{hp:68,atk:17,def:13,spd:0.9},{vang:.25,om:'Volgroeid Paddo. Zijn rode hoed is zo groot als een parasol.',maker:'LizzyKoopa'});
soort('snapplant','Snapplant','Gras','venus_pie_trap',1.3,{hp:58,atk:16,def:10,spd:0.9},{vang:.35,om:'Een lopende vleesetende plant. Hapt eerst, vraagt daarna.',maker:'LizzyKoopa'});
soort('bijtkelk','Bijtkelk','Gras','flytrap_with_fangs_covered_in_blood',1.2,{hp:48,atk:15,def:8,spd:0.85},{vang:.45,om:'Een bloem met tanden. Ruikt naar bessen, bijt als een wolf.',maker:'anyaachan'});
soort('uitje','Uitje','Gras','little_onion_monster',0.8,{hp:44,atk:10,def:10,spd:1.0},{vang:.6,om:'Een ui met een gezichtje. Wie hem aanvalt moet huilen.',maker:'LizzyKoopa'});
soort('aardbeikat','Aardbeikat','Gras','strayberry_cat',0.8,{hp:46,atk:11,def:9,spd:1.1},{vang:.55,om:'Een aardbei die spint. Zoet van buiten, pittig van binnen.',maker:'LiliumLetifer'});
soort('blaadpad','Blaadpad','Gras','tiny_toad_dragon',1.0,{hp:54,atk:12,def:13,spd:0.8},{vang:.5,om:'Een paddendraakje met een blad als paraplu.',maker:'SoeteweyIscha'});
soort('hertkwak','Hertkwak','Gras','simple_creature_duckdeer',1.2,{hp:52,atk:14,def:10,spd:1.15},{vang:.4,rot:Math.PI/2,om:'Een hert met een eendensnavel. Kwaakt bij volle maan.',maker:'daanvs27'});
soort('nami','Nami','Gras','little_dragon_nami',1.0,{hp:50,atk:13,def:10,spd:1.05},{vang:.45,om:'Een groen draakje met een gele buik. Dol op bramen.',maker:'Risama'});

soort('vonkbot','Vonkbot','Elektro','little_faulty_bot',1.0,{hp:46,atk:14,def:10,spd:1.0},{vang:.5,om:'Een robotje met een los draadje. Geeft per ongeluk schokken.',maker:'AnoFail'});
soort('zweefbot','Zweefbot','Elektro','poddy_m1_stylized_floating_robot_posed',1.1,{hp:54,atk:16,def:12,spd:1.1},{vang:.3,zweef:0.6,om:'Een zwevende robot met groene ogen. Scant alles wat beweegt.',maker:'Exmoorbeast'});
soort('sterslijm','Sterslijm','Elektro','astral_slime',0.8,{hp:48,atk:15,def:9,spd:1.0},{vang:.4,om:'Een slijm vol sterrenstof. Knettert in het donker.',maker:'therealnicolaslaube'});
soort('lampkrab','Lampkrab','Elektro','crabulb_rigged',0.9,{hp:48,atk:13,def:12,spd:0.95},{vang:.5,om:'Een krab met een gloeilamp als schild. Gaat aan bij gevaar.',maker:'uosew'});
soort('paarsje','Paarsje','Elektro','kit_monster_c',0.9,{hp:46,atk:13,def:8,spd:1.1},{vang:.55,om:'Een paars monstertje met één groot oog dat flitst.',maker:'JoRCS'});
soort('blauwzap','Blauwzap','Elektro','cute_smooth_rounded_blue_dragon_like_creature',1.1,{hp:52,atk:15,def:10,spd:1.15},{vang:.4,om:'Een glad blauw wezen met lange oren die stroom opvangen.',maker:'tinkerlane_studio'});
soort('flapoog','Flapoog','Spook','eye_bat_creature',0.9,{hp:42,atk:14,def:7,spd:1.3},{vang:.45,rot:Math.PI,zweef:1.0,om:'Een vleermuis die één groot oog is. Ziet je altijd.',maker:'voodoodoo'});

soort('shibo','Shibo','Normaal','free_toon_shiba_inu_3d_model',0.8,{hp:50,atk:12,def:9,spd:1.1},{vang:.6,om:'Een shiba met een eeuwige grijns. Trouw tot het einde.',maker:'MarkoJantti'});
soort('dikmuis','Dikmuis','Normaal','fat_mouse_sitting_cute_stylized_animal_character',0.7,{hp:48,atk:9,def:11,spd:0.9},{vang:.65,rot:-Math.PI/2,om:'Een muis die te veel kaas at. Rolt sneller dan hij loopt.',maker:'s8819296'});
soort('hampie','Hampie','Normaal','happy_hamster',0.7,{hp:46,atk:10,def:10,spd:1.0},{vang:.65,om:'Een hamster die altijd op zijn rug ligt te lachen.',maker:'chrisleeX'});
soort('blauwvink','Blauwvink','Normaal','bluebird',0.6,{hp:40,atk:11,def:7,spd:1.3},{vang:.6,zweef:0.5,evolutie:{naar:'dikvink',level:15},om:'Een klein blauw vogeltje dat zingt om je af te leiden.',maker:'macz'});
soort('dikvink','Dikvink','Normaal','chonky_birb',1.0,{hp:60,atk:15,def:12,spd:1.0},{vang:.3,zweef:0.3,om:'Volgroeid Blauwvink. Vliegt nauwelijks nog, maar beukt des te harder.',maker:'mdonze'});
soort('vosje','Vosje','Normaal','cute_monster',0.9,{hp:50,atk:13,def:9,spd:1.15},{vang:.5,om:'Een gele vos met een rugzakje. Steelt koekjes uit je tent.',maker:'yamada_gangle'});
soort('donutje','Donutje','Normaal','donut_monster_for_blender_guru',0.9,{hp:52,atk:12,def:11,spd:0.95},{vang:.55,om:'Een donut met ogen en pootjes. Hap er niet in.',maker:'jimmygunawan'});

soort('rotsoog','Rotsoog','Steen','cyclops_with_wings',1.3,{hp:62,atk:17,def:14,spd:0.9},{vang:.3,om:'Een gevleugelde cycloop van steen. Zijn oog ziet door muren.',maker:'KlyuckySnyuKi'});
soort('pantserslijm','Pantserslijm','Steen','slime_creature',1.0,{hp:58,atk:13,def:16,spd:0.8},{vang:.4,om:'Een slijm dat een rotspantser draagt. Bijna niet te verwonden.',maker:'juan-miguelbauwens'});
soort('slaapdrak','Slaapdrak','Steen','the_cute_dragon',1.0,{hp:60,atk:14,def:14,spd:0.7},{vang:.45,om:'Een paarse draak die het liefst slaapt. Val hem niet lastig.',maker:'morzilah.3d'});
soort('spinnekoning','Spinnekoning','Steen','shelon',2.2,{hp:110,atk:26,def:20,spd:1.0},{vang:.08,leg:true,om:'De legendarische reuzenspin van de Schemertop. Zelden gezien, nooit gevangen.',maker:'vang807'});

soort('spinnie','Spinnie','Aarde','cute_spider_ccw',0.9,{hp:46,atk:14,def:10,spd:1.1},{vang:.5,om:'Een pluizige spin met kraaloogjes. Weeft valstrikken van gras.',maker:'Daemonelix'});
soort('tentakul','Tentakul','Aarde','cute_tentacle_creature',1.0,{hp:50,atk:13,def:11,spd:0.9},{vang:.45,om:'Een ster van tentakels die uit de grond kruipt.',maker:'endike'});
soort('modderbol','Modderbol','Aarde','one_eyed_monster_with_animations',1.3,{hp:64,atk:15,def:13,spd:0.85},{vang:.35,om:'Een bol modder met één oog en veel tanden. Lacht altijd.',maker:'jungle_jim'});
soort('groenebeet','Groenebeet','Aarde','viernes',1.0,{hp:52,atk:15,def:9,spd:1.05},{vang:.45,om:'Een groen monster met een enorme mond. Eet alles, ook stenen.',maker:'jonasaguilar'});
soort('stekeldrak','Stekeldrak','Aarde','cute_dragon',1.0,{hp:54,atk:16,def:10,spd:1.0},{vang:.4,om:'Een bruin draakje met grote ogen en stekels als een egel.',maker:'shakiller'});

soort('spookie','Spookie','Spook','cute_ghost',0.9,{hp:44,atk:12,def:8,spd:1.1},{vang:.55,zweef:0.4,evolutie:{naar:'dikspook',level:16},om:'Een spookje onder een laken. Verzamelt pompoenen.',maker:'PelpesElSabio'});
soort('dikspook','Dikspook','Spook','chubby_ghost',1.4,{hp:64,atk:17,def:12,spd:1.0},{vang:.25,zweef:0.3,om:'Volgroeid Spookie. Zo mollig dat hij door niets meer heen past.',maker:'elysed'});
soort('huisspook','Huisspook','Spook','ghost_boy',1.1,{hp:56,atk:13,def:13,spd:0.9},{vang:.4,zweef:0.2,om:'Een spook dat een dak op zijn hoofd draagt. Altijd thuis.',maker:'20174720'});
soort('heksspook','Heksspook','Spook','halloween_ghost',1.1,{hp:54,atk:16,def:10,spd:1.05},{vang:.35,zweef:0.4,om:'Een spook met een heksenhoed en een mandje snoep.',maker:'kasselk'});
soort('oogbol','Oogbol','Spook','eyeball_monster',0.9,{hp:46,atk:14,def:9,spd:1.0},{vang:.45,zweef:0.6,om:'Een zwevend paars oog. Knippert nooit.',maker:'thecore37'});

export const MONSTERS=M;
export const STARTERS=['rooddraakje','kwakkie','paddo'];
export const MAX_DEX=dex;

/* Twee aanvallen per monster: een snelle klap en een speciale aanval van zijn type (met afkoeltijd). */
export const SPECIAAL={
  Vuur:   {naam:'Vuurbal',    kracht:1.9,cooldown:3.0,bereik:10,projectiel:true},
  Water:  {naam:'Waterstraal',kracht:1.8,cooldown:2.8,bereik:10,projectiel:true},
  Gras:   {naam:'Bladstorm',  kracht:1.8,cooldown:2.8,bereik:9, projectiel:true},
  Elektro:{naam:'Schokgolf',  kracht:1.7,cooldown:2.5,bereik:8, projectiel:true},
  Normaal:{naam:'Kopstoot',   kracht:2.2,cooldown:3.2,bereik:2.4,projectiel:false},
  Steen:  {naam:'Rotsbeuk',   kracht:2.4,cooldown:3.6,bereik:2.6,projectiel:false},
  Aarde:  {naam:'Aardbeving', kracht:1.6,cooldown:4.0,bereik:4.5,projectiel:false,gebied:true},
  Spook:  {naam:'Schimflits', kracht:1.9,cooldown:3.0,bereik:9, projectiel:true},
};

export function stats(id,level){
  const b=MONSTERS[id].basis,l=level-1;
  return{hp:Math.round(b.hp+b.hp*0.12*l+l*2),atk:Math.round(b.atk+b.atk*0.09*l),def:Math.round(b.def+b.def*0.09*l),spd:b.spd};
}
export function xpVoorLevel(level){return Math.round(18*Math.pow(level,1.7))}
