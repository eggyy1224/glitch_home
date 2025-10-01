import math
import os
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
from PIL import Image, ImageDraw

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCENE_PATH = os.path.join(BASE_DIR, "場地模擬", "3A.jpg")
SELECTED_DIR = os.path.join(BASE_DIR, "夜遊 - 毛刺", "選中的後代")
OUTPUT_DIR = os.path.join(BASE_DIR, "場地模擬", "renders")


@dataclass
class ScreenPlacement:
    filename: str
    quad: List[Tuple[float, float]]  # top-left -> top-right -> bottom-right -> bottom-left
    brightness: float = 1.0  # optional multiplier to tweak exposure


def _find_coeffs(dest: List[Tuple[float, float]], src: List[Tuple[float, float]]):
    """Return perspective transform coefficients mapping src -> dest."""
    matrix = []
    for (dx, dy), (sx, sy) in zip(dest, src):
        matrix.append([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy])
        matrix.append([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy])
    a = np.array(matrix, dtype=np.float64)
    b = np.array(src, dtype=np.float64).reshape(8)
    res = np.linalg.solve(a, b)
    return res.tolist()


def _warp_image(img: Image.Image, dest_quad: List[Tuple[float, float]], *, brightness: float = 1.0) -> Tuple[Image.Image, Image.Image, Tuple[int, int]]:
    min_x = min(p[0] for p in dest_quad)
    min_y = min(p[1] for p in dest_quad)
    max_x = max(p[0] for p in dest_quad)
    max_y = max(p[1] for p in dest_quad)

    width = int(math.ceil(max_x - min_x))
    height = int(math.ceil(max_y - min_y))
    if width <= 0 or height <= 0:
        raise ValueError("Invalid destination quadrilateral bounds")

    local_dest = [(x - min_x, y - min_y) for x, y in dest_quad]
    src_quad = [(0, 0), (img.width, 0), (img.width, img.height), (0, img.height)]
    coeffs = _find_coeffs(local_dest, src_quad)

    warped = img.transform((width, height), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    if abs(brightness - 1.0) > 1e-3:
        warped = Image.eval(warped, lambda v: int(max(0, min(255, v * brightness))))

    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(local_dest, fill=255)

    return warped, mask, (int(min_x), int(min_y))


def render_scene(placements: List[ScreenPlacement], scene_path: str = SCENE_PATH, output_path: str | None = None):
    base = Image.open(scene_path).convert("RGB")

    for placement in placements:
        img_path = os.path.join(SELECTED_DIR, placement.filename)
        if not os.path.exists(img_path):
            raise FileNotFoundError(f"Selected image not found: {img_path}")
        artwork = Image.open(img_path).convert("RGB")
        warped, mask, offset = _warp_image(artwork, placement.quad, brightness=placement.brightness)
        base.paste(warped, offset, mask)

    if output_path is None:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        base_name = "scene_with_selected.jpg"
        output_path = os.path.join(OUTPUT_DIR, base_name)
    base.save(output_path)
    return output_path


if __name__ == "__main__":
    placements = [
        ScreenPlacement(
            filename="offspring_20250924_150915_655.png",
            quad=[(120, 230), (310, 240), (300, 780), (110, 760)],
            brightness=1.1,
        ),
        ScreenPlacement(
            filename="offspring_20250925_132631_308.png",
            quad=[(470, 280), (1100, 260), (1120, 670), (460, 680)],
            brightness=1.2,
        ),
        ScreenPlacement(
            filename="offspring_20250924_172737_799.png",
            quad=[(1040, 360), (1240, 375), (1230, 540), (1040, 525)],
            brightness=1.2,
        ),
    ]
    out_path = render_scene(placements)
    print(f"Rendered scene saved to: {out_path}")
