$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupDir = Join-Path $root "backups"
New-Item -ItemType Directory -Force $backupDir | Out-Null
$backupName = "quarry-one-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss")
$backupFile = Join-Path $backupDir $backupName
$containerBackup = "/tmp/$backupName"
Push-Location $root
try {
    & docker compose exec -T postgres pg_dump -U quarry_one -d quarry_one -Fc -f $containerBackup
    if ($LASTEXITCODE -ne 0) { throw "Database backup failed." }
    & docker compose cp "postgres:$containerBackup" $backupFile
    if ($LASTEXITCODE -ne 0) { throw "Could not copy the database backup out of PostgreSQL." }
    & docker compose exec -T postgres rm -f $containerBackup
    Write-Output "Backup created: $backupFile"
} finally {
    Pop-Location
}
