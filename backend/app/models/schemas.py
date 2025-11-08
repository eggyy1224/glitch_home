from pydantic import BaseModel, Field, model_validator, ConfigDict
from typing import List, Optional
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


class ImageSearchRequest(BaseModel):
    image_path: str = Field(..., min_length=1, description="Absolute or relative path to an image")
    top_k: int = Field(default=10, ge=1, le=200)


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
        description="希望顯示的秒數，省略則持續顯示直到手動清除",
    )


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


class GenerateCollageVersionRequest(BaseModel):
    """Request parameters for collage version generation."""
    rows: int = Field(default=12, ge=1, le=100, description="切片列數")
    cols: int = Field(default=16, ge=1, le=100, description="切片行數")
    mode: str = Field(default="kinship", description="匹配模式：kinship（邊緣顏色匹配）或 random（隨機）")
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
    output_image_path: str
    metadata_path: str
    output_image: str
    parents: List[str]
    output_format: str
    width: int
    height: int
    tile_mapping: Optional[List[dict]] = Field(default=None, description="Tile 對應關係（當 return_map=true 時）")
