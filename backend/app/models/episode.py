from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EpisodeStatus(str, Enum):
    draft = "draft"
    published = "published"
    archived = "archived"


class EpisodeMeta(BaseModel):
    """Episode metadata (versioning and ownership info)."""

    model_config = ConfigDict(extra="allow")

    version: Optional[str] = None
    status: EpisodeStatus = Field(default=EpisodeStatus.draft)
    author: Optional[str] = None
    created_at: Optional[str] = Field(default=None, serialization_alias="createdAt")
    updated_at: Optional[str] = Field(default=None, serialization_alias="updatedAt")

    @field_validator("version")
    @classmethod
    def _trim_version(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("author")
    @classmethod
    def _trim_author(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class Episode(BaseModel):
    """Episode definition referencing iframe timeline + assets."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Episode id (slug or UUID)")
    title: str = Field(..., min_length=1, description="Display title")
    description: Optional[str] = Field(default=None, description="Optional description text")
    tags: List[str] = Field(default_factory=list, description="Tag list for grouping")
    timeline_id: str = Field(
        ...,
        min_length=1,
        alias="timelineId",
        serialization_alias="timelineId",
        description="Reference timeline id",
    )
    assets: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Asset groups referenced by the episode (images/audio/etc.)",
    )
    clients_layout: Optional[Dict[str, Any]] = Field(
        default=None,
        alias="clientsLayout",
        serialization_alias="clientsLayout",
        description="Per-client role/layout metadata",
    )
    meta: EpisodeMeta = Field(default_factory=EpisodeMeta, description="Version/status metadata")

    @field_validator("id", "title", "timeline_id")
    @classmethod
    def _trim_required_fields(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("欄位不可為空白")
        return cleaned

    @field_validator("description")
    @classmethod
    def _trim_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("tags", mode="before")
    @classmethod
    def _ensure_tags(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            return [value]
        if not isinstance(value, list):
            raise ValueError("tags 欄位需要陣列")
        return value

    @field_validator("tags")
    @classmethod
    def _sanitize_tags(cls, value: List[str]) -> List[str]:
        cleaned: List[str] = []
        for tag in value:
            if tag is None:
                continue
            text = str(tag).strip()
            if text:
                cleaned.append(text)
        return cleaned

    @field_validator("assets", mode="before")
    @classmethod
    def _ensure_assets(cls, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("assets 欄位需要物件")
        return value

    @field_validator("assets")
    @classmethod
    def _sanitize_assets(cls, value: Dict[str, List[str]]) -> Dict[str, List[str]]:
        sanitized: Dict[str, List[str]] = {}
        for key, raw in value.items():
            key_text = str(key).strip()
            if not key_text:
                continue
            entries: List[str]
            if isinstance(raw, list):
                entries = raw
            elif raw is None:
                entries = []
            else:
                entries = [raw]
            cleaned_entries: List[str] = []
            for item in entries:
                if item is None:
                    continue
                text = str(item).strip()
                if text:
                    cleaned_entries.append(text)
            if cleaned_entries:
                sanitized[key_text] = cleaned_entries
        return sanitized
