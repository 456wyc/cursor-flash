"""Copy web/dist into the Python package for desktop packaging."""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web" / "dist"
DST = ROOT / "src" / "cursor_flash" / "web_dist"


def main() -> None:
    if not (SRC / "index.html").is_file():
        raise SystemExit(
            f"Missing {SRC / 'index.html'}. Run: cd web && npm run build"
        )
    if DST.exists():
        shutil.rmtree(DST)
    shutil.copytree(SRC, DST)
    print(f"Synced {SRC} -> {DST}")


if __name__ == "__main__":
    main()
