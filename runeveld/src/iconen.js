/* Runeveld – pixel-iconen uit de atlas sprites/iconen.png (Craftpix). ico(id) geeft een <i> die het icoon van een
   skill, item, klasse of knop toont; onbekende ids vallen terug op het meegegeven emoji. De grootte komt uit CSS
   (--is), de atlas wordt met pixelated geschaald zodat de pixels strak blijven. */
import {ICONEN,KOLOMMEN} from './iconen_index.js';
export const heeftIcoon=id=>!!ICONEN[id];
export function ico(id,terugval='',klas=''){
  const p=ICONEN[id];
  if(!p)return terugval?`<span class="ico-emoji ${klas}">${terugval}</span>`:'';
  return`<i class="ico ${klas}" style="--ix:${p[0]};--iy:${p[1]}"></i>`;
}
export const ICO_KOLOMMEN=KOLOMMEN;
