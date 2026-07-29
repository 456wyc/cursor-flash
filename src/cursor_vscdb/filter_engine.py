from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from cursor_vscdb.models import Filter


@dataclass
class FilterEstimate:
    row_count: int
    total_bytes: int


def _where(filter: Filter) -> tuple[str, list]:
    clauses: list[str] = []
    params: list = []
    if filter.categories:
        placeholders = ",".join("?" for _ in filter.categories)
        clauses.append(f"category IN ({placeholders})")
        params.extend(filter.categories)
    if filter.composer_ids:
        placeholders = ",".join("?" for _ in filter.composer_ids)
        clauses.append(f"composer_id IN ({placeholders})")
        params.extend(filter.composer_ids)
    if filter.older_than_ms is not None:
        if filter.include_unknown_time:
            clauses.append("(composer_last_updated_ms IS NULL OR composer_last_updated_ms < ?)")
        else:
            clauses.append("(composer_last_updated_ms IS NOT NULL AND composer_last_updated_ms < ?)")
        params.append(filter.older_than_ms)
    if filter.newer_than_ms is not None:
        if filter.include_unknown_time:
            clauses.append("(composer_last_updated_ms IS NULL OR composer_last_updated_ms > ?)")
        else:
            clauses.append("(composer_last_updated_ms IS NOT NULL AND composer_last_updated_ms > ?)")
        params.append(filter.newer_than_ms)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def estimate_filter(index_path: Path, filter: Filter) -> FilterEstimate:
    where, params = _where(filter)
    conn = sqlite3.connect(index_path)
    try:
        row = conn.execute(
            f"SELECT COUNT(*), COALESCE(SUM(size_bytes),0) FROM kv_meta{where}",
            params,
        ).fetchone()
        return FilterEstimate(row_count=row[0], total_bytes=row[1])
    finally:
        conn.close()


def matching_keys(index_path: Path, filter: Filter) -> list[str]:
    where, params = _where(filter)
    conn = sqlite3.connect(index_path)
    try:
        return [r[0] for r in conn.execute(f"SELECT key FROM kv_meta{where}", params)]
    finally:
        conn.close()
