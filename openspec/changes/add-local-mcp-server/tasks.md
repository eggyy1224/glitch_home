## 1. Implementation

- [ ] Create `tools/mcp_server/` package with `__main__.py` entry (stdio transport).
- [ ] Add config: read `API_BASE` (default `http://localhost:8000`), timeouts.
- [ ] Implement HTTP client wrapper with uniform error mapping.
- [ ] Implement tools: `health_check`, `list_clients`.
- [ ] Implement tools: `set_subtitle`, `clear_subtitle`, `set_caption`, `clear_caption`.
- [ ] Implement tools: `request_screenshot`, `get_screenshot_status`.
- [ ] Implement tools: `list_sound_files`, `sound_play`, `tts_generate`.
- [ ] Implement tools: `generate_mix_two`, `list_offspring_images`, `generate_collage_version`, `get_collage_progress`, `search_images_by_text`.
- [ ] Add README section with usage examples and env vars.

## 2. Validation

- [ ] Manual smoke: `health_check`, `list_clients` return expected payloads when backend is running.
- [ ] Manual smoke: subtitle/caption set/clear reflects in `/api/subtitles`/`/api/captions` GET.
- [ ] Manual smoke: `request_screenshot` creates an id and `get_screenshot_status` shows status.
- [ ] Manual smoke: `tts_generate` returns `url` and, with `auto_play`, triggers WS broadcast (verify backend logs or connected client behavior).
- [ ] Manual smoke: `generate_mix_two` returns 201 content; `generate_collage_version` returns a task id; progress endpoint responds.

## 3. Tooling & Docs

- [ ] Ensure MCP metadata (tool names, params) are discoverable by common clients.
- [ ] Document limitations (no uploads/config writes; local-only stdio).
- [ ] Add troubleshooting (backend not running, timeouts, invalid params).

