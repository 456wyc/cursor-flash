# Cursor Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python Core + FastAPI + React + Typer CLI tool to inspect Cursor `state.vscdb`, filter by category/composer/time, and reclaim disk space via cross-disk filter-copy rebuild (default) or in-place DELETE+VACUUM.

**Architecture:** Shared `cursor_flash` Core exposes catalog, analyze (Mode1 index / Mode2 live / Mode3 export), filter, safety, backup, and reclaim. FastAPI and Typer call the same service functions. React talks only to the API. Long work uses in-process jobs polled by id.

**Tech Stack:** Python 3.11+, sqlite3, FastAPI, Uvicorn, Typer, pytest; React + Vite + TypeScript; Windows-first paths/process checks.

**Spec:** `docs/superpowers/specs/2026-07-30-cursor-flash-design.md`

---

## File Structure

```text
cursor-flash/
  pyproject.toml
  README.md
  .gitignore
  src/cursor_flash/
    __init__.py
    catalog.py          # key prefix → category + risk
    models.py           # Filter, Status, Stats dataclasses
    paths.py            # default state.vscdb / config / index dirs
    db.py               # connect readonly/write, table helpers
    process_win.py      # detect Cursor.exe running
    safety.py           # safety levels + gate
    analyze/
      __init__.py
      mode1_index.py    # scan → index sqlite
      mode2_live.py     # live queries without index
      mode3_export.py   # export report package
    filter_engine.py    # Filter → match keys / estimates (uses index)
    backup.py
    reclaim.py          # filter-copy rebuild + in-place delete/vacuum
    jobs.py             # in-memory job registry
    service.py          # facade used by API + CLI
    api/app.py          # FastAPI
    cli.py              # Typer
  web/                  # Vite React TS
    package.json
    vite.config.ts
    src/main.tsx
    src/App.tsx
    src/api.ts
    src/pages/*.tsx
  tests/
    conftest.py         # synthetic mini state.vscdb fixture
    test_catalog.py
    test_filter_engine.py
    test_mode1_index.py
    test_safety.py
    test_reclaim.py
    test_api.py
```

---

### Task 1: Scaffold project

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `src/cursor_flash/__init__.py`
- Create: `README.md`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create `pyproject.toml`**

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "cursor-flash"
version = "0.1.0"
description = "Inspect and selectively reclaim Cursor state.vscdb disk space"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.32.0",
  "typer>=0.12.0",
  "pydantic>=2.0",
  "pydantic-settings>=2.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "httpx>=0.27"]

[project.scripts]
cursor-flash = "cursor_flash.cli:app"

[tool.hatch.build.targets.wheel]
packages = ["src/cursor_flash"]

[tool.pytest.ini_options]
pythonpath = ["src"]
testpaths = ["tests"]
```

- [ ] **Step 2: Create `.gitignore`**

```text
.superpowers/
__pycache__/
*.py[cod]
.venv/
venv/
dist/
*.egg-info/
node_modules/
web/dist/
.pytest_cache/
*.vscdb
!tests/fixtures/*.vscdb
```

- [ ] **Step 3: Create package init and README stub**

`src/cursor_flash/__init__.py`:
```python
__version__ = "0.1.0"
```

`README.md`:
```markdown
# cursor-flash

Inspect and selectively clean Cursor `state.vscdb`.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
cursor-flash status
uvicorn cursor_flash.api.app:app --reload --port 8787
```

Then open the React app in `web/` (see Task 12).
```

- [ ] **Step 4: Create `tests/conftest.py` with synthetic DB helper**

```python
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest


def _create_mini_state_db(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    conn = sqlite3.connect(path)
    try:
        conn.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
        conn.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
        conn.execute(
            """
            CREATE TABLE composerHeaders (
              composerId TEXT PRIMARY KEY,
              workspaceId TEXT,
              createdAt INTEGER,
              lastUpdatedAt INTEGER,
              isArchived INTEGER,
              isSubagent INTEGER,
              recency REAL,
              checkpointAt INTEGER,
              value BLOB
            )
            """
        )
        # composer A (old), B (new)
        conn.execute(
            "INSERT INTO composerHeaders(composerId, workspaceId, createdAt, lastUpdatedAt, value) VALUES (?,?,?,?,?)",
            ("comp-old", "ws1", 1_700_000_000_000, 1_700_000_000_000, b"{}"),
        )
        conn.execute(
            "INSERT INTO composerHeaders(composerId, workspaceId, createdAt, lastUpdatedAt, value) VALUES (?,?,?,?,?)",
            ("comp-new", "ws1", 1_800_000_000_000, 1_800_000_000_000, b"{}"),
        )
        rows = [
            ("bubbleId:comp-old:b1", b"x" * 1000),
            ("bubbleId:comp-old:b2", b"y" * 2000),
            ("bubbleId:comp-new:b3", b"z" * 500),
            ("agentKv:blob:aaa", b"a" * 300),
            ("composerData:comp-old", b"c" * 100),
            ("composerData:comp-new", b"d" * 100),
        ]
        conn.executemany("INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)", rows)
        conn.execute(
            "INSERT INTO ItemTable(key, value) VALUES (?, ?)",
            ("some.setting", b"keep-me"),
        )
        conn.commit()
    finally:
        conn.close()
    return path


@pytest.fixture
def mini_db(tmp_path: Path) -> Path:
    return _create_mini_state_db(tmp_path / "state.vscdb")
```

- [ ] **Step 5: Install and verify empty pytest works**

Run:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest -q
```
Expected: `no tests ran` or 0 passed (no collection errors).

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml .gitignore src/cursor_flash/__init__.py README.md tests/conftest.py
git commit -m "chore: scaffold cursor-flash Python project"
```

---

### Task 2: Catalog — key prefix classification

**Files:**
- Create: `src/cursor_flash/catalog.py`
- Create: `tests/test_catalog.py`

- [ ] **Step 1: Write failing tests**

```python
from cursor_flash.catalog import categorize_key, RISK_HIGH


def test_bubble_id():
    c = categorize_key("bubbleId:comp-old:b1")
    assert c.category == "bubbleId"
    assert c.composer_id == "comp-old"
    assert c.risk == RISK_HIGH


def test_agent_kv_no_composer():
    c = categorize_key("agentKv:blob:aaa")
    assert c.category == "agentKv"
    assert c.composer_id is None


def test_composer_content_dot_prefix():
    c = categorize_key("composer.content.abc123")
    assert c.category == "composer.content"


def test_unknown_other():
    c = categorize_key("totally.unknown.key")
    assert c.category == "other"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_catalog.py -v`  
Expected: FAIL (import error / not found)

- [ ] **Step 3: Implement `catalog.py`**

```python
from __future__ import annotations

from dataclasses import dataclass

RISK_HIGH = "high"
RISK_MEDIUM = "medium"
RISK_LOW = "low"

# (prefix, category, risk, composer_from_segment_index or None)
# For "bubbleId:composerId:rest" composer is segment 1
_RULES: list[tuple[str, str, str, int | None]] = [
    ("bubbleId:", "bubbleId", RISK_HIGH, 1),
    ("agentKv:", "agentKv", RISK_LOW, None),
    ("composer.content.", "composer.content", RISK_MEDIUM, None),
    ("checkpointId:", "checkpointId", RISK_MEDIUM, 1),
    ("composerData:", "composerData", RISK_HIGH, 1),
    ("ofsContent:", "ofsContent", RISK_MEDIUM, 1),
    ("inlineDiff:", "inlineDiff", RISK_MEDIUM, 1),
    ("codeBlockPartialInlineDiffFates:", "codeBlockPartialInlineDiffFates", RISK_MEDIUM, 1),
    ("codeBlockDiff:", "codeBlockDiff", RISK_MEDIUM, 1),
    ("messageRequestContext:", "messageRequestContext", RISK_MEDIUM, 1),
    ("composerVirtualRowHeights:", "composerVirtualRowHeights", RISK_LOW, 1),
]


@dataclass(frozen=True)
class KeyInfo:
    key: str
    category: str
    risk: str
    composer_id: str | None


def categorize_key(key: str) -> KeyInfo:
    for prefix, category, risk, composer_idx in _RULES:
        if key.startswith(prefix):
            composer_id = None
            if composer_idx is not None:
                parts = key.split(":")
                if len(parts) > composer_idx:
                    composer_id = parts[composer_idx] or None
            return KeyInfo(key=key, category=category, risk=risk, composer_id=composer_id)
    return KeyInfo(key=key, category="other", risk=RISK_MEDIUM, composer_id=None)


def known_categories() -> list[str]:
    cats = [c for _, c, _, _ in _RULES]
    return cats + ["other"]
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest tests/test_catalog.py -v`

- [ ] **Step 5: Commit**

```bash
git add src/cursor_flash/catalog.py tests/test_catalog.py
git commit -m "feat: classify state.vscdb key prefixes"
```

---

### Task 3: Paths, DB connect, Windows process detection

**Files:**
- Create: `src/cursor_flash/paths.py`
- Create: `src/cursor_flash/db.py`
- Create: `src/cursor_flash/process_win.py`
- Create: `src/cursor_flash/models.py`
- Create: `tests/test_db.py`

- [ ] **Step 1: Write failing tests for readonly open + tables**

```python
import sqlite3

from cursor_flash.db import connect_readonly, list_tables


def test_connect_readonly_lists_tables(mini_db):
    conn = connect_readonly(mini_db)
    try:
        tables = set(list_tables(conn))
        assert "cursorDiskKV" in tables
        assert "ItemTable" in tables
        assert "composerHeaders" in tables
    finally:
        conn.close()


def test_readonly_rejects_write(mini_db):
    conn = connect_readonly(mini_db)
    try:
        try:
            conn.execute("INSERT INTO ItemTable(key, value) VALUES ('a', 'b')")
            conn.commit()
            raised = False
        except sqlite3.Error:
            raised = True
        assert raised
    finally:
        conn.close()
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pytest tests/test_db.py -v`

- [ ] **Step 3: Implement modules**

`models.py`:
```python
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path


class SafetyLevel(str, Enum):
    A = "A"
    B = "B"
    C = "C"


@dataclass
class Filter:
    categories: list[str] = field(default_factory=list)
    composer_ids: list[str] = field(default_factory=list)
    older_than_ms: int | None = None
    newer_than_ms: int | None = None
    cascade_headers: bool = False
    include_unknown_time: bool = False


@dataclass
class DbStatus:
    db_path: Path
    size_bytes: int
    exists: bool
    cursor_running: bool
    safety_level: SafetyLevel
    index_path: Path | None
    index_stale: bool
```

`paths.py`:
```python
from __future__ import annotations

import os
from pathlib import Path


def default_state_vscdb() -> Path:
    appdata = os.environ.get("APPDATA")
    if not appdata:
        raise RuntimeError("APPDATA not set; Windows required for default path")
    return Path(appdata) / "Cursor" / "User" / "globalStorage" / "state.vscdb"


def default_tool_dir() -> Path:
    # Prefer non-C if E: exists
    e = Path("E:/cursor-flash")
    if Path("E:/").exists():
        return e
    local = os.environ.get("LOCALAPPDATA") or str(Path.home())
    return Path(local) / "cursor-flash"


def default_index_path() -> Path:
    return default_tool_dir() / "index.sqlite"


def default_backup_dir() -> Path:
    return default_tool_dir() / "backups"
```

`db.py`:
```python
from __future__ import annotations

import sqlite3
from pathlib import Path


def connect_readonly(db_path: Path) -> sqlite3.Connection:
    uri = f"file:{db_path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only=ON")
    return conn


def connect_write(db_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(db_path)


def list_tables(conn: sqlite3.Connection) -> list[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    return [r[0] for r in rows]


def file_size(db_path: Path) -> int:
    return db_path.stat().st_size if db_path.exists() else 0
```

`process_win.py`:
```python
from __future__ import annotations

import subprocess


def is_cursor_running() -> bool:
    # tasklist is available on Windows
    try:
        out = subprocess.check_output(
            ["tasklist", "/FI", "IMAGENAME eq Cursor.exe", "/NH"],
            text=True,
            stderr=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False
    return "Cursor.exe" in out
```

- [ ] **Step 4: Run tests — PASS**

Run: `pytest tests/test_db.py -v`

- [ ] **Step 5: Commit**

```bash
git add src/cursor_flash/paths.py src/cursor_flash/db.py src/cursor_flash/process_win.py src/cursor_flash/models.py tests/test_db.py
git commit -m "feat: add db paths, readonly connect, Cursor process check"
```

---

### Task 4: Mode1 index scanner

**Files:**
- Create: `src/cursor_flash/analyze/__init__.py`
- Create: `src/cursor_flash/analyze/mode1_index.py`
- Create: `tests/test_mode1_index.py`

- [ ] **Step 1: Write failing test**

```python
from cursor_flash.analyze.mode1_index import build_index, category_stats


def test_build_index_counts(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    stats = category_stats(index_path)
    by_cat = {s.category: s for s in stats}
    assert by_cat["bubbleId"].row_count == 3
    assert by_cat["bubbleId"].total_bytes == 3500
    assert by_cat["agentKv"].row_count == 1
```

- [ ] **Step 2: Run — FAIL**

Run: `pytest tests/test_mode1_index.py -v`

- [ ] **Step 3: Implement Mode1**

```python
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from cursor_flash.catalog import categorize_key
from cursor_flash.db import connect_readonly


@dataclass
class CategoryStat:
    category: str
    row_count: int
    total_bytes: int


def build_index(source_db: Path, index_path: Path, progress_cb=None) -> None:
    index_path.parent.mkdir(parents=True, exist_ok=True)
    if index_path.exists():
        index_path.unlink()
    src = connect_readonly(source_db)
    idx = sqlite3.connect(index_path)
    try:
        idx.execute(
            """
            CREATE TABLE kv_meta (
              key TEXT PRIMARY KEY,
              category TEXT NOT NULL,
              composer_id TEXT,
              size_bytes INTEGER NOT NULL
            )
            """
        )
        idx.execute(
            """
            CREATE TABLE meta (
              k TEXT PRIMARY KEY,
              v TEXT NOT NULL
            )
            """
        )
        idx.execute(
            "INSERT INTO meta(k,v) VALUES ('source_size', ?), ('source_mtime_ns', ?)",
            (str(source_db.stat().st_size), str(source_db.stat().st_mtime_ns)),
        )
        idx.execute("CREATE INDEX ix_kv_category ON kv_meta(category)")
        idx.execute("CREATE INDEX ix_kv_composer ON kv_meta(composer_id)")
        batch: list[tuple] = []
        n = 0
        for key, size in src.execute("SELECT key, length(value) FROM cursorDiskKV"):
            info = categorize_key(str(key))
            batch.append((info.key, info.category, info.composer_id, int(size or 0)))
            n += 1
            if len(batch) >= 5000:
                idx.executemany(
                    "INSERT INTO kv_meta(key, category, composer_id, size_bytes) VALUES (?,?,?,?)",
                    batch,
                )
                idx.commit()
                batch.clear()
                if progress_cb:
                    progress_cb(n)
        if batch:
            idx.executemany(
                "INSERT INTO kv_meta(key, category, composer_id, size_bytes) VALUES (?,?,?,?)",
                batch,
            )
            idx.commit()
        if progress_cb:
            progress_cb(n)
    finally:
        src.close()
        idx.close()


def category_stats(index_path: Path) -> list[CategoryStat]:
    conn = sqlite3.connect(index_path)
    try:
        rows = conn.execute(
            """
            SELECT category, COUNT(*), COALESCE(SUM(size_bytes),0)
            FROM kv_meta GROUP BY category ORDER BY SUM(size_bytes) DESC
            """
        ).fetchall()
        return [CategoryStat(category=r[0], row_count=r[1], total_bytes=r[2]) for r in rows]
    finally:
        conn.close()


def is_index_stale(source_db: Path, index_path: Path) -> bool:
    if not index_path.exists() or not source_db.exists():
        return True
    conn = sqlite3.connect(index_path)
    try:
        rows = dict(conn.execute("SELECT k,v FROM meta").fetchall())
    except sqlite3.Error:
        return True
    finally:
        conn.close()
    try:
        return (
            rows.get("source_size") != str(source_db.stat().st_size)
            or rows.get("source_mtime_ns") != str(source_db.stat().st_mtime_ns)
        )
    except OSError:
        return True
```

`analyze/__init__.py`: empty or re-exports.

- [ ] **Step 4: Run — PASS**

Run: `pytest tests/test_mode1_index.py -v`

- [ ] **Step 5: Commit**

```bash
git add src/cursor_flash/analyze tests/test_mode1_index.py
git commit -m "feat: Mode1 index scan and category stats"
```

---

### Task 5: Filter engine + composer stats

**Files:**
- Create: `src/cursor_flash/filter_engine.py`
- Create: `tests/test_filter_engine.py`
- Modify: `src/cursor_flash/analyze/mode1_index.py` (add `composer_stats` if not present)

- [ ] **Step 1: Write failing tests**

```python
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
```

- [ ] **Step 2: Run — FAIL**

Run: `pytest tests/test_filter_engine.py -v`

- [ ] **Step 3: Implement `filter_engine.py`**

```python
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from cursor_flash.models import Filter


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
    # Time filtering requires joining composer header times — stored in index in Task 5b.
    # For v1 of this task: if older/newer set, require composer_id NOT NULL and
    # composer_last_updated_ms column (added below).
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
```

Also update `build_index` to add column `composer_last_updated_ms` and populate from `composerHeaders` map when scanning.

Add to `mode1_index.py` inside `build_index` after opening src:

```python
        header_times = {
            r[0]: r[1]
            for r in src.execute(
                "SELECT composerId, COALESCE(lastUpdatedAt, createdAt) FROM composerHeaders"
            )
        }
```

Change `kv_meta` schema to include `composer_last_updated_ms INTEGER`, and when appending batch use `header_times.get(info.composer_id)`.

Add:

```python
@dataclass
class ComposerStat:
    composer_id: str
    row_count: int
    total_bytes: int
    last_updated_ms: int | None


def composer_stats(index_path: Path) -> list[ComposerStat]:
    conn = sqlite3.connect(index_path)
    try:
        rows = conn.execute(
            """
            SELECT composer_id, COUNT(*), COALESCE(SUM(size_bytes),0), MAX(composer_last_updated_ms)
            FROM kv_meta
            WHERE composer_id IS NOT NULL
            GROUP BY composer_id
            ORDER BY SUM(size_bytes) DESC
            """
        ).fetchall()
        return [
            ComposerStat(
                composer_id=r[0], row_count=r[1], total_bytes=r[2], last_updated_ms=r[3]
            )
            for r in rows
        ]
    finally:
        conn.close()
```

Update `tests/test_mode1_index.py` / `build_index` insert columns accordingly (4→5 fields).

- [ ] **Step 4: Extend test for time filter**

```python
def test_filter_older_than(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(older_than_ms=1_750_000_000_000, categories=["bubbleId"])
    est = estimate_filter(index_path, f)
    assert est.row_count == 2  # only comp-old bubbles
```

- [ ] **Step 5: Run all related tests — PASS**

Run: `pytest tests/test_mode1_index.py tests/test_filter_engine.py -v`

- [ ] **Step 6: Commit**

```bash
git add src/cursor_flash/filter_engine.py src/cursor_flash/analyze/mode1_index.py tests/test_filter_engine.py tests/test_mode1_index.py
git commit -m "feat: filter engine with category, composer, time"
```

---

### Task 6: Mode2 live + Mode3 export

**Files:**
- Create: `src/cursor_flash/analyze/mode2_live.py`
- Create: `src/cursor_flash/analyze/mode3_export.py`
- Create: `tests/test_mode2_mode3.py`

- [ ] **Step 1: Write failing tests**

```python
import json
from pathlib import Path

from cursor_flash.analyze.mode1_index import build_index, category_stats
from cursor_flash.analyze.mode2_live import sample_category_counts
from cursor_flash.analyze.mode3_export import export_report


def test_mode2_sample_counts(mini_db):
    counts = sample_category_counts(mini_db, limit_per_scan=1000)
    assert counts["bubbleId"] == 3


def test_mode3_export(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    out = tmp_path / "report"
    export_report(index_path, out)
    data = json.loads((out / "summary.json").read_text(encoding="utf-8"))
    assert data["categories"][0]["category"]  # non-empty
    assert (out / "categories.json").exists()
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement Mode2 / Mode3**

`mode2_live.py`:
```python
from __future__ import annotations

from collections import Counter
from pathlib import Path

from cursor_flash.catalog import categorize_key
from cursor_flash.db import connect_readonly


def sample_category_counts(source_db: Path, limit_per_scan: int = 50_000) -> dict[str, int]:
    conn = connect_readonly(source_db)
    try:
        c: Counter[str] = Counter()
        n = 0
        for (key,) in conn.execute("SELECT key FROM cursorDiskKV"):
            c[categorize_key(str(key)).category] += 1
            n += 1
            if n >= limit_per_scan:
                break
        return dict(c)
    finally:
        conn.close()
```

`mode3_export.py`:
```python
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
    # copy index for offline use
    shutil.copy2(index_path, out_dir / "index.sqlite")
    return out_dir
```

- [ ] **Step 4: Run — PASS**

Run: `pytest tests/test_mode2_mode3.py -v`

- [ ] **Step 5: Commit**

```bash
git add src/cursor_flash/analyze/mode2_live.py src/cursor_flash/analyze/mode3_export.py tests/test_mode2_mode3.py
git commit -m "feat: Mode2 live sample counts and Mode3 export report"
```

---

### Task 7: Safety gate + backup

**Files:**
- Create: `src/cursor_flash/safety.py`
- Create: `src/cursor_flash/backup.py`
- Create: `tests/test_safety.py`

- [ ] **Step 1: Write failing tests**

```python
import pytest

from cursor_flash.backup import backup_file
from cursor_flash.models import SafetyLevel
from cursor_flash.safety import SafetyError, assert_can_write


def test_level_b_blocks_when_cursor_running(monkeypatch):
    monkeypatch.setattr("cursor_flash.safety.is_cursor_running", lambda: True)
    with pytest.raises(SafetyError):
        assert_can_write(SafetyLevel.B, backup_provided=True)


def test_level_b_allows_when_closed(monkeypatch):
    monkeypatch.setattr("cursor_flash.safety.is_cursor_running", lambda: False)
    assert_can_write(SafetyLevel.B, backup_provided=False)  # backup optional at B


def test_level_a_requires_backup(monkeypatch):
    monkeypatch.setattr("cursor_flash.safety.is_cursor_running", lambda: False)
    with pytest.raises(SafetyError):
        assert_can_write(SafetyLevel.A, backup_provided=False)


def test_backup_copies(mini_db, tmp_path):
    dest_dir = tmp_path / "bak"
    out = backup_file(mini_db, dest_dir)
    assert out.exists()
    assert out.stat().st_size == mini_db.stat().st_size
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

`safety.py`:
```python
from __future__ import annotations

from cursor_flash.models import SafetyLevel
from cursor_flash.process_win import is_cursor_running


class SafetyError(RuntimeError):
    pass


def assert_can_write(
    level: SafetyLevel,
    backup_provided: bool,
    allow_hot_write: bool = False,
) -> None:
    running = is_cursor_running()
    if level == SafetyLevel.C and allow_hot_write:
        return
    if running:
        raise SafetyError("Cursor.exe is running; close Cursor before write operations")
    if level == SafetyLevel.A and not backup_provided:
        raise SafetyError("Safety level A requires a backup before write")
```

`backup.py`:
```python
from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path


def backup_file(source: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    dest = dest_dir / f"{source.name}.backup-{ts}"
    shutil.copy2(source, dest)
    return dest
```

- [ ] **Step 4: Run — PASS**

Run: `pytest tests/test_safety.py -v`

- [ ] **Step 5: Commit**

```bash
git add src/cursor_flash/safety.py src/cursor_flash/backup.py tests/test_safety.py
git commit -m "feat: safety gate and file backup"
```

---

### Task 8: Filter-copy reclaim (default) + in-place delete/vacuum

**Files:**
- Create: `src/cursor_flash/reclaim.py`
- Create: `tests/test_reclaim.py`

- [ ] **Step 1: Write failing test for filter-copy**

```python
import sqlite3
from pathlib import Path

from cursor_flash.analyze.mode1_index import build_index
from cursor_flash.filter_engine import matching_keys
from cursor_flash.models import Filter
from cursor_flash.reclaim import filter_copy_rebuild, in_place_delete


def test_filter_copy_removes_selected(mini_db, tmp_path):
    index_path = tmp_path / "index.sqlite"
    build_index(mini_db, index_path)
    f = Filter(categories=["bubbleId"], composer_ids=["comp-old"])
    delete_keys = set(matching_keys(index_path, f))
    new_db = tmp_path / "new" / "state.vscdb"
    filter_copy_rebuild(mini_db, new_db, delete_keys=delete_keys, cascade_headers=False)
    conn = sqlite3.connect(new_db)
    try:
        keys = {r[0] for r in conn.execute("SELECT key FROM cursorDiskKV")}
        assert "bubbleId:comp-old:b1" not in keys
        assert "bubbleId:comp-new:b3" in keys
        assert "agentKv:blob:aaa" in keys
        setting = conn.execute(
            "SELECT value FROM ItemTable WHERE key='some.setting'"
        ).fetchone()
        assert setting[0] == b"keep-me"
    finally:
        conn.close()
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `reclaim.py`**

```python
from __future__ import annotations

import sqlite3
from pathlib import Path
import shutil


def filter_copy_rebuild(
    source_db: Path,
    dest_db: Path,
    delete_keys: set[str],
    cascade_headers: bool = False,
    delete_composer_ids: set[str] | None = None,
) -> Path:
    dest_db.parent.mkdir(parents=True, exist_ok=True)
    if dest_db.exists():
        dest_db.unlink()
    src = sqlite3.connect(f"file:{source_db.as_posix()}?mode=ro", uri=True)
    dst = sqlite3.connect(dest_db)
    try:
        # ItemTable — copy all
        dst.execute("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB)")
        for key, value in src.execute("SELECT key, value FROM ItemTable"):
            dst.execute("INSERT INTO ItemTable(key, value) VALUES (?, ?)", (key, value))

        # composerHeaders
        dst.execute(
            """
            CREATE TABLE composerHeaders (
              composerId TEXT PRIMARY KEY,
              workspaceId TEXT,
              createdAt INTEGER,
              lastUpdatedAt INTEGER,
              isArchived INTEGER,
              isSubagent INTEGER,
              recency REAL,
              checkpointAt INTEGER,
              value BLOB
            )
            """
        )
        delete_composer_ids = delete_composer_ids or set()
        for row in src.execute("SELECT * FROM composerHeaders"):
            composer_id = row[0]
            if cascade_headers and composer_id in delete_composer_ids:
                continue
            dst.execute(
                "INSERT INTO composerHeaders VALUES (?,?,?,?,?,?,?,?,?)",
                row,
            )

        # cursorDiskKV — skip delete_keys
        dst.execute("CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB)")
        for key, value in src.execute("SELECT key, value FROM cursorDiskKV"):
            if key in delete_keys:
                continue
            dst.execute(
                "INSERT INTO cursorDiskKV(key, value) VALUES (?, ?)",
                (key, value),
            )
        dst.commit()
    finally:
        src.close()
        dst.close()
    return dest_db


def in_place_delete(db_path: Path, delete_keys: set[str]) -> int:
    conn = sqlite3.connect(db_path)
    try:
        # chunked delete
        keys = list(delete_keys)
        deleted = 0
        for i in range(0, len(keys), 500):
            chunk = keys[i : i + 500]
            placeholders = ",".join("?" for _ in chunk)
            cur = conn.execute(
                f"DELETE FROM cursorDiskKV WHERE key IN ({placeholders})",
                chunk,
            )
            deleted += cur.rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()


def vacuum_db(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("VACUUM")
    finally:
        conn.close()


def replace_db_atomic(original: Path, new_db: Path) -> Path:
    """Rename original aside, move new into place. Caller must ensure Cursor closed."""
    ts_aside = original.with_suffix(original.suffix + f".pre-rebuild")
    # if exists, add numeric suffix
    aside = ts_aside
    n = 1
    while aside.exists():
        aside = original.with_suffix(original.suffix + f".pre-rebuild-{n}")
        n += 1
    original.rename(aside)
    try:
        shutil.move(str(new_db), str(original))
    except Exception:
        # try rollback
        if not original.exists() and aside.exists():
            aside.rename(original)
        raise
    return aside
```

- [ ] **Step 4: Add disk free check helper for vacuum path**

```python
import shutil as _shutil

def assert_enough_space_for_vacuum(db_path: Path, margin_ratio: float = 1.05) -> None:
    size = db_path.stat().st_size
    free = _shutil.disk_usage(db_path.drive if db_path.drive else db_path.anchor).free
    if free < size * margin_ratio:
        raise RuntimeError(
            f"Not enough free space for VACUUM (need ~{size * margin_ratio:.0f} bytes, free {free})"
        )
```

- [ ] **Step 5: Run — PASS**

Run: `pytest tests/test_reclaim.py -v`

- [ ] **Step 6: Commit**

```bash
git add src/cursor_flash/reclaim.py tests/test_reclaim.py
git commit -m "feat: filter-copy rebuild and in-place delete/vacuum"
```

---

### Task 9: Jobs + service facade

**Files:**
- Create: `src/cursor_flash/jobs.py`
- Create: `src/cursor_flash/service.py`
- Create: `tests/test_service.py`

- [ ] **Step 1: Write failing test**

```python
from cursor_flash.models import Filter, SafetyLevel
from cursor_flash.service import AppContext, preview_clean, run_scan


def test_scan_and_preview(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_flash.service.is_cursor_running", lambda: False)
    ctx = AppContext(
        db_path=mini_db,
        index_path=tmp_path / "index.sqlite",
        backup_dir=tmp_path / "bak",
        safety_level=SafetyLevel.B,
    )
    run_scan(ctx)
    est = preview_clean(ctx, Filter(categories=["agentKv"]))
    assert est.row_count == 1
```

- [ ] **Step 2: Implement `jobs.py` + `service.py`**

`jobs.py`:
```python
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
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
```

`service.py` (facade — keep thin; wire scan/preview/export/rebuild):

```python
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from cursor_flash.analyze.mode1_index import build_index, category_stats, composer_stats, is_index_stale
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


def preview_clean(ctx: AppContext, filter: Filter) -> FilterEstimate:
    if not ctx.index_path.exists():
        raise FileNotFoundError("Index missing; run scan first")
    return estimate_filter(ctx.index_path, filter)


def apply_filter_copy(
    ctx: AppContext,
    filter: Filter,
    dest_db: Path,
    do_backup: bool = True,
    replace_original: bool = False,
) -> dict:
    backup_path = None
    if do_backup:
        backup_path = backup_file(ctx.db_path, ctx.backup_dir)
    assert_can_write(ctx.safety_level, backup_provided=backup_path is not None)
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
```

- [ ] **Step 3: Run — PASS**

Run: `pytest tests/test_service.py -v`

- [ ] **Step 4: Commit**

```bash
git add src/cursor_flash/jobs.py src/cursor_flash/service.py tests/test_service.py
git commit -m "feat: jobs registry and service facade"
```

---

### Task 10: FastAPI

**Files:**
- Create: `src/cursor_flash/api/__init__.py`
- Create: `src/cursor_flash/api/app.py`
- Create: `tests/test_api.py`

- [ ] **Step 1: Write API test with TestClient**

```python
from pathlib import Path

from fastapi.testclient import TestClient

from cursor_flash.api.app import create_app
from cursor_flash.models import SafetyLevel
from cursor_flash.service import AppContext


def test_status_and_scan(mini_db, tmp_path, monkeypatch):
    monkeypatch.setattr("cursor_flash.service.is_cursor_running", lambda: False)
    monkeypatch.setattr("cursor_flash.process_win.is_cursor_running", lambda: False)
    ctx = AppContext(
        db_path=mini_db,
        index_path=tmp_path / "index.sqlite",
        backup_dir=tmp_path / "bak",
        safety_level=SafetyLevel.B,
    )
    client = TestClient(create_app(ctx))
    r = client.get("/api/status")
    assert r.status_code == 200
    assert r.json()["exists"] is True
    r = client.post("/api/scan")
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    # poll until done (scan is sync in test via wait)
    for _ in range(50):
        j = client.get(f"/api/jobs/{job_id}").json()
        if j["status"] in ("done", "error"):
            break
    assert j["status"] == "done"
    cats = client.get("/api/stats/categories").json()
    assert any(c["category"] == "bubbleId" for c in cats)
```

- [ ] **Step 2: Implement `create_app`**

```python
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from cursor_flash.analyze.mode1_index import category_stats, composer_stats
from cursor_flash.jobs import create_job, get_job, run_in_background
from cursor_flash.models import Filter, SafetyLevel
from cursor_flash.service import AppContext, apply_filter_copy, export, get_status, preview_clean, run_scan


class FilterIn(BaseModel):
    categories: list[str] = Field(default_factory=list)
    composer_ids: list[str] = Field(default_factory=list)
    older_than_ms: int | None = None
    newer_than_ms: int | None = None
    cascade_headers: bool = False
    include_unknown_time: bool = False


def create_app(ctx: AppContext) -> FastAPI:
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


# default app for uvicorn — uses default paths
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
```

- [ ] **Step 3: Run — PASS**

Run: `pytest tests/test_api.py -v`

Note: TestClient may need a short sleep loop; if flaky, call `run_scan` synchronously in a test-only flag — prefer fixing race with polling as shown.

- [ ] **Step 4: Commit**

```bash
git add src/cursor_flash/api tests/test_api.py
git commit -m "feat: FastAPI status, scan, stats, preview, rebuild"
```

---

### Task 11: Typer CLI

**Files:**
- Create: `src/cursor_flash/cli.py`
- Create: `tests/test_cli.py`

- [ ] **Step 1: Implement CLI**

```python
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from cursor_flash.models import Filter, SafetyLevel
from cursor_flash.paths import default_backup_dir, default_index_path, default_state_vscdb
from cursor_flash.service import AppContext, apply_filter_copy, export, get_status, preview_clean, run_scan
from cursor_flash.analyze.mode1_index import category_stats, composer_stats

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
```

- [ ] **Step 2: Manual smoke on fixture**

```bash
cursor-flash status --db path\to\mini.vscdb --index path\to\index.sqlite
```
(Or invoke via `python -c` / pytest CliRunner.)

Add `tests/test_cli.py` using `typer.testing.CliRunner` for `status` on `mini_db`.

- [ ] **Step 3: Commit**

```bash
git add src/cursor_flash/cli.py tests/test_cli.py
git commit -m "feat: Typer CLI status/scan/list/clean/export"
```

---

### Task 12: React Web UI (Vite)

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`
- Create: `web/src/main.tsx`, `web/src/App.tsx`, `web/src/api.ts`
- Create: `web/src/pages/Overview.tsx`, `Categories.tsx`, `Composers.tsx`, `TimeFilter.tsx`, `CleanPreview.tsx`, `Settings.tsx`, `ExportPage.tsx`

- [ ] **Step 1: Scaffold Vite React-TS in `web/`**

```bash
cd web
npm create vite@latest . -- --template react-ts
npm install
```

Set proxy in `vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8787" },
  },
});
```

- [ ] **Step 2: `api.ts` client**

```ts
export type Status = {
  db_path: string;
  size_bytes: number;
  exists: boolean;
  cursor_running: boolean;
  safety_level: string;
  index_path: string | null;
  index_stale: boolean;
};

export async function getStatus(): Promise<Status> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function startScan(): Promise<string> {
  const r = await fetch("/api/scan", { method: "POST" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()).job_id;
}

export async function pollJob(id: string) {
  const r = await fetch(`/api/jobs/${id}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getCategories() {
  const r = await fetch("/api/stats/categories");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function getComposers() {
  const r = await fetch("/api/stats/composers");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function previewClean(body: unknown) {
  const r = await fetch("/api/clean/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

- [ ] **Step 3: App shell with nav routes**

Implement simple hash or react-router pages matching spec nav: Overview, Categories, Composers, Time, Clean Preview, Settings, Export.  
Overview shows size GB, cursor_running, scan button + job poll.  
Categories/Composers: checkbox tables feeding shared filter state (React context).  
Clean Preview: calls preview then confirms rebuild with `dest_db` path input (default `E:/cursor-flash/new-state.vscdb`) and `replace_original` checkbox default false.

Keep styling readable (high contrast); avoid purple-gradient AI look per project UI rules — use a restrained utility CSS file.

- [ ] **Step 4: Manual E2E smoke**

```bash
# terminal 1
uvicorn cursor_flash.api.app:app --port 8787
# terminal 2
cd web && npm run dev
```

Open `http://127.0.0.1:5173`, run Scan on a **copy** of state.vscdb pointed via Settings (or env), verify categories render.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: React UI for overview, filters, and clean preview"
```

---

### Task 13: README polish + end-to-end checklist

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document**

- Default paths  
- Safety levels  
- **Never** point destructive `--replace` at live DB without backup  
- Recommended flow for full C: drive: scan → filter → rebuild to E: → close Cursor → `--replace`  
- Dev commands for API + web  

- [ ] **Step 2: Run full pytest**

```bash
pytest -v
```
Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: usage, safety, and reclaim workflow"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Mode1 index | Task 4 |
| Mode2 live | Task 6 |
| Mode3 export | Task 6 |
| Filter type ∩ composer ∩ time | Task 5 |
| Safety A/B/C | Task 7 |
| Backup | Task 7 |
| Cross-disk filter-copy default | Task 8–9 |
| In-place DELETE+VACUUM + space check | Task 8 |
| FastAPI + job polling | Task 9–10 |
| CLI | Task 11 |
| React UI pages | Task 12 |
| ItemTable default keep | Task 8 copy-all ItemTable |
| Windows-first | Task 3 `process_win` / `APPDATA` |
| No damage on failure | Task 8 `replace_db_atomic` rollback |

**Explicit v1 deferrals (match Non-Goals):** Desktop shell, SSE, cleaning ItemTable, auto-undo.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-30-cursor-flash.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — same session with executing-plans and checkpoints  

Which approach?
