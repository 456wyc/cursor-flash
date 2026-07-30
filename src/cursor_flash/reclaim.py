from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path


def filter_copy_rebuild(
    source_db: Path,
    dest_db: Path,
    delete_keys: set[str],
    cascade_headers: bool = False,
    delete_composer_ids: set[str] | None = None,
) -> Path:
    dest_db.parent.mkdir(parents=True, exist_ok=True)
    if dest_db.exists():
        dest_db.unlink()
    src = sqlite3.connect(f"file:{source_db.as_posix()}?mode=ro", uri=True)
    dst = sqlite3.connect(dest_db)
    try:
        dst.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
        for key, value in src.execute("SELECT key, value FROM ItemTable"):
            dst.execute("INSERT INTO ItemTable(key, value) VALUES (?, ?)", (key, value))

        dst.execute(
            """
            CREATE TABLE composerHeaders (
              composerId TEXT PRIMARY KEY,
              workspaceId TEXT,
              createdAt INTEGER,
              lastUpdatedAt INTEGER,
              isArchived INTEGER,
              isSubagent INTEGER,
              recency REAL,
              checkpointAt INTEGER,
              value BLOB
            )
            """
        )
        delete_composer_ids = delete_composer_ids or set()
        for row in src.execute("SELECT * FROM composerHeaders"):
            composer_id = row[0]
            if cascade_headers and composer_id in delete_composer_ids:
                continue
            dst.execute(
                "INSERT INTO composerHeaders VALUES (?,?,?,?,?,?,?,?,?)",
                row,
            )

        dst.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
        for key, value in src.execute("SELECT key, value FROM cursorDiskKV"):
            if key in delete_keys:
                continue
            dst.execute(
                "INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)",
                (key, value),
            )
        dst.commit()
    finally:
        src.close()
        dst.close()
    return dest_db


def in_place_delete(db_path: Path, delete_keys: set[str]) -> int:
    conn = sqlite3.connect(db_path)
    try:
        keys = list(delete_keys)
        deleted = 0
        for i in range(0, len(keys), 500):
            chunk = keys[i : i + 500]
            placeholders = ",".join("?" for _ in chunk)
            cur = conn.execute(
                f"DELETE FROM cursorDiskKV WHERE key IN ({placeholders})",
                chunk,
            )
            deleted += cur.rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()


def vacuum_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("VACUUM")
    finally:
        conn.close()


def assert_enough_space_for_vacuum(db_path: Path, margin_ratio: float = 1.05) -> None:
    size = db_path.stat().st_size
    free = shutil.disk_usage(db_path.drive if db_path.drive else db_path.anchor).free
    if free < size * margin_ratio:
        raise RuntimeError(
            f"Not enough free space for VACUUM (need ~{size * margin_ratio:.0f} bytes, free {free})"
        )


def replace_db_atomic(original: Path, new_db: Path) -> Path:
    """Rename original aside, move new into place. Caller must ensure Cursor closed."""
    aside = original.with_suffix(original.suffix + ".pre-rebuild")
    n = 1
    while aside.exists():
        aside = original.with_suffix(original.suffix + f".pre-rebuild-{n}")
        n += 1
    original.rename(aside)
    try:
        shutil.move(str(new_db), str(original))
    except Exception:
        if not original.exists() and aside.exists():
            aside.rename(original)
        raise
    return aside
