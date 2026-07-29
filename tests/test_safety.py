import pytest

from cursor_vscdb.backup import backup_file
from cursor_vscdb.models import SafetyLevel
from cursor_vscdb.safety import SafetyError, assert_can_write


def test_level_b_blocks_when_cursor_running(monkeypatch):
    monkeypatch.setattr("cursor_vscdb.safety.is_cursor_running", lambda: True)
    with pytest.raises(SafetyError):
        assert_can_write(SafetyLevel.B, backup_provided=True)


def test_level_b_allows_when_closed(monkeypatch):
    monkeypatch.setattr("cursor_vscdb.safety.is_cursor_running", lambda: False)
    assert_can_write(SafetyLevel.B, backup_provided=False)


def test_level_a_requires_backup(monkeypatch):
    monkeypatch.setattr("cursor_vscdb.safety.is_cursor_running", lambda: False)
    with pytest.raises(SafetyError):
        assert_can_write(SafetyLevel.A, backup_provided=False)


def test_backup_copies(mini_db, tmp_path):
    dest_dir = tmp_path / "bak"
    out = backup_file(mini_db, dest_dir)
    assert out.exists()
    assert out.stat().st_size == mini_db.stat().st_size
