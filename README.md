# cursor-vscdb

Inspect and selectively clean Cursor `state.vscdb`.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
pytest
vscdb status
uvicorn cursor_vscdb.api.app:app --reload --port 8787
```

Then open the React app in `web/` (see Task 12).
