$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Venv = Join-Path $Root ".venv"
$Python = Join-Path $Venv "Scripts\python.exe"

if (-not (Test-Path $Python)) {
  python -m venv $Venv
}

& $Python -m pip install --upgrade pip
& $Python -m pip install -r (Join-Path $Root "backend\requirements.txt")
& $Python -m uvicorn app.main:app --app-dir (Join-Path $Root "backend") --host 127.0.0.1 --port 8000 --reload
