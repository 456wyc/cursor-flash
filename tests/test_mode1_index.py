from pathlib import Path
import sqlite3

from cursor_flash.analyze.mode1_index import build_index, category_stats


def test_build_index_counts(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    stats = category_stats(index_path)
    by_cat = {s.category: s for s in stats}
    assert by_cat["bubbleId"].row_count == 3
    assert by_cat["bubbleId"].total_bytes == 3500
    assert by_cat["agentKv"].row_count == 1


def test_build_index_skips_null_keys(tmp_path: Path):
    """Real Cursor DBs can contain multiple NULL keys; scanning must not crash."""
    source = tmp_path / "state.vscdb"
    conn = sqlite3.connect(source)
    try:
        conn.execute(
            "CREATE TABLE cursorDiskKV (key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)"
        )
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
        conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
        conn.executemany(
            "INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)",
            [
                (None, b"a"),
                (None, b"b"),
                ("bubbleId:comp-x:b1", b"x" * 10),
                ("agentKv:blob:1", b"y" * 5),
            ],
        )
        conn.commit()
    finally:
        conn.close()

    index_path = tmp_path / "index.sqlite"
    build_index(source, index_path)
    stats = {s.category: s for s in category_stats(index_path)}
    assert stats["bubbleId"].row_count == 1
    assert stats["agentKv"].row_count == 1
