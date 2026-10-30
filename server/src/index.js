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

const MAX_BERICHT = 16 * 1024, MAX_WERELD = 512 * 1024, TICK = 200;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json', 'access-control-allow-origin': '*'}});

export class Wereld {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    /* pings beantwoorden zonder het object te wekken */
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"k":"ping"}', '{"k":"pong"}'));
    this.sim = maakSim((t, d) => this.zend(null, {k: 'e', f: 'server', t, d}));
    this.loop = null; this.laatst = 0;
    this.ctx.blockConcurrencyWhile(async () => { const o = await this.ctx.storage.get('obst'); if (o) this.sim.zetObstakels(o); });
  }
  /* de spelers zoals de simulatie ze ziet: uit de status die iedereen meestuurt (x, y = z, dd = dood) */
  spelers() {
    const l = []; for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.f && a.p) l.push({id: a.f, x: +a.p.x || 0, z: +a.p.y || 0, dood: !!a.p.dd}); } return l;
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
    if (req.headers.get('Upgrade') !== 'websocket') {
      const spelers = [];
      for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.f) spelers.push({f: a.f, n: a.p && a.p.n, l: a.p && a.p.l}); }
      return json({wereld: 'v1', online: spelers.length, spelers});
    }
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({f: null, p: null, t: Date.now()});
    return new Response(null, {status: 101, webSocket: client});
  }
  webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_WERELD) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const at = ws.deserializeAttachment() || {};
    if (m.k === 'hi') {
      if (typeof m.f !== 'string' || !/^[a-z0-9-]{6,40}$/.test(m.f)) return;
      at.f = m.f; at.p = m.p && typeof m.p === 'object' ? m.p : {}; ws.serializeAttachment(at);
      const spelers = [];
      for (const o of this.ctx.getWebSockets()) { if (o === ws) continue; const a = o.deserializeAttachment(); if (a && a.f) spelers.push({f: a.f, p: a.p}); }
      ws.send(JSON.stringify({k: 'hallo', spelers, t: Date.now()}));
      this.zend(ws, {k: 'p', f: at.f, p: at.p});
      this.startLoop(); if (this.loop) ws.send(JSON.stringify({k: 'e', f: 'server', t: 'm', d: this.sim.snapshot()}));
      return;
    }
    if (!at.f) return;
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
      if (m.t === 'h') { this.sim.hit(String(d.id), +d.dmg, at.f); if (d.kx !== undefined) this.sim.klap(String(d.id), +d.kx, +d.kz, +d.kracht); }
      else if (m.t === 'ijs') this.sim.bevries(Array.isArray(d.ids) ? d.ids.map(String) : [], +d.duur);
      else if (m.t === 'prov') { this.sim.provoceer(+d.x, +d.z, +d.straal, at.f); return; }
      const uit = JSON.stringify({k: 'e', f: at.f, t: m.t, d: m.d});
      if (typeof m.to === 'string') { for (const o of this.ctx.getWebSockets()) { const a = o.deserializeAttachment(); if (a && a.f === m.to) { try { o.send(uit); } catch (e) {} } } }
      else this.zend(ws, uit);
    }
  }
  webSocketClose(ws) { this.weg(ws); }
  webSocketError(ws) { this.weg(ws); }
  weg(ws) {
    const a = ws.deserializeAttachment();
    try { ws.close(1000, 'bye'); } catch (e) {}
    if (a && a.f) this.zend(ws, {k: 'x', f: a.f});
  }
  /* naar iedereen behalve `van` */
  zend(van, obj) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
    for (const o of this.ctx.getWebSockets()) { if (o === van) continue; try { o.send(s); } catch (e) {} }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws' || url.pathname === '/status') {
      const naam = (url.searchParams.get('wereld') || 'v1').slice(0, 32);
      const id = env.WERELD.idFromName(naam);
      return env.WERELD.get(id).fetch(req);
    }
    return new Response('Eldoria: Chronicles of Magic – game server. Connect to /ws, status at /status.', {headers: {'content-type': 'text/plain', 'access-control-allow-origin': '*'}});
  },
};
