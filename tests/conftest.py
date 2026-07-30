from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest


def _create_mini_state_db(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
        conn.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
        conn.execute(
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
        # composer A (old), B (new)
        conn.execute(
            "INSERT INTO composerHeaders(composerId, workspaceId, createdAt, lastUpdatedAt, value) VALUES (?,?,?,?,?)",
            ("comp-old", "ws1", 1_700_000_000_000, 1_700_000_000_000, b"{}"),
        )
        conn.execute(
            "INSERT INTO composerHeaders(composerId, workspaceId, createdAt, lastUpdatedAt, value) VALUES (?,?,?,?,?)",
            ("comp-new", "ws1", 1_800_000_000_000, 1_800_000_000_000, b"{}"),
        )
        rows = [
            ("bubbleId:comp-old:b1", b"x" * 1000),
            ("bubbleId:comp-old:b2", b"y" * 2000),
            ("bubbleId:comp-new:b3", b"z" * 500),
            ("agentKv:blob:aaa", b"a" * 300),
            ("composerData:comp-old", b"c" * 100),
            ("composerData:comp-new", b"d" * 100),
        ]
        conn.executemany("INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)", rows)
        conn.execute(
            "INSERT INTO ItemTable(key, value) VALUES (?, ?)",
            ("some.setting", b"keep-me"),
        )
        conn.commit()
    finally:
        conn.close()
    return path


@pytest.fixture
def mini_db(tmp_path: Path) -> Path:
    return _create_mini_state_db(tmp_path / "state.vscdb")
