from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path


class SafetyLevel(str, Enum):
    A = "A"
    B = "B"
    C = "C"


@dataclass
class Filter:
    categories: list[str] = field(default_factory=list)
    composer_ids: list[str] = field(default_factory=list)
    older_than_ms: int | None = None
    newer_than_ms: int | None = None
    cascade_headers: bool = False
    include_unknown_time: bool = False


@dataclass
class DbStatus:
    db_path: Path
    size_bytes: int
    exists: bool
    cursor_running: bool
    safety_level: SafetyLevel
    index_path: Path | None
    index_stale: bool
