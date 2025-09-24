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
    model_name: str = os.getenv("MODEL_NAME", "gemini-2.5-flash-image-preview")
    # Backward-compatible single dir
    genes_pool_dir: str = os.getenv("GENES_POOL_DIR", "genes_pool")
    # New: multiple dirs, comma-separated
    genes_pool_dirs_raw: Optional[str] = os.getenv("GENES_POOL_DIRS")
    offspring_dir: str = os.getenv("OFFSPRING_DIR", "backend/offspring_images")
    metadata_dir: str = os.getenv("METADATA_DIR", "backend/metadata")
    fixed_prompt: str = os.getenv(
        "FIXED_PROMPT",
        (
            "Blend the salient subjects, forms, and textures from all provided images into one coherent scene. "
            "Render as photorealistic large-format bellows camera (4x5/8x10) photography: precise perspective control (tilt/shift), "
            "shallow depth of field when appropriate, high micro-contrast, fine film grain, natural color science, rich dynamic range, "
            "realistic lighting, optical falloff and lens bokeh. Maintain consistent geometry and scale; unify textures and palette; "
            "present as a single shot (not a collage); avoid painterly or digital-art looks."
        ),
    )
    # Resize input images before sending to model to reduce flaky errors due to size limits
    image_size: int = int(os.getenv("IMAGE_SIZE", "1024"))

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


settings = Settings()
