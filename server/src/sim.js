/* Eldoria – de monstersimulatie op de server. Dezelfde regels als de oude host-speler (main.js hostTick), maar nu in het
   Durable Object: spawnen, zwerven, aanvallen, sterven, loot en respawn. Gebruikt de pure modules van het spel
   (data.js voor de monsters, gebied.js voor de wereldvorm) en de obstakellijst die de client meestuurt (de wereld
   wordt in de browser gebouwd; de server kent alleen de botsingscirkels).
   zend(t,d): stuurt een gebeurtenis naar alle spelers ('m' snapshot, 'ma' aanval, 'k' dood). */
import {MONSTERS, SPAWNS, RESPAWN} from '../../runeveld/src/data.js';
import {inBos, inVale, inVeld, inStad, BOS, BOS_PLEK, VALE, STAD, KAMP, afstandTotPad, binnenWereld} from '../../runeveld/src/gebied.js';

const R = (a, b) => a + Math.random() * (b - a);
const DORP = 22;
const inDorp = (x, z) => Math.abs(x) < DORP && Math.abs(z) < DORP;
const veilig = (x, z) => inDorp(x, z) || inStad(x, z);
/* dag en nacht: dezelfde klok als daglicht.js (24 echte minuten per speldag) */
const DAGMINUTEN = 24;
const uur = () => (Date.now() / 1000 / 60 % DAGMINUTEN) / DAGMINUTEN * 24;
const isNacht = () => { const u = uur(); return u < 6 || u > 20; };   /* daglicht() < .5 in daglicht.js */

export function maakSim(zend) {
  const M = new Map();
  let obst = [];            /* [{x,z,r}] */
  const vrij = (x, z, r = .5) => { if (!binnenWereld(x, z)) return false; for (const o of obst) if (Math.hypot(x - o.x, z - o.z) < o.r + r) return false; return true; };
  function botsing(x, z, r = .3) {
    if (!binnenWereld(x, z, 1.2)) return null;
    for (const o of obst) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), min = o.r + r; if (d < min) { if (d < 1e-4) x += min; else { x = o.x + dx / d * min; z = o.z + dz / d * min; } } }
    return [x, z];
  }
  function spawnPunt(spec, spelers) {
    const verAf = (x, z) => spelers.every(s => Math.hypot(x - s.x, z - s.z) > 6);
    if (spec.gebied === 'kamp') { const [px, pz] = KAMP; for (let i = 0; i < 80; i++) { const a = R(0, Math.PI * 2), d = R(2, 6), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d; if (vrij(x, z, .8)) return [x, z]; } return [px, pz - 7]; }
    if (spec.gebied === 'vale') { for (let i = 0; i < 160; i++) { const x = R(VALE.x0 + 6, VALE.x1 - 6), z = R(VALE.z0 + 6, VALE.z1 - 6);
      if (!inVale(x, z, 3) || inVeld(x, z) || inStad(x, z, -9) || Math.abs(x - STAD.cx) < 5 && Math.abs(z) < STAD.z1 + 10 || Math.hypot(x - KAMP[0], z - KAMP[1]) < 12 || !vrij(x, z, .8) || !verAf(x, z)) continue; return [x, z]; } return [VALE.cx, VALE.z1 - 12]; }
    if (spec.gebied === 'plek') { const [px, pz] = BOS_PLEK; for (let i = 0; i < 80; i++) { const a = R(0, Math.PI * 2), d = R(2.6, 5.4), x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d; if (vrij(x, z, .8)) return [x, z]; } return [px, pz - 4]; }
    if (spec.gebied === 'bos') { for (let i = 0; i < 120; i++) { const x = R(BOS.x0 + 4, BOS.x1 - 4), z = R(BOS.z0 + 4, BOS.z1 - 6);
      if (afstandTotPad(x, z) < 3 || Math.hypot(x - BOS_PLEK[0], z - BOS_PLEK[1]) < 10 || !vrij(x, z, .8) || !verAf(x, z)) continue; return [x, z]; } return [BOS.x0 + 8, BOS.z1 - 12]; }
    const [min, max] = spec.zone;
    for (let i = 0; i < 80; i++) { const x = R(-max, max), z = R(-max, max), r = Math.max(Math.abs(x), Math.abs(z));
      if (r < min || r > max || inDorp(x, z) || Math.abs(x) < 4 || !vrij(x, z, .8) || !verAf(x, z)) continue; return [x, z]; }
    return [max, max];
  }
  function thuis(spec, x, z) {
    if (spec.gebied === 'plek') return Math.hypot(x - BOS_PLEK[0], z - BOS_PLEK[1]) < 8;
    if (spec.gebied === 'bos') return inBos(x, z);
    if (spec.gebied === 'kamp') return Math.hypot(x - KAMP[0], z - KAMP[1]) < 9;
    if (spec.gebied === 'vale') return inVale(x, z, 2) && !inVeld(x, z) && !inStad(x, z, -4);
    return !inDorp(x, z) && Math.abs(x) >= 3;
  }
  function jachtgebied(spec, x, z) {
    if (spec.gebied === 'plek' || spec.gebied === 'bos') return inBos(x, z);
    if (spec.gebied === 'kamp' || spec.gebied === 'vale') return inVale(x, z) && !inStad(x, z, -3);
    return true;
  }
  function spawn(spelers) {
    if (M.size) return;
    for (const s of SPAWNS) for (let i = 0; i < s.n; i++) { const spec = MONSTERS[s.soort]; const [x, z] = spawnPunt(spec, spelers);
      M.set(s.soort + '#' + i, {id: s.soort + '#' + i, spec, x, z, kx: 0, kz: 1, st: 0, hp: spec.hp, dood: false, rt: 0, doel: null, cd: 0, wt: null, wtT: R(0, 3), ijsTot: 0}); }
  }
  const nu = () => Date.now() / 1000;
  function sterf(m, door) {
    m.dood = true; m.hp = 0; m.st = 3; m.doel = null; const rs = m.spec.respawn || RESPAWN; m.rt = R(rs[0], rs[1]);
    const sp = m.spec; let buit = null; for (const [id, kans] of Object.entries(sp.buit || {})) if (Math.random() < kans) { buit = id; break; }
    zend('k', {id: m.id, door, exp: sp.exp, zeny: Math.round(R(sp.zeny[0], sp.zeny[1])), buit});
  }
  function tick(dt, spelers) {
    for (const m of M.values()) {
      const sp = m.spec;
      if (m.dood) { m.rt -= dt; if (m.rt <= 0) { const [x, z] = spawnPunt(sp, spelers); m.dood = false; m.hp = sp.hp; m.x = x; m.z = z; m.doel = null; m.st = 0; } continue; }
      if (nu() < m.ijsTot) { m.st = 0; continue; }
      let doel = m.doel ? spelers.find(s => s.id === m.doel) : null;
      if (doel && (doel.dood || veilig(doel.x, doel.z) || Math.hypot(doel.x - m.x, doel.z - m.z) > 13 || !jachtgebied(sp, doel.x, doel.z))) { doel = null; m.doel = null; }
      const nachtF = isNacht() && sp.nacht ? sp.nacht : null;
      if (!doel && sp.agressief) { let best = null, bd = sp.aggro * (nachtF ? nachtF.aggro : 1); for (const s of spelers) { if (s.dood || veilig(s.x, s.z)) continue; const d = Math.hypot(s.x - m.x, s.z - m.z); if (d < bd) { bd = d; best = s; } } if (best) { doel = best; m.doel = best.id; } }
      m.cd = Math.max(0, m.cd - dt);
      if (doel) {
        const dx = doel.x - m.x, dz = doel.z - m.z, d = Math.hypot(dx, dz) || 1e-4; m.kx = dx / d; m.kz = dz / d;
        if (d > sp.bereik) { const s = sp.snelheid * (nachtF ? nachtF.snelheid : 1) * dt; const p = botsing(m.x + dx / d * s, m.z + dz / d * s); if (p) { m.x = p[0]; m.z = p[1]; } m.st = 1; }
        else { m.st = 0; if (m.cd <= 0) { m.cd = 1.6; zend('ma', {id: m.id, to: doel.id, dmg: Math.round(sp.atk * R(.85, 1.15))}); } }
      } else {
        m.wtT -= dt;
        if (m.wtT <= 0) { if (m.wt) { m.wt = null; m.wtT = R(1.5, 4); } else { const wx = m.x + R(-4, 4), wz = m.z + R(-4, 4); m.wt = thuis(sp, wx, wz) ? [wx, wz] : null; m.wtT = R(2, 5); } }
        if (m.wt) { const dx = m.wt[0] - m.x, dz = m.wt[1] - m.z, d = Math.hypot(dx, dz);
          if (d < .2) { m.wt = null; m.wtT = R(1.5, 4); m.st = 0; }
          else { m.kx = dx / d; m.kz = dz / d; const s = sp.snelheid * .55 * dt; const p = botsing(m.x + dx / d * s, m.z + dz / d * s); if (!p || Math.hypot(p[0] - m.x, p[1] - m.z) < s * .3) { m.wt = null; m.wtT = 1; } else { m.x = p[0]; m.z = p[1]; } m.st = 1; } }
        else m.st = 0;
      }
    }
  }
  return {
    M,
    zetObstakels(lijst) { obst = lijst.filter(o => Array.isArray(o) && o.length === 3 && o.every(Number.isFinite)).map(([x, z, r]) => ({x, z, r})); },
    heeftObstakels: () => obst.length > 0,
    spawn, tick,
    hit(id, dmg, door) { const m = M.get(id); if (!m || m.dood || !Number.isFinite(dmg)) return; m.hp = Math.max(0, m.hp - Math.max(0, Math.min(dmg, 99999))); if (!m.doel) m.doel = door; if (m.hp <= 0) sterf(m, door); },
    bevries(ids, duur) { const tot = nu() + Math.min(10, Math.max(0, duur || 1.5)); for (const id of ids || []) { const m = M.get(id); if (m && !m.dood) m.ijsTot = tot; } },
    provoceer(x, z, straal, door) { for (const m of M.values()) if (!m.dood && Math.hypot(m.x - x, m.z - z) <= Math.min(12, straal || 5)) m.doel = door; },
    klap(id, dx, dz, kracht) { const m = M.get(id); if (!m || m.dood) return; const l = Math.hypot(dx, dz) || 1, k = Math.min(2, kracht || 0) * .6; const nx = m.x + dx / l * k, nz = m.z + dz / l * k; if (vrij(nx, nz, .4) && !veilig(nx, nz)) { m.x = nx; m.z = nz; } },
    snapshot() { return {l: [...M.values()].map(m => [m.id, +m.x.toFixed(2), +m.z.toFixed(2), +m.kx.toFixed(2), +m.kz.toFixed(2), m.dood ? 3 : m.st, Math.round(m.hp)])}; },
  };
}
