/* Runeveld – dorpelingen: sfeerfiguren die stilstaan, rondlopen en af en toe iets zeggen.
   Ze zijn opgebouwd uit de lagen van de held (lijf, kleding, hoofd, eventueel helm en zwaard) met andere haar- en
   kledingkleuren, zodat ze in alle vier de richtingen kunnen lopen en precies in de stijl passen.
   Puur lokaal en zonder gevolgen voor het spel; de server neemt dit later over als hij er is. */
import * as THREE from 'three';
import {BLADEN} from './bladen.js';
import {Sprite2D} from './sprites.js';
import * as UI from './ui.js';

import {HAAR_BRON,HAAR,TUNIEK_BRON,TUNIEK,herkleur} from './uiterlijk.js';

/* de dorpelingen: uiterlijk, route (lijst van punten; één punt = stilstaan) en praatjes.
   kleding: 'harnas1' tuniek (herkleurbaar), 'harnas2' leren vest, 'harnas3' harnas; hoofd: 'hoofd1' pet, 'hoofd2' helm */
const DORPELINGEN=[
  {naam:'Guard Rolf',haar:'zwart',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[1.8,-20.6],[1.8,-11]],snelheid:1.6,pauze:[5,10],
    praatjes:['Stay inside the fence after dark.','The boars have been bold lately.','Move along, nothing to see here.']},
  {naam:'Guard Sven',haar:'bruin',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-1.8,20.6],[-1.8,11]],snelheid:1.6,pauze:[5,10],
    praatjes:['Quiet shift. I like quiet shifts.','Foxes to the west, boars to the east.','Rolf owes me a drink.']},
  {naam:'Old Mette',haar:'grijs',kleding:'harnas1',tuniek:'grijs',route:[[-2,2],[2,2],[2,-2],[-2,-2]],snelheid:.9,pauze:[6,14],
    praatjes:['My knees know when it will rain.','Back in my day the well was deeper.','You look thin. Eat something.']},
  {naam:'Pim',haar:'blond',kleding:'harnas1',tuniek:'rood',schaal:.8,route:[[0,6.2],[4.6,4.6],[6.4,0],[4.6,-4.6],[0,-6.4],[-4.6,-4.6],[-6.4,0],[-4.6,4.6]],snelheid:3.2,pauze:[0,1.5],lus:true,
    praatjes:['Catch me if you can!','I saw a fox! A real one!','Mum says I cannot go past the gate.']},
  {naam:'Farmer Jorn',haar:'bruin',kleding:'harnas1',tuniek:'groen',hoofd:'hoofd1',route:[[-14,-14.6],[-17.5,-13],[-17.5,-7],[-11,-5],[-9.5,-1],[-5,.5]],snelheid:1.4,pauze:[3,8],
    praatjes:['Carrots do not plant themselves.','Rabbits ate my lettuce again.','Rain tomorrow, mark my words.']},
  {naam:'Baker Lise',haar:'rood',kleding:'harnas1',tuniek:'creme',route:[[10.6,-4.2],[2.4,-1.6]],snelheid:1.3,pauze:[12,25],
    praatjes:['Fresh bread, still warm!','Bram overcharges, you know.','Two loaves for the guards, every morning.']},
  {naam:'Fisher Teun',haar:'zwart',kleding:'harnas1',tuniek:'blauw',hoofd:'hoofd1',route:[[3,15.5]],kijk:[1,0],
    praatjes:['Shh. You will scare the fish.','Not a single bite all morning.','The big one lives under the far rock.']},
  {naam:'Smith Ragnar',haar:'zwart',kleding:'harnas1',tuniek:'grijs',hoofd:'hoofd1',route:[[-7.8,9.2]],kijk:[-1,-1],hamer:true,
    praatjes:['Bring me iron and I will make it sing.','Mind the sparks.','A dull blade is a dead swordsman.']},
  /* ---- Aurelia: poortwacht, stadswacht, het hof, de markt, het plein, de wijken en de tempel ---- */
  {naam:'Captain Aldric',haar:'zwart',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-101.5,2.8]],kijk:[1,0],
    praatjes:['State your business in Aurelia.','Bandits on the road again. Every week.','The King pays for results, not stories.']},
  {naam:'Gate Guard Bo',haar:'bruin',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-101.5,-2.8]],kijk:[1,0],
    praatjes:['Welcome to the capital. No fighting inside the walls.','Keep your purse close on market day.','Long shift. Longer road.']},
  {naam:'Guard Hal',haar:'blond',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-134,-21.5],[-100.5,-21.5]],snelheid:1.6,pauze:[4,9],
    praatjes:['All quiet on the north street.','Somebody keeps stealing lanterns.','I hear wolves at night, beyond the wall.']},
  {naam:'Guard Ida',haar:'rood',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-134,21.5],[-100.5,21.5]],snelheid:1.6,pauze:[4,9],
    praatjes:['The recruits are loud today.','Stay off the training field unless you like bruises.','Ser Roland walks the avenue again. Showing off.']},
  {naam:'Guard Rik',haar:'bruin',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-135,-36],[-135,-6],[-131.5,0],[-135,6],[-135,36]],snelheid:1.5,pauze:[3,8],
    praatjes:['North gate to south gate, all day long.','The fountain water is not for drinking.','Move along.']},
  {naam:'Royal Guard',haar:'zwart',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-153,2.6]],kijk:[1,0],
    praatjes:['Bow before His Majesty.','Not one step closer.','...']},
  {naam:'Royal Guard',haar:'zwart',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-153,-2.6]],kijk:[1,0],
    praatjes:['The King sees all who come.','Hands where I can see them.','...']},
  {naam:'Castle Guard',haar:'bruin',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-143.4,4.8]],kijk:[1,0],
    praatjes:['The castle is open to the brave and the invited.','Mind the braziers.','No horses past this gate.']},
  {naam:'Castle Guard',haar:'grijs',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-143.4,-4.8]],kijk:[1,0],
    praatjes:['Thirty years at this gate.','The Steward is in a mood today.','Carry on.']},
  {naam:'King Aldemar',haar:'grijs',kleding:'harnas1',tuniek:'rood',route:[[-155.4,0]],kijk:[1,0],
    praatjes:['Eldoria endures.','My father built this keep. I keep it.','Every bandit on my road is an insult to my crown.']},
  {naam:'Steward Corvin',haar:'bruin',kleding:'harnas1',tuniek:'blauw',route:[[-150.5,-3],[-149.5,3.2]],snelheid:.9,pauze:[6,14],
    praatjes:['The treasury does not fill itself.','His Majesty will see you when His Majesty sees you.','Taxes, ledgers, bandits. In that order.']},
  {naam:'Lady Elara',haar:'blond',kleding:'harnas1',tuniek:'creme',route:[[-148,-4.5],[-140,-9],[-131,-5],[-128,-15]],snelheid:1.1,pauze:[5,12],
    praatjes:['The gardens by the temple are lovely this time of year.','Have you heard the bard? Dreadful. I adore him.','A lady does not hurry.']},
  {naam:'Ser Roland',haar:'blond',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-105,-4.5],[-143,-4.5]],snelheid:1.5,pauze:[4,10],
    praatjes:['I slew three brutes before breakfast.','The King knights those who deserve it. Mostly.','Stand aside, citizen.']},
  {naam:'Apothecary Wren',haar:'grijs',kleding:'harnas1',tuniek:'groen',hoofd:'hoofd1',route:[[-154,-34.3]],kijk:[0,1],winkel:'apotheek',
    praatjes:['Orange potions. My own recipe. Do not ask.','Dire wolf pelt keeps a brew warm for days.','Shake well. Or do not. It is your stomach.']},
  {naam:'Armorer Gunnar',haar:'rood',kleding:'harnas2',hoofd:'hoofd1',route:[[-166,-34.3]],kijk:[0,1],winkel:'wapensmid',hamer:true,
    praatjes:['Royal steel. Costs what it costs.','That dent? That is character.','I armored the King\'s own guard.']},
  {naam:'Jeweler Oswin',haar:'grijs',kleding:'harnas1',tuniek:'creme',route:[[-158,-20.2]],kijk:[0,-1],winkel:'juwelier',
    praatjes:['Rings and chains, friend. Rings and chains.','That stone? Dug up in the vale by a boar. True story.','A ring for your lady, a chain for your luck.']},
  {naam:'Grocer Hilde',haar:'bruin',kleding:'harnas1',tuniek:'creme',route:[[-160,-34.5]],kijk:[0,1],
    praatjes:['Apples from the vale, fresh this morning!','The bandits took my cart twice this month.','Two for a zeny, three if you smile.']},
  {naam:'Tailor Maud',haar:'zwart',kleding:'harnas1',tuniek:'blauw',route:[[-167,-20.2]],kijk:[0,-1],winkel:'kleermaker',
    praatjes:['Silk, wool, and no patience for haggling.','Your hem is torn. I can see it from here.','The Lady Elara orders a new gown every week.']},
  {naam:'Spice Trader Yusuf',haar:'zwart',kleding:'harnas1',tuniek:'rood',hoofd:'hoofd1',route:[[-153,-20.2]],kijk:[0,-1],
    praatjes:['Pepper from beyond the mountains!','Smell that? That is money.','The Kingsroad is the only road, and it is full of thieves.']},
  {naam:'Innkeeper Rosa',haar:'rood',kleding:'harnas1',tuniek:'creme',route:[[-162.7,-32.6]],kijk:[0,1],
    praatjes:['Rooms upstairs, ale downstairs, no singing after midnight.','The Gilded Boar: finest inn in Aurelia. The only one, too.','Bandit talk makes the guests nervous. Keep it down.']},
  {naam:'Townsman Piet',haar:'bruin',kleding:'harnas1',tuniek:'grijs',hoofd:'hoofd1',route:[[-137,-14],[-137,-25],[-150,-25],[-160,-25]],snelheid:1.3,pauze:[4,12],
    praatjes:['Market, then home. Market, then home.','They say the King has not left the keep in a year.','Fine weather for a walk.']},
  {naam:'Bard Finn',haar:'blond',kleding:'harnas1',tuniek:'groen',route:[[-141,-3]],kijk:[1,0],
    praatjes:['Oh the road ran west and the sky ran gold...','A coin for a song? A song for a coin?','Everyone is a critic in this city.']},
  {naam:'Washerwoman Ana',haar:'zwart',kleding:'harnas1',tuniek:'blauw',route:[[-133.5,3.4],[-140.5,4]],snelheid:1,pauze:[8,18],
    praatjes:['Fountain water, finest in the kingdom.','Mud. Everywhere. Always mud.','The bard again. Saints preserve us.']},
  {naam:'Old Gert',haar:'grijs',kleding:'harnas1',tuniek:'grijs',route:[[-131,-8]],kijk:[-1,1],
    praatjes:['I remember when this plaza was a cow field.','The statue? That is old King Edric. Looked nothing like him.','My knees. Do not ask.']},
  {naam:'Nell',haar:'rood',kleding:'harnas1',tuniek:'creme',schaal:.8,route:[[-137,-6],[-132.8,-4.2],[-131,0],[-132.8,4.2],[-137,6],[-141.2,4.2],[-143,0],[-141.2,-4.2]],snelheid:3,pauze:[0,1],lus:true,
    praatjes:['Catch me, Ro!','I am going to be a knight!','The fountain splashed me!']},
  {naam:'Ro',haar:'bruin',kleding:'harnas1',tuniek:'groen',schaal:.78,route:[[-143,0],[-141.2,-4.2],[-137,-6],[-132.8,-4.2],[-131,0],[-132.8,4.2],[-137,6],[-141.2,4.2]],snelheid:2.9,pauze:[0,1.2],lus:true,
    praatjes:['Not fair, you started first!','I want to be a wizard!','Did you see the bandit they brought in?']},
  {naam:'Beggar Tam',haar:'grijs',kleding:'harnas1',tuniek:'grijs',route:[[-104,4.2]],kijk:[-1,0],
    praatjes:['A zeny for an old soldier?','I fought at the river, you know. Nobody remembers.','The guards are kind. The nobles are not.']},
  {naam:'Courier Jesper',haar:'blond',kleding:'harnas1',tuniek:'blauw',hoofd:'hoofd1',route:[[-101,1.6],[-126,1.6],[-126,-19],[-104,-19]],snelheid:3.4,pauze:[1,3],
    praatjes:['Letter for the Steward! Out of the way!','Third run today. Third!','Who put a lantern there?']},
  {naam:'Goodwife Marta',haar:'bruin',kleding:'harnas1',tuniek:'rood',route:[[-114.5,-6.2]],kijk:[-1,0],
    praatjes:['The well is sweeter than the fountain, whatever Ana says.','My boy joined the guard. I do not sleep.','Fresh pie on the sill. Do not touch it.']},
  {naam:'Carpenter Jos',haar:'zwart',kleding:'harnas1',tuniek:'groen',hoofd:'hoofd1',route:[[-129,-16.5],[-118,-16.5]],snelheid:1.2,pauze:[6,12],hamer:true,
    praatjes:['Measure twice, cut once, swear thrice.','The inn roof again. Rosa, I swear.','Oak from the vale, nothing better.']},
  {naam:'Smith Brun',haar:'rood',kleding:'harnas2',hoofd:'hoofd1',route:[[-125.2,14]],kijk:[-1,-1],hamer:true,
    praatjes:['Gunnar sells it. I make it.','Hot. Everything here is hot.','Bring me dire wolf fangs and I will make you a hilt.']},
  {naam:'Recruit Dag',haar:'bruin',kleding:'harnas1',tuniek:'grijs',hoofd:'hoofd2',wapen:'wapen1',route:[[-127.2,30.4]],kijk:[0,-1],hamer:true,
    praatjes:['Hya! Take that, hay!','The sergeant says my footwork is a crime.','One day I will guard the King.']},
  {naam:'Sergeant Ulla',haar:'zwart',kleding:'harnas2',hoofd:'hoofd2',wapen:'wapen2',route:[[-121,27.6]],kijk:[-1,0],
    praatjes:['FEET, Dag! Where are your FEET?','Recruits. Every year softer.','You want to train? Bring your own hay.']},
  {naam:'Stablehand Ott',haar:'blond',kleding:'harnas1',tuniek:'creme',hoofd:'hoofd1',route:[[-104,15.2]],kijk:[0,-1],
    praatjes:['The horses know a bandit before I do.','Hay, oats, and a lot of shoveling.','Ser Roland\'s horse bites. Like its master.']},
  {naam:'Guildmaster Hesper',haar:'grijs',kleding:'harnas2',hoofd:'hoofd1',route:[[-118.5,14.2]],kijk:[0,1],
    praatjes:['The Adventurers\' Guild: contracts, coin, and no questions.','Bandit insignias fetch a price. Ask around.','Heroes come and go. The guild remains.']},
  {naam:'Father Anselm',haar:'grijs',kleding:'harnas1',tuniek:'creme',route:[[-165.7,37],[-156,30],[-150,22]],snelheid:.9,pauze:[8,16],
    praatjes:['Peace be upon the road.','The temple is open to all. Even bandits, should they repent.','Light the candles, mind the wax.']},
  {naam:'Pilgrim Sanne',haar:'blond',kleding:'harnas1',tuniek:'blauw',hoofd:'hoofd1',route:[[-147.5,27.2]],kijk:[-1,0],
    praatjes:['I walked from the eastern sea to see this temple.','The pond is said to heal. My feet disagree.','So many people. So much noise.']},
  /* buiten de muren */
  {naam:'Farmer Wendel',haar:'bruin',kleding:'harnas1',tuniek:'groen',hoofd:'hoofd1',route:[[-76,-6.5],[-66,-8.5],[-86,-8.5]],snelheid:1.3,pauze:[5,12],
    praatjes:['Bandits camp north of my fields. They took my best cow. The COW.','Beets, turnips, and a view of the castle.','The windmill grinds slow, like Abe.']},
  {naam:'Miller Abe',haar:'grijs',kleding:'harnas1',tuniek:'creme',hoofd:'hoofd1',route:[[-75.5,20.6]],kijk:[-1,0],
    praatjes:['The wind does the work. I do the waiting.','Flour for the whole city comes through here.','Wendel talks too much.']},
];

const R=(a,b)=>a+Math.random()*(b-a);
const lijst=[];

export function maakDorpelingen(scene,klikbaar){
  const T=BLADEN.held.lagen;
  for(const d of DORPELINGEN){
    /* bij een helm of pet alleen exact de haarkleuren vervangen, anders kleurt het ijzer mee */
    const hoofd=herkleur(d.hoofd||'hoofd',HAAR_BRON,HAAR[d.haar],'haar-'+d.haar,!!d.hoofd);
    const kleding=d.kleding==='harnas1'&&d.tuniek?herkleur('harnas1',TUNIEK_BRON,TUNIEK[d.tuniek],'tuniek-'+d.tuniek):(d.kleding?T[d.kleding]:null);
    const lagen=[d.wapen&&T[d.wapen+'b'],T.lijf,kleding,hoofd,d.wapen&&T[d.wapen]].filter(Boolean);
    const sprite=new Sprite2D(BLADEN.held,{lagen,schaduw:.9*(d.schaal||1)});
    if(d.schaal)sprite.g.scale.setScalar(d.schaal);
    const[x,z]=d.route[0];sprite.g.position.set(x,0,z);
    if(d.kijk)sprite.zetKijk(d.kijk[0],d.kijk[1]);
    scene.add(sprite.g);
    const n={spec:d,sprite,label:UI.maakLabel('npc',d.naam),x,z,i:0,stap:1,pauze:R(1,4),praatT:R(10,60),bezigTot:0,hamerT:R(1,3)};
    sprite.mesh.userData.dorpeling=n;klikbaar.push(sprite.mesh);
    lijst.push(n);
  }
  return lijst;
}

/* op het selectiescherm zijn de dorpelingen er niet: pas in de echte wereld */
let zichtbaar=true;
export function toonDorpelingen(aan){zichtbaar=aan;for(const n of lijst){n.sprite.g.visible=aan;n.label.el.hidden=!aan}}
export function updateDorpelingen(dt,cam,camera,speler){
  if(!zichtbaar)return;
  const t=performance.now()/1000;
  for(const n of lijst){
    const d=n.spec,s=n.sprite;
    let loopt=false;
    if(d.route.length>1&&t>=n.bezigTot){
      if(n.pauze>0){n.pauze-=dt}
      else{
        const doel=d.route[n.i],dx=doel[0]-n.x,dz=doel[1]-n.z,af=Math.hypot(dx,dz);
        if(af<.12){
          n.pauze=R(d.pauze[0],d.pauze[1]);
          if(d.lus)n.i=(n.i+1)%d.route.length;
          else{if(n.i+n.stap<0||n.i+n.stap>=d.route.length)n.stap=-n.stap;n.i+=n.stap}
          if(d.kijk)s.zetKijk(d.kijk[0],d.kijk[1]);
        }else{const v=d.snelheid*dt;n.x+=dx/af*v;n.z+=dz/af*v;s.zetKijk(dx,dz);loopt=true}
      }
    }
    /* de smid hamert af en toe (de slag-animatie zonder wapen) */
    if(d.hamer){n.hamerT-=dt;if(n.hamerT<=0){n.hamerT=R(2.5,5);s.speel('aanval',true);n.bezigTot=t+s.duur('aanval')}}
    if(t<n.bezigTot){}else s.speel(loopt?'loop':'idle');
    s.g.position.set(n.x,0,n.z);s.update(dt,cam);
    UI.plaatsLabel(n.label,n.x,s.h*(d.schaal||1)+.1,n.z,camera);
    /* af en toe een praatje */
    n.praatT-=dt;if(n.praatT<=0){n.praatT=R(15,45);UI.bubble(n.label,d.praatjes[Math.floor(Math.random()*d.praatjes.length)])}
  }
}

/* aangesproken: naar de speler kijken en even blijven staan; het gesprek zelf gaat via dialoog.js */
export function spreek(n,speler,sec=4){
  n.sprite.zetKijk(speler.x-n.x,speler.z-n.z);n.pauze=Math.max(n.pauze,sec);n.praatT=Math.max(n.praatT,sec+R(10,30));
}
export const dorpelingen=()=>lijst;
/* de begroeting in het gesprek: het eerste praatje */
export const groet=n=>n.spec.praatjes[0];
