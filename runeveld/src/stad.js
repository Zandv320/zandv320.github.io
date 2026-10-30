/* Runeveld – Kingsvale en Aurelia: de weidevlakte ten westen van het veld met de hoofdstad. Een ommuurde stad met
   drie poorten, een hoofdlaan naar het kasteel, een plein met fontein en standbeeld, vier wijken (markt, tempel,
   woonwijk, kazerne) en buiten de muren boerderijen, een molen, een meer en het bandietenkamp in het noorden. */
import * as B from './bouw.js';
import {VALE,STAD,KASTEEL,KONINGSWEG,KAMP,inVale,inVeld,inStad,inKasteel,valeRand,afstandTotPad} from './gebied.js';

/* ctx: {scene, prop(naam,x,z,opties), bouw(g,x,z,opties), vrij(x,z,r), toeval(seed), P (laadbeloften)} */
export function bouwStad({scene,prop,bouw,vrij,toeval,P,obstakels:OBST}){
  const R=toeval(9001);
  const{x0,x1,z0,z1,cx}=STAD;
  const lantaarn=(x,z)=>P.push(prop('lantaarn',x,z,{r:.25}));
  /* een muur langs x van xa tot xb op z (of langs z als `langsZ`), met gaten waar `gat(t)` waar is; botsing per segment */
  function muurLijn(a,b,vast,langsZ,gat){
    const L=6;
    for(let t=a;t<b-.01;t+=L){const l=Math.min(L,b-t),mid=t+l/2;if(gat&&gat(mid))continue;
      const x=langsZ?vast:mid,z=langsZ?mid:vast;const g=bouw(B.muur(l),x,z,{rot:langsZ?Math.PI/2:0});
      for(let s=-l/2+.7;s<l/2;s+=1.4)obstakels(langsZ?x:mid+s,langsZ?mid+s:z,1)}
  }
  function obstakels(x,z,r){OBST.push({x,z,r})}
  const inPoortN=m=>Math.abs(m-cx)<5,inPoortO=m=>Math.abs(m)<5;
  /* ----- de stadsmuur: vier zijden, hoektorens, tussentorens en drie poortgebouwen ----- */
  muurLijn(x0,x1,z0,false,inPoortN);muurLijn(x0,x1,z1,false,inPoortN);
  muurLijn(z0,z1,x0,true,null);muurLijn(z0,z1,x1,true,inPoortO);
  for(const[x,z]of[[x0,z0],[x1,z0],[x1,z1],[x0,z1]])bouw(B.toren(2.4,7),x,z,{r:2.6});
  for(const[x,z]of[[x0+26,z0],[x0+52,z0],[x0+26,z1],[x0+52,z1],[x0,-20],[x0,20],[x1,-22],[x1,22]])bouw(B.toren(1.8,6),x,z,{r:2});
  bouw(B.poortgebouw(),cx,z0,{rot:0});bouw(B.poortgebouw(),cx,z1,{rot:0});bouw(B.poortgebouw({w:10,h:6}),x1,0,{rot:Math.PI/2});
  for(const[x,z]of[[cx-3.5,z0],[cx+3.5,z0],[cx-3.5,z1],[cx+3.5,z1],[x1,-4],[x1,4]])obstakels(x,z,1.6);
  /* ----- straten: de hoofdlaan van de oostpoort naar het kasteel, de dwarslaan tussen de noord- en zuidpoort, zijstraten ----- */
  scene.add(B.straat(5,x1-KASTEEL.x1+4,{x:(x1+KASTEEL.x1)/2+2,z:0,rot:Math.PI/2}));
  scene.add(B.straat(4,z1-z0+6,{x:cx,z:0}));
  scene.add(B.straat(3,34,{x:-117,z:-20,rot:Math.PI/2}));scene.add(B.straat(3,34,{x:-117,z:20,rot:Math.PI/2}));
  scene.add(B.straat(3,30,{x:-158,z:-25}));scene.add(B.straat(3,20,{x:-152,z:28}));
  /* wegen buiten de poorten: de Koningsweg naar Runeveld en korte stukken naar het noorden en zuiden */
  const[[kx0],[kx1]]=KONINGSWEG;scene.add(B.pad(3.4,Math.abs(kx1-kx0)+2,{x:(kx0+kx1)/2,z:0,rot:Math.PI/2}));
  scene.add(B.pad(3,18,{x:cx,z:z0-9}));scene.add(B.pad(3,16,{x:cx,z:z1+8}));
  /* ----- het plein: fontein, standbeeld, bankjes, lantaarns, bloemen ----- */
  const plein=B.pleinVierkant(22,22);plein.position.set(cx,.02,0);scene.add(plein);
  bouw(B.fontein(2.6),cx,0,{r:3.4});
  bouw(B.standbeeld(),cx,-7.5,{r:1.5,rot:Math.PI});
  for(const[dx,dz]of[[-7,-7],[7,-7],[7,7],[-7,7]])bouw(B.bank(),cx+dx,dz,{r:.8,rot:Math.atan2(-dx,-dz)});
  for(const[dx,dz]of[[-9.5,-9.5],[9.5,-9.5],[9.5,9.5],[-9.5,9.5],[-5,-2],[5,2]])lantaarn(cx+dx,dz);
  for(const[dx,dz]of[[-8,0],[8,0],[0,8],[-4,5],[4,-5]])P.push(prop('bloemen',cx+dx,dz,{schaal:1.6}));
  /* lantaarns langs de hoofdlaan en de dwarslaan */
  for(let x=x1-6;x>KASTEEL.x1+2;x-=8)for(const z of[-3.4,3.4])if(Math.abs(x-cx)>11)lantaarn(x,z);
  for(let z=z0+6;z<z1-2;z+=9)for(const x of[cx-3,cx+3])if(Math.abs(z)>11)lantaarn(x,z);
  /* ----- het kasteel: een binnenmuur met torens, de slotpoort naar de hoofdlaan, de donjon en een binnenplaats ----- */
  const K=KASTEEL;
  muurLijn(K.x0,K.x1,K.z0,false,null);muurLijn(K.x0,K.x1,K.z1,false,null);muurLijn(K.z0,K.z1,K.x0,true,null);
  muurLijn(K.z0,K.z1,K.x1,true,m=>Math.abs(m)<5);
  for(const[x,z]of[[K.x0,K.z0],[K.x1,K.z0],[K.x1,K.z1],[K.x0,K.z1]])bouw(B.toren(2,8),x,z,{r:2.2});
  bouw(B.poortgebouw({w:10,h:6}),K.x1,0,{rot:Math.PI/2});for(const z of[-4,4])obstakels(K.x1,z,1.6);
  const donjon=bouw(B.kasteel(),K.cx-2,0,{rot:Math.PI/2});
  for(let z=-8;z<=8;z+=2)for(let x=K.cx-8;x<=K.cx+4;x+=2)obstakels(x,z,1.3);
  const hof=B.pleinVierkant(K.x1-K.x0-3,K.z1-K.z0-3,'keien2');hof.position.set(K.cx,.02,0);scene.add(hof);
  scene.add(B.straat(5,K.x1-(K.cx+4)+2,{x:(K.x1+K.cx+4)/2,z:0,rot:Math.PI/2}));
  for(const[x,z]of[[K.cx+6,-6],[K.cx+6,6],[K.x1-3,-6],[K.x1-3,6]])lantaarn(x,z);
  for(const[x,z]of[[K.cx+8,-12],[K.cx+8,12],[K.cx-4,-13],[K.cx-4,13]])bouw(B.vlag(3),x,z,{r:.2});
  bouw(B.vijver(1.6),K.cx+8,-11,{r:2.3});bouw(B.vijver(1.6),K.cx+8,11,{r:2.3});
  for(const[x,z]of[[K.cx+4,-13],[K.cx+4,13],[K.cx-8,-13],[K.cx-8,13]])P.push(prop('boom2',x,z,{r:.55,schaduw:1.8,schaal:1.2}));
  /* ----- noordwest: de markt, de herberg, de apotheek en de kleermaker ----- */
  const markt=B.pleinVierkant(18,13);markt.position.set(-160,.02,-27);scene.add(markt);
  const kramen=[[-166,-32,'stof_rood',.15],[-160,-32.5,'stof_groen',0],[-154,-32,'stof_rood',-.15],[-167,-22,'stof_groen',Math.PI-.2],[-153,-22,'stof_rood',Math.PI+.2]];
  for(const[x,z,stof,rot]of kramen)bouw(B.kraam({stof,w:3}),x,z,{r:1.7,rot});
  for(const[x,z]of[[-169.5,-27],[-150.5,-27],[-160,-27]])lantaarn(x,z);
  bouw(B.ton(),-169.5,-33.6,{r:.45});bouw(B.ton(),-150.4,-33.4,{r:.45});bouw(B.kist(),-168.8,-20.6,{r:.5,rot:.4});bouw(B.kist(.7),-151,-20.4,{r:.45,rot:-.5});
  P.push(prop('kar',-171.5,-23.5,{r:1.2,schaduw:2.6}));
  bouw(B.huis({w:8,d:5.5,h:3.4,dakH:2.6,muur:'muur',ramen:3}),-160,-36.6,{r:4.4});          /* de herberg: voorkant naar de markt */
  bouw(B.huis({w:5.5,d:4.5,h:2.8,dakH:2,muur:'steen',ramen:2}),-148.5,-37,{r:3.2});         /* de apotheek */
  bouw(B.huis({w:5.5,d:4.5,muur:'hout',ramen:2}),-172,-37,{r:3.2});                        /* de kleermaker */
  bouw(B.huis({w:6,d:5,h:2.8,dakH:2.2,muur:'muur',ramen:2}),-170.5,-13.5,{r:3.6,rot:Math.PI/2});   /* de wisselaar, voorkant naar de laan */
  bouw(B.hooibaal(),-173,-20.6,{r:.7,rot:.3});bouw(B.hooibaal(),-171.6,-19.8,{r:.7,rot:-.4});
  /* ----- zuidwest: de tempel, een tuin met vijver en bankjes ----- */
  bouw(B.kerk(),-163,30,{r:5.6});
  bouw(B.vijver(2.2),-150,26,{r:2.9});
  for(const[x,z,rot]of[[-153,21,.6],[-147,30,-.8],[-156,36,1.6]])bouw(B.bank(),x,z,{r:.8,rot});
  for(const[x,z]of[[-146,21],[-154,37.5]])lantaarn(x,z);
  for(const[x,z]of[[-172,22],[-172,37],[-147,37.5],[-156,19]])P.push(prop('boom',x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  for(const[x,z]of[[-147.5,24],[-152.5,31.5],[-170,30],[-156,22.5]])P.push(prop('bloemen',x,z,{schaal:1.6}));
  for(const[x,z]of[[-171,26],[-150,34.5]])P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}));
  /* ----- noordoost: de woonwijk, twee rijen huizen aan de straat z=-20 ----- */
  const huizen=[
    [{w:6,d:5,muur:'muur'},-129,-30,0],[{w:6.5,d:5,h:3.2,dakH:2.4,muur:'hout',ramen:2},-118,-30.5,0],[{w:5.5,d:4.5,muur:'steen',ramen:1},-107.5,-30,0],
    [{w:6,d:5,muur:'muur',ramen:2},-129,-10.5,Math.PI],[{w:5.5,d:4.5,muur:'hout'},-118.5,-10,Math.PI],[{w:6.5,d:5,h:3.2,dakH:2.4,muur:'muur',ramen:3},-107.5,-10.5,Math.PI],
  ];
  for(const[opt,x,z,rot]of huizen){bouw(B.huis(opt),x,z,{r:Math.max(opt.w,opt.d)/2+.4,rot});
    const deurX=x+(rot?1:-1)*(-opt.w/2+1.3),dz=rot?-1:1;scene.add(B.straat(1.4,3.2,{x:deurX,z:z+dz*(opt.d/2+1.6)}))}
  for(const[x,z]of[[-134,-20],[-101.5,-20],[-112.5,-16.5],[-123.5,-23.5]])lantaarn(x,z);
  bouw(B.moestuin(4,3),-102,-36.5,{r:2.2});bouw(B.moestuin(3.5,3),-134,-36,{r:2});
  for(const[x,z]of[[-113,-37],[-124,-36.5],[-103,-14],[-134,-5]])P.push(prop('boom2',x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  for(const[x,z]of[[-125,-14.5],[-111,-26],[-132,-26.5],[-104,-25.5]])P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}));
  bouw(B.put(),-117,-4.5,{r:1.1});
  /* ----- zuidoost: de kazerne, het oefenveld, de smidse, de stallen en het gilde ----- */
  bouw(B.huis({w:11,d:5.5,h:3.2,dakH:2.2,muur:'steen',ramen:4}),-108,32,{r:5.7,rot:Math.PI});       /* kazerne, voorkant naar de straat */
  bouw(B.huis({w:6,d:5,h:2.8,dakH:2,muur:'steen',ramen:1}),-129,10.5,{r:3.5});                      /* smidse */
  bouw(B.huis({w:7.5,d:5,h:3.2,dakH:2.4,muur:'muur',ramen:3}),-116,10.5,{r:4.2});                   /* het gilde */
  bouw(B.huis({w:6.5,d:5,h:2.6,dakH:2,muur:'hout',ramen:1,schoorsteen:false}),-104,10.5,{r:3.7});  /* de stallen */
  P.push(prop('aambeeld',-125,15.2,{r:.5,schaduw:1}),prop('hout',-133.5,13.6,{r:.6,schaduw:1.2}));
  bouw(B.hooibaal(),-101.5,15.2,{r:.7,rot:.5});bouw(B.hooibaal(),-100.5,16.6,{r:.7,rot:-.3});P.push(prop('kar',-108,16,{r:1.2,schaduw:2.6}));
  /* het oefenveld: een hek eromheen, hooibalen als doelen */
  for(const x of[-131,-128.4,-125.8,-123.2])bouw(B.hek(2.6),x,24.5,{r:1.1});
  for(const z of[27,29.6,32.2,34.8])bouw(B.hek(2.6),-132.3,z,{r:1.1,rot:Math.PI/2});
  for(const[x,z]of[[-129,30],[-124,33],[-126,27.5]])bouw(B.hooibaal(),x,z,{r:.7,rot:R()*3});
  bouw(B.kist(),-121,35,{r:.5});bouw(B.ton(),-120,33.6,{r:.45});
  for(const[x,z]of[[-134,20],[-101.5,20],[-113,24],[-123,16.5]])lantaarn(x,z);
  for(const[x,z]of[[-102,37],[-113.5,37.5],[-134,37],[-101,4]])P.push(prop('boom',x,z,{r:.55,schaduw:1.8,schaal:1.3}));
  /* borden bij de poorten */
  P.push(prop('bord',x1+3.4,-3.2,{r:.4}),prop('bord',cx+3.2,z0-3.2,{r:.4}),prop('bord',cx-3.2,z1+3.2,{r:.4}));
  for(const[x,z]of[[x1+2.6,3.2],[x1+2.6,-3.2],[cx+3,z0-2.6],[cx-3,z0-2.6],[cx+3,z1+2.6],[cx-3,z1+2.6]])lantaarn(x,z);
  /* ----- buiten de muren: boerderij, molen, meer, bandietenkamp, en de weiden met bomen en rotsen ----- */
  /* boerderij aan de Koningsweg */
  bouw(B.huis({w:6.5,d:5,h:2.8,dakH:2.2,muur:'hout',ramen:2}),-76,-11,{r:3.7});
  bouw(B.moestuin(7,4.5),-66,-12,{r:4});bouw(B.moestuin(7,4.5),-86,-11.5,{r:4});
  for(const[x,z]of[[-71,-5.6],[-69.5,-4.6],[-80.6,-5.2]])bouw(B.hooibaal(),x,z,{r:.7,rot:R()*3});
  for(const x of[-88,-85.4,-82.8,-80.2,-77.6,-75,-72.4,-69.8,-67.2,-64.6])bouw(B.hek(2.6),x,-16.5,{r:1.1});
  P.push(prop('kar',-72.5,-7.4,{r:1.2,schaduw:2.6}),prop('lantaarn',-73.8,-7.4,{r:.25}));
  /* de molen: een hoge toren met vier wieken */
  const molen=B.toren(2.2,7,{dak:true});bouw(molen,-78,18,{r:2.6});
  for(let i=0;i<4;i++){const wiek=B.vlag(0.1,'stof_groen');wiek.children[1].scale.set(4.6,1.3,1);wiek.children[1].position.set(2.6,0,0);wiek.rotation.z=i*Math.PI/2;wiek.position.set(0,7.2,2.5);molen.add(wiek)}
  bouw(B.hooibaal(),-74.5,21,{r:.7});bouw(B.kist(),-81.5,21.6,{r:.5,rot:.6});
  /* het meer in het zuiden met rietkragen van struiken */
  bouw(B.vijver(7),-118,54,{r:7.7});
  for(let a=0;a<Math.PI*2;a+=.5){const x=-118+Math.cos(a)*8.6,z=54+Math.sin(a)*8.6;if(inVale(x,z,2)&&R()<.7)P.push(prop('struik',x,z,{schaduw:1,schaal:1.3}))}
  /* het bandietenkamp: tenten rond een vuurplaats, buit en een omheining van rotsen en balen */
  const[kx,kz]=KAMP;
  for(const[dx,dz,rot]of[[-5,-3,Math.PI/2+.3],[5,-3.5,-Math.PI/2+.2],[0,5.5,Math.PI+.1]])bouw(B.tent(3.2,3.4,dx<0?'stof_groen':'stof_rood'),kx+dx,kz+dz,{r:2,rot});
  bouw(B.kist(),kx+3,kz+3,{r:.5,rot:.5});bouw(B.kist(.7),kx-3.4,kz+2.6,{r:.45});bouw(B.ton(),kx+4,kz+1.4,{r:.45});bouw(B.hooibaal(),kx-6,kz+3,{r:.7,rot:.4});
  for(const[dx,dz]of[[-8,-7],[8,-7],[9,2],[-9,3],[0,-9],[6,8],[-6,8]])P.push(prop('rots',kx+dx,kz+dz,{r:.6,schaduw:1.4,schaal:1.3}));
  P.push(prop('hout',kx-2,kz-1.8,{r:.5}),prop('bord',kx+1.6,kz+9.2,{r:.4}));
  /* weiden: losse bomen, struiken, bloemen en rotsen; niet in de stad, niet op de wegen en niet bij het kamp */
  const open=(x,z,m)=>inVale(x,z,m)&&!inVeld(x,z)&&!inStad(x,z,-3)&&afstandTotPad(x,z,KONINGSWEG)>3&&Math.abs(x-cx)>4&&Math.hypot(x-kx,z-kz)>11&&Math.hypot(x+118,z-54)>10&&!(x>-92&&x<-60&&z>-19&&z<24);
  const soorten=['boom','boom','boom2','boom2','den','struik','struik'];
  for(let k=0;k<420;k++){const x=VALE.x0+R()*(VALE.x1-VALE.x0),z=VALE.z0+R()*(VALE.z1-VALE.z0);
    if(!open(x,z,2.5)||!vrij(x,z,2))continue;
    const s=soorten[Math.floor(R()*soorten.length)];
    P.push(prop(s,x,z,s==='struik'?{schaduw:1,schaal:1.3}:{r:.55,schaduw:1.8,schaal:1.3}))}
  for(let k=0;k<40;k++){const x=VALE.x0+R()*(VALE.x1-VALE.x0),z=VALE.z0+R()*(VALE.z1-VALE.z0);if(!open(x,z,2)||!vrij(x,z,1.5))continue;P.push(prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}))}
  for(let k=0;k<70;k++){const x=VALE.x0+R()*(VALE.x1-VALE.x0),z=VALE.z0+R()*(VALE.z1-VALE.z0);if(!open(x,z,2)||!vrij(x,z,1))continue;P.push(prop(R()<.5?'bloemen':'bloemen2',x,z,{schaal:1.6}))}
  /* de rand van de vlakte: een dichte bomenrij op de golvende rand (botsing) en losse rijen erbuiten; niet waar het veld overlapt */
  for(let t=0;t<Math.PI*2;t+=2.3/70){const L=valeRand(t);
    for(const[k,dicht,kans]of[[-1.2,true,1],[1.8,false,1],[4.6,false,.85],[7.4,false,.7],[10.4,false,.5]]){
      const f=L+k/VALE.rz+(dicht?0:(R()-.5)*.05),x=VALE.cx+Math.sin(t)*VALE.rx*f+(dicht?0:(R()-.5)*1.2),z=VALE.cz+Math.cos(t)*VALE.rz*f;
      if(inVeld(x,z)||R()>kans)continue;
      P.push(prop(R()<.55?'boom':R()<.5?'boom2':'den',x,z,{r:dicht?.7:0,schaduw:1.8,schaal:1.3}))}}
}
