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

KOL = 12
namen = list(KEUZE)
rijen = (len(namen) + KOL - 1) // KOL
atlas = Image.new('RGBA', (KOL * 32, rijen * 32), (0, 0, 0, 0))
index = {}
for i, naam in enumerate(namen):
    pack, n = KEUZE[naam]
    im = Image.open(BRON[pack](n)).convert('RGBA')
    if im.size != (32, 32):
        im = im.resize((32, 32), Image.NEAREST)
    atlas.paste(im, ((i % KOL) * 32, (i // KOL) * 32))
    index[naam] = [i % KOL, i // KOL]
atlas.save(UIT / 'iconen.png')
(SRC / 'iconen_index.js').write_text(
    '/* gegenereerd door tools/maak_iconen.py – niet met de hand bewerken */\n'
    f'export const KOLOMMEN={KOL};\nexport const ICONEN={json.dumps(index, separators=(",", ":"))};\n')
print('iconen:', len(index), 'atlas', atlas.size)
