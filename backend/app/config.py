import logging
import os
from dataclasses import dataclass, field
from typing import Optional


logger = logging.getLogger(__name__)


def _load_dotenv_if_present() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        logger.info("python-dotenv not installed; skipping .env loading")
        return
    # Try load from project root and backend dir to be flexible
    here = os.path.dirname(__file__)
    backend_dir = os.path.abspath(os.path.join(here, ".."))
    project_root = os.path.abspath(os.path.join(backend_dir, ".."))
    # Load root first, then backend/.env (later does not override earlier by default)
    for base_dir in (project_root, backend_dir):
        dotenv_path = os.path.join(base_dir, ".env")
        try:
            loaded = load_dotenv(dotenv_path=dotenv_path, override=False)
        except Exception as exc:
            logger.warning("Failed to load .env from %s: %s", dotenv_path, exc)
            raise
        if not loaded:
            logger.warning("No .env found at %s", dotenv_path)


_load_dotenv_if_present()


APP_MODE_CAPS: dict[str, dict[str, bool]] = {
    "STUDIO": {
        "enable_generation": True,
        "enable_metadata_write": True,
        "enable_asset_write": True,
        "enable_index_rebuild": True,
        "enable_analysis_llm": True,
    },
    "CONSOLE": {
        "enable_generation": False,
        "enable_metadata_write": True,
        "enable_asset_write": True,
        "enable_index_rebuild": False,
        "enable_analysis_llm": True,
    },
    "DISPLAY": {
        "enable_generation": False,
        "enable_metadata_write": False,
        "enable_asset_write": False,
        "enable_index_rebuild": False,
        "enable_analysis_llm": False,
    },
}


@dataclass
class Settings:
    app_mode_raw: str = os.getenv("APP_MODE", "STUDIO")
    app_mode: str = field(init=False)
    enable_generation: bool = field(init=False)
    enable_metadata_write: bool = field(init=False)
    enable_asset_write: bool = field(init=False)
    enable_index_rebuild: bool = field(init=False)
    enable_analysis_llm: bool = field(init=False)
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    elevenlabs_api_key: Optional[str] = os.getenv("ELEVENLABS_API_KEY")
    model_name: str = os.getenv("MODEL_NAME", "gemini-3-pro-image-preview")
    # Backward-compatible single dir
    genes_pool_dir: str = os.getenv("GENES_POOL_DIR", "genes_pool")
    # New: multiple dirs, comma-separated
    genes_pool_dirs_raw: Optional[str] = os.getenv("GENES_POOL_DIRS")
    offspring_dir: str = os.getenv("OFFSPRING_DIR", "backend/offspring_images")
    metadata_dir: str = os.getenv("METADATA_DIR", "backend/metadata")
    naration_metadata_dir: str = os.getenv("NARATION_METADATA_DIR", "backend/metadata/naration")
    camera_presets_file: str = os.getenv("CAMERA_PRESETS_FILE", "backend/metadata/camera_presets.json")
    screenshot_dir: str = os.getenv("SCREENSHOT_DIR", "screen_shots")
    generated_sounds_dir: str = os.getenv("GENERATED_SOUNDS_DIR", "backend/generated_sounds")
    nightwalk_assets_dir: Optional[str] = os.getenv("NIGHTWALK_ASSETS_DIR", "夜遊 - 毛刺")
    fixed_prompt: str = os.getenv(
        "FIXED_PROMPT",
        (
            "Study the provided images and identify their most distinctive subjects, forms, textures, colors, lighting, and spatial rhythms. "
            "Treat these as raw material and extend them into a new scene that feels like a natural continuation or variation of the originals, "
            "rather than a collage or copy. Reinterpret composition, perspective, and scale freely; you are not constrained to camera-accurate "
            "or strictly photorealistic rendering, as long as the key visual qualities and atmosphere remain recognizable. Avoid generic stock "
            "aesthetics; preserve idiosyncratic details, imperfections, and local character. Do not simply paste or overlay entire backgrounds; "
            "build a fresh arrangement that clearly grows out of the source images."
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

        mode_upper = (self.app_mode_raw or "STUDIO").strip().upper()
        if mode_upper not in APP_MODE_CAPS:
            raise ValueError(f"無效的 APP_MODE：{mode_upper}，允許值：{', '.join(APP_MODE_CAPS)}")
        self.app_mode = mode_upper
        caps = APP_MODE_CAPS[mode_upper]
        self.enable_generation = caps["enable_generation"]
        self.enable_metadata_write = caps["enable_metadata_write"]
        self.enable_asset_write = caps["enable_asset_write"]
        self.enable_index_rebuild = caps["enable_index_rebuild"]
        self.enable_analysis_llm = caps["enable_analysis_llm"]

        # Parse multiple dirs if provided; fallback to single dir
        if self.genes_pool_dirs_raw:
            dirs = [p.strip() for p in self.genes_pool_dirs_raw.split(",") if p.strip()]
            self.genes_pool_dirs = [resolve(p) for p in dirs]
        else:
            self.genes_pool_dirs = [resolve(self.genes_pool_dir)]

        self.genes_pool_dir = resolve(self.genes_pool_dir)
        self.offspring_dir = resolve(self.offspring_dir)
        self.metadata_dir = resolve(self.metadata_dir)
        self.naration_metadata_dir = resolve(self.naration_metadata_dir)
        self.camera_presets_file = resolve(self.camera_presets_file)
        self.screenshot_dir = resolve(self.screenshot_dir)
        self.generated_sounds_dir = resolve(self.generated_sounds_dir)
        self.chroma_db_path = resolve(self.chroma_db_path)
        if self.nightwalk_assets_dir:
            resolved = resolve(self.nightwalk_assets_dir)
            if os.path.isdir(resolved):
                self.nightwalk_assets_dir = resolved
            else:
                self.nightwalk_assets_dir = None

        self._warn_writable_dirs_if_readonly()
        self._warn_missing_keys()

    def _warn_writable_dirs_if_readonly(self) -> None:
        """提醒在唯讀模式下仍可寫入的目錄。"""
        if self.enable_asset_write and self.enable_metadata_write:
            return

        def is_writable(path: str) -> bool:
            try:
                return os.path.exists(path) and os.access(path, os.W_OK)
            except OSError:
                return False

        readonly_targets = []
        if not self.enable_metadata_write:
            readonly_targets.extend([self.metadata_dir, self.naration_metadata_dir, os.path.dirname(self.camera_presets_file)])
        if not self.enable_asset_write:
            readonly_targets.extend([self.offspring_dir, self.screenshot_dir, self.generated_sounds_dir])
        for target in readonly_targets:
            if target and is_writable(target):
                logger.warning("APP_MODE=%s 為唯讀配置，但目錄仍可寫入：%s（請考慮調整為唯讀掛載）", self.app_mode, target)

    def _warn_missing_keys(self) -> None:
        """在需要金鑰的模式下提示缺漏。"""
        if self.enable_generation and not self.gemini_api_key:
            logger.error("APP_MODE=%s 需要 GEMINI_API_KEY 以啟用生成功能，請在 .env 設定", self.app_mode)
        if self.enable_analysis_llm and not (self.gemini_api_key or self.openai_api_key):
            logger.warning(
                "APP_MODE=%s 已允許分析用 LLM，但缺少 GEMINI_API_KEY 與 OPENAI_API_KEY，相關功能將受限",
                self.app_mode,
            )
        if self.enable_asset_write and not (self.elevenlabs_api_key or self.openai_api_key):
            logger.warning(
                "APP_MODE=%s 已允許資產寫入，但缺少 ELEVENLABS_API_KEY/OPENAI_API_KEY，音效與 TTS 可能無法使用",
                self.app_mode,
            )



settings = Settings()
