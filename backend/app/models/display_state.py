"""Pydantic models for display state management and admin console APIs."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class FrameState(BaseModel):
    """Represents the configuration for a single frame/panel on a client display."""

    id: str = Field(..., min_length=1, description="Frame identifier on the client side")
    label: Optional[str] = Field(default=None, description="Optional human readable label")
    mode: Optional[str] = Field(default=None, description="Optional display mode for this frame")
    params: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary parameters for the frame")


class DisplayStatePayload(BaseModel):
    """State description that should be applied to a client."""

    mode: str = Field(..., min_length=1, description="Primary display mode for the client")
    params: Dict[str, Any] = Field(default_factory=dict, description="Additional parameters for the mode")
    frames: List[FrameState] = Field(default_factory=list, description="Optional per-frame overrides")

    @validator("params", pre=True)
    def ensure_params_dict(cls, value: Any) -> Dict[str, Any]:  # noqa: D417 - pydantic validator
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("params 必須為物件")
        return value


class DisplayStateResponse(BaseModel):
    """API response for display state queries."""

    client_id: Optional[str] = Field(default=None, description="Target client id, None 代表全域預設")
    state: Optional[DisplayStatePayload] = Field(default=None, description="目前儲存的狀態；尚未設定時為 null")
    updated_at: Optional[str] = Field(default=None, description="狀態最後更新時間 (UTC ISO8601)")
    expires_at: Optional[str] = Field(default=None, description="若有設定過期時間則回傳，否則為 null")


class DisplayStateUpdateRequest(DisplayStatePayload):
    """Request payload for setting display state, with optional過期設定。"""

    expires_in: Optional[float] = Field(default=None, ge=0.0, description="狀態有效秒數，省略則不會自動過期")


class CollageConfigRequest(BaseModel):
    """Convenience schema to快速設定 collage 模式。"""

    images: List[str] = Field(default_factory=list, description="欲展示的圖像 ID 列表")
    rows: int = Field(default=6, ge=1, le=50, description="網格列數")
    cols: int = Field(default=6, ge=1, le=50, description="網格行數")
    mix: bool = Field(default=False, description="是否啟用混合拼貼演算法")
    shuffle_seed: Optional[int] = Field(default=None, description="可選 seed，便於重現版面")
    stage_width: Optional[int] = Field(default=None, description="混合模式下的舞台寬度像素")
    stage_height: Optional[int] = Field(default=None, description="混合模式下的舞台高度像素")
    params: Dict[str, Any] = Field(default_factory=dict, description="額外傳給 collage 前端的參數")
