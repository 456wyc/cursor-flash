from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass
from typing import Any, Callable


@dataclass
class Job:
    id: str
    kind: str
    status: str = "pending"  # pending|running|done|error
    progress: float = 0.0
    message: str = ""
    result: Any = None
    error: str | None = None


_lock = threading.Lock()
_jobs: dict[str, Job] = {}


def create_job(kind: str) -> Job:
    job = Job(id=str(uuid.uuid4()), kind=kind)
    with _lock:
        _jobs[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)


def run_in_background(job: Job, fn: Callable[[Job], None]) -> None:
    def _wrap() -> None:
        job.status = "running"
        try:
            fn(job)
            job.status = "done"
        except Exception as e:  # noqa: BLE001 — surface to client
            job.status = "error"
            job.error = str(e)

    threading.Thread(target=_wrap, daemon=True).start()
