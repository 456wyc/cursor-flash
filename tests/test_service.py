import pytest

from cursor_vscdb.models import Filter, SafetyLevel
from cursor_vscdb.service import AppContext, preview_clean, run_scan


def test_scan_and_preview(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_vscdb.service.is_cursor_running", lambda: False)
    ctx = AppContext(
        db_path=mini_db,
        index_path=tmp_path / "index.sqlite",
        backup_dir=tmp_path / "bak",
        safety_level=SafetyLevel.B,
    )
    run_scan(ctx)
    est = preview_clean(ctx, Filter(categories=["agentKv"]))
    assert est.row_count == 1


def test_preview_rejects_empty_filter(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_vscdb.service.is_cursor_running", lambda: False)
    ctx = AppContext(
        db_path=mini_db,
        index_path=tmp_path / "index.sqlite",
        backup_dir=tmp_path / "bak",
        safety_level=SafetyLevel.B,
    )
    run_scan(ctx)
    with pytest.raises(ValueError, match="empty filter"):
        preview_clean(ctx, Filter())
