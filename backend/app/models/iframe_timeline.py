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


class TimelineRemoteClickAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    selector: Optional[str] = Field(default=None, description="CSS selector for primary target")
    target_selector: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_selector", "target"),
        serialization_alias="target",
        description="Nested selector inside primary container",
    )
    x: Optional[float] = Field(default=None, description="Viewport X coordinate (px)")
    y: Optional[float] = Field(default=None, description="Viewport Y coordinate (px)")
    offset_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        validation_alias=AliasChoices("offset_seconds", "offsetSeconds"),
        serialization_alias="offset_seconds",
        description="Delay before triggering the click",
    )
    target_client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_client_id", "targetClientId"),
        serialization_alias="targetClientId",
        description="Target client id override",
    )
    label: Optional[str] = Field(default=None, description="Optional label for logging")

    @model_validator(mode="after")
    def _validate_click(self) -> "TimelineRemoteClickAction":
        selector = (self.selector or "").strip()
        nested = (self.target_selector or "").strip()
        has_selector = bool(selector)
        has_nested = bool(nested)
        has_coordinates = self.x is not None and self.y is not None
        if not has_selector and not has_nested and not has_coordinates:
            raise ValueError("remote_click 需要 selector/target 或 x+y 座標")
        self.selector = selector or None
        self.target_selector = nested or None
        if self.target_client_id:
            client = str(self.target_client_id).strip()
            self.target_client_id = client or None
        if self.label:
            label = self.label.strip()
            self.label = label or None
        return self


class TimelineVideoControlAction(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: Literal["play", "pause", "mute", "unmute", "set_volume", "set_muted", "seek", "set_speed"] = Field(
        ...,
        description="Video 控制動作",
    )
    volume: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="set_volume/unmute 時可指定音量",
    )
    muted: Optional[bool] = Field(default=None, description="set_muted 動作需帶布林值")
    time: Optional[float] = Field(default=None, ge=0.0, description="seek 的目標秒數")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="set_speed 的倍速（0.25–4.0）")
    offset_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        validation_alias=AliasChoices("offset_seconds", "offsetSeconds"),
        serialization_alias="offset_seconds",
        description="延遲幾秒後執行 video 控制",
    )
    target_client_id: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("target_client_id", "targetClientId"),
        serialization_alias="targetClientId",
        description="覆寫預設 target client",
    )

    @model_validator(mode="after")
    def _validate_video_action(self) -> "TimelineVideoControlAction":
        if self.action == "set_volume" and self.volume is None:
            raise ValueError("set_volume 需要 volume")
        if self.action == "set_muted" and self.muted is None:
            raise ValueError("set_muted 需要 muted")
        if self.action == "seek" and self.time is None:
            raise ValueError("seek 需要 time")
        if self.action == "set_speed" and self.speed is None:
            raise ValueError("set_speed 需要 speed")
        if self.target_client_id:
            client = self.target_client_id.strip()
            self.target_client_id = client or None
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
    remote_clicks: List[TimelineRemoteClickAction] = Field(
        default_factory=list,
        description="Remote click actions triggered within the step",
    )
    video_controls: List[TimelineVideoControlAction] = Field(
        default_factory=list,
        description="Video 控制指令",
        validation_alias=AliasChoices("video_controls", "videoControls"),
        serialization_alias="video_controls",
    )
    unlock_audio_targets: List[str] = Field(
        default_factory=list,
        description="List of client ids that should receive unlock-audio before此 step",
        validation_alias=AliasChoices("unlock_audio_targets", "unlockAudioTargets"),
        serialization_alias="unlock_audio_targets",
    )

    @field_validator("snapshot")
    @classmethod
    def _trim_snapshot(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("snapshot 不可為空白")
        return cleaned

    @field_validator("unlock_audio_targets", mode="before")
    @classmethod
    def _sanitize_unlock_targets(cls, value):
        if value is None:
            return []
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            raise ValueError("unlock_audio_targets 需要陣列或字串")
        cleaned: List[str] = []
        for item in value:
            if item is None:
                continue
            text = str(item).strip()
            if not text:
                continue
            cleaned.append(text)
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
