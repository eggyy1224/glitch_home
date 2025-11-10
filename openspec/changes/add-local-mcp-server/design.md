# Design: Local MCP server (stdio) mapping to FastAPI endpoints

## Overview
Implement a Python-based MCP server that communicates over stdio and exposes a curated set of tools that proxy to existing FastAPI endpoints running at `http://localhost:8000`. Calls use `httpx` with short timeouts and structured error mapping.

## Transport & Topology
- Transport: stdio (default for local MCP clients). No TCP port opened.
- Server runs as a separate process started by MCP-compatible clients.
- Backend dependency: FastAPI backend must be reachable at `API_BASE` (default `http://localhost:8000`).

## Tool Surface (v1)
Grouped by feature for clarity. Each tool has a narrow schema that maps 1:1 to an existing endpoint.

1) Health & discovery
- `health_check()` → GET `/health`
- `list_clients()` → GET `/api/clients`

2) Subtitles/Captions (broadcast or target by `target_client_id`)
- `set_subtitle(text, language?, duration_seconds?, target_client_id?)` → POST `/api/subtitles`
- `clear_subtitle(target_client_id?)` → DELETE `/api/subtitles`
- `set_caption(text, language?, duration_seconds?, target_client_id?)` → POST `/api/captions`
- `clear_caption(target_client_id?)` → DELETE `/api/captions`

3) Screenshot workflow
- `request_screenshot(metadata?)` → POST `/api/screenshots/request`
- `get_screenshot_status(request_id)` → GET `/api/screenshots/{request_id}`

4) Audio & TTS
- `list_sound_files()` → GET `/api/sound-files`
- `sound_play(filename, target_client_id?)` → POST `/api/sound-play`
- `tts_generate(text, instructions?, voice?, model?, speed?, output_format?, auto_play?, target_client_id?)` → POST `/api/tts`

5) Generation & search (core)
- `generate_mix_two(parents?, count?, prompt?, strength?, output_size?)` → POST `/api/generate/mix-two`
- `list_offspring_images()` → GET `/api/offspring-images`
- `generate_collage_version(image_names[], params...)` → POST `/api/generate-collage-version`
- `get_collage_progress(task_id)` → GET `/api/collage-version/{task_id}/progress`
- `search_images_by_text(query, top_k?)` → POST `/api/search/text`

## Out of Scope (v1)
- File upload endpoints (e.g., `/api/screenshots`), due to binary transport and policy.
- Config mutation endpoints (`/api/*-config`), to avoid external agents altering UI behavior.
- Kinship rebuild and bulk indexing (ops-heavy, enable in v2 if needed).
- Screenshot analysis and sound-generation bundles (`/api/analyze-screenshot`, `/api/sound-effects`, `/api/screenshot/bundle`) reserved for v2.

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

