from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

_TIME_PATTERN = re.compile(r"^(?P<h>[01]?\d|2[0-3]):(?P<m>[0-5]\d)(?::(?P<s>[0-5]\d))?$")
_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def _normalize_time_str(value: str) -> str:
    cleaned = (value or "").strip()
    match = _TIME_PATTERN.match(cleaned)
    if not match:
        raise ValueError("time 需要 HH:MM 或 HH:MM:SS 格式")
    hour = int(match.group("h"))
    minute = int(match.group("m"))
    second = int(match.group("s") or 0)
    if second:
        return f"{hour:02d}:{minute:02d}:{second:02d}"
    return f"{hour:02d}:{minute:02d}"


def _sanitize_id(value: str, *, field_name: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise ValueError(f"{field_name} 不可為空白")
    if not _ID_PATTERN.fullmatch(cleaned):
        raise ValueError(f"{field_name} 僅允許字母、數字、底線、連字號")
    return cleaned


class ScheduleEvent(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None, description="事件 ID（若未提供會自動生成）")
    time: str = Field(..., description="每日時間點（HH:MM 或 HH:MM:SS）")
    type: Literal["snapshot", "timeline", "episode", "scene", "script"] = Field(..., description="要播放的類型")
    target_id: str = Field(..., description="目標 ID（snapshot/timeline/episode/scene/script）")
    client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("client_id", "clientId"),
        serialization_alias="client_id",
        description="可選：覆寫目標 client",
    )
    payload: Optional[Dict[str, Any]] = Field(default=None, description="類型特定的額外參數")
    enabled: bool = Field(default=True, description="是否啟用此事件")
    notes: Optional[str] = Field(default=None, description="備註")

    @field_validator("time")
    @classmethod
    def _normalize_time(cls, value: str) -> str:
        return _normalize_time_str(value)

    @field_validator("target_id")
    @classmethod
    def _trim_target(cls, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise ValueError("target_id 不可為空白")
        return cleaned

    @field_validator("client_id", mode="before")
    @classmethod
    def _trim_client(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("payload", mode="before")
    @classmethod
    def _normalize_payload(cls, value):
        if value is None:
            return None
        if isinstance(value, dict):
            return value
        raise ValueError("payload 必須為 object")

    @field_validator("notes", mode="before")
    @classmethod
    def _trim_notes(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("id")
    @classmethod
    def _sanitize_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return _sanitize_id(value, field_name="event id")


class Schedule(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Schedule id")
    title: str = Field(default="", description="顯示名稱")
    timezone: str = Field(default="Asia/Taipei", description="時區名稱")
    status: Literal["active", "paused"] = Field(default="active", description="狀態")
    repeat: Literal["daily"] = Field(default="daily", description="重複方式")
    events: List[ScheduleEvent] = Field(default_factory=list, description="每日事件清單")
    created_at: Optional[datetime] = Field(default=None, description="建立時間")
    updated_at: Optional[datetime] = Field(default=None, description="更新時間")

    @field_validator("id")
    @classmethod
    def _trim_id(cls, value: str) -> str:
        return _sanitize_id(value, field_name="schedule id")

    @field_validator("title", mode="before")
    @classmethod
    def _trim_title(cls, value: Optional[str]) -> str:
        if value is None:
            return ""
        text = str(value).strip()
        return text

    @field_validator("timezone", mode="before")
    @classmethod
    def _trim_timezone(cls, value: Optional[str]) -> str:
        text = (value or "Asia/Taipei").strip()
        if not text:
            raise ValueError("timezone 不可為空白")
        return text

    @model_validator(mode="after")
    def _apply_metadata_defaults(self) -> "Schedule":
        now = datetime.now(timezone.utc)
        if self.created_at is None:
            self.created_at = now
        if self.updated_at is None:
            self.updated_at = self.created_at
        if not self.status:
            self.status = "active"
        if not self.repeat:
            self.repeat = "daily"
        return self
