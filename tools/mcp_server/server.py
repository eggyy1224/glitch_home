from typing import Any, Dict, Optional, Union

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


@app.tool()
def speak_with_subtitle(
    text: str,
    instructions: Union[str, None] = None,
    voice: Union[str, None] = None,
    model: Union[str, None] = None,
    output_format: Union[str, None] = None,
    filename_base: Union[str, None] = None,
    speed: Union[float, None] = None,
    subtitle_text: Union[str, None] = None,
    subtitle_language: Union[str, None] = None,
    subtitle_duration_seconds: Union[float, None] = None,
    auto_play: bool = False,
    target_client_id: Union[str, None] = None,
) -> Dict[str, Any]:
    """Generate TTS audio and set subtitle simultaneously (POST /api/speak-with-subtitle).
    
    Args:
        text: Text to convert to speech (required).
        instructions: Optional speaking style/voice instructions (e.g., "zh-TW Mandarin, calm, low pitch").
        voice: Optional TTS voice (e.g., "alloy").
        model: Optional OpenAI TTS model (default: gpt-4o-mini-tts).
        output_format: Optional output format: mp3|wav|opus|aac|flac (default: mp3).
        filename_base: Optional custom filename base (system will deduplicate).
        speed: Optional speech speed (0.25-4.0, default: 1.0).
        subtitle_text: Optional subtitle text (if not provided, uses text).
        subtitle_language: Optional language tag (e.g., "zh-TW").
        subtitle_duration_seconds: Optional subtitle display duration in seconds (if omitted, displays until manually cleared).
        auto_play: Whether to automatically play after generation (default: False).
        target_client_id: Optional target client ID for playback and subtitle (if omitted, broadcasts to all).
    
    Returns:
        Dict containing TTS result, subtitle result, URL, and optional playback status.
    """
    payload: Dict[str, Any] = {
        "text": text,
        "auto_play": auto_play,
    }
    
    if instructions is not None:
        payload["instructions"] = instructions
    if voice is not None:
        payload["voice"] = voice
    if model is not None:
        payload["model"] = model
    if output_format is not None:
        payload["output_format"] = output_format
    if filename_base is not None:
        payload["filename_base"] = filename_base
    if speed is not None:
        payload["speed"] = speed
    if subtitle_text is not None:
        payload["subtitle_text"] = subtitle_text
    if subtitle_language is not None:
        payload["subtitle_language"] = subtitle_language
    if subtitle_duration_seconds is not None:
        payload["subtitle_duration_seconds"] = subtitle_duration_seconds
    if target_client_id is not None:
        payload["target_client_id"] = target_client_id
    
    return client.post("/api/speak-with-subtitle", json_body=payload)


@app.tool()
def clear_subtitle(target_client_id: Optional[str] = None) -> Dict[str, Any]:
    """Clear subtitle for a specific client or all clients (DELETE /api/subtitles).
    
    Args:
        target_client_id: Optional client ID to clear subtitle for specific client. If not provided, clears for all clients.
    
    Returns:
        Dict containing operation status.
    """
    params = {"target_client_id": target_client_id} if target_client_id else None
    return client.delete("/api/subtitles", params=params)


def run_stdio() -> None:
    """Run the MCP server over stdio."""
    app.run(transport="stdio")

