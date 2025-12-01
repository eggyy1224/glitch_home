from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from .scene import AudioMix


def _validate_snapshot_reference(value: str) -> None:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError("snapshot 參考不可為空白")
    if "/" in cleaned:
        client_part, snapshot_name = cleaned.split("/", 1)
        if not snapshot_name.strip():
            raise ValueError("snapshot 名稱不可為空白")
        return
    raise ValueError("snapshot 參考缺少 client_id")


class ScriptEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    type: Literal["scene", "snapshot_pair"] = Field(..., description="scene | snapshot_pair")
    scene_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("scene_id", "sceneId"),
        serialization_alias="sceneId",
        description="當 type=scene 時需要 scene id",
    )
    left_snapshot: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("left_snapshot", "leftSnapshot"),
        serialization_alias="left_snapshot",
        description="左螢幕 snapshot 參考（client/name 或 name）",
    )
    right_snapshot: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("right_snapshot", "rightSnapshot"),
        serialization_alias="right_snapshot",
        description="右螢幕 snapshot 參考（client/name 或 name）",
    )
    duration: float = Field(default=5.0, gt=0, description="停留秒數")
    audio_override: Optional[AudioMix] = Field(
        default=None,
        validation_alias=AliasChoices("audio_override", "audioOverride"),
        serialization_alias="audio_override",
        description="此段的音量覆寫",
    )
    notes: Optional[str] = Field(default=None, description="段落備註")

    @model_validator(mode="after")
    def _validate_entry(self) -> "ScriptEntry":
        entry_type = self.type
        if entry_type == "scene":
            if not self.scene_id or not self.scene_id.strip():
                raise ValueError("scene entry 需要 scene_id")
            self.scene_id = self.scene_id.strip()
            self.left_snapshot = None
            self.right_snapshot = None
        else:
            # snapshot_pair
            left = (self.left_snapshot or "").strip()
            right = (self.right_snapshot or "").strip()
            if not left and not right:
                raise ValueError("snapshot_pair 需要至少 left_snapshot 或 right_snapshot")
            self.left_snapshot = left or None
            self.right_snapshot = right or None
            if left:
                _validate_snapshot_reference(left)
            if right:
                _validate_snapshot_reference(right)
            self.scene_id = None
        return self


class Script(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Script id")
    title: str = Field(default="", description="顯示名稱")
    entries: List[ScriptEntry] = Field(default_factory=list, description="時間軸段落")
    tags: List[str] = Field(default_factory=list, description="分類標籤")
    description: Optional[str] = Field(default=None, description="描述")
    notes: Optional[str] = Field(default=None, description="備註")

    @field_validator("id")
    @classmethod
    def _trim_id(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("script id 不可為空白")
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
    def _validate_entries(self) -> "Script":
        if not self.entries:
            raise ValueError("Script 需要至少一個 entry")
        return self
