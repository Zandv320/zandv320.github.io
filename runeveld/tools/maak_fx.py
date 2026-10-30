"""Runeveld – procedurele pixel-effecten in de stijl van de Craftpix-sheets: ijs, sneeuw, staal, licht, aarde, geesten en
schilden die niet in de gratis packs zitten. Elke functie levert een lijst frames (RGBA, PIL); maak() schrijft ze als
rij-sheets naar sprites/fx/ en geeft de info voor fx.json terug. Donkere omlijning zoals de sprites, beperkte paletten.

Gebruik: python3 -I tools/maak_fx.py [sprites/fx]   (maak_sprites.py roept dit ook aan)"""
import sys, json, math, random, pathlib
from PIL import Image, ImageDraw
import numpy as np

LIJN = (12, 15, 42, 255)
PAL = {
    'ijs': [(63, 143, 201), (143, 211, 244), (223, 247, 255), (255, 255, 255)],
    'staal': [(96, 108, 138), (190, 200, 220), (236, 240, 248), (255, 255, 255)],
    'goud': [(196, 140, 40), (240, 196, 90), (255, 236, 170), (255, 252, 230)],
    'aarde': [(90, 67, 40), (138, 106, 62), (201, 160, 106), (232, 206, 160)],
    'geest': [(110, 74, 201), (180, 140, 255), (232, 216, 255), (255, 255, 255)],
    'groen': [(46, 110, 52), (96, 170, 80), (160, 220, 120), (230, 250, 200)],
    'wit': [(200, 200, 210), (236, 236, 244), (250, 250, 255), (255, 255, 255)],
}
R = random.Random(2026)


def leeg(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def omlijn(img, kleur=LIJN, alpha_min=40):
    """donkere rand: elke doorzichtige pixel naast een gevulde pixel (4 buren)"""
    a = np.array(img); al = a[:, :, 3] >= alpha_min
    buur = np.zeros_like(al)
    buur[1:, :] |= al[:-1, :]; buur[:-1, :] |= al[1:, :]; buur[:, 1:] |= al[:, :-1]; buur[:, :-1] |= al[:, 1:]
    rand = buur & ~al
    a[rand] = kleur
    return Image.fromarray(a)


def vervaag(img, f):
    """alpha vermenigvuldigen met f"""
    a = np.array(img).astype(np.int32); a[:, :, 3] = np.clip(a[:, :, 3] * f, 0, 255); return Image.fromarray(a.astype(np.uint8))


def ellips_punten(cx, cy, rx, ry, n, ruw=0.0, fase=0.0, rnd=None):
    pts = []
    for i in range(n):
        t = i / n * math.pi * 2 + fase
        k = 1 + (rnd.uniform(-ruw, ruw) if rnd else 0)
        pts.append((cx + math.cos(t) * rx * k, cy + math.sin(t) * ry * k))
    return pts


def ease(p): return 1 - (1 - p) ** 2


# ---------- ijs ----------
def ijsscherven(n=8, s=96):
    rnd = random.Random(7); grond = s - 14
    scherven = [(s / 2 + rnd.uniform(-30, 30), rnd.uniform(22, 44), rnd.uniform(7, 12), rnd.uniform(-.25, .25)) for _ in range(6)]
    frames = []
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im)
        groei = ease(min(1, (f + 1) / 4)); kleur = PAL['ijs']
        for x, h, w, hel in sorted(scherven, key=lambda q: q[2]):
            hh = h * groei; tx = x + hel * hh
            d.polygon([(x - w / 2, grond), (tx, grond - hh), (x, grond + 2)], fill=kleur[2])
            d.polygon([(x, grond + 2), (tx, grond - hh), (x + w / 2, grond)], fill=kleur[1])
            d.line([(tx, grond - hh), (x - w / 6, grond - hh * .35)], fill=kleur[3], width=1)
        if f >= 3:
            for _ in range(8):
                px, py = s / 2 + rnd.uniform(-34, 34), grond - rnd.uniform(4, 50); d.point((px, py), fill=kleur[3])
        im = omlijn(im)
        if f >= 6: im = vervaag(im, .55 if f == 6 else .25)
        frames.append(im)
    return frames, 14


def sneeuw(n=8, s=128):
    rnd = random.Random(11); vl = []
    for _ in range(44):
        vl.append((rnd.uniform(0, s), rnd.uniform(0, s), rnd.choice([1, 1, 2]), rnd.uniform(0, math.pi * 2), rnd.random()))
    frames = []; kleur = PAL['ijs']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im)
        for x0, y0, sp, fase, soort in vl:
            y = (y0 + f * s / n * sp) % s; x = (x0 + 3 * math.sin(f / n * math.pi * 2 + fase)) % s
            rand = min(x, s - x, y, s - y); a = int(255 * min(1, rand / 14))
            if soort < .55: d.rectangle([x, y, x + 1, y + 1], fill=kleur[3] + (a,))
            elif soort < .85:
                d.line([(x - 1, y), (x + 1, y)], fill=kleur[2] + (a,)); d.line([(x, y - 1), (x, y + 1)], fill=kleur[2] + (a,))
            else:
                for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2), (0, 0)): d.point((x + dx, y + dy), fill=kleur[3] + (a,))
                for dx, dy in ((-1, -1), (1, 1), (-1, 1), (1, -1)): d.point((x + dx, y + dy), fill=kleur[1] + (a,))
        frames.append(im)
    return frames, 12


def vorstgrond(n=8, s=128):
    rnd = random.Random(5); frames = []; kleur = PAL['ijs']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); p = ease(min(1, (f + 1) / 5)); rx = 10 + 50 * p; ry = rx * .55
        pts = ellips_punten(s / 2, s / 2 + 8, rx, ry, 30, .09, 0, random.Random(5))
        d.polygon(pts, fill=kleur[2] + (110,))
        d.polygon(ellips_punten(s / 2, s / 2 + 8, rx * .7, ry * .7, 24, .06, .3, random.Random(9)), fill=kleur[3] + (70,))
        d.line(pts + [pts[0]], fill=kleur[1] + (230,), width=2)
        for i in range(7):
            t = i / 7 * math.pi * 2 + .4; d.line([(s / 2, s / 2 + 8), (s / 2 + math.cos(t) * rx * .85, s / 2 + 8 + math.sin(t) * ry * .85)], fill=kleur[3] + (150,), width=1)
        for _ in range(10):
            t = rnd.uniform(0, math.pi * 2); r = rnd.uniform(.2, .95); d.point((s / 2 + math.cos(t) * rx * r, s / 2 + 8 + math.sin(t) * ry * r), fill=kleur[3])
        if f >= 5: im = vervaag(im, 1 - (f - 4) / 4)
        frames.append(im)
    return frames, 12


def ijsbol(n=4, s=48):
    rnd = random.Random(3); frames = []; kleur = PAL['ijs']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im)
        d.polygon([(10, 18), (42, 24), (10, 30), (16, 24)], fill=kleur[1]); d.polygon([(14, 21), (38, 24), (14, 27)], fill=kleur[2])
        d.line([(18, 23), (34, 24)], fill=kleur[3], width=1)
        for k in range(5):
            x = 12 - k * 3 - (f * 2) % 3 - rnd.uniform(0, 2); y = 24 + rnd.uniform(-5, 5); d.point((x, y), fill=kleur[2] + (220 - k * 35,))
        frames.append(omlijn(im))
    return frames, 12


# ---------- staal ----------
def boog(d, cx, cy, r0, r1, a0, a1, kleur, stap=3):
    """een dikke cirkelboog (graden) als veelhoek"""
    buiten = [(cx + math.cos(math.radians(a)) * r1, cy + math.sin(math.radians(a)) * r1) for a in range(int(a0), int(a1) + 1, stap)]
    binnen = [(cx + math.cos(math.radians(a)) * r0, cy + math.sin(math.radians(a)) * r0) for a in range(int(a1), int(a0) - 1, -stap)]
    if len(buiten) + len(binnen) >= 3: d.polygon(buiten + binnen, fill=kleur)


def zwaai(n=6, s=96):
    frames = []; kleur = PAL['staal']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); a0 = -120; a1 = a0 + 50 * (f + 1)
        if f < 4:
            boog(d, 48, 48, 26, 42, a0, a1, kleur[1] + (140,)); boog(d, 48, 48, 30, 40, max(a0, a1 - 70), a1, kleur[2]); boog(d, 48, 48, 33, 37, max(a0, a1 - 50), a1, kleur[3])
            im = omlijn(im, alpha_min=200)
        else:
            boog(d, 48, 48, 28, 40, a0 + 60, a0 + 200, kleur[2] + (90 if f == 4 else 40,))
        frames.append(im)
    return frames, 18


def wervel(n=8, s=128):
    frames = []; kleur = PAL['staal']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); hoek = f * 360 / n
        for k in range(3):
            a = hoek + k * 120
            boog(d, 64, 64, 42, 54, a - 70, a - 20, kleur[2] + (80,)); boog(d, 64, 64, 40, 56, a - 20, a + 20, kleur[1]); boog(d, 64, 64, 44, 52, a - 10, a + 20, kleur[3])
        d.ellipse([58, 58, 70, 70], fill=kleur[2] + (120,))
        frames.append(omlijn(im, alpha_min=200))
    return frames, 16


def boor(n=6, w=96, h=48):
    frames = []; kleur = PAL['staal']
    for f in range(n):
        im = leeg(w, h); d = ImageDraw.Draw(im)
        kegel = leeg(w, h); dk = ImageDraw.Draw(kegel); dk.polygon([(4, 10), (90, 24), (4, 38)], fill=kleur[1])
        strepen = leeg(w, h); ds = ImageDraw.Draw(strepen)
        for i in range(-3, 14):
            x = i * 9 + f * 1.5; ds.polygon([(x, 0), (x + 4, 0), (x + 12, h), (x + 8, h)], fill=kleur[0])
        masker = np.array(kegel)[:, :, 3] > 0; st = np.array(strepen); st[~masker] = 0
        im = Image.alpha_composite(kegel, Image.fromarray(st))
        d = ImageDraw.Draw(im); d.polygon([(70, 21), (90, 24), (70, 27)], fill=kleur[3]); d.line([(8, 14), (60, 22)], fill=kleur[2], width=1)
        frames.append(omlijn(im))
    return frames, 18


def golf(n=6, s=128):
    frames = []
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); p = ease((f + .5) / n); rx = 8 + 54 * p; ry = rx * .55; dik = max(1.5, 7 - 5 * p); a = int(240 * (1 - p * .85))
        d.ellipse([64 - rx, 70 - ry, 64 + rx, 70 + ry], outline=(255, 255, 255, a), width=int(dik))
        d.ellipse([64 - rx * .93, 70 - ry * .9, 64 + rx * .93, 70 + ry * .9], outline=(255, 255, 255, a // 2), width=1)
        frames.append(im)
    return frames, 16


def schild(n=6, s=96):
    frames = []
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); k = 1 + .03 * math.sin(f / n * math.pi * 2); rx, ry = 34 * k, 42 * k; cx, cy = 48, 50
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(255, 255, 255, 38), outline=(255, 255, 255, 210), width=2)
        hexr = 7
        for j in range(-5, 6):
            for i in range(-5, 6):
                x = cx + i * hexr * 1.75 + (j % 2) * hexr * .875; y = cy + j * hexr * 1.5
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > .9: continue
                pts = [(x + math.cos(math.radians(60 * q + 30)) * hexr * .9, y + math.sin(math.radians(60 * q + 30)) * hexr * .9) for q in range(6)]
                a = 70 + int(60 * (.5 + .5 * math.sin(f / n * math.pi * 2 + i * .9 + j * 1.3)))
                d.polygon(pts, outline=(255, 255, 255, a))
        d.ellipse([cx - rx * .55, cy - ry * .9, cx - rx * .25, cy - ry * .5], fill=(255, 255, 255, 60))
        frames.append(im)
    return frames, 8


# ---------- licht ----------
def heilig(n=8, s=96):
    rnd = random.Random(21); frames = []; kleur = PAL['goud']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); p = ease(min(1, (f + 1) / 4)); L = 44 * p; cx = cy = 48
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.polygon([(cx - dy * 4, cy + dx * 4), (cx + dx * L, cy + dy * L), (cx + dy * 4, cy - dx * 4)], fill=kleur[1])
            d.line([(cx, cy), (cx + dx * L * .9, cy + dy * L * .9)], fill=kleur[3], width=2)
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            d.line([(cx, cy), (cx + dx * L * .55, cy + dy * L * .55)], fill=kleur[2] + (200,), width=1)
        r = 8 + 6 * math.sin(p * math.pi); d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=kleur[2]); d.ellipse([cx - r * .5, cy - r * .5, cx + r * .5, cy + r * .5], fill=kleur[3])
        for _ in range(6 + f):
            t = rnd.uniform(0, math.pi * 2); rr = rnd.uniform(14, 44); d.point((cx + math.cos(t) * rr, cy + math.sin(t) * rr), fill=kleur[3])
        im = omlijn(im, kleur[0] + (255,), 200)
        if f >= 5: im = vervaag(im, 1 - (f - 4) / 4)
        frames.append(im)
    return frames, 14


def lichtstralen(n=8, w=96, h=128):
    rnd = random.Random(33); stralen = [(rnd.uniform(14, 82), rnd.uniform(4, 10), rnd.uniform(0, math.pi * 2)) for _ in range(6)]
    frames = []; kleur = PAL['goud']
    for f in range(n):
        im = leeg(w, h); a = np.zeros((h, w, 4), dtype=np.uint8)
        for x, bw, fase in stralen:
            glans = .6 + .4 * math.sin(f / n * math.pi * 2 + fase)
            for y in range(h):
                val = int(200 * glans * (1 - y / h) ** 1.3)
                x0, x1 = int(x - bw / 2), int(x + bw / 2)
                a[y, x0:x1, :3] = kleur[2]; a[y, x0:x1, 3] = np.maximum(a[y, x0:x1, 3], val)
                a[y, x0 + 1:x1 - 1, :3] = kleur[3]
        frames.append(Image.fromarray(a))
    return frames, 10


# ---------- aarde en natuur ----------
def aarde(n=8, s=96):
    rnd = random.Random(44); grond = s - 12
    stukken = [(rnd.uniform(-4, 4), rnd.uniform(-14, -7), rnd.uniform(4, 9), rnd.choice([0, 1, 2])) for _ in range(8)]
    frames = []; kleur = PAL['aarde']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); t = f / 2
        if f < 5:
            rr = 14 + f * 7; d.ellipse([48 - rr, grond - rr * .35, 48 + rr, grond + rr * .35], fill=kleur[2] + (120 - f * 18,))
        for vx, vy, r, tint in stukken:
            x = 48 + vx * t * 2.2; y = grond - 4 + vy * t * 2.2 + 2.6 * t * t
            if y > grond + 2: continue
            pts = [(x + math.cos(math.radians(q * 72 + 20)) * r * (.8 + .2 * ((q * 7) % 3) / 2), y + math.sin(math.radians(q * 72 + 20)) * r * .8) for q in range(5)]
            d.polygon(pts, fill=kleur[1 if tint else 2]); d.polygon([pts[0], pts[1], (x, y)], fill=kleur[2 + (tint == 2)])
        frames.append(omlijn(im))
    frames[-1] = vervaag(frames[-1], .5)
    return frames, 14


def bladeren(n=8, s=96):
    rnd = random.Random(55); bl = [(rnd.uniform(0, math.pi * 2), rnd.uniform(18, 38), rnd.uniform(0, math.pi * 2), rnd.choice([1, 2])) for _ in range(11)]
    frames = []; kleur = PAL['groen']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im)
        for fase, r, fase2, tint in bl:
            a = fase + f / n * math.pi * 2; x = 48 + math.cos(a) * r; y = 54 + math.sin(a) * r * .45 - 18 * math.sin(f / n * math.pi * 2 + fase2)
            d.polygon([(x - 4, y), (x, y - 3), (x + 4, y), (x, y + 3)], fill=kleur[tint]); d.line([(x - 3, y), (x + 3, y)], fill=kleur[tint + 1], width=1)
        frames.append(omlijn(im))
    return frames, 12


# ---------- geest en magie ----------
def geest(n=4, s=48):
    frames = []; kleur = PAL['geest']
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); w = 2 * math.sin(f / n * math.pi * 2)
        d.polygon([(30, 14), (40, 24), (30, 34), (20, 30 + w), (10, 26 - w), (4, 24 + w), (12, 20 - w), (20, 16 + w)], fill=kleur[1])
        d.ellipse([24, 17, 38, 31], fill=kleur[2]); d.ellipse([28, 20, 34, 27], fill=kleur[3])
        d.point((33, 22), fill=LIJN); d.point((36, 24), fill=LIJN)
        frames.append(omlijn(im))
    return frames, 10


def runen(n=8, s=128):
    rnd = random.Random(66); glyphs = [[(rnd.uniform(-3, 3), rnd.uniform(-3, 3)) for _ in range(4)] for _ in range(6)]
    frames = []
    for f in range(n):
        im = leeg(s, s); d = ImageDraw.Draw(im); cx, cy = 64, 64; rx, ry = 56, 28; draai = f / n * math.pi * 2 / 6
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(255, 255, 255, 220), width=2)
        d.ellipse([cx - rx * .72, cy - ry * .72, cx + rx * .72, cy + ry * .72], outline=(255, 255, 255, 160), width=1)
        pts = [(cx + math.cos(draai * 3 + q * math.pi / 3) * rx * .72, cy + math.sin(draai * 3 + q * math.pi / 3) * ry * .72) for q in range(6)]
        d.polygon(pts, outline=(255, 255, 255, 120))
        for q in range(6):
            a = draai + q * math.pi / 3; gx, gy = cx + math.cos(a) * rx * .86, cy + math.sin(a) * ry * .86
            g = glyphs[q]; d.line([(gx + g[0][0], gy + g[0][1]), (gx + g[1][0], gy + g[1][1]), (gx + g[2][0], gy + g[2][1]), (gx + g[3][0], gy + g[3][1])], fill=(255, 255, 255, 230), width=1)
        frames.append(im)
    return frames, 8


def vuurzuil(n=8, w=64, h=128):
    rnd = random.Random(77); frames = []; kleur = [(232, 86, 42), (255, 179, 71), (255, 242, 160), (255, 255, 230)]
    for f in range(n):
        im = leeg(w, h); d = ImageDraw.Draw(im); r2 = random.Random(100 + f)
        for laag, (kl, breed, hoog) in enumerate(((kleur[0], 22, 118), (kleur[1], 15, 96), (kleur[2], 8, 64))):
            pts = [(32 - breed, h - 2)]
            for y in range(h - 2, h - hoog, -8):
                pts.append((32 - breed * (y - (h - hoog)) / hoog + r2.uniform(-4, 4), y))
            pts.append((32 + r2.uniform(-3, 3), h - hoog - 6))
            for y in range(h - hoog, h - 2, 8):
                pts.append((32 + breed * (y - (h - hoog)) / hoog + r2.uniform(-4, 4), y))
            pts.append((32 + breed, h - 2)); d.polygon(pts, fill=kl)
        for _ in range(6):
            d.point((32 + rnd.uniform(-20, 20), h - 30 - ((f * 11 + rnd.uniform(0, 60)) % 90)), fill=kleur[3])
        frames.append(omlijn(im))
    return frames, 12


EFFECTEN = {'ijsscherven': ijsscherven, 'sneeuw': sneeuw, 'vorstgrond': vorstgrond, 'ijsbol': ijsbol, 'zwaai': zwaai, 'wervel': wervel,
            'boor': boor, 'golf': golf, 'schild': schild, 'heilig': heilig, 'lichtstralen': lichtstralen, 'aarde': aarde,
            'bladeren': bladeren, 'geest': geest, 'runen': runen, 'vuurzuil': vuurzuil}


def maak(uit):
    uit = pathlib.Path(uit); uit.mkdir(parents=True, exist_ok=True); info = {}
    for naam, fn in EFFECTEN.items():
        frames, fps = fn(); w, h = frames[0].size
        sheet = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
        for i, fr in enumerate(frames): sheet.paste(fr, (i * w, 0))
        sheet.save(uit / f'{naam}.png'); info[naam] = dict(fw=w, fh=h, n=len(frames), fps=fps)
    return info


if __name__ == '__main__':
    uit = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'runeveld/sprites/fx')
    info = maak(uit); js = uit / 'fx.json'
    alles = json.loads(js.read_text()) if js.exists() else {}
    alles.update(info); js.write_text(json.dumps(alles)); print('procedurele effecten:', list(info))
