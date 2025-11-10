from __future__ import annotations

from typing import Any, Dict

from mcp.server.fastmcp import FastMCP

from .http_client import BackendClient


app = FastMCP("glitch-home-local-mcp")
client = BackendClient()


@app.tool()
def health_check() -> Dict[str, Any]:
    """Check backend health (GET /health)."""
    return client.get("/health")


@app.tool()
def list_clients() -> Dict[str, Any]:
    """List connected frontend clients (GET /api/clients)."""
    return client.get("/api/clients")


def run_stdio() -> None:
    """Run the MCP server over stdio."""
    app.run(transport="stdio")

