import os
from typing import Iterable


def ensure_dirs(dirs: Iterable[str]) -> None:
    for d in dirs:
        os.makedirs(d, exist_ok=True)


