from pydantic import BaseModel, Field
from typing import List, Optional


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
