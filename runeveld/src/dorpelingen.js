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

export function updateDorpelingen(dt,cam,camera,speler){
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
