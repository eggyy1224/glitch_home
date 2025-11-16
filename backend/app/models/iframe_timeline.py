from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class TimelineTimedTextAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    text: Optional[str] = Field(default=None, description="要顯示的文字；clear=true 時可省略")
    language: Optional[str] = Field(default=None, max_length=32, description="語言標識（例：zh-TW）")
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="顯示秒數，留空則沿用伺服器預設",
    )
    target_client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_client_id", "targetClientId"),
        serialization_alias="targetClientId",
        description="指定的 client id",
    )
    clear: bool = Field(default=False, description="若為 true 代表清除當前字幕/標題")

    @model_validator(mode="after")
    def _validate_content(self) -> "TimelineTimedTextAction":
        if self.clear:
            self.text = None
            return self

        if not self.text or not self.text.strip():
            raise ValueError("subtitle/caption 需要 text 或 clear=true")
        self.text = self.text.strip()
        if self.language:
            lang = self.language.strip()
            self.language = lang or None
        return self


class TimelineSpeechAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    mode: Literal["tts", "speak_with_subtitle", "sound_play"] = Field(
        default="tts", description="tts | speak_with_subtitle | sound_play"
    )
    text: Optional[str] = Field(default=None, description="TTS 文字內容")
    instructions: Optional[str] = Field(default=None, description="TTS 語氣說明")
    voice: Optional[str] = Field(default=None, description="TTS voice 名稱")
    model: Optional[str] = Field(default=None, description="TTS 模型")
    output_format: Optional[str] = Field(default=None, description="輸出格式")
    filename_base: Optional[str] = Field(default=None, description="輸出檔名基底")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="語速")
    auto_play: bool = Field(default=True, description="生成後是否自動播放")
    target_client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_client_id", "targetClientId"),
        serialization_alias="targetClientId",
        description="播放目標 client",
    )
    subtitle_text: Optional[str] = Field(default=None, description="speak_with_subtitle 用字幕文字")
    subtitle_language: Optional[str] = Field(default=None, max_length=32, description="字幕語言")
    subtitle_duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="字幕顯示秒數",
    )
    sound_filename: Optional[str] = Field(default=None, description="sound_play 模式要播放的檔名")

    @model_validator(mode="after")
    def _validate_payload(self) -> "TimelineSpeechAction":
        if self.mode == "sound_play":
            if not self.sound_filename:
                raise ValueError("sound_play 模式需要 sound_filename")
            return self

        if not self.text or not self.text.strip():
            raise ValueError("tts / speak_with_subtitle 模式需要 text")
        self.text = self.text.strip()
        if self.subtitle_text:
            self.subtitle_text = self.subtitle_text.strip()
        if self.subtitle_language:
            lang = self.subtitle_language.strip()
            self.subtitle_language = lang or None
        return self


class IframeTimelineStep(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    snapshot: str = Field(..., min_length=1, description="Snapshot reference (client/name)")
    duration: float = Field(default=5.0, gt=0, description="Duration in seconds")
    at: float | None = Field(default=None, ge=0, description="Optional explicit start time")
    label: Optional[str] = Field(default=None, description="Optional label")
    client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("client_id", "clientId"),
        serialization_alias="clientId",
        description="Override snapshot client id",
    )
    subtitle: Optional[TimelineTimedTextAction] = Field(default=None, description="字幕指令")
    caption: Optional[TimelineTimedTextAction] = Field(default=None, description="標題指令")
    tts: Optional[TimelineSpeechAction] = Field(default=None, description="語音或音效指令")

    @field_validator("snapshot")
    @classmethod
    def _trim_snapshot(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("snapshot 不可為空白")
        return cleaned


class IframeTimeline(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1, description="Timeline id")
    title: str = Field(default="", description="Display name")
    client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("client_id", "clientId"),
        serialization_alias="clientId",
        description="Default client id for snapshots",
    )
    loop: bool = Field(default=False)
    steps: List[IframeTimelineStep] = Field(default_factory=list)
