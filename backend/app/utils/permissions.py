from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException, status

from ..config import settings

logger = logging.getLogger(__name__)


def runtime_capabilities() -> Dict[str, Any]:
    """Expose current app mode與權限旗標。"""
    return {
        "app_mode": settings.app_mode,
        "enable_generation": settings.enable_generation,
        "enable_metadata_write": settings.enable_metadata_write,
        "enable_asset_write": settings.enable_asset_write,
        "enable_index_rebuild": settings.enable_index_rebuild,
        "enable_analysis_llm": settings.enable_analysis_llm,
    }


def _forbidden_payload(feature: str, reason: str | None = None) -> Dict[str, Any]:
    message = reason or f"目前 APP_MODE={settings.app_mode} 禁止此操作"
    return {
        "message": message,
        "app_mode": settings.app_mode,
        "feature": feature,
        "allowed": False,
    }


def _raise_forbidden(feature: str, reason: str | None = None) -> None:
    payload = _forbidden_payload(feature, reason)
    logger.warning("權限阻擋：%s（mode=%s） reason=%s", feature, settings.app_mode, reason or "feature disabled")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=payload,
    )


def ensure_generation_enabled(reason: str | None = None) -> None:
    if not settings.enable_generation:
        _raise_forbidden("generation", reason)


def ensure_metadata_write_enabled(reason: str | None = None) -> None:
    if not settings.enable_metadata_write:
        _raise_forbidden("metadata_write", reason)


def ensure_asset_write_enabled(reason: str | None = None) -> None:
    if not settings.enable_asset_write:
        _raise_forbidden("asset_write", reason)


def ensure_index_rebuild_enabled(reason: str | None = None) -> None:
    if not settings.enable_index_rebuild:
        _raise_forbidden("index_rebuild", reason)


def ensure_analysis_llm_enabled(reason: str | None = None) -> None:
    if not settings.enable_analysis_llm:
        _raise_forbidden("analysis_llm", reason)


def require_generation_enabled() -> None:
    ensure_generation_enabled()


def require_metadata_write_enabled() -> None:
    ensure_metadata_write_enabled()


def require_asset_write_enabled() -> None:
    ensure_asset_write_enabled()


def require_index_rebuild_enabled() -> None:
    ensure_index_rebuild_enabled()


def require_analysis_llm_enabled() -> None:
    ensure_analysis_llm_enabled()
