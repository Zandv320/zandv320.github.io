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
    hert/wolf/everzwijn.png bosdieren: hert uit het pack, wolf en reuzenzwijn herkleurd uit vos en zwijn
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
HAAR = {(33, 26, 28), (43, 32, 35), (59, 44, 51), (77, 57, 69), (104, 79, 90), (135, 108, 125)}
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


OGEN = {(63, 106, 212), (17, 11, 0)}      # iris en pupil: het stabiele anker voor de hoogte


def hoofddeksel(hoofd, front, right, back, kleuren, rand, fw=64, fh=64):
    """Zet per frame het juiste deksel op het hoofd. Rij r binnen een animatie: 0 front, 1 left, 2 right, 3 back.
    Horizontaal: het midden van de schedel (de bovenste vier haarrijen; wapperend haar telt niet mee).
    Verticaal: de rand van het deksel (`rand` = rij-index van de onderste randrij) komt één pixel boven de ogen;
    zonder ogen in beeld (rugaanzicht) sluit de bovenkant op het haar aan."""
    art = {0: tekening(front, kleuren), 1: spiegel(tekening(right, kleuren)), 2: tekening(right, kleuren), 3: tekening(back, kleuren)}
    # het resultaat is een complete hoofdlaag (hoofd + deksel) die de gewone hoofdlaag vervangt:
    # haar op en boven de rand wordt weggehaald, zodat er geen plukken door de helm steken
    out = hoofd.copy()
    src, dst = hoofd.load(), out.load()
    for r in range(hoofd.height // fh):
        deksel = art[r % 4]
        for c in range(hoofd.width // fw):
            haar, ogen = [], []
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    p = src[x, y]
                    if p[3] == 0:
                        continue
                    if p[:3] in HAAR:
                        haar.append((x, y))
                    elif p[:3] in OGEN:
                        ogen.append((x, y))
            if not haar:
                continue
            top = min(y for _, y in haar)
            schedel = [x for x, y in haar if y <= top + 3]
            xc = (min(schedel) + max(schedel)) / 2
            x0 = int(xc - deksel.width / 2 + 1)
            y0 = (min(y for _, y in ogen) - 1 - rand) if ogen else top - 1
            for x, y in haar:
                if y <= y0 + rand:
                    dst[x, y] = (0, 0, 0, 0)
            out.alpha_composite(deksel, (x0, y0))
    return out


hoofddeksel(uit[1], PET_FRONT, PET_RIGHT, PET_BACK, LEER, rand=8).save(UIT / 'hoofd1.png')      # leren pet
hoofddeksel(uit[1], HELM_FRONT, HELM_RIGHT, HELM_BACK, IJZER, rand=8).save(UIT / 'hoofd2.png')  # ijzeren helm

# ---------- dieren ----------
for uit, map_, anims in (
        ('konijn', 'Hare', ('Hare_Idle', 'Hare_Walk', 'Hare_Run', 'Hare_Hurt', 'Hare_Death')),
        ('vos', 'Fox', ('Fox_Idle', 'Fox_walk', 'Fox_Run', 'Fox_Hurt', 'Fox_Death')),
        ('zwijn', 'Boar', ('Boar_Idle', 'Boar_Walk', 'Boar_Attack', 'Boar_Hurt', 'Boar_Death'))):
    sheets = [open_rgba(DIER / map_ / f'{a}.png') for a in anims]
    stapel(sheets, 32, 32, 6).save(UIT / f'{uit}.png')
    print(uit, [frames_in_rij(s, 32, 32, 0) for s in sheets])

# ---------- bosdieren: het hert uit het pack, en een wolf en een reuzenzwijn als herkleuring van vos en zwijn ----------
def herkleur_dier(im, fn):
    """Past fn(r,g,b) toe op elke niet-doorzichtige pixel; zwarte omlijning blijft."""
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or (r < 40 and g < 40 and b < 40):
                continue
            px[x, y] = (*fn(r, g, b), a)
    return out

def wolfkleur(r, g, b):
    """oranje vacht → blauwgrijs; wit en licht blijven licht"""
    v = max(r, g, b); s = 0 if v == 0 else (v - min(r, g, b)) / v
    if s < .22:
        return (r, g, b)
    return (int(v * .62), int(v * .66), int(v * .74))

def everzwijnkleur(r, g, b):
    """donkerder en roder; lichte delen (slagtanden) blijven licht"""
    v = max(r, g, b)
    if v > 200 and max(r, g, b) - min(r, g, b) < 60:
        return (r, g, b)
    return (int(r * .58), int(g * .42), int(b * .40))

for uit, map_, anims, fn in (
        ('hert', 'Deer', ('Deer_Idle', 'Deer_Walk', 'Deer_Run', 'Deer_Hurt', 'Deer_Death'), None),
        ('wolf', 'Fox', ('Fox_Idle', 'Fox_walk', 'Fox_Run', 'Fox_Hurt', 'Fox_Death'), wolfkleur),
        ('everzwijn', 'Boar', ('Boar_Idle', 'Boar_Walk', 'Boar_Attack', 'Boar_Hurt', 'Boar_Death'), everzwijnkleur)):
    sheets = [open_rgba(DIER / map_ / f'{a}.png') for a in anims]
    if fn:
        sheets = [herkleur_dier(sh, fn) for sh in sheets]
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

# ---------- tegelbare texturen voor de 3D-dorpsomgeving (bouw.js), in het palet van de sprites ----------
# Zo past de 3D-omgeving bij de Craftpix-stijl: dezelfde kleuren, dezelfde pixeldichtheid (16 px per eenheid).
PAL = {'lijn': (12, 15, 42), 'dak': (108, 129, 161), 'dak_d': (64, 82, 115), 'pleister': (254, 225, 184), 'balk': (181, 89, 69),
       'balk_d': (61, 51, 51), 'steen': (135, 133, 124), 'steen_d': (99, 102, 99), 'steen_l': (188, 173, 159), 'hout': (181, 89, 69),
       'hout_l': (208, 119, 83), 'hout_d': (115, 76, 68), 'hout_h': (235, 150, 97), 'rood': (178, 45, 45), 'tan': (212, 198, 146),
       'groen': (129, 148, 71), 'glas': (108, 129, 161), 'glas_l': (188, 173, 159), 'water': (88, 124, 166), 'water_l': (170, 196, 222), 'water_d': (64, 82, 115),
       'hooi': (212, 198, 146), 'hooi_d': (170, 148, 90), 'aarde': (160, 118, 72), 'aarde_d': (120, 86, 52)}
TEX = UIT / 'tex'
TEX.mkdir(exist_ok=True)


def textuur(naam, w, h, teken):
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    def vul(x0, y0, x1, y1, k):
        for y in range(y0, y1):
            for x in range(x0, x1):
                px[x % w, y % h] = PAL[k] + (255,)
    teken(vul, px)
    im.save(TEX / f'{naam}.png')


# pleistermuur met rode balken (vakwerk), 64×64
def muur(vul, px):
    vul(0, 0, 64, 64, 'pleister')
    for x in (0, 32):
        vul(x, 0, x + 4, 64, 'balk')
    vul(0, 0, 64, 4, 'balk'); vul(0, 60, 64, 64, 'balk')
    for i in range(0, 28):                       # schuine schoren
        vul(4 + i, 56 - i * 2, 7 + i, 58 - i * 2, 'balk'); vul(36 + i, 56 - i * 2, 39 + i, 58 - i * 2, 'balk')
    for x in (0, 32):
        vul(x + 4, 0, x + 5, 64, 'balk_d')
    vul(0, 4, 64, 5, 'balk_d')
textuur('muur', 64, 64, muur)

# blauwe dakpannen, 32×32: rijen van 8 met verspringende naden
def dak(vul, px):
    vul(0, 0, 32, 32, 'dak')
    for r in range(4):
        y = r * 8
        vul(0, y + 7, 32, y + 8, 'dak_d')
        off = 8 if r % 2 else 0
        for x in range(off, 32 + off, 16):
            vul(x, y, x + 1, y + 8, 'dak_d')
        vul(0, y, 32, y + 1, 'lijn')
textuur('dak', 32, 32, dak)

# grijze stenen blokken, 32×32
def steen(vul, px):
    vul(0, 0, 32, 32, 'steen')
    for r in range(4):
        y = r * 8; off = 8 if r % 2 else 0
        vul(0, y + 7, 32, y + 8, 'steen_d')
        for x in range(off, 32 + off, 16):
            vul(x, y, x + 1, y + 8, 'steen_d'); vul(x + 1, y, x + 15, y + 1, 'steen_l')
textuur('steen', 32, 32, steen)

# houten planken (verticaal), 32×32, en een donkere variant voor palen en lijsten
def planken(k, kl, kd):
    def f(vul, px):
        vul(0, 0, 32, 32, k)
        for x in range(0, 32, 8):
            vul(x, 0, x + 1, 32, kd); vul(x + 1, 0, x + 2, 32, kl)
        for (x, y) in ((3, 5), (11, 20), (19, 9), (27, 26), (5, 28), (21, 2)):
            vul(x, y, x + 3, y + 1, kd)
    return f
textuur('hout', 32, 32, planken('hout', 'hout_l', 'hout_d'))
textuur('hout_donker', 32, 32, planken('hout_d', 'hout', 'balk_d'))

# luifelstof: verticale strepen, 32×16
def strepen(a, b):
    def f(vul, px):
        for x in range(0, 32, 8):
            vul(x, 0, x + 8, 16, a if (x // 8) % 2 == 0 else b)
    return f
textuur('stof_rood', 32, 16, strepen('rood', 'pleister'))
textuur('stof_groen', 32, 16, strepen('groen', 'tan'))

# glas-in-lood, 16×16
def glas(vul, px):
    vul(0, 0, 16, 16, 'glas')
    for i in range(16):
        vul(i, 15 - i, i + 1, 16 - i, 'glas_l')
    vul(7, 0, 9, 16, 'balk_d'); vul(0, 7, 16, 9, 'balk_d')
textuur('glas', 16, 16, glas)

# water, 16×16
def water(vul, px):
    vul(0, 0, 32, 32, 'water')
    for (x, y, l) in ((2, 4, 6), (18, 7, 7), (9, 13, 5), (24, 16, 6), (4, 22, 7), (16, 26, 6), (27, 27, 4)):
        vul(x, y, x + l, y + 1, 'water_l')
    for (x, y, l) in ((12, 3, 4), (3, 10, 5), (22, 11, 4), (14, 19, 6), (26, 22, 4), (8, 29, 5)):
        vul(x, y, x + l, y + 1, 'water_d')
textuur('water', 32, 32, water)

# hooibaal: tan met donkere strohalmen, 32×32
def hooi(vul, px):
    vul(0, 0, 32, 32, 'hooi')
    for (x, y, l) in ((2, 3, 6), (12, 7, 9), (22, 2, 7), (5, 14, 8), (18, 17, 6), (26, 12, 5), (1, 24, 7), (14, 27, 9), (24, 23, 6), (9, 20, 4)):
        vul(x, y, x + l, y + 1, 'hooi_d')
textuur('hooi', 32, 32, hooi)

# omgewoelde aarde voor de moestuin, 32×32 met rijen
def aarde(vul, px):
    vul(0, 0, 32, 32, 'aarde')
    for y in range(2, 32, 8):
        vul(0, y, 32, y + 2, 'aarde_d')
    for (x, y) in ((4, 6), (13, 14), (22, 6), (8, 22), (26, 22), (17, 30)):
        vul(x, y, x + 3, y + 1, 'groen'); vul(x + 1, y - 1, x + 2, y, 'groen')
textuur('aarde', 32, 32, aarde)

# keien en pad: de tegels uit de Craftpix-tileset zelf
tegel(1).save(TEX / 'keien.png')
tegel(27).save(TEX / 'keien2.png')
tegel(6).save(TEX / 'pad.png')
print('texturen:', sorted(p.name for p in TEX.glob('*.png')))

# ---------- gladde versie: Scale2x twee keer (4×) en terug naar 2× met Lanczos ----------
# Scale2x (EPX) maakt schuine pixeltrappen vloeiend zonder te vervagen; de laatste stap verzacht de randen.
# De engine kan deze 2×-sprites met zachte filtering tekenen ("smooth graphics" in het admin-paneel).
import numpy as np


def scale2x(a):
    """a: array (h, w, 4) uint8 → (2h, 2w, 4)."""
    h, w, _ = a.shape
    v = a.view(np.uint32).reshape(h, w)                     # één getal per pixel, voor snelle vergelijking
    P = v
    A = np.vstack([v[:1], v[:-1]])                          # boven
    D = np.vstack([v[1:], v[-1:]])                          # onder
    C = np.hstack([v[:, :1], v[:, :-1]])                    # links
    B = np.hstack([v[:, 1:], v[:, -1:]])                    # rechts
    e0 = np.where((C == A) & (C != D) & (A != B), A, P)
    e1 = np.where((A == B) & (A != C) & (B != D), B, P)
    e2 = np.where((D == C) & (D != B) & (C != A), C, P)
    e3 = np.where((B == D) & (B != A) & (D != C), D, P)
    out = np.empty((h * 2, w * 2), dtype=np.uint32)
    out[0::2, 0::2] = e0; out[0::2, 1::2] = e1; out[1::2, 0::2] = e2; out[1::2, 1::2] = e3
    return out.view(np.uint8).reshape(h * 2, w * 2, 4)


def glad(im):
    a = np.array(im.convert('RGBA'))
    a[a[:, :, 3] == 0] = 0                                  # doorzichtige pixels gelijkmaken, anders ziet Scale2x valse randen
    b = scale2x(scale2x(a))
    return Image.fromarray(b, 'RGBA').resize((im.width * 2, im.height * 2), Image.LANCZOS)


GLAD = UIT / 'glad'
GLAD.mkdir(exist_ok=True)
for p in sorted(UIT.glob('*.png')):
    glad(Image.open(p)).save(GLAD / p.name)
print('gladde sprites:', len(list(GLAD.glob('*.png'))))

print('klaar:', sorted(p.name for p in UIT.glob('*.png')))
