import json
import os
from typing import Any, Dict

from ..config import settings


def write_metadata(data: Dict[str, Any], base_name: str) -> str:
    os.makedirs(settings.metadata_dir, exist_ok=True)
    path = os.path.join(settings.metadata_dir, f"{base_name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


