import os
from dataclasses import dataclass
from typing import Optional


def _load_dotenv_if_present() -> None:
    try:
        from dotenv import load_dotenv
    except Exception:
        return
    # Try load from project root and backend dir to be flexible
    here = os.path.dirname(__file__)
    backend_dir = os.path.abspath(os.path.join(here, ".."))
    project_root = os.path.abspath(os.path.join(backend_dir, ".."))
    # Load root first, then backend/.env (later does not override earlier by default)
    load_dotenv(dotenv_path=os.path.join(project_root, ".env"), override=False)
    load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"), override=False)


_load_dotenv_if_present()


@dataclass
class Settings:
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    elevenlabs_api_key: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
    model_name: str = os.getenv("MODEL_NAME", "gemini-2.5-flash-image-preview")
    # Backward-compatible single dir
    genes_pool_dir: str = os.getenv("GENES_POOL_DIR", "genes_pool")
    # New: multiple dirs, comma-separated
    genes_pool_dirs_raw: Optional[str] = os.getenv("GENES_POOL_DIRS")
    offspring_dir: str = os.getenv("OFFSPRING_DIR", "backend/offspring_images")
    metadata_dir: str = os.getenv("METADATA_DIR", "backend/metadata")
    camera_presets_file: str = os.getenv("CAMERA_PRESETS_FILE", "backend/metadata/camera_presets.json")
    screenshot_dir: str = os.getenv("SCREENSHOT_DIR", "screen_shots")
    generated_sounds_dir: str = os.getenv("GENERATED_SOUNDS_DIR", "backend/generated_sounds")
    fixed_prompt: str = os.getenv(
        "FIXED_PROMPT",
        (
            "Extract the most distinctive subjects, forms, textures, and lighting cues from the provided images and recombine them "
            "into a freshly composed scene. Build a new layout from scratch—do not preserve or layer whole backgrounds; reinterpret "
            "placement, perspective, and scale so every element feels re-staged rather than pasted. Render as photorealistic "
            "large-format bellows camera (4x5/8x10) photography: precise perspective control (tilt/shift), shallow depth of field when "
            "appropriate, high micro-contrast, fine film grain, natural color science, rich dynamic range, realistic lighting, optical "
            "falloff and lens bokeh. Maintain consistent geometry and palette; keep it a single photographic exposure—no painterly "
            "stylization or obvious digital compositing artifacts."
        ),
    )
    # Resize input images before sending to model to reduce flaky errors due to size limits
    image_size: int = int(os.getenv("IMAGE_SIZE", "1024"))

    # Embeddings / Vector store
    google_text_embedding_model: str = os.getenv("GOOGLE_EMBEDDING_MODEL", "text-embedding-004")
    google_image_embedding_model: str = os.getenv("GOOGLE_IMAGE_EMBEDDING_MODEL", "multimodalembedding")
    chroma_db_path: str = os.getenv("CHROMA_DB_PATH", "backend/chroma_db")
    chroma_collection_images: str = os.getenv("CHROMA_COLLECTION_IMAGES", "offspring_images")
    chroma_collection_text: str = os.getenv("CHROMA_COLLECTION_TEXT", "text_queries")
    # Optional: use Vertex AI instead of Google AI API (AI Studio)
    genai_use_vertex: bool = os.getenv("GENAI_USE_VERTEX", "false").lower() in {"1", "true", "yes"}
    vertex_project: Optional[str] = os.getenv("VERTEX_PROJECT")
    vertex_location: Optional[str] = os.getenv("VERTEX_LOCATION")
    # Enable direct image embedding attempts (requires Vertex + supported model)
    enable_image_embedding: bool = os.getenv("ENABLE_IMAGE_EMBEDDING", "false").lower() in {"1", "true", "yes"}

    # OpenAI API
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    openai_embedding_model: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
    openai_vision_model: str = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")
    # TTS defaults
    openai_tts_model: str = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
    openai_tts_voice: str = os.getenv("OPENAI_TTS_VOICE", "alloy")
    openai_tts_format: str = os.getenv("OPENAI_TTS_FORMAT", "mp3")

    def __post_init__(self) -> None:
        # Resolve relative paths against project root to allow using
        # paths like "夜遊 - 毛刺/AI生成靜態影像" regardless of cwd.
        here = os.path.dirname(__file__)
        backend_dir = os.path.abspath(os.path.join(here, ".."))
        project_root = os.path.abspath(os.path.join(backend_dir, ".."))

        def resolve(p: str) -> str:
            p_expanded = os.path.expanduser(p)
            if os.path.isabs(p_expanded):
                return p_expanded
            return os.path.abspath(os.path.join(project_root, p_expanded))

        # Parse multiple dirs if provided; fallback to single dir
        if self.genes_pool_dirs_raw:
            dirs = [p.strip() for p in self.genes_pool_dirs_raw.split(",") if p.strip()]
            self.genes_pool_dirs = [resolve(p) for p in dirs]
        else:
            self.genes_pool_dirs = [resolve(self.genes_pool_dir)]

        self.genes_pool_dir = resolve(self.genes_pool_dir)
        self.offspring_dir = resolve(self.offspring_dir)
        self.metadata_dir = resolve(self.metadata_dir)
        self.camera_presets_file = resolve(self.camera_presets_file)
        self.screenshot_dir = resolve(self.screenshot_dir)
        self.generated_sounds_dir = resolve(self.generated_sounds_dir)
        self.chroma_db_path = resolve(self.chroma_db_path)


settings = Settings()
