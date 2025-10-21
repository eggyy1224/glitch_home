from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class PanelConfig(BaseModel):
    id: Optional[str] = Field(default=None, description="Unique panel identifier")
    image: Optional[str] = Field(default=None, description="Filename inside offspring directory")
    url: Optional[str] = Field(default=None, description="Absolute or relative URL to embed")
    params: Dict[str, str] = Field(default_factory=dict, description="Additional query parameters")
    ratio: float = Field(default=1.0, description="Flex ratio weight")
    label: Optional[str] = Field(default=None, description="Optional caption")

    @field_validator("ratio")
    def _ensure_positive_ratio(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("ratio 必須大於 0")
        return float(value)

    @field_validator("image")
    def _sanitize_image(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        sanitized = value.strip()
        if not sanitized:
            return None
        if Path(sanitized).name != sanitized:
            raise ValueError("image 參數僅允許檔名，不可包含路徑")
        return sanitized

    @model_validator(mode="after")
    def _require_source(cls, values: "PanelConfig") -> "PanelConfig":
        if not values.image and not values.url:
            raise ValueError("panel 必須包含 image 或 url 其中之一")
        return values


class IframeConfig(BaseModel):
    layout: str = Field(default="grid")
    gap: int = Field(default=0, ge=0)
    columns: int = Field(default=2, ge=1)
    panels: List[PanelConfig] = Field(default_factory=list)

    @field_validator("layout")
    def _normalize_layout(cls, value: str) -> str:
        allowed = {"grid", "horizontal", "vertical"}
        sanitized = (value or "").strip().lower()
        if sanitized not in allowed:
            return "grid"
        return sanitized


@dataclass
class ResolvedPanel:
    id: Optional[str]
    src: str
    ratio: float
    label: Optional[str]
    image: Optional[str]
    params: Dict[str, str]
    url: Optional[str]


@dataclass
class ResolvedIframeConfig:
    layout: str
    gap: int
    columns: int
    panels: List[ResolvedPanel]
    updated_at: Optional[str]

    def to_payload(self) -> Dict[str, object]:
        return {
            "layout": self.layout,
            "gap": self.gap,
            "columns": self.columns,
            "updated_at": self.updated_at,
            "panels": [
                {
                    "id": panel.id,
                    "src": panel.src,
                    "ratio": panel.ratio,
                    "label": panel.label,
                    "image": panel.image,
                    "params": panel.params,
                    "url": panel.url,
                }
                for panel in self.panels
            ],
        }


def isoformat(ts: Optional[float]) -> Optional[str]:
    if ts is None:
        return None
    try:
        return datetime.utcfromtimestamp(float(ts)).replace(microsecond=0).isoformat() + "Z"
    except Exception:
        return None
