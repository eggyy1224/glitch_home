from typing import Any, Dict, Literal, Optional, Union

from mcp.server.fastmcp import FastMCP

from .assets import AssetLister
from .http_client import BackendClient


app = FastMCP("glitch-home-local-mcp")
client = BackendClient()
asset_lister = AssetLister()


@app.tool()
def health_check() -> Dict[str, Any]:
    """Check backend health (GET /health)."""
    return client.get("/health")


@app.tool()
def list_clients() -> Dict[str, Any]:
    """List connected frontend clients (GET /api/clients)."""
    return client.get("/api/clients")


@app.tool()
def list_assets(
    source: Literal["videos", "offspring_images", "generated_sounds"],
    limit: Optional[int] = 100,
    offset: int = 0,
    recursive: Optional[bool] = None,
    include_metadata: bool = True,
) -> Dict[str, Any]:
    """List curated asset folders (videos, offspring images, generated sounds).
    
    Args:
        source: Asset source type. Must be one of:
            - "videos": Video files from frontend/public/videos/圖像系譜學Video (served at /videos/圖像系譜學Video)
            - "offspring_images": Generated image files from backend/offspring_images (served at /generated_images)
            - "generated_sounds": Audio files from backend/generated_sounds (served at /generated_sounds)
        limit: Maximum number of assets to return (default: 100). Set to None to return all.
        offset: Number of assets to skip for pagination (default: 0).
        recursive: Whether to search subdirectories recursively (default: None, uses source-specific default).
            - "offspring_images" allows recursive search by default
            - "videos" and "generated_sounds" do not allow recursive search
        include_metadata: Whether to include metadata in the response (default: True).
            For images, includes JSON metadata if available. For videos/audio, metadata is currently not implemented.
    
    Returns:
        Dict with "ok" key indicating success/failure:
        - On success: {"ok": True, "data": [asset_entries]}
          Each asset entry contains:
          - name: File name (e.g., "offspring_20250923_172635_239.png")
          - relative_path: Path relative to repository root
          - relative_to_source: Path relative to source root
          - public_url: URL path for accessing the asset (e.g., "/generated_images/offspring_xxx.png")
          - category: Asset category ("image", "video", or "audio")
          - size_bytes: File size in bytes
          - modified_at: ISO format timestamp of last modification
          - mime_type: MIME type of the file
          - source: Source key (same as input source parameter)
          - metadata: Optional metadata dict (for images, includes JSON metadata if available)
        - On error: {"ok": False, "error": "error message"}
    
    Example:
        # List offspring images (commonly used for collage/iframe config)
        result = list_assets("offspring_images", limit=50)
        if result["ok"]:
            images = result["data"]
            # Use images[0]["name"] or images[0]["public_url"] in configs
        
        # List videos with pagination
        result = list_assets("videos", limit=20, offset=0)
    """
    try:
        assets = asset_lister.list_assets(
            source_key=source,
            limit=limit,
            offset=offset,
            recursive=recursive,
            include_metadata=include_metadata,
        )
        return {"ok": True, "data": assets}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Failed to list assets: {exc}"}


@app.tool()
def search_images_by_text(query: str, top_k: int = 10) -> Dict[str, Any]:
    """Search images using a natural-language query (POST /api/search/text).
    
    Args:
        query: Natural language search phrase (e.g., "抽象 霓虹夜景").
        top_k: Maximum number of matches to return (default: 10).
    
    Returns:
        Dict following backend search response with `matches` and metadata.
    """
    payload = {"query": query, "top_k": top_k}
    return client.post("/api/search/text", json_body=payload)


@app.tool()
def search_images_by_image(image_path: str, top_k: int = 10) -> Dict[str, Any]:
    """Search similar images using an existing image path (POST /api/search/image).
    
    Args:
        image_path: Repository-relative file path (e.g., "backend/offspring_images/foo.png").
        top_k: Maximum number of matches to return (default: 10).
    
    Returns:
        Dict following backend search response with `matches` and metadata.
    """
    payload = {"image_path": image_path, "top_k": top_k}
    return client.post("/api/search/image", json_body=payload)


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
