"""Eldoria – the sprites of the Frostmarch (Saga III), made from sprites the game already has and the slime pack.

    python3 -I runeveld/tools/build_frost.py <slime pack folder> [runeveld/sprites]

The slime pack folder is the unzipped craftpix slime mobs pack (it holds PNG/Slime1/Without_shadow).

    frost_wolf.png         the wolf (sprites/wolf.png) in white and ice blue
    ice_slime.png          the pack's first slime, unused so far, as clear blue ice
    ice_troll.png          Grumm the bridge troll (sprites/grumm.png) in the grey-white of old ice
    hrimgar.png            the same, darker and bluer: the trolls' chieftain
    tex/ice_wall.png, ...  the Glacier Halls' walls and floors, drawn here pixel by pixel
    pine_snow.png, ...     the pines, rocks and bush of the fields with snow lying on every upward edge
    smooth/*.png           their 2x smoothed copies, like every other sprite
"""

import math
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_sprites import frames_in_row, smooth, stack_animations  # noqa: E402

# a ramp from shadow to highlight: frost-blue to white
ICE_RAMP = [(46, 62, 96), (86, 118, 160), (138, 172, 212), (190, 216, 240), (236, 246, 255)]
TROLL_RAMP = [(52, 60, 78), (98, 112, 132), (150, 166, 184), (204, 216, 228), (244, 248, 252)]
HRIMGAR_RAMP = [(24, 34, 62), (48, 74, 120), (92, 132, 182), (164, 200, 232), (236, 246, 255)]
SLIME_RAMP = [(30, 64, 110), (52, 112, 170), (96, 170, 220), (160, 214, 244), (232, 248, 255)]


def ramp_color(ramp, value):
    """The colour at `value` (0..1) along a ramp, blended between its steps."""
    t = max(0.0, min(1.0, value)) * (len(ramp) - 1)
    k = min(len(ramp) - 2, int(t))
    f = t - k
    a, b = ramp[k], ramp[k + 1]
    return tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3))


def recolor(image, ramp, keep_dark=40, lift=0.0, keep_warm=False):
    """Every pixel to the ramp by its brightness; the dark outline stays as it is, and with `keep_warm` so do the
    warm browns and reds (wood, leather, eyes)."""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or max(r, g, b) < keep_dark:
                continue
            if keep_warm and r > g + 12 and r > b + 40:
                continue
            value = (0.3 * r + 0.55 * g + 0.15 * b) / 255
            px[x, y] = (*ramp_color(ramp, value * 1.15 + lift), a)
    return out


SNOW = (240, 246, 252)
SNOW_SHADE = (196, 214, 232)


def snow_on(image, depth=2):
    """Snow on every upward edge: the top `depth` pixels of each run of solid pixels down a column turn white, the
    one under them pale blue (the outline above them stays)."""
    out = image.copy()
    src = image.load()
    px = out.load()
    for x in range(image.width):
        y = 0
        while y < image.height:
            # find the top of a run: a solid pixel with air (or the edge) above it
            if src[x, y][3] > 0 and (y == 0 or src[x, y - 1][3] == 0):
                # skip the outline pixel, if it is one
                start = y + 1 if max(src[x, y][:3]) < 50 else y
                for k in range(depth + 1):
                    yy = start + k
                    if yy >= image.height or src[x, yy][3] == 0 or max(src[x, yy][:3]) < 40:
                        break
                    px[x, yy] = (*(SNOW if k < depth else SNOW_SHADE), src[x, yy][3])
            y += 1
    return out


def cold_leaves(image):
    """The summer green of leaves and needles to the dark blue-green of a northern winter."""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a and g > r and g > b:
                px[x, y] = (int(r * 0.42 + 8), int(g * 0.62 + 10), int(b * 0.7 + 34), a)
    return out


def noise_value(x, y, seed):
    """A fixed pseudo-random number in 0..1 for a pixel."""
    n = (x * 374761393 + y * 668265263 + seed * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) / 0xFFFFFFFF


def ice_wall():
    """Blocks of glacier ice in courses, each lit from the top left, rimmed dark blue, with white frost specks."""
    size = 32
    image = Image.new("RGBA", (size, size))
    px = image.load()
    for y in range(size):
        for x in range(size):
            course = y // 16
            bx = (x + course * 8) % 16
            by = y % 16
            value = 0.55 + 0.25 * noise_value(x // 2, y // 2, 3)
            if bx == 0 or by == 0:
                color = (58, 92, 132)
            elif bx == 1 or by == 1:
                color = (226, 242, 252)
            else:
                shade = value - (bx + by) / 60
                color = tuple(int(c) for c in (150 + 70 * shade, 196 + 50 * shade, 228 + 24 * shade))
            if noise_value(x, y, 7) < 0.03:
                color = (250, 253, 255)
            px[x, y] = (*color, 255)
    return image


def ice_floor(dark=False):
    """Ice underfoot, four units square: clear and pale, or (dark) black water seen through it; a few long cracks
    wandering across it, faint (they wrap round, so the tile repeats without seams), a bubble here and there."""
    size = 64
    image = Image.new("RGBA", (size, size))
    px = image.load()
    for y in range(size):
        for x in range(size):
            value = noise_value(x // 6, y // 6, 11) * 0.5 + noise_value(x // 3, y // 3, 12) * 0.2
            if dark:
                color = (26 + 26 * value, 44 + 34 * value, 74 + 44 * value)
            else:
                color = (192 + 34 * value, 218 + 26 * value, 238 + 14 * value)
            if noise_value(x, y, 19) < 0.006:
                color = (150, 200, 232) if dark else (242, 250, 255)
            px[x, y] = (*(int(c) for c in color), 255)
    crack = (84, 128, 170) if dark else (150, 186, 216)
    for seed, (x, y, angle, length) in enumerate([(5.0, 9.0, 0.5, 40), (38.0, 44.0, 2.6, 34), (50.0, 12.0, 4.1, 18)]):
        for step in range(length):
            px[int(x) % size, int(y) % size] = (*crack, 255)
            angle += (noise_value(step, seed, 23) - 0.5) * 1.1
            x += math.cos(angle)
            y += math.sin(angle)
    return image


def main():
    slime_dir = pathlib.Path(sys.argv[1])
    out_dir = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "runeveld/sprites")
    smooth_dir = out_dir / "smooth"
    written = []

    recolor(Image.open(out_dir / "wolf.png").convert("RGBA"), ICE_RAMP, lift=0.12).save(out_dir / "frost_wolf.png")
    written.append("frost_wolf")

    # the ice trolls: Grumm the bridge troll in the grey-white of old ice; their chieftain Hrimgar darker, bluer
    grumm = Image.open(out_dir / "grumm.png").convert("RGBA")
    recolor(grumm, TROLL_RAMP, lift=-0.14, keep_warm=True).save(out_dir / "ice_troll.png")
    recolor(grumm, HRIMGAR_RAMP, lift=-0.08, keep_warm=True).save(out_dir / "hrimgar.png")
    written += ["ice_troll", "hrimgar"]

    sheets = [
        Image.open(slime_dir / "PNG/Slime1/Without_shadow" / f"Slime1_{anim}_without_shadow.png").convert("RGBA")
        for anim in ("Idle", "Walk", "Attack", "Hurt", "Death")
    ]
    sheets = [recolor(sheet, SLIME_RAMP, lift=0.05) for sheet in sheets]
    cols = max(frames_in_row(sheet, 64, 64, 0) for sheet in sheets)
    stack_animations(sheets, 64, 64, cols).save(out_dir / "ice_slime.png")
    written.append("ice_slime")
    print("ice_slime", [frames_in_row(sheet, 64, 64, 0) for sheet in sheets])

    for name in ("pine", "pine2", "rock", "rock2", "bush"):
        image = Image.open(out_dir / f"{name}.png").convert("RGBA")
        if not name.startswith("rock"):
            image = cold_leaves(image)
        snow_on(image).save(out_dir / f"{name}_snow.png")
        written.append(f"{name}_snow")

    for name in written:
        smooth(Image.open(out_dir / f"{name}.png")).save(smooth_dir / f"{name}.png")
    # the Glacier Halls' walls and floors, among the builders' textures (builders.js TEXTURE_NAMES)
    tex_dir = out_dir / "tex"
    ice_wall().save(tex_dir / "ice_wall.png")
    ice_floor().save(tex_dir / "ice_floor.png")
    ice_floor(dark=True).save(tex_dir / "black_ice.png")
    written += ["tex/ice_wall", "tex/ice_floor", "tex/black_ice"]
    print("written:", written)


if __name__ == "__main__":
    main()
