# Local MCP Server (minimal)

This is a minimal local MCP (Model Context Protocol) server that exposes a
curated set of tools to control the backend via a stable interface.

v1 exposes only:
- `health_check()` → GET `/health`
- `list_clients()` → GET `/api/clients`

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

## Notes
- Errors from the backend are returned as structured JSON with `ok=false` and
  an `error` message and optional `status_code`.
- The tool list is intentionally small for v1. Extend incrementally.

