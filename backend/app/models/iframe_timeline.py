from __future__ import annotations

from typing import List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


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
