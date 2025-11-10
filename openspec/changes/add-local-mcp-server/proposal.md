# Change: Add local MCP server exposing selected backend controls

## Why
Enable other local LLM agents/tools to orchestrate this project via a stable, guarded interface without exposing the full HTTP surface or modifying the frontend. MCP provides a standardized, client-agnostic way to call tools safely over stdio.

## What Changes (Milestone 1)
- Introduce a local-only MCP server (stdio transport) in `tools/mcp_server/`.
- Expose ONLY two tools in v1:
  - `health_check` → GET `/health`
  - `list_clients` → GET `/api/clients`
- Keep scope minimal (no uploads/config mutation/other tools in this change).
- Document usage and environment variables (e.g., `API_BASE=http://localhost:8000`).

## Out of Scope (Follow-up Changes)
- Subtitles/Captions, Screenshot coordination, Audio/TTS, Generation/Search, and others will be proposed and implemented as separate changes.

## Impact
- Affected specs: `mcp-local-server` (new capability).
- Affected code: new package `tools/mcp_server/` using Python MCP, HTTP calls to FastAPI backend.
- Security: local-only, stdio transport, explicit whitelist of tools and parameters.
