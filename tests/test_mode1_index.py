from cursor_vscdb.analyze.mode1_index import build_index, category_stats


def test_build_index_counts(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    stats = category_stats(index_path)
    by_cat = {s.category: s for s in stats}
    assert by_cat["bubbleId"].row_count == 3
    assert by_cat["bubbleId"].total_bytes == 3500
    assert by_cat["agentKv"].row_count == 1
