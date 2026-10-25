import Peer from 'peerjs';

// Multiplayer via peer-to-peer (WebRTC, met PeerJS). Eén speler maakt een kamer en is de host:
// die houdt de levens, kills en respawns bij. Anderen verbinden met een korte kamercode.
// Wie schiet, kijkt zelf of hij iemand raakt (voelt eerlijk met vertraging) en meldt dat aan de
// host; de host controleert of het klopt en deelt de schade uit.

const PREFIX = 'vuistvechter-dm-v1-';
const MAX = 4;
const TICK = 0.05;              // 20x per seconde posities versturen
const RESPAWN = 3.5;
const REGEN_DELAY = 4, REGEN = 15;
const MAX_DMG = 90;             // hoogste schade per treffer (kopschot pistool = 85)
export const SPAWNS = [[0, 0, 9], [-12, 0, -5.5], [12, 0, 11], [-12, 0, 12], [12.5, 0, 4], [0, 0, -7], [-4, 0, -12.5], [5, 0, 13]];

// (testen: een nep-implementatie kan via window.__FakePeer worden ingeprikt)
const PeerImpl = () => (typeof window !== 'undefined' && window.__FakePeer) || Peer;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 5 }, () => ALPHABET[(Math.random() * ALPHABET.length) | 0]).join('');

export class Multiplayer {
  // game: { name(), localState(), localPos(), onSnapshot(list), onHurt(hp, from), onDie(killer), onRespawn(pos),
  //         onKill(killerName, victimName, head), onFx(id, fx), onLeft(id), onStatus(text), onClosed(reason) }
  constructor(game) {
    this.game = game;
    this.peer = null;
    this.isHost = false;
    this.active = false;
    this.id = null;
    this.conns = new Map();      // host: id -> conn
    this.conn = null;            // client: verbinding met host
    this.players = new Map();    // host: id -> {name, s, health, kills, deaths, dead, deadT, sinceHurt, lastHit}
    this.code = '';
    this.acc = 0;
  }

  // ---------- verbinden ----------
  host() {
    return new Promise((resolve, reject) => {
      const tryOpen = (n) => {
        const code = makeCode();
        const peer = new (PeerImpl())(PREFIX + code, { debug: 0 });
        peer.on('open', () => {
          this.peer = peer; this.code = code; this.isHost = true; this.active = true; this.id = 'host';
          this.players.set('host', this.newPlayer(this.game.name()));
          peer.on('connection', c => this.onConnection(c));
          resolve(code);
        });
        peer.on('error', e => {
          if (e.type === 'unavailable-id' && n < 4) { peer.destroy(); tryOpen(n + 1); }
          else if (!this.active) reject(e); else this.game.onStatus?.('Verbindingsfout: ' + e.type);
        });
        peer.on('disconnected', () => { try { peer.reconnect(); } catch (_) {} });
      };
      tryOpen(0);
    });
  }

  join(code) {
    code = code.trim().toUpperCase();
    return new Promise((resolve, reject) => {
      const peer = new (PeerImpl())({ debug: 0 });
      let done = false;
      peer.on('open', () => {
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          this.peer = peer; this.conn = conn; this.code = code; this.isHost = false;
          conn.send({ t: 'hello', name: this.game.name() });
        });
        conn.on('data', d => {
          if (d.t === 'welcome') { this.id = d.id; this.active = true; done = true; resolve(code); }
          else if (d.t === 'full') { done = true; reject(new Error('full')); peer.destroy(); return; }
          this.onClientData(d);
        });
        conn.on('close', () => { if (this.active) this.close('De host heeft de kamer gesloten.'); });
      });
      peer.on('error', e => {
        if (!done) { done = true; reject(e); peer.destroy(); }
        else this.game.onStatus?.('Verbindingsfout: ' + e.type);
      });
      setTimeout(() => { if (!done) { done = true; reject(new Error('timeout')); peer.destroy(); } }, 12000);
    });
  }

  close(reason) {
    const was = this.active;
    this.active = false;
    try { this.peer?.destroy(); } catch (_) {}
    this.peer = null; this.conn = null; this.conns.clear(); this.players.clear();
    if (was) this.game.onClosed?.(reason || '');
  }

  newPlayer(name) {
    return { name: (name || 'Speler').slice(0, 16), s: null, health: 100, kills: 0, deaths: 0, dead: false, deadT: 0, sinceHurt: 99, hits: [] };
  }

  // ---------- host ----------
  onConnection(c) {
    c.on('open', () => {
      if (this.conns.size >= MAX - 1) { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); return; }
    });
    c.on('data', d => this.onHostData(c, d));
    c.on('close', () => {
      const id = c.peer;
      if (!this.conns.has(id)) return;
      const name = this.players.get(id)?.name;
      this.conns.delete(id); this.players.delete(id);
      this.broadcast({ t: 'left', id, name });
      this.game.onLeft?.(id, name);
    });
  }

  onHostData(c, d) {
    const id = c.peer;
    if (d.t === 'hello') {
      if (this.conns.size >= MAX - 1) return;
      this.conns.set(id, c);
      const p = this.newPlayer(d.name);
      this.players.set(id, p);
      // nieuwe speler begint op een vrije plek
      const pos = this.freeSpawn(id);
      c.send({ t: 'welcome', id, spawn: pos });
      this.broadcast({ t: 'joined', id, name: p.name }, id);
      this.game.onJoined?.(id, p.name);
      return;
    }
    const p = this.players.get(id);
    if (!p) return;
    if (d.t === 'state') p.s = d.s;
    else if (d.t === 'hit') this.applyHit(id, d);
    else if (d.t === 'fx') { this.broadcast({ t: 'fx', id, fx: d.fx }, id); this.game.onFx?.(id, d.fx); }
  }

  // schade controleren en uitdelen
  applyHit(shooter, d) {
    const a = this.players.get(shooter), v = this.players.get(d.target);
    if (!a || !v || a.dead || v.dead || shooter === d.target) return;
    const now = performance.now() / 1000;
    a.hits = a.hits.filter(t => now - t < 1); a.hits.push(now);
    if (a.hits.length > 12) return;                                   // onmogelijk snel
    const dmg = Math.min(MAX_DMG, Math.max(0, Number(d.dmg) || 0));
    if (a.s && v.s) {
      const dx = a.s.p[0] - v.s.p[0], dz = a.s.p[2] - v.s.p[2];
      if (d.melee && Math.hypot(dx, dz) > 2.6) return;                 // stoot op afstand kan niet
    }
    v.health -= dmg; v.sinceHurt = 0;
    const from = a.s ? a.s.p : null;
    this.send(d.target, { t: 'hurt', hp: Math.max(0, v.health), from, dir: d.dir });
    this.broadcast({ t: 'flinch', id: d.target, dir: d.dir }, d.target);
    if (d.target !== 'host') this.game.onFlinch?.(d.target, d.dir);
    if (v.health <= 0) {
      v.dead = true; v.deadT = RESPAWN; v.deaths++; a.kills++;
      const msg = { t: 'kill', killer: shooter, victim: d.target, kn: a.name, vn: v.name, head: d.part === 'head', front: !!d.front };
      this.broadcast(msg);
      this.onClientData(msg);
    }
  }

  freeSpawn(except) {
    // spawnpunt zo ver mogelijk van iedereen
    let best = SPAWNS[0], bd = -1;
    for (const s of SPAWNS) {
      let md = 1e9;
      for (const [id, p] of this.players) if (id !== except && p.s && !p.dead) md = Math.min(md, Math.hypot(p.s.p[0] - s[0], p.s.p[2] - s[2]));
      if (md === 1e9) md = Math.random() * 10;
      if (md > bd) { bd = md; best = s; }
    }
    return best;
  }

  // ---------- versturen ----------
  send(id, msg) {
    if (id === 'host') { if (this.isHost) this.onClientData(msg); return; }
    const c = this.conns.get(id);
    if (c?.open) c.send(msg);
  }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); }
  toHost(msg) { if (this.isHost) this.onHostData({ peer: 'host' }, msg); else if (this.conn?.open) this.conn.send(msg); }

  // schot/stoot/herladen als effect voor de anderen
  fx(fx) {
    if (!this.active) return;
    if (this.isHost) this.broadcast({ t: 'fx', id: 'host', fx });
    else this.conn?.open && this.conn.send({ t: 'fx', fx });
  }
  hit(target, dmg, part, dir, melee, front) {
    if (!this.active) return;
    const msg = { t: 'hit', target, dmg, part, dir, melee: !!melee, front: !!front };
    if (this.isHost) this.applyHit('host', msg); else this.conn?.open && this.conn.send(msg);
  }

  // ---------- elke frame ----------
  update(dt) {
    if (!this.active) return;
    this.acc += dt;
    if (this.isHost) {
      const me = this.players.get('host');
      if (me) me.s = this.game.localState();
      for (const [id, p] of this.players) {
        p.sinceHurt += dt;
        if (!p.dead && p.sinceHurt > REGEN_DELAY && p.health < 100) p.health = Math.min(100, p.health + REGEN * dt);
        if (p.dead) {
          p.deadT -= dt;
          if (p.deadT <= 0) {
            p.dead = false; p.health = 100; p.sinceHurt = 99;
            const pos = this.freeSpawn(id);
            const msg = { t: 'respawn', id, pos };
            this.broadcast(msg);
            this.onClientData(msg);
          }
        }
      }
    }
    if (this.acc < TICK) return;
    this.acc = 0;
    if (this.isHost) {
      const list = [];
      for (const [id, p] of this.players) list.push({ id, n: p.name, s: p.s, h: Math.round(p.health), k: p.kills, d: p.deaths, x: p.dead ? 1 : 0 });
      const msg = { t: 'snap', list };
      this.broadcast(msg);
      this.game.onSnapshot?.(list);
    } else {
      this.conn?.open && this.conn.send({ t: 'state', s: this.game.localState() });
    }
  }

  // ---------- berichten die bij elke speler aankomen (host verwerkt ze ook voor zichzelf) ----------
  onClientData(d) {
    const g = this.game;
    switch (d.t) {
      case 'welcome': g.onRespawn?.(d.spawn); break;
      case 'snap': g.onSnapshot?.(d.list); break;
      case 'hurt': g.onHurt?.(d.hp, d.from); break;
      case 'flinch': g.onFlinch?.(d.id, d.dir); break;
      case 'kill': g.onKill?.(d); break;
      case 'respawn': if (d.id === this.id) g.onRespawn?.(d.pos); else g.onRemoteRespawn?.(d.id); break;
      case 'fx': g.onFx?.(d.id, d.fx); break;
      case 'joined': g.onJoined?.(d.id, d.name); break;
      case 'left': g.onLeft?.(d.id, d.name); break;
    }
  }
}
