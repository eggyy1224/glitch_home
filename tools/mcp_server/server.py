from typing import Any, Dict, Union

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


@app.tool()
def get_iframe_config(client_id: Union[str, None] = None) -> Dict[str, Any]:
    """Get iframe configuration (GET /api/iframe-config).
    
    Args:
        client_id: Optional client ID to get client-specific config. If not provided, returns global config.
    
    Returns:
        Configuration dict with layout, panels, and other iframe settings.
    """
    params = {"client": client_id} if client_id else None
    return client.get("/api/iframe-config", params=params)


@app.tool()
def update_iframe_config(config: Dict[str, Any], target_client_id: Union[str, None] = None) -> Dict[str, Any]:
    """Update iframe configuration (PUT /api/iframe-config).
    
    Args:
        config: Configuration dict with layout, gap, columns, panels, etc.
        target_client_id: Optional client ID to update client-specific config. If not provided, updates global config.
    
    Returns:
        Updated configuration dict.
    """
    payload = dict(config)
    if target_client_id:
        payload["target_client_id"] = target_client_id
    return client.put("/api/iframe-config", json_body=payload)


@app.tool()
def get_collage_config(client_id: Union[str, None] = None) -> Dict[str, Any]:
    """Get collage configuration (GET /api/collage-config).
    
    Args:
        client_id: Optional client ID to get client-specific config. If not provided, returns global config.
    
    Returns:
        Configuration dict with images, rows, cols, mix settings, etc.
    """
    params = {"client": client_id} if client_id else None
    return client.get("/api/collage-config", params=params)


@app.tool()
def update_collage_config(config: Dict[str, Any], target_client_id: Union[str, None] = None) -> Dict[str, Any]:
    """Update collage configuration (PUT /api/collage-config).
    
    Args:
        config: Configuration dict with images, image_count, rows, cols, mix, stage_width, stage_height, seed, etc.
        target_client_id: Optional client ID to update client-specific config. If not provided, updates global config.
    
    Returns:
        Updated configuration dict.
    """
    payload = dict(config)
    if target_client_id:
        payload["target_client_id"] = target_client_id
    return client.put("/api/collage-config", json_body=payload)


def run_stdio() -> None:
    """Run the MCP server over stdio."""
    app.run(transport="stdio")

