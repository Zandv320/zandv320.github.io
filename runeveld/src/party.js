/* Eldoria – parties: a group of up to six, with shared exp and zeny (server/src/index.js does the sharing).
   This is the HUD side: the party frame with the members and their hp, invitations (popup at the top), the player
   card when you click another player, and the chat commands /invite, /leave and /kick. Only with our own server. */
import { icon } from "./icons.js";
import { CLASSES } from "./data.js";
import * as UI from "./ui.js";

const $ = (selector) => document.querySelector(selector);
const escapeHtml = UI.escapeHtml;

const MAX_PARTY_SIZE = 6;
const INVITE_TIMEOUT_MS = 60000;

/**
 * @param {{network: object, player: object, peers: Map}} deps
 */
export function createParty({ network, player, peers }) {
  const frame = $("#party-frame");
  const playerCard = $("#player-card");
  const invitePopup = $("#party-invite");
  let party = null;
  let hpRefreshTimer = 0;
  let inviteTimer = null;

  const isMember = (id) => !!party && party.members.some((member) => member.id === id);
  const members = () => new Set(party ? party.members.map((member) => member.id) : []);
  const isLeader = () => !!party && party.leader === network.me;

  /* [hp, hpMax] of a party member, or null when we do not know it. */
  function hpOf(id) {
    if (id === network.me) {
      return [player.hp, player.hpMax ? player.hpMax() : player.hp];
    }
    const peer = peers.get(id);
    return peer && peer.presence ? [peer.presence.hp || 0, peer.presence.hpMax || 1] : null;
  }

  function renderMember(member) {
    const hp = hpOf(member.id);
    const isSelf = member.id === network.me;
    const isAway = !isSelf && !peers.has(member.id);
    const crown =
      party.leader === member.id ? ' <span class="crown" title="Party leader">♛</span>' : "";
    const kickButton =
      isLeader() && !isSelf
        ? ` <button data-party-action="kick" data-member="${member.id}" title="Remove from party">✕</button>`
        : "";
    const status = isAway ? "away" : hp ? Math.ceil(hp[0]) + " / " + hp[1] : "";
    const hpPercent = hp ? Math.max(0, Math.min(100, (hp[0] / hp[1]) * 100)) : 0;
    return `<div class="party-member${isSelf ? " self" : ""}${isAway ? " away" : ""}" data-member="${member.id}"><span class="member-name">${icon("class_" + member.classId, "", "small")}${escapeHtml(member.name)}${crown}<small>Lv ${member.level}</small></span>
        <span class="member-status">${status}${kickButton}</span>
        <div class="bar hp"><i style="width:${hpPercent}%"></i></div></div>`;
  }

  function render() {
    if (!party) {
      frame.hidden = true;
      return;
    }
    frame.hidden = false;
    frame.innerHTML =
      `<div class="party-header"><span>Party · ${party.members.length}/${MAX_PARTY_SIZE}</span><button data-party-action="leave" title="Leave the party">Leave</button></div>` +
      party.members.map(renderMember).join("");
  }

  frame.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-party-action]");
    if (!button) {
      return;
    }
    if (button.dataset.partyAction === "leave") {
      network.party("leave");
    } else if (button.dataset.partyAction === "kick") {
      network.party("kick", { member: button.dataset.member });
    }
  });

  /* Messages from the server. */
  network.onMessage("party_state", (message) => {
    const hadParty = !!party;
    party = message.party;
    render();
    if (party && !hadParty) {
      UI.systemMessage("You joined a party. Exp and zeny are shared with members nearby.");
    }
    if (!party && hadParty) {
      UI.systemMessage("You left the party.");
    }
  });
  network.onMessage("party_info", (message) => UI.systemMessage(message.text));
  network.onMessage("party_invite", (message) => {
    invitePopup.hidden = false;
    invitePopup.innerHTML = `<b>${escapeHtml(message.from.name)}</b> invites you to a party.<div class="row"><button data-invite-answer="yes">Accept</button><button data-invite-answer="no">Decline</button></div>`;
    clearTimeout(inviteTimer);
    inviteTimer = setTimeout(() => {
      invitePopup.hidden = true;
    }, INVITE_TIMEOUT_MS);
  });
  invitePopup.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-invite-answer]");
    if (!button) {
      return;
    }
    invitePopup.hidden = true;
    network.party(button.dataset.inviteAnswer === "yes" ? "accept" : "decline");
  });

  /* Invite by name (chat) or through a player's card. */
  function findPlayerByName(name) {
    name = name.trim().toLowerCase();
    for (const [id, peer] of peers) {
      if (peer.presence && (peer.presence.name || "").toLowerCase() === name) {
        return id;
      }
    }
    return null;
  }

  function invite(name) {
    if (!network.usesServer()) {
      UI.systemMessage("Parties need the game server; you are on the fallback connection.");
      return;
    }
    const id = findPlayerByName(name);
    if (!id) {
      UI.systemMessage(`No player called ${name} is online here.`);
      return;
    }
    network.party("invite", { target: id });
  }

  /* The small card that opens when you click another player, at screen position (screenX, screenY). */
  function showPlayerCard(id, screenX, screenY) {
    const peer = peers.get(id);
    if (!peer) {
      return;
    }
    const presence = peer.presence || {};
    const heroClass = CLASSES[presence.classId] || CLASSES.swordsman;
    playerCard.hidden = false;
    playerCard.style.left = Math.min(innerWidth - 170, screenX + 8) + "px";
    playerCard.style.top = Math.min(innerHeight - 90, screenY + 8) + "px";
    const inviteButton = isMember(id)
      ? ""
      : '<button data-card-action="invite">Invite to party</button>';
    playerCard.innerHTML = `<b>${escapeHtml(presence.name || "?")}</b><small>Level ${presence.level || 1} ${escapeHtml(heroClass.name)}</small><div class="row">${inviteButton}<button data-card-action="close">Close</button></div>`;
    playerCard.dataset.id = id;
  }

  playerCard.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-card-action]");
    if (!button) {
      return;
    }
    if (button.dataset.cardAction === "invite") {
      network.party("invite", { target: playerCard.dataset.id });
    }
    playerCard.hidden = true;
  });
  playerCard.addEventListener("pointerdown", (event) => event.stopPropagation());
  invitePopup.addEventListener("pointerdown", (event) => event.stopPropagation());

  /* Chat commands; returns true when the text was a command. */
  function handleCommand(text) {
    const match = /^\/(invite|leave|kick|party)\b\s*(.*)$/i.exec(text);
    if (!match) {
      return false;
    }
    const command = match[1].toLowerCase();
    const argument = match[2];
    if (command === "invite" || command === "party") {
      if (argument) {
        invite(argument);
      } else {
        UI.systemMessage("Use /invite name, or click a player.");
      }
    } else if (command === "leave") {
      network.party("leave");
    } else if (command === "kick") {
      const id = findPlayerByName(argument);
      if (id) {
        network.party("kick", { member: id });
      } else {
        UI.systemMessage(`No player called ${argument}.`);
      }
    }
    return true;
  }

  /* The party frame shows live hp, so redraw it twice a second. */
  function tick(dt) {
    if (!party) {
      return;
    }
    hpRefreshTimer += dt;
    if (hpRefreshTimer > 0.5) {
      hpRefreshTimer = 0;
      render();
    }
  }

  return {
    render,
    tick,
    invite,
    showPlayerCard,
    handleCommand,
    members,
    isMember,
    closePlayerCard: () => {
      playerCard.hidden = true;
    },
  };
}
