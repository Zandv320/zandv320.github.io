#!/usr/bin/env python3
"""Cuts the Craftpix packs into the sprite sheets Eldoria uses.

Usage:
    python3 -I runeveld/tools/build_sprites.py <dir with unpacked packs> [runeveld/sprites]

The packs dir holds the unpacked zips from runeveld/_download/, each in its own subdirectory:
    free-swordsman-1-3-level-pixel-top-down-sprite-character/
    free-top-down-hunt-animals-pixel-sprite-pack/
    free-village-pixel-tileset-for-top-down-defense/
    free-medieval-fortress-top-down-pixel-minigame-kit/
    fx-explosion/, fx-magic/

Output (all pixel art, 1 world unit = 16 px, see world.js):
    hero_body.png          bare base body (underwear), 64x64 frames, 12 columns, 4 rows per animation
                           (down, left, right, up)
    hero_head.png          head and hair, same layout
    armor1..3.png          clothing as a separate layer over the body (tunic, leather vest, steel armour)
    sword1..3.png          sword in front of the body (including the swing effect), sword1_back..3_back the part
                           behind the body
    rabbit/fox/boar.png    32x32 frames, 6 columns, 4 rows per animation (down, up, left, right)
    stag/wolf/dire_boar.png forest animals: the stag from the pack, wolf and dire boar recoloured from fox and boar
    robe1..3, staff1..3 (+_back), hat1..2  mage: robe, staff with orb and pointed hat, derived from the hero layers
    armor4..5/robe4..5     second classes: knight (steel blue), crusader (silver/gold), wizard (midnight), sage (green)
    cloak1..4 (+_back)     capes derived from the body, per frame
    fx/*.png + fx.json     skill and spell effects from the Craftpix effect packs (one row of frames per effect)
    merchant.png           32x32 frames, 4 columns, 1 row
    ground.png             7 tiles of 32x32 side by side: 3x grass, 2x cobbles, 2x path
    <decor>.png            single images at their real size
    ore_*, herb_*, tree_stump.png  profession nodes: ore veins (+ ore_depleted), herbs (+ herb_picked), the cut tree
    tex/*.png              tileable textures for the 3D village (builders.js)
    smooth/*.png           2x smoothed copies of the sprites
"""

import colorsys
import json
import pathlib
import sys

import numpy as np
from PIL import Image

TRANSPARENT = (0, 0, 0, 0)


def open_rgba(path):
    return Image.open(path).convert("RGBA")


def frames_in_row(sheet, fw, fh, row):
    """Number of filled frames in a row (empty frames on the right do not count)."""
    n = sheet.width // fw
    while n > 0 and sheet.crop(((n - 1) * fw, row * fh, n * fw, (row + 1) * fh)).getbbox() is None:
        n -= 1
    return max(1, n)


def stack_animations(animations, fw, fh, cols, rows=4):
    """Stack animation sheets (each with `rows` direction rows) into one sheet with `cols` columns.

    Shorter rows are repeated cyclically so every direction runs equally long."""
    out = Image.new("RGBA", (cols * fw, len(animations) * rows * fh), TRANSPARENT)
    for a, sheet in enumerate(animations):
        for r in range(rows):
            n = frames_in_row(sheet, fw, fh, r)
            for c in range(cols):
                f = c % n
                out.paste(sheet.crop((f * fw, r * fh, (f + 1) * fw, (r + 1) * fh)), (c * fw, (a * rows + r) * fh))
    return out


def stack_layers(layers, fw, fh, cols, rows=4):
    """Like stack_animations(), but for several layers at once.

    The number of frames per row comes from the first layer (the body), so all layers stay exactly in step."""
    outs = [Image.new("RGBA", (cols * fw, len(layers[0]) * rows * fh), TRANSPARENT) for _ in layers]
    for a in range(len(layers[0])):
        for r in range(rows):
            n = frames_in_row(layers[0][a], fw, fh, r)
            for c in range(cols):
                f = c % n
                for li, layer in enumerate(layers):
                    sheet = layer[a]
                    if sheet is None:
                        continue
                    outs[li].paste(
                        sheet.crop((f * fw, r * fh, (f + 1) * fw, (r + 1) * fh)), (c * fw, (a * rows + r) * fh)
                    )
    return outs


# ---------- swordsman: separate layers ----------
HERO_ANIMS = ("Idle", "Run", "attack", "Hurt", "Death")


def swordsman_part(swordsman_dir, level, anim, name):
    path = swordsman_dir / f"Swordsman_lvl{level}/Parts/Swordsman_lvl{level}_{anim}_{name}.png"
    return open_rgba(path) if path.exists() else None


# tunic colours (level 1) -> skin; the lowest rows of the tunic become underwear
TUNIC_TO_SKIN = {
    (63, 67, 61): (190, 134, 95),
    (94, 97, 90): (225, 178, 110),
    (111, 115, 106): (225, 178, 110),
    (134, 139, 124): (246, 202, 116),
    (45, 49, 43): (164, 111, 89),
}
TUNIC_TO_UNDERWEAR = {
    (63, 67, 61): (205, 205, 210),
    (94, 97, 90): (238, 238, 242),
    (111, 115, 106): (238, 238, 242),
    (134, 139, 124): (250, 250, 252),
    (45, 49, 43): (170, 170, 178),
}


def bare_body(sheet, fw=64, fh=64):
    """Turn a level-1 body sheet into a bare body: the tunic becomes skin, the hips get underwear."""
    out = sheet.copy()
    px = out.load()
    for r in range(sheet.height // fh):
        for c in range(sheet.width // fw):
            frame = sheet.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
            bbox = frame.getbbox()
            if not bbox:
                continue
            feet = r * fh + bbox[3]  # lowest filled row of this frame
            for y in range(r * fh + bbox[1], feet):
                for x in range(c * fw + bbox[0], c * fw + bbox[2]):
                    p = px[x, y]
                    if p[3] == 0:
                        continue
                    rgb = p[:3]
                    if rgb in TUNIC_TO_SKIN:
                        in_band = feet - 8 <= y <= feet - 6
                        px[x, y] = (TUNIC_TO_UNDERWEAR if in_band else TUNIC_TO_SKIN)[rgb] + (255,)
    return out


def layer_difference(layer, base):
    """Only the pixels of `layer` that differ from `base` (the clothing without the body underneath)."""
    out = Image.new("RGBA", layer.size, TRANSPARENT)
    a, b, o = layer.load(), base.load(), out.load()
    for y in range(layer.height):
        for x in range(layer.width):
            if a[x, y][3] > 0 and a[x, y] != b[x, y]:
                o[x, y] = a[x, y]
    return out


def build_hero_layers(swordsman_dir, out_dir):
    """Body, head, armour and swords. Returns (stacked layer sheets, bare body)."""
    body1 = [swordsman_part(swordsman_dir, 1, a, "body") for a in HERO_ANIMS]
    head = [swordsman_part(swordsman_dir, 1, a, "head") for a in HERO_ANIMS]
    layers = [body1, head]
    for level in (1, 2, 3):
        layers.append([swordsman_part(swordsman_dir, level, a, "body") for a in HERO_ANIMS])
        front = []
        for a in HERO_ANIMS:
            sword = swordsman_part(swordsman_dir, level, a, "sword")
            swing = swordsman_part(swordsman_dir, level, a, "swing")
            if sword is not None and swing is not None:
                sword = sword.copy()
                sword.alpha_composite(swing)
            front.append(sword)
        layers.append(front)
        layers.append([swordsman_part(swordsman_dir, level, a, "sword_back") for a in HERO_ANIMS])
    stacked = stack_layers(layers, 64, 64, 12)
    body = bare_body(stacked[0])
    body.save(out_dir / "hero_body.png")
    stacked[1].save(out_dir / "hero_head.png")
    # clothing as the difference with the bare body; sword in front and behind
    for i, level in enumerate((1, 2, 3)):
        layer_difference(stacked[2 + 3 * i], body).save(out_dir / f"armor{level}.png")
        stacked[3 + 3 * i].save(out_dir / f"sword{level}.png")
        stacked[4 + 3 * i].save(out_dir / f"sword{level}_back.png")
    return stacked, body


# ---------- headgear: hand-drawn pixel art, placed on the head per frame ----------
# Every piece has four drawings (front, left, right, back) in characters: . empty, o outline, d dark, m mid, l light,
# h highlight (g gold on hats). Per frame the top and centre of the hair are found; the piece goes there, so it
# follows every movement.
HAIR_COLORS = {(33, 26, 28), (43, 32, 35), (59, 44, 51), (77, 57, 69), (104, 79, 90), (135, 108, 125)}
IRON = {"o": (40, 42, 52), "d": (96, 102, 118), "m": (140, 148, 166), "l": (186, 194, 210), "h": (232, 238, 248)}
LEATHER = {"o": (52, 30, 16), "d": (104, 64, 32), "m": (148, 96, 48), "l": (184, 130, 74), "h": (214, 170, 110)}

HELM_FRONT = """
.....oooooo.....
....ollllllo....
...olllhhlllo...
..ollmmmmmmllo..
..olmmmmmmmmlo..
..odmmmmmmmmdo..
.ooddddddddddoo.
.olddddddddddlo.
.oooooooddoooooo
.......oddo.....
.......oddo.....
........oo......"""
HELM_RIGHT = """
....oooooo....
...ollllllo...
..olllhhlllo..
.ollmmmmmmllo.
.olmmmmmmmmlo.
.odmmmmmmmmdo.
oodddddddddddo
olddddddddddlo
oooooooooodddo
..........oddo
...........oo."""
HELM_BACK = """
.....oooooo.....
....ollllllo....
...olllmmlllo...
..ollmmmmmmllo..
..olmmmmmmmmlo..
..odmmmmmmmmdo..
.ooddddddddddoo.
.olddddddddddlo.
.oooooooooooooo."""
CAP_FRONT = """
......oooo......
....oolllloo....
...ollmmmmllo...
..olmmmmmmmmlo..
..ommmmmmmmmmo..
..odmmmmmmmmdo..
.ooddddddddddoo.
oldddddddddddddo
.oooooooooooooo."""
CAP_RIGHT = """
.....oooo.....
...oolllloo...
..ollmmmmllo..
.olmmmmmmmmlo.
.ommmmmmmmmmo.
.odmmmmmmmmdo.
oodddddddddddo
oddddddddddddlo
.ooooooooooooo"""
CAP_BACK = """
......oooo......
....oolllloo....
...ollmmmmllo...
..olmmmmmmmmlo..
..ommmmmmmmmmo..
..odmmmmmmmmdo..
.ooddddddddddoo.
.oddddddddddddo.
.oooooooooooooo."""


def pixel_drawing(text, colors):
    lines = text.strip("\n").split("\n")
    width = max(len(line) for line in lines)
    im = Image.new("RGBA", (width, len(lines)), TRANSPARENT)
    px = im.load()
    for y, line in enumerate(lines):
        for x, ch in enumerate(line):
            if ch in colors:
                px[x, y] = colors[ch] + (255,)
    return im


def mirror(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


EYE_COLORS = {(63, 106, 212), (17, 11, 0)}  # iris and pupil: the stable anchor for the height


def headgear(head, front, right, back, colors, brim, fw=64, fh=64):
    """Put the right piece of headgear on the head in every frame. Row r within an animation: 0 front, 1 left,
    2 right, 3 back.

    Horizontally: the centre of the skull (the top four rows of hair; flowing hair does not count).
    Vertically: the brim of the piece (`brim` = row index of the lowest brim row) goes one pixel above the eyes;
    without eyes in view (back view) the top connects to the hair."""
    art = {
        0: pixel_drawing(front, colors),
        1: mirror(pixel_drawing(right, colors)),
        2: pixel_drawing(right, colors),
        3: pixel_drawing(back, colors),
    }
    # the result is a complete head layer (head + headgear) that replaces the normal head layer:
    # hair on and above the brim is removed, so no tufts stick through the helmet
    out = head.copy()
    src, dst = head.load(), out.load()
    for r in range(head.height // fh):
        piece = art[r % 4]
        for c in range(head.width // fw):
            hair, eyes = [], []
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    p = src[x, y]
                    if p[3] == 0:
                        continue
                    if p[:3] in HAIR_COLORS:
                        hair.append((x, y))
                    elif p[:3] in EYE_COLORS:
                        eyes.append((x, y))
            if not hair:
                continue
            top = min(y for _, y in hair)
            skull = [x for x, y in hair if y <= top + 3]
            xc = (min(skull) + max(skull)) / 2
            x0 = int(xc - piece.width / 2 + 1)
            y0 = (min(y for _, y in eyes) - 1 - brim) if eyes else top - 1
            for x, y in hair:
                if y <= y0 + brim:
                    dst[x, y] = TRANSPARENT
            out.alpha_composite(piece, (x0, y0))
    return out


# ---------- mage: robe, staff and pointed hat, derived from the hero layers ----------
# The robe is the tunic in another palette plus the legs of the body in the hem colour (a long robe).
# The staff follows the axis of the wooden sword per frame (the hand is the end closest to the body) and reaches
# past it upwards with an orb on top; the swing arc becomes a light blue magic arc.
# The pointed hat goes on the skull per frame, just like the helmets.
TUNIC_GREYS = [(45, 49, 43), (63, 67, 61), (94, 97, 90), (111, 115, 106), (134, 139, 124)]  # dark -> light
ROBES = {
    "robe1": [(24, 34, 76), (38, 54, 116), (58, 82, 158), (72, 100, 180), (104, 136, 210)],  # blue
    "robe2": [(80, 22, 30), (118, 32, 44), (160, 48, 60), (184, 66, 76), (214, 104, 108)],  # red
    "robe3": [(52, 22, 76), (78, 34, 112), (108, 52, 150), (130, 70, 176), (166, 110, 210)],  # purple
}
# second classes
ROBES_TIER2 = {
    "robe4": [(14, 20, 52), (24, 34, 84), (36, 52, 120), (50, 74, 150), (80, 110, 190)],  # wizard: midnight
    "robe5": [(24, 52, 34), (36, 80, 50), (52, 112, 70), (72, 140, 92), (110, 176, 128)],  # sage: forest green
}
BODY_OUTLINE = {(85, 45, 36), (121, 80, 72), (81, 50, 46)}


def robe(tunic, body, palette, fw=64, fh=64):
    out = Image.new("RGBA", tunic.size, TRANSPARENT)
    t, b, o = tunic.load(), body.load(), out.load()
    recolor = dict(zip(TUNIC_GREYS, palette, strict=True))
    for r in range(tunic.height // fh):
        for c in range(tunic.width // fw):
            bbox = tunic.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            if not bbox:
                continue
            below_tunic = r * fh + bbox[3]  # first row below the tunic
            body_box = body.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            feet = r * fh + body_box[3] if body_box else below_tunic
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    p = t[x, y]
                    if p[3] > 0:
                        o[x, y] = recolor.get(p[:3], p[:3]) + (255,)
                    elif below_tunic <= y < feet - 1 and b[x, y][3] > 0 and b[x, y][:3] not in BODY_OUTLINE:
                        o[x, y] = palette[1] + (255,)  # the legs below the tunic: the hem of the robe
    return out


class PixelCanvas:
    """Pixel access plus size, so drawing helpers can clip to the image."""

    def __init__(self, im):
        self.pixels, self.width, self.height = im.load(), im.width, im.height


def draw_line(canvas, x0, y0, x1, y1, color):
    """Bresenham, including both end points."""
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        if 0 <= x0 < canvas.width and 0 <= y0 < canvas.height:
            canvas.pixels[x0, y0] = color + (255,)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


SKIN = {(190, 134, 95), (225, 178, 110), (246, 202, 116), (164, 111, 89)}


def is_swing_arc(rgb):
    return rgb[0] > 200 and rgb[1] > 200 and rgb[2] > 200


def staff(sword, sword_back, body, head, colors, fw=64, fh=64, rows=4):
    """colors: {'wood', 'wood_light', 'orb_outline', 'orb', 'orb_highlight', 'arc'}. Returns (front, back).

    The grip is the skin pixel of the body closest to the hilt of the sword (the hand). In idle, walk, hurt and death
    the staff stands upright through the hand (leaning slightly outwards), with the orb above the head; in the attack
    frames it points along with the sword, as a thrust towards the target. Afterwards the hand pixels are drawn over
    it again, so the hand holds the staff instead of hanging next to it."""
    front = Image.new("RGBA", sword.size, TRANSPARENT)
    back = front.copy()
    front_px, back_px, body_px = sword.load(), sword_back.load(), body.load()
    last_grip = {}  # last grip per row, for frames without a sword
    last_direction = {}  # sword direction of the previous frame per row
    for r in range(sword.height // fh):
        is_attack = (r // rows) == 2  # third animation: attack
        for c in range(sword.width // fw):
            front_points, back_points, arc_points = [], [], []
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    for src, points_list in ((front_px, front_points), (back_px, back_points)):
                        p = src[x, y]
                        if p[3] == 0:
                            continue
                        (arc_points if is_swing_arc(p[:3]) else points_list).append((x, y, src is back_px))
            points = front_points + back_points
            target = back if len(back_points) > len(front_points) else front
            canvas = PixelCanvas(target)
            for x, y, is_back in arc_points:  # the swing arc, light blue, in its own layer
                PixelCanvas(back if is_back else front).pixels[x, y] = colors["arc"] + (255,)
            body_box = body.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            if body_box:
                cx, cy = c * fw + (body_box[0] + body_box[2]) / 2, r * fh + (body_box[1] + body_box[3]) / 2
            else:
                cx, cy = c * fw + 32, r * fh + 38
            head_box = head.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            head_top = r * fh + (head_box[1] if head_box else 18)
            if points:
                best, end_a, end_b = -1, None, None
                for i in range(len(points)):
                    for j in range(i + 1, len(points)):
                        dist2 = (points[i][0] - points[j][0]) ** 2 + (points[i][1] - points[j][1]) ** 2
                        if dist2 > best:
                            best, end_a, end_b = dist2, points[i], points[j]
                if end_a is None or best < 4:
                    continue
                # which end is the hilt? In the first frame of a row the end closest to the body; after that the end
                # whose direction resembles the previous frame's, so the staff does not flip over while the hand
                # moves up and down during the walk
                if r in last_direction:
                    rx, ry = last_direction[r]
                    if (end_b[0] - end_a[0]) * rx + (end_b[1] - end_a[1]) * ry >= 0:
                        hilt, tip = end_a, end_b
                    else:
                        hilt, tip = end_b, end_a
                else:
                    dist_a = (end_a[0] - cx) ** 2 + (end_a[1] - cy) ** 2
                    dist_b = (end_b[0] - cx) ** 2 + (end_b[1] - cy) ** 2
                    hilt, tip = (end_a, end_b) if dist_a <= dist_b else (end_b, end_a)
                last_direction[r] = (tip[0] - hilt[0], tip[1] - hilt[1])
                # the hand: skin pixels of the body right next to the hilt
                hand, hand_dist = None, 99
                for y in range(max(r * fh, hilt[1] - 4), min((r + 1) * fh, hilt[1] + 5)):
                    for x in range(max(c * fw, hilt[0] - 4), min((c + 1) * fw, hilt[0] + 5)):
                        p = body_px[x, y]
                        if p[3] > 0 and p[:3] in SKIN:
                            dist2 = (x - hilt[0]) ** 2 + (y - hilt[1]) ** 2
                            if dist2 < hand_dist:
                                hand_dist, hand = dist2, (x, y)
                gx, gy = hand if hand else (hilt[0], hilt[1])
                length = best**0.5
                ux, uy = (tip[0] - hilt[0]) / length, (tip[1] - hilt[1]) / length
                last_grip[r] = (gx, gy, ux, uy, hand, target)
            else:
                if r not in last_grip:
                    continue
                gx, gy, ux, uy, hand, target = last_grip[r]
                canvas = PixelCanvas(target)
            if is_attack:
                x0, y0 = round(gx - ux * 4), round(gy - uy * 4)
                x1, y1 = round(gx + ux * 11), round(gy + uy * 11)
                ox, oy = round(gx + ux * 12.5), round(gy + uy * 12.5)
                nx, ny = (1, 0) if abs(uy) >= abs(ux) else (0, 1)
            else:
                # upright through the hand, the orb always just above the head (also when the staff hangs behind the
                # body). In the side views the staff leans forwards (the side the figure faces), otherwise the lean
                # would flip with the hand on every walk frame; from the front and back it leans to the hand's side.
                facing = r % rows  # 0 front, 1 left, 2 right, 3 back
                lean = -1 if facing == 1 else 1 if facing == 2 else (1 if gx >= cx else -1)
                ox, oy = gx + lean * 3, head_top - 3
                vx, vy = ox - gx, oy - gy
                length = max(1, (vx * vx + vy * vy) ** 0.5)
                vx, vy = vx / length, vy / length
                x0, y0 = round(gx - vx * 9), round(gy - vy * 9)
                x1, y1 = round(ox - vx * 1.5), round(oy - vy * 1.5)
                nx, ny = (1, 0)
            draw_line(canvas, x0 + nx, y0 + ny, x1 + nx, y1 + ny, colors["wood_light"])
            draw_line(canvas, x0, y0, x1, y1, colors["wood"])
            for yy in range(-1, 2):  # the orb on top
                for xx in range(-1, 2):
                    is_corner = abs(xx) + abs(yy) == 2
                    canvas.pixels[ox + xx, oy + yy] = (colors["orb_outline"] if is_corner else colors["orb"]) + (255,)
            for xx, yy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                canvas.pixels[ox + xx, oy + yy] = colors["orb_outline"] + (255,)
            canvas.pixels[ox, oy] = colors["orb_highlight"] + (255,)
            # the hand back on top of the staff, so it holds it (only when the staff is in front of the body)
            if target is front and hand:
                for y in range(gy - 2, gy + 3):
                    for x in range(gx - 2, gx + 3):
                        if r * fh <= y < (r + 1) * fh and c * fw <= x < (c + 1) * fw:
                            p = body_px[x, y]
                            if p[3] > 0 and p[:3] in SKIN and target.getpixel((x, y))[3] > 0:
                                canvas.pixels[x, y] = p
    return front, back


STAFFS = {
    "staff1": dict(
        wood=(85, 45, 33),
        wood_light=(147, 97, 65),
        orb_outline=(30, 80, 44),
        orb=(90, 200, 110),
        orb_highlight=(210, 255, 220),
        arc=(150, 200, 255),
    ),
    "staff2": dict(
        wood=(60, 34, 24),
        wood_light=(118, 76, 48),
        orb_outline=(30, 50, 130),
        orb=(90, 140, 240),
        orb_highlight=(220, 236, 255),
        arc=(150, 200, 255),
    ),
    "staff3": dict(
        wood=(50, 52, 72),
        wood_light=(150, 156, 180),
        orb_outline=(90, 30, 140),
        orb=(190, 110, 255),
        orb_highlight=(245, 225, 255),
        arc=(200, 170, 255),
    ),
}

# ---------- cloaks: a cape derived from the body and the tunic, per frame ----------
# The cape hangs behind the figure (layer '..._back', below the body) and comes in front of the body where needed
# (the layer without _back): seen from behind it covers the whole back, from the side the rear shoulder, from the
# front only the collar with buckle. Width and length follow the tunic and the body of that frame, so the cape moves
# along with walking and attacking.
CLOAKS = {
    "cloak1": dict(palette=[(62, 28, 18), (110, 40, 30), (158, 62, 46), (196, 96, 74)], trim=None),  # travel: rust
    "cloak2": dict(palette=[(18, 28, 66), (34, 52, 116), (58, 84, 160), (96, 126, 204)], trim=None),  # wool: blue
    "cloak3": dict(palette=[(14, 12, 22), (32, 28, 42), (54, 48, 68), (82, 76, 100)], trim=None),  # shadow
    # royal cloak with a golden hem
    "cloak4": dict(palette=[(84, 10, 16), (136, 20, 30), (186, 38, 50), (226, 86, 88)], trim=(222, 182, 70)),
}


def dilate(mask):
    d = mask.copy()
    d[1:, :] |= mask[:-1, :]
    d[:-1, :] |= mask[1:, :]
    d[:, 1:] |= mask[:, :-1]
    d[:, :-1] |= mask[:, 1:]
    return d


def cloak(body, head, palette, trim=None, fw=64, fh=64):
    """A cape per frame, hung from the shoulders (just below the head) down to the calves.

    Returns (front, back): 'back' goes below the body, 'front' over it.
      front view: the cape behind the body, visible at the sides and between the legs; in front only collar and buckle
      back view:  the whole cape over the back (the head is still drawn over it)
      side view:  hangs from the rear shoulder diagonally backwards, flaring out further while walking;
                  in front only the piece over the rear shoulder
    The shape is smooth (a trapezium with a wavy hem), not the ragged outline of arms and legs."""
    body_px = np.array(body)
    head_px = np.array(head)
    height, width = body_px.shape[:2]
    rows = height // fh
    cols = width // fw
    front = np.zeros_like(body_px)
    back = np.zeros_like(body_px)
    edge, dark, mid, light = [np.array(k + (255,), dtype=np.uint8) for k in palette]
    trim_color = np.array(trim + (255,), dtype=np.uint8) if trim else None
    buckle = trim_color if trim_color is not None else np.array((214, 178, 70, 255), dtype=np.uint8)

    def fill(mask, shoulder_y, hem, light_from_left, target, folds=True):
        """Shade with light from the light side, folds as vertical stripes, a hem at the bottom, outline around it."""
        ys, xs = np.nonzero(mask)
        if not len(ys):
            return
        x0, x1 = xs.min(), xs.max()
        w = max(1, x1 - x0)
        for y, x in zip(ys, xs, strict=True):
            t = (x - x0) / w if light_from_left else (x1 - x) / w  # 0 = light side, 1 = shadow side
            k = light if t < 0.22 else (dark if t > 0.7 else mid)
            if folds and y > shoulder_y + 2 and t >= 0.22 and (x - x0) % 4 == 2:
                k = dark  # folds
            if y <= shoulder_y:
                k = light  # the shoulder line catches the light
            if y >= hem - 1:
                k = trim_color if trim_color is not None else dark  # hem
            target[y, x] = k
        target[dilate(mask) & ~mask] = edge

    for r in range(rows):
        direction = r % 4
        is_dead = r >= 16
        is_walking = 4 <= r < 8
        for c in range(cols):
            fy, fx = r * fh, c * fw
            body_mask = body_px[fy : fy + fh, fx : fx + fw, 3] > 0
            head_mask = head_px[fy : fy + fh, fx : fx + fw, 3] > 0
            if not body_mask.any() or not head_mask.any():
                continue
            body_ys, _ = np.nonzero(body_mask)
            head_ys, _ = np.nonzero(head_mask)
            feet = body_ys.max()
            neck = min(head_ys.max(), head_ys.min() + 15)  # a hand in the head layer does not count as the neck
            shoulder_y = neck - 1  # the shoulder line, just below the chin (the head is drawn over it)
            if is_dead or feet - shoulder_y < 5:
                continue  # lying down or collapsed: no cape
            hem = feet - 3  # down to the calves
            row_pixels = np.nonzero(body_mask[shoulder_y + 2])[0]
            if not len(row_pixels):
                continue
            xl, xr = row_pixels.min(), row_pixels.max()
            cx = (xl + xr) / 2
            cape_height = hem - shoulder_y
            cape = np.zeros((fh, fw), bool)
            sway = (c % 2) * 2 - 1  # alternating per frame: the hem swings
            for y in range(shoulder_y, hem + 1):
                f = (y - shoulder_y) / cape_height
                if direction in (0, 3):  # front and back view: a trapezium that flares out a little
                    spread = 1 + 2.2 * f
                    swing = (sway if is_walking else 0) * f * f
                    left, right = xl - spread + swing, xr + spread + swing
                else:  # side view: from the rear shoulder diagonally backwards
                    trail = (3.5 if is_walking else 1.8) * f + (sway * 1.2 * f * f if is_walking else 0)
                    if direction == 1:  # facing left: the back is on the right
                        left, right = cx + 1 + 1.5 * f, xr + 1 + trail
                    else:  # facing right: the back is on the left
                        left, right = xl - 1 - trail, cx - 1 - 1.5 * f
                cape[y, max(0, int(round(left))) : min(fw, int(round(right)) + 1)] = True
            # a scalloped hem
            for x in np.nonzero(cape[hem])[0]:
                if (x + c) % 3 == 0:
                    cape[hem, x] = False
            back_view = back[fy : fy + fh, fx : fx + fw]
            front_view = front[fy : fy + fh, fx : fx + fw]
            if direction == 3:
                fill(cape, shoulder_y, hem, True, front_view)
            elif direction == 0:
                fill(cape, shoulder_y, hem, True, back_view)
                collar = np.zeros((fh, fw), bool)
                collar[shoulder_y : shoulder_y + 2, int(xl) : int(xr) + 1] = True
                fill(collar, shoulder_y, hem, True, front_view, folds=False)
                front_view[shoulder_y + 1, int(round(cx))] = buckle
            else:
                fill(cape, shoulder_y, hem, direction == 2, back_view)
                shoulder = np.zeros((fh, fw), bool)  # only a narrow strip over the rear shoulder
                if direction == 1:
                    shoulder[shoulder_y : shoulder_y + 2, int(xr) - 1 :] = cape[
                        shoulder_y : shoulder_y + 2, int(xr) - 1 :
                    ]
                else:
                    shoulder[shoulder_y : shoulder_y + 2, : int(xl) + 2] = cape[
                        shoulder_y : shoulder_y + 2, : int(xl) + 2
                    ]
                fill(shoulder, shoulder_y, hem, direction == 2, front_view, folds=False)
    return Image.fromarray(front), Image.fromarray(back)


# ---------- second classes: Knight and Crusader armour (steel blue / silver with gold) ----------
def hsv_layer(im, fn):
    """Apply fn(h, s, v) -> (h, s, v) to every pixel that is not outline."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or (r < 40 and g < 40 and b < 40):
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h, s, v = fn(h, s, v)
            rr, gg, bb = colorsys.hsv_to_rgb(h % 1, max(0, min(1, s)), max(0, min(1, v)))
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return out


def knight_steel(h, s, v):
    """Dark steel blue."""
    return h + 0.04, s * 0.55, v * 0.82


def crusader_silver(h, s, v):
    """Silver; red becomes gold."""
    if h < 0.06 or h > 0.93:
        return 0.12, 0.8, min(1, v * 1.25)
    return h, s * 0.2, min(1, v * 1.2)


HAT_FRONT = """
........oo........
.......ohlo.......
.......ohlo.......
......ohmlo.......
......ohmllo......
.....ohmmllo......
.....ohmmmlo......
....ohmmmmllo.....
....ohmmmmmlo.....
...odmmmmmmllo....
...oggggggggglo...
..oooooooooooooo..
.ollllmmmmmmmlllo.
.oooooooooooooooo."""
HAT_RIGHT = """
....oo.........
...ohlo........
...ohlo........
...ohmlo.......
....ohmlo......
....ohmmlo.....
.....ohmmlo....
.....ohmmmlo...
......ohmmmlo..
......odmmmmlo.
.....ogggggggo.
...oooooooooooo
..ollmmmmmmmllo
...oooooooooooo"""
HAT_BACK = """
........oo........
.......ollo.......
.......ollo.......
......olllo.......
......ollllo......
.....ommmllo......
.....ommmmlo......
....ommmmmllo.....
....ommmmmmlo.....
...odmmmmmmllo....
...oggggggggglo...
..oooooooooooooo..
.ollllmmmmmmmlllo.
.oooooooooooooooo."""
FELT = {
    "o": (26, 24, 52),
    "d": (34, 50, 110),
    "m": (56, 80, 160),
    "l": (90, 124, 205),
    "h": (140, 172, 235),
    "g": (214, 172, 78),
}
ARCANE = {
    "o": (36, 16, 52),
    "d": (70, 30, 110),
    "m": (104, 50, 156),
    "l": (140, 86, 200),
    "h": (190, 150, 236),
    "g": (255, 214, 110),
}


def build_class_gear(stacked, body, out_dir):
    """Headgear, robes, staffs, cloaks and second-class armour, all derived from the hero layers."""
    head = stacked[1]
    headgear(head, CAP_FRONT, CAP_RIGHT, CAP_BACK, LEATHER, brim=8).save(out_dir / "cap.png")
    headgear(head, HELM_FRONT, HELM_RIGHT, HELM_BACK, IRON, brim=8).save(out_dir / "helm.png")

    tunic_layer = layer_difference(stacked[2], body)  # the level-1 tunic without the body
    for name, palette in ROBES.items():
        robe(tunic_layer, body, palette).save(out_dir / f"{name}.png")
    for name, colors in STAFFS.items():
        front, back = staff(stacked[3], stacked[4], body, head, colors)
        front.save(out_dir / f"{name}.png")
        back.save(out_dir / f"{name}_back.png")

    for name, spec in CLOAKS.items():
        front, back = cloak(body, head, spec["palette"], spec["trim"])
        front.save(out_dir / f"{name}.png")
        back.save(out_dir / f"{name}_back.png")

    for name, palette in ROBES_TIER2.items():
        robe(tunic_layer, body, palette).save(out_dir / f"{name}.png")
    armor3_layer = layer_difference(stacked[8], body)
    hsv_layer(armor3_layer, knight_steel).save(out_dir / "armor4.png")
    hsv_layer(armor3_layer, crusader_silver).save(out_dir / "armor5.png")

    headgear(head, HAT_FRONT, HAT_RIGHT, HAT_BACK, FELT, brim=13).save(out_dir / "hat1.png")
    headgear(head, HAT_FRONT, HAT_RIGHT, HAT_BACK, ARCANE, brim=13).save(out_dir / "hat2.png")


# ---------- animals ----------
def recolor_animal(im, fn):
    """Apply fn(r, g, b) to every non-transparent pixel; the black outline stays."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or (r < 40 and g < 40 and b < 40):
                continue
            px[x, y] = (*fn(r, g, b), a)
    return out


def wolf_color(r, g, b):
    """Orange fur -> blue grey; white and light parts stay light."""
    v = max(r, g, b)
    s = 0 if v == 0 else (v - min(r, g, b)) / v
    if s < 0.22:
        return (r, g, b)
    return (int(v * 0.62), int(v * 0.66), int(v * 0.74))


def dire_boar_color(r, g, b):
    """Darker and redder; light parts (the tusks) stay light."""
    v = max(r, g, b)
    if v > 200 and max(r, g, b) - min(r, g, b) < 60:
        return (r, g, b)
    return (int(r * 0.58), int(g * 0.42), int(b * 0.40))


FOX_ANIMS = ("Fox_Idle", "Fox_walk", "Fox_Run", "Fox_Hurt", "Fox_Death")
BOAR_ANIMS = ("Boar_Idle", "Boar_Walk", "Boar_Attack", "Boar_Hurt", "Boar_Death")
# name -> (pack folder, animation sheets, recolour function or None)
ANIMALS = {
    "rabbit": ("Hare", ("Hare_Idle", "Hare_Walk", "Hare_Run", "Hare_Hurt", "Hare_Death"), None),
    "fox": ("Fox", FOX_ANIMS, None),
    "boar": ("Boar", BOAR_ANIMS, None),
    # forest animals: the stag from the pack, and a wolf and a dire boar recoloured from fox and boar
    "stag": ("Deer", ("Deer_Idle", "Deer_Walk", "Deer_Run", "Deer_Hurt", "Deer_Death"), None),
    "wolf": ("Fox", FOX_ANIMS, wolf_color),
    "dire_boar": ("Boar", BOAR_ANIMS, dire_boar_color),
}


def build_animals(animals_dir, out_dir):
    for name, (folder, anims, recolor) in ANIMALS.items():
        sheets = [open_rgba(animals_dir / folder / f"{a}.png") for a in anims]
        if recolor:
            sheets = [recolor_animal(sheet, recolor) for sheet in sheets]
        stack_animations(sheets, 32, 32, 6).save(out_dir / f"{name}.png")
        print(name, [frames_in_row(sheet, 32, 32, 0) for sheet in sheets])


# ---------- ground tiles and decor ----------
# name -> (object folder in the village pack, number)
VILLAGE_DECOR = {
    "well": ("3 Decor", 13),
    "stall": ("6 Tent", 1),
    "stall2": ("6 Tent", 3),
    "house_a": ("7 House", 1),
    "house_b": ("7 House", 2),
    "house_c": ("7 House", 3),
    "house_d": ("7 House", 4),
    "barrel": ("4 Box", 1),
    "chest": ("4 Box", 3),
    "lantern": ("3 Decor", 9),
    "cart": ("3 Decor", 1),
    "sign": ("3 Decor", 14),
    "anvil": ("3 Decor", 7),
    "woodpile": ("3 Decor", 5),
}
# name -> crop box in the fortress collage
FORTRESS_DECOR = {
    "tree": (160, 49, 192, 94),
    "tree2": (193, 65, 223, 96),
    "bush": (224, 72, 240, 95),
    "pine": (241, 48, 270, 96),
    "pine2": (270, 62, 288, 96),
    "rock": (247, 22, 268, 40),
    "rock2": (208, 19, 224, 31),
    "flowers": (257, 163, 270, 173),
    "flowers2": (212, 164, 221, 173),
    "grass_tuft": (162, 225, 224, 286),
}


def field_tile(fields, number):
    """Tile `number` (1-based, 8 per row) from the village fields tileset."""
    x = ((number - 1) % 8) * 32
    y = ((number - 1) // 8) * 32
    return fields.crop((x, y, x + 32, y + 32))


def village_object(village_dir, folder, number):
    return open_rgba(village_dir / "2 Objects" / folder / f"{number}.png")


def build_ground_and_decor(village_dir, fortress_dir, out_dir):
    """merchant.png, ground.png, the village and fortress decor; returns the fields tileset for the textures."""
    # the merchant: a fortress-kit figure with one facing direction
    open_rgba(fortress_dir / "Characters/Character_2/Idle.png").save(out_dir / "merchant.png")

    fields = open_rgba(village_dir / "1 Tiles/FieldsTileset.png")
    grass = field_tile(fields, 38)
    grass1 = grass.copy()
    grass1.alpha_composite(village_object(village_dir, "5 Grass", 2), (6, 18))
    grass1.alpha_composite(village_object(village_dir, "5 Grass", 5), (20, 6))
    grass2 = grass.copy()
    grass2.alpha_composite(village_object(village_dir, "2 Stone", 3), (22, 20))
    grass2.alpha_composite(village_object(village_dir, "5 Grass", 1), (8, 8))
    atlas = Image.new("RGBA", (7 * 32, 32))
    tiles = (
        grass,
        grass1,
        grass2,
        field_tile(fields, 1),
        field_tile(fields, 27),
        field_tile(fields, 6),
        field_tile(fields, 10),
    )
    for i, tile in enumerate(tiles):
        atlas.paste(tile, (i * 32, 0))
    atlas.save(out_dir / "ground.png")

    for name, (folder, number) in VILLAGE_DECOR.items():
        village_object(village_dir, folder, number).save(out_dir / f"{name}.png")
    # fence: two columns of the palisade (rows 1 and 2 of Tileset2)
    open_rgba(village_dir / "1.1 Tiles/Tileset2.png").crop((32, 0, 96, 64)).save(out_dir / "fence.png")

    # trees, rocks and flowers from the fortress collage
    collage = open_rgba(fortress_dir / "Tileset/Tiled_Map.png")
    for name, box in FORTRESS_DECOR.items():
        collage.crop(box).save(out_dir / f"{name}.png")
    return fields


# ---------- tileable textures for the 3D village (builders.js), in the palette of the sprites ----------
# This way the 3D surroundings match the Craftpix style: the same colours, the same pixel density (16 px per unit).
PALETTE = {
    "outline": (12, 15, 42),
    "roof": (108, 129, 161),
    "roof_dark": (64, 82, 115),
    "plaster": (254, 225, 184),
    "beam": (181, 89, 69),
    "beam_dark": (61, 51, 51),
    "stone": (135, 133, 124),
    "stone_dark": (99, 102, 99),
    "stone_light": (188, 173, 159),
    "wood": (181, 89, 69),
    "wood_light": (208, 119, 83),
    "wood_dark": (115, 76, 68),
    "wood_highlight": (235, 150, 97),
    "red": (178, 45, 45),
    "tan": (212, 198, 146),
    "green": (129, 148, 71),
    "glass": (108, 129, 161),
    "glass_light": (188, 173, 159),
    "water": (88, 124, 166),
    "water_light": (170, 196, 222),
    "water_dark": (64, 82, 115),
    "hay": (212, 198, 146),
    "hay_dark": (170, 148, 90),
    "soil": (160, 118, 72),
    "soil_dark": (120, 86, 52),
}


def texture(tex_dir, name, w, h, draw):
    """Create a w x h texture; draw(fill) paints rectangles with fill(x0, y0, x1, y1, palette_key), wrapping."""
    im = Image.new("RGBA", (w, h), TRANSPARENT)
    px = im.load()

    def fill(x0, y0, x1, y1, key):
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x % w, y % h] = PALETTE[key] + (255,)

    draw(fill)
    im.save(tex_dir / f"{name}.png")


def draw_wall(fill):
    """Plaster wall with red beams (half-timbering), 64x64."""
    fill(0, 0, 64, 64, "plaster")
    for x in (0, 32):
        fill(x, 0, x + 4, 64, "beam")
    fill(0, 0, 64, 4, "beam")
    fill(0, 60, 64, 64, "beam")
    for i in range(0, 28):  # diagonal braces
        fill(4 + i, 56 - i * 2, 7 + i, 58 - i * 2, "beam")
        fill(36 + i, 56 - i * 2, 39 + i, 58 - i * 2, "beam")
    for x in (0, 32):
        fill(x + 4, 0, x + 5, 64, "beam_dark")
    fill(0, 4, 64, 5, "beam_dark")


def draw_roof(fill):
    """Blue roof tiles, 32x32: rows of 8 with staggered seams."""
    fill(0, 0, 32, 32, "roof")
    for r in range(4):
        y = r * 8
        fill(0, y + 7, 32, y + 8, "roof_dark")
        offset = 8 if r % 2 else 0
        for x in range(offset, 32 + offset, 16):
            fill(x, y, x + 1, y + 8, "roof_dark")
        fill(0, y, 32, y + 1, "outline")


def draw_stone(fill):
    """Grey stone blocks, 32x32."""
    fill(0, 0, 32, 32, "stone")
    for r in range(4):
        y = r * 8
        offset = 8 if r % 2 else 0
        fill(0, y + 7, 32, y + 8, "stone_dark")
        for x in range(offset, 32 + offset, 16):
            fill(x, y, x + 1, y + 8, "stone_dark")
            fill(x + 1, y, x + 15, y + 1, "stone_light")


def planks(base, light, dark):
    """Vertical wooden planks, 32x32."""

    def draw(fill):
        fill(0, 0, 32, 32, base)
        for x in range(0, 32, 8):
            fill(x, 0, x + 1, 32, dark)
            fill(x + 1, 0, x + 2, 32, light)
        for x, y in ((3, 5), (11, 20), (19, 9), (27, 26), (5, 28), (21, 2)):
            fill(x, y, x + 3, y + 1, dark)

    return draw


def stripes(a, b):
    """Awning cloth: vertical stripes, 32x16."""

    def draw(fill):
        for x in range(0, 32, 8):
            fill(x, 0, x + 8, 16, a if (x // 8) % 2 == 0 else b)

    return draw


def draw_glass(fill):
    """Leaded glass, 16x16."""
    fill(0, 0, 16, 16, "glass")
    for i in range(16):
        fill(i, 15 - i, i + 1, 16 - i, "glass_light")
    fill(7, 0, 9, 16, "beam_dark")
    fill(0, 7, 16, 9, "beam_dark")


def draw_water(fill):
    """Water, 32x32."""
    fill(0, 0, 32, 32, "water")
    for x, y, length in ((2, 4, 6), (18, 7, 7), (9, 13, 5), (24, 16, 6), (4, 22, 7), (16, 26, 6), (27, 27, 4)):
        fill(x, y, x + length, y + 1, "water_light")
    for x, y, length in ((12, 3, 4), (3, 10, 5), (22, 11, 4), (14, 19, 6), (26, 22, 4), (8, 29, 5)):
        fill(x, y, x + length, y + 1, "water_dark")


def draw_hay(fill):
    """Hay bale: tan with dark straws, 32x32."""
    fill(0, 0, 32, 32, "hay")
    straws = (
        (2, 3, 6),
        (12, 7, 9),
        (22, 2, 7),
        (5, 14, 8),
        (18, 17, 6),
        (26, 12, 5),
        (1, 24, 7),
        (14, 27, 9),
        (24, 23, 6),
        (9, 20, 4),
    )
    for x, y, length in straws:
        fill(x, y, x + length, y + 1, "hay_dark")


def draw_soil(fill):
    """Tilled soil for the vegetable garden, 32x32 with rows."""
    fill(0, 0, 32, 32, "soil")
    for y in range(2, 32, 8):
        fill(0, y, 32, y + 2, "soil_dark")
    for x, y in ((4, 6), (13, 14), (22, 6), (8, 22), (26, 22), (17, 30)):
        fill(x, y, x + 3, y + 1, "green")
        fill(x + 1, y - 1, x + 2, y, "green")


def build_textures(fields, out_dir):
    tex_dir = out_dir / "tex"
    tex_dir.mkdir(exist_ok=True)
    texture(tex_dir, "wall", 64, 64, draw_wall)
    texture(tex_dir, "roof", 32, 32, draw_roof)
    texture(tex_dir, "stone", 32, 32, draw_stone)
    texture(tex_dir, "wood", 32, 32, planks("wood", "wood_light", "wood_dark"))
    texture(tex_dir, "wood_dark", 32, 32, planks("wood_dark", "wood", "beam_dark"))
    texture(tex_dir, "cloth_red", 32, 16, stripes("red", "plaster"))
    texture(tex_dir, "cloth_green", 32, 16, stripes("green", "tan"))
    texture(tex_dir, "glass", 16, 16, draw_glass)
    texture(tex_dir, "water", 32, 32, draw_water)
    texture(tex_dir, "hay", 32, 32, draw_hay)
    texture(tex_dir, "soil", 32, 32, draw_soil)
    # cobbles and path: the tiles from the Craftpix tileset itself
    field_tile(fields, 1).save(tex_dir / "cobbles.png")
    field_tile(fields, 27).save(tex_dir / "cobbles2.png")
    field_tile(fields, 6).save(tex_dir / "path.png")
    print("textures:", sorted(p.name for p in tex_dir.glob("*.png")))


# ---------- profession nodes: ore veins, herbs and the tree stump ----------
# Ore veins are the fortress rocks with nuggets or crystals in the metal's colour; herbs and the stump are drawn in
# the palette of the fortress bushes and trees. Fills are drawn as characters, the dark outline is added afterwards.
NODE_OUTLINE = (12, 15, 42)
COLLAGE_OUTLINE = (5, 4, 3)
ORE_CANVAS = (29, 24)  # every ore state has the same size, so a vein does not jump when it is mined empty
# metal -> (dark, mid, light, highlight)
ORE_RAMPS = {
    "copper": ((132, 56, 28), (214, 104, 40), (246, 160, 78), (255, 220, 160)),
    "iron": ((66, 44, 46), (124, 74, 60), (170, 104, 76), (214, 168, 140)),
    "silver": ((72, 92, 140), (168, 192, 232), (222, 236, 255), (255, 255, 255)),
    "gold": ((150, 90, 16), (232, 168, 32), (255, 216, 72), (255, 250, 196)),
    "arcane": ((84, 40, 150), (150, 80, 220), (200, 140, 255), (245, 225, 255)),
}
ROCK_SHADOW = (52, 50, 76)  # the dent around a nugget
# nugget shapes: (dx, dy, ramp index); 0 dark .. 3 highlight
NUGGETS = {
    "big": ((1, 0, 2), (2, 0, 3), (0, 1, 2), (1, 1, 1), (2, 1, 1), (3, 1, 0), (1, 2, 0), (2, 2, 0)),
    "mid": ((0, 0, 3), (1, 0, 2), (0, 1, 2), (1, 1, 1), (2, 1, 0)),
    "small": ((0, 0, 2), (1, 0, 1), (1, 1, 0)),
}
# where the nuggets sit on the rock group (top face, left face, front boulder, back boulder)
NUGGET_SPOTS = (
    (4, 8, "big"),
    (10, 7, "mid"),
    (13, 10, "small"),
    (2, 14, "small"),
    (3, 18, "mid"),
    (10, 16, "big"),
    (16, 19, "small"),
    (20, 13, "big"),
    (25, 15, "mid"),
)
# arcane crystals: (x of the base centre, y of the base, height, width)
CRYSTALS = ((7, 9, 8, 3), (11, 10, 5, 2), (23, 13, 7, 3), (15, 18, 4, 2))
CRYSTAL_SPARKLES = ((3, 3), (14, 4), (27, 7), (19, 9))

HERB_COLORS = {
    "l": (173, 184, 52),  # the greens of the fortress bushes
    "m": (127, 142, 68),
    "d": (88, 99, 53),
    "k": (58, 66, 44),
    "t": (79, 52, 47),  # tree trunk
}
# "|" is a stem: drawn after the outline, so thin stems stay green instead of turning into outline
HERBS = {
    "sunleaf": (
        """
.....hhy.....
....hyyyy....
....yyAyya...
.....yaaa....
......|......
.ll...|...ll.
lllm..|..lllm
lllmm.|.llmmm
.llmmlllllmm.
llllmmllmmmll
lmmmmmmmmmmmd
.dmmmddmmmdd.
..ddd..ddd...
""",
        {"y": (248, 197, 58), "h": (255, 236, 150), "a": (210, 132, 36), "A": (176, 96, 32)},
        (),
    ),
    "wolfsbane": (
        """
......q......
.....qpp.....
.....ppx.....
......|......
..q..qpp..q..
.qpp.ppx.qpp.
.ppx..|..ppx.
..|...|...|..
..|..qpp..|..
.d|..ppx..|d.
ddd...|...ddd
dkdd.d|d.ddkd
.dkddddddddk.
ddkkdkkkdkkdd
.kkk.kkk.kkk.
""",
        {"q": (200, 156, 240), "p": (136, 84, 196), "x": (84, 46, 132)},
        (),
    ),
    "moonbloom": (
        """
..b.......b..
.bwb.....bwb.
bwcwb...bwcwb
.bwb..b..bwb.
..|..bwb..|..
..|.bwcwb.|..
..|..bwb..|..
.l|l..|..l|l.
lllml.|.lmlll
.lmmmllllmmm.
lmmmmmmmmmmml
.dmmddmmddmd.
..dd..dd..d..
""",
        {"w": (232, 242, 255), "b": (140, 184, 240), "c": (255, 250, 210)},
        ((1, 6, (200, 224, 255)), (13, 0, (232, 242, 255)), (7, 1, (232, 242, 255)), (14, 9, (200, 224, 255))),
    ),
    "embermoss": (
        """
......rRr.......
..rRr.rRRrr.rr..
.rRRRrRRRRrrRRr.
rRRerRRrrRRrRerr
rRrrrrerrRRrrrrr
rrrrrdrrrrrrerrd
rrerdddrrrdrrddd
.ddddddddddddd..
""",
        {"R": (240, 132, 64), "r": (200, 64, 40), "d": (130, 36, 34), "e": (255, 222, 96)},
        ((4, 0, (255, 222, 96)), (11, 0, (255, 170, 70)), (16, 1, (255, 222, 96))),
    ),
    "starpetal": (
        """
...w..........
..wyw.........
wwwgwww...w...
.wwyww...wyw..
.ww.ww.wwwgwww
...|....wwyww.
...|....ww.ww.
...|.......|..
.l.|l.....l|l.
llmlll...lllml
.lmmmlllllmmm.
llmmmmmmmmmmml
.dmmddmmmddmd.
..ddd.ddd.dd..
""",
        {"w": (255, 252, 236), "y": (236, 206, 120), "g": (248, 184, 48)},
        ((13, 1, (255, 236, 150)), (0, 0, (255, 236, 150))),
    ),
    "picked": (
        """
..c...c...c..
..|...|...|..
.l|l..|..l|l.
lllml.|.lmlll
.lmmmllllmmm.
.dmmddmmddmd.
..dd..dd..d..
""",
        {"c": (206, 214, 130)},
        (),
    ),
}

STUMP = """
..cccccc..
.cbbddbbc.
cbbdbbdbbc
.cbbddbbcs
tcccccccss
ttttstttss
tttttsttss
tstttttsss
ttttsttssss
tt.tttt..ss
"""
STUMP_COLORS = {
    "c": (208, 119, 83),  # cut face in the palette of the woodpile
    "b": (235, 150, 97),
    "d": (181, 89, 69),
    "t": (79, 52, 47),  # bark of the fortress tree trunk
    "s": (56, 36, 36),
}


def add_outline(im, color=NODE_OUTLINE):
    """Dark border around every opaque pixel (4-neighbourhood), like the Craftpix props."""
    pad = Image.new("RGBA", (im.width + 2, im.height + 2), TRANSPARENT)
    pad.paste(im, (1, 1))
    a = np.array(pad)
    filled = a[:, :, 3] > 0
    border = np.zeros_like(filled)
    border[1:, :] |= filled[:-1, :]
    border[:-1, :] |= filled[1:, :]
    border[:, 1:] |= filled[:, :-1]
    border[:, :-1] |= filled[:, 1:]
    a[border & ~filled] = color + (255,)
    return Image.fromarray(a).copy()  # a copy, so the result can be drawn on


def replace_color(im, old, new):
    a = np.array(im)
    a[(a[:, :, 0] == old[0]) & (a[:, :, 1] == old[1]) & (a[:, :, 2] == old[2]) & (a[:, :, 3] > 0), :3] = new
    return Image.fromarray(a)


def rock_group(rock, rock2):
    """The big fortress rock in front of a mirrored small one, on the ore canvas."""
    im = Image.new("RGBA", ORE_CANVAS, TRANSPARENT)
    top = ORE_CANVAS[1] - 20
    im.alpha_composite(mirror(rock2), (13, top + 8))
    im.alpha_composite(rock, (0, top + 2))
    return replace_color(im, COLLAGE_OUTLINE, NODE_OUTLINE)


def ore_vein(group, ramp, crystals=False):
    im = group.copy()
    px = im.load()
    for x, y, shape in NUGGET_SPOTS:
        cells = {(x + dx, y + dy) for dx, dy, _ in NUGGETS[shape]}
        for cx, cy in cells:  # a dark dent below and to the right of the nugget
            for sx, sy in ((cx + 1, cy), (cx, cy + 1), (cx + 1, cy + 1)):
                if (sx, sy) not in cells and px[sx, sy][3] > 0 and px[sx, sy][:3] != NODE_OUTLINE:
                    px[sx, sy] = ROCK_SHADOW + (255,)
        for dx, dy, k in NUGGETS[shape]:
            if px[x + dx, y + dy][3] > 0:
                px[x + dx, y + dy] = ramp[k] + (255,)
    if not crystals:
        return im
    shards = Image.new("RGBA", im.size, TRANSPARENT)
    sp = shards.load()
    for cx, base, height, width in CRYSTALS:
        for dy in range(height):
            half = min(width, height - dy)  # straight sides, then a point
            for dx in range(-half + 1, half):
                k = 2 if dx < 0 else 1 if dx == 0 else 0
                if dx == -1 and dy > 0 and dy % 3 == 1:
                    k = 3  # glints on the lit facet
                sp[cx + dx, base - dy] = ramp[k] + (255,)
        sp[cx, base - height + 1] = ramp[3] + (255,)
    shards = add_outline(shards).crop((1, 1, im.width + 1, im.height + 1))
    im.alpha_composite(shards)
    for x, y in CRYSTAL_SPARKLES:
        if px[x, y][3] == 0:
            px[x, y] = ramp[3] + (255,)
    return im


def herb(fill, colors, sparkles):
    im = add_outline(pixel_drawing(fill, {**HERB_COLORS, **colors}))
    px = im.load()
    for y, line in enumerate(fill.strip("\n").split("\n")):
        for x, ch in enumerate(line):
            if ch == "|":
                px[x + 1, y + 1] = HERB_COLORS["d"] + (255,)
    canvas = Image.new("RGBA", (im.width + 2, im.height + 2), TRANSPARENT)  # room for sparkles around the plant
    canvas.alpha_composite(im, (1, 1))
    px = canvas.load()
    for x, y, color in sparkles:
        if px[x, y][3] == 0:
            px[x, y] = color + (255,)
    return canvas.crop(canvas.getbbox())


def build_resource_nodes(out_dir):
    """ore_<metal>.png, ore_depleted.png, herb_<name>.png, herb_picked.png and tree_stump.png."""
    rock = open_rgba(out_dir / "rock.png")
    rock2 = open_rgba(out_dir / "rock2.png")
    group = rock_group(rock, rock2)
    group.save(out_dir / "ore_depleted.png")
    for metal, ramp in ORE_RAMPS.items():
        ore_vein(group, ramp, crystals=metal == "arcane").save(out_dir / f"ore_{metal}.png")
    for name, (fill, colors, sparkles) in HERBS.items():
        herb(fill, colors, sparkles).save(out_dir / f"herb_{name}.png")
    add_outline(pixel_drawing(STUMP, STUMP_COLORS)).save(out_dir / "tree_stump.png")


# ---------- effects: Craftpix "Free Pixel Magic Sprite Effects" and "11 Free Pixel Art Explosion Sprites" ----------
# Separate frames are cut into one row (tight around the drawing, square and centred so the animation does not
# jump). The sizes go into sprites/fx/fx.json, so effects.js needs to know nothing about the source.

# name -> (folder, file prefix, frame numbers, fps)
EXPLOSION_SEQUENCES = {
    "explosion": ("Explosion", "Explosion", range(1, 11), 20),
    "fire_ring": ("Circle_explosion", "Circle_explosion", range(1, 11), 18),
    "frost": ("Explosion_blue_circle", "Explosion_blue_circle", range(1, 11), 18),
    "frost2": ("Explosion_blue_oval", "Explosion_blue_oval", range(1, 11), 16),
    "green_burst": ("Explosion_gas_circle", "Explosion_gas_circle", range(1, 11), 18),
    "two_tone": ("Explosion_two_colors", "Explosion_two_colors", range(1, 11), 18),
    "smoke": ("Smoke", "Smoke", range(1, 7), 12),
    "spark": ("Lightning", "Lightning_spot", range(1, 5), 16),
    "fire": ("Fire", "Fire", range(1, 7), 10),  # burning ground (loops)
    "mushroom_cloud": ("Nuclear_explosion", "Nuclear_explosion", range(1, 11), 14),  # the impact of Starfall
    "gas_cloud": ("Explosion_gas", "Explosion_gas", range(1, 11), 16),
}
LIGHTNING_FRAMES = (
    "Lightning_beginning1",
    "Lightning_beginning2",
    "Lightning_beginning3",
    "Lightning_beginning4",
    "Lightning_beginning5",
    "Lightning_cycle1",
    "Lightning_cycle2",
    "Lightning_cycle3",
    "Lightning_end1",
    "Lightning_end2",
    "Lightning_end3",
)
# name -> (magic sheet file name, fps); the sheets are 72 px high with frames 72 px wide
MAGIC_SHEETS = {
    "ring": ("2", 14),
    "slash": ("3_2", 18),
    "comet": ("4_1", 12),
    "spikes": ("7", 14),
    "sparkle": ("8", 12),
    "flash": ("9", 18),
    "roots": ("1", 14),
    "splash": ("10", 14),
    "beam": ("3", 18),
    "hearts": ("5", 12),
    "splatter": ("6_2", 16),
    "burst": ("4_2", 16),
    "candle": ("6", 12),
}


def crop_sequence(frames, margin=2):
    """Crop every frame to the same square (around the frame centre) and place them side by side."""
    x0 = min(f.getbbox()[0] for f in frames)
    y0 = min(f.getbbox()[1] for f in frames)
    x1 = max(f.getbbox()[2] for f in frames)
    y1 = max(f.getbbox()[3] for f in frames)
    w, h = frames[0].size
    r = max(w / 2 - x0, x1 - w / 2, h / 2 - y0, y1 - h / 2) + margin
    r = int(min(r, w / 2, h / 2))
    s = 2 * r
    out = Image.new("RGBA", (s * len(frames), s), TRANSPARENT)
    for i, f in enumerate(frames):
        out.paste(f.crop((w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r)), (i * s, 0))
    return out, s


def build_effect_sheets(packs_dir, out_dir):
    import build_effects  # found through the sys.path entry added in main()

    explosion_dir = packs_dir / "fx-explosion/PNG"
    magic_dir = packs_dir / "fx-magic/1 Magic"
    fx_dir = out_dir / "fx"
    fx_dir.mkdir(exist_ok=True)
    fx_info = {}
    for name, (folder, prefix, numbers, fps) in EXPLOSION_SEQUENCES.items():
        frames = [open_rgba(explosion_dir / folder / f"{prefix}{i}.png") for i in numbers]
        sheet, s = crop_sequence(frames)
        sheet.save(fx_dir / f"{name}.png")
        fx_info[name] = dict(fw=s, fh=s, n=len(numbers), fps=fps)
    # the lightning: start, three strikes, end; tall and narrow, not square
    lightning = [open_rgba(explosion_dir / "Lightning" / f"{n}.png") for n in LIGHTNING_FRAMES]
    sheet = Image.new("RGBA", (64 * len(lightning), 193), TRANSPARENT)
    for i, f in enumerate(lightning):
        sheet.paste(f, (i * 64, 0))
    sheet.save(fx_dir / "lightning.png")
    fx_info["lightning"] = dict(fw=64, fh=193, n=len(lightning), fps=16)
    for name, (file_name, fps) in MAGIC_SHEETS.items():
        im = open_rgba(magic_dir / f"{file_name}.png")
        im.save(fx_dir / f"{name}.png")
        fx_info[name] = dict(fw=72, fh=72, n=im.width // 72, fps=fps)
    # plus the procedural effects (ice, steel, light, earth, spirits, shields) from build_effects.py
    fx_info.update(build_effects.build(fx_dir))
    (fx_dir / "fx.json").write_text(json.dumps(fx_info))
    print("effects:", {k: (v["fw"], v["n"]) for k, v in fx_info.items()})


# ---------- smooth version: Scale2x twice (4x) and back down to 2x with Lanczos ----------
# Scale2x (EPX) smooths diagonal pixel stairs without blurring; the last step softens the edges.
# The engine can draw these 2x sprites with soft filtering ("smooth graphics" in the admin panel).
def scale2x(a):
    """a: array (h, w, 4) uint8 -> (2h, 2w, 4)."""
    h, w, _ = a.shape
    v = a.view(np.uint32).reshape(h, w)  # one number per pixel, for fast comparison
    p = v
    above = np.vstack([v[:1], v[:-1]])
    below = np.vstack([v[1:], v[-1:]])
    left = np.hstack([v[:, :1], v[:, :-1]])
    right = np.hstack([v[:, 1:], v[:, -1:]])
    e0 = np.where((left == above) & (left != below) & (above != right), above, p)
    e1 = np.where((above == right) & (above != left) & (right != below), right, p)
    e2 = np.where((below == left) & (below != right) & (left != above), left, p)
    e3 = np.where((right == below) & (right != above) & (below != left), below, p)
    out = np.empty((h * 2, w * 2), dtype=np.uint32)
    out[0::2, 0::2] = e0
    out[0::2, 1::2] = e1
    out[1::2, 0::2] = e2
    out[1::2, 1::2] = e3
    return out.view(np.uint8).reshape(h * 2, w * 2, 4)


def smooth(im):
    a = np.array(im.convert("RGBA"))
    a[a[:, :, 3] == 0] = 0  # make transparent pixels identical, otherwise Scale2x sees false edges
    b = scale2x(scale2x(a))
    return Image.fromarray(b, "RGBA").resize((im.width * 2, im.height * 2), Image.LANCZOS)


def build_smooth(out_dir):
    smooth_dir = out_dir / "smooth"
    smooth_dir.mkdir(exist_ok=True)
    for path in sorted(q for q in out_dir.glob("*.png") if q.stem != "icons"):
        smooth(Image.open(path)).save(smooth_dir / path.name)
    print("smooth sprites:", len(list(smooth_dir.glob("*.png"))))


def main():
    packs_dir = pathlib.Path(sys.argv[1])
    out_dir = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "runeveld/sprites")
    out_dir.mkdir(parents=True, exist_ok=True)
    # `python3 -I` leaves the script directory off sys.path; build_effects.py lives next to this file
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

    swordsman_dir = packs_dir / "free-swordsman-1-3-level-pixel-top-down-sprite-character/PNG"
    animals_dir = packs_dir / "free-top-down-hunt-animals-pixel-sprite-pack/PNG/Without_shadow"
    village_dir = packs_dir / "free-village-pixel-tileset-for-top-down-defense"
    fortress_dir = packs_dir / "free-medieval-fortress-top-down-pixel-minigame-kit"

    stacked, body = build_hero_layers(swordsman_dir, out_dir)
    build_class_gear(stacked, body, out_dir)
    build_animals(animals_dir, out_dir)
    fields = build_ground_and_decor(village_dir, fortress_dir, out_dir)
    build_resource_nodes(out_dir)
    build_textures(fields, out_dir)
    build_effect_sheets(packs_dir, out_dir)
    build_smooth(out_dir)
    print("done:", sorted(p.name for p in out_dir.glob("*.png")))


if __name__ == "__main__":
    main()
