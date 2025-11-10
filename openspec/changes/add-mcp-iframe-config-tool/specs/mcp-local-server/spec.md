## ADDED Requirements

### Requirement: Iframe config management via MCP
The MCP server SHALL expose tools to read and update the iframe layout for a specific frontend client by proxying existing backend APIs.

#### Scenario: Read iframe config for a client
- WHEN a client calls `iframe_config_get(client_id)`
- THEN the server proxies `GET /api/iframe-config?client=<client_id>`
- AND returns the JSON body from the backend under `data` when successful.

#### Scenario: Update iframe config for a client
- GIVEN a payload compatible with the backend `PUT /api/iframe-config`
- WHEN a client calls `iframe_config_set(config, target_client_id)`
- THEN the server injects `target_client_id` into the payload when provided
- AND proxies the request to `PUT /api/iframe-config`
- AND returns the backend response JSON under `data` when successful.

#### Scenario: Minimal payload and defaults
- GIVEN a single-panel update with `{ layout: "grid", columns: 1, gap: 0, panels: [{ id: "p1", image: "...", params: {} }] }`
- WHEN sent via `iframe_config_set(..., target_client_id="mobile")`
- THEN the backend writes the client-specific metadata and broadcasts `iframe_config` over WebSocket as per existing behavior.

#### Scenario: Error propagation
- GIVEN the backend returns a non-2xx status or a validation error
- WHEN either MCP tool is called
- THEN the MCP server responds with `{ ok: false, error, status_code? }` so callers can handle failures.

