"""Eldoria – the icons of the menu buttons, drawn here as 16 × 16 pixel art in one style (a dark outline, the
gold and cream of the UI, one colour of their own) and written to sprites/menu_icons.png, one row of cells.

    python3 runeveld/tools/build_menu_icons.py [--preview out.png]
"""

import sys
from pathlib import Path

from PIL import Image

PALETTE = {
    "k": (26, 20, 36),  # outline
    "g": (230, 187, 99),  # gold
    "G": (255, 240, 196),  # gold light
    "d": (154, 114, 48),  # gold dark
    "p": (240, 226, 186),  # parchment
    "P": (196, 172, 124),  # parchment shade
    "f": (240, 196, 154),  # skin
    "F": (200, 138, 98),  # skin shade
    "h": (112, 72, 48),  # hair
    "b": (164, 108, 62),  # leather
    "B": (112, 70, 40),  # leather dark
    "r": (232, 84, 76),  # red
    "R": (150, 44, 46),  # red dark
    "u": (100, 160, 240),  # blue
    "U": (54, 92, 170),  # blue dark
    "v": (184, 136, 255),  # violet
    "V": (236, 220, 255),  # violet light
    "m": (104, 70, 170),  # violet dark
    "e": (110, 200, 120),  # green
    "E": (60, 130, 80),  # green dark
    "s": (196, 206, 222),  # steel
    "S": (110, 120, 142),  # steel dark
    "w": (255, 255, 255),
}

ICONS = {
    "character": [
        "................",
        ".....kkkkkk.....",
        "....khhhhhhk....",
        "...khhhhhhhhk...",
        "...khffffffhk...",
        "...kfkffffkfk...",
        "...kffffffffk...",
        "....kfFFFFfk....",
        ".....kkffkk.....",
        "...kkkuffukkk...",
        "..kuuuuuuuuuuk..",
        ".kuuuuguuguuuUk.",
        ".kuuuuguuguuuUk.",
        ".kUuuuuuuuuuUUk.",
        ".kkkkkkkkkkkkkk.",
        "................",
    ],
    "inventory": [
        "................",
        "......kkkk......",
        ".....kbkkbk.....",
        "....kkkkkkkk....",
        "...kbbbbbbbbk...",
        "..kbbbbbbbbbbk..",
        "..kBBBBBBBBBBk..",
        "..kbbbkggkbbBk..",
        "..kbbbkGdkbbBk..",
        "..kbbbbkkbbbBk..",
        "..kbbbbbbbbbBk..",
        "..kkbbbbbbbbBk..",
        "..kbkbbbbbbBBk..",
        "..kBBBBBBBBBBk..",
        "...kkkkkkkkkk...",
        "................",
    ],
    "quests": [
        "................",
        "..kkkkkkkkkkkk..",
        ".kPpppppppppPPk.",
        ".kkkkkkkkkkkkkk.",
        "..kpppppppppk...",
        "..kpppkrkpppk...",
        "..kpppkrkpppk...",
        "..kpppkrkpppk...",
        "..kpppkrkpppk...",
        "..kppppkppppk...",
        "..kpppkrkpppk...",
        "..kppppkppppk...",
        ".kkkkkkkkkkkkkk.",
        ".kPpppppppppPPk.",
        "..kkkkkkkkkkkk..",
        "................",
    ],
    "map": [
        "................",
        "................",
        ".kkkkkkkkkkkkkk.",
        ".kpPPpppPPppPPk.",
        ".kpPPpeePPppPPk.",
        ".kpPPeeePPprPRk.",
        ".kpPPpeePPpRrRk.",
        ".kpdPpppPPprPRk.",
        ".kpPdpppPdpPPPk.",
        ".kpPPdpdPPdPPPk.",
        ".kpuPPdPPPpdPPk.",
        ".kuuPPpppPPppPk.",
        ".kkkkkkkkkkkkkk.",
        "................",
        "................",
        "................",
    ],
    "enchant": [
        "................",
        "...k.......k....",
        "..kGk.....kVk...",
        "...k......kvk...",
        "........kkVwVkk.",
        ".......kVvwwwvVk",
        "........kkVwVkk.",
        "..........kvk...",
        ".........kkVk...",
        "........kgkk....",
        ".......kgdk.....",
        "......kgdk...k..",
        ".....kgdk...kGk.",
        "....kGdk.....k..",
        "...kkdk.........",
        "....kk..........",
    ],
    "settings": [
        "................",
        "......kkkk......",
        "..kk..kggk..kk..",
        ".kgGkkgGGgkkgdk.",
        ".kdgGGgggggggdk.",
        "..kgggkkkkgggk..",
        ".kkggk....kggkk.",
        "kgGgk......kggdk",
        "kgggk......kgddk",
        ".kkggk....kgdkk.",
        "..kgggkkkkgddk..",
        ".kgdgggggggddgk.",
        ".kgdkkgddgkkddk.",
        "..kk..kddk..kk..",
        "......kkkk......",
        "................",
    ],
    "admin": [
        "................",
        "..........kkk...",
        ".........kssSk..",
        "........ksSk.k..",
        "........ksk.....",
        "........kssk..k.",
        ".......kssssskSk",
        "......kSssssSSk.",
        ".....kSSkkkkkk..",
        "....kSSk........",
        "...kSSk.........",
        "..kSSk..........",
        ".kbBk...........",
        "kbBk............",
        "kBk.............",
        ".k..............",
    ],
    "home": [
        "................",
        ".......kk.......",
        "......krrk......",
        ".....krrrRk.....",
        "....krrrrrRk....",
        "...krrrrrrrRk...",
        "..krrrrrrrrrRk..",
        ".kkkkkkkkkkkkkk.",
        "..kppppppppPPk..",
        "..kpkkkpppppPk..",
        "..kpkukpkkkpPk..",
        "..kpkkkpkbkpPk..",
        "..kpppppkbkpPk..",
        "..kPPPPPkbkPPk..",
        "..kkkkkkkkkkkk..",
        "................",
    ],
}


def rune_disc():
    """The runes: a round stone, lit from the top left, with a glowing rune (two branches off a stave)."""
    grid = [["."] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            distance = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
            if distance < 6.2:
                grid[y][x] = "s" if x + y < 12 else "S"
            elif distance < 7.2:
                grid[y][x] = "k"
    glyph = [(7, y) for y in range(4, 12)] + [(8, 6), (9, 5), (10, 4), (8, 8), (9, 7), (10, 6)]
    for x, y in glyph:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if grid[y + dy][x + dx] in "sS":
                grid[y + dy][x + dx] = "m"
    for x, y in glyph:
        grid[y][x] = "V"
    return ["".join(row) for row in grid]


ICONS = {
    **{key: ICONS[key] for key in ["character", "inventory", "quests", "map"]},
    "runes": rune_disc(),
    **{key: value for key, value in ICONS.items() if key not in ["character", "inventory", "quests", "map"]},
}
ORDER = list(ICONS)
SIZE = 16


def render():
    sheet = Image.new("RGBA", (SIZE * len(ORDER), SIZE), (0, 0, 0, 0))
    for column, name in enumerate(ORDER):
        rows = ICONS[name]
        assert len(rows) == SIZE, name
        for y, row in enumerate(rows):
            for x, cell in enumerate(row[:SIZE]):
                if cell != ".":
                    sheet.putpixel((column * SIZE + x, y), PALETTE[cell] + (255,))
    return sheet


def main():
    sheet = render()
    if "--preview" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--preview") + 1])
        big = Image.new("RGBA", (sheet.width * 6 + 8 * len(ORDER), SIZE * 6 + 16), (24, 28, 44, 255))
        for column in range(len(ORDER)):
            cell = sheet.crop((column * SIZE, 0, column * SIZE + SIZE, SIZE)).resize(
                (SIZE * 6, SIZE * 6), Image.NEAREST
            )
            big.alpha_composite(cell, (column * (SIZE * 6 + 8) + 4, 8))
        big.save(out)
        return
    target = Path(__file__).resolve().parent.parent / "sprites" / "menu_icons.png"
    sheet.save(target)
    print(target, ", ".join(ORDER))


if __name__ == "__main__":
    main()
