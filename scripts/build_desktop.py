"""Build Windows desktop release: web UI + PyInstaller onedir + zip."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DIST = ROOT / "dist"
BUILD = ROOT / "build"
SPEC = ROOT / "packaging" / "cursor_flash.spec"
VERSION_FILE = ROOT / "pyproject.toml"


def _version() -> str:
    for line in VERSION_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith("version"):
            return line.split("=", 1)[1].strip().strip('"')
    return "0.0.0"


def _run(cmd: list[str], *, cwd: Path | None = None) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, cwd=cwd or ROOT, check=True)


def _npm() -> str:
    found = shutil.which("npm.cmd") or shutil.which("npm")
    if not found:
        raise SystemExit("npm not found on PATH. Install Node.js and retry.")
    return found


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-web", action="store_true")
    args = parser.parse_args()

    py = sys.executable
    version = _version()

    if not args.skip_web:
        npm = _npm()
        if (WEB / "package-lock.json").is_file():
            _run([npm, "ci"], cwd=WEB)
        else:
            _run([npm, "install"], cwd=WEB)
        _run([npm, "run", "build"], cwd=WEB)
        _run([py, str(ROOT / "scripts" / "sync_web_dist.py")])

    _run([py, "-m", "pip", "install", "-e", ".[desktop]", "pyinstaller>=6.0", "-q"])

    if BUILD.exists():
        shutil.rmtree(BUILD)
    exe_path = DIST / "CursorFlash.exe"
    if exe_path.exists():
        exe_path.unlink()
    stale_dir = DIST / "CursorFlash"
    if stale_dir.exists():
        shutil.rmtree(stale_dir)

    _run([py, "-m", "PyInstaller", "--noconfirm", "--clean", "--distpath", str(DIST), str(SPEC)])

    if not exe_path.is_file():
        raise SystemExit(f"Expected executable missing: {exe_path}")

    zip_path = DIST / f"CursorFlash-windows-x64-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe_path, arcname="CursorFlash.exe")
    print(f"Built {zip_path} ({zip_path.stat().st_size // (1024 * 1024)} MB)")


if __name__ == "__main__":
    main()
