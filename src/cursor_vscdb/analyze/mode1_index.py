from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from cursor_vscdb.catalog import categorize_key
from cursor_vscdb.db import connect_readonly


@dataclass
class CategoryStat:
    category: str
    row_count: int
    total_bytes: int


def build_index(source_db: Path, index_path: Path, progress_cb=None) -> None:
    index_path.parent.mkdir(parents=True, exist_ok=True)
    if index_path.exists():
        index_path.unlink()
    src = connect_readonly(source_db)
    idx = sqlite3.connect(index_path)
    try:
        idx.execute(
            """
            CREATE TABLE kv_meta (
              key TEXT PRIMARY KEY,
              category TEXT NOT NULL,
              composer_id TEXT,
              size_bytes INTEGER NOT NULL
            )
            """
        )
        idx.execute(
            """
            CREATE TABLE meta (
              k TEXT PRIMARY KEY,
              v TEXT NOT NULL
            )
            """
        )
        idx.execute(
            "INSERT INTO meta(k,v) VALUES ('source_size', ?), ('source_mtime_ns', ?)",
            (str(source_db.stat().st_size), str(source_db.stat().st_mtime_ns)),
        )
        idx.execute("CREATE INDEX ix_kv_category ON kv_meta(category)")
        idx.execute("CREATE INDEX ix_kv_composer ON kv_meta(composer_id)")
        batch: list[tuple] = []
        n = 0
        for key, size in src.execute("SELECT key, length(value) FROM cursorDiskKV"):
            info = categorize_key(str(key))
            batch.append((info.key, info.category, info.composer_id, int(size or 0)))
            n += 1
            if len(batch) >= 5000:
                idx.executemany(
                    "INSERT INTO kv_meta(key, category, composer_id, size_bytes) VALUES (?,?,?,?)",
                    batch,
                )
                idx.commit()
                batch.clear()
                if progress_cb:
                    progress_cb(n)
        if batch:
            idx.executemany(
                "INSERT INTO kv_meta(key, category, composer_id, size_bytes) VALUES (?,?,?,?)",
                batch,
            )
            idx.commit()
        if progress_cb:
            progress_cb(n)
    finally:
        src.close()
        idx.close()


def category_stats(index_path: Path) -> list[CategoryStat]:
    conn = sqlite3.connect(index_path)
    try:
        rows = conn.execute(
            """
            SELECT category, COUNT(*), COALESCE(SUM(size_bytes),0)
            FROM kv_meta GROUP BY category ORDER BY SUM(size_bytes) DESC
            """
        ).fetchall()
        return [CategoryStat(category=r[0], row_count=r[1], total_bytes=r[2]) for r in rows]
    finally:
        conn.close()


def is_index_stale(source_db: Path, index_path: Path) -> bool:
    if not index_path.exists() or not source_db.exists():
        return True
    conn = sqlite3.connect(index_path)
    try:
        try:
            rows = dict(conn.execute("SELECT k,v FROM meta").fetchall())
        except sqlite3.Error:
            return True
    finally:
        conn.close()
    try:
        return (
            rows.get("source_size") != str(source_db.stat().st_size)
            or rows.get("source_mtime_ns") != str(source_db.stat().st_mtime_ns)
        )
    except OSError:
        return True
