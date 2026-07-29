# cursor-vscdb

Inspect and selectively clean Cursor `state.vscdb` — the SQLite database that stores chat bubbles, agent cache, composer sessions, and other Cursor global state. When this file grows to tens of GB it can fill your system drive; this tool helps you **see what is using space** and **reclaim disk safely** via filter-copy rebuild.

## What it does

- **Inspect** — scan `state.vscdb` and build a local metadata index (key prefixes, composer IDs, sizes) without copying value payloads.
- **Analyze** — view breakdowns by category, composer/session, and time range; export reports.
- **Preview** — estimate rows and bytes that match a filter before any write.
- **Clean / reclaim** — copy *kept* rows into a new database on another drive (default strategy when C: is full), optionally replace the original after verification.

The web UI (React) and CLI (`vscdb`) share the same Python core and FastAPI service.

## Default paths

| Resource | Default location |
|----------|------------------|
| Live Cursor DB | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| Tool directory (index + backups) | `E:\cursor-vscdb-tool\` when drive `E:` exists |
| Tool directory (fallback) | `%LOCALAPPDATA%\cursor-vscdb-tool\` (or home) |
| Index database | `<tool-dir>\index.sqlite` |
| Backups | `<tool-dir>\backups\` |

Override paths via CLI flags (`--db`, `--index`, `--backup-dir`) or API/app context settings.

## Safety levels

Configurable safety gate before any write (default **B**):

| Level | Name | Behavior |
|-------|------|----------|
| **A** | Strong | Cursor must be closed; **backup required** before write; preview recommended |
| **B** | Medium *(default)* | Read-only while Cursor is running; **writes blocked until Cursor is closed**; backup optional but strongly recommended |
| **C** | Aggressive | Allows hot-write attempts when explicitly enabled (high risk; not recommended) |

All write paths: safety check → preview → confirmation → execute. Failed rebuilds never overwrite the original database.

### Critical: never replace the live DB without preparation

**Never** use `--replace` (CLI) or `replace_original=true` (API) on the live `state.vscdb` unless you have:

1. **Closed Cursor completely** (no `Cursor.exe` running), and  
2. **Created a backup** (`--backup-dir` / `do_backup=true`) to a known location (preferably on another drive).

Replacing while Cursor is open or without a backup can corrupt your session store or lose data with no recovery path.

## Recommended workflow (full C: drive)

When system disk space is tight, do **not** rely on in-place `DELETE + VACUUM` on C:. Use cross-disk filter-copy rebuild:

1. **Scan** — build/update the index (`vscdb scan` or web Overview → Scan).
2. **Filter** — choose categories, composers, and/or time ranges (web pages or CLI flags).
3. **Preview** — confirm row count and estimated bytes (`vscdb clean --preview …` or Clean Preview page).
4. **Rebuild to E:** — write a new DB to a non-C path, e.g. `E:\cursor-vscdb-tool\new-state.vscdb` (`--dest` / API `dest_db`). Do **not** replace the original yet.
5. **Close Cursor** — exit the application entirely.
6. **Replace** — run apply with `--replace` (or enable “Replace original” in the UI) **only after** backup + Cursor closed.

Example CLI sequence:

```bash
vscdb status
vscdb scan
vscdb list categories
vscdb clean --preview --categories bubbleId
vscdb clean --apply --categories bubbleId --dest E:/cursor-vscdb-tool/new-state.vscdb
# Close Cursor, verify backup exists, then:
vscdb clean --apply --categories bubbleId --dest E:/cursor-vscdb-tool/new-state.vscdb --replace
```

## Development setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn cursor_vscdb.api.app:app --host 127.0.0.1 --port 8787
cd web && npm install && npm run dev
```

### Useful commands after install

CLI (available as `vscdb` once installed):

```bash
vscdb status
vscdb scan
vscdb list categories
vscdb clean --preview --categories bubbleId
```

API base URL when running locally: `http://127.0.0.1:8787` (endpoints under `/api/…`).

Web UI dev server: **http://localhost:5173** (proxies `/api` to port 8787). Run the API and web dev server together for full functionality.

Production web build:

```bash
cd web && npm run build
```

## Project layout

```text
src/cursor_vscdb/   Python core, FastAPI app, Typer CLI
web/                React + Vite dashboard
tests/              pytest fixtures and integration tests
```

## Platform

Windows-first (default paths, `Cursor.exe` process detection). Python 3.11+ required.
