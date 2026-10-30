/* Eldoria – the gathering nodes: ore veins, marked trees, herbs and fishing spots, as [id, resource, x, z].
   Shared by client (draws them) and server (checks distance and keeps them depleted). The fields hold the low
   level resources, the Whisperwood the middle ones and Kingsvale the rare ones. Fishing spots lie in the village
   pond, two new ponds (fields and Whisperwood, see FISHING_PONDS) and the lake south of Aurelia. The forest keeps
   its trees away from the nodes and ponds (forest.js). */
import { RESOURCES } from "./professions.js";

/* New ponds for fishing: [x, z, radius]. The world builds them (world.js, forest.js). */
export const FISHING_PONDS = [
  [28.1, 19.4, 3.4],
  [10, -85, 3.4],
];

const NODE_TABLE = [
  ["fields_1", "copper_ore", -25.3, -34.7],
  ["fields_2", "copper_ore", -41.7, -24.3],
  ["fields_3", "sunleaf", -11.3, -26],
  ["fields_4", "pine_log", 13.7, -32],
  ["fields_5", "copper_ore", 24.1, 25.7],
  ["fields_6", "sunleaf", -30.2, 27.3],
  ["fields_7", "iron_ore", 45.9, -12.2],
  ["fields_8", "pine_log", -31.8, -11.4],
  ["fields_9", "wolfsbane", -6.4, -40.1],
  ["fields_10", "sunleaf", 30.9, -16.5],
  ["fields_11", "oak_log", 31.4, 12.1],
  ["fields_12", "copper_ore", -35.7, 21],
  ["fields_13", "iron_ore", -10.4, -49],
  ["fields_14", "pine_log", 33.3, 31.7],
  ["fields_15", "sunleaf", 16.2, 25.4],
  ["fields_16", "oak_log", -39.2, -34.6],
  ["fields_17", "wolfsbane", 30.1, -44.6],
  ["forest_1", "iron_ore", -2.1, -77.3],
  ["forest_2", "silver_ore", -16.9, -96],
  ["forest_3", "moonbloom", -4.6, -84.5],
  ["forest_4", "ash_log", 9.9, -102.4],
  ["forest_5", "elder_log", -17.6, -109.3],
  ["forest_6", "silver_ore", 25.2, -79.9],
  ["forest_7", "iron_ore", 14.6, -73.7],
  ["forest_8", "wolfsbane", -7.5, -66.6],
  ["forest_9", "ash_log", -32.8, -88],
  ["forest_10", "moonbloom", -26, -97.6],
  ["forest_11", "silver_ore", 24.4, -91.3],
  ["forest_12", "ash_log", 15.9, -80.8],
  ["forest_13", "elder_log", 28.7, -106.6],
  ["forest_14", "embermoss", -16.2, -77.9],
  ["vale_1", "gold_ore", -194.4, 27.2],
  ["vale_2", "oak_log", -88.9, 39.9],
  ["vale_3", "starpetal", -98.8, 50.7],
  ["vale_4", "arcane_crystal", -195.2, -30.3],
  ["vale_5", "embermoss", -190.4, 7],
  ["vale_6", "gold_ore", -181.4, -24.3],
  ["vale_7", "elder_log", -155.8, 44.2],
  ["vale_8", "silver_ore", -84.5, 32.8],
  ["vale_9", "sunleaf", -73.5, 16.7],
  ["vale_10", "starpetal", -138.4, 57.3],
  ["vale_11", "oak_log", -61.1, 4.8],
  ["vale_12", "embermoss", -166, 49.3],
  ["vale_13", "arcane_crystal", -188.5, -25.5],
  ["vale_14", "sunleaf", -74.6, 7.4],
  ["vale_15", "gold_ore", -112.7, -52.7],
  ["vale_16", "elder_log", -71, -35.7],
  ["vale_17", "embermoss", -77.5, -30.7],
  ["vale_18", "starpetal", -83.7, 14.5],
  ["pond_village", "minnow", 6.5, 15.5],
  ["pond_fields_a", "minnow", 27.0, 18.6],
  ["pond_fields_b", "trout", 29.3, 20.2],
  ["pond_forest_a", "trout", 8.8, -84.2],
  ["pond_forest_b", "pike", 11.2, -85.8],
  ["lake_a", "trout", -122.5, 52],
  ["lake_b", "pike", -118, 49.2],
  ["lake_c", "golden_carp", -113.5, 52],
  ["lake_d", "golden_carp", -118, 58.8],
];

/* {id, resource, x, z, profession} by id */
export const GATHER_NODES = Object.fromEntries(
  NODE_TABLE.filter(([, resource]) => RESOURCES[resource]).map(([id, resource, x, z]) => [
    id,
    { id, resource, x, z, profession: RESOURCES[resource].profession },
  ]),
);
