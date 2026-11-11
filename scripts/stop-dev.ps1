$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runDir = Join-Path $root ".run"
foreach ($name in @("frontend", "backend")) {
    $pidPath = Join-Path $runDir "$name.pid"
    if (Test-Path $pidPath) {
        $processId = [int](Get-Content $pidPath -Raw)
        $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
        $expectedPath = if ($name -eq "backend") {
            Join-Path $root "backend\.venv\Scripts\python.exe"
        } else {
            (Get-Command node.exe -ErrorAction SilentlyContinue).Source
        }
        if ($process -and $expectedPath -and $process.Path -eq $expectedPath) {
            Stop-Process -Id $processId
        } elseif ($process) {
            Write-Warning "PID $processId is no longer the expected $name process; leaving it untouched."
        }
        Remove-Item $pidPath
    }
}
Write-Output "Application processes stopped. PostgreSQL remains running; stop it with 'docker compose stop postgres'."
