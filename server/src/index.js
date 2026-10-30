/* Eldoria – spelserver: een Worker die elke verbinding naar het Durable Object van de wereld stuurt.
   Het object houdt alle WebSockets vast (met de hibernation-API, zodat het niets kost als er niemand speelt)
   en verspreidt de berichten van de spelers, met dezelfde betekenis als de oude MQTT-berichten:
     client → server  {k:'hi',f:id,p:presence}   aanmelden met een eigen id en status
                      {k:'p',p:presence}          status (positie, uiterlijk, hp, ...)
                      {k:'e',t:type,d:data,to?}   gebeurtenis voor iedereen of voor één speler
                      {k:'ping'}                  wordt beantwoord zonder het object te wekken
     server → client  {k:'hallo',spelers:[{f,p}],t}  bij het aanmelden: wie er al zijn
                      {k:'p',f,p}  {k:'x',f}  {k:'e',f,t,d}  {k:'pong'}
   De monsters leven hier (sim.js): zolang er spelers verbonden zijn tikt de simulatie vijf keer per seconde en krijgt
   iedereen snapshots ('m'), aanvallen ('ma') en doden ('k') als gebeurtenissen van afzender 'server'. Spelers melden
   hun klappen ('h'), bevriezingen ('ijs') en provocaties ('prov'). De botsingscirkels van de wereld stuurt de client
   mee ({k:'wereld',obst:[[x,z,r],...]}), omdat de wereld in de browser wordt gebouwd. */
import {maakSim} from './sim.js';
export {Accounts} from './accounts.js';
import {maakSpelers, geldigToken, geldigeNaam} from './spelers.js';
import {maxSchade} from '../../runeveld/src/regels/progressie.js';

const MAX_BERICHT = 16 * 1024, MAX_WERELD = 512 * 1024, TICK = 200;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json', 'access-control-allow-origin': '*'}});

export class Wereld {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    /* pings beantwoorden zonder het object te wekken */
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"k":"ping"}', '{"k":"pong"}'));
    this.sim = maakSim((t, d) => { if (t === 'k') d = this.metAandeel(d); this.zend(null, {k: 'e', f: 'server', t, d}); if (t === 'k') this.opDood(d); });
    this.partijen = new Map(); this.uitn = new Map(); this.partijNr = 0;   /* partijen leven zolang het object leeft */
    this.spelers_ = maakSpelers(this.ctx.storage);
    this.versie = env.VERSIE && env.VERSIE.id || '';
    this.loop = null; this.laatst = 0;
    this.ctx.blockConcurrencyWhile(async () => { const o = await this.ctx.storage.get('obst'); if (o) this.sim.zetObstakels(o); });
  }
  /* de spelers zoals de simulatie ze ziet: uit de status die iedereen meestuurt (x, y = z, dd = dood) */
  spelers() {
    const l = []; for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.f && a.p && a.p.n) l.push({id: a.f, x: +a.p.x || 0, z: +a.p.y || 0, dood: !!a.p.dd}); } return l;
  }
  /* de simulatie draait alleen als er iemand is; daarna slaapt het object */
  startLoop() {
    if (this.loop || !this.sim.heeftObstakels()) return;
    this.sim.spawn(this.spelers()); this.laatst = Date.now();
    this.loop = setInterval(() => {
      const sp = this.spelers(); if (!sp.length) { clearInterval(this.loop); this.loop = null; return; }
      const nu = Date.now(), dt = Math.min(.5, (nu - this.laatst) / 1000); this.laatst = nu;
      this.sim.tick(dt, sp); this.zend(null, {k: 'e', f: 'server', t: 'm', d: this.sim.snapshot()});
    }, TICK);
  }
  async fetch(req) {
    /* een object dat al draait blijft na een uitrol op de oude code zolang er spelers zijn; als de Worker (altijd nieuw)
       een andere versie meldt, herstart het object zichzelf en verbinden de spelers opnieuw */
    const v = req.headers.get('x-versie');
    if (v && this.versie && v !== this.versie) setTimeout(() => this.ctx.abort(), 50);
    if (req.headers.get('Upgrade') !== 'websocket') {
      const spelers = [];
      for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.f) spelers.push({f: a.f, n: a.p && a.p.n, l: a.p && a.p.l}); }
      return json({wereld: new URL(req.url).searchParams.get('wereld') || 'v1', versie: this.versie, online: spelers.length, spelers});
    }
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({f: null, p: null, t: Date.now()});
    return new Response(null, {status: 101, webSocket: client});
  }
  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_WERELD) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const at = ws.deserializeAttachment() || {};
    if (m.k === 'hi') {
      if (typeof m.f !== 'string' || !/^[a-z0-9-]{6,40}$/.test(m.f)) return;
      at.f = m.f; at.p = m.p && typeof m.p === 'object' ? m.p : {}; at.tok = geldigToken(m.tok) ? m.tok : null; at.naam = null; ws.serializeAttachment(at);
      const spelers = [];
      for (const o of this.ctx.getWebSockets()) { if (o === ws) continue; const a = o.deserializeAttachment(); if (a && a.f) spelers.push({f: a.f, p: a.p}); }
      ws.send(JSON.stringify({k: 'hallo', spelers, t: Date.now()}));
      this.zend(ws, {k: 'p', f: at.f, p: at.p});
      this.startLoop(); if (this.loop) ws.send(JSON.stringify({k: 'e', f: 'server', t: 'm', d: this.sim.snapshot()}));
      return;
    }
    if (!at.f) return;
    if (m.k === 'party') { this.partij(ws, at, m); return; }
    if (m.k === 'laad' || m.k === 'import' || m.k === 'nieuw' || m.k === 'wis' || m.k === 'speel' || m.k === 'save' || m.k === 'a') { this.account(ws, at, m); return; }
    if (m.k === 'wereld') {   /* de botsingscirkels van de wereld, één keer per versie van de wereld */
      if (!Array.isArray(m.obst) || m.obst.length > 6000) return;
      const nieuw = !this.sim.heeftObstakels(); this.sim.zetObstakels(m.obst); this.ctx.storage.put('obst', m.obst);
      if (nieuw) { this.startLoop(); if (this.loop) ws.send(JSON.stringify({k: 'e', f: 'server', t: 'm', d: this.sim.snapshot()})); }
      return;
    }
    if (data.length > MAX_BERICHT) return;
    if (m.k === 'p') { at.p = m.p && typeof m.p === 'object' ? m.p : {}; ws.serializeAttachment(at); this.zend(ws, {k: 'p', f: at.f, p: at.p}); }
    else if (m.k === 'e' && typeof m.t === 'string' && m.t.length <= 16) {
      if (m.t === 'm' || m.t === 'ma' || m.t === 'k') return;             /* alleen de server bepaalt de monsters */
      const d = m.d && typeof m.d === 'object' ? m.d : {};
      if (m.t === 'h') { const rec = at.naam ? this.spelers_.vind(await this.spelers_.laad(at.tok), at.naam) : null; const dmg = Math.min(+d.dmg || 0, rec ? maxSchade(rec) : 400); m.d = {...d, dmg}; this.sim.hit(String(d.id), dmg, at.f); if (d.kx !== undefined) this.sim.klap(String(d.id), +d.kx, +d.kz, +d.kracht); }
      else if (m.t === 'ijs') this.sim.bevries(Array.isArray(d.ids) ? d.ids.map(String) : [], +d.duur);
      else if (m.t === 'prov') { this.sim.provoceer(+d.x, +d.z, +d.straal, at.f); return; }
      const uit = JSON.stringify({k: 'e', f: at.f, t: m.t, d: m.d});
      if (typeof m.to === 'string') { for (const o of this.ctx.getWebSockets()) { const a = o.deserializeAttachment(); if (a && a.f === m.to) { try { o.send(uit); } catch (e) {} } } }
      else this.zend(ws, uit);
    }
  }
  /* helden en handelingen van een account; het antwoord draagt de vraag-id (m.i) zodat de client het kan koppelen */
  async account(ws, at, m) {
    const S = this.spelers_, stuur = obj => { try { ws.send(JSON.stringify({...obj, i: m.i})); } catch (e) {} };
    if (!at.tok) { stuur({k: 'fout', fout: 'geen token'}); return; }
    try {
      if (m.k === 'laad') { const d = await S.laad(at.tok); stuur({k: 'chars', lijst: d.lijst, laatst: d.laatst}); }
      else if (m.k === 'import') { const d = await S.importeer(at.tok, m.lijst); stuur({k: 'chars', lijst: d.lijst, laatst: d.laatst}); }
      else if (m.k === 'nieuw') { const d = await S.nieuw(at.tok, m.c); stuur({k: 'chars', lijst: d.lijst, laatst: d.laatst}); }
      else if (m.k === 'wis') { const d = await S.wis(at.tok, String(m.naam)); stuur({k: 'chars', lijst: d.lijst, laatst: d.laatst}); }
      else if (m.k === 'speel') { const d = await S.laad(at.tok), c = geldigeNaam(m.naam) ? S.vind(d, m.naam) : null; if (!c) { stuur({k: 'fout', fout: 'onbekende held'}); return; } at.naam = c.naam; ws.serializeAttachment(at); stuur({k: 'char', c}); }
      else if (m.k === 'save') { if (at.naam) await S.save(at.tok, at.naam, m.c); else stuur({k: 'fout', fout: 'geen held'}); }
      else if (m.k === 'a') { if (!at.naam) { stuur({k: 'fout', fout: 'geen held'}); return; } const c = await S.actie(at.tok, at.naam, String(m.t), m.d); if (c) stuur({k: 'char', c}); }
    } catch (e) { stuur({k: 'fout', fout: 'serverfout'}); }
  }
  /* ---- partijen: uitnodigen, aannemen, verlaten, schoppen; de leden delen exp (met een bonus) en zeny ---- */
  socketVan(f) { for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.f === f) return {ws, a}; } return null; }
  partijVan(f) { for (const p of this.partijen.values()) if (p.leden.includes(f)) return p; return null; }
  stuurPartij(p) {
    const leden = p.leden.map(f => { const s = this.socketVan(f), q = s && s.a.p || {}; return {f, n: q.n || '?', k: q.k || 'swordsman', l: q.l || 1}; });
    const msg = JSON.stringify({k: 'partij', p: {id: p.id, leider: p.leider, leden}});
    for (const f of p.leden) { const s = this.socketVan(f); if (s) try { s.ws.send(msg); } catch (e) {} }
  }
  verlaatPartij(f) {
    const p = this.partijVan(f); if (!p) return;
    p.leden = p.leden.filter(x => x !== f); const s = this.socketVan(f); if (s) try { s.ws.send('{"k":"partij","p":null}'); } catch (e) {}
    if (!p.leden.length) { this.partijen.delete(p.id); return; }
    if (p.leider === f) p.leider = p.leden[0]; this.stuurPartij(p);
  }
  partij(ws, at, m) {
    const info = tekst => { try { ws.send(JSON.stringify({k: 'partijinfo', tekst})); } catch (e) {} };
    const actie = m.actie;
    if (actie === 'uitnodig') {
      const doel = this.socketVan(String(m.naar)); if (!doel || doel.a.f === at.f || !doel.a.p || !doel.a.p.n) return info('That player is not here.');
      if (this.partijVan(doel.a.f)) return info(`${doel.a.p.n} is already in a party.`);
      let p = this.partijVan(at.f);
      if (!p) { p = {id: 'p' + (++this.partijNr), leider: at.f, leden: [at.f]}; this.partijen.set(p.id, p); this.stuurPartij(p); }
      else if (p.leider !== at.f) return info('Only the party leader can invite.');
      if (p.leden.length >= 6) return info('The party is full (6).');
      this.uitn.set(doel.a.f, {partij: p.id, van: at.f, t: Date.now()});
      try { doel.ws.send(JSON.stringify({k: 'uitnodiging', van: {f: at.f, n: at.p && at.p.n || '?'}, partij: p.id})); } catch (e) {}
      info(`You invited ${doel.a.p.n} to your party.`);
    } else if (actie === 'accepteer') {
      const u = this.uitn.get(at.f); if (!u || Date.now() - u.t > 60000) return info('That invitation has expired.');
      this.uitn.delete(at.f); const p = this.partijen.get(u.partij); if (!p || p.leden.length >= 6) return info('That party no longer exists.');
      this.verlaatPartij(at.f); p.leden.push(at.f); this.stuurPartij(p);
    } else if (actie === 'weiger') { const u = this.uitn.get(at.f); this.uitn.delete(at.f); if (u) { const s = this.socketVan(u.van); if (s) try { s.ws.send(JSON.stringify({k: 'partijinfo', tekst: `${at.p && at.p.n || 'Someone'} declined your invitation.`})); } catch (e) {} } }
    else if (actie === 'verlaat') this.verlaatPartij(at.f);
    else if (actie === 'schop') { const p = this.partijVan(at.f); if (!p || p.leider !== at.f) return; const wie = String(m.wie); if (p.leden.includes(wie) && wie !== at.f) this.verlaatPartij(wie); }
  }
  /* het aandeel van elk partijlid in de buurt (40 eenheden) in de exp en zeny van een dood monster; samen levert 10% per extra lid op */
  metAandeel(d) {
    const aandeel = {}, p = this.partijVan(d.door);
    if (!p) { aandeel[d.door] = {exp: d.exp, zeny: d.zeny}; return {...d, aandeel}; }
    const dichtbij = p.leden.filter(f => { const s = this.socketVan(f); return s && s.a.p && s.a.p.n && !s.a.p.dd && Math.hypot((+s.a.p.x || 0) - d.x, (+s.a.p.y || 0) - d.z) <= 40; });
    if (!dichtbij.includes(d.door)) dichtbij.push(d.door);
    const n = dichtbij.length, bonus = 1 + .1 * (n - 1);
    for (const f of dichtbij) aandeel[f] = {exp: Math.round(d.exp * bonus / n), zeny: Math.round(d.zeny / n)};
    return {...d, aandeel};
  }
  /* een monster is gedood: ieder met een aandeel krijgt zijn exp en zeny op zijn record; de buit gaat naar de doder */
  async opDood(d) {
    for (const [f, deel] of Object.entries(d.aandeel || {})) { const s = this.socketVan(f); if (!s || !s.a.tok || !s.a.naam) continue;
      try { const c = await this.spelers_.dood(s.a.tok, s.a.naam, {soort: String(d.id).split('#')[0], exp: deel.exp, zeny: deel.zeny, buit: f === d.door ? d.buit : null}); if (c) s.ws.send(JSON.stringify({k: 'char', c})); } catch (e) {} }
  }
  webSocketClose(ws) { this.weg(ws); }
  webSocketError(ws) { this.weg(ws); }
  weg(ws) {
    const a = ws.deserializeAttachment();
    try { ws.close(1000, 'bye'); } catch (e) {}
    if (a && a.f) { this.verlaatPartij(a.f); this.uitn.delete(a.f); this.zend(ws, {k: 'x', f: a.f}); }
  }
  /* naar iedereen behalve `van` */
  zend(van, obj) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    for (const o of this.ctx.getWebSockets()) { if (o === van) continue; try { o.send(s); } catch (e) {} }
  }
}

const CORS = {'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type'};
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
    if (url.pathname.startsWith('/account/')) {
      const r = await env.ACCOUNTS.get(env.ACCOUNTS.idFromName('main')).fetch(req);
      return new Response(r.body, {status: r.status, headers: {...CORS, 'content-type': 'application/json'}});
    }
    if (url.pathname === '/ws' || url.pathname === '/status') {
      const naam = (url.searchParams.get('wereld') || 'v1').slice(0, 32);
      const id = env.WERELD.idFromName(naam);
      const r = new Request(req); r.headers.set('x-versie', env.VERSIE && env.VERSIE.id || '');
      return env.WERELD.get(id).fetch(r);
    }
    return new Response('Eldoria: Chronicles of Magic – game server. Connect to /ws, status at /status.', {headers: {'content-type': 'text/plain', 'access-control-allow-origin': '*'}});
  },
};
