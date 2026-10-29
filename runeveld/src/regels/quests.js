/* Runeveld – questregels: de quests zelf en de pure controles erop.
   Geen DOM en geen spelstatus; de voortgang van een speler is een object {[id]:{st:'bezig'|'klaar',n}}
   dat de server later net zo goed kan bijhouden.

   doel.soort: 'dood'   versla n monsters van `monster`
               'item'   lever n van `item` in (wordt uit de tas gehaald bij inleveren)
               'bezoek' spreek `npc` aan
               'plek'   kom binnen `r` van (x,z); `naam` is de omschrijving in de tracker
   Een quest kan een minimumlevel (`lvl`) en een voorafgaande quest (`na`) vereisen. */
export const QUESTS={
  mette_welkom:{gever:'Old Mette',titel:'A warm welcome',lvl:1,
    intro:'New face! Nobody wanders out past the fence before they know the village. Go say hello to Merchant Bram at the red stall, and tell him Mette sent you.',
    bezig:'Bram is at the red stall by the square. Red, like his nose.',
    klaar:'He was kind to you? Good. He was not always. Here, take these for the road, and stay close to the gates at first.',
    doel:{soort:'bezoek',npc:'Merchant Bram'},beloning:{exp:20,zeny:30,items:[{id:'drank',n:2}]}},
  rolf_konijnen:{gever:'Guard Rolf',titel:'Rabbit trouble',lvl:1,na:'mette_welkom',
    intro:'You look like you can hold a sword. The rabbits north of the gate are eating everything that grows. Thin them out for me: five should do.',
    bezig:'Five rabbits. They are just outside the north gate. Hit them before they hop off.',
    klaar:'Five fewer rabbits. The farmers will sleep better. Here is your pay, and something for the scratches.',
    doel:{soort:'dood',monster:'konijn',n:5},beloning:{exp:60,zeny:80,items:[{id:'drank',n:3}]}},
  teun_poten:{gever:'Fisher Teun',titel:'Lucky feet',lvl:2,
    intro:'Shh. Not a bite all week. I need luck, and rabbits have it in their feet, everyone knows that. Bring me two rabbit feet.',
    bezig:'Two rabbit feet. Rabbits drop them sometimes, if you ask with a sword.',
    klaar:'Two feet. Now the fish will come. Probably. Here, I have no use for these potions anyway.',
    doel:{soort:'item',item:'konijnenpoot',n:2},beloning:{exp:80,zeny:60,items:[{id:'drank',n:2}]}},
  pim_vos:{gever:'Pim',titel:'A real fox',lvl:2,na:'rolf_konijnen',
    intro:'I saw a fox and nobody believes me! If you bring me a fox tail I can show everyone. Please? I have ten zeny.',
    bezig:'A fox tail! The foxes live west of the village. Do not tell mum.',
    klaar:'A REAL fox tail! Here, you can have my ten zeny. All of it.',
    doel:{soort:'item',item:'vossenstaart',n:1},beloning:{exp:40,zeny:10,items:[]}},
  sven_vossen:{gever:'Guard Sven',titel:'Foxes at the south gate',lvl:3,na:'rolf_konijnen',
    intro:'Rolf sent you? Then you will do. Foxes have been circling the south fields at night. Six of them should learn to keep their distance.',
    bezig:'Six foxes, south and west of the village. Watch out, they bite back.',
    klaar:'Six foxes. Quiet shift tonight, then. I like quiet shifts. Here.',
    doel:{soort:'dood',monster:'vos',n:6},beloning:{exp:220,zeny:180,items:[{id:'drank',n:3}]}},
  lise_staarten:{gever:'Baker Lise',titel:'Fox tails',lvl:3,na:'rolf_konijnen',
    intro:'Foxes got into my flour again. I want three of their tails for my door. Let the others see what happens.',
    bezig:'Three fox tails. The foxes are west of the fence, past the trees.',
    klaar:'Three tails for my door. Perfect. This cap was my brother\'s, he will not miss it. And the bread is on the house.',
    doel:{soort:'item',item:'vossenstaart',n:3},beloning:{exp:150,zeny:200,items:[{id:'leren_kap',n:1}]}},
  jorn_zwijnen:{gever:'Farmer Jorn',titel:'Boars in the beets',lvl:5,na:'rolf_konijnen',
    intro:'Boars. Big ones, east of the village, and they have found my beets. I cannot pay much, but I pay. Three boars.',
    bezig:'Three boars, east past the fields. Do not let them charge you.',
    klaar:'Three boars gone. My beets thank you. So do I. Here.',
    doel:{soort:'dood',monster:'zwijn',n:3},beloning:{exp:300,zeny:350,items:[{id:'drank',n:5}]}},
  ragnar_huiden:{gever:'Smith Ragnar',titel:'Hides for the forge',lvl:6,na:'jorn_zwijnen',
    intro:'Jorn says you handle boars. Good. I need four boar hides for the bellows. Bring them and I will make it worth your while.',
    bezig:'Four boar hides. The boars are east of the village.',
    klaar:'Four good hides. A deal is a deal: this helm has been waiting for a head that deserves it.',
    doel:{soort:'item',item:'zwijnenhuid',n:4},beloning:{exp:400,zeny:300,items:[{id:'ijzeren_helm',n:1}]}},
  /* ---- Whisperwood, level 8 tot 15 ---- */
  mette_altaar:{gever:'Old Mette',titel:'The old altar',lvl:8,na:'mette_welkom',
    intro:'When I was a girl we left bread at the old altar in Whisperwood, north past the gate. Nobody goes there any more. Go and see if it still stands. Follow the path and do not stray.',
    bezig:'North through the gate, then follow the path through the trees. The altar is on the stone circle at the end.',
    klaar:'It still stands? Then the forest remembers us. Thank you, child. Here, for your trouble.',
    doel:{soort:'plek',x:0,z:-103,r:5,naam:'the old altar'},beloning:{exp:300,zeny:200,items:[{id:'drank',n:3}]}},
  rolf_wolven:{gever:'Guard Rolf',titel:'Howling in the north',lvl:8,na:'sven_vossen',
    intro:'You hear that at night? Wolves, in Whisperwood. They are getting bolder. Six of them, and the rest will think twice.',
    bezig:'Six grey wolves. They hunt between the trees off the path, north of the gate. Watch your back.',
    klaar:'Six wolves. The howling is quieter already. Good work, and well paid.',
    doel:{soort:'dood',monster:'wolf',n:6},beloning:{exp:600,zeny:500,items:[{id:'drank',n:5}]}},
  lise_vacht:{gever:'Baker Lise',titel:'A warm coat',lvl:9,na:'lise_staarten',
    intro:'Winter is coming and my coat is thin. Three wolf pelts from Whisperwood and I will have a warm one. I pay in bread and zeny.',
    bezig:'Three wolf pelts. The wolves live in Whisperwood, north of the village.',
    klaar:'Three pelts! Soft as anything. Here, and come by for bread whenever you like.',
    doel:{soort:'item',item:'wolfsvacht',n:3},beloning:{exp:650,zeny:450,items:[{id:'drank',n:4}]}},
  ragnar_gewei:{gever:'Smith Ragnar',titel:'Antlers for the forge',lvl:10,na:'ragnar_huiden',
    intro:'Stag antler makes the best sword hilts. There are stags in Whisperwood. Two antlers. They will not give them up gladly.',
    bezig:'Two stag antlers. The stags graze deep in Whisperwood. They are peaceful until you are not.',
    klaar:'Two antlers. Now this is hilt material. Take this vest, I have outgrown it.',
    doel:{soort:'item',item:'gewei',n:2},beloning:{exp:800,zeny:400,items:[{id:'vest',n:1}]}},
  rolf_everzwijn:{gever:'Guard Rolf',titel:'The dire boar',lvl:13,na:'rolf_wolven',
    intro:'Something big has made its den on the stone circle at the end of the forest path. A boar, they say, the size of a cart. Nobody goes near the altar any more. Deal with it and I will give you my own steel.',
    bezig:'The dire boar lives on the stone circle at the old altar, at the end of the path through Whisperwood. Bring potions.',
    klaar:'You killed it? By the gods. Here, as promised: my steel sword. Carry it better than I did.',
    doel:{soort:'dood',monster:'everzwijn',n:1},beloning:{exp:1500,zeny:1200,items:[{id:'staalzwaard',n:1}]}},
};
export const QUEST_VOLGORDE=Object.keys(QUESTS);

/* status van een quest voor een speler: 'nieuw' (nog niet gezien), 'gesloten' (vereisten niet gehaald), 'bezig', 'klaar' (kan ingeleverd), 'gedaan' */
export function status(id,quests,lvl){
  const q=QUESTS[id],s=quests[id];
  if(s)return s.st==='gedaan'?'gedaan':voltooid(id,s)?'klaar':'bezig';
  if(lvl<q.lvl||(q.na&&quests[q.na]?.st!=='gedaan'))return 'gesloten';
  return 'nieuw';
}
export function voltooid(id,s){const q=QUESTS[id];return !!s&&s.st!=='gedaan'&&(s.n||0)>=(q.doel.n||1)}
export const questsVan=npc=>QUEST_VOLGORDE.filter(id=>QUESTS[id].gever===npc);
/* korte voortgangstekst, bijv. "Rabbits 3/5" of "Fox tail 1/3" */
export function voortgangTekst(id,s,monsterNaam,itemNaam){
  const d=QUESTS[id].doel,n=Math.min(s?.n||0,d.n||1);
  if(d.soort==='dood')return `${monsterNaam(d.monster)} ${n}/${d.n}`;
  if(d.soort==='item')return `${itemNaam(d.item)} ${n}/${d.n}`;
  if(d.soort==='plek')return n?`Visited ${d.naam}`:`Go to ${d.naam}`;
  return n?`Spoke to ${d.npc}`:`Talk to ${d.npc}`;
}
