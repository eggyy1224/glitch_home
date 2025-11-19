from datetime import datetime
from pathlib import Path

from PIL import Image

from app.services.image_outputs import DefaultImagePreprocessor, LocalOutputWriter


def _make_image(path: Path, size=(400, 200)):
    Image.new("RGB", size, (0, 128, 255)).save(path)


def test_preprocessor_collects_metadata(tmp_path):
    parents = []
    for idx in range(2):
        path = tmp_path / f"parent_{idx}.png"
        _make_image(path, size=(256 + idx * 10, 128 + idx * 5))
        parents.append(str(path))

    preprocessor = DefaultImagePreprocessor()
    images, details = preprocessor.prepare(parents)

    assert len(images) == 2
    assert details[0]["name"] == "parent_0.png"
    assert "x" in details[0]["dimensions"]


def test_output_writer_resizes_and_writes(tmp_path):
    img = Image.new("RGB", (800, 400), (255, 0, 0))
    writer = LocalOutputWriter(
        output_dir=str(tmp_path),
        timestamp_factory=lambda: datetime(2024, 1, 1, 12, 0, 0),
        filename_builder=lambda fmt, ts: f"result.{fmt}",
    )

    output_path, fmt, width, height = writer.write(
        img,
        output_format="png",
        output_width=200,
        output_height=200,
        output_max_side=None,
        resize_mode="fit",
        input_details=[{"name": "parent.png", "dimensions": "10x10", "file_size": "1KB"}],
    )

    saved_path = Path(output_path)
    assert saved_path.exists()
    assert fmt == "png"
    assert (width, height) == (200, 200)
