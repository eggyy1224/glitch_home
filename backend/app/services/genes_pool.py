import os
import random
from typing import Callable, List, Optional, Protocol

from ..config import settings


class ParentSelector(Protocol):
    """Interface responsible for resolving or sampling parent images."""

    def select(
        self,
        *,
        parents: Optional[List[str]] = None,
        count: Optional[int] = None,
    ) -> List[str]:
        """Return a list of absolute parent image paths."""


class FilesystemParentSelector:
    """Resolve parent selections from configured genes pool directories."""

    def __init__(
        self,
        *,
        pool_dirs: Optional[List[str]] = None,
        offspring_dir: Optional[str] = None,
        sampler: Callable[[List[str], int], List[str]] = random.sample,
    ) -> None:
        self._pool_dirs = pool_dirs or getattr(
            settings, "genes_pool_dirs", [settings.genes_pool_dir]
        )
        self._offspring_dir = offspring_dir or settings.offspring_dir
        self._sampler = sampler

    def select(
        self,
        *,
        parents: Optional[List[str]] = None,
        count: Optional[int] = None,
    ) -> List[str]:
        if parents:
            return self._resolve_parent_paths(parents)

        if count is None:
            sample_count = 2
        else:
            sample_count = int(count)
        if sample_count < 2:
            raise ValueError("融合張數必須 >= 2")
        return self._pick_images_from_genes_pool(sample_count)

    def _pick_images_from_genes_pool(self, count: int) -> List[str]:
        pool_dirs = [d for d in self._pool_dirs if os.path.isdir(d)]
        if not pool_dirs:
            raise ValueError(
                "genes_pool directory not found: " + ", ".join(self._pool_dirs)
            )

        all_candidates: List[str] = []
        for pool_dir in pool_dirs:
            for f in os.listdir(pool_dir):
                if f.lower().endswith((".png", ".jpg", ".jpeg")):
                    all_candidates.append(os.path.join(pool_dir, f))

        if len(all_candidates) < count:
            raise ValueError(f"基因池總數不足 {count} 張圖像，請補圖或調整資料夾")

        return self._sampler(all_candidates, count)

    def _resolve_parent_paths(self, explicit: List[str]) -> List[str]:
        search_dirs = list(self._pool_dirs) + [self._offspring_dir]
        resolved: List[str] = []
        for item in explicit:
            candidate_paths: List[str] = []
            if os.path.isabs(item) and os.path.isfile(item):
                candidate_paths.append(item)
            for d in search_dirs:
                if not d:
                    continue
                candidate = os.path.join(d, item)
                if os.path.isfile(candidate):
                    candidate_paths.append(candidate)
            base = os.path.basename(item)
            if not candidate_paths:
                for d in search_dirs:
                    if not os.path.isdir(d):
                        continue
                    for f in os.listdir(d):
                        if f == base:
                            candidate = os.path.join(d, f)
                            if os.path.isfile(candidate):
                                candidate_paths.append(candidate)
                                break
                    if candidate_paths:
                        break
            if not candidate_paths:
                searched_dirs_str = ", ".join([str(d) for d in search_dirs])
                raise ValueError(
                    f"指定的父圖無法解析：{item}。已搜尋目錄：{searched_dirs_str}"
                )
            chosen = candidate_paths[0]
            if not chosen.lower().endswith((".png", ".jpg", ".jpeg")):
                raise ValueError(f"父圖格式不支援（需 png/jpg）：{item}")
            resolved.append(chosen)
        if len(resolved) < 2:
            raise ValueError("父圖至少需要 2 張")
        return resolved


__all__ = ["ParentSelector", "FilesystemParentSelector"]
