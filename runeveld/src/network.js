/* Eldoria – multiplayer. First through our own game server on Cloudflare (server/, one WebSocket per player); if that
   fails, through a public MQTT broker. Either way every player sends their own position, and the player who has been
   online longest (the "host") simulates the monsters. Without a connection the game simply runs solo.
   SERVER_URL: the workers.dev address of the server; can be overridden with localStorage 'eldoria.server'
   (empty = no server). */

/* global mqtt -- set by the MQTT script loaded from MQTT_CDN */

export const SERVER_URL = "https://eldoria-server.zandv320.workers.dev";

/* Local testing happens in a world of its own, separate from the players on the real site. */
const IS_LOCAL_HOST = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const WORLD_NAME = IS_LOCAL_HOST ? "local" : "v1";

const TOKEN_KEY = "eldoria.token";
const SERVER_KEY = "eldoria.server";

/**
 * The account: a secret token the browser creates once; the heroes on the server belong to it.
 * @returns {string}
 */
export function accountToken() {
  let token = null;
  try {
    token = localStorage.getItem(TOKEN_KEY);
  } catch (e) {}
  if (!token || !/^[a-z0-9]{20,48}$/.test(token)) {
    token = crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join("");
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
  }
  return token;
}

export function setAccountToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, String(token).trim());
  } catch (e) {}
}

/* MQTT fallback: public brokers, tried in order. */
const BROKER_URLS = [
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];
const TOPIC = "zandv320/runeveld/v1/";
const MQTT_CDN = "https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Creates the network connection and returns the network object used by the rest of the game. */
export function createNetwork() {
  const handlers = {};
  const peers = new Map();
  const lastSeen = new Map();
  const me =
    Date.now().toString(36).padStart(9, "0") + "-" + Math.random().toString(36).slice(2, 8);

  let mqttClient = null;
  let connected = false;
  let isHost = false;
  let myPresence = {};
  let isClosed = false;
  let transportUrl = "";

  const hostListeners = [];
  const peerListeners = [];
  const connectionListeners = [];

  /* The WebSocket to our own server, if there is one; worldObstaclesFn returns the collision circles for the server. */
  let socket = null;
  let worldObstaclesFn = null;
  let requestCounter = 0;
  let isFirstWelcome = true;
  const pendingRequests = new Map();
  const heroListeners = [];
  const messageHandlers = {};
  const reconnectListeners = [];

  const callSafely = (fn, ...args) => {
    try {
      fn(...args);
    } catch (e) {
      console.error(e);
    }
  };

  const fire = (type, data, from, isMe) => {
    for (const fn of handlers[type] || []) {
      callSafely(fn, data, from, isMe);
    }
  };

  /* The player id that should host: the lowest id among the peers and me. */
  const lowestId = () => {
    let lowest = me;
    for (const id of peers.keys()) {
      if (id < lowest) {
        lowest = id;
      }
    }
    return lowest;
  };

  /* With our own server the server is the 'host' of the monsters; through MQTT it is the player with the lowest id. */
  const electHost = () => {
    const shouldHost = !socket && lowestId() === me;
    if (shouldHost !== isHost) {
      isHost = shouldHost;
      hostListeners.forEach((fn) => fn(shouldHost));
    }
  };

  const hostId = () => {
    if (socket) {
      return "server";
    }
    return lowestId();
  };

  const setConnected = (value) => {
    if (connected !== value) {
      connected = value;
      connectionListeners.forEach((fn) => fn(value));
    }
  };

  const firePeers = (leftIds = []) => {
    for (const fn of peerListeners) {
      callSafely(fn, peers, leftIds);
    }
  };

  const socketOpen = () => socket && socket.readyState === 1;

  const sendToServer = (message) => {
    if (!socketOpen()) {
      return;
    }
    try {
      socket.send(JSON.stringify(message));
    } catch (e) {}
  };

  /* Sends a presence, left or event message to the other players over whichever transport is up. */
  function publish(kind, message) {
    if (socketOpen()) {
      if (kind === "presence") {
        socket.send(JSON.stringify({ kind: "presence", presence: message.presence }));
      } else if (kind === "event") {
        socket.send(
          JSON.stringify({
            kind: "event",
            type: message.type,
            data: message.data,
            to: message.to,
          }),
        );
      }
      return;
    }
    if (mqttClient && mqttClient.connected) {
      mqttClient.publish(TOPIC + kind, JSON.stringify(message), { qos: 0 });
    }
  }

  /* A message from another player, from whichever source: presence, left, or event. */
  function handlePeerMessage(kind, message) {
    if (
      !message ||
      typeof message !== "object" ||
      typeof message.from !== "string" ||
      message.from === me
    ) {
      return;
    }
    if (message.from === "server") {
      if (kind === "event") {
        if (message.to && message.to !== me) {
          return;
        }
        fire(message.type, message.data, "server", false);
      }
      return;
    }
    lastSeen.set(message.from, Date.now());
    if (kind === "presence") {
      /* Without a name someone is still on the character select screen. */
      if (!message.presence || !message.presence.name) {
        return;
      }
      const isNew = !peers.has(message.from);
      peers.set(message.from, message.presence || {});
      if (isNew) {
        electHost();
      }
      firePeers();
    } else if (kind === "left") {
      if (peers.delete(message.from)) {
        lastSeen.delete(message.from);
        electHost();
        firePeers([message.from]);
      }
    } else if (kind === "event") {
      if (!peers.has(message.from)) {
        peers.set(message.from, {});
        electHost();
        firePeers();
      }
      if (message.to && message.to !== me) {
        return;
      }
      fire(message.type, message.data, message.from, false);
    }
  }

  const serverUrl = () => {
    let url = SERVER_URL;
    try {
      const override = localStorage.getItem(SERVER_KEY);
      if (override !== null) {
        url = override;
      }
    } catch (e) {}
    return url.replace(/\/$/, "");
  };

  const sendWorldObstacles = (target) => {
    try {
      target.send(JSON.stringify({ kind: "world_obstacles", obstacles: worldObstaclesFn() }));
    } catch (e) {}
  };

  /* Handles one message from our own server on socket `target`; `settle` resolves the pending connect. */
  function handleServerMessage(target, message, settle) {
    if (message.kind === "welcome") {
      settle(true);
      for (const player of message.players || []) {
        handlePeerMessage("presence", { from: player.from, presence: player.presence });
      }
      electHost();
      setConnected(true);
      if (worldObstaclesFn) {
        sendWorldObstacles(target);
      }
      if (!isFirstWelcome) {
        reconnectListeners.forEach((fn) => callSafely(fn));
      }
      isFirstWelcome = false;
    } else if (message.kind === "presence" || message.kind === "left" || message.kind === "event") {
      handlePeerMessage(message.kind, message);
    } else if (message.requestId !== undefined && pendingRequests.has(message.requestId)) {
      const pending = pendingRequests.get(message.requestId);
      pendingRequests.delete(message.requestId);
      clearTimeout(pending.timer);
      pending.resolve(message);
    } else if (message.kind === "hero" && message.hero) {
      heroListeners.forEach((fn) => callSafely(fn, message.hero));
    } else if (messageHandlers[message.kind]) {
      callSafely(messageHandlers[message.kind], message);
    }
  }

  /* Our own server: connect, say hello, and on a break retry with a growing delay. Resolves true once welcomed. */
  function connectServer(url) {
    return new Promise((resolve) => {
      let isSettled = false;
      let target;
      try {
        target = new WebSocket(url.replace(/^http/, "ws") + "/ws?world=" + WORLD_NAME);
      } catch (e) {
        return resolve(false);
      }
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            target.close();
          } catch (e) {}
          resolve(false);
        }
      }, 8000);
      const settle = (value) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeout);
          resolve(value);
        }
      };

      target.onopen = () => {
        socket = target;
        target.send(
          JSON.stringify({
            kind: "hello",
            from: me,
            presence: myPresence,
            token: accountToken(),
          }),
        );
      };
      target.onmessage = (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (!message || typeof message !== "object") {
          return;
        }
        handleServerMessage(target, message, settle);
      };
      const onClosed = () => {
        if (socket === target) {
          socket = null;
        }
        for (const pending of pendingRequests.values()) {
          clearTimeout(pending.timer);
          pending.resolve(null);
        }
        pendingRequests.clear();
        electHost();
        setConnected(false);
        if (!isSettled) {
          settle(false);
        } else if (!isClosed) {
          reconnect();
        }
      };
      target.onclose = onClosed;
      target.onerror = () => {
        try {
          target.close();
        } catch (e) {}
      };
    });
  }

  let reconnectDelay = 2000;
  async function reconnect() {
    const url = serverUrl();
    if (!url) {
      return;
    }
    while (!isClosed && !socket) {
      await wait(reconnectDelay);
      reconnectDelay = Math.min(30000, reconnectDelay * 1.6);
      /* The players we knew are gone until they announce themselves again. */
      const leftIds = [...peers.keys()];
      peers.clear();
      lastSeen.clear();
      if (leftIds.length) {
        electHost();
        firePeers(leftIds);
      }
      if (await connectServer(url)) {
        reconnectDelay = 2000;
      }
    }
  }

  /* MQTT fallback: connect to one broker. Resolves the client, or null when it does not answer in time. */
  function connectBroker(url) {
    return new Promise((resolve) => {
      let isSettled = false;
      const client = mqtt.connect(url, {
        clientId: "rv_" + me.replace(/[^a-z0-9]/g, ""),
        clean: true,
        keepalive: 20,
        reconnectPeriod: 3000,
        connectTimeout: 8000,
        will: {
          topic: TOPIC + "left",
          payload: JSON.stringify({ from: me }),
          qos: 0,
          retain: false,
        },
      });
      const timeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          try {
            client.end(true);
          } catch (e) {}
          resolve(null);
        }
      }, 9000);
      client.on("connect", () => {
        client.subscribe(TOPIC + "#", { qos: 0 }, () => {
          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeout);
            resolve(client);
          }
          setConnected(true);
          publish("presence", { from: me, presence: myPresence });
        });
      });
      client.on("close", () => setConnected(false));
      client.on("offline", () => setConnected(false));
      client.on("error", () => {});
      client.on("message", (topic, buffer) => {
        let message;
        try {
          message = JSON.parse(buffer.toString());
        } catch (e) {
          return;
        }
        handlePeerMessage(topic.slice(TOPIC.length), message);
      });
    });
  }

  (async function start() {
    const url = serverUrl();
    /* Our own server first; if that fails, the public brokers. */
    if (url && (await connectServer(url))) {
      transportUrl = url;
      return;
    }
    /* Without a server: alone means host. */
    electHost();
    try {
      if (typeof mqtt === "undefined") {
        await loadScript(MQTT_CDN);
      }
    } catch (e) {}
    while (!isClosed) {
      if (typeof mqtt !== "undefined") {
        for (const brokerUrl of BROKER_URLS) {
          mqttClient = await connectBroker(brokerUrl);
          if (mqttClient) {
            transportUrl = brokerUrl;
            break;
          }
        }
      }
      if (mqttClient) {
        return;
      }
      await wait(20000);
    }
  })();

  /* Heartbeat, and clean up players that went quiet. */
  setInterval(() => {
    if (isClosed) {
      return;
    }
    publish("presence", { from: me, presence: myPresence });
    const now = Date.now();
    const leftIds = [];
    const silenceLimit = socket ? 25000 : 8000;
    for (const [id, time] of lastSeen) {
      if (now - time > silenceLimit) {
        lastSeen.delete(id);
        if (peers.delete(id)) {
          leftIds.push(id);
        }
      }
    }
    if (leftIds.length) {
      electHost();
      firePeers(leftIds);
    }
  }, 1500);

  /* The server answers pings without waking up; this keeps the connection open. */
  setInterval(() => {
    if (socketOpen()) {
      socket.send('{"kind":"ping"}');
    }
  }, 20000);

  addEventListener("pagehide", () => {
    isClosed = true;
    try {
      publish("left", { from: me });
      if (mqttClient) {
        mqttClient.end(true);
      }
      if (socket) {
        socket.close(1000, "bye");
      }
    } catch (e) {}
  });

  return {
    me,
    peers,
    transport: () => transportUrl,
    isConnected: () => connected,
    isHost: () => isHost,
    hostId,
    playerCount: () => peers.size + 1,
    onHost(fn) {
      hostListeners.push(fn);
    },
    onPeers(fn) {
      peerListeners.push(fn);
    },
    onConnection(fn) {
      connectionListeners.push(fn);
    },
    on(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    /** Sends to everyone (or to one player) and also handles the message locally right away. */
    send(type, data, to) {
      publish("event", { from: me, type, data, to });
      if (!to || to === me) {
        fire(type, data, me, true);
      }
    },
    setPresence(presence, sendNow = false) {
      myPresence = presence;
      if (sendNow) {
        publish("presence", { from: me, presence });
      }
    },
    setWorldObstacles(fn) {
      worldObstaclesFn = fn;
      if (socketOpen()) {
        sendWorldObstacles(socket);
      }
    },
    usesServer: () => !!socket,
    worldName: WORLD_NAME,
    /**
     * A request to the server that expects an answer (load, create or play heroes).
     * Resolves null when there is no server or it stays silent.
     */
    request(message, timeoutMs = 5000) {
      return new Promise((resolve) => {
        if (!socketOpen()) {
          return resolve(null);
        }
        const requestId = ++requestCounter;
        const timer = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve(null);
        }, timeoutMs);
        pendingRequests.set(requestId, { resolve, timer });
        try {
          socket.send(JSON.stringify({ ...message, requestId }));
        } catch (e) {
          pendingRequests.delete(requestId);
          clearTimeout(timer);
          resolve(null);
        }
      });
    },
    /** A hero action (stat, skill, buy, quest, ...): the server applies the rules and sends the record back. */
    heroAction(type, data) {
      sendToServer({ kind: "hero_action", type, data });
    },
    /**
     * A profession action (gather, craft, refine, enchant, disenchant, use): the server rolls the dice and answers
     * {kind: 'hero', hero, result} or {kind: 'action_result', result}. Resolves null without an answer.
     */
    professionAction(type, data) {
      return this.request({ kind: "hero_action", type, data }, 8000);
    },
    saveHero(hero) {
      sendToServer({ kind: "save_hero", hero });
    },
    onHero(fn) {
      heroListeners.push(fn);
    },
    /** Other messages from the server (party_state, party_invite, error, ...). */
    onMessage(kind, fn) {
      messageHandlers[kind] = fn;
    },
    /** After a reconnect (the server restarted) the hero has to announce itself again. */
    onReconnect(fn) {
      reconnectListeners.push(fn);
    },
    party(action, data) {
      sendToServer({ kind: "party", action, ...(data || {}) });
    },
  };
}
