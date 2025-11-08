"""Collage version generation service using edge-aware color matching."""

from __future__ import annotations

import os
import random
import time
import uuid
from datetime import datetime
from io import BytesIO
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageOps

from ..config import settings
from ..utils.fs import ensure_dirs
from ..utils.metadata import write_metadata


# Task manager for progress tracking
class CollageTaskManager:
    """Simple in-memory task manager for tracking collage generation progress."""
    
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self._cleanup_interval = 300  # Clean up completed tasks after 5 minutes
    
    def create_task(self) -> str:
        """Create a new task and return task_id."""
        self.cleanup_old_tasks()
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "progress": 0,
            "stage": "initializing",
            "message": "準備開始生成...",
            "completed": False,
            "result": None,
            "error": None,
            "created_at": time.time(),
        }
        return task_id
    
    def update_progress(self, task_id: str, progress: int, stage: str, message: str):
        """Update task progress."""
        if task_id in self.tasks:
            self.tasks[task_id]["progress"] = progress
            self.tasks[task_id]["stage"] = stage
            self.tasks[task_id]["message"] = message
    
    def complete_task(self, task_id: str, result: Dict[str, Any]):
        """Mark task as completed with result."""
        if task_id in self.tasks:
            self.tasks[task_id]["progress"] = 100
            self.tasks[task_id]["stage"] = "completed"
            self.tasks[task_id]["message"] = "生成完成"
            self.tasks[task_id]["completed"] = True
            self.tasks[task_id]["result"] = result
    
    def fail_task(self, task_id: str, error: str):
        """Mark task as failed."""
        if task_id in self.tasks:
            self.tasks[task_id]["completed"] = True
            self.tasks[task_id]["error"] = error
            self.tasks[task_id]["stage"] = "failed"
            self.tasks[task_id]["message"] = f"生成失敗: {error}"
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task status."""
        self.cleanup_old_tasks()
        return self.tasks.get(task_id)
    
    def cleanup_old_tasks(self):
        """Remove completed tasks older than cleanup_interval."""
        current_time = time.time()
        for task_id, task_data in list(self.tasks.items()):
            if task_data.get("completed") and (current_time - task_data["created_at"]) > self._cleanup_interval:
                del self.tasks[task_id]


# Global task manager instance
task_manager = CollageTaskManager()


def standardize_image(img: Image.Image, target_w: int, rows: int, cols: int) -> Image.Image:
    """Standardize image: scale to target width, center crop to ensure divisible by rows×cols."""
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    
    # Calculate aspect ratio
    orig_w, orig_h = img.size
    aspect = orig_w / orig_h
    
    # Scale to target width
    target_h = int(target_w / aspect)
    img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    # Calculate tile size
    tile_w = target_w // cols
    tile_h = target_h // rows
    
    # Ensure divisible
    final_w = tile_w * cols
    final_h = tile_h * rows
    
    # Center crop
    crop_x = (target_w - final_w) // 2
    crop_y = (target_h - final_h) // 2
    
    return img.crop((crop_x, crop_y, crop_x + final_w, crop_y + final_h))


def tile_image(img: Image.Image, rows: int, cols: int) -> List[Image.Image]:
    """Split image into rows × cols tiles."""
    tiles = []
    w, h = img.size
    tile_w = w // cols
    tile_h = h // rows
    
    for row in range(rows):
        for col in range(cols):
            x = col * tile_w
            y = row * tile_h
            tile = img.crop((x, y, x + tile_w, y + tile_h))
            tiles.append(tile)
    
    return tiles


def average_rect_color(img: Image.Image, start_x: int, start_y: int, width: int, height: int) -> List[float]:
    """Calculate average RGB color of a rectangular region (sampling approach like CollageMode)."""
    if width <= 0 or height <= 0:
        return [0.0, 0.0, 0.0]
    
    w, h = img.size
    max_x = min(w, start_x + width)
    max_y = min(h, start_y + height)
    
    # Sample every 6th pixel (similar to CollageMode)
    step_x = max(1, width // 6)
    step_y = max(1, height // 6)
    
    pixels = []
    for y in range(start_y, max_y, step_y):
        for x in range(start_x, max_x, step_x):
            if x < w and y < h:
                pixel = img.getpixel((x, y))
                if isinstance(pixel, tuple) and len(pixel) >= 3:
                    pixels.append(pixel[:3])
    
    if not pixels:
        return [0.0, 0.0, 0.0]
    
    r = sum(p[0] for p in pixels) / len(pixels)
    g = sum(p[1] for p in pixels) / len(pixels)
    b = sum(p[2] for p in pixels) / len(pixels)
    
    return [r, g, b]


def compute_edge_colors(tile: Image.Image) -> Dict[str, List[float]]:
    """Compute edge colors for a tile (top, bottom, left, right, center)."""
    w, h = tile.size
    
    strip_w = max(1, int(w * 0.12))
    strip_h = max(1, int(h * 0.12))
    center_w = max(1, int(w * 0.5))
    center_h = max(1, int(h * 0.5))
    center_x = max(0, (w - center_w) // 2)
    center_y = max(0, (h - center_h) // 2)
    
    return {
        "top": average_rect_color(tile, 0, 0, w, strip_h),
        "bottom": average_rect_color(tile, 0, max(0, h - strip_h), w, strip_h),
        "left": average_rect_color(tile, 0, 0, strip_w, h),
        "right": average_rect_color(tile, max(0, w - strip_w), 0, strip_w, h),
        "center": average_rect_color(tile, center_x, center_y, center_w, center_h),
    }


def color_distance(color1: List[float], color2: List[float]) -> float:
    """Calculate Euclidean distance between two RGB colors (like CollageMode)."""
    if not color1 or not color2:
        return 255.0 * 5.0
    
    dr = color1[0] - color2[0]
    dg = color1[1] - color2[1]
    db = color1[2] - color2[2]
    
    return np.sqrt(dr * dr + dg * dg + db * db)


def match_tiles_greedy(
    base_tiles: List[Image.Image],
    candidate_tiles: List[Tuple[Image.Image, int, int, int]],  # (tile, source_idx, row, col)
    rows: int,
    cols: int,
    seed: int,
) -> List[Tuple[int, int, int]]:  # List of (candidate_idx, source_row, source_col)
    """Greedy matching using edge-aware color matching (like CollageMode)."""
    random.seed(seed)
    np.random.seed(seed)
    
    # Compute edge colors for all tiles
    base_edges = [compute_edge_colors(tile) for tile in base_tiles]
    candidate_edges = [compute_edge_colors(tile) for tile, _, _, _ in candidate_tiles]
    
    # Placement matrix
    placed_matrix: List[List[Optional[int]]] = [[None] * cols for _ in range(rows)]
    used_candidates = set()
    
    # Slot order (left to right, top to bottom)
    slot_order = [(r, c) for r in range(rows) for c in range(cols)]
    
    for row, col in slot_order:
        base_idx = row * cols + col
        if base_idx >= len(base_tiles):
            continue
        
        base_edge = base_edges[base_idx]
        best_idx = -1
        best_score = float('inf')
        
        # Find best matching candidate
        for i, (candidate_tile, source_idx, source_row, source_col) in enumerate(candidate_tiles):
            if i in used_candidates:
                continue
            
            candidate_edge = candidate_edges[i]
            score = 0.0
            matches = 0
            
            # Check left neighbor
            if col > 0 and placed_matrix[row][col - 1] is not None:
                neighbor_idx = placed_matrix[row][col - 1]
                if neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["right"], candidate_edge["left"])
                    matches += 1
            
            # Check top neighbor
            if row > 0 and placed_matrix[row - 1][col] is not None:
                neighbor_idx = placed_matrix[row - 1][col]
                if neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["bottom"], candidate_edge["top"])
                    matches += 1
            
            # If no neighbors, use center color vs gray
            if matches == 0:
                score = color_distance(candidate_edge["center"], [128.0, 128.0, 128.0]) + random.random() * 5.0
            else:
                score = score / matches + random.random() * 0.1
            
            if score < best_score:
                best_score = score
                best_idx = i
        
        # Place best candidate
        if best_idx >= 0:
            placed_matrix[row][col] = best_idx
            used_candidates.add(best_idx)
        else:
            # Fallback: use first available
            for i in range(len(candidate_tiles)):
                if i not in used_candidates:
                    placed_matrix[row][col] = i
                    used_candidates.add(i)
                    break
    
    # Build result mapping
    result = []
    for row in range(rows):
        for col in range(cols):
            candidate_idx = placed_matrix[row][col]
            if candidate_idx is not None and candidate_idx < len(candidate_tiles):
                _, source_idx, source_row, source_col = candidate_tiles[candidate_idx]
                result.append((source_idx, source_row, source_col))
            else:
                # Fallback
                result.append((0, 0, 0))
    
    return result


def match_tiles_random(
    base_tiles: List[Image.Image],
    candidate_tiles: List[Tuple[Image.Image, int, int, int]],
    rows: int,
    cols: int,
    seed: int,
) -> List[Tuple[int, int, int]]:
    """Random matching with seed control."""
    random.seed(seed)
    np.random.seed(seed)
    
    total_slots = rows * cols
    available = list(range(len(candidate_tiles)))
    
    # Shuffle available candidates
    random.shuffle(available)
    
    result = []
    for i in range(total_slots):
        if i < len(base_tiles):
            # Use modulo to cycle through candidates if needed
            candidate_idx = available[i % len(available)]
            _, source_idx, source_row, source_col = candidate_tiles[candidate_idx]
            result.append((source_idx, source_row, source_col))
        else:
            result.append((0, 0, 0))
    
    return result


def match_tiles_wave(
    base_tiles: List[Image.Image],
    candidate_tiles: List[Tuple[Image.Image, int, int, int]],  # (tile, source_idx, row, col)
    rows: int,
    cols: int,
    seed: int,
) -> List[Tuple[int, int, int]]:  # List of (source_idx, source_row, source_col)
    """Wave propagation matching: match tiles from center outward using BFS-like approach."""
    random.seed(seed)
    np.random.seed(seed)
    
    # Compute edge colors for all tiles
    base_edges = [compute_edge_colors(tile) for tile in base_tiles]
    candidate_edges = [compute_edge_colors(tile) for tile, _, _, _ in candidate_tiles]
    
    # Calculate center point
    center_row = rows // 2
    center_col = cols // 2
    
    # Calculate Manhattan distance from center for each position
    def manhattan_distance(r1: int, c1: int, r2: int, c2: int) -> int:
        return abs(r1 - r2) + abs(c1 - c2)
    
    # Build distance-sorted slot order
    slots_with_distance = []
    for row in range(rows):
        for col in range(cols):
            dist = manhattan_distance(row, col, center_row, center_col)
            slots_with_distance.append((dist, row, col))
    
    # Sort by distance, then by row, then by col (for same distance)
    slots_with_distance.sort(key=lambda x: (x[0], x[1], x[2]))
    
    # Placement matrix
    placed_matrix: List[List[Optional[int]]] = [[None] * cols for _ in range(rows)]
    used_candidates = set()
    
    # Process slots in wave order (from center outward)
    for dist, row, col in slots_with_distance:
        base_idx = row * cols + col
        if base_idx >= len(base_tiles):
            continue
        
        base_edge = base_edges[base_idx]
        best_idx = -1
        best_score = float('inf')
        
        # Find best matching candidate
        for i, (candidate_tile, source_idx, source_row, source_col) in enumerate(candidate_tiles):
            if i in used_candidates:
                continue
            
            candidate_edge = candidate_edges[i]
            score = 0.0
            matches = 0
            
            # Check left neighbor
            if col > 0 and placed_matrix[row][col - 1] is not None:
                neighbor_idx = placed_matrix[row][col - 1]
                if neighbor_idx is not None and neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["right"], candidate_edge["left"])
                    matches += 1
            
            # Check right neighbor (if already placed)
            if col < cols - 1 and placed_matrix[row][col + 1] is not None:
                neighbor_idx = placed_matrix[row][col + 1]
                if neighbor_idx is not None and neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["left"], candidate_edge["right"])
                    matches += 1
            
            # Check top neighbor
            if row > 0 and placed_matrix[row - 1][col] is not None:
                neighbor_idx = placed_matrix[row - 1][col]
                if neighbor_idx is not None and neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["bottom"], candidate_edge["top"])
                    matches += 1
            
            # Check bottom neighbor (if already placed)
            if row < rows - 1 and placed_matrix[row + 1][col] is not None:
                neighbor_idx = placed_matrix[row + 1][col]
                if neighbor_idx is not None and neighbor_idx < len(candidate_tiles):
                    neighbor_edge = candidate_edges[neighbor_idx]
                    score += color_distance(neighbor_edge["top"], candidate_edge["bottom"])
                    matches += 1
            
            # If no neighbors, use center color vs gray with some randomness
            if matches == 0:
                score = color_distance(candidate_edge["center"], [128.0, 128.0, 128.0]) + random.random() * 5.0
            else:
                score = score / matches + random.random() * 0.1
            
            if score < best_score:
                best_score = score
                best_idx = i
        
        # Place best candidate
        if best_idx >= 0:
            placed_matrix[row][col] = best_idx
            used_candidates.add(best_idx)
        else:
            # Fallback: use first available
            for i in range(len(candidate_tiles)):
                if i not in used_candidates:
                    placed_matrix[row][col] = i
                    used_candidates.add(i)
                    break
    
    # Build result mapping
    result = []
    for row in range(rows):
        for col in range(cols):
            candidate_idx = placed_matrix[row][col]
            if candidate_idx is not None and candidate_idx < len(candidate_tiles):
                _, source_idx, source_row, source_col = candidate_tiles[candidate_idx]
                result.append((source_idx, source_row, source_col))
            else:
                # Fallback
                result.append((0, 0, 0))
    
    return result


def reassemble_collage(
    base_img: Image.Image,
    candidate_tiles: List[Tuple[Image.Image, int, int, int]],
    mapping: List[Tuple[int, int, int]],
    rows: int,
    cols: int,
    pad_px: int = 0,
    jitter_px: int = 0,
    rotate_deg: int = 0,
    seed: int = 42,
) -> Image.Image:
    """Reassemble collage from matched tiles."""
    random.seed(seed)
    np.random.seed(seed)
    
    w, h = base_img.size
    tile_w = w // cols
    tile_h = h // rows
    
    # Create output canvas
    output_w = w + pad_px * 2
    output_h = h + pad_px * 2
    output = Image.new("RGB", (output_w, output_h), (0, 0, 0))
    
    for row in range(rows):
        for col in range(cols):
            idx = row * cols + col
            if idx >= len(mapping):
                continue
            
            target_source_idx, target_source_row, target_source_col = mapping[idx]
            
            # Find matching candidate tile
            candidate_tile = None
            for tile, source_idx, source_row, source_col in candidate_tiles:
                if source_idx == target_source_idx and source_row == target_source_row and source_col == target_source_col:
                    candidate_tile = tile
                    break
            
            if candidate_tile is None:
                # Fallback: use first candidate if no match found
                if candidate_tiles:
                    candidate_tile, _, _, _ = candidate_tiles[0]
                else:
                    continue
            
            # Resize tile to match base tile size
            tile_resized = candidate_tile.resize((tile_w, tile_h), Image.Resampling.LANCZOS)
            
            # Apply rotation
            if rotate_deg != 0:
                angle = random.uniform(-rotate_deg, rotate_deg)
                tile_rotated = tile_resized.rotate(angle, expand=False, fillcolor=(0, 0, 0))
            else:
                tile_rotated = tile_resized
            
            # Calculate position with jitter
            base_x = col * tile_w + pad_px
            base_y = row * tile_h + pad_px
            
            if jitter_px > 0:
                jitter_x = random.randint(-jitter_px, jitter_px)
                jitter_y = random.randint(-jitter_px, jitter_px)
            else:
                jitter_x = jitter_y = 0
            
            x = base_x + jitter_x
            y = base_y + jitter_y
            
            # Paste tile
            output.paste(tile_rotated, (x, y))
    
    return output


def generate_collage_version(
    image_paths: List[str],
    rows: int = 12,
    cols: int = 16,
    mode: str = "kinship",
    base: str = "first",
    allow_self: bool = False,
    resize_w: int = 2048,
    pad_px: int = 0,
    jitter_px: int = 0,
    rotate_deg: int = 0,
    format: str = "png",
    quality: int = 92,
    seed: Optional[int] = None,
    return_map: bool = False,
    progress_callback: Optional[Callable[[int, str, str], None]] = None,
) -> Dict[str, Any]:
    """Generate collage version from multiple images."""
    if len(image_paths) < 2:
        raise ValueError("至少需要 2 張圖片")
    
    if not allow_self and len(image_paths) == 1:
        raise ValueError("單張圖片且 allow_self=false 時無法生成拼貼")
    
    if seed is None:
        seed = int(time.time())
    
    def report_progress(progress: int, stage: str, message: str):
        if progress_callback:
            progress_callback(progress, stage, message)
    
    report_progress(0, "loading", "開始載入圖片...")
    ensure_dirs([settings.offspring_dir, settings.metadata_dir])
    
    # Load and standardize images
    images = []
    total_images = len(image_paths)
    for idx, path in enumerate(image_paths):
        progress = 5 + int((idx / total_images) * 25)  # 5-30%
        report_progress(progress, "loading", f"載入圖片 {idx + 1}/{total_images}: {os.path.basename(path)}")
        img = Image.open(path)
        report_progress(progress + 2, "standardizing", f"標準化圖片 {idx + 1}/{total_images}")
        img = standardize_image(img, resize_w, rows, cols)
        images.append(img)
    
    report_progress(35, "tiling", "開始切片...")
    
    # Select base image
    if base == "first":
        base_img = images[0]
        base_idx = 0
    elif base == "mean":
        # Use first image as base for now (mean can be implemented later)
        base_img = images[0]
        base_idx = 0
    else:
        base_img = images[0]
        base_idx = 0
    
    # Tile base image
    base_tiles = tile_image(base_img, rows, cols)
    
    # Build candidate pool
    candidate_tiles = []
    for img_idx, img in enumerate(images):
        tiles = tile_image(img, rows, cols)
        for tile_row in range(rows):
            for tile_col in range(cols):
                tile_idx = tile_row * cols + tile_col
                if tile_idx < len(tiles):
                    # Skip base image tiles if allow_self=False
                    if not allow_self and img_idx == base_idx:
                        continue
                    candidate_tiles.append((tiles[tile_idx], img_idx, tile_row, tile_col))
    
    if not candidate_tiles:
        raise ValueError("候選 tile 池為空，請檢查 allow_self 參數")
    
    report_progress(40, "matching", "開始匹配 tiles...")
    
    # Match tiles
    if mode == "kinship":
        mapping = match_tiles_greedy(base_tiles, candidate_tiles, rows, cols, seed)
    elif mode == "random":
        mapping = match_tiles_random(base_tiles, candidate_tiles, rows, cols, seed)
    elif mode == "wave":
        mapping = match_tiles_wave(base_tiles, candidate_tiles, rows, cols, seed)
    else:
        raise ValueError(f"未知的 mode: {mode}")
    
    report_progress(80, "reassembling", "匹配完成，開始重組...")
    
    # Reassemble collage
    output_img = reassemble_collage(
        base_img,
        candidate_tiles,
        mapping,
        rows,
        cols,
        pad_px,
        jitter_px,
        rotate_deg,
        seed,
    )
    
    report_progress(90, "saving", "儲存輸出檔案...")
    
    # Save output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"offspring_{timestamp}_{int(time.time()*1000)%1000:03d}.{format}"
    output_path = os.path.join(settings.offspring_dir, filename)
    
    save_params = {}
    if format.lower() == "jpeg" or format.lower() == "jpg":
        save_params["quality"] = quality
        if output_img.mode in ("RGBA", "LA"):
            output_img = output_img.convert("RGB")
    
    output_img.save(output_path, format=format.upper(), **save_params)
    
    width, height = output_img.size
    
    # Prepare metadata
    parent_basenames = [os.path.basename(p) for p in image_paths]
    parent_full_paths = [os.path.abspath(p) for p in image_paths]
    
    metadata = {
        "generation_type": "collage",
        "parents": parent_basenames,
        "parents_full_paths": parent_full_paths,
        "collage_params": {
            "rows": rows,
            "cols": cols,
            "mode": mode,
            "base": base,
            "allow_self": allow_self,
            "seed": seed,
            "resize_w": resize_w,
            "pad_px": pad_px,
            "jitter_px": jitter_px,
            "rotate_deg": rotate_deg,
        },
        "output_image": filename,
        "output_format": format,
        "output_size": {"width": width, "height": height},
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    
    # Add tile mapping if requested
    if return_map:
        tile_mapping = []
        for row in range(rows):
            for col in range(cols):
                idx = row * cols + col
                if idx < len(mapping):
                    source_idx, source_row, source_col = mapping[idx]
                    if source_idx < len(parent_basenames):
                        tile_mapping.append({
                            "row": row,
                            "col": col,
                            "source_image": parent_basenames[source_idx],
                            "source_row": source_row,
                            "source_col": source_col,
                        })
        metadata["tile_mapping"] = tile_mapping
    
    metadata_path = write_metadata(metadata, base_name=os.path.splitext(filename)[0])
    
    report_progress(100, "completed", "生成完成")
    
    result = {
        "output_image_path": output_path,
        "metadata_path": metadata_path,
        "output_image": filename,
        "parents": parent_basenames,
        "output_format": format,
        "width": width,
        "height": height,
    }
    
    if return_map:
        result["tile_mapping"] = metadata["tile_mapping"]
    
    return result
