/* Eldoria – RPG cursors for the mouse, in the spirit of the classic MMO gauntlet: a steel glove with gold trim
   that points, a sword over monsters, a speech bubble over people, a pickaxe over ore, trees and herbs, an anchor
   over a ship you can board, and a ship's wheel over the water while you are at the helm.
   They are drawn as shapes on a canvas at the screen's real pixel density (1× and 2× through image-set), so they
   stay sharp on every screen. Touch screens have no cursor, so nothing changes there. */

const SIZE = 32; /* CSS pixels */
const OUTLINE = "#0c0f2a";

/* metal and gold, lit from the top left */
function steel(ctx, x0, y0, x1, y1) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#d8dfe8");
  gradient.addColorStop(1, "#6f7a8e");
  return gradient;
}

function gold(ctx, x0, y0, x1, y1) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  gradient.addColorStop(0, "#fff0c4");
  gradient.addColorStop(0.45, "#e6bb63");
  gradient.addColorStop(1, "#8a5c12");
  return gradient;
}

/* fill a shape and draw its dark outline */
function shape(ctx, fill, build, lineWidth = 1.5) {
  ctx.beginPath();
  build();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* The gauntlet, drawn upright (index finger up, tip at 0,0) and then turned so the finger points to the top left. */
function drawGauntlet(ctx) {
  ctx.translate(2.5, 1.5);
  ctx.rotate(-0.62);
  ctx.scale(1.08, 1.08);
  ctx.translate(-3.8, 0);
  /* cuff */
  shape(ctx, gold(ctx, 0, 22, 18, 30), () => roundRect(ctx, -0.5, 21.5, 17, 8, 2.2));
  ctx.strokeStyle = "rgba(90, 54, 8, 0.8)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(1, 25.5);
  ctx.lineTo(15, 25.5);
  ctx.stroke();
  /* back of the hand */
  shape(ctx, steel(ctx, 0, 11, 17, 24), () => roundRect(ctx, 0, 11, 16.5, 12, 4));
  /* thumb, along the left side */
  ctx.save();
  ctx.translate(0.8, 17);
  ctx.rotate(-0.55);
  shape(ctx, steel(ctx, -3, -7, 3, 3), () => roundRect(ctx, -2.6, -7.5, 5.2, 10, 2.6));
  ctx.restore();
  /* three folded fingers */
  for (const [x, y] of [
    [5.6, 8.6],
    [9.4, 9.2],
    [12.8, 10.4],
  ]) {
    shape(ctx, steel(ctx, x, y, x + 4, y + 6), () => roundRect(ctx, x, y, 3.9, 5.6, 1.9), 1.3);
  }
  /* the index finger, in three plates */
  shape(ctx, steel(ctx, 1.5, 0, 6.5, 14), () => roundRect(ctx, 1.4, 0, 4.8, 14, 2.4));
  ctx.strokeStyle = "rgba(12, 15, 42, 0.75)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(1.9, 4.6);
  ctx.lineTo(5.7, 4.6);
  ctx.moveTo(1.9, 9);
  ctx.lineTo(5.7, 9);
  ctx.stroke();
  /* gold rivets on the knuckles */
  for (const [x, y] of [
    [8.6, 15],
    [12.4, 15.4],
  ]) {
    shape(
      ctx,
      gold(ctx, x - 1, y - 1, x + 1, y + 1),
      () => ctx.arc(x, y, 1.15, 0, Math.PI * 2),
      0.8,
    );
  }
}

/* A sword, point to the top left. */
function drawSword(ctx) {
  ctx.translate(2, 2);
  ctx.rotate(-Math.PI / 4);
  ctx.scale(0.86, 0.86);
  /* blade, with a lighter edge */
  shape(ctx, steel(ctx, -3, 0, 3, 0), () => {
    ctx.moveTo(0, 0);
    ctx.lineTo(3, 4.5);
    ctx.lineTo(3, 21);
    ctx.lineTo(-3, 21);
    ctx.lineTo(-3, 4.5);
    ctx.closePath();
  });
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-0.8, 4);
  ctx.lineTo(-0.8, 20);
  ctx.stroke();
  /* guard, grip and pommel */
  shape(ctx, gold(ctx, -8, 21, 8, 24), () => roundRect(ctx, -8, 20.5, 16, 3.6, 1.6));
  shape(ctx, "#6b3e1e", () => roundRect(ctx, -1.9, 24, 3.8, 8, 1));
  shape(ctx, gold(ctx, -2, 32, 2, 36), () => ctx.arc(0, 34, 2.6, 0, Math.PI * 2));
}

/* A speech bubble with three dots, pointing to the top left. */
function drawBubble(ctx) {
  shape(ctx, "#ffffff", () => {
    roundRect(ctx, 5, 5, 25, 17, 7);
  });
  shape(ctx, "#ffffff", () => {
    ctx.moveTo(8, 7);
    ctx.lineTo(1.5, 1.5);
    ctx.lineTo(12, 6);
  });
  /* cover the inner edge of the tail */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(7.5, 6.2, 5.5, 2.5);
  ctx.fillStyle = "rgba(111, 122, 142, 0.35)";
  ctx.fillRect(7, 18.5, 21, 2.4);
  ctx.fillStyle = OUTLINE;
  for (const x of [11.5, 17.5, 23.5]) {
    ctx.beginPath();
    ctx.arc(x, 13.5, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* A pickaxe: the curved head across the top, one point at the top left, the handle down to the bottom left. */
function drawPickaxe(ctx) {
  ctx.save();
  ctx.translate(18, 8.5);
  ctx.rotate(Math.atan2(14, 20));
  shape(ctx, "#8a5a2b", () => roundRect(ctx, -1.9, 0, 3.8, 23, 1.2));
  ctx.restore();
  shape(ctx, steel(ctx, 2, 0, 28, 14), () => {
    ctx.moveTo(1.5, 2);
    ctx.quadraticCurveTo(18, -2.5, 29.5, 14);
    ctx.quadraticCurveTo(28, 16, 26, 15);
    ctx.quadraticCurveTo(16, 4.5, 1.5, 2);
  });
  shape(ctx, gold(ctx, 15, 5, 21, 11), () => roundRect(ctx, 15, 5.2, 5.6, 5.2, 1.6), 1.1);
}

/* An anchor, the ring at the top left: ring, stock across, shank, and the curved arms with their flukes. */
function drawAnchor(ctx) {
  ctx.translate(4, 3);
  ctx.rotate(-0.35);
  /* the ring */
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(9, 3.5, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = gold(ctx, 6, 0, 12, 7);
  ctx.beginPath();
  ctx.arc(9, 3.5, 3, 0, Math.PI * 2);
  ctx.stroke();
  /* stock and shank */
  shape(ctx, steel(ctx, 3, 7, 15, 10), () => roundRect(ctx, 2.5, 7.4, 13, 2.8, 1.2));
  shape(ctx, steel(ctx, 7.5, 9, 10.5, 26), () => roundRect(ctx, 7.6, 9.5, 2.8, 16.5, 1.2));
  /* the arms: a curve from one fluke under the crown to the other */
  shape(ctx, steel(ctx, 0, 18, 18, 30), () => {
    ctx.moveTo(0.6, 18.5);
    ctx.lineTo(3.8, 17.6);
    ctx.quadraticCurveTo(4.2, 25, 9, 25.4);
    ctx.quadraticCurveTo(13.8, 25, 14.2, 17.6);
    ctx.lineTo(17.4, 18.5);
    ctx.quadraticCurveTo(17, 29.5, 9, 29.8);
    ctx.quadraticCurveTo(1, 29.5, 0.6, 18.5);
  });
  shape(ctx, gold(ctx, 7, 24, 11, 31), () => ctx.arc(9, 28.6, 1.6, 0, Math.PI * 2), 1);
}

/* A ship's wheel: a rim with eight handles, a gold hub; its top left handle is the point. */
function drawWheel(ctx) {
  const cx = 16;
  const cy = 16;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = cx + Math.cos(angle) * 14;
    const y = cy + Math.sin(angle) * 14;
    ctx.lineWidth = 4.4;
    ctx.strokeStyle = OUTLINE;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#8a5a2b";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.lineWidth = 5;
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#a8743c";
  ctx.beginPath();
  ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
  ctx.stroke();
  shape(ctx, gold(ctx, cx - 3, cy - 3, cx + 3, cy + 3), () => ctx.arc(cx, cy, 3.2, 0, Math.PI * 2));
}

const CURSORS = {
  default: { draw: drawGauntlet, hot: [2, 2] },
  attack: { draw: drawSword, hot: [2, 2] },
  talk: { draw: drawBubble, hot: [2, 2] },
  gather: { draw: drawPickaxe, hot: [2, 2] },
  board: { draw: drawAnchor, hot: [4, 2] },
  steer: { draw: drawWheel, hot: [16, 16] },
};

function render(cursor, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  /* a soft shadow under the whole cursor, so it reads on any ground */
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowOffsetX = 1 * scale;
  ctx.shadowOffsetY = 1.5 * scale;
  ctx.shadowBlur = 1.5 * scale;
  cursor.draw(ctx);
  return canvas.toDataURL();
}

/* the CSS value of a cursor: 1× and 2× images where image-set works in `cursor`, otherwise the 1× image */
function cursorValue(cursor) {
  const [x, y] = cursor.hot;
  const single = `url(${render(cursor, 1)}) ${x} ${y}, auto`;
  for (const name of ["image-set", "-webkit-image-set"]) {
    const test = `${name}(url("data:,") 1x, url("data:,") 2x) 0 0, auto`;
    if (CSS.supports("cursor", test)) {
      return `${name}(url(${render(cursor, 1)}) 1x, url(${render(cursor, 2)}) 2x) ${x} ${y}, auto`;
    }
  }
  return single;
}

/** Draws the cursors and switches them on, for a mouse only (body.rpg-cursor; ui.css picks them up). */
export function setupCursors() {
  if (!matchMedia("(pointer: fine)").matches) {
    return;
  }
  for (const [name, cursor] of Object.entries(CURSORS)) {
    document.documentElement.style.setProperty("--cursor-" + name, cursorValue(cursor));
  }
  document.body.classList.add("rpg-cursor");
}

/** The cursor over the game world: 'default', 'attack', 'talk', 'gather', 'board' or 'steer'. */
export function setWorldCursor(canvas, kind) {
  if (canvas.dataset.cursor !== kind) {
    canvas.dataset.cursor = kind;
  }
}
