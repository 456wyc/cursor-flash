import json
from pathlib import Path

from cursor_flash.analyze.mode1_index import build_index, category_stats
from cursor_flash.analyze.mode2_live import sample_category_counts
from cursor_flash.analyze.mode3_export import export_report


def test_mode2_sample_counts(mini_db):
    counts = sample_category_counts(mini_db, limit_per_scan=1000)
    assert counts["bubbleId"] == 3


def test_mode3_export(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    out = tmp_path / "report"
    export_report(index_path, out)
    data = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert data["categories"][0]["category"]  # non-empty
    assert (out / "categories.json").exists()
