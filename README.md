# Cursor Flash

**English** | [中文](README.zh-CN.md)

Inspect and selectively clean Cursor `state.vscdb` — the SQLite database that stores chat bubbles, agent cache, composer sessions, and other Cursor global state. When this file grows to tens of GB it can fill your system drive; this tool helps you **see what is using space** and **reclaim disk safely** via filter-copy rebuild.

## What it does

- **Inspect** — scan `state.vscdb` and build a local metadata index (key prefixes, composer IDs, sizes) without copying value payloads.
- **Analyze** — view breakdowns by category, composer/session, and time range; export reports.
- **Preview** — estimate rows and bytes that match a filter before any write.
- **Clean / reclaim** — copy *kept* rows into a new database on another drive (default strategy when C: is full), optionally replace the original after verification.

The web UI (React) and CLI (`cursor-flash`) share the same Python core and FastAPI service.

## Default paths

| Resource | Default location |
|----------|------------------|
| Live Cursor DB | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| Tool directory (index + backups) | `E:\cursor-flash\` when drive `E:` exists |
| Tool directory (fallback) | `%LOCALAPPDATA%\cursor-flash\` (or home) |
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

1. **Scan** — build/update the index (`cursor-flash scan` or web Overview → Scan).
2. **Filter** — choose categories, composers, and/or time ranges (web pages or CLI flags).
3. **Preview** — confirm row count and estimated bytes (`cursor-flash clean --preview …` or Clean Preview page).
4. **Rebuild to E:** — write a new DB to a non-C path, e.g. `E:\cursor-flash\new-state.vscdb` (`--dest` / API `dest_db`). Do **not** replace the original yet.
5. **Close Cursor** — exit the application entirely.
6. **Replace** — run apply with `--replace` (or enable “Replace original” in the UI) **only after** backup + Cursor closed.

Example CLI sequence:

```bash
cursor-flash status
cursor-flash scan
cursor-flash list categories
cursor-flash clean --preview --categories bubbleId
cursor-flash clean --apply --categories bubbleId --dest E:/cursor-flash/new-state.vscdb
# Close Cursor, verify backup exists, then:
cursor-flash clean --apply --categories bubbleId --dest E:/cursor-flash/new-state.vscdb --replace
```

## Development setup

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
uvicorn cursor_flash.api.app:app --host 127.0.0.1 --port 8787
cd web && npm install && npm run dev
```

### Useful commands after install

CLI (available as `cursor-flash` once installed):

```bash
cursor-flash status
cursor-flash scan
cursor-flash list categories
cursor-flash clean --preview --categories bubbleId
```

API base URL when running locally: `http://127.0.0.1:8787` (endpoints under `/api/…`).

Web UI dev server: **http://localhost:5173** (proxies `/api` to port 8787). Run the API and web dev server together for full functionality.

Production web build:

```bash
cd web && npm run build
python scripts/sync_web_dist.py   # optional: copy into package web_dist/
```

After a production build, a single uvicorn process can serve both API and UI:

```bash
uvicorn cursor_flash.api.app:app --host 127.0.0.1 --port 8787
# open http://127.0.0.1:8787/
```

## Desktop app

The desktop shell is a thin **pywebview** window around the same FastAPI + React UI (no separate GUI rewrite).

### Run from source

```bash
pip install -e ".[desktop]"
cd web && npm install && npm run build
cd .. && python scripts/sync_web_dist.py
cursor-flash-desktop
```

Options: `--port`, `--width`, `--height`, `--db`, `--index`, `--backup-dir`.

### Windows release build

```bash
python scripts/build_desktop.py
# → dist/CursorFlash.exe
# → dist/CursorFlash-windows-x64-vX.Y.Z.zip
```

Requires Node.js, Python 3.11+, and Edge WebView2 (usually preinstalled on Windows 10/11).

## Project layout

```text
src/cursor_flash/   Python core, FastAPI app, Typer CLI, desktop launcher
web/                React + Vite dashboard
packaging/          PyInstaller spec
scripts/            sync_web_dist.py, build_desktop.py
tests/              pytest fixtures and integration tests
```

## Platform

Windows-first (default paths, `Cursor.exe` process detection). Python 3.11+ required. Desktop uses Edge WebView2 via pywebview.
