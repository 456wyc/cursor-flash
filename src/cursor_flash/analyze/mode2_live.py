from __future__ import annotations

from collections import Counter
from pathlib import Path

from cursor_flash.catalog import categorize_key
from cursor_flash.db import connect_readonly


def sample_category_counts(source_db: Path, limit_per_scan: int = 50_000) -> dict[str, int]:
    conn = connect_readonly(source_db)
    try:
        c: Counter[str] = Counter()
        n = 0
        for (key,) in conn.execute("SELECT key FROM cursorDiskKV"):
            c[categorize_key(str(key)).category] += 1
            n += 1
            if n >= limit_per_scan:
                break
        return dict(c)
    finally:
        conn.close()
