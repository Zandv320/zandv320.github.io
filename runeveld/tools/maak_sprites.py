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
    gewaad1..3/staf1..3(+b)/hoed1..2 magiër: gewaad, staf met bol en punthoed, afgeleid van de heldlagen
    harnas4..5/gewaad4..5 tweede klassen: knight (staalblauw), crusader (zilver/goud), wizard (middernacht), sage (groen)
    fx/*.png + fx.json      skill- en spreukeffecten uit de Craftpix-effectpacks (één rij frames per effect)
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
for i, lvl in enumerate((1, 2, 3)):                   # kleding als verschil met het naakte lijf; zwaard vóór en achter
    verschil(uit[2 + 3 * i], basis).save(UIT / f'harnas{lvl}.png')
    uit[3 + 3 * i].save(UIT / f'wapen{lvl}.png'); uit[4 + 3 * i].save(UIT / f'wapen{lvl}b.png')

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

# ---------- magiër: gewaad, staf en punthoed, afgeleid van de heldlagen ----------
# Het gewaad is de tuniek in een ander palet plus de benen van het lijf in de zoomkleur (een lang gewaad).
# De staf volgt per frame de as van het houten zwaard (de hand is het eind dat het dichtst bij het lijf ligt) en
# steekt daar voorbij omhoog met een bol op de top; de zwaai-boog wordt een lichtblauwe magie-boog.
# De punthoed gaat net als de helmen per frame op de schedel.
TUNIEK_GRIJS = [(45, 49, 43), (63, 67, 61), (94, 97, 90), (111, 115, 106), (134, 139, 124)]      # donker → licht
GEWADEN = {
    'gewaad1': [(24, 34, 76), (38, 54, 116), (58, 82, 158), (72, 100, 180), (104, 136, 210)],       # blauw
    'gewaad2': [(80, 22, 30), (118, 32, 44), (160, 48, 60), (184, 66, 76), (214, 104, 108)],       # rood
    'gewaad3': [(52, 22, 76), (78, 34, 112), (108, 52, 150), (130, 70, 176), (166, 110, 210)],     # paars
}
LIJF_OMLIJNING = {(85, 45, 36), (121, 80, 72), (81, 50, 46)}


def gewaad(tuniek, lijf, palet, fw=64, fh=64):
    out = Image.new('RGBA', tuniek.size, (0, 0, 0, 0))
    t, l, o = tuniek.load(), lijf.load(), out.load()
    kleur = dict(zip(TUNIEK_GRIJS, palet))
    for r in range(tuniek.height // fh):
        for c in range(tuniek.width // fw):
            fr = tuniek.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)); bb = fr.getbbox()
            if not bb:
                continue
            onder = r * fh + bb[3]                       # eerste rij onder de tuniek
            lb = lijf.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            voet = r * fh + lb[3] if lb else onder
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    p = t[x, y]
                    if p[3] > 0:
                        o[x, y] = kleur.get(p[:3], p[:3]) + (255,)
                    elif onder <= y < voet - 1 and l[x, y][3] > 0 and l[x, y][:3] not in LIJF_OMLIJNING:
                        o[x, y] = palet[1] + (255,)          # de benen onder de tuniek: de zoom van het gewaad
    return out


def lijn(px, x0, y0, x1, y1, kleur):
    """Bresenham, inclusief eindpunten."""
    dx, dy = abs(x1 - x0), -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy
    while True:
        if 0 <= x0 < px.w and 0 <= y0 < px.h:
            px.d[x0, y0] = kleur + (255,)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy


class _Px:
    def __init__(self, im): self.d, self.w, self.h = im.load(), im.width, im.height


HUID = {(190, 134, 95), (225, 178, 110), (246, 202, 116), (164, 111, 89)}


def staf(zwaard, zwaard_b, lijf, hoofd, k, fw=64, fh=64, rijen=4):
    """k: {'hout','hout_l','orb_o','orb','orb_h','boog'}. Geeft (voor, achter).
    De greep is de huidpixel van het lijf die het dichtst bij het heft van het zwaard ligt (de hand). In rust, lopen,
    pijn en dood staat de staf schuin rechtop door de hand (licht naar buiten geheld), met de bol boven het hoofd; in
    de aanvalsframes wijst hij mee met het zwaard, als een stoot naar het doel. Daarna gaan de handpixels er weer
    overheen, zodat de hand de staf vasthoudt in plaats van ernaast te hangen."""
    voor = Image.new('RGBA', zwaard.size, (0, 0, 0, 0)); achter = voor.copy()
    zv, zb, lf = zwaard.load(), zwaard_b.load(), lijf.load()
    vorig = {}                                                # laatste greep per rij, voor frames zonder zwaard
    richting = {}                                             # zwaardrichting van het vorige frame per rij
    boog = lambda p: p[0] > 200 and p[1] > 200 and p[2] > 200
    for r in range(zwaard.height // fh):
        aanval = (r // rijen) == 2                                   # derde animatie: aanval
        for c in range(zwaard.width // fw):
            pv, pb, bg = [], [], []
            for y in range(r * fh, (r + 1) * fh):
                for x in range(c * fw, (c + 1) * fw):
                    for src, lst in ((zv, pv), (zb, pb)):
                        p = src[x, y]
                        if p[3] == 0:
                            continue
                        (bg if boog(p[:3]) else lst).append((x, y, src is zb))
            punten = pv + pb
            doel = achter if len(pb) > len(pv) else voor
            d = _Px(doel)
            for x, y, b in bg:                                    # de zwaai-boog, lichtblauw, in zijn eigen laag
                _Px(achter if b else voor).d[x, y] = k['boog'] + (255,)
            lb = lijf.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            cx, cy = (c * fw + (lb[0] + lb[2]) / 2, r * fh + (lb[1] + lb[3]) / 2) if lb else (c * fw + 32, r * fh + 38)
            hb = hoofd.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh)).getbbox()
            hoofdTop = r * fh + (hb[1] if hb else 18)
            if not punten:
                if r not in vorig:
                    continue
                gx, gy, ux, uy, hand, doel = vorig[r]; d = _Px(doel); heft = (gx, gy); tip = (gx + ux * 8, gy + uy * 8); best = 64
            best, a, bpt = -1, None, None
            for i in range(len(punten)):
                for j in range(i + 1, len(punten)):
                    dd = (punten[i][0] - punten[j][0]) ** 2 + (punten[i][1] - punten[j][1]) ** 2
                    if dd > best:
                        best, a, bpt = dd, punten[i], punten[j]
            if punten:
                if a is None or best < 4:
                    continue
                # welk eind is het heft? In het eerste frame van een rij het eind dat het dichtst bij het lijf ligt;
                # daarna het eind waarbij de richting op die van het vorige frame lijkt, zodat de staf niet omklapt
                # terwijl de hand tijdens het lopen op en neer gaat
                if r in richting:
                    rx, ry = richting[r]
                    heft, tip = (a, bpt) if (bpt[0] - a[0]) * rx + (bpt[1] - a[1]) * ry >= 0 else (bpt, a)
                else:
                    da = (a[0] - cx) ** 2 + (a[1] - cy) ** 2; db = (bpt[0] - cx) ** 2 + (bpt[1] - cy) ** 2
                    heft, tip = (a, bpt) if da <= db else (bpt, a)
                richting[r] = (tip[0] - heft[0], tip[1] - heft[1])
                # de hand: huidpixels van het lijf vlak bij het heft
                hand, hd = None, 99
                for y in range(max(r * fh, heft[1] - 4), min((r + 1) * fh, heft[1] + 5)):
                    for x in range(max(c * fw, heft[0] - 4), min((c + 1) * fw, heft[0] + 5)):
                        p = lf[x, y]
                        if p[3] > 0 and p[:3] in HUID:
                            dd = (x - heft[0]) ** 2 + (y - heft[1]) ** 2
                            if dd < hd:
                                hd, hand = dd, (x, y)
                gx, gy = hand if hand else (heft[0], heft[1])
                L = best ** .5; ux, uy = (tip[0] - heft[0]) / L, (tip[1] - heft[1]) / L
                vorig[r] = (gx, gy, ux, uy, hand, doel)
            if aanval:
                x0, y0 = round(gx - ux * 4), round(gy - uy * 4); x1, y1 = round(gx + ux * 11), round(gy + uy * 11)
                ox, oy = round(gx + ux * 12.5), round(gy + uy * 12.5)
                nx, ny = (1, 0) if abs(uy) >= abs(ux) else (0, 1)
            else:
                # rechtop door de hand, de bol altijd net boven het hoofd (ook als de staf achter het lijf hangt).
                # In de zijaanzichten helt de staf naar voren (de kant waar het figuur heen kijkt), anders wisselt de
                # helling per loopframe met de hand mee; van voren en van achteren helt hij naar de kant van de hand.
                kijk = r % rijen                                                     # 0 front, 1 links, 2 rechts, 3 back
                uit = -1 if kijk == 1 else 1 if kijk == 2 else (1 if gx >= cx else -1)
                ox, oy = gx + uit * 3, hoofdTop - 3
                vx, vy = ox - gx, oy - gy; L = max(1, (vx * vx + vy * vy) ** .5); vx, vy = vx / L, vy / L
                x0, y0 = round(gx - vx * 9), round(gy - vy * 9); x1, y1 = round(ox - vx * 1.5), round(oy - vy * 1.5)
                nx, ny = (1, 0)
            lijn(d, x0 + nx, y0 + ny, x1 + nx, y1 + ny, k['hout_l'])
            lijn(d, x0, y0, x1, y1, k['hout'])
            for yy in range(-1, 2):                                            # de bol op de top
                for xx in range(-1, 2):
                    rand = abs(xx) + abs(yy) == 2
                    d.d[ox + xx, oy + yy] = (k['orb_o'] if rand else k['orb']) + (255,)
            for xx, yy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
                d.d[ox + xx, oy + yy] = k['orb_o'] + (255,)
            d.d[ox, oy] = k['orb_h'] + (255,)
            # de hand weer bovenop de staf, zodat hij hem vasthoudt (alleen als de staf vóór het lijf ligt)
            if doel is voor and hand:
                for y in range(gy - 2, gy + 3):
                    for x in range(gx - 2, gx + 3):
                        if r * fh <= y < (r + 1) * fh and c * fw <= x < (c + 1) * fw:
                            p = lf[x, y]
                            if p[3] > 0 and p[:3] in HUID and doel.getpixel((x, y))[3] > 0:
                                d.d[x, y] = p
    return voor, achter


STAVEN = {
    'staf1': dict(hout=(85, 45, 33), hout_l=(147, 97, 65), orb_o=(30, 80, 44), orb=(90, 200, 110), orb_h=(210, 255, 220), boog=(150, 200, 255)),
    'staf2': dict(hout=(60, 34, 24), hout_l=(118, 76, 48), orb_o=(30, 50, 130), orb=(90, 140, 240), orb_h=(220, 236, 255), boog=(150, 200, 255)),
    'staf3': dict(hout=(50, 52, 72), hout_l=(150, 156, 180), orb_o=(90, 30, 140), orb=(190, 110, 255), orb_h=(245, 225, 255), boog=(200, 170, 255)),
}
tuniek_laag = verschil(uit[2], basis)           # de tuniek (level 1) zonder het lijf
for naam, palet in GEWADEN.items():
    gewaad(tuniek_laag, basis, palet).save(UIT / f'{naam}.png')
for naam, k in STAVEN.items():
    v, a = staf(uit[3], uit[4], basis, uit[1], k)
    v.save(UIT / f'{naam}.png'); a.save(UIT / f'{naam}b.png')

# ---------- tweede klassen: Knight en Crusader (harnas in staalblauw / zilver met goud), Wizard en Sage (gewaad) ----------
import colorsys
GEWADEN['gewaad4'] = [(14, 20, 52), (24, 34, 84), (36, 52, 120), (50, 74, 150), (80, 110, 190)]        # wizard: middernacht
GEWADEN['gewaad5'] = [(24, 52, 34), (36, 80, 50), (52, 112, 70), (72, 140, 92), (110, 176, 128)]       # sage: woudgroen
for naam in ('gewaad4', 'gewaad5'):
    gewaad(tuniek_laag, basis, GEWADEN[naam]).save(UIT / f'{naam}.png')


def hsv_laag(im, fn):
    """Past fn(h, s, v) → (h, s, v) toe op elke pixel die geen omlijning is."""
    out = im.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or (r < 40 and g < 40 and b < 40):
                continue
            h, sv, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            h, sv, v = fn(h, sv, v)
            rr, gg, bb = colorsys.hsv_to_rgb(h % 1, max(0, min(1, sv)), max(0, min(1, v)))
            px[x, y] = (int(rr * 255), int(gg * 255), int(bb * 255), a)
    return out


harnas3_laag = verschil(uit[8], basis)
hsv_laag(harnas3_laag, lambda h, s, v: (h + .04, s * .55, v * .82)).save(UIT / 'harnas4.png')                       # knight: donker staalblauw
hsv_laag(harnas3_laag, lambda h, s, v: ((.12, .8, min(1, v * 1.25)) if (h < .06 or h > .93) else (h, s * .2, min(1, v * 1.2)))).save(UIT / 'harnas5.png')  # crusader: zilver, rood wordt goud

HOED_FRONT = """
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
HOED_RIGHT = """
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
HOED_BACK = """
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
VILT = {'o': (26, 24, 52), 'd': (34, 50, 110), 'm': (56, 80, 160), 'l': (90, 124, 205), 'h': (140, 172, 235), 'g': (214, 172, 78)}
ARCAAN = {'o': (36, 16, 52), 'd': (70, 30, 110), 'm': (104, 50, 156), 'l': (140, 86, 200), 'h': (190, 150, 236), 'g': (255, 214, 110)}
hoofddeksel(uit[1], HOED_FRONT, HOED_RIGHT, HOED_BACK, VILT, rand=13).save(UIT / 'hoed1.png')
hoofddeksel(uit[1], HOED_FRONT, HOED_RIGHT, HOED_BACK, ARCAAN, rand=13).save(UIT / 'hoed2.png')

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

# ---------- effecten: Craftpix "Free Pixel Magic Sprite Effects" en "11 Free Pixel Art Explosion Sprites" ----------
# Losse frames worden tot één rij geknipt (strak om de tekening heen, vierkant en gecentreerd zodat de animatie niet
# verspringt). De maten komen in sprites/fx/fx.json, zodat fx.js niets hoeft te weten van de bron.
import json
FXE = BRON / 'fx-explosion/PNG'
FXM = BRON / 'fx-magic/1 Magic'
FX = UIT / 'fx'
FX.mkdir(exist_ok=True)
fxinfo = {}


def knip_reeks(frames, marge=2):
    """Alle frames om dezelfde vierkante uitsnede (rond het midden van het frame) en naast elkaar."""
    x0 = min(f.getbbox()[0] for f in frames); y0 = min(f.getbbox()[1] for f in frames)
    x1 = max(f.getbbox()[2] for f in frames); y1 = max(f.getbbox()[3] for f in frames)
    w, h = frames[0].size
    r = max(w / 2 - x0, x1 - w / 2, h / 2 - y0, y1 - h / 2) + marge
    r = int(min(r, w / 2, h / 2)); s = 2 * r
    out = Image.new('RGBA', (s * len(frames), s), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f.crop((w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r)), (i * s, 0))
    return out, s


def reeks(map_, naam, nrs):
    return [open_rgba(FXE / map_ / f'{naam}{i}.png') for i in nrs]


for uit, map_, naam, nrs, fps in (
        ('explosie', 'Explosion', 'Explosion', range(1, 11), 20),
        ('vuurkring', 'Circle_explosion', 'Circle_explosion', range(1, 11), 18),
        ('vorst', 'Explosion_blue_circle', 'Explosion_blue_circle', range(1, 11), 18),
        ('vorst2', 'Explosion_blue_oval', 'Explosion_blue_oval', range(1, 11), 16),
        ('groenkring', 'Explosion_gas_circle', 'Explosion_gas_circle', range(1, 11), 18),
        ('tweekleur', 'Explosion_two_colors', 'Explosion_two_colors', range(1, 11), 18),
        ('rook', 'Smoke', 'Smoke', range(1, 7), 12),
        ('vonk', 'Lightning', 'Lightning_spot', range(1, 5), 16),
        ('vuur', 'Fire', 'Fire', range(1, 7), 10),                          # brandende grond (loop)
        ('paddenstoel', 'Nuclear_explosion', 'Nuclear_explosion', range(1, 11), 14),   # de inslag van Starfall
        ('gifwolk', 'Explosion_gas', 'Explosion_gas', range(1, 11), 16)):
    sheet, s = knip_reeks(reeks(map_, naam, nrs))
    sheet.save(FX / f'{uit}.png'); fxinfo[uit] = dict(fw=s, fh=s, n=len(nrs), fps=fps)
# de bliksem: begin, drie slagen, einde; hoog en smal, niet vierkant
bl = [open_rgba(FXE / 'Lightning' / f'{n}.png') for n in ('Lightning_beginning1', 'Lightning_beginning2', 'Lightning_beginning3', 'Lightning_beginning4', 'Lightning_beginning5', 'Lightning_cycle1', 'Lightning_cycle2', 'Lightning_cycle3', 'Lightning_end1', 'Lightning_end2', 'Lightning_end3')]
sheet = Image.new('RGBA', (64 * len(bl), 193), (0, 0, 0, 0))
for i, f in enumerate(bl):
    sheet.paste(f, (i * 64, 0))
sheet.save(FX / 'bliksem.png'); fxinfo['bliksem'] = dict(fw=64, fh=193, n=len(bl), fps=16)
# magie-sheets: 72 px hoog, frames van 72 breed
for uit, naam, fps in (('ring', '2', 14), ('slag', '3_2', 18), ('komeet', '4_1', 12), ('spiesen', '7', 14), ('sprankel', '8', 12), ('flits', '9', 18), ('wortels', '1', 14), ('splash', '10', 14),
                       ('straal', '3', 18), ('harten', '5', 12), ('spat', '6_2', 16), ('knal', '4_2', 16), ('kaars', '6', 12)):
    im = open_rgba(FXM / f'{naam}.png')
    im.save(FX / f'{uit}.png'); fxinfo[uit] = dict(fw=72, fh=72, n=im.width // 72, fps=fps)
(FX / 'fx.json').write_text(json.dumps(fxinfo))
print('effecten:', {k: (v['fw'], v['n']) for k, v in fxinfo.items()})

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
for p in sorted(q for q in UIT.glob('*.png') if q.stem != 'iconen'):
    glad(Image.open(p)).save(GLAD / p.name)
print('gladde sprites:', len(list(GLAD.glob('*.png'))))

print('klaar:', sorted(p.name for p in UIT.glob('*.png')))
