from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cursor_vscdb.analyze.mode1_index import category_stats, composer_stats
from cursor_vscdb.jobs import create_job, get_job, run_in_background
from cursor_vscdb.models import Filter, SafetyLevel
from cursor_vscdb.service import AppContext, apply_filter_copy, export, get_status, preview_clean, run_scan


class FilterIn(BaseModel):
    categories: list[str] = Field(default_factory=list)
    composer_ids: list[str] = Field(default_factory=list)
    older_than_ms: int | None = None
    newer_than_ms: int | None = None
    cascade_headers: bool = False
    include_unknown_time: bool = False


def create_app(ctx: AppContext) -> FastAPI:
    app = FastAPI(title="cursor-vscdb")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/status")
    def status():
        s = get_status(ctx)
        return {
            "db_path": str(s.db_path),
            "size_bytes": s.size_bytes,
            "exists": s.exists,
            "cursor_running": s.cursor_running,
            "safety_level": s.safety_level.value,
            "index_path": str(s.index_path) if s.index_path else None,
            "index_stale": s.index_stale,
        }

    @app.post("/api/scan")
    def scan():
        job = create_job("scan")

        def _run(j):
            def cb(n):
                j.progress = float(n)
                j.message = f"scanned {n}"

            run_scan(ctx, progress_cb=cb)

        run_in_background(job, _run)
        return {"job_id": job.id}

    @app.get("/api/jobs/{job_id}")
    def job(job_id: str):
        j = get_job(job_id)
        if not j:
            raise HTTPException(404, "job not found")
        return {
            "id": j.id,
            "kind": j.kind,
            "status": j.status,
            "progress": j.progress,
            "message": j.message,
            "error": j.error,
            "result": j.result,
        }

    @app.get("/api/stats/categories")
    def stats_categories():
        if not ctx.index_path.exists():
            raise HTTPException(400, "index missing")
        return [s.__dict__ for s in category_stats(ctx.index_path)]

    @app.get("/api/stats/composers")
    def stats_composers():
        if not ctx.index_path.exists():
            raise HTTPException(400, "index missing")
        return [s.__dict__ for s in composer_stats(ctx.index_path)]

    @app.post("/api/clean/preview")
    def clean_preview(body: FilterIn):
        f = Filter(**body.model_dump())
        est = preview_clean(ctx, f)
        return {"row_count": est.row_count, "total_bytes": est.total_bytes}

    @app.post("/api/export")
    def export_api(out_dir: str):
        path = export(ctx, Path(out_dir))
        return {"out_dir": str(path)}

    @app.post("/api/reclaim/rebuild")
    def rebuild(body: FilterIn, dest_db: str, replace_original: bool = False, do_backup: bool = True):
        job = create_job("rebuild")

        def _run(j):
            j.result = apply_filter_copy(
                ctx,
                Filter(**body.model_dump()),
                Path(dest_db),
                do_backup=do_backup,
                replace_original=replace_original,
            )

        run_in_background(job, _run)
        return {"job_id": job.id}

    return app


def app_factory() -> FastAPI:
    from cursor_vscdb.paths import default_backup_dir, default_index_path, default_state_vscdb

    ctx = AppContext(
        db_path=default_state_vscdb(),
        index_path=default_index_path(),
        backup_dir=default_backup_dir(),
        safety_level=SafetyLevel.B,
    )
    return create_app(ctx)


app = app_factory()
