from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from cursor_flash.analyze.mode1_index import build_index, is_index_stale
from cursor_flash.analyze.mode3_export import export_report
from cursor_flash.backup import backup_file
from cursor_flash.db import file_size
from cursor_flash.filter_engine import FilterEstimate, estimate_filter, matching_keys
from cursor_flash.models import DbStatus, Filter, SafetyLevel
from cursor_flash.process_win import is_cursor_running
from cursor_flash.reclaim import filter_copy_rebuild, replace_db_atomic
from cursor_flash.safety import assert_can_write


@dataclass
class AppContext:
    db_path: Path
    index_path: Path
    backup_dir: Path
    safety_level: SafetyLevel = SafetyLevel.B


def get_status(ctx: AppContext) -> DbStatus:
    return DbStatus(
        db_path=ctx.db_path,
        size_bytes=file_size(ctx.db_path),
        exists=ctx.db_path.exists(),
        cursor_running=is_cursor_running(),
        safety_level=ctx.safety_level,
        index_path=ctx.index_path if ctx.index_path.exists() else None,
        index_stale=is_index_stale(ctx.db_path, ctx.index_path),
    )


def run_scan(ctx: AppContext, progress_cb=None) -> None:
    build_index(ctx.db_path, ctx.index_path, progress_cb=progress_cb)


def filter_has_criteria(filter: Filter) -> bool:
    return bool(
        filter.categories
        or filter.composer_ids
        or filter.older_than_ms is not None
        or filter.newer_than_ms is not None
    )


def preview_clean(ctx: AppContext, filter: Filter) -> FilterEstimate:
    if not ctx.index_path.exists():
        raise FileNotFoundError("Index missing; run scan first")
    if not filter_has_criteria(filter):
        raise ValueError("Refusing empty filter; select category, composer, and/or time range")
    return estimate_filter(ctx.index_path, filter)


def apply_filter_copy(
    ctx: AppContext,
    filter: Filter,
    dest_db: Path,
    do_backup: bool = True,
    replace_original: bool = False,
) -> dict:
    if not filter_has_criteria(filter):
        raise ValueError("Refusing empty filter; select category, composer, and/or time range")
    # Gate writes first (Level A requires do_backup=True)
    assert_can_write(ctx.safety_level, backup_provided=do_backup)
    backup_path = None
    if do_backup:
        backup_path = backup_file(ctx.db_path, ctx.backup_dir)
    keys = set(matching_keys(ctx.index_path, filter))
    composer_ids = set(filter.composer_ids)
    filter_copy_rebuild(
        ctx.db_path,
        dest_db,
        delete_keys=keys,
        cascade_headers=filter.cascade_headers,
        delete_composer_ids=composer_ids if filter.cascade_headers else set(),
    )
    aside = None
    if replace_original:
        aside = replace_db_atomic(ctx.db_path, dest_db)
    return {
        "deleted_keys": len(keys),
        "backup_path": str(backup_path) if backup_path else None,
        "dest_db": str(dest_db),
        "aside": str(aside) if aside else None,
    }


def export(ctx: AppContext, out_dir: Path) -> Path:
    if not ctx.index_path.exists():
        raise FileNotFoundError("Index missing; run scan first")
    return export_report(ctx.index_path, out_dir)
