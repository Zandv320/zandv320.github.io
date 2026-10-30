/* Eldoria – spelserver: een Worker die elke verbinding naar het Durable Object van de wereld stuurt.
   Het object houdt alle WebSockets vast (met de hibernation-API, zodat het niets kost als er niemand speelt)
   en verspreidt de berichten van de spelers, met dezelfde betekenis als de oude MQTT-berichten:
     client → server  {k:'hi',f:id,p:presence}   aanmelden met een eigen id en status
                      {k:'p',p:presence}          status (positie, uiterlijk, hp, ...)
                      {k:'e',t:type,d:data,to?}   gebeurtenis voor iedereen of voor één speler
                      {k:'ping'}                  wordt beantwoord zonder het object te wekken
     server → client  {k:'hallo',spelers:[{f,p}],t}  bij het aanmelden: wie er al zijn
                      {k:'p',f,p}  {k:'x',f}  {k:'e',f,t,d}  {k:'pong'}
   Stap twee (later): de monsters hier simuleren met de spelregels uit runeveld/src/regels/. */

const MAX_BERICHT = 16 * 1024;
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {status, headers: {'content-type': 'application/json', 'access-control-allow-origin': '*'}});

export class Wereld {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    /* pings beantwoorden zonder het object te wekken */
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"k":"ping"}', '{"k":"pong"}'));
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
    if (typeof data !== 'string' || data.length > MAX_BERICHT) return;
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
      return;
    }
    if (!at.f) return;
    if (m.k === 'p') { at.p = m.p && typeof m.p === 'object' ? m.p : {}; ws.serializeAttachment(at); this.zend(ws, {k: 'p', f: at.f, p: at.p}); }
    else if (m.k === 'e' && typeof m.t === 'string' && m.t.length <= 16) {
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
