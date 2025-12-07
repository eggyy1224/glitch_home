import os
import time
from pathlib import Path
from typing import List, Dict, Any

from ..config import settings

class ImageCache:
    _instance = None
    _images: List[Dict[str, str]] = []
    _last_refresh: float = 0.0
    _ttl: float = 10.0  # 10 seconds TTL

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_images(self) -> List[Dict[str, str]]:
        if time.time() - self._last_refresh > self._ttl:
            self.refresh()
        return self._images

    def refresh(self) -> None:
        image_dir = Path(settings.offspring_dir)
        if not image_dir.exists():
            self._images = []
            self._last_refresh = time.time()
            return

        images = []
        # Use scandir for better performance with large directories
        try:
            with os.scandir(image_dir) as entries:
                # Collect files first
                files = []
                for entry in entries:
                    if entry.is_file() and entry.name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        files.append(entry.name)
                
                # Sort in memory (filenames are strings, fast enough for 10k-20k items)
                files.sort()
                
                for filename in files:
                    images.append({
                        "filename": filename,
                        "url": f"/generated_images/{filename}",
                    })
        except OSError:
            # Handle directory access errors gracefully
            pass

        self._images = images
        self._last_refresh = time.time()

    def add_image(self, filename: str) -> None:
        """Optimistically add an image to the cache to avoid immediate refresh."""
        # Check if already exists to avoid duplicates
        for img in self._images:
            if img["filename"] == filename:
                return
        
        new_entry = {
            "filename": filename,
            "url": f"/generated_images/{filename}",
        }
        self._images.append(new_entry)
        # Keep it sorted? Or just append? 
        # API usually expects sorted by name (timestamp).
        # Since filenames usually start with offspring_YYYY..., appending might be correct if time increases.
        # But to be safe, we can sort.
        self._images.sort(key=lambda x: x["filename"])

image_cache = ImageCache.get_instance()
