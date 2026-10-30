/* Eldoria – the professions in the world: the two fishing ponds, the gathering nodes (ore veins, marked trees,
   herbs; rules/gather-nodes.js) and the crafting stations (rules/professions.js). Built by world.js together with
   the rest of the scenery; gathering.js makes them clickable and shows whether a node is depleted. */
import * as builders from "./builders.js";
import { GATHER_NODES, FISHING_PONDS } from "./rules/gather-nodes.js";
import { RESOURCES, DEPLETED_SPRITE, STATION_PLACES } from "./rules/professions.js";

/* node id → {node, full: Billboard (what can be gathered), depleted: Billboard (what is left)} */
export const nodeSprites = new Map();

/* how a node of each gathering profession stands in the world */
const NODE_LOOK = {
  mining: { scale: 1.3, radius: 0.6, shadow: 1.3 },
  woodcutting: { scale: 1.3, radius: 0.6, shadow: 1.8 },
  herbalism: { scale: 1.3, radius: 0, shadow: 0.8 },
};

/* builder and collision radius per station kind */
const STATION_BUILDS = {
  forge: [builders.forge, 1.4],
  alchemy_table: [builders.alchemyTable, 1.1],
  campfire: [builders.campfire, 1],
  enchanting_altar: [builders.enchantingAltar, 2.3],
};

/** Builds ponds, nodes and stations. `context` comes from world.js (prop, place, pending). */
export function buildProfessionSites({ prop, place, pending }) {
  for (const [x, z, r] of FISHING_PONDS) {
    place(builders.pond(r), x, z, { radius: r + 0.7 });
  }

  for (const node of Object.values(GATHER_NODES)) {
    const look = NODE_LOOK[node.profession];
    const entry = { node, full: null, depleted: null };
    nodeSprites.set(node.id, entry);
    /* fishing spots have no sprite of their own; gathering.js draws ripples on the water */
    if (!look) {
      continue;
    }
    const sprite = RESOURCES[node.resource].node;
    pending.push(
      prop(sprite, node.x, node.z, look).then((billboard) => {
        entry.full = billboard;
      }),
      prop(DEPLETED_SPRITE[node.profession], node.x, node.z, {
        scale: look.scale,
        shadow: look.shadow * 0.6,
      }).then((billboard) => {
        entry.depleted = billboard;
        billboard.group.visible = false;
      }),
    );
  }

  for (const station of STATION_PLACES) {
    if (station.existing) {
      continue;
    }
    const [build, radius] = STATION_BUILDS[station.kind];
    const group = place(build(), station.x, station.z, { radius, rotation: station.rotation || 0 });
    group.userData.stationPlace = station;
  }
}
