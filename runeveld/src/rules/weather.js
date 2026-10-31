/* Eldoria – game rules: the storms over the Northroad. Like the day, they follow the real clock, so everybody sees
   the same sky without anything going over the network, and the server knows when the storm wolves hunt.
   Every STORM_CYCLE_MINUTES a storm blows for STORM_MINUTES: it swells for half a minute and dies down again. */

export const STORM_CYCLE_MINUTES = 14;
export const STORM_MINUTES = 4;
const RAMP_MINUTES = 0.5;

let stormOverride = null; /* admin: a fixed strength 0..1, or null */

/** Admin: force the storm to `strength` (0..1), or pass null to follow the clock again. */
export function setStormOverride(strength) {
  stormOverride = strength;
}

/** How hard it storms on the Northroad now: 0 (calm) .. 1 (full storm). */
export function stormStrength(ms = Date.now()) {
  if (stormOverride !== null) {
    return stormOverride;
  }
  const minute = (ms / 60000) % STORM_CYCLE_MINUTES;
  if (minute >= STORM_MINUTES) {
    return 0;
  }
  const rise = Math.min(1, minute / RAMP_MINUTES);
  const fall = Math.min(1, (STORM_MINUTES - minute) / RAMP_MINUTES);
  return Math.min(rise, fall);
}

export const isStorm = (ms = Date.now()) => stormStrength(ms) > 0.5;
