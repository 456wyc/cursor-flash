from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from cursor_vscdb.analyze.mode1_index import category_stats, composer_stats
from cursor_vscdb.models import Filter, SafetyLevel
from cursor_vscdb.paths import default_backup_dir, default_index_path, default_state_vscdb
from cursor_vscdb.service import AppContext, apply_filter_copy, export, get_status, preview_clean, run_scan

app = typer.Typer(add_completion=False, help="Cursor state.vscdb manager")


def _ctx(
    db: Optional[Path],
    index: Optional[Path],
    backup_dir: Optional[Path],
    safety: SafetyLevel = SafetyLevel.B,
) -> AppContext:
    return AppContext(
        db_path=db or default_state_vscdb(),
        index_path=index or default_index_path(),
        backup_dir=backup_dir or default_backup_dir(),
        safety_level=safety,
    )


@app.command()
def status(
    db: Optional[Path] = typer.Option(None, help="Path to state.vscdb"),
    index: Optional[Path] = typer.Option(None),
):
    s = get_status(_ctx(db, index, None))
    typer.echo(f"db: {s.db_path}")
    typer.echo(f"size: {s.size_bytes / (1024**3):.2f} GB")
    typer.echo(f"cursor_running: {s.cursor_running}")
    typer.echo(f"index_stale: {s.index_stale}")


@app.command()
def scan(
    db: Optional[Path] = None,
    index: Optional[Path] = None,
):
    ctx = _ctx(db, index, None)

    def cb(n):
        typer.echo(f"scanned {n}")

    run_scan(ctx, progress_cb=cb)
    typer.echo(f"index written: {ctx.index_path}")


@app.command("list")
def list_cmd(
    what: str = typer.Argument("categories"),
    db: Optional[Path] = None,
    index: Optional[Path] = None,
):
    ctx = _ctx(db, index, None)
    if what == "categories":
        for s in category_stats(ctx.index_path):
            typer.echo(f"{s.category}\t{s.row_count}\t{s.total_bytes}")
    elif what == "composers":
        for s in composer_stats(ctx.index_path):
            typer.echo(f"{s.composer_id}\t{s.row_count}\t{s.total_bytes}")
    else:
        raise typer.BadParameter("what must be categories|composers")


@app.command("export-report")
def export_report_cmd(out: Path, db: Optional[Path] = None, index: Optional[Path] = None):
    path = export(_ctx(db, index, None), out)
    typer.echo(path)


@app.command()
def clean(
    preview: bool = typer.Option(False, "--preview"),
    apply: bool = typer.Option(False, "--apply"),
    categories: Optional[str] = typer.Option(None, help="comma-separated"),
    composers: Optional[str] = typer.Option(None, help="comma-separated"),
    older_than_ms: Optional[int] = None,
    dest: Optional[Path] = typer.Option(None, help="new db path for rebuild"),
    replace: bool = typer.Option(False, "--replace"),
    db: Optional[Path] = None,
    index: Optional[Path] = None,
    backup_dir: Optional[Path] = None,
):
    ctx = _ctx(db, index, backup_dir)
    f = Filter(
        categories=[c.strip() for c in categories.split(",")] if categories else [],
        composer_ids=[c.strip() for c in composers.split(",")] if composers else [],
        older_than_ms=older_than_ms,
    )
    if preview or not apply:
        est = preview_clean(ctx, f)
        typer.echo(f"rows={est.row_count} bytes={est.total_bytes}")
        if not apply:
            return
    if not dest:
        raise typer.BadParameter("--dest required for --apply (filter-copy target)")
    result = apply_filter_copy(ctx, f, dest, do_backup=True, replace_original=replace)
    typer.echo(result)


if __name__ == "__main__":
    app()
