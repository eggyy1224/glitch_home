# Change: Add local MCP server exposing selected backend controls

## Why
Enable other local LLM agents/tools to orchestrate this project via a stable, guarded interface without exposing the full HTTP surface or modifying the frontend. MCP provides a standardized, client-agnostic way to call tools safely over stdio.

## What Changes
- Introduce a local-only MCP server (stdio transport) in `tools/mcp_server/`.
- Expose a minimal v1 tool set mapped onto existing backend endpoints:
  - Health and client discovery: `health_check`, `list_clients`.
  - Subtitles/Captions: `set_subtitle`, `clear_subtitle`, `set_caption`, `clear_caption`.
  - Screenshot coordination: `request_screenshot`, `get_screenshot_status`.
  - Audio playback and TTS: `list_sound_files`, `sound_play`, `tts_generate`.
  - Generation/search (core): `generate_mix_two`, `list_offspring_images`, `generate_collage_version`, `get_collage_progress`, `search_images_by_text`.
- Keep scope minimal (no file uploads, no config mutation) to reduce risk.
- Document usage and environment variables (e.g., `API_BASE=http://localhost:8000`).

## Impact
- Affected specs: `mcp-local-server` (new capability).
- Affected code: new package `tools/mcp_server/` using Python MCP, HTTP calls to FastAPI backend.
- Security: local-only, stdio transport, explicit whitelist of tools and parameters.

