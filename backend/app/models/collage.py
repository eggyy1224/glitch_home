from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# Collage parameter bounds should mirror frontend defaults to keep behavior aligned.
DEFAULT_IMAGE_COUNT = 4
DEFAULT_ROWS = 3
DEFAULT_COLS = 3
MAX_IMAGES = 30
MAX_ROWS = 96
MAX_COLS = 96
STAGE_MIN_WIDTH = 360
STAGE_MAX_WIDTH = 3840
STAGE_MIN_HEIGHT = 240
STAGE_MAX_HEIGHT = 2160
DEFAULT_STAGE_WIDTH = 960
DEFAULT_STAGE_HEIGHT = 540


class CollageConfig(BaseModel):
    images: List[str] = Field(default_factory=list, description="Ordered list of image basenames to display")
    image_count: int = Field(default=DEFAULT_IMAGE_COUNT, ge=1, le=MAX_IMAGES)
    rows: int = Field(default=DEFAULT_ROWS, ge=1, le=MAX_ROWS)
    cols: int = Field(default=DEFAULT_COLS, ge=1, le=MAX_COLS)
    mix: bool = Field(default=False, description="Whether to mix pieces across images")
    stage_width: int = Field(
        default=DEFAULT_STAGE_WIDTH,
        ge=STAGE_MIN_WIDTH,
        le=STAGE_MAX_WIDTH,
        description="Canvas width in pixels (used when mix=true)",
    )
    stage_height: int = Field(
        default=DEFAULT_STAGE_HEIGHT,
        ge=STAGE_MIN_HEIGHT,
        le=STAGE_MAX_HEIGHT,
        description="Canvas height in pixels (used when mix=true)",
    )
    seed: Optional[int] = Field(
        default=None,
        ge=0,
        description="Optional deterministic seed for shuffling and edge matching",
    )

    @field_validator("images")
    @classmethod
    def _sanitize_images(cls, values: List[str]) -> List[str]:
        sanitized: list[str] = []
        seen: set[str] = set()
        for value in values:
            if not isinstance(value, str):
                continue
            candidate = value.strip()
            if not candidate:
                continue
            safe_name = Path(candidate).name
            if safe_name != candidate:
                raise ValueError("images 列表中的檔名不可包含路徑")
            if safe_name in seen:
                continue
            seen.add(safe_name)
            sanitized.append(safe_name)
        return sanitized

    @field_validator("seed")
    @classmethod
    def _normalize_seed(cls, value: Optional[int]) -> Optional[int]:
        if value is None:
            return None
        return int(value)

    @model_validator(mode="after")
    def _coerce_image_count(self) -> "CollageConfig":
        if self.images and self.image_count > len(self.images):
            object.__setattr__(self, "image_count", len(self.images))
        return self
