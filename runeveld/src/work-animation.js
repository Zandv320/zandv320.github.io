/* Eldoria – the hero at work. Plays a profession animation (sheets.js WORK: mine, chop, harvest, fish_cast, fish,
   smith, brew, cook, enchant) facing a node or a station, with the effects and sounds on the frames where the tool
   hits, and for fishing the line from the tip of the rod to a bobber on the water. Other players see the same
   animation through their presence (main.js); the effects are only drawn for the own hero. */
import * as THREE from "three";
import { WORK } from "./sheets.js";
import { scene, cameraState } from "./world.js";
import { sfx } from "./audio.js";
import { player, playEffect, now } from "./game-state.js";

/* the row of work.json per direction; the left view is the right one mirrored */
const DIRECTION_INDEX = { down: 0, left: 2, right: 2, up: 3 };

/* What happens when the tool hits, per animation: `spot` is the node or station ({x, z, shake()}), `tip` the tip of
   the tool in the world. */
const IMPACTS = {
  mine(spot) {
    playEffect("spark", spot.x, spot.z, { size: 0.9, y: 0.5 });
    playEffect("rubble", spot.x, spot.z, { size: 0.7, y: 0.25 });
    sfx.pick();
    spot.shake(0.05);
  },
  chop(spot) {
    playEffect("leaves", spot.x, spot.z, { size: 1.8, y: 2.2 });
    playEffect("rubble", spot.x, spot.z, { size: 0.6, y: 0.5, tint: 0xc8945a });
    sfx.chop();
    spot.shake(0.09);
  },
  harvest(spot) {
    playEffect("leaves", spot.x, spot.z, { size: 0.9, y: 0.35, tint: 0xb8f08a });
    sfx.snip();
    spot.shake(0.06);
  },
  smith(spot) {
    playEffect("spark", spot.x, spot.z, { size: 1.1, y: 1 });
    sfx.hammer();
  },
  brew(spot, tip) {
    playEffect("green_burst", tip.x, tip.z, { size: 0.55, y: tip.y + 0.15 });
    sfx.bubble();
  },
  cook(spot, tip) {
    playEffect("smoke", tip.x, tip.z, { size: 0.9, y: tip.y + 0.3 });
    playEffect("fire", spot.x, spot.z, { size: 0.8, y: 0.4 });
    sfx.sizzle();
  },
  enchant(spot, tip) {
    playEffect("sparkle", tip.x, tip.z, { size: 0.9, y: tip.y, tint: 0xd3a6ff });
    playEffect("rune_circle", spot.x, spot.z, { size: 1.4, y: 1.4, tint: 0xc9a2ff });
    sfx.chime();
  },
};

/* a red and white float, drawn as pixels */
function makeBobber() {
  const canvas = document.createElement("canvas");
  canvas.width = 5;
  canvas.height = 7;
  const context = canvas.getContext("2d");
  const pixels = ["  o  ", " ooo ", "orrro", "orrro", "owwwo", " owo ", "  o  "];
  const colors = { o: "#0c0f2a", r: "#e0413a", w: "#f4f1e8" };
  pixels.forEach((line, y) =>
    [...line].forEach((ch, x) => {
      if (colors[ch]) {
        context.fillStyle = colors[ch];
        context.fillRect(x, y, 1, 1);
      }
    }),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5 / 16, 7 / 16),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.5 }),
  );
  mesh.renderOrder = 3;
  return mesh;
}

const LINE_POINTS = 12;

export function createWorkAnimation() {
  let work = null; /* {name, spot} */
  let fishing = null; /* {bobber, line, x, z, landed, biteUntil} */
  const tip = new THREE.Vector3();

  /** World position of the tip of the tool in the current frame. */
  function tipPosition() {
    const sprite = player.sprite;
    const info = WORK[sprite.animName];
    if (!info) {
      return tip.set(player.x, 1, player.z);
    }
    const tips = info.tips[DIRECTION_INDEX[sprite.direction] ?? 0];
    const [px, py] = tips[Math.min(sprite.frame, tips.length - 1)];
    return sprite.framePointToWorld(px, py, tip);
  }

  function onFrame(name, frame) {
    const info = WORK[name];
    if (!work || !info) {
      return;
    }
    if (info.impact.includes(frame) && IMPACTS[name]) {
      IMPACTS[name](work.spot, tipPosition().clone());
    }
    if (name === "fish_cast") {
      if (frame === 3) {
        sfx.cast();
      }
      if (frame === info.columns[0].length - 1) {
        landBobber();
      }
    }
  }

  /** Start working at a spot ({x, z, shake(amount)}) with the animation `name`. */
  function start(name, spot) {
    stop();
    work = { name, spot };
    player.sprite.face(spot.x - player.x, spot.z - player.z);
    player.sprite.onFrame = onFrame;
    player.workAnim = name;
    if (name === "fish_cast") {
      startFishing(spot);
    }
  }

  function stop() {
    if (fishing) {
      scene.remove(fishing.bobber, fishing.line);
      fishing.bobber.geometry.dispose();
      fishing.bobber.material.map.dispose();
      fishing.bobber.material.dispose();
      fishing.line.geometry.dispose();
      fishing.line.material.dispose();
      fishing = null;
    }
    if (player.sprite && player.sprite.onFrame === onFrame) {
      player.sprite.onFrame = null;
    }
    work = null;
    player.workAnim = null;
  }

  /* ---- fishing: the line and the bobber ---- */

  function startFishing(spot) {
    /* the bobber lands a little to the side of the ripples, on the near half of the spot */
    const angle = Math.atan2(player.x - spot.x, player.z - spot.z) + (Math.random() - 0.5) * 1.2;
    const bobber = makeBobber();
    bobber.visible = false;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Array(LINE_POINTS * 3).fill(0), 3),
    );
    const line = new THREE.Line(
      geometry,
      /* drawn over everything: the rod's tip lies in the plane of the sprite, which can be at the water line */
      new THREE.LineBasicMaterial({
        color: 0xe8e4d8,
        transparent: true,
        opacity: 0.85,
        depthTest: false,
      }),
    );
    line.renderOrder = 7;
    line.visible = false;
    line.frustumCulled = false;
    scene.add(bobber, line);
    fishing = {
      bobber,
      line,
      x: spot.x + Math.sin(angle) * 0.6,
      z: spot.z + Math.cos(angle) * 0.6,
      landed: false,
      biteUntil: 0,
      time: 0,
    };
  }

  function landBobber() {
    if (!fishing) {
      return;
    }
    fishing.landed = true;
    fishing.bobber.visible = fishing.line.visible = true;
    playEffect("splash", fishing.x, fishing.z, { size: 0.7, y: 0.35, tint: 0xcfe9ff });
    sfx.splash();
    player.workAnim = "fish";
  }

  /** Something bites: the bobber is pulled under (the catch follows). */
  function bite() {
    if (fishing && fishing.landed) {
      fishing.biteUntil = now() + 0.6;
      playEffect("splash", fishing.x, fishing.z, { size: 1, y: 0.35, tint: 0xcfe9ff });
      sfx.splash();
    }
  }

  function update(dt) {
    if (!fishing || !fishing.landed) {
      return;
    }
    fishing.time += dt;
    const isBiting = now() < fishing.biteUntil;
    const bob = isBiting
      ? -0.12 + Math.sin(fishing.time * 40) * 0.04
      : Math.sin(fishing.time * 3) * 0.03;
    const bobber = fishing.bobber;
    bobber.position.set(fishing.x, 0.42 + bob, fishing.z);
    bobber.rotation.set(-cameraState.tilt, cameraState.yaw, 0, "YXZ");
    /* the line: from the tip of the rod, sagging down to the bobber */
    const from = tipPosition();
    const to = bobber.position;
    const position = fishing.line.geometry.attributes.position;
    for (let i = 0; i < LINE_POINTS; i++) {
      const t = i / (LINE_POINTS - 1);
      const sag = Math.sin(t * Math.PI) * (isBiting ? 0.05 : 0.35);
      position.setXYZ(
        i,
        from.x + (to.x - from.x) * t,
        from.y + (to.y + 0.15 - from.y) * t - sag,
        from.z + (to.z - from.z) * t,
      );
    }
    position.needsUpdate = true;
  }

  return {
    start,
    stop,
    bite,
    update,
    isWorking: () => !!work,
  };
}
