/* Runeveld – gebieden. Geen imports, zodat elk bestand dit kan gebruiken.
   Het veld rond het dorp en het bos "Whisperwood" ten noorden ervan hebben organische randen: een straal die
   met de hoek golft (vaste fasen, dus elke keer dezelfde vorm). Het bos overlapt het veld een paar eenheden
   bij de noordpoort; daar is de enige doorgang. De rechthoeken (BOS, VELD) zijn de omhullende dozen voor de
   grondkaart en de kaart; de echte vorm komt uit inVeld() en inBos(). */
export const VELD=60;                                     /* halve breedte van de grondkaart rond het dorp */
export const BOS={x0:-44,x1:44,z0:-126,z1:-56,naam:'Whisperwood',cx:0,cz:-88,rx:34,rz:27};
/* golving met de hoek: som van drie sinussen, vaste fasen */
const ruis=(t,a,b,c)=>.5*Math.sin(3*t+a)+.3*Math.sin(5*t+b)+.2*Math.sin(8*t+c);
/* een bult rond hoek t0 (1 daar, 0 aan de andere kant), om de rand bij de ingang op een vaste maat te trekken */
const bult=(t,t0)=>Math.pow((1+Math.cos(t-t0))/2,3);
/* het veld: straal vanuit het dorpsmidden, gemiddeld 55 (golvend 49–61), en precies 62 recht naar het noorden (bij de weg) */
const VELD_R=(()=>{const n0=ruis(Math.PI,1.3,2.9,.4);return t=>55+6*ruis(t,1.3,2.9,.4)+(7-6*n0)*bult(t,Math.PI)})();
export const veldRand=VELD_R;
export const inVeld=(x,z,m=0)=>Math.hypot(x,z)<VELD_R(Math.atan2(x,z))-m;
/* het bos: een golvende ellips rond (0,-88); recht naar het zuiden (bij de ingang) reikt hij tot z≈-58.8 */
const BOS_L=(()=>{const n0=ruis(Math.PI,.7,2.1,3.3);return t=>1+.14*ruis(t,.7,2.1,3.3)+(.08-.14*n0)*bult(t,Math.PI)})();
export function bosRand(t){return BOS_L(t)}
export const inBos=(x,z,m=0)=>{const dx=x/BOS.rx,dz=(z-BOS.cz)/BOS.rz;return Math.hypot(dx,dz)<BOS_L(Math.atan2(dx,dz))-m/BOS.rz};
/* binnen de wereld: in het veld of in het bos, met een marge tot de rand */
export const binnenWereld=(x,z,m=1.5)=>inVeld(x,z,m)||inBos(x,z,m);
/* het kronkelpad door het bos, van de ingang naar de open plek */
export const BOS_PAD=[[0,-59],[0,-70],[-9,-80],[-10,-90],[-3,-98],[0,-101]];
export const BOS_PLEK=[0,-103];   /* middelpunt van de open plek met het altaar */
/* afstand van een punt tot het pad */
export function afstandTotPad(x,z,pad=BOS_PAD){
  let best=1e9;
  for(let i=0;i<pad.length-1;i++){const[ax,az]=pad[i],[bx,bz]=pad[i+1];const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;
    const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2));best=Math.min(best,Math.hypot(x-(ax+dx*t),z-(az+dz*t)))}
  return best;
}
