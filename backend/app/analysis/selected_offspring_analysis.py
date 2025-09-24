import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict
from typing import Dict, List, Tuple, Optional

from PIL import Image, ImageFilter, ImageStat, ImageChops


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
SELECTED_DIR = os.path.join(BASE_DIR, "夜遊 - 毛刺", "選中的後代")
METADATA_DIR = os.path.join(BASE_DIR, "backend", "metadata")
OFFSPRING_IMG_DIR = os.path.join(BASE_DIR, "backend", "offspring_images")


@dataclass
class VisualFeatures:
    width: int
    height: int
    aspect_ratio: float
    mean_luminance: float
    luminance_std: float
    mean_saturation: float
    dominant_hue_bin: int
    edge_density: float
    symmetry_h: float
    palette_hex: List[str]


def _safe_open_image(path: str) -> Optional[Image.Image]:
    try:
        return Image.open(path).convert("RGB")
    except Exception:
        return None


def _resize(image: Image.Image, max_side: int = 512) -> Image.Image:
    w, h = image.size
    scale = min(1.0, float(max_side) / float(max(w, h)))
    if scale < 1.0:
        return image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    return image


def _compute_palette(image: Image.Image, k: int = 5) -> List[str]:
    # Adaptive palette quantization
    pal = image.convert("P", palette=Image.ADAPTIVE, colors=k)
    palette = pal.getpalette()[: k * 3]
    colors = [tuple(palette[i:i+3]) for i in range(0, len(palette), 3)]
    # Sort by frequency using histogram of palette indices
    hist = pal.histogram()
    idx_freq = sorted(((hist[i], i) for i in range(256)), reverse=True)
    seen = set()
    ordered = []
    for _, idx in idx_freq:
        if len(ordered) >= k:
            break
        if idx < len(colors):
            c = colors[idx]
            if c not in seen:
                ordered.append(c)
                seen.add(c)
    def to_hex(c: Tuple[int, int, int]) -> str:
        return "#%02x%02x%02x" % c
    return [to_hex(c) for c in ordered]


def _hsv_stats(image: Image.Image) -> Tuple[float, int]:
    hsv = image.convert("HSV")
    h, s, v = hsv.split()
    # Mean saturation
    mean_s = ImageStat.Stat(s).mean[0] / 255.0
    # Dominant hue bin (12 bins)
    h_small = h.resize((128, 128), Image.NEAREST)
    hist = h_small.histogram()
    # Hue is 0..255, map to 12 bins
    bins = [0] * 12
    for i, count in enumerate(hist):
        b = int(i / 256.0 * 12)
        if b >= 12:
            b = 11
        bins[b] += count
    dominant_bin = max(range(12), key=lambda i: bins[i])
    return mean_s, dominant_bin


def _luminance_stats(image: Image.Image) -> Tuple[float, float]:
    gray = image.convert("L")
    st = ImageStat.Stat(gray)
    mean_l = st.mean[0] / 255.0
    std_l = st.stddev[0] / 255.0
    return mean_l, std_l


def _edge_density(image: Image.Image) -> float:
    edges = image.filter(ImageFilter.FIND_EDGES).convert("L")
    mean_edge = ImageStat.Stat(edges).mean[0] / 255.0
    return mean_edge


def _horizontal_symmetry(image: Image.Image) -> float:
    gray = image.convert("L")
    w, h = gray.size
    left = gray.crop((0, 0, w // 2, h))
    right = gray.crop((w - w // 2, 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT)
    # Pad if widths differ (odd width)
    if left.size != right.size:
        min_w = min(left.size[0], right.size[0])
        left = left.crop((0, 0, min_w, h))
        right = right.crop((0, 0, min_w, h))
    diff = ImageChops.difference(left, right)
    mean_diff = ImageStat.Stat(diff).mean[0] / 255.0
    return max(0.0, 1.0 - mean_diff)


def compute_visual_features(path: str) -> Optional[VisualFeatures]:
    img = _safe_open_image(path)
    if img is None:
        return None
    img = _resize(img, max_side=768)
    w, h = img.size
    aspect = w / float(h) if h else 0.0
    mean_l, std_l = _luminance_stats(img)
    mean_s, hue_bin = _hsv_stats(img)
    edges = _edge_density(img)
    sym_h = _horizontal_symmetry(img)
    palette = _compute_palette(img, k=5)
    return VisualFeatures(
        width=w,
        height=h,
        aspect_ratio=aspect,
        mean_luminance=mean_l,
        luminance_std=std_l,
        mean_saturation=mean_s,
        dominant_hue_bin=hue_bin,
        edge_density=edges,
        symmetry_h=sym_h,
        palette_hex=palette,
    )


def load_selected_offspring() -> List[str]:
    files = []
    for name in os.listdir(SELECTED_DIR):
        if name.lower().endswith(".png") and name.startswith("offspring_"):
            files.append(name)
    files.sort()
    return files


def load_metadata_for(offspring_filename: str) -> Optional[Dict]:
    base = os.path.splitext(offspring_filename)[0]
    meta_path = os.path.join(METADATA_DIR, f"{base}.json")
    if not os.path.exists(meta_path):
        return None
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def parent_type(parent_name: str) -> str:
    # Heuristic: camera photos start with DSCF, AI images start with wc6725_
    if parent_name.upper().startswith("DSCF"):
        return "photo"
    if parent_name.startswith("wc6725_"):
        return "ai"
    return "other"


def summarize_kinship(selected: List[str]) -> Dict:
    parent_to_children: Dict[str, List[str]] = defaultdict(list)
    child_to_parents: Dict[str, List[str]] = {}
    type_counter = Counter()
    for fn in selected:
        meta = load_metadata_for(fn)
        if not meta:
            continue
        parents = meta.get("parents", [])
        child_to_parents[fn] = parents
        for p in parents:
            parent_to_children[p].append(fn)
            type_counter[parent_type(p)] += 1

    # Frequency of parents used across selected
    parent_freq = sorted(((p, len(ch)) for p, ch in parent_to_children.items()), key=lambda x: x[1], reverse=True)

    # Pairwise Jaccard similarity between offspring based on parent sets
    pairs: List[Tuple[str, str, float]] = []
    keys = list(child_to_parents.keys())
    parent_sets = {k: set(child_to_parents[k]) for k in keys}
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = keys[i], keys[j]
            sa, sb = parent_sets[a], parent_sets[b]
            if not sa or not sb:
                continue
            inter = len(sa & sb)
            union = len(sa | sb)
            if union == 0:
                sim = 0.0
            else:
                sim = inter / union
            if sim >= 0.3:  # threshold for highlighting relatedness
                pairs.append((a, b, sim))

    pairs.sort(key=lambda x: x[2], reverse=True)

    return {
        "parent_to_children": parent_to_children,
        "child_to_parents": child_to_parents,
        "parent_frequency": parent_freq[:20],
        "parent_type_counts": dict(type_counter),
        "high_similarity_pairs": pairs[:20],
    }


def summarize_visuals(selected: List[str]) -> Dict:
    per_image: Dict[str, VisualFeatures] = {}
    for fn in selected:
        img_path = os.path.join(OFFSPRING_IMG_DIR, fn)
        if not os.path.exists(img_path):
            # fallback to selected folder
            img_path = os.path.join(SELECTED_DIR, fn)
        vf = compute_visual_features(img_path)
        if vf:
            per_image[fn] = vf

    # Aggregate stats
    def agg(values: List[float]) -> Dict[str, float]:
        if not values:
            return {"mean": 0.0, "min": 0.0, "max": 0.0}
        return {
            "mean": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
        }

    luminance = agg([v.mean_luminance for v in per_image.values()])
    contrast = agg([v.luminance_std for v in per_image.values()])
    saturation = agg([v.mean_saturation for v in per_image.values()])
    edges = agg([v.edge_density for v in per_image.values()])
    symmetry = agg([v.symmetry_h for v in per_image.values()])

    hue_bins = Counter(v.dominant_hue_bin for v in per_image.values())

    return {
        "per_image": {k: asdict(v) for k, v in per_image.items()},
        "aggregate": {
            "mean_luminance": luminance,
            "contrast": contrast,
            "mean_saturation": saturation,
            "edge_density": edges,
            "symmetry_h": symmetry,
            "dominant_hue_bin_counts": dict(sorted(hue_bins.items())),
        },
    }


def main() -> None:
    selected = load_selected_offspring()
    print(f"Selected offspring count: {len(selected)}")
    kin = summarize_kinship(selected)
    vis = summarize_visuals(selected)

    # Report (concise JSON for downstream + quick human-readable snippets)
    report = {
        "selected": selected,
        "kinship": {
            "parent_type_counts": kin["parent_type_counts"],
            "top_parents": kin["parent_frequency"],
            "high_similarity_pairs": kin["high_similarity_pairs"],
        },
        "visuals": vis["aggregate"],
    }

    print("\n=== Summary (JSON) ===")
    print(json.dumps(report, ensure_ascii=False, indent=2))

    # Per-image short descriptors
    print("\n=== Per-image descriptors ===")
    for fn, feats in vis["per_image"].items():
        mood = "bright" if feats["mean_luminance"] > 0.55 else ("dark" if feats["mean_luminance"] < 0.4 else "mid-tone")
        tex = "high-detail" if feats["edge_density"] > 0.35 else ("smooth" if feats["edge_density"] < 0.2 else "moderate-detail")
        sat = "vivid" if feats["mean_saturation"] > 0.5 else ("muted" if feats["mean_saturation"] < 0.3 else "balanced")
        desc = f"{fn}: {mood}, {sat}, {tex}, hueBin={feats['dominant_hue_bin']}, palette={', '.join(feats['palette_hex'][:3])}"
        print(desc)


if __name__ == "__main__":
    main()

