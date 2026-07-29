import sqlite3

from cursor_vscdb.db import connect_readonly, list_tables


def test_connect_readonly_lists_tables(mini_db):
    conn = connect_readonly(mini_db)
    try:
        tables = set(list_tables(conn))
        assert "cursorDiskKV" in tables
        assert "ItemTable" in tables
        assert "composerHeaders" in tables
    finally:
        conn.close()


def test_readonly_rejects_write(mini_db):
    conn = connect_readonly(mini_db)
    try:
        try:
            conn.execute("INSERT INTO ItemTable(key, value) VALUES ('a', 'b')")
            conn.commit()
            raised = False
        except sqlite3.Error:
            raised = True
        assert raised
    finally:
        conn.close()
