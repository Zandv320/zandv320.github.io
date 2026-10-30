"""Eldoria: procedural pixel effects in the style of the Craftpix sheets.

Ice, snow, steel, light, earth, spirits and shields that the free packs do not include. Every effect function returns a
list of frames (RGBA, PIL) and a frame rate; build() writes them as single-row sheets to sprites/fx/ and returns the
info for fx.json. Dark outlines like the sprites, limited palettes.

Usage: python3 -I runeveld/tools/build_effects.py [runeveld/sprites/fx]   (build_sprites.py calls this as well)
"""

import json
import math
import pathlib
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

OUTLINE = (12, 15, 42, 255)
PALETTES = {
    "ice": [(63, 143, 201), (143, 211, 244), (223, 247, 255), (255, 255, 255)],
    "steel": [(96, 108, 138), (190, 200, 220), (236, 240, 248), (255, 255, 255)],
    "gold": [(196, 140, 40), (240, 196, 90), (255, 236, 170), (255, 252, 230)],
    "earth": [(90, 67, 40), (138, 106, 62), (201, 160, 106), (232, 206, 160)],
    "spirit": [(110, 74, 201), (180, 140, 255), (232, 216, 255), (255, 255, 255)],
    "green": [(46, 110, 52), (96, 170, 80), (160, 220, 120), (230, 250, 200)],
    "white": [(200, 200, 210), (236, 236, 244), (250, 250, 255), (255, 255, 255)],
}


def blank(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def outline(img, color=OUTLINE, alpha_min=40):
    """Dark border: every transparent pixel next to a filled pixel (4-neighbourhood)."""
    a = np.array(img)
    filled = a[:, :, 3] >= alpha_min
    neighbour = np.zeros_like(filled)
    neighbour[1:, :] |= filled[:-1, :]
    neighbour[:-1, :] |= filled[1:, :]
    neighbour[:, 1:] |= filled[:, :-1]
    neighbour[:, :-1] |= filled[:, 1:]
    border = neighbour & ~filled
    a[border] = color
    return Image.fromarray(a)


def fade(img, factor):
    """Multiply the alpha channel by `factor`."""
    a = np.array(img).astype(np.int32)
    a[:, :, 3] = np.clip(a[:, :, 3] * factor, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def ellipse_points(cx, cy, rx, ry, n, roughness=0.0, phase=0.0, rnd=None):
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2 + phase
        k = 1 + (rnd.uniform(-roughness, roughness) if rnd else 0)
        pts.append((cx + math.cos(t) * rx * k, cy + math.sin(t) * ry * k))
    return pts


def ease(p):
    return 1 - (1 - p) ** 2


# ---------- ice ----------
def ice_shards(n=8, s=96):
    rnd = random.Random(7)
    ground = s - 14
    shards = [
        (s / 2 + rnd.uniform(-30, 30), rnd.uniform(22, 44), rnd.uniform(7, 12), rnd.uniform(-0.25, 0.25))
        for _ in range(6)
    ]
    frames = []
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        growth = ease(min(1, (f + 1) / 4))
        color = PALETTES["ice"]
        for x, h, w, lean in sorted(shards, key=lambda q: q[2]):
            hh = h * growth
            tx = x + lean * hh
            d.polygon([(x - w / 2, ground), (tx, ground - hh), (x, ground + 2)], fill=color[2])
            d.polygon([(x, ground + 2), (tx, ground - hh), (x + w / 2, ground)], fill=color[1])
            d.line([(tx, ground - hh), (x - w / 6, ground - hh * 0.35)], fill=color[3], width=1)
        if f >= 3:
            for _ in range(8):
                px, py = s / 2 + rnd.uniform(-34, 34), ground - rnd.uniform(4, 50)
                d.point((px, py), fill=color[3])
        im = outline(im)
        if f >= 6:
            im = fade(im, 0.55 if f == 6 else 0.25)
        frames.append(im)
    return frames, 14


def snow(n=8, s=128):
    rnd = random.Random(11)
    flakes = []
    for _ in range(44):
        flakes.append(
            (rnd.uniform(0, s), rnd.uniform(0, s), rnd.choice([1, 1, 2]), rnd.uniform(0, math.pi * 2), rnd.random())
        )
    frames = []
    color = PALETTES["ice"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        for x0, y0, speed, phase, kind in flakes:
            y = (y0 + f * s / n * speed) % s
            x = (x0 + 3 * math.sin(f / n * math.pi * 2 + phase)) % s
            edge = min(x, s - x, y, s - y)
            a = int(255 * min(1, edge / 14))
            if kind < 0.55:
                d.rectangle([x, y, x + 1, y + 1], fill=color[3] + (a,))
            elif kind < 0.85:
                d.line([(x - 1, y), (x + 1, y)], fill=color[2] + (a,))
                d.line([(x, y - 1), (x, y + 1)], fill=color[2] + (a,))
            else:
                for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (0, 0)):
                    d.point((x + dx, y + dy), fill=color[3] + (a,))
                for dx, dy in ((-1, -1), (1, 1), (-1, 1), (1, -1)):
                    d.point((x + dx, y + dy), fill=color[1] + (a,))
        frames.append(im)
    return frames, 12


def frost_ground(n=8, s=128):
    rnd = random.Random(5)
    frames = []
    color = PALETTES["ice"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        p = ease(min(1, (f + 1) / 5))
        rx = 10 + 50 * p
        ry = rx * 0.55
        pts = ellipse_points(s / 2, s / 2 + 8, rx, ry, 30, 0.09, 0, random.Random(5))
        d.polygon(pts, fill=color[2] + (110,))
        d.polygon(
            ellipse_points(s / 2, s / 2 + 8, rx * 0.7, ry * 0.7, 24, 0.06, 0.3, random.Random(9)),
            fill=color[3] + (70,),
        )
        d.line(pts + [pts[0]], fill=color[1] + (230,), width=2)
        for i in range(7):
            t = i / 7 * math.pi * 2 + 0.4
            d.line(
                [(s / 2, s / 2 + 8), (s / 2 + math.cos(t) * rx * 0.85, s / 2 + 8 + math.sin(t) * ry * 0.85)],
                fill=color[3] + (150,),
                width=1,
            )
        for _ in range(10):
            t = rnd.uniform(0, math.pi * 2)
            r = rnd.uniform(0.2, 0.95)
            d.point((s / 2 + math.cos(t) * rx * r, s / 2 + 8 + math.sin(t) * ry * r), fill=color[3])
        if f >= 5:
            im = fade(im, 1 - (f - 4) / 4)
        frames.append(im)
    return frames, 12


def ice_bolt(n=4, s=48):
    rnd = random.Random(3)
    frames = []
    color = PALETTES["ice"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        d.polygon([(10, 18), (42, 24), (10, 30), (16, 24)], fill=color[1])
        d.polygon([(14, 21), (38, 24), (14, 27)], fill=color[2])
        d.line([(18, 23), (34, 24)], fill=color[3], width=1)
        for k in range(5):
            x = 12 - k * 3 - (f * 2) % 3 - rnd.uniform(0, 2)
            y = 24 + rnd.uniform(-5, 5)
            d.point((x, y), fill=color[2] + (220 - k * 35,))
        frames.append(outline(im))
    return frames, 12


# ---------- steel ----------
def arc(d, cx, cy, r0, r1, a0, a1, color, step=3):
    """A thick circular arc (angles in degrees) drawn as a polygon."""
    outer = [
        (cx + math.cos(math.radians(a)) * r1, cy + math.sin(math.radians(a)) * r1)
        for a in range(int(a0), int(a1) + 1, step)
    ]
    inner = [
        (cx + math.cos(math.radians(a)) * r0, cy + math.sin(math.radians(a)) * r0)
        for a in range(int(a1), int(a0) - 1, -step)
    ]
    if len(outer) + len(inner) >= 3:
        d.polygon(outer + inner, fill=color)


def swing(n=6, s=96):
    frames = []
    color = PALETTES["steel"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        a0 = -120
        a1 = a0 + 50 * (f + 1)
        if f < 4:
            arc(d, 48, 48, 26, 42, a0, a1, color[1] + (140,))
            arc(d, 48, 48, 30, 40, max(a0, a1 - 70), a1, color[2])
            arc(d, 48, 48, 33, 37, max(a0, a1 - 50), a1, color[3])
            im = outline(im, alpha_min=200)
        else:
            arc(d, 48, 48, 28, 40, a0 + 60, a0 + 200, color[2] + (90 if f == 4 else 40,))
        frames.append(im)
    return frames, 18


def whirl(n=8, s=128):
    frames = []
    color = PALETTES["steel"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        angle = f * 360 / n
        for k in range(3):
            a = angle + k * 120
            arc(d, 64, 64, 42, 54, a - 70, a - 20, color[2] + (80,))
            arc(d, 64, 64, 40, 56, a - 20, a + 20, color[1])
            arc(d, 64, 64, 44, 52, a - 10, a + 20, color[3])
        d.ellipse([58, 58, 70, 70], fill=color[2] + (120,))
        frames.append(outline(im, alpha_min=200))
    return frames, 16


def drill(n=6, w=96, h=48):
    frames = []
    color = PALETTES["steel"]
    for f in range(n):
        cone = blank(w, h)
        ImageDraw.Draw(cone).polygon([(4, 10), (90, 24), (4, 38)], fill=color[1])
        stripes = blank(w, h)
        stripes_draw = ImageDraw.Draw(stripes)
        for i in range(-3, 14):
            x = i * 9 + f * 1.5
            stripes_draw.polygon([(x, 0), (x + 4, 0), (x + 12, h), (x + 8, h)], fill=color[0])
        mask = np.array(cone)[:, :, 3] > 0
        stripe_pixels = np.array(stripes)
        stripe_pixels[~mask] = 0
        im = Image.alpha_composite(cone, Image.fromarray(stripe_pixels))
        d = ImageDraw.Draw(im)
        d.polygon([(70, 21), (90, 24), (70, 27)], fill=color[3])
        d.line([(8, 14), (60, 22)], fill=color[2], width=1)
        frames.append(outline(im))
    return frames, 18


def shockwave(n=6, s=128):
    frames = []
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        p = ease((f + 0.5) / n)
        rx = 8 + 54 * p
        ry = rx * 0.55
        thickness = max(1.5, 7 - 5 * p)
        a = int(240 * (1 - p * 0.85))
        d.ellipse([64 - rx, 70 - ry, 64 + rx, 70 + ry], outline=(255, 255, 255, a), width=int(thickness))
        d.ellipse(
            [64 - rx * 0.93, 70 - ry * 0.9, 64 + rx * 0.93, 70 + ry * 0.9], outline=(255, 255, 255, a // 2), width=1
        )
        frames.append(im)
    return frames, 16


def shield_dome(n=6, s=96):
    frames = []
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        k = 1 + 0.03 * math.sin(f / n * math.pi * 2)
        rx, ry = 34 * k, 42 * k
        cx, cy = 48, 50
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, 38), outline=(255, 255, 255, 210), width=2)
        hex_radius = 7
        for j in range(-5, 6):
            for i in range(-5, 6):
                x = cx + i * hex_radius * 1.75 + (j % 2) * hex_radius * 0.875
                y = cy + j * hex_radius * 1.5
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.9:
                    continue
                pts = [
                    (
                        x + math.cos(math.radians(60 * q + 30)) * hex_radius * 0.9,
                        y + math.sin(math.radians(60 * q + 30)) * hex_radius * 0.9,
                    )
                    for q in range(6)
                ]
                a = 70 + int(60 * (0.5 + 0.5 * math.sin(f / n * math.pi * 2 + i * 0.9 + j * 1.3)))
                d.polygon(pts, outline=(255, 255, 255, a))
        d.ellipse([cx - rx * 0.55, cy - ry * 0.9, cx - rx * 0.25, cy - ry * 0.5], fill=(255, 255, 255, 60))
        frames.append(im)
    return frames, 8


# ---------- light ----------
def holy_cross(n=8, s=96):
    rnd = random.Random(21)
    frames = []
    color = PALETTES["gold"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        p = ease(min(1, (f + 1) / 4))
        length = 44 * p
        cx = cy = 48
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.polygon(
                [(cx - dy * 4, cy + dx * 4), (cx + dx * length, cy + dy * length), (cx + dy * 4, cy - dx * 4)],
                fill=color[1],
            )
            d.line([(cx, cy), (cx + dx * length * 0.9, cy + dy * length * 0.9)], fill=color[3], width=2)
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            d.line([(cx, cy), (cx + dx * length * 0.55, cy + dy * length * 0.55)], fill=color[2] + (200,), width=1)
        r = 8 + 6 * math.sin(p * math.pi)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color[2])
        d.ellipse([cx - r * 0.5, cy - r * 0.5, cx + r * 0.5, cy + r * 0.5], fill=color[3])
        for _ in range(6 + f):
            t = rnd.uniform(0, math.pi * 2)
            rr = rnd.uniform(14, 44)
            d.point((cx + math.cos(t) * rr, cy + math.sin(t) * rr), fill=color[3])
        im = outline(im, color[0] + (255,), 200)
        if f >= 5:
            im = fade(im, 1 - (f - 4) / 4)
        frames.append(im)
    return frames, 14


def light_rays(n=8, w=96, h=128):
    rnd = random.Random(33)
    rays = [(rnd.uniform(14, 82), rnd.uniform(4, 10), rnd.uniform(0, math.pi * 2)) for _ in range(6)]
    frames = []
    color = PALETTES["gold"]
    for f in range(n):
        a = np.zeros((h, w, 4), dtype=np.uint8)
        for x, ray_width, phase in rays:
            glow = 0.6 + 0.4 * math.sin(f / n * math.pi * 2 + phase)
            for y in range(h):
                val = int(200 * glow * (1 - y / h) ** 1.3)
                x0, x1 = int(x - ray_width / 2), int(x + ray_width / 2)
                a[y, x0:x1, :3] = color[2]
                a[y, x0:x1, 3] = np.maximum(a[y, x0:x1, 3], val)
                a[y, x0 + 1 : x1 - 1, :3] = color[3]
        frames.append(Image.fromarray(a))
    return frames, 10


# ---------- earth and nature ----------
def rubble(n=8, s=96):
    rnd = random.Random(44)
    ground = s - 12
    chunks = [(rnd.uniform(-4, 4), rnd.uniform(-14, -7), rnd.uniform(4, 9), rnd.choice([0, 1, 2])) for _ in range(8)]
    frames = []
    color = PALETTES["earth"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        t = f / 2
        if f < 5:
            rr = 14 + f * 7
            d.ellipse([48 - rr, ground - rr * 0.35, 48 + rr, ground + rr * 0.35], fill=color[2] + (120 - f * 18,))
        for vx, vy, r, shade in chunks:
            x = 48 + vx * t * 2.2
            y = ground - 4 + vy * t * 2.2 + 2.6 * t * t
            if y > ground + 2:
                continue
            pts = [
                (
                    x + math.cos(math.radians(q * 72 + 20)) * r * (0.8 + 0.2 * ((q * 7) % 3) / 2),
                    y + math.sin(math.radians(q * 72 + 20)) * r * 0.8,
                )
                for q in range(5)
            ]
            d.polygon(pts, fill=color[1 if shade else 2])
            d.polygon([pts[0], pts[1], (x, y)], fill=color[2 + (shade == 2)])
        frames.append(outline(im))
    frames[-1] = fade(frames[-1], 0.5)
    return frames, 14


def leaves(n=8, s=96):
    rnd = random.Random(55)
    leaf_specs = [
        (rnd.uniform(0, math.pi * 2), rnd.uniform(18, 38), rnd.uniform(0, math.pi * 2), rnd.choice([1, 2]))
        for _ in range(11)
    ]
    frames = []
    color = PALETTES["green"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        for phase, r, phase2, shade in leaf_specs:
            a = phase + f / n * math.pi * 2
            x = 48 + math.cos(a) * r
            y = 54 + math.sin(a) * r * 0.45 - 18 * math.sin(f / n * math.pi * 2 + phase2)
            d.polygon([(x - 4, y), (x, y - 3), (x + 4, y), (x, y + 3)], fill=color[shade])
            d.line([(x - 3, y), (x + 3, y)], fill=color[shade + 1], width=1)
        frames.append(outline(im))
    return frames, 12


# ---------- spirit and magic ----------
def spirit(n=4, s=48):
    frames = []
    color = PALETTES["spirit"]
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        w = 2 * math.sin(f / n * math.pi * 2)
        d.polygon(
            [(30, 14), (40, 24), (30, 34), (20, 30 + w), (10, 26 - w), (4, 24 + w), (12, 20 - w), (20, 16 + w)],
            fill=color[1],
        )
        d.ellipse([24, 17, 38, 31], fill=color[2])
        d.ellipse([28, 20, 34, 27], fill=color[3])
        d.point((33, 22), fill=OUTLINE)
        d.point((36, 24), fill=OUTLINE)
        frames.append(outline(im))
    return frames, 10


def rune_circle(n=8, s=128):
    rnd = random.Random(66)
    glyphs = [[(rnd.uniform(-3, 3), rnd.uniform(-3, 3)) for _ in range(4)] for _ in range(6)]
    frames = []
    for f in range(n):
        im = blank(s, s)
        d = ImageDraw.Draw(im)
        cx, cy = 64, 64
        rx, ry = 56, 28
        rotation = f / n * math.pi * 2 / 6
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(255, 255, 255, 220), width=2)
        d.ellipse(
            [cx - rx * 0.72, cy - ry * 0.72, cx + rx * 0.72, cy + ry * 0.72], outline=(255, 255, 255, 160), width=1
        )
        pts = [
            (
                cx + math.cos(rotation * 3 + q * math.pi / 3) * rx * 0.72,
                cy + math.sin(rotation * 3 + q * math.pi / 3) * ry * 0.72,
            )
            for q in range(6)
        ]
        d.polygon(pts, outline=(255, 255, 255, 120))
        for q in range(6):
            a = rotation + q * math.pi / 3
            gx, gy = cx + math.cos(a) * rx * 0.86, cy + math.sin(a) * ry * 0.86
            g = glyphs[q]
            d.line(
                [
                    (gx + g[0][0], gy + g[0][1]),
                    (gx + g[1][0], gy + g[1][1]),
                    (gx + g[2][0], gy + g[2][1]),
                    (gx + g[3][0], gy + g[3][1]),
                ],
                fill=(255, 255, 255, 230),
                width=1,
            )
        frames.append(im)
    return frames, 8


def fire_pillar(n=8, w=64, h=128):
    rnd = random.Random(77)
    frames = []
    color = [(232, 86, 42), (255, 179, 71), (255, 242, 160), (255, 255, 230)]
    for f in range(n):
        im = blank(w, h)
        d = ImageDraw.Draw(im)
        frame_rnd = random.Random(100 + f)
        for layer_color, width, height in ((color[0], 22, 118), (color[1], 15, 96), (color[2], 8, 64)):
            pts = [(32 - width, h - 2)]
            for y in range(h - 2, h - height, -8):
                pts.append((32 - width * (y - (h - height)) / height + frame_rnd.uniform(-4, 4), y))
            pts.append((32 + frame_rnd.uniform(-3, 3), h - height - 6))
            for y in range(h - height, h - 2, 8):
                pts.append((32 + width * (y - (h - height)) / height + frame_rnd.uniform(-4, 4), y))
            pts.append((32 + width, h - 2))
            d.polygon(pts, fill=layer_color)
        for _ in range(6):
            d.point((32 + rnd.uniform(-20, 20), h - 30 - ((f * 11 + rnd.uniform(0, 60)) % 90)), fill=color[3])
        frames.append(outline(im))
    return frames, 12


EFFECTS = {
    "ice_shards": ice_shards,
    "snow": snow,
    "frost_ground": frost_ground,
    "ice_bolt": ice_bolt,
    "swing": swing,
    "whirl": whirl,
    "drill": drill,
    "shockwave": shockwave,
    "shield_dome": shield_dome,
    "holy_cross": holy_cross,
    "light_rays": light_rays,
    "rubble": rubble,
    "leaves": leaves,
    "spirit": spirit,
    "rune_circle": rune_circle,
    "fire_pillar": fire_pillar,
}


def build(out_dir):
    """Render every procedural effect as a single-row sheet into `out_dir`; returns the fx.json entries."""
    out_dir = pathlib.Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    info = {}
    for name, effect in EFFECTS.items():
        frames, fps = effect()
        w, h = frames[0].size
        sheet = Image.new("RGBA", (w * len(frames), h), (0, 0, 0, 0))
        for i, frame in enumerate(frames):
            sheet.paste(frame, (i * w, 0))
        sheet.save(out_dir / f"{name}.png")
        info[name] = dict(fw=w, fh=h, n=len(frames), fps=fps)
    return info


def main():
    out_dir = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "runeveld/sprites/fx")
    info = build(out_dir)
    json_path = out_dir / "fx.json"
    all_info = json.loads(json_path.read_text()) if json_path.exists() else {}
    all_info.update(info)
    json_path.write_text(json.dumps(all_info))
    print("procedural effects:", list(info))


if __name__ == "__main__":
    main()
