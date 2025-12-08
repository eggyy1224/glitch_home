"""Shared path conversion helpers to keep metadata portable across machines."""

from __future__ import annotations

import os
from pathlib import Path

from ..config import settings


def project_root() -> Path:
    """Return the configured project root as a Path."""

    return Path(getattr(settings, "project_root", ".")).expanduser().resolve()


def to_absolute(path: str | Path, base: str | Path | None = None) -> str:
    """Convert a relative path to an absolute path using project root as default base."""

    base_path = Path(base).expanduser().resolve() if base else project_root()
    p = Path(path).expanduser()
    if p.is_absolute():
        return str(p)
    return str((base_path / p).resolve())


def to_relative(path: str | Path, base: str | Path | None = None) -> str:
    """Convert a path to a project-relative string when possible.

    Falls back to os.path.relpath or the original string if outside the base.
    """

    base_path = Path(base).expanduser().resolve() if base else project_root()
    p = Path(path).expanduser()
    if not p.is_absolute():
        # Already relative to somewhere; normalize to remove leading './'
        return os.path.normpath(str(p))

    try:
        return str(p.resolve().relative_to(base_path))
    except Exception:
        try:
            return os.path.relpath(str(p), str(base_path))
        except Exception:
            return str(p)
