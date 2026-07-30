from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path


def backup_file(source: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = dest_dir / f"{source.name}.backup-{ts}"
    shutil.copy2(source, dest)
    return dest
