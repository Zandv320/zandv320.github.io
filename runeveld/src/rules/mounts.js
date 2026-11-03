/* Eldoria – game rules: mounts. A mount is an item in its own equipment slot ('mount'); with one there the hero can
   ride (H, or the slot on the hotbar): faster over open ground, but off its back for any fight, a seat, the helm or
   a crafting station, and never down in the crypt or the forge. For now the riding fox: the fox of the fields, drawn
   twice as large and saddled. Pure data, shared by client and server. */
import { inCrypt } from "./crypt.js";
import { inForge } from "./forge.js";
import { inGlacier } from "./glacier.js";

/* the mounts: their sheets (sheets.js), under the rider and over them, the seats file (tools/build_mounts.py: per
   frame the pixel where the rider's hips go), and how much faster than on foot (a share: 0.6 is 60 % faster) */
export const MOUNTS = {
  riding_fox: {
    name: "Riding Fox",
    sheet: "fox_mount",
    front: "fox_mount_front",
    seats: "sprites/fox_mount.json",
    shadow: 2.4,
    speed: 0.6,
  },
  /* Rimeholt's thanks (Saga III): a frost wolf of the sledge teams, under Rimeholt's red */
  sledge_wolf: {
    name: "Sledge Wolf",
    sheet: "wolf_mount",
    front: "wolf_mount_front",
    seats: "sprites/wolf_mount.json",
    shadow: 2.4,
    speed: 0.65,
  },
};

/** The mount of the item in the hero's mount slot, or null. */
export function mountOf(equipment, items) {
  const id = equipment && equipment.mount;
  const key = id && items[id] && items[id].mount;
  return key && MOUNTS[key] ? key : null;
}

/** May a hero ride at (x, z)? Not down in the crypt or the forge. */
export const canRideAt = (x, z) => !inCrypt(x, z) && !inForge(x, z) && !inGlacier(x, z);
