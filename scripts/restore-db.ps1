param([Parameter(Mandatory = $true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$resolvedBackup = (Resolve-Path $BackupFile).Path
$confirmation = Read-Host "This replaces the current quarry_one database. Type RESTORE to continue"
if ($confirmation -cne "RESTORE") { throw "Restore cancelled." }
$root = Split-Path -Parent $PSScriptRoot
$containerBackup = "/tmp/quarry-one-restore-{0}.dump" -f ([guid]::NewGuid().ToString("N"))
Push-Location $root
try {
    & docker compose cp $resolvedBackup "postgres:$containerBackup"
    if ($LASTEXITCODE -ne 0) { throw "Could not copy the backup into PostgreSQL." }
    & docker compose exec -T postgres pg_restore -U quarry_one -d quarry_one --clean --if-exists --no-owner $containerBackup
    if ($LASTEXITCODE -ne 0) { throw "Database restore failed." }
    & docker compose exec -T postgres rm -f $containerBackup
    Write-Output "Database restored from $resolvedBackup"
} finally {
    Pop-Location
}
