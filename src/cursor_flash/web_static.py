from __future__ import annotations

import sys
from pathlib import Path


def resolve_web_dist() -> Path | None:
    """Locate built React assets for desktop / production serve."""
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
        candidates.extend(
            [
                meipass / "cursor_flash" / "web_dist",
                meipass / "web_dist",
                Path(sys.executable).resolve().parent / "web_dist",
            ]
        )
    package_dir = Path(__file__).resolve().parent
    candidates.extend(
        [
            package_dir / "web_dist",
            package_dir.parents[2] / "web" / "dist",  # repo root / web / dist
            Path.cwd() / "web" / "dist",
        ]
    )
    for path in candidates:
        if (path / "index.html").is_file():
            return path
    return None
