"""Runeveld – bouwt de icoonatlas sprites/iconen.png (cellen van 32×32) en src/iconen_index.js uit de gratis
Craftpix-iconpacks. Elk icoon krijgt de id van het ding in het spel (skill, item, klasse of knop), zodat de UI
met ico('beuk') kan tekenen zonder iets van de bron te weten.

Gebruik: python3 -I tools/maak_iconen.py <map met uitgepakte iconpacks> <map met uitgepakte effectpacks> [sprites-map]
Packs: Free Swordsman Skills, Free Paladin Skill Icons, Free RPG Loot Icons, Free 40 Loot Icons,
       Free Magic Potions, Free Basic Pixel Art Fantasy Icons 16x16 (de 32px-varianten), plus de icoontjes uit
       de effectpacks (Free Pixel Magic Sprite Effects, 11 Free Explosion Sprites)."""
import sys, pathlib, json, glob
from PIL import Image

ICO = pathlib.Path(sys.argv[1]); FX = pathlib.Path(sys.argv[2])
UIT = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else 'runeveld/sprites')
SRC = UIT.parent / 'src'


def een(patroon):
    f = sorted(glob.glob(str(patroon), recursive=True))
    if not f: raise SystemExit(f'niet gevonden: {patroon}')
    return f[0]


BRON = {   # pack → functie(nummer) → pad
    'zw': lambda n: een(ICO / '*swordsman-skills*/PNG' / f'Icon{n}.png'),
    'pal': lambda n: een(ICO / '*paladin*/PNG' / f'Icon{n}.png'),
    'loot': lambda n: een(ICO / 'rpgloot/PNG/Transperent' / f'Icon{n}.png'),
    'buit': lambda n: een(ICO / '*40-loot*/1 Icons' / f'Icons_{n:02d}.png'),
    'drank': lambda n: een(ICO / '*magic-potions*/PNG/Transperent' / f'Icon{n}.png'),
    'klein': lambda n: een(ICO / '*fantasy-icons-16x16*/PNG/Separately' / f'Icon{n}_1_2.png'),
    'ks': lambda n: een(ICO / '*fantasy-icons-16x16*/PNG/Separately' / f'Skill_icon{n}.png'),
    'fxm': lambda n: een(FX / 'fx-magic/2 Icons' / f'Icon_{n:02d}.png'),
    'exp': lambda n: een(FX / 'fx-explosion/PNG/Icons' / f'Icon{n}.png'),
}

# id in het spel → (pack, nummer)
KEUZE = {
    # zwaardvechter
    'beuk': ('zw', 33), 'vuurkring': ('zw', 29), 'zwaardbeheersing': ('zw', 14), 'hpherstel': ('zw', 24),
    'provocatie': ('zw', 12), 'wapenversnelling': ('zw', 20), 'ijzerhuid': ('zw', 9), 'doodslag': ('zw', 2),
    # knight
    'doorboor': ('zw', 27), 'rolstoot': ('zw', 42), 'volharden': ('zw', 31), 'spiraal': ('zw', 37),
    # crusader
    'heiligkruis': ('pal', 1), 'schildstoot': ('pal', 24), 'genezing': ('pal', 3), 'heiligeschild': ('pal', 16),
    # magiër
    'vuurpijl': ('fxm', 4), 'vorstnova': ('exp', 3), 'barriere': ('pal', 25), 'ijsbout': ('fxm', 2),
    'zielsslag': ('fxm', 9), 'spreukfocus': ('pal', 18), 'stafbeheersing': ('pal', 47), 'meditatie': ('pal', 17),
    # wizard
    'bliksem': ('exp', 9), 'stormvlaag': ('exp', 11), 'energiemantel': ('pal', 29), 'meteoor': ('pal', 13),
    # sage
    'aardspies': ('pal', 20), 'manaspiegel': ('pal', 46), 'manabron': ('pal', 12),
    # klassen
    'k_swordsman': ('zw', 4), 'k_mage': ('fxm', 10), 'k_knight': ('zw', 31), 'k_crusader': ('pal', 1),
    'k_wizard': ('exp', 9), 'k_sage': ('pal', 44),
    # items
    'drank': ('drank', 1), 'leren_kap': ('klein', 34), 'ijzeren_helm': ('buit', 40), 'punthoed': ('klein', 32),
    'sterrenhoed': ('klein', 33), 'tuniek': ('klein', 37), 'vest': ('klein', 31), 'harnas': ('klein', 40),
    'gewaad': ('klein', 36), 'zijden_gewaad': ('klein', 39), 'magiergewaad': ('klein', 35),
    'ridderharnas': ('pal', 31), 'kruisharnas': ('pal', 32), 'wizardgewaad': ('klein', 36), 'sagegewaad': ('klein', 33),
    'houtzwaard': ('klein', 46), 'ijzerzwaard': ('klein', 57), 'staalzwaard': ('buit', 23),
    'houtstaf': ('klein', 60), 'eikenstaf': ('klein', 52), 'kristalstaf': ('klein', 41),
    'konijnenpoot': ('loot', 47), 'vossenstaart': ('loot', 3), 'zwijnenhuid': ('loot', 26), 'wolfsvacht': ('loot', 2),
    'gewei': ('loot', 45), 'slagtand': ('loot', 21),
    # interface
    'ui_zit': ('ks', 15), 'ui_chat': ('klein', 12), 'ui_kaart': ('klein', 45), 'ui_tas': ('klein', 48),
    'ui_quests': ('buit', 29), 'ui_char': ('klein', 40), 'ui_zeny': ('buit', 1), 'ui_geluid': ('klein', 9),
    'ui_zon': ('klein', 3), 'ui_maan': ('klein', 2), 'ui_huis': ('klein', 61), 'ui_admin': ('klein', 54),
}

# ---- procedurele iconen voor wat de packs niet hebben: ringen, riemen, laarzen; en getinte varianten ----
from PIL import ImageDraw
import numpy as np
LIJN = (12, 15, 42, 255)


def omlijn(img):
    a = np.array(img); al = a[:, :, 3] > 40; b = np.zeros_like(al)
    b[1:, :] |= al[:-1, :]; b[:-1, :] |= al[1:, :]; b[:, 1:] |= al[:, :-1]; b[:, :-1] |= al[:, 1:]
    a[b & ~al] = LIJN; return Image.fromarray(a)


def ring(steen, band=((150, 120, 60), (214, 178, 90), (250, 230, 170))):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([7, 10, 25, 28], outline=band[0] + (255,), width=4); d.ellipse([8, 11, 24, 27], outline=band[1] + (255,), width=2)
    d.arc([8, 11, 24, 27], 200, 320, fill=band[2] + (255,), width=2)
    if steen:
        d.polygon([(16, 3), (22, 8), (16, 13), (10, 8)], fill=steen[0] + (255,)); d.polygon([(16, 5), (19, 8), (16, 11), (13, 8)], fill=steen[1] + (255,)); d.point((15, 6), fill=(255, 255, 255, 255))
    return omlijn(im)


def riem(gesp=(214, 178, 90), leer=((70, 42, 24), (118, 76, 40))):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 12, 29, 20], radius=3, fill=leer[0] + (255,)); d.rectangle([4, 13, 28, 15], fill=leer[1] + (255,))
    for x in range(7, 27, 5): d.point((x, 18), fill=leer[1] + (255,))
    d.rectangle([12, 10, 19, 22], outline=gesp + (255,), width=2); d.rectangle([15, 13, 16, 19], fill=gesp + (255,))
    return omlijn(im)


def laarzen(leer=((70, 42, 24), (118, 76, 40), (160, 110, 60)), zool=(40, 30, 24)):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for dx in (0, 12):
        d.rectangle([5 + dx, 5, 12 + dx, 22], fill=leer[1] + (255,)); d.rectangle([5 + dx, 18, 17 + dx, 26], fill=leer[1] + (255,))
        d.rectangle([5 + dx, 24, 17 + dx, 27], fill=zool + (255,)); d.line([(6 + dx, 6), (6 + dx, 20)], fill=leer[2] + (255,)); d.line([(5 + dx, 12), (12 + dx, 12)], fill=leer[0] + (255,))
    return omlijn(im)


def tint(im, kleur):
    """een icoon een kleurzweem geven (vermenigvuldigen), omlijning blijft"""
    a = np.array(im).astype(np.int32); m = a[:, :, 3] > 0
    for i, k in enumerate(kleur): a[:, :, i] = np.where(m & ~((a[:, :, 0] == LIJN[0]) & (a[:, :, 1] == LIJN[1]) & (a[:, :, 2] == LIJN[2])), np.clip(a[:, :, i] * k / 255, 0, 255), a[:, :, i])
    return Image.fromarray(a.astype(np.uint8))


EIGEN = {
    'koperring': ring(None, ((120, 70, 40), (190, 110, 60), (240, 180, 130))), 'krachtring': ring(((140, 30, 40), (220, 70, 80))), 'wijsheidsring': ring(((30, 60, 150), (80, 130, 230))),
    'behendigheidsring': ring(((30, 110, 50), (90, 200, 110))), 'koningsring': ring(((150, 40, 160), (220, 120, 240))),
    'leren_riem': riem((160, 160, 170)), 'gespriem': riem(), 'ridderriem': riem((200, 205, 220), ((40, 44, 60), (80, 86, 110))),
    'stoffen_schoenen': laarzen(((90, 90, 100), (150, 150, 160), (200, 200, 210)), (70, 70, 80)), 'leren_laarzen': laarzen(), 'ijzeren_laarzen': laarzen(((50, 54, 70), (110, 116, 140), (170, 176, 200)), (40, 40, 50)),
}
TINTEN = {'leren_broek': (200, 170, 130), 'geschubde_broek': (160, 180, 230), 'wolmantel': (150, 170, 255), 'schaduwmantel': (110, 110, 140), 'koningsmantel': (255, 120, 120), 'zilveren_ketting': (200, 210, 255), 'wolfstand_ketting': (240, 230, 200), 'amulet_van_aurelia': (255, 230, 150)}
KEUZE.update({
    'reismantel': ('klein', 35), 'wolmantel': ('klein', 35), 'schaduwmantel': ('klein', 35), 'koningsmantel': ('klein', 39),
    'leren_koord': ('buit', 26), 'zilveren_ketting': ('buit', 26), 'wolfstand_ketting': ('loot', 34), 'amulet_van_aurelia': ('buit', 26),
    'linnen_broek': ('klein', 38), 'leren_broek': ('klein', 38), 'geschubde_broek': ('klein', 38),
})
for n in EIGEN: KEUZE[n] = ('eigen', 0)

KOL = 12
namen = list(KEUZE)
rijen = (len(namen) + KOL - 1) // KOL
atlas = Image.new('RGBA', (KOL * 32, rijen * 32), (0, 0, 0, 0))
index = {}
for i, naam in enumerate(namen):
    pack, n = KEUZE[naam]
    im = EIGEN[naam] if pack == 'eigen' else Image.open(BRON[pack](n)).convert('RGBA')
    if naam in TINTEN: im = tint(im, TINTEN[naam])
    if im.size != (32, 32):
        im = im.resize((32, 32), Image.NEAREST)
    atlas.paste(im, ((i % KOL) * 32, (i // KOL) * 32))
    index[naam] = [i % KOL, i // KOL]
atlas.save(UIT / 'iconen.png')
(SRC / 'iconen_index.js').write_text(
    '/* gegenereerd door tools/maak_iconen.py – niet met de hand bewerken */\n'
    f'export const KOLOMMEN={KOL};\nexport const ICONEN={json.dumps(index, separators=(",", ":"))};\n')
print('iconen:', len(index), 'atlas', atlas.size)
