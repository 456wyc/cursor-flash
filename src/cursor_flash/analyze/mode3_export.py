from __future__ import annotations

import json
import shutil
from pathlib import Path

from cursor_flash.analyze.mode1_index import category_stats, composer_stats


def export_report(index_path: Path, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    cats = [s.__dict__ for s in category_stats(index_path)]
    comps = [s.__dict__ for s in composer_stats(index_path)]
    (out_dir / "categories.json").write_text(json.dumps(cats, indent=2), encoding="utf-8")
    (out_dir / "composers.json").write_text(json.dumps(comps, indent=2), encoding="utf-8")
    summary = {
        "source_index": str(index_path),
        "categories": cats,
        "composer_count": len(comps),
        "total_indexed_bytes": sum(c["total_bytes"] for c in cats),
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    shutil.copy2(index_path, out_dir / "index.sqlite")
    return out_dir
