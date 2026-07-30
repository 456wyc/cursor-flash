from typer.testing import CliRunner

from cursor_flash.cli import app


def test_status(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_flash.service.is_cursor_running", lambda: False)
    runner = CliRunner()
    result = runner.invoke(
        app,
        ["status", "--db", str(mini_db), "--index", str(tmp_path / "index.sqlite")],
    )
    assert result.exit_code == 0
    assert "db:" in result.stdout
    assert str(mini_db) in result.stdout
