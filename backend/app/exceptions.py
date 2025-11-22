from __future__ import annotations

class GenerationError(Exception):
    """Base exception for generation-related failures."""

    def __init__(self, user_message: str, *, log_message: str | None = None) -> None:
        super().__init__(user_message)
        self.user_message = user_message
        self.log_message = log_message or user_message


class ExternalServiceError(GenerationError):
    """Raised when an upstream service fails or returns an invalid response."""


class GenerationIOError(GenerationError):
    """Raised when file system or storage operations fail."""
