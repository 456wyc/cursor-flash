from cursor_flash.analyze.mode1_index import build_index
from cursor_flash.filter_engine import estimate_filter, matching_keys
from cursor_flash.models import Filter


def test_filter_by_category(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(categories=["bubbleId"])
    est = estimate_filter(index_path, f)
    assert est.row_count == 3
    assert est.total_bytes == 3500


def test_filter_by_composer(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(composer_ids=["comp-old"])
    keys = matching_keys(index_path, f)
    assert any(k.startswith("bubbleId:comp-old:") for k in keys)
    assert not any("comp-new" in k for k in keys if k.startswith("bubbleId:"))


def test_filter_older_than(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(older_than_ms=1_750_000_000_000, categories=["bubbleId"])
    est = estimate_filter(index_path, f)
    assert est.row_count == 2  # only comp-old bubbles
