from pydantic import BaseModel, Field, model_validator
from typing import List, Optional
from datetime import datetime


class GenerateMixTwoResponse(BaseModel):
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
