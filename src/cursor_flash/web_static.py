from __future__ import annotations

from pathlib import Path


def resolve_web_dist() -> Path | None:
    """Locate built React assets for desktop / production serve."""
    candidates = [
        Path(__file__).resolve().parent / "web_dist",
        Path(__file__).resolve().parents[2] / "web" / "dist",  # repo: src/../web/dist
        Path.cwd() / "web" / "dist",
    ]
    for path in candidates:
        if (path / "index.html").is_file():
            return path
    return None
