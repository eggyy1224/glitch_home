from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import List, Literal, Optional
from datetime import datetime


class GenerateMixTwoResponse(BaseModel):
    # Allow fields like `model_name` without protected namespace warning
    model_config = ConfigDict(protected_namespaces=())
    output_image_path: str
    metadata_path: str
    parents: list[str]
    model_name: str
    # New optional fields for expanded control/visibility
    output_format: Optional[str] = Field(default=None, description="png or jpeg")
    width: Optional[int] = Field(default=None, description="Final output width")
    height: Optional[int] = Field(default=None, description="Final output height")


class GenerateMixTwoRequest(BaseModel):
    # Optional explicit parents. If omitted, service will sample from pool.
    parents: Optional[List[str]] = Field(default=None, description="List of image paths or basenames from genes pool")
    # When parents not provided, how many to sample (>=2)
    count: Optional[int] = Field(default=None, ge=2)
    # Optional custom prompt; falls back to FIXED_PROMPT
    prompt: Optional[str] = None
    # Strength hint (0..1). Model-native support may vary; currently influences prompt.
    strength: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    # Output formatting controls
    output_format: Optional[str] = Field(default=None, description="png or jpeg")
    output_width: Optional[int] = Field(default=None, gt=0)
    output_height: Optional[int] = Field(default=None, gt=0)
    output_max_side: Optional[int] = Field(default=None, gt=0)
    # Resize behavior when both width & height provided: 'cover' (fill+center-crop)
    # or 'fit' (contain+pad). Defaults to 'cover'.
    resize_mode: Optional[str] = Field(default=None, description="cover|fit; default cover when width & height provided")


class Vector3(BaseModel):
    x: float
    y: float
    z: float


class CameraPreset(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    position: Vector3
    target: Vector3
    updated_at: Optional[datetime] = None


class SaveCameraPresetRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    position: Vector3
    target: Vector3


class AnalyzeScreenshotRequest(BaseModel):
    image_path: Optional[str] = Field(default=None, description="Absolute or relative path to the screenshot")
    request_id: Optional[str] = Field(default=None, description="Existing screenshot request identifier")
    prompt: Optional[str] = Field(default=None, description="Optional override instructions for Gemini analysis")

    @model_validator(mode="after")
    def _validate_source(self) -> "AnalyzeScreenshotRequest":
        if not self.image_path and not self.request_id:
            raise ValueError("image_path 或 request_id 必須擇一提供")
        if self.image_path and self.request_id:
            raise ValueError("image_path 與 request_id 不可同時指定")
        return self


class GenerateSoundRequest(AnalyzeScreenshotRequest):
    # Allow fields like `model_id` without protected namespace warning
    model_config = ConfigDict(protected_namespaces=())
    prompt: str = Field(..., min_length=1, description="Text prompt that drives sound generation")
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.5,
        le=30.0,
        description="Desired duration in seconds (0.5-30). When omitted ElevenLabs auto-selects.",
    )
    prompt_influence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Prompt influence between 0 and 1 (defaults to provider setting).",
    )
    loop: bool = Field(default=False, description="Request a seamlessly looping sound (model-dependent)")
    model_id: Optional[str] = Field(default=None, description="Override ElevenLabs model identifier")
    output_format: Optional[str] = Field(default=None, description="Output format e.g. mp3_44100_128")


class AnalyzeAndSoundRequest(AnalyzeScreenshotRequest):
    sound_prompt_override: Optional[str] = Field(
        default=None,
        description="Optional custom sound prompt. When omitted we derive it from the analysis summary.",
    )
    sound_duration_seconds: float = Field(
        default=10.0,
        ge=0.5,
        le=30.0,
        description="Duration for the generated sound effect (seconds)",
    )
    sound_prompt_influence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Prompt influence forwarded to ElevenLabs", 
    )
    sound_loop: bool = Field(default=False, description="Request a seamlessly looping sound (model-dependent)")
    sound_model_id: Optional[str] = Field(default=None, description="Override ElevenLabs model identifier")
    sound_output_format: Optional[str] = Field(default=None, description="Override ElevenLabs output format")


# Embedding / Search schemas
class IndexOffspringRequest(BaseModel):
    limit: Optional[int] = Field(default=None, description="Max number to index in this run")
    force: bool = Field(default=False, description="Recompute even if exists")


class IndexOneImageRequest(BaseModel):
    basename: str = Field(..., min_length=1, description="offspring image filename e.g. offspring_...png")
    force: bool = Field(default=False)


class TextSearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=10, ge=1, le=200)
    include_deprecated: bool = Field(default=False, description="是否包含 deprecated 圖片（預設：False，排除 deprecated）")


class ImageSearchRequest(BaseModel):
    image_path: str = Field(..., min_length=1, description="Absolute or relative path to an image")
    top_k: int = Field(default=10, ge=1, le=200)
    include_deprecated: bool = Field(default=False, description="是否包含 deprecated 圖片（預設：False，排除 deprecated）")


class IndexBatchRequest(BaseModel):
    batch_size: int = Field(default=50, ge=1, le=500, description="Number of images per batch")
    offset: int = Field(default=0, ge=0, description="Starting position (0-based)")
    force: bool = Field(default=False, description="Recompute even if exists")


class SubtitleUpdateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="要顯示的字幕內容")
    language: Optional[str] = Field(default=None, max_length=32, description="可選語言標籤（例：zh-TW）")
    duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="希望顯示的秒數，省略則預設為 30 秒後自動消失",
    )


class RemoteClickRequest(BaseModel):
    """Remote click instructions for WebSocket broadcast."""

    model_config = ConfigDict(populate_by_name=True)

    selector: Optional[str] = Field(
        default=None,
        description="CSS 選擇器，表示主要目標（預設可為 .video-mode-container）",
    )
    target_selector: Optional[str] = Field(
        default=None,
        alias="target",
        description="可選擇器，於主要目標內再查找特定元素（例：video 或 .play-button）",
    )
    x: Optional[float] = Field(default=None, description="視窗座標 X（px），若不提供 selector 時需搭配 y 使用")
    y: Optional[float] = Field(default=None, description="視窗座標 Y（px），若不提供 selector 時需搭配 x 使用")
    target_client_id: Optional[str] = Field(
        default=None,
        alias="client_id",
        description="指定目標 client_id（可改由 query target_client_id 指定）",
    )

    @model_validator(mode="after")
    def _validate_click(self) -> "RemoteClickRequest":
        selector = (self.selector or "").strip()
        target_selector = (self.target_selector or "").strip()
        has_selector = bool(selector)
        has_child_selector = bool(target_selector)
        has_coordinates = self.x is not None and self.y is not None
        if not has_selector and not has_child_selector and not has_coordinates:
            raise ValueError("selector、target 或 x/y 座標至少需提供一種定位方式")
        self.selector = selector or None
        self.target_selector = target_selector or None
        if self.target_client_id is not None:
            client = str(self.target_client_id).strip()
            self.target_client_id = client or None
        return self


class VideoControlRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: Literal["play", "pause", "mute", "unmute", "set_volume", "set_muted", "seek", "set_speed"] = Field(
        ...,
        description="Video 控制動作：play/pause/mute/unmute/set_volume/set_muted/seek/set_speed",
    )
    volume: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="音量（0-1），set_volume 或 unmute 時可附帶",
    )
    muted: Optional[bool] = Field(default=None, description="set_muted 動作需要提供 true/false")
    time: Optional[float] = Field(default=None, ge=0.0, description="seek 動作使用的秒數")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="播放速度（0.25–4.0），set_speed 使用")
    target_client_id: Optional[str] = Field(
        default=None,
        alias="client_id",
        description="指定目標 client_id，可改用 query target_client_id 指定",
    )

    @model_validator(mode="after")
    def _validate_video_payload(self) -> "VideoControlRequest":
        if self.action == "set_volume" and self.volume is None:
            raise ValueError("set_volume 需要 volume")
        if self.action == "set_muted" and self.muted is None:
            raise ValueError("set_muted 需要 muted")
        if self.action == "seek" and self.time is None:
            raise ValueError("seek 需要 time")
        if self.action == "set_speed" and self.speed is None:
            raise ValueError("set_speed 需要 speed")
        if self.target_client_id is not None:
            client = str(self.target_client_id).strip()
            self.target_client_id = client or None
        return self


class TimelinePlayRequest(BaseModel):
    target_client_id: Optional[str] = Field(
        default=None,
        description="要播放 timeline 的 client id；未提供時沿用 timeline.client_id",
    )
    auto_play: bool = Field(default=True, description="收到指令後立即播放")
    force_iframe_mode: bool = Field(default=True, description="指示前端切換到 iframe mode")
    start_step: Optional[int] = Field(
        default=None,
        ge=0,
        description="可選，指定從第幾段開始（0-based）",
    )
    loop_override: Optional[bool] = Field(
        default=None,
        description="若提供，覆寫 timeline 的 loop 設定",
    )
    command_id: Optional[str] = Field(
        default=None,
        description="可選的命令 ID，方便客戶端去重",
    )

    @model_validator(mode="after")
    def _normalize_fields(self) -> "TimelinePlayRequest":
        if self.target_client_id:
            client = self.target_client_id.strip()
            self.target_client_id = client or None
        if self.command_id:
            command_id = self.command_id.strip()
            self.command_id = command_id or None
        return self


class TimelineStopRequest(BaseModel):
    target_client_id: Optional[str] = Field(
        default=None,
        description="要停止 timeline 播放的 client id",
    )
    timeline_id: Optional[str] = Field(
        default=None,
        description="限定某個 timeline id；留空則停止該 client 的所有 timeline",
    )
    command_id: Optional[str] = Field(
        default=None,
        description="可選命令 ID，方便客戶端去重",
    )
    release_control: bool = Field(
        default=True,
        description="是否要求客戶端釋放強制播放，回到本機控制",
    )

    @model_validator(mode="after")
    def _normalize_stop_fields(self) -> "TimelineStopRequest":
        if self.target_client_id:
            client = self.target_client_id.strip()
            self.target_client_id = client or None
        if self.timeline_id:
            timeline = self.timeline_id.strip()
            self.timeline_id = timeline or None
        if self.command_id:
            command_id = self.command_id.strip()
            self.command_id = command_id or None
        return self


class SoundPlayRequest(BaseModel):
    filename: str = Field(..., min_length=1, description="音效檔案名稱（含副檔名）")
    target_client_id: Optional[str] = Field(default=None, description="指定播放的 client_id，可為空代表廣播")


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="要轉語音的文字內容")
    instructions: Optional[str] = Field(default=None, description="說話風格/語氣指示，例：zh-TW Mandarin, calm, low pitch")
    voice: Optional[str] = Field(default=None, description="TTS 語音（例如 alloy）")
    model: Optional[str] = Field(default=None, description="OpenAI TTS 模型，預設 gpt-4o-mini-tts")
    output_format: Optional[str] = Field(default=None, description="輸出格式：mp3|wav|opus|aac|flac，預設 mp3")
    filename_base: Optional[str] = Field(default=None, description="自訂輸出檔名基底（系統會自動去重）")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="語速（0.25–4.0），預設 1.0")
    auto_play: bool = Field(default=False, description="產生後自動播放（透過 WebSocket 廣播）")
    target_client_id: Optional[str] = Field(default=None, description="指定自動播放目標客戶端 id")


class SpeakWithSubtitleRequest(BaseModel):
    """Request for TTS with subtitle display."""
    # TTS 相關參數
    text: str = Field(..., min_length=1, description="要轉語音的文字內容")
    instructions: Optional[str] = Field(default=None, description="說話風格/語氣指示，例：zh-TW Mandarin, calm, low pitch")
    voice: Optional[str] = Field(default=None, description="TTS 語音（例如 alloy）")
    model: Optional[str] = Field(default=None, description="OpenAI TTS 模型，預設 gpt-4o-mini-tts")
    output_format: Optional[str] = Field(default=None, description="輸出格式：mp3|wav|opus|aac|flac，預設 mp3")
    filename_base: Optional[str] = Field(default=None, description="自訂輸出檔名基底（系統會自動去重）")
    speed: Optional[float] = Field(default=None, ge=0.25, le=4.0, description="語速（0.25–4.0），預設 1.0")
    # Subtitle 相關參數
    subtitle_text: Optional[str] = Field(default=None, description="字幕文字，若未提供則使用 text")
    subtitle_language: Optional[str] = Field(default=None, max_length=32, description="可選語言標籤（例：zh-TW）")
    subtitle_duration_seconds: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="希望顯示的秒數，省略則預設為 30 秒後自動消失",
    )
    # 播放控制
    auto_play: bool = Field(default=False, description="產生後自動播放（透過 WebSocket 廣播）")
    target_client_id: Optional[str] = Field(default=None, description="指定自動播放和字幕目標客戶端 id")


class GenerateCollageVersionRequest(BaseModel):
    """Request parameters for collage version generation."""
    rows: int = Field(default=12, ge=1, le=300, description="切片列數")
    cols: int = Field(default=16, ge=1, le=300, description="切片行數")
    mode: str = Field(
        default="kinship",
        description=(
            "匹配/處理模式：kinship（邊緣顏色匹配）、random（隨機）、wave、luminance、"
            "source-cluster、weave（橫向編織）、weave-vertical（直向編織）、"
            "rotate-90（單圖，將每個格子旋轉 90°）"
        ),
    )
    base: str = Field(default="first", description="基準圖選擇：first（第一張）或 mean（平均，目前實作為 first）")
    allow_self: bool = Field(default=False, description="是否允許使用基準圖自己的 tile")
    resize_w: int = Field(default=2048, ge=256, le=8192, description="目標寬度（像素）")
    pad_px: int = Field(default=0, ge=0, le=100, description="tile 間距（像素）")
    jitter_px: int = Field(default=0, ge=0, le=50, description="隨機位移（像素）")
    rotate_deg: int = Field(default=0, ge=0, le=45, description="最大旋轉角度（度）")
    format: str = Field(default="png", description="輸出格式：png、jpg、webp")
    quality: int = Field(default=92, ge=1, le=100, description="輸出品質（僅適用於 jpg/webp）")
    seed: Optional[int] = Field(default=None, ge=0, le=2**31-1, description="隨機種子，省略則使用當前時間戳")
    return_map: bool = Field(default=False, description="是否返回 tile 對應關係")


class GenerateCollageVersionResponse(BaseModel):
    """Response for collage version generation."""
    model_config = ConfigDict(protected_namespaces=())
    task_id: str = Field(description="任務 ID，用於查詢進度")
    output_image_path: Optional[str] = Field(default=None, description="輸出圖片路徑（完成後才有）")
    metadata_path: Optional[str] = Field(default=None, description="Metadata 路徑（完成後才有）")
    output_image: Optional[str] = Field(default=None, description="輸出圖片檔名（完成後才有）")
    parents: Optional[List[str]] = Field(default=None, description="親代圖片列表（完成後才有）")
    output_format: Optional[str] = Field(default=None, description="輸出格式（完成後才有）")
    width: Optional[int] = Field(default=None, description="圖片寬度（完成後才有）")
    height: Optional[int] = Field(default=None, description="圖片高度（完成後才有）")
    tile_mapping: Optional[List[dict]] = Field(default=None, description="Tile 對應關係（當 return_map=true 時）")
