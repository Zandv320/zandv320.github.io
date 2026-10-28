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
    zwaardvechter1..3.png  64×64 frames, 12 kolommen, per animatie 4 rijen (onder, links, rechts, boven)
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


# ---------- zwaardvechter: drie uiterlijken (level 1-3) ----------
for lvl in (1, 2, 3):
    d = SW / f'Swordsman_lvl{lvl}/Without_shadow'
    naam = lambda a: d / f'Swordsman_lvl{lvl}_{a}_without_shadow.png'
    sheets = [open_rgba(naam(a)) for a in ('Idle', 'Run', 'attack', 'Hurt', 'Death')]
    stapel(sheets, 64, 64, 12).save(UIT / f'zwaardvechter{lvl}.png')
    print('zwaardvechter', lvl, [frames_in_rij(s, 64, 64, 0) for s in sheets])

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
