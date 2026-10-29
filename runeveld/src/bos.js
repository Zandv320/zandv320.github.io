/* Runeveld – Whisperwood: het donkere bos ten noorden van het veld. Een kronkelpad vanaf de noordpoort,
   een houthakkershut halverwege en een open plek met een oud altaar en menhirs. Dichte dennen eromheen. */
import * as B from './bouw.js';
import {BOS,BOS_PAD,BOS_PLEK,afstandTotPad} from './gebied.js';

/* ctx: {scene, prop(naam,x,z,opties), bouw(g,x,z,opties), vrij(x,z,r), toeval(seed), P (lijst van laadbeloften)} */
export function bouwBos({scene,prop,bouw,vrij,toeval,P}){
  const R=toeval(4242);
  const[px,pz]=BOS_PLEK;
  /* het pad, segment voor segment, iets overlappend zodat de bochten dicht zijn */
  for(let i=0;i<BOS_PAD.length-1;i++){const[ax,az]=BOS_PAD[i],[bx,bz]=BOS_PAD[i+1];const dx=bx-ax,dz=bz-az;
    scene.add(B.pad(2.6,Math.hypot(dx,dz)+1.4,{x:(ax+bx)/2,z:(az+bz)/2,rot:Math.atan2(dx,dz)}))}
  /* de open plek: oude stenen vloer, altaar in het midden, menhirs eromheen */
  const plek=B.plein(6.5,'steen',.9);plek.position.set(px,.02,pz);scene.add(plek);
  bouw(B.altaar(),px,pz,{r:1.9});
  for(let i=0;i<5;i++){const a=Math.PI*.15+i*Math.PI*2/5,x=px+Math.cos(a)*5.2,z=pz+Math.sin(a)*5.2;bouw(B.menhir(1.8+R()*.8),x,z,{rot:a,r:.6})}
  /* de houthakkershut langs het pad, met de voorkant naar het pad (oost) */
  bouw(B.huis({w:4.6,d:4,h:2.3,dakH:1.7,muur:'hout',ramen:1}),-16,-84,{rot:Math.PI/2,r:3});
  P.push(prop('hout',-16.6,-80.6,{r:.5}),prop('ton',-13.2,-82.2,{r:.4}),prop('kist',-13.3,-86,{r:.4}),prop('lantaarn',-12.9,-84.2,{r:.25}));
  /* de ingang: bord en lantaarns bij de bomenrij van het veld */
  P.push(prop('bord',2.8,-61.6,{r:.4}),prop('lantaarn',-2.8,-61.6,{r:.25}),prop('lantaarn',2.8,-64.4,{r:.25}));
  /* dichte dennen: een rooster met wat toeval, niet op het pad, de open plek of bij de hut */
  const soorten=['den','den','den','den2','den2','boom','boom2'];
  const vrijPlek=(x,z)=>afstandTotPad(x,z)>2.6&&Math.hypot(x-px,z-pz)>8.2&&!(x>-19.5&&x<-11&&z>-88.5&&z<-79.5)&&!(Math.abs(x)<3.4&&z>-64);
  for(let z=BOS.z0+1.4;z<BOS.z1;z+=2.7)for(let x=BOS.x0+1.4;x<BOS.x1;x+=2.7){
    const rand=x<BOS.x0+2.5||x>BOS.x1-2.5||z<BOS.z0+2.5;            /* de buitenste rij staat altijd en sluit het bos af */
    if(!rand&&R()<.22)continue;
    const jx=rand?x:x+(R()-.5)*1.8,jz=rand?z:z+(R()-.5)*1.8;
    if(!rand&&(!vrijPlek(jx,jz)||!vrij(jx,jz,1.4)))continue;
    const s=rand?(R()<.7?'den':'den2'):soorten[Math.floor(R()*soorten.length)];
    P.push(prop(s,jx,jz,{r:.55,schaduw:1.8,schaal:1.3}));
  }
  /* struiken en rotsen in de open stukken */
  for(let k=0;k<60;k++){const x=BOS.x0+3+R()*(BOS.x1-BOS.x0-6),z=BOS.z0+3+R()*(BOS.z1-BOS.z0-5);
    if(!vrijPlek(x,z)||!vrij(x,z,1.1))continue;
    P.push(R()<.55?prop('struik',x,z,{schaduw:1,schaal:1.3}):prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}))}
  /* een paar rotsen aan de rand van de open plek en langs het pad */
  for(const[x,z]of[[px+7.6,pz+1.5],[px-7.4,pz-2.2],[px+3,pz-7.8],[-6.2,-72.5],[-13,-93.4],[3.6,-95.2]])P.push(prop('rots',x,z,{r:.6,schaduw:1.4,schaal:1.2}));
}
