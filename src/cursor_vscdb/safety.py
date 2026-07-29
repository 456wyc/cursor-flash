from __future__ import annotations

from cursor_vscdb.models import SafetyLevel
from cursor_vscdb.process_win import is_cursor_running


class SafetyError(RuntimeError):
    pass


def assert_can_write(
    level: SafetyLevel,
    backup_provided: bool,
    allow_hot_write: bool = False,
) -> None:
    running = is_cursor_running()
    if level == SafetyLevel.C and allow_hot_write:
        return
    if running:
        raise SafetyError("Cursor.exe is running; close Cursor before write operations")
    if level == SafetyLevel.A and not backup_provided:
        raise SafetyError("Safety level A requires a backup before write")
