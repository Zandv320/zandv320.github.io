/* Eldoria – de helden op de server. Per account (een geheim token dat de browser aanmaakt) een lijst helden in de
   opslag van het Durable Object. De server past zelf de spelregels toe (runeveld/src/regels/progressie.js): exp en
   loot van zijn eigen monsters, stat- en skillpunten, winkel, uitrusting, drankjes, advancement en quests. De client
   vraagt om een handeling en krijgt het bijgewerkte record terug; wat hij zelf verzint telt niet. */
import * as PR from '../../runeveld/src/regels/progressie.js';
import {ITEMS} from '../../runeveld/src/data.js';

const MAX_HELDEN = 6;
const sleutel = token => 't:' + token;
export const geldigToken = t => typeof t === 'string' && /^[a-z0-9]{20,48}$/.test(t);
export const geldigeNaam = n => typeof n === 'string' && n.length >= 1 && n.length <= 14;

export function maakSpelers(storage) {
  const cache = new Map();   /* token → {lijst:[record], laatst} */
  async function laad(token) {
    if (cache.has(token)) return cache.get(token);
    const d = (await storage.get(sleutel(token))) || {lijst: [], laatst: 0};
    cache.set(token, d); return d;
  }
  async function bewaar(token) { const d = cache.get(token); if (d) await storage.put(sleutel(token), d); }
  function vind(d, naam) { return d.lijst.find(c => c.naam === naam) || null; }
  return {
    laad, bewaar, vind,
    /* eenmalige overname van de helden uit de browser (de oude localStorage-opslag), alleen zolang dit account leeg is */
    async importeer(token, lijst) {
      const d = await laad(token); if (d.lijst.length) return d;
      for (const bron of (Array.isArray(lijst) ? lijst : []).slice(0, MAX_HELDEN)) { if (!bron || !geldigeNaam(bron.naam) || vind(d, bron.naam)) continue; d.lijst.push(PR.schoon(bron)); }
      await bewaar(token); return d;
    },
    async nieuw(token, c) {
      const d = await laad(token); if (d.lijst.length >= MAX_HELDEN || !c || !geldigeNaam(c.naam) || vind(d, c.naam)) return d;
      d.lijst.push(PR.nieuwRecord({naam: c.naam.trim(), haar: c.haar, klasse: c.klasse})); await bewaar(token); return d;
    },
    async wis(token, naam) { const d = await laad(token); const i = d.lijst.findIndex(c => c.naam === naam); if (i >= 0) { d.lijst.splice(i, 1); d.laatst = 0; await bewaar(token); } return d; },
    /* de vluchtige velden die de client wél zelf bijhoudt */
    async save(token, naam, v) {
      const d = await laad(token), c = vind(d, naam); if (!c || !v) return null;
      const a = PR.afgeleidVan(c);
      if (Number.isFinite(+v.hp)) c.hp = Math.max(0, Math.min(a.hpMax, Math.round(+v.hp)));
      if (Number.isFinite(+v.sp)) c.sp = Math.max(0, Math.min(a.spMax, Math.round(+v.sp)));
      if (Number.isFinite(+v.x) && Number.isFinite(+v.z)) { c.x = +(+v.x).toFixed(2); c.z = +(+v.z).toFixed(2); }
      d.laatst = d.lijst.indexOf(c); await bewaar(token); return c;
    },
    /* een handeling van de speler; geeft het record terug (ook als er niets veranderde, zodat de client gelijk loopt) */
    async actie(token, naam, t, x) {
      const d = await laad(token), c = vind(d, naam); if (!c) return null; x = x && typeof x === 'object' ? x : {};
      const id = typeof x.id === 'string' ? x.id : '';
      let ok = false;
      switch (t) {
        case 'stat': ok = PR.statOmhoog(c, String(x.k)); break;
        case 'skill': ok = PR.skillOmhoog(c, id); break;
        case 'koop': ok = PR.koop(c, id); break;
        case 'verkoop': ok = PR.verkoop(c, id); break;
        case 'weggooi': ok = PR.weggooi(c, id); break;
        case 'uitrusten': ok = PR.uitrusten(c, id); break;
        case 'afdoen': ok = PR.afdoen(c, String(x.slot)); break;
        case 'drank': ok = PR.drink(c, id || 'drank'); break;
        case 'advance': ok = PR.advance(c, id); break;
        case 'quest': ok = x.actie === 'accepteer' ? PR.questAccepteer(c, id) : x.actie === 'lever' ? PR.questLever(c, id) : PR.questVoortgang(c, id); break;
        case 'respawn': { const a = PR.afgeleidVan(c); c.hp = Math.max(1, Math.round(a.hpMax * .5)); c.sp = Math.round(a.spMax * .5); c.x = 0; c.z = 4; ok = true; break; }
      }
      if (ok) await bewaar(token);
      return c;
    },
    /* een monster gedood: exp, zeny, buit en questvoortgang */
    async dood(token, naam, {soort, exp, zeny, buit}) {
      const d = await laad(token), c = vind(d, naam); if (!c) return null;
      PR.beloon(c, {exp, zeny}); if (buit && ITEMS[buit]) PR.tasToevoegen(c, buit, 1); PR.questOpDood(c, soort); PR.questOpTas(c);
      await bewaar(token); return c;
    },
  };
}
