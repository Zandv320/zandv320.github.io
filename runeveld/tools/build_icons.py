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
import math
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


# ---- the items of the later lands (Northroad, Saltmere, the crypt, the Ember Isles) ----
def heater_shield(face, rim, cross):
    """A heater shield with a cross: face (dark, light), rim colour, cross colour."""
    im = blank()
    d = ImageDraw.Draw(im)
    outline_points = [(7, 6), (25, 6), (25, 16), (16, 27), (7, 16)]
    d.polygon(outline_points, fill=rim + (255,))
    d.polygon([(9, 8), (23, 8), (23, 16), (16, 24), (9, 16)], fill=face[0] + (255,))
    d.polygon([(9, 8), (16, 8), (16, 24), (9, 16)], fill=face[1] + (255,))  # the lit half
    d.rectangle([15, 9, 17, 22], fill=cross + (255,))
    d.rectangle([11, 12, 21, 14], fill=cross + (255,))
    d.point((10, 9), fill=(255, 255, 255, 255))
    return add_outline(im)


# ---- the weapons, helmets, shields and armour of other shapes (tools/build_sprites.py), drawn like the hero wears them
STEEL = ((90, 96, 118), (150, 160, 186), (228, 234, 246))
DARK_IRON = ((40, 42, 52), (70, 74, 90), (120, 126, 146))
GOLD = ((150, 120, 60), (214, 178, 90), (250, 230, 170))
WOOD = ((70, 38, 26), (120, 76, 48), (164, 114, 72))
LEATHER = ((60, 34, 20), (98, 60, 34), (140, 92, 54))


def bar(d, start, end, width, color):
    """A straight band from start to end (a haft, a blade)."""
    d.line([start, end], fill=color + (255,), width=width)


def haft(d, start, end, colors=WOOD):
    """A wooden shaft with its lit side, from the butt to the head."""
    bar(d, start, end, 3, colors[0])
    bar(d, (start[0], start[1] - 1), (end[0], end[1] - 1), 1, colors[2])
    bar(d, start, end, 1, colors[1])


def along(origin, direction, t, s):
    """The point t pixels along `direction` from origin and s pixels across it."""
    (ox, oy), (ux, uy) = origin, direction
    return (ox + ux * t - uy * s, oy + uy * t + ux * s)


DIAGONAL = (0.7071, -0.7071)  # from the bottom left to the top right


def battle_axe():
    im = blank()
    d = ImageDraw.Draw(im)
    haft(d, (6, 27), (22, 9))
    polygon(d, [(17, 10), (20, 4), (27, 4), (29, 11), (24, 16), (20, 13)], STEEL[1])
    polygon(d, [(22, 5), (27, 5), (28, 10), (25, 13), (23, 10)], STEEL[2])
    polygon(d, [(17, 10), (20, 13), (21, 11), (19, 8)], STEEL[0])
    d.line([(27, 5), (29, 11)], fill=(255, 255, 255, 255))
    return add_outline(im)


def war_hammer():
    im = blank()
    d = ImageDraw.Draw(im)
    haft(d, (6, 27), (19, 12))
    corners = [along((21, 10), DIAGONAL, t, s) for t, s in ((-4, -7), (4, -7), (4, 7), (-4, 7))]
    polygon(d, corners, STEEL[0])
    polygon(d, [along((21, 10), DIAGONAL, t, s) for t, s in ((-3, -6), (3, -6), (3, 6), (-3, 6))], STEEL[1])
    polygon(d, [along((21, 10), DIAGONAL, t, s) for t, s in ((1, -6), (3, -6), (3, 6), (1, 6))], STEEL[2])
    polygon(d, [along((21, 10), DIAGONAL, t, s) for t, s in ((-3, -1), (3, -1), (3, 1), (-3, 1))], GOLD[1])
    return add_outline(im)


def spear():
    im = blank()
    d = ImageDraw.Draw(im)
    haft(d, (3, 29), (21, 11))
    polygon(d, [along((21, 11), DIAGONAL, t, s) for t, s in ((-1, -2), (1, -2), (1, 2), (-1, 2))], GOLD[1])
    head = [along((21, 11), DIAGONAL, t, s) for t, s in ((1, 0), (4, -3), (11, 0), (4, 3))]
    polygon(d, head, STEEL[1])
    polygon(d, [along((21, 11), DIAGONAL, t, s) for t, s in ((2, 0), (4, -2), (10, 0))], STEEL[2])
    return add_outline(im)


def blade(curve=0.0, length=19, grip=GOLD, guard=7):
    """A long blade from the hilt (bottom left) to the point; `curve` bends it like a scimitar."""
    im = blank()
    d = ImageDraw.Draw(im)
    hilt = (8, 24)
    bar(d, along(hilt, DIAGONAL, -6, 0), along(hilt, DIAGONAL, -1, 0), 3, LEATHER[1])
    d.point(along(hilt, DIAGONAL, -6, 0), fill=grip[1] + (255,))
    for t in range(1, length + 1):
        bend = curve * t * t
        width = 2.2 if t < length - 2 else 1.2 if t < length else 0.5
        polygon(
            d,
            [
                along(hilt, DIAGONAL, t, bend - width),
                along(hilt, DIAGONAL, t + 1, bend - width),
                along(hilt, DIAGONAL, t + 1, bend + width),
                along(hilt, DIAGONAL, t, bend + width),
            ],
            STEEL[1],
        )
        d.point(along(hilt, DIAGONAL, t, bend - 1), fill=STEEL[2] + (255,))
    polygon(
        d,
        [
            along(hilt, DIAGONAL, -1, -guard),
            along(hilt, DIAGONAL, 1, -guard),
            along(hilt, DIAGONAL, 1, guard),
            along(hilt, DIAGONAL, -1, guard),
        ],
        grip[1],
    )
    d.point(along(hilt, DIAGONAL, 0, 0), fill=grip[2] + (255,))
    return add_outline(im)


def staff_icon(head, colors):
    """A staff with its head (staff_head in build_sprites.py): 'rune', 'crescent' or 'crystal'.
    colors: (wood ramp, (outline, core, light))."""
    wood, (rim, core, light) = colors
    im = blank()
    d = ImageDraw.Draw(im)
    haft(d, (5, 29), (21, 12), wood)
    if head == "rune":  # a square stone with a glowing cut
        d.rectangle([18, 3, 28, 13], fill=rim + (255,))
        d.rectangle([19, 4, 27, 12], fill=(52, 54, 76, 255))
        d.line([(23, 5), (23, 11)], fill=core + (255,), width=2)
        d.line([(20, 6), (22, 8)], fill=core + (255,))
        d.line([(24, 9), (26, 10)], fill=core + (255,))
        d.point((23, 7), fill=light + (255,))
    elif head == "crescent":  # a moon opening upwards
        d.ellipse([16, 2, 30, 16], fill=rim + (255,))
        d.ellipse([17, 3, 29, 15], fill=core + (255,))
        d.ellipse([16, -3, 30, 10], fill=(0, 0, 0, 0))
        d.point((18, 10), fill=light + (255,))
        d.point((28, 10), fill=light + (255,))
    else:  # a tall shard
        polygon(d, [(23, 1), (27, 6), (26, 14), (23, 17), (20, 14), (19, 6)], rim)
        polygon(d, [(23, 3), (25, 7), (24, 13), (23, 15), (21, 13), (21, 7)], core)
        d.line([(22, 6), (22, 11)], fill=light + (255,))
    return add_outline(im)


def horned_helm(horn=((150, 128, 96), (232, 222, 196))):
    """An open iron helm with two ram's horns curling out of its sides."""
    im = blank()
    d = ImageDraw.Draw(im)
    for side in (-1, 1):
        cx = 16 + side * 9
        d.line([(cx, 17), (cx + side * 4, 12), (cx + side * 5, 6), (cx + side * 3, 3)], fill=horn[0] + (255,), width=3)
        d.line([(cx + side * 1, 16), (cx + side * 4, 11), (cx + side * 4, 6)], fill=horn[1] + (255,), width=1)
    d.chord([7, 7, 25, 27], 180, 360, fill=STEEL[0] + (255,))
    d.chord([8, 8, 24, 26], 180, 360, fill=STEEL[1] + (255,))
    d.chord([9, 9, 16, 24], 180, 270, fill=STEEL[2] + (255,))
    d.rectangle([7, 17, 25, 20], fill=GOLD[1] + (255,))
    d.rectangle([15, 9, 17, 26], fill=STEEL[0] + (255,))  # the ridge and the nose guard
    d.rectangle([10, 21, 22, 25], fill=(30, 26, 36, 255))  # the open face
    d.rectangle([15, 20, 17, 26], fill=STEEL[1] + (255,))
    return add_outline(im)


def great_helm():
    im = blank()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 5, 24, 27], radius=6, fill=DARK_IRON[1] + (255,))
    d.rounded_rectangle([9, 6, 15, 26], radius=5, fill=DARK_IRON[2] + (255,))  # the lit half
    d.rectangle([9, 14, 23, 15], fill=(16, 16, 22, 255))  # the eye slit
    for y in (19, 22):
        for x in (18, 20, 22):
            d.point((x, y), fill=(16, 16, 22, 255))
    d.rectangle([15, 5, 17, 27], fill=GOLD[1] + (255,))
    d.rectangle([9, 14, 23, 15], fill=(16, 16, 22, 255))
    d.point((11, 8), fill=(255, 255, 255, 255))
    return add_outline(im)


def hood(cloth):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(16, 3), (24, 9), (27, 20), (29, 28), (3, 28), (5, 20), (8, 9)], cloth[0])
    polygon(d, [(16, 4), (22, 9), (24, 18), (16, 16)], cloth[2])
    polygon(d, [(16, 4), (10, 9), (8, 18), (16, 16)], cloth[1])
    d.ellipse([10, 11, 22, 25], fill=(20, 18, 24, 255))  # the dark face opening
    polygon(d, [(3, 28), (10, 22), (16, 26), (22, 22), (29, 28)], cloth[1])
    return add_outline(im)


def circlet(gem):
    im = blank()
    d = ImageDraw.Draw(im)
    d.ellipse([3, 10, 29, 24], outline=GOLD[0] + (255,), width=3)
    d.arc([4, 11, 28, 23], 10, 170, fill=GOLD[2] + (255,), width=2)
    d.arc([4, 11, 28, 23], 190, 350, fill=GOLD[1] + (255,), width=1)
    polygon(d, [(16, 15), (20, 20), (16, 25), (12, 20)], gem[0])
    polygon(d, [(16, 17), (18, 20), (16, 23), (14, 20)], gem[1])
    d.point((15, 18), fill=(255, 255, 255, 255))
    return add_outline(im)


def buckler(face, rim, boss):
    im = blank()
    d = ImageDraw.Draw(im)
    d.ellipse([4, 4, 28, 28], fill=rim[0] + (255,))
    d.ellipse([6, 6, 26, 26], fill=face[0] + (255,))
    d.pieslice([6, 6, 26, 26], 150, 300, fill=face[1] + (255,))  # the lit side
    for a in range(0, 360, 45):  # the rivets round the rim
        d.point((16 + 8 * math.cos(math.radians(a)), 16 + 8 * math.sin(math.radians(a))), fill=rim[1] + (255,))
    d.ellipse([12, 12, 20, 20], fill=boss[0] + (255,))
    d.ellipse([13, 13, 19, 19], fill=boss[1] + (255,))
    d.point((14, 14), fill=(255, 255, 255, 255))
    return add_outline(im)


def kite_shield(face, rim, sign):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(7, 3), (25, 3), (26, 12), (16, 30), (6, 12)], rim)
    polygon(d, [(9, 5), (23, 5), (24, 12), (16, 27), (8, 12)], face[0])
    polygon(d, [(9, 5), (16, 5), (16, 27), (8, 12)], face[1])
    polygon(d, [(16, 8), (21, 13), (16, 18), (11, 13)], sign)  # a white diamond
    d.point((10, 6), fill=(255, 255, 255, 255))
    return add_outline(im)


def tower_shield(face, rim, sign):
    im = blank()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([7, 2, 25, 30], radius=3, fill=rim + (255,))
    d.rectangle([9, 4, 23, 28], fill=face[0] + (255,))
    d.rectangle([9, 4, 15, 28], fill=face[1] + (255,))
    for y in (6, 26):  # the iron bands
        d.line([(9, y), (23, y)], fill=rim + (255,))
    d.rectangle([15, 9, 17, 23], fill=sign + (255,))
    d.rectangle([11, 12, 21, 14], fill=sign + (255,))
    d.point((10, 5), fill=(255, 255, 255, 255))
    return add_outline(im)


TUNIC = [(9, 4), (13, 6), (19, 6), (23, 4), (29, 9), (27, 15), (24, 14), (24, 28), (8, 28), (8, 14), (5, 15), (3, 9)]


def tunic(ramp, pattern=None, strap=None):
    """A jerkin with sleeves: ramp (dark, mid, light); pattern 'mail' for rings; strap: (leather, buckle)."""
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, TUNIC, ramp[0])
    polygon(d, [(9, 5), (13, 7), (16, 7), (16, 27), (9, 27), (9, 13), (5, 14), (4, 9)], ramp[1])
    polygon(d, [(16, 7), (19, 7), (23, 5), (28, 9), (26, 14), (23, 13), (23, 27), (16, 27)], ramp[1])
    polygon(d, [(13, 6), (16, 9), (19, 6)], (24, 22, 30))  # the neck
    if pattern == "mail":
        for y in range(8, 28, 2):
            for x in range(4 + y % 4 // 2, 29, 2):
                if im.getpixel((x, y))[3]:
                    d.point((x, y), fill=ramp[2] + (255,))
    else:
        d.line([(10, 8), (10, 26)], fill=ramp[2] + (255,))
    if strap:
        leather, buckle = strap
        d.line([(9, 6), (23, 27)], fill=leather + (255,), width=3)
        d.rectangle([14, 14, 18, 18], outline=buckle + (255,))
    d.line([(8, 22), (24, 22)], fill=ramp[0] + (255,), width=2)  # the belt line
    return add_outline(im)


def plate(ramp, trim):
    """A breastplate with round pauldrons and a gilded trim."""
    im = tunic(ramp)
    d = ImageDraw.Draw(im)
    for box in ([2, 4, 12, 13], [20, 4, 30, 13]):
        d.ellipse(box, fill=trim[0] + (255,))
        d.ellipse([box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 2], fill=ramp[2] + (255,))
    d.line([(12, 10), (16, 14), (20, 10)], fill=trim[1] + (255,), width=2)
    d.line([(16, 14), (16, 21)], fill=trim[1] + (255,))
    d.line([(8, 22), (24, 22)], fill=trim[1] + (255,), width=2)
    return add_outline(im)


def cloak(ramp, fur=None, torn=False):
    """A cloak seen from behind: ramp (dark, mid, light); fur: a fur collar (dark, mid, light); torn: a ragged hem."""
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(11, 4), (21, 4), (25, 10), (28, 29), (4, 29), (7, 10)], ramp[0])
    polygon(d, [(12, 5), (16, 5), (16, 28), (6, 28), (8, 11)], ramp[1])
    polygon(d, [(16, 5), (20, 5), (24, 11), (26, 28), (16, 28)], ramp[0])
    for x0, x1 in ((10, 8), (16, 16), (21, 23)):  # the folds
        d.line([(x0, 12), (x1, 27)], fill=ramp[2] + (255,))
    if torn:
        for x in range(4, 29):
            depth = (1, 4, 2, 5, 0, 3)[(x // 2) % 6]
            if depth:
                d.line([(x, 30 - depth), (x, 29)], fill=(0, 0, 0, 0))
    if fur:
        d.ellipse([5, 1, 27, 12], fill=fur[0] + (255,))
        d.ellipse([6, 1, 26, 10], fill=fur[1] + (255,))
        for x in range(8, 25, 3):
            d.point((x, 4 + x % 2), fill=fur[2] + (255,))
            d.point((x + 1, 8), fill=fur[0] + (255,))
    else:
        d.rectangle([10, 3, 22, 5], fill=ramp[2] + (255,))
    return add_outline(im)


ROBE = [(11, 3), (21, 3), (26, 8), (24, 12), (22, 11), (24, 29), (8, 29), (10, 11), (8, 12), (6, 8)]


def robe(ramp, trim=None, pauldrons=None, stars=None, leaves=None):
    """A long robe with sleeves: ramp (dark, mid, light); trim: the hem; pauldrons: steel on the shoulders; stars:
    colours sprinkled over it; leaves: a mantle of leaves on the shoulders."""
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, ROBE, ramp[0])
    polygon(d, [(12, 4), (16, 4), (16, 28), (9, 28), (11, 12), (9, 11), (7, 8)], ramp[1])
    polygon(d, [(13, 3), (16, 7), (19, 3)], (24, 22, 30))  # the neck
    d.line([(12, 8), (10, 27)], fill=ramp[2] + (255,))
    d.line([(16, 8), (16, 28)], fill=ramp[0] + (255,))
    if stars:
        for i, (x, y) in enumerate([(11, 14), (19, 10), (21, 19), (13, 22), (18, 25), (14, 17), (20, 14)]):
            d.point((x, y), fill=stars[i % len(stars)] + (255,))
    if trim:
        d.line([(8, 28), (24, 28)], fill=trim + (255,), width=2)
        d.line([(16, 7), (16, 27)], fill=trim + (255,))
    if pauldrons:
        for box in ([5, 3, 13, 10], [19, 3, 27, 10]):
            d.ellipse(box, fill=pauldrons[0] + (255,))
            d.ellipse([box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 2], fill=pauldrons[1] + (255,))
        d.line([(9, 17), (23, 17)], fill=(60, 40, 30, 255), width=2)  # the belt
        d.point((16, 17), fill=GOLD[1] + (255,))
    if leaves:
        for i, x in enumerate(range(6, 27, 2)):
            y = 4 + abs(16 - x) // 4
            d.ellipse([x - 2, y - 1, x + 1, y + 2], fill=leaves[i % len(leaves)] + (255,))
        d.line([(10, 9), (22, 24)], fill=leaves[0] + (255,), width=2)  # the sash
    return add_outline(im)


def wide_hat(felt, band, buckle):
    im = blank()
    d = ImageDraw.Draw(im)
    polygon(d, [(15, 18), (17, 10), (20, 5), (25, 2), (23, 6), (21, 11), (21, 18)], felt[1])
    polygon(d, [(11, 18), (14, 10), (17, 10), (15, 18)], felt[2])
    polygon(d, [(10, 19), (13, 10), (20, 5), (21, 18)], felt[1])
    polygon(d, [(13, 10), (17, 9), (15, 18), (11, 18)], felt[2])
    d.rectangle([11, 16, 21, 18], fill=band + (255,))
    d.rectangle([15, 16, 17, 18], fill=buckle + (255,))
    d.ellipse([2, 18, 30, 26], fill=felt[0] + (255,))
    d.ellipse([3, 18, 29, 24], fill=felt[1] + (255,))
    d.arc([3, 18, 29, 24], 160, 220, fill=felt[2] + (255,))
    return add_outline(im)


def antler_crown(band, antler, gem):
    im = blank()
    d = ImageDraw.Draw(im)
    for side in (-1, 1):
        cx = 16 + side * 8
        d.line([(cx, 20), (cx + side * 3, 12), (cx + side * 5, 4)], fill=antler[1] + (255,), width=2)
        d.line([(cx + side * 3, 12), (cx - side * 1, 6)], fill=antler[1] + (255,), width=2)
        d.line([(cx + side * 4, 8), (cx + side * 8, 7)], fill=antler[1] + (255,), width=1)
        d.point((cx + side * 5, 4), fill=antler[0] + (255,))
    d.ellipse([4, 17, 28, 27], outline=band[0] + (255,), width=3)
    d.arc([5, 18, 27, 26], 10, 170, fill=band[1] + (255,), width=2)
    for x in range(7, 26, 4):
        d.ellipse([x - 1, 23, x + 1, 26], fill=band[1] + (255,))
    polygon(d, [(16, 22), (18, 24), (16, 27), (14, 24)], gem)
    return add_outline(im)


def orb(ramp):
    im = blank()
    d = ImageDraw.Draw(im)
    d.ellipse([7, 4, 25, 22], fill=ramp[0] + (255,))
    d.ellipse([8, 5, 23, 20], fill=ramp[1] + (255,))
    d.ellipse([10, 7, 18, 15], fill=ramp[2] + (255,))
    d.ellipse([11, 8, 14, 11], fill=(255, 255, 255, 255))
    d.polygon([(10, 22), (22, 22), (24, 28), (8, 28)], fill=GOLD[0] + (255,))  # the stand
    d.polygon([(11, 22), (21, 22), (22, 26), (10, 26)], fill=GOLD[1] + (255,))
    return add_outline(im)


def tome(cover, gem):
    im = blank()
    d = ImageDraw.Draw(im)
    d.rectangle([7, 5, 26, 28], fill=(236, 228, 204, 255))  # the pages, behind
    d.rectangle([5, 3, 24, 26], fill=cover[0] + (255,))
    d.rectangle([7, 3, 24, 25], fill=cover[1] + (255,))
    d.line([(6, 3), (6, 26)], fill=cover[0] + (255,), width=2)  # the spine
    for x, y in ((8, 4), (22, 4), (8, 23), (22, 23)):  # the golden corners
        d.rectangle([x - 1, y - 1, x + 1, y + 1], fill=GOLD[1] + (255,))
    d.rectangle([11, 9, 19, 19], outline=GOLD[1] + (255,))
    polygon(d, [(15, 11), (18, 14), (15, 17), (12, 14)], gem)
    d.point((14, 13), fill=(255, 255, 255, 255))
    return add_outline(im)


ITEM_RUNES = {
    "rune_of_radiance": (
        ((200, 150, 40), (255, 244, 200)),
        (((16, 10), (16, 22)), ((12, 14), (20, 14)), ((12, 10), (13, 11)), ((20, 10), (19, 11))),
    ),
}


def item_icons(sources):
    """Icons for the items of the later lands, appended after all others (existing positions stay): pack icons
    in their own colours where one fits, the rest drawn like the rings, boots and runes above."""

    def pack(name, number):
        return Image.open(sources[name](number)).convert("RGBA")

    sword, staff, orb_staff, cape, pendant = (
        pack("loot40", 23),
        pack("basic", 60),
        pack("basic", 41),
        pack("basic", 39),
        pack("loot40", 26),
    )
    silver = ((120, 126, 150), (196, 204, 226), (245, 248, 255))
    return {
        # the Northroad and the gorge
        "travel_papers": pack("loot40", 28),
        "storm_pelt": hue_shift(pack("rpg_loot", 3), 0.5, 0.45, 1.25),
        "goblin_trinket": pack("loot40", 32),
        "skrags_cleaver": tint(pack("basic", 57), (200, 170, 140)),
        "humming_staff": hue_shift(orb_staff, 0.5, 1.1, 1.1),
        "trollhide_cloak": hue_shift(cape, 0.25, 0.35, 0.9),
        "grumms_toll": ring(None, silver),
        "bridgestone_pendant": tint(pendant, (175, 175, 185)),
        "rune_shard": hue_shift(pack("rpg_loot", 35), 0.55, 1.2, 1.1),
        "dire_wolf_pelt": pack("rpg_loot", 25),
        "bandit_insignia": pack("loot40", 5),
        # Saltmere and the sea
        "saltmere_cutlass": tint(pack("basic", 57), (235, 215, 170)),
        "tidecaller_staff": tint(staff, (150, 200, 235)),
        "sailcloth_cloak": hue_shift(cape, 0.1, 0.2, 1.4),
        "sea_boots": boots(((24, 24, 30), (56, 56, 66), (96, 96, 110)), (20, 20, 24)),
        "harbor_charm": tint(pack("rpg_loot", 4), (255, 225, 150)),
        # the crypt
        "grave_dust": tint(pack("basic", 108), (175, 175, 180)),
        "vampire_fang": pack("rpg_loot", 9),
        "bloodfang_blade": tint(sword, (255, 120, 120)),
        "nightveil_staff": hue_shift(orb_staff, 0.7, 1.0, 0.8),
        "crimson_mantle": hue_shift(cape, 0.97, 1.1, 0.9),
        "counts_signet": ring(((120, 10, 30), (220, 40, 60)), silver),
        "templar_shield": heater_shield(((150, 156, 176), (200, 206, 224)), (90, 96, 120), (200, 40, 50)),
        "dawn_aegis": heater_shield(((220, 222, 232), (250, 250, 255)), (214, 178, 90), (240, 196, 70)),
        # the Ember Isles and the forge
        "imp_horn": pack("rpg_loot", 43),
        "golem_core": hue_shift(pack("loot40", 22), 0.07, 1.0, 1.1),
        "cinder_blade": tint(sword, (125, 115, 125)),
        "ashwood_staff": tint(staff, (140, 115, 100)),
        "ashen_cloak": hue_shift(cape, 0, 0.0, 0.85),
        "obsidian_ring": ring(((30, 20, 50), (110, 80, 160)), ((24, 22, 30), (54, 50, 66), (110, 104, 130))),
        "wardens_heart": tint(pendant, (255, 160, 90)),
        "firstflame_blade": tint(sword, (255, 195, 120)),
        "flamecaller_staff": hue_shift(orb_staff, 0.97, 1.25, 1.1),
        "molten_mantle": hue_shift(cape, 0.06, 1.1, 1.25),
        # Tidecrown and the end of Saga II
        "leviathan_fang": tint(sword, (150, 235, 220)),
        "deepcaller_staff": hue_shift(orb_staff, 0.5, 1.2, 1.05),
        "leviathan_mantle": hue_shift(cape, 0.45, 0.5, 0.85),
        "tide_pearl": tint(pendant, (170, 235, 230)),
        "runebearer_mantle": hue_shift(cape, 0.75, 0.9, 1.15),
        # potions and runes
        "orange_potion": hue_shift(pack("potions", 1), 0.07, 1.0, 1.05),
        **{name: rune(colors, glyph) for name, (colors, glyph) in ITEM_RUNES.items()},
        # weapons, helmets, shields and armour of other shapes
        "battle_axe": battle_axe(),
        "war_hammer": war_hammer(),
        "boar_spear": spear(),
        "claymore": blade(length=22),
        "sunsteel_scimitar": blade(curve=0.035, length=19, guard=4),
        "runecarved_staff": staff_icon(
            "rune", (((34, 30, 40), (70, 64, 82), (112, 104, 128)), ((24, 22, 34), (110, 220, 255), (235, 252, 255)))
        ),
        "moonsilver_staff": staff_icon(
            "crescent",
            (((120, 124, 150), (206, 210, 228), (246, 248, 255)), ((70, 74, 120), (226, 230, 255), (255, 255, 255))),
        ),
        "prism_staff": staff_icon(
            "crystal", (((44, 20, 38), (70, 34, 60), (140, 76, 120)), ((110, 20, 70), (255, 90, 170), (255, 220, 240)))
        ),
        "horned_helm": horned_helm(),
        "great_helm": great_helm(),
        "rangers_hood": hood(((36, 64, 40), (58, 98, 58), (92, 140, 84))),
        "golden_circlet": circlet(((30, 60, 160), (90, 150, 255))),
        "oak_buckler": buckler(((118, 76, 44), (160, 110, 66)), ((70, 74, 90), (150, 156, 176)), GOLD[1:]),
        "kite_shield": kite_shield(((40, 70, 150), (70, 110, 200)), (150, 156, 176), (240, 244, 255)),
        "tower_shield": tower_shield(((50, 52, 64), (80, 84, 100)), (30, 30, 38), GOLD[1]),
        "chainmail": tunic(((70, 74, 90), (120, 126, 146), (196, 204, 226)), pattern="mail"),
        "gilded_plate": plate(((150, 156, 176), (200, 206, 224), (245, 248, 255)), GOLD),
        "ranger_leathers": tunic(((36, 60, 34), (64, 100, 56), (110, 150, 90)), strap=((78, 46, 26), GOLD[1])),
        "fur_mantle": cloak(
            ((70, 44, 28), (110, 72, 44), (150, 104, 66)), fur=((150, 140, 128), (214, 206, 192), (245, 240, 230))
        ),
        "tattered_cloak": cloak(((34, 36, 40), (58, 62, 66), (92, 98, 104)), torn=True),
        # more for the mage
        "battlemage_robe": robe(
            ((46, 56, 80), (66, 80, 112), (120, 138, 172)), pauldrons=((150, 160, 186), (220, 226, 240))
        ),
        "thornweave_robe": robe(
            ((78, 58, 34), (104, 80, 48), (160, 130, 86)), leaves=((70, 120, 52), (104, 156, 70), (52, 96, 44))
        ),
        "starweave_robe": robe(
            ((18, 22, 66), (30, 36, 98), (70, 84, 168)),
            trim=GOLD[1],
            stars=((255, 236, 160), (210, 220, 255), (255, 255, 255)),
        ),
        "wide_brim_hat": wide_hat(((44, 26, 58), (66, 40, 86), (110, 74, 136)), GOLD[0], (255, 226, 130)),
        "antler_crown": antler_crown(((28, 70, 30), (104, 156, 70)), ((150, 128, 96), (232, 222, 196)), (210, 70, 60)),
        "arcane_orb": orb(((96, 50, 170), (150, 90, 240), (200, 160, 255))),
        "spell_tome": tome(((82, 24, 30), (120, 36, 40)), (110, 220, 255)),
    }


def main():
    icon_dir = pathlib.Path(sys.argv[1])
    fx_dir = pathlib.Path(sys.argv[2])
    out_dir = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "runeveld/sprites")
    src_dir = out_dir.parent / "src"

    sources = pack_sources(icon_dir, fx_dir)
    custom = custom_icons()
    custom.update(profession_icons(sources))  # after the older custom icons, so no existing position changes
    custom.update(item_icons(sources))
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
