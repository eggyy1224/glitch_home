## ADDED Requirements

### Requirement: Local MCP server exposes curated backend controls
The system SHALL provide a local-only MCP server (stdio transport) that exposes a minimal set of tools mapping to existing backend endpoints, enabling external local LLM agents to orchestrate core features safely.

#### Scenario: Health and client discovery
- WHEN a client calls `health_check()`
- THEN the MCP server returns `{"status":"ok"}` by proxying GET `/health`.
- WHEN a client calls `list_clients()`
- THEN it returns the list of connected clients via GET `/api/clients`.

#### Scenario: Subtitles and captions
- WHEN `set_subtitle(text, language?, duration_seconds?, target_client_id?)` is called
- THEN the server forwards to POST `/api/subtitles` and returns the resulting subtitle payload.
- WHEN `clear_subtitle(target_client_id?)` is called
- THEN it forwards to DELETE `/api/subtitles` and returns 204/ack.
- WHEN `set_caption(...)` or `clear_caption(...)` are called
- THEN it forwards to the corresponding captions endpoints and returns results.

#### Scenario: Screenshot coordination
- WHEN `request_screenshot(metadata?)` is called
- THEN it creates a request via POST `/api/screenshots/request` and returns the created record (including `id`).
- WHEN `get_screenshot_status(request_id)` is called
- THEN it returns current status via GET `/api/screenshots/{request_id}`.

#### Scenario: Audio and TTS
- WHEN `list_sound_files()` is called
- THEN it returns the list from GET `/api/sound-files`.
- WHEN `sound_play(filename, target_client_id?)` is called
- THEN it enqueues playback via POST `/api/sound-play` and returns `{status: "queued"}`.
- WHEN `tts_generate(text, ...)` is called
- THEN it generates speech via POST `/api/tts` and returns `{tts, url, playback?}`.

#### Scenario: Generation and search
- WHEN `generate_mix_two(...)` is called
- THEN it returns result from POST `/api/generate/mix-two`.
- WHEN `list_offspring_images()` is called
- THEN it returns images from GET `/api/offspring-images`.
- WHEN `generate_collage_version(image_names[], params...)` is called
- THEN it returns a task id from POST `/api/generate-collage-version`.
- WHEN `get_collage_progress(task_id)` is called
- THEN it returns progress via GET `/api/collage-version/{task_id}/progress`.
- WHEN `search_images_by_text(query, top_k?)` is called
- THEN it returns search results from POST `/api/search/text`.

### Requirement: Local-only, safe defaults
The MCP server SHALL run locally over stdio and SHALL NOT expose network listeners by default; it SHALL whitelist only the above tools and enforce timeouts and basic validation.

#### Scenario: Local-only operation
- GIVEN no network listener is configured
- WHEN the MCP server starts
- THEN it runs over stdio and accepts requests only from the spawning client.

