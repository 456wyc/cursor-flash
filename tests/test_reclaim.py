import sqlite3
from pathlib import Path

from cursor_vscdb.analyze.mode1_index import build_index
from cursor_vscdb.filter_engine import matching_keys
from cursor_vscdb.models import Filter
from cursor_vscdb.reclaim import filter_copy_rebuild, in_place_delete


def test_filter_copy_removes_selected(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(categories=["bubbleId"], composer_ids=["comp-old"])
    delete_keys = set(matching_keys(index_path, f))
    new_db = tmp_path / "new" / "state.vscdb"
    filter_copy_rebuild(mini_db, new_db, delete_keys=delete_keys, cascade_headers=False)
    conn = sqlite3.connect(new_db)
    try:
        keys = {r[0] for r in conn.execute("SELECT key FROM cursorDiskKV")}
        assert "bubbleId:comp-old:b1" not in keys
        assert "bubbleId:comp-new:b3" in keys
        assert "agentKv:blob:aaa" in keys
        setting = conn.execute(
            "SELECT value FROM ItemTable WHERE key='some.setting'"
        ).fetchone()
        assert setting[0] == b"keep-me"
    finally:
        conn.close()


def test_in_place_delete_removes_keys(mini_db):
    index_path = mini_db.parent / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(categories=["bubbleId"], composer_ids=["comp-old"])
    delete_keys = set(matching_keys(index_path, f))
    deleted = in_place_delete(mini_db, delete_keys)
    assert deleted == len(delete_keys)
    conn = sqlite3.connect(mini_db)
    try:
        keys = {r[0] for r in conn.execute("SELECT key FROM cursorDiskKV")}
        assert "bubbleId:comp-old:b1" not in keys
        assert "bubbleId:comp-new:b3" in keys
    finally:
        conn.close()
