# Design: Local MCP server (stdio) mapping to FastAPI endpoints

## Overview
Implement a Python-based MCP server that communicates over stdio and exposes a curated set of tools that proxy to existing FastAPI endpoints running at `http://localhost:8000`. Calls use `httpx` with short timeouts and structured error mapping.

## Transport & Topology
- Transport: stdio (default for local MCP clients). No TCP port opened.
- Server runs as a separate process started by MCP-compatible clients.
- Backend dependency: FastAPI backend must be reachable at `API_BASE` (default `http://localhost:8000`).

## Tool Surface (v1)
For this milestone, include only two tools:

- `health_check()` → GET `/health`
- `list_clients()` → GET `/api/clients`

## Future Work
- Subtitles/Captions, Screenshot workflow, Audio/TTS, Generation & Search, kinship ops, and analysis are intentionally excluded and will be proposed separately.

## Error Handling
- Map backend non-2xx to MCP tool errors with `code` and `message`.
- Apply request timeouts (default 30s; shorter 10s for quick calls).
- Validate inputs before forwarding to reduce backend 400s.

## Security & Guardrails
- Local-only stdio server; no network listener.
- Strict tool whitelist; explicit schemas; no arbitrary HTTP passthrough.
- Redact large payloads or files; cap response sizes where possible.

## Dependencies
- Python `httpx` (or `requests` fallback) and `model-context-protocol` Python SDK.
