from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class EpisodeTrack(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    timeline_id: str = Field(
        ...,
        validation_alias=AliasChoices("timeline_id", "timelineId"),
        serialization_alias="timelineId",
        description="要播放的 timeline id",
    )
    target_client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_client_id", "targetClientId"),
        serialization_alias="targetClientId",
        description="覆寫 timeline 預設的 client id",
    )
    start_at: Optional[float] = Field(
        default=None,
        ge=0.0,
        validation_alias=AliasChoices("start_at", "startAt"),
        serialization_alias="startAt",
        description="可選，延遲幾秒後開始播放（目前僅做 metadata）",
    )
    auto_play: bool = Field(
        default=True,
        validation_alias=AliasChoices("auto_play", "autoPlay"),
        serialization_alias="autoPlay",
        description="是否立即播放（覆寫 timeline 控制的 autoPlay）",
    )
    loop_override: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("loop_override", "loopOverride"),
        serialization_alias="loopOverride",
        description="若提供，覆寫 timeline loop 設定",
    )
    start_step: Optional[int] = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("start_step", "startStep"),
        serialization_alias="startStep",
        description="可選，指定從第幾段開始（0-based）",
    )
    force_iframe_mode: Optional[bool] = Field(
        default=None,
        validation_alias=AliasChoices("force_iframe_mode", "forceIframeMode"),
        serialization_alias="forceIframeMode",
        description="可選，覆寫預設的 forceIframeMode",
    )

    @field_validator("timeline_id")
    @classmethod
    def _trim_timeline_id(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("timeline_id 不可為空白")
        return cleaned

    @model_validator(mode="after")
    def _normalize_clients(self) -> "EpisodeTrack":
        if self.target_client_id:
            client = self.target_client_id.strip()
            self.target_client_id = client or None
        return self


class Episode(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Episode id")
    version: int = Field(default=1, ge=1, description="版本號")
    status: Literal["draft", "published", "deprecated"] = Field(default="published", description="狀態：draft | published | deprecated")
    created_at: Optional[datetime] = Field(default=None, description="建立時間")
    updated_at: Optional[datetime] = Field(default=None, description="更新時間")
    published_at: Optional[datetime] = Field(default=None, description="發布時間")
    published_by: Optional[str] = Field(default=None, description="發布者（若有）")
    title: str = Field(default="", description="顯示標題")
    description: Optional[str] = Field(default=None, description="可選的描述")
    tags: List[str] = Field(default_factory=list, description="分類或搜尋用的標籤")
    tracks: List[EpisodeTrack] = Field(default_factory=list, description="要協同播放的 timeline 清單")

    @field_validator("id")
    @classmethod
    def _trim_id(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("Episode id 不可為空白")
        return cleaned

    @field_validator("tags", mode="before")
    @classmethod
    def _sanitize_tags(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("tags 必須為陣列")
        cleaned: List[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                cleaned.append(text)
        return cleaned

    @model_validator(mode="after")
    def _validate_tracks(self) -> "Episode":
        if not self.tracks:
            raise ValueError("Episode 至少需要一個 track")
        return self

    @field_validator("published_by", mode="before")
    @classmethod
    def _trim_published_by(cls, value: Optional[str]):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def _apply_metadata_defaults(self) -> "Episode":
        now = datetime.now(timezone.utc)
        if self.created_at is None:
            self.created_at = now
        if self.updated_at is None:
            self.updated_at = self.created_at
        if self.status is None:
            self.status = "published"
        if self.version is None or self.version < 1:
            self.version = 1
        return self
