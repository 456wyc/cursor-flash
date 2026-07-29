from __future__ import annotations

import subprocess


def is_cursor_running() -> bool:
    # tasklist is available on Windows
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq Cursor.exe", "/NH"],
            text=True,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False
    return "Cursor.exe" in out
