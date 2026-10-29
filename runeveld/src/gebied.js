/* Runeveld – gebieden buiten het veld rond het dorp. Geen imports, zodat elk bestand dit kan gebruiken.
   Het veld is het vierkant -VELD..VELD (world.js); het bos "Whisperwood" ligt ten noorden daarvan en is
   alleen via de weg door de noordpoort te bereiken. */
export const BOS={x0:-36,x1:36,z0:-112,z1:-60,naam:'Whisperwood'};
export const inBos=(x,z)=>x>BOS.x0&&x<BOS.x1&&z>BOS.z0&&z<BOS.z1;
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
