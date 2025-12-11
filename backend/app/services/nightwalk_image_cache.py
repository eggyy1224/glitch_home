import os
import time
from pathlib import Path
from typing import Dict, List
from urllib.parse import quote

from ..config import settings


class NightwalkImageCache:
    """Cache and list images under NIGHTWALK_ASSETS_DIR (mounted as /nightwalk_assets)."""

    _instance = None
    _images: List[Dict[str, str]] = []
    _last_refresh: float = 0.0
    _ttl: float = 10.0  # seconds

    @classmethod
    def get_instance(cls) -> "NightwalkImageCache":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_images(self) -> List[Dict[str, str]]:
        if time.time() - self._last_refresh > self._ttl:
            self.refresh()
        return self._images

    def refresh(self) -> None:
        base_dir = settings.nightwalk_assets_dir
        if not base_dir:
            self._images = []
            self._last_refresh = time.time()
            return

        root = Path(base_dir)
        if not root.exists() or not root.is_dir():
            self._images = []
            self._last_refresh = time.time()
            return

        images: list[dict[str, str]] = []
        try:
            for dirpath, dirnames, filenames in os.walk(root):
                # 排除指定資料夾
                dirnames[:] = [d for d in dirnames if d != "spacelive"]
                for filename in filenames:
                    lower = filename.lower()
                    if not lower.endswith((".png", ".jpg", ".jpeg", ".webp")):
                        continue
                    # 過濾掉歷史遺留的 offspring 檔案
                    if lower.startswith("offspring"):
                        continue
                    rel_path = Path(dirpath).joinpath(filename).relative_to(root)
                    rel_posix = rel_path.as_posix()
                    encoded = "/".join(quote(part) for part in rel_path.parts)
                    images.append(
                        {
                            "filename": rel_path.name,
                            "relative_path": rel_posix,
                            "url": f"/nightwalk_assets/{encoded}",
                        }
                    )
        except OSError:
            # 讀取失敗時返回空結果，以免打斷前端
            images = []

        images.sort(key=lambda item: item["relative_path"].lower())
        self._images = images
        self._last_refresh = time.time()


nightwalk_image_cache = NightwalkImageCache.get_instance()
