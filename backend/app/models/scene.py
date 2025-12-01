from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


def _validate_snapshot_reference(value: str, default_client: str | None) -> None:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("snapshot 參考不可為空白")
    if "/" in cleaned:
        client_part, snapshot_name = cleaned.split("/", 1)
        if not snapshot_name.strip():
            raise ValueError("snapshot 名稱不可為空白")
        return
    if default_client is None:
        raise ValueError("snapshot 參考缺少 client_id")


class AudioMix(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    left: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="左聲道/左螢幕音量")
    right: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="右聲道/右螢幕音量")
    mode: Optional[str] = Field(default=None, max_length=64, description="描述音場模式（例：left-dominant）")
    muted: Optional[bool] = Field(default=None, description="是否靜音")

    @model_validator(mode="after")
    def _trim_mode(self) -> "AudioMix":
        if self.mode:
            mode = self.mode.strip()
            self.mode = mode or None
        return self


class Scene(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Scene id")
    version: int = Field(default=1, ge=1, description="版本號")
    status: Literal["draft", "published", "deprecated"] = Field(default="published", description="狀態")
    created_at: Optional[datetime] = Field(default=None, description="建立時間")
    updated_at: Optional[datetime] = Field(default=None, description="更新時間")
    published_at: Optional[datetime] = Field(default=None, description="發布時間")
    published_by: Optional[str] = Field(default=None, description="發布者（若有）")
    title: str = Field(default="", description="顯示名稱")
    targets: Dict[str, str] = Field(
        default_factory=dict,
        description="clientId -> snapshotRef 對應（snapshotRef 可為 client/name 或 name）",
    )
    audio_mix: Optional[AudioMix] = Field(
        default=None,
        validation_alias=AliasChoices("audio_mix", "audioMix"),
        serialization_alias="audio_mix",
        description="預設音量/靜音設定",
    )
    tags: list[str] = Field(default_factory=list, description="可選標籤")
    description: Optional[str] = Field(default=None, description="描述")
    notes: Optional[str] = Field(default=None, description="內部備註")

    @field_validator("id")
    @classmethod
    def _trim_id(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("scene id 不可為空白")
        return cleaned

    @field_validator("targets", mode="before")
    @classmethod
    def _normalize_targets(cls, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("targets 需要物件形式 (client -> snapshotRef)")
        normalized: Dict[str, str] = {}
        for key, raw in value.items():
            client = (key or "").strip()
            if not client:
                continue
            ref = str(raw or "").strip()
            if not ref:
                continue
            normalized[client] = ref
        return normalized

    @field_validator("tags", mode="before")
    @classmethod
    def _sanitize_tags(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("tags 必須為陣列")
        cleaned: list[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if text:
                cleaned.append(text)
        return cleaned

    @field_validator("published_by", mode="before")
    @classmethod
    def _trim_published_by(cls, value: Optional[str]):
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @model_validator(mode="after")
    def _validate_targets(self) -> "Scene":
        if not self.targets:
            raise ValueError("Scene 需要至少一個 target")
        # 驗證 snapshot ref 基本格式
        for client, ref in self.targets.items():
            if not client.strip():
                raise ValueError("target client 不可為空白")
            if not ref.strip():
                raise ValueError("snapshot 參考不可為空白")
            _validate_snapshot_reference(ref, client)
        return self

    @model_validator(mode="after")
    def _apply_metadata_defaults(self) -> "Scene":
        # 時間戳補預設，確保載入舊檔不會失敗
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
