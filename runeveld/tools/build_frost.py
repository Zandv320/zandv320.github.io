"""Eldoria – the sprites of the Frostmarch (Saga III), made from sprites the game already has and the slime pack.

    python3 -I runeveld/tools/build_frost.py <slime pack folder> [runeveld/sprites]

The slime pack folder is the unzipped craftpix slime mobs pack (it holds PNG/Slime1/Without_shadow).

    frost_wolf.png         the wolf (sprites/wolf.png) in white and ice blue
    ice_slime.png          the pack's first slime, unused so far, as clear blue ice
    pine_snow.png, ...     the pines, rocks and bush of the fields with snow lying on every upward edge
    smooth/*.png           their 2x smoothed copies, like every other sprite
"""

import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_sprites import frames_in_row, smooth, stack_animations  # noqa: E402

# a ramp from shadow to highlight: frost-blue to white
ICE_RAMP = [(46, 62, 96), (86, 118, 160), (138, 172, 212), (190, 216, 240), (236, 246, 255)]
SLIME_RAMP = [(30, 64, 110), (52, 112, 170), (96, 170, 220), (160, 214, 244), (232, 248, 255)]


def ramp_color(ramp, value):
    """The colour at `value` (0..1) along a ramp, blended between its steps."""
    t = max(0.0, min(1.0, value)) * (len(ramp) - 1)
    k = min(len(ramp) - 2, int(t))
    f = t - k
    a, b = ramp[k], ramp[k + 1]
    return tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3))


def recolor(image, ramp, keep_dark=40, lift=0.0):
    """Every pixel to the ramp by its brightness; the dark outline stays as it is."""
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0 or max(r, g, b) < keep_dark:
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


def main():
    slime_dir = pathlib.Path(sys.argv[1])
    out_dir = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "runeveld/sprites")
    smooth_dir = out_dir / "smooth"
    written = []

    recolor(Image.open(out_dir / "wolf.png").convert("RGBA"), ICE_RAMP, lift=0.12).save(out_dir / "frost_wolf.png")
    written.append("frost_wolf")

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
    print("written:", written)


if __name__ == "__main__":
    main()
