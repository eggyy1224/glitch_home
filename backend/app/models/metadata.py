from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class OutputSize(BaseModel):
    model_config = ConfigDict(extra="allow")

    width: int
    height: int


class InputDetail(BaseModel):
    model_config = ConfigDict(extra="allow")

    path: str
    name: str
    file_size: Optional[Any] = Field(default=None, description="可為文字或數值，依來源而定")
    dimensions: Optional[str] = None


class GeneratedImageMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    generation_type: Optional[str] = None
    parents: List[str]
    parents_full_paths: List[str] = Field(default_factory=list)
    input_details: List[InputDetail] = Field(default_factory=list)
    model_name: str
    prompt: str
    strength: Optional[float] = None
    created_at: str
    output_image: str
    output_format: str
    output_size: OutputSize


class CollageParams(BaseModel):
    model_config = ConfigDict(extra="allow")

    rows: Optional[int] = None
    cols: Optional[int] = None
    mode: Optional[str] = None
    base: Optional[str] = None
    allow_self: Optional[bool] = None
    seed: Optional[int] = None
    resize_w: Optional[int] = None
    pad_px: Optional[int] = None
    jitter_px: Optional[int] = None
    rotate_deg: Optional[int] = None


class CollageMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    generation_type: Optional[str] = "collage"
    parents: List[str]
    parents_full_paths: List[str] = Field(default_factory=list)
    collage_params: CollageParams | Dict[str, Any]
    output_image: str
    output_format: str
    output_size: OutputSize
    created_at: str
    tile_mapping: Optional[List[Dict[str, Any]]] = None


class SoundEffectMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    kind: Optional[str] = "sound_effect"
    provider: Optional[str] = None
    created_at: str
    prompt: str
    image_path: Optional[str] = None
    request_id: Optional[str] = None
    model_id: Optional[str] = None
    duration_seconds: Optional[float] = None
    prompt_influence: Optional[float] = None
    loop: Optional[bool] = None
    output_format: str
    output_audio: str
    absolute_path: Optional[str] = None
    relative_path: Optional[str] = None
    size_bytes: int
    checksum_sha256: str


class TTSMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    kind: Optional[str] = "tts"
    provider: Optional[str] = None
    created_at: str
    text: str
    instructions: Optional[str] = None
    model: str
    voice: str
    format: str
    speed: Optional[float] = None
    output_audio: str
    absolute_path: Optional[str] = None
    relative_path: Optional[str] = None
    size_bytes: int
    checksum_sha256: str
