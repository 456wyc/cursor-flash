from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from cursor_flash.analyze.mode1_index import category_stats, composer_detail, composer_stats
from cursor_flash.jobs import create_job, get_job, run_in_background
from cursor_flash.models import Filter, SafetyLevel
from cursor_flash.service import AppContext, apply_filter_copy, export, get_status, preview_clean, run_scan
from cursor_flash.web_static import resolve_web_dist


class FilterIn(BaseModel):
    categories: list[str] = Field(default_factory=list)
    composer_ids: list[str] = Field(default_factory=list)
    older_than_ms: int | None = None
    newer_than_ms: int | None = None
    cascade_headers: bool = False
    include_unknown_time: bool = False


def _mount_spa(app: FastAPI, dist: Path) -> None:
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    index = dist / "index.html"

    @app.get("/")
    def spa_index():
        return FileResponse(index)

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "not found")
        candidate = dist / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


def create_app(ctx: AppContext, *, serve_web: bool = True) -> FastAPI:
    app = FastAPI(title="cursor-flash")
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

    @app.get("/api/composers/{composer_id}")
    def composer_detail_api(composer_id: str, sample_limit: int = 30):
        if not ctx.index_path.exists():
            raise HTTPException(400, "index missing")
        detail = composer_detail(
            ctx.index_path,
            composer_id,
            source_db=ctx.db_path,
            sample_limit=max(0, min(sample_limit, 100)),
        )
        if detail is None:
            raise HTTPException(404, "composer not found in index")
        return {
            "composer_id": detail.composer_id,
            "name": detail.name,
            "subtitle": detail.subtitle,
            "workspace_id": detail.workspace_id,
            "unified_mode": detail.unified_mode,
            "created_at_ms": detail.created_at_ms,
            "last_updated_ms": detail.last_updated_ms,
            "row_count": detail.row_count,
            "total_bytes": detail.total_bytes,
            "categories": [c.__dict__ for c in detail.categories],
            "samples": [s.__dict__ for s in detail.samples],
        }

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

    if serve_web:
        dist = resolve_web_dist()
        if dist is not None:
            _mount_spa(app, dist)

    return app


def app_factory() -> FastAPI:
    from cursor_flash.paths import default_backup_dir, default_index_path, default_state_vscdb

    ctx = AppContext(
        db_path=default_state_vscdb(),
        index_path=default_index_path(),
        backup_dir=default_backup_dir(),
        safety_level=SafetyLevel.B,
    )
    return create_app(ctx)


app = app_factory()
