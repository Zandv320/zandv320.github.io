"""Eldoria: builds the icon atlas sprites/icons.png (32x32 cells) and src/icon-index.js from the Craftpix packs.

Every icon gets the id of the thing it shows in the game (skill, item, class or button), so the UI can draw it with
icon("crushing_blow") without knowing anything about the source.

Usage: python3 -I runeveld/tools/build_icons.py <unpacked icon packs dir> <unpacked effect packs dir> [sprites dir]
Packs: Free Swordsman Skills, Free Paladin Skill Icons, Free RPG Loot Icons, Free 40 Loot Icons, Free Magic Potions,
       Free Basic Pixel Art Fantasy Icons 16x16 (the 32 px variants), plus the small icons from the effect packs
       (Free Pixel Magic Sprite Effects, 11 Free Explosion Sprites).
"""

import colorsys
import glob
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

COLUMNS = 12
OUTLINE = (12, 15, 42, 255)


def first_match(pattern):
    files = sorted(glob.glob(str(pattern), recursive=True))
    if not files:
        raise SystemExit(f"not found: {pattern}")
    return files[0]


def pack_sources(icon_dir, fx_dir):
    """Pack name -> function(number) -> path of that icon."""
    return {
        "swordsman": lambda n: first_match(icon_dir / "*swordsman-skills*/PNG" / f"Icon{n}.png"),
        "paladin": lambda n: first_match(icon_dir / "*paladin*/PNG" / f"Icon{n}.png"),
        "rpg_loot": lambda n: first_match(icon_dir / "rpgloot/PNG/Transperent" / f"Icon{n}.png"),
        "loot40": lambda n: first_match(icon_dir / "*40-loot*/1 Icons" / f"Icons_{n:02d}.png"),
        "potions": lambda n: first_match(icon_dir / "*magic-potions*/PNG/Transperent" / f"Icon{n}.png"),
        "basic": lambda n: first_match(icon_dir / "*fantasy-icons-16x16*/PNG/Separately" / f"Icon{n}_1_2.png"),
        "basic_skill": lambda n: first_match(icon_dir / "*fantasy-icons-16x16*/PNG/Separately" / f"Skill_icon{n}.png"),
        "fx_magic": lambda n: first_match(fx_dir / "fx-magic/2 Icons" / f"Icon_{n:02d}.png"),
        "fx_explosion": lambda n: first_match(fx_dir / "fx-explosion/PNG/Icons" / f"Icon{n}.png"),
    }


# game id -> (pack, number); the order here is the order in the atlas
CHOICES = {
    # swordsman
    "crushing_blow": ("swordsman", 33),
    "flame_sweep": ("swordsman", 29),
    "blade_mastery": ("swordsman", 14),
    "second_wind": ("swordsman", 24),
    "war_cry": ("swordsman", 12),
    "quickening": ("swordsman", 20),
    "stoneskin": ("swordsman", 9),
    "stunning_strike": ("swordsman", 2),
    # knight
    "piercing_thrust": ("swordsman", 27),
    "whirlwind_sweep": ("swordsman", 42),
    "iron_resolve": ("swordsman", 31),
    "spiral_lance": ("swordsman", 37),
    # crusader
    "radiant_cross": ("paladin", 1),
    "shield_rush": ("paladin", 24),
    "mending_light": ("paladin", 3),
    "aegis_of_light": ("paladin", 16),
    # mage
    "ember_bolt": ("fx_magic", 4),
    "frostburst": ("fx_explosion", 3),
    "mana_ward": ("paladin", 25),
    "ice_shard": ("fx_magic", 2),
    "spirit_volley": ("fx_magic", 9),
    "clear_mind": ("paladin", 18),
    "arcane_mastery": ("paladin", 47),
    "inner_calm": ("paladin", 17),
    # wizard
    "thunderclap": ("fx_explosion", 9),
    "blizzard": ("fx_explosion", 11),
    "mana_shell": ("paladin", 29),
    "starfall": ("paladin", 13),
    # sage
    "stone_spires": ("paladin", 20),
    "mana_echo": ("paladin", 46),
    "wellspring": ("paladin", 12),
    # classes
    "class_swordsman": ("swordsman", 4),
    "class_mage": ("fx_magic", 10),
    "class_knight": ("swordsman", 31),
    "class_crusader": ("paladin", 1),
    "class_wizard": ("fx_explosion", 9),
    "class_sage": ("paladin", 44),
    # items
    "red_potion": ("potions", 1),
    "leather_cap": ("basic", 34),
    "iron_helm": ("loot40", 40),
    "pointed_hat": ("basic", 32),
    "starry_hat": ("basic", 33),
    "tattered_tunic": ("basic", 37),
    "leather_vest": ("basic", 31),
    "steel_armor": ("basic", 40),
    "apprentice_robe": ("basic", 36),
    "silk_robe": ("basic", 39),
    "archmage_robe": ("basic", 35),
    "knight_plate": ("paladin", 31),
    "crusader_plate": ("paladin", 32),
    "wizard_robe": ("basic", 36),
    "sage_robe": ("basic", 33),
    "wooden_sword": ("basic", 46),
    "iron_sword": ("basic", 57),
    "steel_sword": ("loot40", 23),
    "wooden_staff": ("basic", 60),
    "oak_staff": ("basic", 52),
    "crystal_staff": ("basic", 41),
    "rabbit_foot": ("rpg_loot", 47),
    "fox_tail": ("rpg_loot", 3),
    "boar_hide": ("rpg_loot", 26),
    "wolf_pelt": ("rpg_loot", 2),
    "stag_antler": ("rpg_loot", 45),
    "dire_tusk": ("rpg_loot", 21),
    # interface
    "ui_sit": ("basic_skill", 15),
    "ui_chat": ("basic", 12),
    "ui_map": ("basic", 45),
    "ui_bag": ("basic", 48),
    "ui_quests": ("loot40", 29),
    "ui_character": ("basic", 40),
    "ui_zeny": ("loot40", 1),
    "ui_sound": ("basic", 9),
    "ui_sun": ("basic", 3),
    "ui_moon": ("basic", 2),
    "ui_home": ("basic", 61),
    "ui_admin": ("basic", 54),
    # cloaks, necklaces and pants (several tinted below)
    "travelers_cloak": ("basic", 35),
    "wool_cloak": ("basic", 35),
    "shadow_cloak": ("basic", 35),
    "royal_cloak": ("basic", 39),
    "leather_cord": ("loot40", 26),
    "silver_necklace": ("loot40", 26),
    "wolf_fang_necklace": ("rpg_loot", 34),
    "amulet_of_aurelia": ("loot40", 26),
    "linen_pants": ("basic", 38),
    "leather_pants": ("basic", 38),
    "scaled_pants": ("basic", 38),
}

# icons tinted with a colour cast (multiplied), so one source icon can serve several items
TINTS = {
    "leather_pants": (200, 170, 130),
    "scaled_pants": (160, 180, 230),
    "wool_cloak": (150, 170, 255),
    "shadow_cloak": (110, 110, 140),
    "royal_cloak": (255, 120, 120),
    "silver_necklace": (200, 210, 255),
    "wolf_fang_necklace": (240, 230, 200),
    "amulet_of_aurelia": (255, 230, 150),
}


# ---- procedural icons for what the packs lack: rings, belts and boots ----
def add_outline(img):
    a = np.array(img)
    filled = a[:, :, 3] > 40
    border = np.zeros_like(filled)
    border[1:, :] |= filled[:-1, :]
    border[:-1, :] |= filled[1:, :]
    border[:, 1:] |= filled[:, :-1]
    border[:, :-1] |= filled[:, 1:]
    a[border & ~filled] = OUTLINE
    return Image.fromarray(a).copy()  # a copy, so the result can be drawn on


def ring(gem, band=((150, 120, 60), (214, 178, 90), (250, 230, 170))):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([7, 10, 25, 28], outline=band[0] + (255,), width=4)
    d.ellipse([8, 11, 24, 27], outline=band[1] + (255,), width=2)
    d.arc([8, 11, 24, 27], 200, 320, fill=band[2] + (255,), width=2)
    if gem:
        d.polygon([(16, 3), (22, 8), (16, 13), (10, 8)], fill=gem[0] + (255,))
        d.polygon([(16, 5), (19, 8), (16, 11), (13, 8)], fill=gem[1] + (255,))
        d.point((15, 6), fill=(255, 255, 255, 255))
    return add_outline(im)


def belt(buckle=(214, 178, 90), leather=((70, 42, 24), (118, 76, 40))):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([3, 12, 29, 20], radius=3, fill=leather[0] + (255,))
    d.rectangle([4, 13, 28, 15], fill=leather[1] + (255,))
    for x in range(7, 27, 5):
        d.point((x, 18), fill=leather[1] + (255,))
    d.rectangle([12, 10, 19, 22], outline=buckle + (255,), width=2)
    d.rectangle([15, 13, 16, 19], fill=buckle + (255,))
    return add_outline(im)


def boots(leather=((70, 42, 24), (118, 76, 40), (160, 110, 60)), sole=(40, 30, 24)):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for dx in (0, 12):
        d.rectangle([5 + dx, 5, 12 + dx, 22], fill=leather[1] + (255,))
        d.rectangle([5 + dx, 18, 17 + dx, 26], fill=leather[1] + (255,))
        d.rectangle([5 + dx, 24, 17 + dx, 27], fill=sole + (255,))
        d.line([(6 + dx, 6), (6 + dx, 20)], fill=leather[2] + (255,))
        d.line([(5 + dx, 12), (12 + dx, 12)], fill=leather[0] + (255,))
    return add_outline(im)


def tint(im, color):
    """Give an icon a colour cast (multiply); the outline stays."""
    a = np.array(im).astype(np.int32)
    opaque = a[:, :, 3] > 0
    is_outline = (a[:, :, 0] == OUTLINE[0]) & (a[:, :, 1] == OUTLINE[1]) & (a[:, :, 2] == OUTLINE[2])
    for i, k in enumerate(color):
        a[:, :, i] = np.where(opaque & ~is_outline, np.clip(a[:, :, i] * k / 255, 0, 255), a[:, :, i])
    return Image.fromarray(a.astype(np.uint8))


def custom_icons():
    """Procedural icons, appended to the atlas after the pack icons."""
    return {
        "copper_ring": ring(None, ((120, 70, 40), (190, 110, 60), (240, 180, 130))),
        "ring_of_might": ring(((140, 30, 40), (220, 70, 80))),
        "ring_of_wisdom": ring(((30, 60, 150), (80, 130, 230))),
        "ring_of_agility": ring(((30, 110, 50), (90, 200, 110))),
        "royal_signet": ring(((150, 40, 160), (220, 120, 240))),
        "leather_belt": belt((160, 160, 170)),
        "buckled_belt": belt(),
        "knights_belt": belt((200, 205, 220), ((40, 44, 60), (80, 86, 110))),
        "cloth_shoes": boots(((90, 90, 100), (150, 150, 160), (200, 200, 210)), (70, 70, 80)),
        "leather_boots": boots(),
        "iron_boots": boots(((50, 54, 70), (110, 116, 140), (170, 176, 200)), (40, 40, 50)),
    }


# ---- professions: tools, resources, food, potions, runes and the profession badges ----
# Pack icons where one fits (recoloured where needed), the rest drawn in the same style: 32 px cells with the drawing
# in the middle 18 px or so, a dark outline and three or four flat tones per material.
STONE = ((70, 71, 98), (105, 102, 130), (154, 151, 185), (197, 199, 221))  # the fortress rocks
METALS = {
    "copper": ((132, 56, 28), (214, 104, 40), (246, 160, 78), (255, 220, 160)),
    "iron": ((66, 74, 98), (112, 122, 150), (164, 174, 200), (222, 228, 240)),
    "silver": ((104, 120, 160), (184, 198, 228), (230, 238, 252), (255, 255, 255)),
    "gold": ((150, 90, 16), (232, 168, 32), (255, 216, 72), (255, 250, 196)),
    "steel": ((84, 100, 140), (150, 170, 210), (210, 222, 244), (255, 255, 255)),
}
# ore chunks: speck colours as in the ore veins of the world (build_sprites.py)
ORE_SPECKS = {
    "copper": METALS["copper"],
    "iron": ((66, 44, 46), (124, 74, 60), (170, 104, 76), (214, 168, 140)),
    "silver": ((72, 92, 140), (168, 192, 232), (222, 236, 255), (255, 255, 255)),
    "gold": METALS["gold"],
}
ARCANE = ((84, 40, 150), (150, 80, 220), (200, 140, 255), (245, 225, 255))
GEMS = {
    "ruby": ((110, 16, 40), (196, 36, 60), (240, 96, 110), (255, 200, 200)),
    "sapphire": ((24, 36, 120), (44, 84, 200), (100, 150, 245), (210, 230, 255)),
    "emerald": ((14, 84, 48), (30, 150, 80), (90, 210, 120), (210, 255, 220)),
    "topaz": ((150, 80, 10), (236, 150, 30), (255, 206, 80), (255, 245, 200)),
}
# log: (bark dark, bark mid, bark light, wood dark, wood mid, wood light)
LOGS = {
    "pine_log": ((96, 52, 36), (146, 84, 52), (184, 118, 72), (184, 120, 64), (226, 176, 112), (244, 214, 156)),
    "oak_log": ((66, 46, 34), (106, 74, 50), (146, 106, 70), (160, 104, 56), (204, 148, 88), (232, 192, 132)),
    "ash_log": ((86, 86, 84), (134, 132, 124), (180, 176, 162), (196, 172, 128), (232, 216, 180), (250, 242, 220)),
    "elder_log": ((44, 32, 54), (78, 58, 88), (114, 88, 122), (140, 56, 64), (192, 92, 92), (230, 150, 140)),
}
# rune glyphs: colour (dark glow, bright core) and the lines of the sign
RUNES = {
    "rune_of_sharpness": (
        ((220, 60, 60), (255, 210, 200)),
        (((16, 10), (16, 22)), ((13, 13), (16, 10), (19, 13)), ((13, 19), (19, 19))),
    ),
    "rune_of_warding": (
        ((40, 190, 150), (210, 255, 236)),
        (((16, 10), (21, 12), (20, 19), (16, 22), (12, 19), (11, 12), (16, 10)), ((16, 13), (16, 19))),
    ),
    "rune_of_flame": (
        ((240, 120, 30), (255, 232, 140)),
        (((16, 9), (20, 15), (19, 20), (16, 22), (13, 20), (12, 16), (14, 13), (15, 17), (16, 9)),),
    ),
    "rune_of_frost": (
        ((80, 170, 240), (232, 250, 255)),
        (
            ((16, 9), (16, 23)),
            ((11, 12), (21, 20)),
            ((21, 12), (11, 20)),
            ((14, 10), (16, 12), (18, 10)),
            ((14, 22), (16, 20), (18, 22)),
        ),
    ),
    "rune_of_storms": (
        ((230, 180, 20), (255, 250, 190)),
        (((18, 9), (13, 16), (19, 16), (14, 23)),),
    ),
    "rune_of_the_arcane": (
        ((150, 80, 230), (242, 214, 255)),
        (((12, 16), (16, 11), (20, 16), (16, 21), (12, 16)), ((16, 15), (16, 17))),
    ),
}
EMBER = ((110, 30, 30), (200, 64, 40), (240, 132, 64), (255, 222, 96))
HANDLE = ((94, 67, 60), (173, 159, 122), (221, 206, 159))  # the wooden handles of the pack tools


def blank():
    return Image.new("RGBA", (32, 32), (0, 0, 0, 0))


def is_outline(rgb):
    rgb = [int(c) for c in rgb]
    return max(rgb) < 70 and sum(rgb) < 150


def recolor(im, ramp, keep=lambda rgb: False):
    """Map every coloured pixel (not the outline, not `keep`) onto `ramp` by brightness."""
    a = np.array(im)
    mask = (a[:, :, 3] > 0) & ~np.array(
        [[is_outline(tuple(p[:3])) or keep(tuple(int(c) for c in p[:3])) for p in row] for row in a]
    )
    lum = (a[:, :, :3].astype(np.int32) * (30, 59, 11)).sum(axis=2)
    levels = sorted(set(lum[mask].tolist()))
    for y, x in zip(*np.nonzero(mask), strict=True):
        i = levels.index(lum[y, x]) * len(ramp) // len(levels)
        a[y, x, :3] = ramp[i]
    return Image.fromarray(a).copy()


def hue_shift(im, shift, saturation=1.0, value=1.0, hues=(0.0, 1.0)):
    """Rotate the hue of every pixel except the outline (and except hues outside `hues`); scale saturation and value."""
    a = np.array(im)
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            r, g, b, alpha = a[y, x]
            if alpha == 0 or is_outline((r, g, b)):
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if not hues[0] <= h <= hues[1]:
                continue
            rgb = colorsys.hsv_to_rgb((h + shift) % 1, min(1, s * saturation), min(1, v * value))
            a[y, x, :3] = [round(c * 255) for c in rgb]
    return Image.fromarray(a).copy()


def edge(im, color):
    """Repaint the outermost pixels of a drawing (for pale recolours whose coloured edge got lost)."""
    a = np.array(im)
    filled = a[:, :, 3] > 0
    inner = filled.copy()
    inner[1:, :] &= filled[:-1, :]
    inner[:-1, :] &= filled[1:, :]
    inner[:, 1:] &= filled[:, :-1]
    inner[:, :-1] &= filled[:, 1:]
    a[filled & ~inner, :3] = color
    return Image.fromarray(a).copy()


def polygon(d, points, color):
    d.polygon(points, fill=color + (255,))


def hatchet(head, handle=HANDLE):
    im = blank()
    d = ImageDraw.Draw(im)
    d.line([(8, 25), (20, 10)], fill=handle[1] + (255,), width=2)
    d.line([(8, 24), (19, 10)], fill=handle[2] + (255,), width=1)
    d.line([(7, 25), (9, 25)], fill=handle[0] + (255,))
    polygon(d, [(16, 9), (21, 6), (25, 9), (26, 15), (23, 17), (21, 13), (18, 13)], head[1])
    polygon(d, [(21, 7), (24, 9), (25, 14), (23, 15), (22, 11)], head[2])
    d.line([(25, 9), (26, 15)], fill=head[3] + (255,))
    polygon(d, [(16, 9), (18, 13), (20, 12), (19, 9)], head[0])
    return add_outline(im)


def fishing_rod(rod, grip, lure):
    im = blank()
    d = ImageDraw.Draw(im)
    d.line([(7, 26), (25, 6)], fill=rod[0] + (255,), width=1)
    d.line([(7, 25), (12, 20)], fill=rod[1] + (255,), width=1)
    d.line([(13, 19), (24, 7)], fill=rod[1] + (255,), width=1)
    d.line([(6, 26), (10, 22)], fill=grip + (255,), width=2)
    d.rectangle([11, 21, 12, 22], fill=(150, 150, 170, 255))  # reel
    im = add_outline(im)
    d = ImageDraw.Draw(im)
    d.line([(25, 6), (26, 7), (26, 19)], fill=(226, 234, 244, 255))  # the line, without an outline
    lure_im = blank()
    ImageDraw.Draw(lure_im).rectangle([25, 20, 27, 22], fill=lure[0] + (255,))
    ImageDraw.Draw(lure_im).line([(25, 20), (27, 20)], fill=lure[1] + (255,))
    im.alpha_composite(add_outline(lure_im))
    return im


def ore_chunk(specks):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(8, 18), (10, 12), (15, 8), (21, 9), (25, 13), (25, 19), (21, 24), (12, 24)], STONE[1])
    polygon(d, [(10, 12), (15, 8), (21, 9), (22, 13), (16, 15), (10, 16)], STONE[2])
    polygon(d, [(22, 13), (25, 13), (25, 19), (21, 24), (17, 24), (19, 19)], STONE[0])
    d.line([(15, 9), (19, 9)], fill=STONE[3] + (255,))
    px = im.load()
    for x, y, big in ((12, 12, True), (18, 11, False), (11, 18, False), (16, 18, True), (22, 16, False)):
        cells = [(0, 0, 3), (1, 0, 2), (0, 1, 2), (1, 1, 1)] + ([(2, 1, 1), (1, 2, 0), (2, 2, 0)] if big else [])
        for dx, dy, k in cells:
            px[x + dx, y + dy] = specks[k] + (255,)
        px[x + 2 + big, y + 1 + big] = STONE[0] + (255,)
    return add_outline(im)


def crystal(d, cx, base, height, width, ramp):
    for dy in range(height):
        half = min(width, height - dy)
        for dx in range(-half + 1, half):
            k = 2 if dx < 0 else 1 if dx == 0 else 0
            d.point((cx + dx, base - dy), fill=ramp[k] + (255,))
    d.point((cx, base - height + 1), fill=ramp[3] + (255,))
    d.line([(cx - 1, base - 1), (cx - 1, base - height + 3)], fill=ramp[3] + (255,))


def crystal_cluster(ramp):
    im = blank()
    d = ImageDraw.Draw(im)
    crystal(d, 11, 24, 9, 3, ramp)
    crystal(d, 21, 24, 10, 3, ramp)
    crystal(d, 16, 25, 16, 4, ramp)
    im = add_outline(im)
    im.putpixel((24, 9), ramp[3] + (255,))
    im.putpixel((8, 12), ramp[3] + (255,))
    return im


def ingot(ramp):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(6, 17), (10, 12), (26, 12), (26, 17), (22, 22), (6, 22)], ramp[1])
    polygon(d, [(10, 12), (26, 12), (22, 17), (6, 17)], ramp[2])
    polygon(d, [(22, 17), (26, 12), (26, 17), (22, 22)], ramp[0])
    d.line([(10, 13), (23, 13)], fill=ramp[3] + (255,))
    d.line([(6, 17), (21, 17)], fill=ramp[3] + (255,))
    d.point((8, 19), fill=ramp[2] + (255,))
    return add_outline(im)


def gem(ramp):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(11, 9), (21, 9), (25, 14), (16, 25), (7, 14)], ramp[1])
    polygon(d, [(7, 14), (25, 14), (16, 25)], ramp[1])
    polygon(d, [(16, 14), (25, 14), (16, 25)], ramp[0])
    polygon(d, [(13, 9), (19, 9), (21, 13), (11, 13)], ramp[2])
    d.line([(7, 14), (25, 14)], fill=ramp[2] + (255,))
    d.line([(11, 15), (16, 23)], fill=ramp[2] + (255,))
    d.point((13, 10), fill=ramp[3] + (255,))
    d.point((14, 10), fill=ramp[3] + (255,))
    d.point((13, 11), fill=ramp[3] + (255,))
    return add_outline(im)


def log(colors):
    bark_dark, bark, bark_light, wood_dark, wood, wood_light = colors
    im = blank()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([5, 11, 23, 22], radius=3, fill=bark + (255,))
    d.line([(7, 12), (21, 12)], fill=bark_light + (255,))
    d.line([(8, 15), (14, 15)], fill=bark_dark + (255,))
    d.line([(12, 18), (20, 18)], fill=bark_dark + (255,))
    d.line([(6, 21), (21, 21)], fill=bark_dark + (255,))
    d.ellipse([20, 11, 27, 22], fill=wood_light + (255,))
    d.ellipse([21, 13, 26, 20], fill=wood + (255,))
    d.rectangle([23, 16, 24, 17], fill=wood_dark + (255,))
    d.arc([20, 11, 27, 22], 20, 160, fill=wood_dark + (255,))
    return add_outline(im)


def rune(colors, glyph):
    glow, core = colors
    im = blank()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 6, 24, 26], radius=3, fill=(52, 52, 76, 255))  # a dark slate, so the sign glows
    d.line([(10, 6), (22, 6)], fill=STONE[1] + (255,))
    d.line([(8, 8), (8, 24)], fill=STONE[1] + (255,))
    d.line([(10, 26), (22, 26)], fill=(36, 36, 56, 255))
    d.line([(24, 8), (24, 24)], fill=(36, 36, 56, 255))
    sign = Image.new("L", (32, 32), 0)
    sd = ImageDraw.Draw(sign)
    for line in glyph:
        sd.line(line, fill=255)
    core_mask = np.array(sign) > 0
    halo = core_mask.copy()  # the glow: one pixel around the sign, eight directions
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            halo |= np.roll(np.roll(core_mask, dy, axis=0), dx, axis=1)
    a = np.array(im)
    a[halo & ~core_mask, :3] = glow
    a[core_mask, :3] = core
    return add_outline(Image.fromarray(a))


def plated(food, plate, garnish=()):
    """A dish: the food on the white plate of the basic pack."""
    im = blank()
    im.alpha_composite(plate)
    im.alpha_composite(food, (0, -1))
    for x, y, color in garnish:
        im.putpixel((x, y), color + (255,))
    return im


def moss(ramp):
    """A low mossy clump with glowing specks."""
    im = blank()
    d = ImageDraw.Draw(im)
    d.ellipse([6, 13, 26, 25], fill=ramp[1] + (255,))
    for x, y, r in ((10, 14, 3), (15, 12, 4), (21, 14, 3)):
        d.ellipse([x - r, y - r, x + r, y + r], fill=ramp[1] + (255,))
        d.ellipse([x - r + 1, y - r + 1, x, y], fill=ramp[2] + (255,))
    d.chord([6, 13, 26, 25], 20, 160, fill=ramp[0] + (255,))
    px = im.load()
    for x, y in ((8, 17), (11, 16), (13, 18), (16, 16), (18, 19), (21, 17), (23, 18), (10, 20), (20, 21)):
        px[x, y] = ramp[2] + (255,)  # tufts
        px[x + 1, y + 1] = ramp[0] + (255,)
    for x, y in ((9, 15), (14, 11), (19, 17), (22, 13), (12, 19), (17, 14), (15, 21)):
        px[x, y] = ramp[3] + (255,)
    im = add_outline(im)
    for x, y in ((12, 6), (19, 4), (23, 8)):
        im.putpixel((x, y), ramp[3] + (255,))
    return im


def profession_badge(item, dark, light):
    """A framed skill-style icon: sun rays in the profession's colour behind a strong item icon."""
    im = Image.new("RGBA", (32, 32), OUTLINE)
    a = np.array(im)
    for y in range(1, 31):
        for x in range(1, 31):
            if x in (1, 30) or y in (1, 30):
                a[y, x, :3] = (214, 178, 90) if x + y < 32 else (150, 110, 50)
                continue
            dx, dy = x - 15.5, y - 15.5
            ray = int((np.arctan2(dy, dx) + np.pi) / (2 * np.pi) * 16) % 2
            ring = (dx * dx + dy * dy) ** 0.5
            color = light if ray and ring < 13 else dark
            if ring < 7:
                color = light
            a[y, x, :3] = color
    im = Image.fromarray(a).copy()
    im.alpha_composite(item)
    return im


def profession_icons(sources):
    """The new icons for the professions, appended after all others (existing positions stay)."""

    def pack(name, number):
        return Image.open(sources[name](number)).convert("RGBA")

    def wooden(rgb):  # keep the wooden handle, recolour the bluish metal
        return rgb[2] <= rgb[0] + 10

    def recolored_fish(shift, saturation, value):  # body and fins only, the red mouth stays
        return hue_shift(fish, shift, saturation, value, hues=(0.3, 0.75))

    def cooked(shift, saturation, value):
        return plated(recolored_fish(shift, saturation, value), plate)

    pickaxe = pack("basic", 53)
    fish = pack("basic", 98)
    plate = pack("basic", 64)
    flower = pack("basic", 79)
    icons = {
        # tools
        "copper_pickaxe": recolor(pickaxe, METALS["copper"][:3], keep=wooden),
        "iron_pickaxe": pickaxe,
        "hatchet": hatchet(METALS["iron"]),
        "steel_hatchet": hatchet(METALS["steel"], ((40, 30, 40), (90, 64, 70), (140, 104, 100))),
        "fishing_rod": fishing_rod(((110, 70, 40), (196, 150, 90)), (94, 67, 60), ((230, 50, 50), (255, 255, 255))),
        "fly_rod": fishing_rod(((40, 60, 50), (100, 130, 100)), (220, 190, 130), ((250, 200, 40), (60, 170, 90))),
        "herb_knife": pack("basic", 57),
        "silver_sickle": recolor(pack("basic", 58), METALS["silver"], keep=wooden),
        # ores, bars and gems
        **{f"{metal}_ore": ore_chunk(specks) for metal, specks in ORE_SPECKS.items()},
        "arcane_crystal": crystal_cluster(ARCANE),
        **{f"{metal}_bar": ingot(METALS[metal]) for metal in ("copper", "iron", "silver", "gold")},
        **{name: gem(ramp) for name, ramp in GEMS.items()},
        # logs
        **{name: log(colors) for name, colors in LOGS.items()},
        # herbs
        "sunleaf": hue_shift(pack("basic", 81), -0.27, 1.1, 1.15),
        "wolfsbane": hue_shift(flower, -0.2, 1.0, 0.85),
        "moonbloom": edge(hue_shift(flower, -0.4, 0.45, 1.15), (56, 78, 140)),
        "embermoss": moss(EMBER),
        "starpetal": edge(hue_shift(flower, 0.13, 0.35, 1.2), (140, 100, 40)),
        # fish and meat
        "minnow": recolored_fish(0.1, 0.25, 1.05),
        "trout": recolored_fish(-0.42, 0.7, 1.0),
        "pike": recolored_fish(-0.17, 0.9, 0.85),
        "golden_carp": recolored_fish(-0.33, 1.2, 1.25),
        "raw_meat": pack("basic", 72),
        # food
        "cooked_minnow": cooked(-0.37, 0.6, 1.05),
        "cooked_trout": cooked(-0.47, 0.55, 0.85),
        "cooked_pike": cooked(-0.31, 0.55, 0.65),
        "golden_feast": plated(
            recolored_fish(-0.33, 1.2, 1.2),
            plate,
            ((9, 20, (90, 170, 60)), (10, 21, (60, 130, 50)), (22, 21, (90, 170, 60))),
        ),
        "roast_meat": pack("basic", 70),
        # potions
        "mana_potion": pack("potions", 10),
        "grand_potion": pack("potions", 23),
        "elixir_of_might": pack("potions", 35),
        "elixir_of_wisdom": pack("potions", 15),
        "elixir_of_swiftness": pack("potions", 7),
        # enchanting
        "arcane_dust": pack("basic", 95),
        **{name: rune(colors, glyph) for name, (colors, glyph) in RUNES.items()},
    }
    icons.update(
        {
            "prof_mining": profession_badge(icons["copper_pickaxe"], (70, 46, 34), (120, 84, 56)),
            "prof_woodcutting": profession_badge(icons["hatchet"], (40, 76, 40), (70, 120, 56)),
            "prof_herbalism": profession_badge(icons["sunleaf"], (56, 90, 30), (110, 150, 50)),
            "prof_fishing": profession_badge(icons["trout"], (30, 60, 110), (60, 110, 170)),
            "prof_smithing": profession_badge(pack("basic", 54), (110, 40, 24), (190, 90, 40)),
            "prof_alchemy": profession_badge(pack("basic", 51), (60, 30, 90), (110, 60, 150)),
            "prof_cooking": profession_badge(pack("basic", 70), (120, 70, 20), (200, 130, 40)),
            "prof_enchanting": profession_badge(icons["rune_of_the_arcane"], (40, 30, 80), (80, 60, 150)),
            # enchantment badges on items
            "ench_flame": pack("basic", 14),
            "ench_frost": pack("basic", 29),
            "ench_storms": pack("basic", 8),
            "ench_arcane": hue_shift(pack("basic", 16), 0.15, 1.0, 1.0),
        }
    )
    return icons


def main():
    icon_dir = pathlib.Path(sys.argv[1])
    fx_dir = pathlib.Path(sys.argv[2])
    out_dir = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "runeveld/sprites")
    src_dir = out_dir.parent / "src"

    sources = pack_sources(icon_dir, fx_dir)
    custom = custom_icons()
    custom.update(profession_icons(sources))  # after the older custom icons, so no existing position changes
    choices = dict(CHOICES)
    for name in custom:
        choices[name] = ("custom", 0)

    names = list(choices)
    rows = (len(names) + COLUMNS - 1) // COLUMNS
    atlas = Image.new("RGBA", (COLUMNS * 32, rows * 32), (0, 0, 0, 0))
    index = {}
    for i, name in enumerate(names):
        pack, number = choices[name]
        im = custom[name] if pack == "custom" else Image.open(sources[pack](number)).convert("RGBA")
        if name in TINTS:
            im = tint(im, TINTS[name])
        if im.size != (32, 32):
            im = im.resize((32, 32), Image.NEAREST)
        atlas.paste(im, ((i % COLUMNS) * 32, (i // COLUMNS) * 32))
        index[name] = [i % COLUMNS, i // COLUMNS]
    atlas.save(out_dir / "icons.png")
    (src_dir / "icon-index.js").write_text(
        "/* Generated by runeveld/tools/build_icons.py; do not edit by hand. */\n"
        f"export const COLUMNS = {COLUMNS};\n"
        f"export const ICONS = {json.dumps(index, separators=(',', ':'))};\n"
    )
    print("icons:", len(index), "atlas", atlas.size)


if __name__ == "__main__":
    main()
