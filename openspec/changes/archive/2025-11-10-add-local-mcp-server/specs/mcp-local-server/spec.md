## ADDED Requirements

### Requirement: Local MCP server exposes minimal controls (v1)
The system SHALL provide a local-only MCP server (stdio transport) that exposes a minimal initial tool set mapping to existing backend endpoints, enabling external local LLM agents to orchestrate core features safely.

#### Scenario: Health and client discovery
- WHEN a client calls `health_check()`
- THEN the MCP server returns `{"status":"ok"}` by proxying GET `/health`.
- WHEN a client calls `list_clients()`
- THEN it returns the list of connected clients via GET `/api/clients`.

#### Scenario: Out-of-scope tools
- GIVEN tools other than `health_check` and `list_clients`
- WHEN called in this version
- THEN they SHALL NOT be exposed; they will be added in future changes.

### Requirement: Local-only, safe defaults
The MCP server SHALL run locally over stdio and SHALL NOT expose network listeners by default; it SHALL whitelist only the above tools and enforce timeouts and basic validation.

#### Scenario: Local-only operation
- GIVEN no network listener is configured
- WHEN the MCP server starts
- THEN it runs over stdio and accepts requests only from the spawning client.
