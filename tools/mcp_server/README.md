# Local MCP Server (minimal)

This is a minimal local MCP (Model Context Protocol) server that exposes a
curated set of tools to control the backend via a stable interface.

v1 exposes:
- `health_check()` → GET `/health`
- `list_clients()` → GET `/api/clients`
- `list_assets(source, limit, offset)` → Scan curated local asset folders
- `get_iframe_config(client_id)` → GET `/api/iframe-config`
- `update_iframe_config(config, target_client_id)` → PUT `/api/iframe-config`
- `get_collage_config(client_id)` → GET `/api/collage-config`
- `update_collage_config(config, target_client_id)` → PUT `/api/collage-config`

Transport: stdio (local-only). No TCP port opened by default.

## Run

Ensure the backend is running at `http://localhost:8000` (or set `API_BASE`).

```bash
# From repo root
python -m tools.mcp_server
```

Environment variables:
- `API_BASE` (default: `http://localhost:8000`)
- `HTTP_TIMEOUT_SECONDS` (default: `15`)

## Dependencies

This server expects the Python MCP SDK and an HTTP client:
- `model-context-protocol` (or the `mcp` python package)
- `httpx`

Install into a virtualenv of your choice, e.g.:

```bash
pip install httpx model-context-protocol
# OR (depending on packaging)
pip install httpx mcp
```

## Tools

### Health & Clients

- **`health_check()`**: Check backend health status
- **`list_clients()`**: List all connected frontend clients

### Asset Library

- **`list_assets(source: Literal["videos", "offspring_images", "generated_sounds"], limit: int = 100, offset: int = 0, recursive: bool | None = None, include_metadata: bool = True)`**
  - Sources are currently pinned to:
    - `videos` → `frontend/public/videos/圖像系譜學Video` (served at `/videos/圖像系譜學Video`)
    - `offspring_images` → `backend/offspring_images` (served at `/generated_images`)
    - `generated_sounds` → `backend/generated_sounds` (served at `/generated_sounds`)
  - Returns entries with `name`, `relative_path`, `public_url`, `size_bytes`, `modified_at`, `mime_type`, and optional `metadata`.
  - Image entries include the existing metadata JSON (if any). Video/audio metadata (duration, resolution, etc.) is **TODO** and currently omitted—use the `metadata` field being `null` as a placeholder.
  - Example:
    ```python
    list_assets("videos", limit=50, include_metadata=True)
    # → {"ok": True, "data": [{"name": "BirdmanTalk.mp4", "public_url": "/videos/圖像系譜學Video/BirdmanTalk.mp4", ...}]}
    ```

### Iframe Configuration

- **`get_iframe_config(client_id: str | None = None)`**: Get iframe multi-panel configuration
  - `client_id`: Optional client ID for client-specific config. If omitted, returns global config.
  - Returns: Configuration dict with `layout`, `gap`, `columns`, `panels`, `updated_at`, etc.

- **`update_iframe_config(config: Dict[str, Any], target_client_id: str | None = None)`**: Update iframe configuration
  - `config`: Configuration dict with `layout`, `gap`, `columns`, `panels`, etc.
  - `target_client_id`: Optional client ID to update client-specific config. If omitted, updates global config.
  - Returns: Updated configuration dict.

Example:
```python
update_iframe_config({
    "layout": "grid",
    "gap": 12,
    "columns": 2,
    "panels": [
        {"id": "p1", "image": "offspring_xxx.png", "params": {}},
        {"id": "p2", "image": "offspring_yyy.png", "params": {"slide_mode": "true"}}
    ]
}, target_client_id="desktop")
```

### Collage Configuration

- **`get_collage_config(client_id: str | None = None)`**: Get collage configuration
  - `client_id`: Optional client ID for client-specific config. If omitted, returns global config.
  - Returns: Configuration dict with `config`, `source`, `target_client_id`, `updated_at`, etc.

- **`update_collage_config(config: Dict[str, Any], target_client_id: str | None = None)`**: Update collage configuration
  - `config`: Configuration dict with `images`, `image_count`, `rows`, `cols`, `mix`, `stage_width`, `stage_height`, `seed`, etc.
  - `target_client_id`: Optional client ID to update client-specific config. If omitted, updates global config.
  - Returns: Updated configuration dict.

Example:
```python
update_collage_config({
    "images": ["offspring_xxx.png", "offspring_yyy.png"],
    "image_count": 20,
    "rows": 5,
    "cols": 8,
    "mix": True,
    "stage_width": 2048,
    "stage_height": 1152,
    "seed": 987123
}, target_client_id="desktop_collage")
```

## Notes

- Errors from the backend are returned as structured JSON with `ok=false` and
  an `error` message and optional `status_code`.
- All tools return `{"ok": True, "data": ...}` on success or `{"ok": False, "error": ..., "status_code": ...}` on error.
- Configuration updates are automatically broadcasted to connected clients via WebSocket.
- The tool list is intentionally curated. Extend incrementally as needed.
