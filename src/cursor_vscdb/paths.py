from __future__ import annotations

import os
from pathlib import Path


def default_state_vscdb() -> Path:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA not set; Windows required for default path")
    return Path(appdata) / "Cursor" / "User" / "globalStorage" / "state.vscdb"


def default_tool_dir() -> Path:
    # Prefer non-C if E: exists
    e = Path("E:/cursor-vscdb-tool")
    if Path("E:/").exists():
        return e
    local = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return Path(local) / "cursor-vscdb-tool"


def default_index_path() -> Path:
    return default_tool_dir() / "index.sqlite"


def default_backup_dir() -> Path:
    return default_tool_dir() / "backups"
