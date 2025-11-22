"""Persistent kinship index for fast parent/child relationship queries.

This module provides:
- Build index from metadata/*.json → kinship_index.json (persistent)
- Load index from file
- Fast O(1) queries for parents, children, siblings, ancestors

The index is stored in backend/metadata/kinship_index.json with structure:
{
  "version": 1,
  "built_at": "2025-10-25T...",
  "metadata_count": 1155,
  "parents_map": {"offspring_name.png": ["parent1.png", "parent2.png"], ...},
  "children_map": {"parent.png": ["child1.png", "child2.png"], ...}
}
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Set, List, Optional

from ..config import settings


INDEX_VERSION = 1
INDEX_FILENAME = "kinship_index.json"


class KinshipIndex:
    """Manages persistent kinship index with fast queries."""
    
    def __init__(self) -> None:
        self._parents_map: Dict[str, List[str]] = {}
        self._children_map: Dict[str, List[str]] = {}
        self._loaded: bool = False
        self._settings_obj = settings
        self._settings_metadata_dir = settings.metadata_dir
        self._index_path = Path(self._settings_metadata_dir) / INDEX_FILENAME

    def _sync_settings(self) -> None:
        """
        Keep index paths aligned with the latest Settings instance.

        Some tests reload app.config (creating a new Settings object), so we
        need to refresh cached paths to avoid pointing at stale metadata dirs.
        """
        from .. import config as live_config  # local import to pick up reloads

        live_settings = live_config.settings
        live_metadata_dir = getattr(live_settings, "metadata_dir", self._settings_metadata_dir)

        if (live_settings is not self._settings_obj) or (live_metadata_dir != self._settings_metadata_dir):
            self._settings_obj = live_settings
            self._settings_metadata_dir = live_metadata_dir
            self._index_path = Path(live_metadata_dir) / INDEX_FILENAME
            # Force reload to avoid mixing old maps with new paths
            self._loaded = False
            self._parents_map = {}
            self._children_map = {}
    
    def load(self) -> bool:
        """Load index from disk. Returns True if successful."""
        self._sync_settings()
        if not self._index_path.exists():
            return False
        
        try:
            with self._index_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            
            if data.get("version") != INDEX_VERSION:
                return False
            
            self._parents_map = data.get("parents_map", {})
            self._children_map = data.get("children_map", {})
            self._loaded = True
            
            print(f"✓ Kinship index loaded: {data.get('metadata_count', 0)} items from {data.get('built_at', 'unknown')}")
            return True
        except Exception as e:
            print(f"⚠️  Failed to load kinship index: {e}")
            return False
    
    def build_and_save(self) -> Dict[str, any]:
        """Scan all metadata/*.json, build index, and save to disk."""
        self._sync_settings()
        print("🔨 Building kinship index from metadata...")
        
        metadata_dir = self._index_path.parent
        parents_map: Dict[str, Set[str]] = {}
        children_map: Dict[str, Set[str]] = {}
        
        count = 0
        if metadata_dir.exists():
            for json_file in metadata_dir.glob("offspring_*.json"):
                try:
                    with json_file.open("r", encoding="utf-8") as f:
                        data = json.load(f)
                    
                    # 取得後代檔名
                    child = data.get("output_image", "").strip()
                    if not child:
                        continue
                    
                    child = os.path.basename(child)
                    
                    # 取得父母列表
                    raw_parents = data.get("parents", [])
                    if not isinstance(raw_parents, list):
                        continue
                    
                    parents = []
                    for p in raw_parents:
                        if isinstance(p, str) and p.strip():
                            parents.append(os.path.basename(p.strip()))
                    
                    if not parents:
                        continue
                    
                    # 建立反向索引
                    parents_map.setdefault(child, set()).update(parents)
                    for parent in parents:
                        children_map.setdefault(parent, set()).add(child)
                    
                    count += 1
                except Exception as e:
                    print(f"⚠️  Skipped {json_file.name}: {e}")
                    continue
        
        # 轉成可序列化的格式（set → sorted list）
        parents_serializable = {k: sorted(v) for k, v in parents_map.items()}
        children_serializable = {k: sorted(v) for k, v in children_map.items()}
        
        # 構建索引文件
        index_data = {
            "version": INDEX_VERSION,
            "built_at": datetime.now(timezone.utc).isoformat(),
            "metadata_count": count,
            "parents_map": parents_serializable,
            "children_map": children_serializable,
        }
        
        # 存檔
        with self._index_path.open("w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, ensure_ascii=False)
        
        # 載入到記憶體
        self._parents_map = parents_serializable
        self._children_map = children_serializable
        self._loaded = True
        
        print(f"✓ Kinship index built and saved: {count} offspring, {len(children_map)} parents")
        print(f"  Saved to: {self._index_path}")
        
        return {
            "status": "success",
            "metadata_count": count,
            "offspring_count": len(parents_map),
            "parent_count": len(children_map),
            "index_path": str(self._index_path),
        }
    
    def ensure_loaded(self) -> None:
        """Ensure index is loaded. If not on disk, build it."""
        self._sync_settings()
        if self._loaded:
            return
        
        if not self.load():
            print("📦 Kinship index not found, building...")
            self.build_and_save()
    
    # ---- Query API ----
    
    def parents_of(self, name: str) -> List[str]:
        """Get parents of an image. Returns empty list if not found."""
        self.ensure_loaded()
        return list(self._parents_map.get(name, []))
    
    def children_of(self, name: str) -> List[str]:
        """Get children of an image. Returns empty list if not found."""
        self.ensure_loaded()
        return list(self._children_map.get(name, []))
    
    def siblings_of(self, name: str) -> List[str]:
        """Get siblings (shares at least one parent). Excludes self."""
        self.ensure_loaded()
        siblings: Set[str] = set()
        parents = self._parents_map.get(name, [])
        for parent in parents:
            siblings.update(self._children_map.get(parent, []))
        siblings.discard(name)
        return sorted(siblings)
    
    def ancestors_levels_of(self, name: str, depth: int) -> List[List[str]]:
        """Get ancestors by level.
        
        Args:
            name: offspring name
            depth: -1 for unlimited, 0 for none, N for N levels
        
        Returns:
            List of levels, e.g. [[parents...], [grandparents...], ...]
        """
        self.ensure_loaded()
        
        if depth == 0:
            return []
        
        visited: Set[str] = {name}
        frontier: Set[str] = set(self._parents_map.get(name, []))
        levels: List[List[str]] = []
        level_no = 1
        
        while frontier:
            level_items = sorted(frontier)
            levels.append(level_items)
            visited.update(frontier)
            
            if depth != -1 and level_no >= depth:
                break
            
            next_frontier: Set[str] = set()
            for node in frontier:
                for p in self._parents_map.get(node, []):
                    if p not in visited:
                        next_frontier.add(p)
            
            frontier = next_frontier
            level_no += 1
        
        return levels
    
    def has_offspring(self, name: str) -> bool:
        """Check if an offspring exists in index."""
        self.ensure_loaded()
        return name in self._parents_map
    
    def stats(self) -> Dict[str, any]:
        """Return index statistics."""
        self.ensure_loaded()
        return {
            "offspring_count": len(self._parents_map),
            "parent_count": len(self._children_map),
            "index_exists": self._index_path.exists(),
            "index_path": str(self._index_path),
        }


# Singleton instance
kinship_index = KinshipIndex()
