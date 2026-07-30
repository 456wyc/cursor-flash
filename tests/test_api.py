import time

from fastapi.testclient import TestClient

from cursor_vscdb.api.app import create_app
from cursor_vscdb.models import SafetyLevel
from cursor_vscdb.service import AppContext


def test_status_and_scan(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_vscdb.service.is_cursor_running", lambda: False)
    monkeypatch.setattr("cursor_vscdb.process_win.is_cursor_running", lambda: False)
    ctx = AppContext(
        db_path=mini_db,
        index_path=tmp_path / "index.sqlite",
        backup_dir=tmp_path / "bak",
        safety_level=SafetyLevel.B,
    )
    client = TestClient(create_app(ctx, serve_web=False))
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json()["exists"] is True
    r = client.post("/api/scan")
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    j = None
    for _ in range(50):
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("done", "error"):
            break
        time.sleep(0.05)
    assert j is not None
    assert j["status"] == "done"
    cats = client.get("/api/stats/categories").json()
    assert any(c["category"] == "bubbleId" for c in cats)
