from cursor_flash.analyze.mode1_index import build_index, composer_detail


def test_composer_detail_breakdown(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    detail = composer_detail(index_path, "comp-old", source_db=mini_db)
    assert detail is not None
    assert detail.composer_id == "comp-old"
    by_cat = {c.category: c for c in detail.categories}
    assert by_cat["bubbleId"].row_count == 2
    assert by_cat["composerData"].row_count == 1
    assert detail.samples


def test_composer_detail_missing(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    assert composer_detail(index_path, "no-such") is None
