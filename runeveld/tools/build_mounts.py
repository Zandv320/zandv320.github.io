#!/usr/bin/env python3
"""Eldoria: builds the riding fox from the fox of the hunt animals pack (sprites/fox.png).

The fox is drawn twice as large with Scale2x (crisp pixel art, its diagonals smoothed), and saddled in pixel art at
the game's own resolution: a blanket with a gold hem, a leather saddle with stitching, a girth under the belly, a
bridle with a gold ring at the bit and reins back to the saddle. Every frame is measured (the line of the back, the
belly, the head) so the saddle sits and moves with the fox.

A rider sits between two layers:
    fox_mount.png        under the rider: the fox, the blanket and the saddle
    fox_mount_front.png  over the rider: what is nearer the camera than the rider's legs: the saddle flap and
                         stirrup on the near side; seen from the front the fox's head and chest, seen from behind
                         its haunches and tail
    fox_mount.json       per row and frame the seat: the pixel where the rider's hips go, and the feet row
Both sheets: 64x64 frames, 6 columns, rows idle down/up/left/right, then walk down/up/left/right (as the animals).
The smooth versions (sprites/smooth/) are made the same way as every other sprite's.

Usage: python3 -I runeveld/tools/build_mounts.py [runeveld/sprites]
"""

import importlib.util
import json
import pathlib
import sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("build_sprites", HERE / "build_sprites.py")
build_sprites = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_sprites)

FRAME = 64
COLUMNS = 6
DOWN, UP, LEFT, RIGHT = 0, 1, 2, 3

# the tack, in the palette of the game's leather and cloth
INK = (24, 16, 18, 255)
LEATHER = ((52, 30, 18, 255), (92, 54, 30, 255), (130, 80, 44, 255), (168, 110, 62, 255))
STITCH = (214, 170, 104, 255)
CLOTH = ((30, 44, 92, 255), (44, 66, 128, 255), (64, 92, 164, 255))
GOLD = ((150, 104, 30, 255), (216, 170, 70, 255), (250, 222, 140, 255))
IRON = ((70, 74, 86, 255), (150, 156, 170, 255), (210, 214, 224, 255))


def opaque(a):
    return a[:, :, 3] > 0


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max(), ys.max()


def put(a, x, y, color, clip=None):
    if 0 <= x < a.shape[1] and 0 <= y < a.shape[0] and (clip is None or clip[y, x]):
        a[y, x] = color


def top_of(mask, x):
    ys = np.nonzero(mask[:, x])[0]
    return ys.min() if len(ys) else None


def bottom_of(mask, x):
    ys = np.nonzero(mask[:, x])[0]
    return ys.max() if len(ys) else None


# ---------- seen from the side (facing right; left is the mirror) ----------


def tack_side(fox):
    """Saddle a fox seen from the side, facing right. Returns (back layer, front layer, seat (x, y))."""
    back = fox.copy()
    front = np.zeros_like(fox)
    mask = opaque(fox)
    x0, y0, x1, y1 = bbox(mask)
    width = x1 - x0
    # the saddle sits a little behind the middle: the tail is long, the head short
    cx = int(x0 + width * 0.56)
    back_line = int(np.median([top_of(mask, x) for x in range(cx - 4, cx + 5)]))
    belly = int(np.median([bottom_of(mask, x) for x in range(cx - 3, cx + 4)]))
    # the blanket: draped over the back, its lower edge rounded, a gold hem
    half = 9
    drop = min(10, belly - back_line - 3)
    for x in range(cx - half, cx + half + 1):
        edge = abs(x - cx) == half
        corner = abs(x - cx) >= half - 1
        bottom = back_line + drop - (1 if corner else 0)
        for y in range(back_line - 1, bottom + 1):
            if edge or y == bottom:
                color = GOLD[1] if (x + y) % 2 else GOLD[0]
            elif y == bottom - 1:
                color = GOLD[2] if (x % 3 == 0) else CLOTH[0]
            else:
                shade = 2 if y < back_line + 2 else (1 if y < bottom - 3 else 0)
                color = CLOTH[shade]
            put(back, x, y, color)
        put(back, x, bottom + 1, INK)
    # the girth: a strap from the blanket round the belly
    for y in range(back_line + drop, belly + 1):
        for x in (cx + 3, cx + 4):
            put(back, x, y, LEATHER[0] if x == cx + 4 else LEATHER[1], clip=mask)
    # the saddle: a low cantle behind, a pommel in front, the seat dipping between
    seat_top = back_line - 3
    for x in range(cx - 7, cx + 8):
        t = (x - (cx - 7)) / 14
        rise = 3 if x <= cx - 6 else (4 if x >= cx + 6 else (1 if x <= cx - 5 or x >= cx + 5 else 0))
        top = seat_top - rise
        for y in range(top, back_line + 1):
            if y == top:
                color = LEATHER[3]
            elif y == back_line:
                color = LEATHER[0]
            else:
                color = LEATHER[2] if y < top + 2 else LEATHER[1]
            put(back, x, y, color)
        put(back, x, top - 1, INK)
        if 0.15 < t < 0.85 and x % 2 == 0:
            put(back, x, back_line - 1, STITCH)
    for y in range(seat_top - 5, back_line + 1):
        put(back, cx - 8, y, INK if y > seat_top - 4 else back[y, cx - 8])
        put(back, cx + 8, y, INK if y > seat_top - 5 else back[y, cx + 8])
    # the bridle: a strap round the muzzle, a gold ring at the bit, the reins back to the pommel
    # the nose is the fox's rightmost point; the bit sits just behind it
    head_x = x1
    rows = np.nonzero(mask[:, head_x])[0]
    mouth_y = int(rows.max()) + 1 if len(rows) else back_line - 6
    strap_x = head_x - 4
    for y in range(y0, y1 + 1):
        if mask[y, strap_x] and abs(y - mouth_y) <= 5:
            put(back, strap_x, y, LEATHER[1])
    ring = (strap_x + 1, mouth_y)
    for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
        put(back, ring[0] + dx, ring[1] + dy, GOLD[1])
    put(back, ring[0], ring[1], GOLD[2])
    # the flap hangs from the saddle down the flank, behind the rider's leg
    for x in range(cx - 4, cx + 2):
        for y in range(back_line, back_line + 5):
            edge = x in (cx - 4, cx + 1) or y == back_line + 4
            put(back, x, y, INK if edge else (LEATHER[2] if y == back_line else LEATHER[1]))
        if x % 2 == 0:
            put(back, x, back_line + 3, STITCH)
    # the rider's hips go into the dip of the seat; their hands are a little in front of them
    seat = (cx - 2, seat_top + 2)
    hands = (seat[0] + 3, seat[1] - 3)
    # in front of the rider: the pommel's horn, the reins from the bit to the hands, the stirrup under the boot
    horn_x = seat[0] + 4
    for x, y, color in (
        (horn_x, seat[1] - 3, INK),
        (horn_x + 1, seat[1] - 3, INK),
        (horn_x - 1, seat[1] - 2, INK),
        (horn_x, seat[1] - 2, LEATHER[3]),
        (horn_x + 1, seat[1] - 2, LEATHER[2]),
        (horn_x + 2, seat[1] - 2, INK),
        (horn_x - 1, seat[1] - 1, LEATHER[2]),
        (horn_x, seat[1] - 1, LEATHER[2]),
        (horn_x + 1, seat[1] - 1, LEATHER[1]),
        (horn_x + 2, seat[1] - 1, INK),
        (horn_x - 2, seat[1], LEATHER[2]),
        (horn_x - 1, seat[1], LEATHER[1]),
        (horn_x, seat[1], LEATHER[1]),
        (horn_x + 1, seat[1], LEATHER[0]),
        (horn_x + 2, seat[1], INK),
    ):
        put(front, x, y, color)
    steps = max(abs(ring[0] - hands[0]), abs(ring[1] - hands[1]))
    for k in range(steps + 1):
        x = round(hands[0] + (ring[0] - hands[0]) * k / steps)
        y = round(hands[1] + (ring[1] - hands[1]) * k / steps + 2 * np.sin(np.pi * k / steps))
        put(front, x, y, LEATHER[0])
    foot = seat[1] + 8
    for y in range(back_line + 1, foot):
        put(back, seat[0] - 1, y, LEATHER[0])
    for dx, shade in ((-3, 1), (-2, 2), (-1, 2), (0, 2), (1, 1)):
        put(front, seat[0] + dx, foot + 1, IRON[shade])
    put(front, seat[0] - 3, foot, IRON[0])
    put(front, seat[0] + 1, foot, IRON[0])
    return back, front, seat


# ---------- seen from behind ----------


def tack_back(fox):
    back = fox.copy()
    front = np.zeros_like(fox)
    mask = opaque(fox)
    x0, y0, x1, y1 = bbox(mask)
    cx = (x0 + x1) // 2
    # the saddle on the middle of the back, behind the shoulders
    body_top = y0 + int((y1 - y0) * 0.42)
    back_line = body_top
    left = min(np.nonzero(mask[back_line + 2])[0])
    right = max(np.nonzero(mask[back_line + 2])[0])
    # the blanket across the back, hanging down both sides
    for x in range(left - 2, right + 3):
        for y in range(back_line, back_line + 7):
            edge = x in (left - 2, right + 2) or y == back_line + 6
            put(back, x, y, GOLD[1] if edge else CLOTH[2 if y < back_line + 2 else 1])
    # the cantle of the saddle, seen from behind: a leather arch
    for x in range(cx - 6, cx + 7):
        arch = 2 - abs(x - cx) // 3
        for y in range(back_line - 2 - arch, back_line + 2):
            put(back, x, y, LEATHER[3] if y == back_line - 2 - arch else LEATHER[2])
        put(back, x, back_line - 3 - arch, INK)
    # in front of the rider: the haunches and the tail below the seat, and the stirrups both sides
    for y in range(back_line + 7, FRAME):
        for x in range(FRAME):
            if mask[y, x]:
                front[y, x] = fox[y, x]
    for side in (left - 3, right + 3):
        for y in range(back_line + 1, back_line + 10):
            put(front, side, y, LEATHER[0])
        for dx in (-1, 0, 1):
            put(front, side + dx, back_line + 10, IRON[1 if dx else 2])
    return back, front, (cx, back_line)


# ---------- seen from the front ----------


def tack_front(fox):
    back = fox.copy()
    front = np.zeros_like(fox)
    mask = opaque(fox)
    x0, y0, x1, y1 = bbox(mask)
    cx = (x0 + x1) // 2
    # the blanket shows beside the shoulders, behind the head and chest
    shoulder = y0 + (y1 - y0) // 2
    row = np.nonzero(mask[shoulder])[0]
    left, right = row.min(), row.max()
    for x in list(range(left - 3, left + 1)) + list(range(right, right + 4)):
        for y in range(shoulder - 6, shoulder + 3):
            edge = x in (left - 3, right + 3) or y == shoulder + 2
            put(back, x, y, GOLD[1] if edge else CLOTH[1])
    # the pommel of the saddle over the head, with the reins coming up to it
    for x in range(cx - 4, cx + 5):
        for y in range(y0 - 3, y0 + 1):
            put(back, x, y, LEATHER[3] if y == y0 - 3 else LEATHER[2])
        put(back, x, y0 - 4, INK)
    # in front of the rider: the whole fox (its head and chest are nearer the camera than the saddle), with the
    # bridle across its nose and the stirrups hanging both sides
    front[mask] = fox[mask]
    nose = y0 + (y1 - y0) // 3
    for x in range(cx - 4, cx + 5):
        if mask[nose, x]:
            front[nose, x] = LEATHER[1]
    for dx in (-5, 5):
        put(front, cx + dx, nose, GOLD[1])
    for side in (left - 2, right + 2):
        for y in range(shoulder - 4, shoulder + 6):
            put(front, side, y, LEATHER[0])
        for dx in (-1, 0, 1):
            put(front, side + dx, shoulder + 6, IRON[1 if dx else 2])
    return back, front, (cx, y0 - 3)


def main():
    out_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "runeveld/sprites")
    fox = np.array(Image.open(out_dir / "fox.png").convert("RGBA"))
    fox[fox[:, :, 3] == 0] = 0
    big = build_sprites.scale2x(fox)
    back_sheet = np.zeros((8 * FRAME, COLUMNS * FRAME, 4), dtype=np.uint8)
    front_sheet = np.zeros_like(back_sheet)
    seats = {}
    feet_rows = []
    for anim, first in (("idle", 0), ("walk", 4)):
        for direction, name in ((DOWN, "down"), (UP, "up"), (RIGHT, "right")):
            row = first + direction
            for column in range(COLUMNS):
                frame = big[row * FRAME : (row + 1) * FRAME, column * FRAME : (column + 1) * FRAME]
                if not opaque(frame).any():
                    continue
                tack = {DOWN: tack_front, UP: tack_back, RIGHT: tack_side}[direction]
                back, front, seat = tack(frame)
                back_sheet[row * FRAME : (row + 1) * FRAME, column * FRAME : (column + 1) * FRAME] = back
                front_sheet[row * FRAME : (row + 1) * FRAME, column * FRAME : (column + 1) * FRAME] = front
                seats.setdefault(anim, {}).setdefault(name, []).append([int(seat[0]), int(seat[1])])
                feet_rows.append(int(bbox(opaque(frame))[3]))
                if direction == RIGHT:
                    # facing left: the same, mirrored
                    left_row = first + LEFT
                    mirrored = (
                        slice(left_row * FRAME, (left_row + 1) * FRAME),
                        slice(column * FRAME, (column + 1) * FRAME),
                    )
                    back_sheet[mirrored] = back[:, ::-1]
                    front_sheet[mirrored] = front[:, ::-1]
                    seats[anim].setdefault("left", []).append([FRAME - 1 - int(seat[0]), int(seat[1])])
    # the feet: the commonest bottom row (seen from behind the tail hangs lower, nearer the camera)
    feet = FRAME - 1 - max(set(feet_rows), key=feet_rows.count)
    Image.fromarray(back_sheet, "RGBA").save(out_dir / "fox_mount.png")
    Image.fromarray(front_sheet, "RGBA").save(out_dir / "fox_mount_front.png")
    (out_dir / "fox_mount.json").write_text(
        json.dumps({"frame": FRAME, "feet": feet, "seats": seats}, separators=(",", ":"))
    )
    smooth_dir = out_dir / "smooth"
    smooth_dir.mkdir(exist_ok=True)
    for name in ("fox_mount.png", "fox_mount_front.png"):
        build_sprites.smooth(Image.open(out_dir / name)).save(smooth_dir / name)
    print("fox mount: feet", feet, "seats", {k: len(v) for k, v in seats.items()})


if __name__ == "__main__":
    main()
