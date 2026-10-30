"""Eldoria: builds the icon atlas sprites/icons.png (32x32 cells) and src/icon-index.js from the Craftpix packs.

Every icon gets the id of the thing it shows in the game (skill, item, class or button), so the UI can draw it with
icon("crushing_blow") without knowing anything about the source.

Usage: python3 -I runeveld/tools/build_icons.py <unpacked icon packs dir> <unpacked effect packs dir> [sprites dir]
Packs: Free Swordsman Skills, Free Paladin Skill Icons, Free RPG Loot Icons, Free 40 Loot Icons, Free Magic Potions,
       Free Basic Pixel Art Fantasy Icons 16x16 (the 32 px variants), plus the small icons from the effect packs
       (Free Pixel Magic Sprite Effects, 11 Free Explosion Sprites).
"""

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
    return Image.fromarray(a)


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


def main():
    icon_dir = pathlib.Path(sys.argv[1])
    fx_dir = pathlib.Path(sys.argv[2])
    out_dir = pathlib.Path(sys.argv[3] if len(sys.argv) > 3 else "runeveld/sprites")
    src_dir = out_dir.parent / "src"

    sources = pack_sources(icon_dir, fx_dir)
    custom = custom_icons()
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
