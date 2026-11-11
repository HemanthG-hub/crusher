$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
if (!(Test-Path $python)) {
    throw "Backend environment not found. Run scripts\start-dev.ps1 first."
}
Push-Location (Join-Path $root "backend")
try {
    & $python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "Database migration failed with exit code $LASTEXITCODE." }
} finally {
    Pop-Location
}
