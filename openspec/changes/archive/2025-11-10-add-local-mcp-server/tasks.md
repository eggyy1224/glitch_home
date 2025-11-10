## Tasks

- [x] Create `tools/mcp_server/` package with `__main__.py` entry (stdio transport).
- [x] Add config: read `API_BASE` (default `http://localhost:8000`), timeouts.
- [x] Implement HTTP client wrapper with uniform error mapping.
- [x] Implement tools: `health_check`, `list_clients`.
- [x] Add README section with usage examples and env vars.
- [x] OpenSpec validate change passes in strict mode (`openspec validate add-local-mcp-server --strict`).
- [ ] Manual smoke: `health_check`, `list_clients` return expected payloads when backend is running.
- [ ] Document limitations (no uploads/config writes; local-only stdio) and add troubleshooting (backend not running, timeouts, invalid params).
