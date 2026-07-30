from __future__ import annotations

import socket
import threading
import time
from pathlib import Path
from typing import Optional

import typer
import uvicorn

from cursor_flash.api.app import create_app
from cursor_flash.models import SafetyLevel
from cursor_flash.paths import default_backup_dir, default_index_path, default_state_vscdb
from cursor_flash.service import AppContext
from cursor_flash.web_static import resolve_web_dist


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_ready(host: str, port: int, timeout: float = 15.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError(f"Server did not start on {host}:{port}")


def run_desktop(
    host: str = "127.0.0.1",
    port: Optional[int] = None,
    width: int = 1280,
    height: int = 860,
    db: Optional[str] = None,
    index: Optional[str] = None,
    backup_dir: Optional[str] = None,
) -> None:
    try:
        import webview
    except ImportError as exc:  # pragma: no cover
        raise SystemExit(
            "Desktop deps missing. Install with:\n"
            '  pip install -e ".[desktop]"\n'
        ) from exc

    dist = resolve_web_dist()
    if dist is None:
        raise SystemExit(
            "Web UI assets not found. Build them first:\n"
            "  cd web && npm install && npm run build\n"
            "  python scripts/sync_web_dist.py\n"
        )

    bind_port = port or _free_port()
    ctx = AppContext(
        db_path=Path(db) if db else default_state_vscdb(),
        index_path=Path(index) if index else default_index_path(),
        backup_dir=Path(backup_dir) if backup_dir else default_backup_dir(),
        safety_level=SafetyLevel.B,
    )
    app = create_app(ctx, serve_web=True)
    config = uvicorn.Config(app, host=host, port=bind_port, log_level="warning")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, name="cursor-flash-uvicorn", daemon=True)
    thread.start()
    _wait_ready(host, bind_port)

    url = f"http://{host}:{bind_port}/"
    webview.create_window(
        title="Cursor Flash",
        url=url,
        width=width,
        height=height,
        min_size=(900, 600),
    )
    webview.start()
    server.should_exit = True
    thread.join(timeout=5)


app = typer.Typer(add_completion=False, help="Cursor Flash desktop shell")


@app.callback(invoke_without_command=True)
def main(
    port: Optional[int] = typer.Option(None, help="Local server port (default: ephemeral)"),
    width: int = typer.Option(1280, help="Window width"),
    height: int = typer.Option(860, help="Window height"),
    db: Optional[str] = typer.Option(None, help="Path to state.vscdb"),
    index: Optional[str] = typer.Option(None, help="Path to index.sqlite"),
    backup_dir: Optional[str] = typer.Option(None, help="Backup directory"),
) -> None:
    run_desktop(
        port=port,
        width=width,
        height=height,
        db=db,
        index=index,
        backup_dir=backup_dir,
    )


if __name__ == "__main__":
    app()
