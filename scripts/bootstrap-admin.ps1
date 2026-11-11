$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root "backend\.venv\Scripts\python.exe"
if (!(Test-Path $python)) {
    throw "Backend environment not found. Run scripts\start-dev.ps1 first."
}

$email = Read-Host "Administrator email"
$name = Read-Host "Administrator full name"
$securePassword = Read-Host "Temporary administrator password (12+ characters)" -AsSecureString
$password = [System.Net.NetworkCredential]::new("", $securePassword).Password
if ($password.Length -lt 12) { throw "Password must contain at least 12 characters." }

$env:BOOTSTRAP_ADMIN_EMAIL = $email
$env:BOOTSTRAP_ADMIN_NAME = $name
$env:BOOTSTRAP_ADMIN_PASSWORD = $password
Push-Location (Join-Path $root "backend")
try {
    & $python "scripts\bootstrap_admin.py"
    if ($LASTEXITCODE -ne 0) { throw "Administrator bootstrap failed with exit code $LASTEXITCODE." }
} finally {
    Remove-Item Env:\BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:\BOOTSTRAP_ADMIN_NAME -ErrorAction SilentlyContinue
    Remove-Item Env:\BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
    Pop-Location
}
