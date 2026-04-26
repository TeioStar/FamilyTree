#!/usr/bin/env sh
set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
VENV="$ROOT/.venv"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi

"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$ROOT/backend/requirements.txt"
"$VENV/bin/python" -m uvicorn app.main:app --app-dir "$ROOT/backend" --host 127.0.0.1 --port 8000 --reload
