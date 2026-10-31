/* Eldoria – game server: a Worker that hands every connection to the Durable Object of its world.
   The World object holds all WebSockets (with the hibernation API, so it costs nothing while nobody plays) and relays
   the players' messages:
     client → server  {kind:'hello', from, presence, token}  sign in with an own id, status and account token
                      {kind:'presence', presence}            status (position, appearance, hp, ...)
                      {kind:'event', type, data, to?}        an event for everyone or for one player
                      {kind:'ping'}                          answered without waking the object
     server → client  {kind:'welcome', players:[{from, presence}], time}  on sign-in: who is already here
                      {kind:'presence', from, presence}  {kind:'left', from}  {kind:'event', from, type, data}
                      {kind:'pong'}
   The monsters live here (simulation.js): while players are connected the simulation ticks five times per second and
   everyone receives snapshots ('monsters'), attacks ('monster_attack') and kills ('kill') as events from 'server'.
   Players report their hits ('hit'), freezes ('freeze') and provocations ('provoke'). The client sends the world's
   collision shapes ({kind:'world_obstacles', obstacles:[[x, z, r] or [x, z, r, hw, hd, cos, sin], ...]}: circles
   and turned boxes, rules/collision.js) because the world is built in the browser.
   Heroes live in HeroStore (hero-store.js); this object forwards hero requests to it over RPC. Profession actions
   (gather, craft, refine, enchant, disenchant, use) are checked here first (is the hero at the node or station?);
   gathered nodes stay depleted for everyone ('node_state' events, 'node_states' on joining). */
/* global WebSocketPair, WebSocketRequestResponsePair */
import { DurableObject } from "cloudflare:workers";
import { createSimulation } from "./simulation.js";
import { isValidToken, isValidHeroName, LEGACY_STORAGE_PREFIX } from "./hero-store.js";
import { maxDamage } from "../../runeveld/src/rules/progression.js";
import {
  RESOURCES,
  RECIPES,
  PROFESSIONS,
  USE_DISTANCE,
  stationNear,
} from "../../runeveld/src/rules/professions.js";
import { GATHER_NODES } from "../../runeveld/src/rules/gather-nodes.js";

export { Accounts } from "./accounts.js";
export { HeroStore } from "./hero-store.js";

const MAX_MESSAGE_SIZE = 16 * 1024;
const MAX_WORLD_MESSAGE_SIZE = 512 * 1024;
const MAX_OBSTACLES = 6000;
const MAX_EVENT_TYPE_LENGTH = 16;
const TICK_MS = 200;
const MAX_TICK_SECONDS = 0.5;
/* damage cap for a hit by someone who has not picked a hero yet */
const DEFAULT_MAX_DAMAGE = 400;
const MAX_PARTY_SIZE = 6;
const INVITE_LIFETIME_MS = 60000;
/* party members within this distance of a kill share its exp and zeny */
const SHARE_DISTANCE = 40;
/* every extra party member adds 10% to the total exp */
const PARTY_EXP_BONUS = 0.1;
const SERVER_ID = "server";
const DEFAULT_WORLD = "v1";
const OBSTACLES_KEY = "obstacles";
/* the obstacles were stored under this key before the English refactor */
const LEGACY_OBSTACLES_KEY = "obst";
const PLAYER_ID_PATTERN = /^[a-z0-9-]{6,40}$/;

const HERO_MESSAGE_KINDS = new Set([
  "load_heroes",
  "import_heroes",
  "create_hero",
  "delete_hero",
  "play_hero",
  "save_hero",
  "hero_action",
]);
/* only the server decides about monsters */
const SERVER_ONLY_EVENTS = new Set(["monsters", "monster_attack", "kill", "node_state"]);
/* hero actions of the professions: the World checks where the hero stands, HeroStore rolls the dice */
const PROFESSION_ACTIONS = new Set(["gather", "craft", "refine", "enchant", "disenchant", "use"]);
/* a little slack on the distance to a node or station, for the delay of the position updates */
const USE_DISTANCE_SLACK = 1.5;

const isObject = (value) => Boolean(value) && typeof value === "object";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });

function trySend(ws, message) {
  try {
    ws.send(typeof message === "string" ? message : JSON.stringify(message));
  } catch {
    /* the socket closed in the meantime */
  }
}

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    /* answer pings without waking the object */
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"kind":"ping"}', '{"kind":"pong"}'),
    );
    this.simulation = createSimulation((type, data) => this.#onSimulationEvent(type, data));
    /* parties only live as long as the object does */
    this.parties = new Map();
    /* invited player id → {partyId, from, time} */
    this.invites = new Map();
    this.partyCounter = 0;
    /* gathering node id → time (ms) at which it grows back */
    this.depletedNodes = new Map();
    /* player id → time (ms) of their last gather */
    this.lastGather = new Map();
    this.version = (env.VERSION && env.VERSION.id) || "";
    this.loop = null;
    this.lastTick = 0;
    this.ctx.blockConcurrencyWhile(async () => {
      const obstacles =
        (await this.ctx.storage.get(OBSTACLES_KEY)) ||
        (await this.ctx.storage.get(LEGACY_OBSTACLES_KEY));
      if (obstacles) {
        this.simulation.setObstacles(obstacles);
      }
    });
  }

  /** RPC for HeroStore: the heroes this world kept for a token before HeroStore existed, or null. */
  async legacyHeroes(token) {
    if (!isValidToken(token)) {
      return null;
    }
    return (await this.ctx.storage.get(LEGACY_STORAGE_PREFIX + token)) ?? null;
  }

  #heroStore() {
    return this.env.HEROES.get(this.env.HEROES.idFromName("main"));
  }

  /* the players as the simulation sees them, from the presence everyone sends along */
  #simulationPlayers() {
    const players = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment || !attachment.id || !attachment.presence || !attachment.presence.name) {
        continue;
      }
      const presence = attachment.presence;
      players.push({
        id: attachment.id,
        x: +presence.x || 0,
        z: +presence.z || 0,
        isDead: Boolean(presence.dead),
      });
    }
    return players;
  }

  /* the simulation only runs while someone is here; afterwards the object can sleep */
  #startLoop() {
    if (this.loop || !this.simulation.hasObstacles()) {
      return;
    }
    this.simulation.spawn(this.#simulationPlayers());
    this.lastTick = Date.now();
    this.loop = setInterval(() => {
      const players = this.#simulationPlayers();
      if (!players.length) {
        clearInterval(this.loop);
        this.loop = null;
        return;
      }
      const now = Date.now();
      const dt = Math.min(MAX_TICK_SECONDS, (now - this.lastTick) / 1000);
      this.lastTick = now;
      this.simulation.tick(dt, players);
      this.#broadcast(null, this.#serverEvent("monsters", this.simulation.snapshot()));
    }, TICK_MS);
  }

  #serverEvent(type, data) {
    return { kind: "event", from: SERVER_ID, type, data };
  }

  /* starts the loop if it can and gives a new player the monsters right away */
  #startLoopFor(ws) {
    this.#startLoop();
    if (this.loop) {
      trySend(ws, this.#serverEvent("monsters", this.simulation.snapshot()));
    }
  }

  #onSimulationEvent(type, data) {
    const payload = type === "kill" ? this.#withShares(data) : data;
    this.#broadcast(null, this.#serverEvent(type, payload));
    if (type === "kill") {
      this.#rewardKill(payload);
    }
  }

  async fetch(request) {
    /* an object that is already running keeps the old code after a deploy for as long as players are connected; when
       the Worker (always new) reports a different version, the object restarts and the players reconnect */
    const deployedVersion = request.headers.get("x-version");
    if (deployedVersion && this.version && deployedVersion !== this.version) {
      setTimeout(() => this.ctx.abort(), 50);
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return this.#status(request);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: null, presence: null, connectedAt: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }

  #status(request) {
    const players = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (!attachment || !attachment.id) {
        continue;
      }
      const presence = attachment.presence || {};
      players.push({ id: attachment.id, name: presence.name, level: presence.level });
    }
    return json({
      world: new URL(request.url).searchParams.get("world") || DEFAULT_WORLD,
      version: this.version,
      online: players.length,
      players,
    });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_WORLD_MESSAGE_SIZE) {
      return;
    }
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isObject(message)) {
      return;
    }
    const attachment = ws.deserializeAttachment() || {};

    if (message.kind === "hello") {
      this.#hello(ws, attachment, message);
      return;
    }
    if (!attachment.id) {
      return;
    }
    if (message.kind === "party") {
      this.#handleParty(ws, attachment, message);
      return;
    }
    if (HERO_MESSAGE_KINDS.has(message.kind)) {
      await this.#handleHeroMessage(ws, attachment, message);
      return;
    }
    if (message.kind === "world_obstacles") {
      this.#setWorldObstacles(ws, message);
      return;
    }
    if (raw.length > MAX_MESSAGE_SIZE) {
      return;
    }
    if (message.kind === "presence") {
      attachment.presence = isObject(message.presence) ? message.presence : {};
      ws.serializeAttachment(attachment);
      this.#broadcast(ws, { kind: "presence", from: attachment.id, presence: attachment.presence });
      return;
    }
    if (
      message.kind === "event" &&
      typeof message.type === "string" &&
      message.type.length <= MAX_EVENT_TYPE_LENGTH
    ) {
      this.#handleEvent(ws, attachment, message);
    }
  }

  #hello(ws, attachment, message) {
    if (typeof message.from !== "string" || !PLAYER_ID_PATTERN.test(message.from)) {
      return;
    }
    attachment.id = message.from;
    attachment.presence = isObject(message.presence) ? message.presence : {};
    attachment.token = isValidToken(message.token) ? message.token : null;
    attachment.heroName = null;
    attachment.maxDamage = null;
    ws.serializeAttachment(attachment);

    const players = [];
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) {
        continue;
      }
      const otherAttachment = other.deserializeAttachment();
      if (otherAttachment && otherAttachment.id) {
        players.push({ from: otherAttachment.id, presence: otherAttachment.presence });
      }
    }
    trySend(ws, { kind: "welcome", players, time: Date.now() });
    trySend(ws, { kind: "node_states", nodes: this.#depletedNodeList() });
    this.#broadcast(ws, { kind: "presence", from: attachment.id, presence: attachment.presence });
    this.#startLoopFor(ws);
  }

  /* the world's collision circles, sent once per version of the world */
  #setWorldObstacles(ws, message) {
    if (!Array.isArray(message.obstacles) || message.obstacles.length > MAX_OBSTACLES) {
      return;
    }
    const isFirst = !this.simulation.hasObstacles();
    this.simulation.setObstacles(message.obstacles);
    this.ctx.storage.put(OBSTACLES_KEY, message.obstacles);
    if (isFirst) {
      this.#startLoopFor(ws);
    }
  }

  #handleEvent(ws, attachment, message) {
    if (SERVER_ONLY_EVENTS.has(message.type)) {
      return;
    }
    const data = isObject(message.data) ? message.data : {};
    let outgoingData = message.data;

    if (message.type === "hit") {
      /* nobody hits harder than their hero can */
      const cap = attachment.heroName ? attachment.maxDamage : DEFAULT_MAX_DAMAGE;
      const damage = Math.min(+data.damage || 0, cap ?? DEFAULT_MAX_DAMAGE);
      outgoingData = { ...data, damage };
      this.simulation.hit(String(data.id), damage, attachment.id);
      if (data.pushX !== undefined) {
        this.simulation.knockback(String(data.id), +data.pushX, +data.pushZ, +data.force);
      }
    } else if (message.type === "freeze") {
      const ids = Array.isArray(data.ids) ? data.ids.map(String) : [];
      this.simulation.freeze(ids, +data.duration);
    } else if (message.type === "provoke") {
      this.simulation.provoke(+data.x, +data.z, +data.radius, attachment.id);
      return;
    }

    const outgoing = JSON.stringify({
      kind: "event",
      from: attachment.id,
      type: message.type,
      data: outgoingData,
    });
    if (typeof message.to === "string") {
      const recipient = this.#findSocket(message.to);
      if (recipient) {
        trySend(recipient.ws, outgoing);
      }
    } else {
      this.#broadcast(ws, outgoing);
    }
  }

  /* re-reads the attachment before writing, so a presence update made during an await is not lost */
  #updateAttachment(ws, changes) {
    try {
      const attachment = ws.deserializeAttachment() || {};
      ws.serializeAttachment({ ...attachment, ...changes });
    } catch {
      /* the socket closed in the meantime */
    }
  }

  /* a fresh hero record came back: keep its damage cap, if this socket still plays that hero */
  #refreshMaxDamage(ws, hero) {
    try {
      const attachment = ws.deserializeAttachment();
      if (attachment && attachment.heroName === hero.name) {
        this.#updateAttachment(ws, { maxDamage: maxDamage(hero) });
      }
    } catch {
      /* the socket closed in the meantime */
    }
  }

  /* heroes and actions of an account; the reply carries the request id so the client can match it */
  async #handleHeroMessage(ws, attachment, message) {
    const reply = (payload) => trySend(ws, { ...payload, requestId: message.requestId });
    const replyHeroes = (roster) =>
      reply({ kind: "heroes", heroes: roster.heroes, last: roster.last });
    const token = attachment.token;
    if (!token) {
      reply({ kind: "error", error: "no_token" });
      return;
    }
    const store = this.#heroStore();
    try {
      switch (message.kind) {
        case "load_heroes":
          replyHeroes(await store.load(token));
          break;
        case "import_heroes":
          replyHeroes(await store.importHeroes(token, message.heroes));
          break;
        case "create_hero":
          replyHeroes(await store.create(token, message.hero));
          break;
        case "delete_hero":
          replyHeroes(await store.remove(token, String(message.name)));
          break;
        case "play_hero":
          await this.#playHero(ws, token, message.name, reply);
          break;
        case "save_hero":
          if (attachment.heroName) {
            await store.save(token, attachment.heroName, message.hero);
          } else {
            reply({ kind: "error", error: "no_hero" });
          }
          break;
        case "hero_action": {
          if (!attachment.heroName) {
            reply({ kind: "error", error: "no_hero" });
            return;
          }
          if (PROFESSION_ACTIONS.has(message.type)) {
            await this.#professionAction(ws, attachment, message, reply);
            return;
          }
          const hero = await store.action(
            token,
            attachment.heroName,
            String(message.type),
            message.data,
          );
          if (hero) {
            this.#refreshMaxDamage(ws, hero);
            reply({ kind: "hero", hero });
          }
          break;
        }
      }
    } catch {
      reply({ kind: "error", error: "server_error" });
    }
  }

  /* ---- professions: gathering nodes and crafting stations ---- */

  #depletedNodeList() {
    const now = Date.now();
    const list = [];
    for (const [id, until] of this.depletedNodes) {
      if (until <= now) {
        this.depletedNodes.delete(id);
      } else {
        list.push({ id, respawnIn: +((until - now) / 1000).toFixed(1) });
      }
    }
    return list;
  }

  /* Where must the hero stand for this action? Returns a reason when they are in the wrong place, else "". */
  #placeProblem(attachment, type, data) {
    const presence = attachment.presence || {};
    const x = +presence.x;
    const z = +presence.z;
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return "Where are you?";
    }
    let stationKind = null;
    if (type === "gather") {
      const node = GATHER_NODES[String(data.node)];
      if (!node) {
        return "Nothing to gather here.";
      }
      if (Math.hypot(node.x - x, node.z - z) > USE_DISTANCE + USE_DISTANCE_SLACK) {
        return "Too far away.";
      }
      if ((this.depletedNodes.get(node.id) || 0) > Date.now()) {
        return "Someone got here first.";
      }
      return "";
    }
    if (type === "craft") {
      const recipe = RECIPES[String(data.recipe)];
      stationKind = recipe ? PROFESSIONS[recipe.profession].station : null;
    } else if (type === "refine" || type === "enchant" || type === "disenchant") {
      stationKind = "enchanting_altar";
    } else {
      return "";
    }
    if (!stationKind) {
      return "Unknown recipe.";
    }
    return stationNear(stationKind, x, z) ? "" : "You need to stand at the right station.";
  }

  async #professionAction(ws, attachment, message, reply) {
    const type = String(message.type);
    const data = isObject(message.data) ? message.data : {};
    const problem = this.#placeProblem(attachment, type, data);
    if (problem) {
      reply({ kind: "action_result", result: { ok: false, reason: problem } });
      return;
    }
    const now = Date.now();
    const context = {};
    let node = null;
    if (type === "gather") {
      node = GATHER_NODES[String(data.node)];
      context.sinceLastGather = now - (this.lastGather.get(attachment.id) || 0);
      data.resource = node.resource;
    }
    const response = await this.#heroStore().profession(
      attachment.token,
      attachment.heroName,
      type,
      data,
      context,
    );
    if (!response) {
      reply({ kind: "error", error: "unknown_hero" });
      return;
    }
    if (node && response.result.ok) {
      this.lastGather.set(attachment.id, now);
      /* the same node can be taken twice when two players finish at once; the first one depletes it */
      if ((this.depletedNodes.get(node.id) || 0) <= now) {
        const respawn = RESOURCES[node.resource].respawn;
        this.depletedNodes.set(node.id, now + respawn * 1000);
        this.#broadcast(null, this.#serverEvent("node_state", { id: node.id, respawnIn: respawn }));
      }
    }
    this.#refreshMaxDamage(ws, response.hero);
    reply({ kind: "hero", hero: response.hero, result: response.result });
  }

  async #playHero(ws, token, name, reply) {
    const roster = await this.#heroStore().load(token);
    const hero = isValidHeroName(name) ? roster.heroes.find((h) => h.name === name) : null;
    if (!hero) {
      reply({ kind: "error", error: "unknown_hero" });
      return;
    }
    this.#updateAttachment(ws, { heroName: hero.name, maxDamage: maxDamage(hero) });
    reply({ kind: "hero", hero });
  }

  /* ---- parties: invite, accept, leave, kick; members share exp (with a bonus) and zeny ---- */

  #findSocket(playerId) {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment();
      if (attachment && attachment.id === playerId) {
        return { ws, attachment };
      }
    }
    return null;
  }

  #partyOf(playerId) {
    for (const party of this.parties.values()) {
      if (party.members.includes(playerId)) {
        return party;
      }
    }
    return null;
  }

  #sendPartyState(party) {
    const members = party.members.map((id) => {
      const socket = this.#findSocket(id);
      const presence = (socket && socket.attachment.presence) || {};
      return {
        id,
        name: presence.name || "?",
        classId: presence.classId || "swordsman",
        level: presence.level || 1,
      };
    });
    const message = JSON.stringify({
      kind: "party_state",
      party: { id: party.id, leader: party.leader, members },
    });
    for (const id of party.members) {
      const socket = this.#findSocket(id);
      if (socket) {
        trySend(socket.ws, message);
      }
    }
  }

  #leaveParty(playerId) {
    const party = this.#partyOf(playerId);
    if (!party) {
      return;
    }
    party.members = party.members.filter((id) => id !== playerId);
    const socket = this.#findSocket(playerId);
    if (socket) {
      trySend(socket.ws, { kind: "party_state", party: null });
    }
    if (!party.members.length) {
      this.parties.delete(party.id);
      return;
    }
    if (party.leader === playerId) {
      party.leader = party.members[0];
    }
    this.#sendPartyState(party);
  }

  #handleParty(ws, attachment, message) {
    const info = (text) => trySend(ws, { kind: "party_info", text });
    switch (message.action) {
      case "invite":
        this.#invite(attachment, String(message.target), info);
        break;
      case "accept":
        this.#acceptInvite(attachment, info);
        break;
      case "decline":
        this.#declineInvite(attachment);
        break;
      case "leave":
        this.#leaveParty(attachment.id);
        break;
      case "kick":
        this.#kick(attachment, String(message.member));
        break;
    }
  }

  #invite(attachment, targetId, info) {
    const target = this.#findSocket(targetId);
    if (
      !target ||
      target.attachment.id === attachment.id ||
      !target.attachment.presence ||
      !target.attachment.presence.name
    ) {
      info("That player is not here.");
      return;
    }
    const targetName = target.attachment.presence.name;
    if (this.#partyOf(target.attachment.id)) {
      info(`${targetName} is already in a party.`);
      return;
    }
    let party = this.#partyOf(attachment.id);
    if (!party) {
      this.partyCounter++;
      party = { id: "p" + this.partyCounter, leader: attachment.id, members: [attachment.id] };
      this.parties.set(party.id, party);
      this.#sendPartyState(party);
    } else if (party.leader !== attachment.id) {
      info("Only the party leader can invite.");
      return;
    }
    if (party.members.length >= MAX_PARTY_SIZE) {
      info(`The party is full (${MAX_PARTY_SIZE}).`);
      return;
    }
    this.invites.set(target.attachment.id, {
      partyId: party.id,
      from: attachment.id,
      time: Date.now(),
    });
    const inviterName = (attachment.presence && attachment.presence.name) || "?";
    trySend(target.ws, {
      kind: "party_invite",
      from: { id: attachment.id, name: inviterName },
      partyId: party.id,
    });
    info(`You invited ${targetName} to your party.`);
  }

  #acceptInvite(attachment, info) {
    const invite = this.invites.get(attachment.id);
    if (!invite || Date.now() - invite.time > INVITE_LIFETIME_MS) {
      info("That invitation has expired.");
      return;
    }
    this.invites.delete(attachment.id);
    const party = this.parties.get(invite.partyId);
    if (!party || party.members.length >= MAX_PARTY_SIZE) {
      info("That party no longer exists.");
      return;
    }
    this.#leaveParty(attachment.id);
    party.members.push(attachment.id);
    this.#sendPartyState(party);
  }

  #declineInvite(attachment) {
    const invite = this.invites.get(attachment.id);
    this.invites.delete(attachment.id);
    if (!invite) {
      return;
    }
    const inviter = this.#findSocket(invite.from);
    if (inviter) {
      const name = (attachment.presence && attachment.presence.name) || "Someone";
      trySend(inviter.ws, { kind: "party_info", text: `${name} declined your invitation.` });
    }
  }

  #kick(attachment, memberId) {
    const party = this.#partyOf(attachment.id);
    if (!party || party.leader !== attachment.id) {
      return;
    }
    if (party.members.includes(memberId) && memberId !== attachment.id) {
      this.#leaveParty(memberId);
    }
  }

  /* each nearby party member's share of a kill's exp and zeny; together they earn 10% extra per extra member */
  #withShares(kill) {
    const shares = {};
    const party = this.#partyOf(kill.killer);
    if (!party) {
      shares[kill.killer] = { exp: kill.exp, zeny: kill.zeny };
      return { ...kill, shares };
    }
    const nearby = party.members.filter((id) => {
      const socket = this.#findSocket(id);
      const presence = socket && socket.attachment.presence;
      if (!presence || !presence.name || presence.dead) {
        return false;
      }
      const distance = Math.hypot((+presence.x || 0) - kill.x, (+presence.z || 0) - kill.z);
      return distance <= SHARE_DISTANCE;
    });
    if (!nearby.includes(kill.killer)) {
      nearby.push(kill.killer);
    }
    const count = nearby.length;
    const bonus = 1 + PARTY_EXP_BONUS * (count - 1);
    for (const id of nearby) {
      shares[id] = {
        exp: Math.round((kill.exp * bonus) / count),
        zeny: Math.round(kill.zeny / count),
      };
    }
    return { ...kill, shares };
  }

  /* a monster died: everyone with a share gets exp and zeny on their record; the loot goes to the killer */
  async #rewardKill(kill) {
    const monsterId = String(kill.id).split("#")[0];
    for (const [playerId, share] of Object.entries(kill.shares || {})) {
      const socket = this.#findSocket(playerId);
      if (!socket || !socket.attachment.token || !socket.attachment.heroName) {
        continue;
      }
      try {
        const hero = await this.#heroStore().rewardKill(
          socket.attachment.token,
          socket.attachment.heroName,
          {
            monsterId,
            exp: share.exp,
            zeny: share.zeny,
            loot: playerId === kill.killer ? kill.loot : null,
            material: playerId === kill.killer ? kill.material : null,
          },
        );
        if (hero) {
          this.#refreshMaxDamage(socket.ws, hero);
          socket.ws.send(JSON.stringify({ kind: "hero", hero }));
        }
      } catch {
        /* the player keeps playing; this reward is lost */
      }
    }
  }

  webSocketClose(ws) {
    this.#disconnect(ws);
  }

  webSocketError(ws) {
    this.#disconnect(ws);
  }

  #disconnect(ws) {
    const attachment = ws.deserializeAttachment();
    try {
      ws.close(1000, "bye");
    } catch {
      /* already closed */
    }
    if (attachment && attachment.id) {
      this.#leaveParty(attachment.id);
      this.invites.delete(attachment.id);
      this.#broadcast(ws, { kind: "left", from: attachment.id });
    }
  }

  /* sends to everyone except `sender` */
  #broadcast(sender, message) {
    const text = typeof message === "string" ? message : JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== sender) {
        trySend(ws, text);
      }
    }
  }
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (url.pathname.startsWith("/account/")) {
      const accounts = env.ACCOUNTS.get(env.ACCOUNTS.idFromName("main"));
      const response = await accounts.fetch(request);
      return new Response(response.body, {
        status: response.status,
        headers: { ...CORS_HEADERS, "content-type": "application/json" },
      });
    }
    if (url.pathname === "/ws" || url.pathname === "/status") {
      const worldName = (url.searchParams.get("world") || DEFAULT_WORLD).slice(0, 32);
      const world = env.WORLD.get(env.WORLD.idFromName(worldName));
      const forwarded = new Request(request);
      forwarded.headers.set("x-version", (env.VERSION && env.VERSION.id) || "");
      return world.fetch(forwarded);
    }
    return new Response(
      "Eldoria: Chronicles of Magic – game server. Connect to /ws, status at /status.",
      { headers: { "content-type": "text/plain", "access-control-allow-origin": "*" } },
    );
  },
};
