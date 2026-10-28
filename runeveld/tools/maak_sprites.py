#!/usr/bin/env python3
"""Knipt de Craftpix-packs om naar de spritesheets die Runeveld gebruikt.

Gebruik:
    python3 -I runeveld/tools/maak_sprites.py <map-met-uitgepakte-packs> [runeveld/sprites]

De map met packs bevat de uitgepakte zips uit runeveld/_download/, elk in een eigen submap:
    free-swordsman-1-3-level-pixel-top-down-sprite-character/
    free-top-down-hunt-animals-pixel-sprite-pack/
    free-village-pixel-tileset-for-top-down-defense/
    free-medieval-fortress-top-down-pixel-minigame-kit/

Uitvoer (allemaal pixel-art, 1 wereld-eenheid = 16 px, zie world.js):
    held_lijf.png          naakt basislijf (onderbroek), 64×64 frames, 12 kolommen, per animatie 4 rijen (onder, links, rechts, boven)
    held_hoofd.png         hoofd en haar, zelfde indeling
    harnas1..3.png         kleding als losse laag over het lijf (tuniek, leren vest, stalen harnas)
    wapen1..3.png          zwaard vóór het lijf (incl. zwaai-effect), wapen1b..3b.png het deel achter het lijf
    konijn/vos/zwijn.png   32×32 frames, 6 kolommen, per animatie 4 rijen (onder, boven, links, rechts)
    koopman.png            32×32 frames, 4 kolommen, 1 rij
    grond.png              7 tegels van 32×32 naast elkaar: 3× gras, 2× keien, 2× pad
    <decor>.png            losse plaatjes op ware grootte
"""
import sys, pathlib
from PIL import Image

BRON = pathlib.Path(sys.argv[1])
UIT = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'runeveld/sprites')
UIT.mkdir(parents=True, exist_ok=True)
SW = BRON / 'free-swordsman-1-3-level-pixel-top-down-sprite-character/PNG'
DIER = BRON / 'free-top-down-hunt-animals-pixel-sprite-pack/PNG/Without_shadow'
DORP = BRON / 'free-village-pixel-tileset-for-top-down-defense'
FORT = BRON / 'free-medieval-fortress-top-down-pixel-minigame-kit'


def open_rgba(p):
    return Image.open(p).convert('RGBA')


def frames_in_rij(sheet, fw, fh, rij):
    """Aantal gevulde frames in een rij (lege frames rechts tellen niet mee)."""
    n = sheet.width // fw
    while n > 0 and sheet.crop(((n - 1) * fw, rij * fh, n * fw, (rij + 1) * fh)).getbbox() is None:
        n -= 1
    return max(1, n)


def stapel(animaties, fw, fh, cols, rijen=4):
    """Plakt animatie-sheets (elk met `rijen` richting-rijen) onder elkaar tot één sheet met `cols` kolommen.
    Kortere rijen worden cyclisch herhaald zodat elke richting even lang loopt."""
    out = Image.new('RGBA', (cols * fw, len(animaties) * rijen * fh), (0, 0, 0, 0))
    for a, sheet in enumerate(animaties):
        for r in range(rijen):
            n = frames_in_rij(sheet, fw, fh, r)
            for c in range(cols):
                f = c % n
                out.paste(sheet.crop((f * fw, r * fh, (f + 1) * fw, (r + 1) * fh)), (c * fw, (a * rijen + r) * fh))
    return out


# ---------- zwaardvechter: losse lagen ----------
ANIMS = ('Idle', 'Run', 'attack', 'Hurt', 'Death')
LEEG = Image.new('RGBA', (64, 256), (0, 0, 0, 0))


def part(lvl, anim, naam):
    p = SW / f'Swordsman_lvl{lvl}/Parts/Swordsman_lvl{lvl}_{anim}_{naam}.png'
    return open_rgba(p) if p.exists() else None


def stapel_lagen(lagen, fw, fh, cols, rijen=4):
    """Als stapel(), maar voor meerdere lagen tegelijk: het aantal frames per rij komt van de eerste laag
    (het lijf), zodat alle lagen precies gelijk lopen."""
    outs = [Image.new('RGBA', (cols * fw, len(lagen[0]) * rijen * fh), (0, 0, 0, 0)) for _ in lagen]
    for a in range(len(lagen[0])):
        for r in range(rijen):
            n = frames_in_rij(lagen[0][a], fw, fh, r)
            for c in range(cols):
                f = c % n
                for li, laag in enumerate(lagen):
                    sheet = laag[a]
                    if sheet is None:
                        continue
                    outs[li].paste(sheet.crop((f * fw, r * fh, (f + 1) * fw, (r + 1) * fh)), (c * fw, (a * rijen + r) * fh))
    return outs


# kleuren van de tuniek (level 1) → huid; de laagste rijen van de tuniek worden een onderbroek
TUNIEK = {(63, 67, 61): (190, 134, 95), (94, 97, 90): (225, 178, 110), (111, 115, 106): (225, 178, 110),
          (134, 139, 124): (246, 202, 116), (45, 49, 43): (164, 111, 89)}
ONDERBROEK = {(63, 67, 61): (205, 205, 210), (94, 97, 90): (238, 238, 242), (111, 115, 106): (238, 238, 242),
              (134, 139, 124): (250, 250, 252), (45, 49, 43): (170, 170, 178)}


def naakt(sheet, fw=64, fh=64):
    """Maakt van een level-1-lijfsheet een naakt lijf: tuniek wordt huid, de heupen krijgen een onderbroek."""
    out = sheet.copy()
    px = out.load()
    for r in range(sheet.height // fh):
        for c in range(sheet.width // fw):
            fr = sheet.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
            bb = fr.getbbox()
            if not bb:
                continue
            voet = r * fh + bb[3]            # onderste gevulde rij van dit frame
            for y in range(r * fh + bb[1], voet):
                for x in range(c * fw + bb[0], c * fw + bb[2]):
                    p = px[x, y]
                    if p[3] == 0:
                        continue
                    k = p[:3]
                    if k in TUNIEK:
                        band = voet - 8 <= y <= voet - 6
                        px[x, y] = (ONDERBROEK if band else TUNIEK)[k] + (255,)
    return out


def verschil(laag, basis):
    """Alleen de pixels van `laag` die anders zijn dan `basis` (de kleding zonder het lijf eronder)."""
    out = Image.new('RGBA', laag.size, (0, 0, 0, 0))
    a, b, o = laag.load(), basis.load(), out.load()
    for y in range(laag.height):
        for x in range(laag.width):
            if a[x, y][3] > 0 and a[x, y] != b[x, y]:
                o[x, y] = a[x, y]
    return out


lijf1 = [part(1, a, 'body') for a in ANIMS]
hoofd = [part(1, a, 'head') for a in ANIMS]
lagen = [lijf1, hoofd]
for lvl in (1, 2, 3):
    lagen.append([part(lvl, a, 'body') for a in ANIMS])
    voor = []
    for a in ANIMS:
        sw = part(lvl, a, 'sword')
        zw = part(lvl, a, 'swing')
        if sw is not None and zw is not None:
            sw = sw.copy(); sw.alpha_composite(zw)
        voor.append(sw)
    lagen.append(voor)
    lagen.append([part(lvl, a, 'sword_back') for a in ANIMS])
uit = stapel_lagen(lagen, 64, 64, 12)
basis = naakt(uit[0])
basis.save(UIT / 'held_lijf.png')
uit[1].save(UIT / 'held_hoofd.png')

# ---------- hoofddeksels: handgetekende pixel-art, per frame op het hoofd gezet ----------
# Elk deksel heeft vier tekeningen (front, left, right, back) in tekens: . leeg, o omlijning, d donker, m midden, l licht, h glans.
# Per frame wordt de bovenkant en het midden van het haar bepaald; daar komt het deksel op, zodat het elke beweging volgt.
HAAR = {(33, 26, 28), (43, 32, 35), (59, 44, 51), (77, 57, 69), (104, 79, 90)}
IJZER = {'o': (40, 42, 52), 'd': (96, 102, 118), 'm': (140, 148, 166), 'l': (186, 194, 210), 'h': (232, 238, 248)}
LEER = {'o': (52, 30, 16), 'd': (104, 64, 32), 'm': (148, 96, 48), 'l': (184, 130, 74), 'h': (214, 170, 110)}

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
PET_FRONT = """
......oooo......
....oolllloo....
...ollmmmmllo...
..olmmmmmmmmlo..
..ommmmmmmmmmo..
..odmmmmmmmmdo..
.ooddddddddddoo.
oldddddddddddddo
.oooooooooooooo."""
PET_RIGHT = """
.....oooo.....
...oolllloo...
..ollmmmmllo..
.olmmmmmmmmlo.
.ommmmmmmmmmo.
.odmmmmmmmmdo.
oodddddddddddo
oddddddddddddlo
.ooooooooooooo"""
PET_BACK = """
......oooo......
....oolllloo....
...ollmmmmllo...
..olmmmmmmmmlo..
..ommmmmmmmmmo..
..odmmmmmmmmdo..
.ooddddddddddoo.
.oddddddddddddo.
.oooooooooooooo."""


def tekening(tekst, kleuren):
    rijen = [r for r in tekst.strip('\n').split('\n')]
    b = max(len(r) for r in rijen)
    im = Image.new('RGBA', (b, len(rijen)), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rijen):
        for x, ch in enumerate(r):
            if ch in kleuren:
                px[x, y] = kleuren[ch] + (255,)
    return im


def spiegel(im):
    return im.transpose(Image.FLIP_LEFT_RIGHT)


def hoofddeksel(hoofd, front, right, back, kleuren, fw=64, fh=64, lift=1):
    """Zet per frame het juiste deksel op het haar. Rij r binnen een animatie: 0 front, 1 left, 2 right, 3 back."""
    art = {0: tekening(front, kleuren), 1: spiegel(tekening(right, kleuren)), 2: tekening(right, kleuren), 3: tekening(back, kleuren)}
    out = Image.new('RGBA', hoofd.size, (0, 0, 0, 0))
    src = hoofd.load()
    for r in range(hoofd.height // fh):
        deksel = art[r % 4]
        for c in range(hoofd.width // fw):
            xs, ys = [], []
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    p = src[x, y]
                    if p[3] > 0 and p[:3] in HAAR:
                        xs.append(x); ys.append(y)
            if not ys:
                continue
            top, midden = min(ys), (min(xs) + max(xs)) / 2
            x0 = round(midden - deksel.width / 2 + .5)
            out.alpha_composite(deksel, (x0, top - lift))
    return out


hoofddeksel(uit[1], PET_FRONT, PET_RIGHT, PET_BACK, LEER).save(UIT / 'hoofd1.png')      # leren pet
hoofddeksel(uit[1], HELM_FRONT, HELM_RIGHT, HELM_BACK, IJZER).save(UIT / 'hoofd2.png')  # ijzeren helm

# ---------- dieren ----------
for uit, map_, anims in (
        ('konijn', 'Hare', ('Hare_Idle', 'Hare_Walk', 'Hare_Run', 'Hare_Hurt', 'Hare_Death')),
        ('vos', 'Fox', ('Fox_Idle', 'Fox_walk', 'Fox_Run', 'Fox_Hurt', 'Fox_Death')),
        ('zwijn', 'Boar', ('Boar_Idle', 'Boar_Walk', 'Boar_Attack', 'Boar_Hurt', 'Boar_Death'))):
    sheets = [open_rgba(DIER / map_ / f'{a}.png') for a in anims]
    stapel(sheets, 32, 32, 6).save(UIT / f'{uit}.png')
    print(uit, [frames_in_rij(s, 32, 32, 0) for s in sheets])

# ---------- koopman (fortress-kit figuur, één kijkrichting) ----------
open_rgba(FORT / 'Characters/Character_2/Idle.png').save(UIT / 'koopman.png')

# ---------- grondtegels ----------
velden = open_rgba(DORP / '1 Tiles/FieldsTileset.png')
tegel = lambda nr: velden.crop((((nr - 1) % 8) * 32, ((nr - 1) // 8) * 32, ((nr - 1) % 8) * 32 + 32, ((nr - 1) // 8) * 32 + 32))
obj = lambda sub, nr: open_rgba(DORP / '2 Objects' / sub / f'{nr}.png')
gras = tegel(38)
gras1 = gras.copy(); gras1.alpha_composite(obj('5 Grass', 2), (6, 18)); gras1.alpha_composite(obj('5 Grass', 5), (20, 6))
gras2 = gras.copy(); gras2.alpha_composite(obj('2 Stone', 3), (22, 20)); gras2.alpha_composite(obj('5 Grass', 1), (8, 8))
atlas = Image.new('RGBA', (7 * 32, 32))
for i, t in enumerate((gras, gras1, gras2, tegel(1), tegel(27), tegel(6), tegel(10))):
    atlas.paste(t, (i * 32, 0))
atlas.save(UIT / 'grond.png')

# ---------- decor uit het dorpspack ----------
for uit, sub, nr in (('put', '3 Decor', 13), ('kraam', '6 Tent', 1), ('kraam2', '6 Tent', 3), ('huis_a', '7 House', 1),
                     ('huis_b', '7 House', 2), ('huis_c', '7 House', 3), ('huis_d', '7 House', 4), ('ton', '4 Box', 1),
                     ('kist', '4 Box', 3), ('lantaarn', '3 Decor', 9), ('kar', '3 Decor', 1), ('bord', '3 Decor', 14),
                     ('aambeeld', '3 Decor', 7), ('hout', '3 Decor', 5)):
    obj(sub, nr).save(UIT / f'{uit}.png')

# hek: twee kolommen van de palissade (rij 1 en 2 van Tileset2)
open_rgba(DORP / '1.1 Tiles/Tileset2.png').crop((32, 0, 96, 64)).save(UIT / 'hek.png')

# ---------- bomen, rotsen en bloemen uit de fortress-collage ----------
col = open_rgba(FORT / 'Tileset/Tiled_Map.png')
for uit, box in (('boom', (160, 49, 192, 94)), ('boom2', (193, 65, 223, 96)), ('struik', (224, 72, 240, 95)),
                 ('den', (241, 48, 270, 96)), ('den2', (270, 62, 288, 96)), ('rots', (247, 22, 268, 40)),
                 ('rots2', (208, 19, 224, 31)), ('bloemen', (257, 163, 270, 173)), ('bloemen2', (212, 164, 221, 173)),
                 ('graspol', (162, 225, 224, 286))):
    col.crop(box).save(UIT / f'{uit}.png')

print('klaar:', sorted(p.name for p in UIT.glob('*.png')))
