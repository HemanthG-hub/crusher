$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (!(Test-Path $envFile)) {
    Copy-Item (Join-Path $root ".env.example") $envFile
    $bytes = New-Object byte[] 48
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($bytes)
    $secret = [System.BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
    $password = $secret.Substring(0, 32)
    $contents = Get-Content $envFile -Raw
    $contents = $contents.Replace("local-only-change-me", $password)
    $contents = $contents.Replace("replace-this-with-a-random-secret-at-least-32-characters", $secret)
    $databaseUrl = "postgresql+psycopg://quarry_one:$password@127.0.0.1:5432/quarry_one"
    $contents = [regex]::Replace($contents, "(?m)^DATABASE_URL=.*$", "DATABASE_URL=$databaseUrl")
    [System.IO.File]::WriteAllText($envFile, $contents, [System.Text.UTF8Encoding]::new($false))
    $generator.Dispose()
    Write-Output "Created local .env with generated secrets. Keep it private; it is git-ignored."
}

$databaseBackend = "docker"
$backendLine = Get-Content $envFile | Where-Object { $_ -match '^DATABASE_BACKEND=' } | Select-Object -First 1
if ($backendLine) { $databaseBackend = $backendLine.Substring("DATABASE_BACKEND=".Length).Trim().ToLowerInvariant() }
if ($databaseBackend -notin @("docker", "native")) { throw "DATABASE_BACKEND must be 'docker' or 'native'." }
$docker = Get-Command docker.exe -ErrorAction SilentlyContinue
$pythonExecutable = $null
$pythonLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
if ($pythonLauncher) {
    $resolvedPython = & $pythonLauncher.Source -3 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $resolvedPython) {
        $pythonExecutable = "$resolvedPython".Trim()
    }
}
if (!$pythonExecutable) {
    foreach ($candidate in @(
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python312\python.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python311\python.exe"),
        (Join-Path $env:ProgramFiles "Python313\python.exe"),
        (Join-Path $env:ProgramFiles "Python312\python.exe"),
        (Join-Path $env:ProgramFiles "Python311\python.exe")
    )) {
        if (Test-Path $candidate) { $pythonExecutable = $candidate; break }
    }
}
if (!$pythonExecutable -or !(Test-Path $pythonExecutable)) { throw "Python 3.11+ is required. Install Python and retry." }
$pythonVersion = & $pythonExecutable --version 2>&1
if ($LASTEXITCODE -ne 0) { throw "Python is not installed or is not available on PATH." }
$pythonVersionMatch = [regex]::Match("$pythonVersion", "Python 3\.(\d+)")
if (!$pythonVersionMatch.Success) { throw "Could not determine the installed Python version." }
if ([int]$pythonVersionMatch.Groups[1].Value -lt 11) { throw "Python 3.11 or newer is required; found $pythonVersion." }
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (!$nodeCommand) { throw "Node.js 20+ is required. Install Node.js and retry." }
$nodeVersion = & $nodeCommand.Source --version 2>&1
if ($LASTEXITCODE -ne 0) { throw "Node.js is not installed or is not available on PATH." }
$nodeVersionMatch = [regex]::Match("$nodeVersion", "v?(\d+)\.")
if (!$nodeVersionMatch.Success) { throw "Could not determine the installed Node.js version." }
if ([int]$nodeVersionMatch.Groups[1].Value -lt 20) { throw "Node.js 20 or newer is required; found $nodeVersion." }
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (!$npmCommand) { throw "Node.js 20+ and npm are required. Install Node.js and retry." }

Push-Location $root
try {
    if ($databaseBackend -eq "docker") {
        if (!$docker) { throw "Docker Desktop is required. Install it, or use the documented native PostgreSQL setup." }
        & $docker.Source compose up -d --wait --wait-timeout 60
        if ($LASTEXITCODE -ne 0) { throw "PostgreSQL container did not start." }
    } else {
        $pgReady = "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe"
        if (!(Test-Path $pgReady)) { throw "Native PostgreSQL 17 is not installed. Run scripts\setup-native-postgres.ps1 as administrator." }
        & $pgReady -h 127.0.0.1 -p 5432
        if ($LASTEXITCODE -ne 0) { throw "Native PostgreSQL is not ready. Check the postgresql-x64-17 Windows service." }
    }

    $backend = Join-Path $root "backend"
    $venvPython = Join-Path $backend ".venv\Scripts\python.exe"
    if (!(Test-Path $venvPython)) {
        & $pythonExecutable -m venv (Join-Path $backend ".venv")
        if ($LASTEXITCODE -ne 0) { throw "Could not create the backend virtual environment." }
    }
    Push-Location $backend
    try {
        & $venvPython -m pip install -r "requirements.lock"
        if ($LASTEXITCODE -ne 0) { throw "Pinned backend dependency installation failed." }
        & $venvPython -m pip install -e . --no-deps
        if ($LASTEXITCODE -ne 0) { throw "Backend package installation failed." }
        & $venvPython -m alembic upgrade head
        if ($LASTEXITCODE -ne 0) { throw "Database migration failed." }
    } finally {
        Pop-Location
    }

    $frontend = Join-Path $root "frontend"
    $frontendLock = Join-Path $frontend "package-lock.json"
    $installedFrontendLock = Join-Path $frontend "node_modules\.package-lock.json"
    $frontendDependenciesNeedInstall = !(Test-Path $installedFrontendLock)
    if (!$frontendDependenciesNeedInstall) {
        $lockTimestamp = (Get-Item $frontendLock).LastWriteTimeUtc
        $installedTimestamp = (Get-Item $installedFrontendLock).LastWriteTimeUtc
        $frontendDependenciesNeedInstall = $lockTimestamp -gt $installedTimestamp
    }
    Push-Location $frontend
    try {
        if ($frontendDependenciesNeedInstall) {
            & $npmCommand.Source ci
            if ($LASTEXITCODE -ne 0) { throw "Frontend dependency installation failed." }
        } else {
            Write-Output "Frontend dependencies already match the lockfile."
        }
    } finally {
        Pop-Location
    }

    $runDir = Join-Path $root ".run"
    New-Item -ItemType Directory -Force $runDir | Out-Null
    $backendLog = Join-Path $runDir "backend.log"
    $backendErrorLog = Join-Path $runDir "backend-error.log"
    $frontendLog = Join-Path $runDir "frontend.log"
    $frontendErrorLog = Join-Path $runDir "frontend-error.log"

    $apiReady = $false
    try {
        $null = Invoke-RestMethod "http://127.0.0.1:8000/api/v1/health/ready" -TimeoutSec 2
        $apiReady = $true
    } catch { }
    if (!$apiReady) {
        $backendProcess = Start-Process -FilePath $venvPython `
            -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000" `
            -WorkingDirectory (Join-Path $root "backend") -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog
        Set-Content (Join-Path $runDir "backend.pid") $backendProcess.Id
    }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-RestMethod "http://127.0.0.1:8000/api/v1/health/ready" -TimeoutSec 2
            $apiReady = $true
            break
        } catch { }
    }
    if (!$apiReady) { throw "API did not become ready. See .run\backend-error.log for details." }
    $frontendReady = $false
    try {
        $null = Invoke-WebRequest "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 5
        $frontendReady = $true
    } catch { }
    if (!$frontendReady) {
        $viteEntrypoint = Join-Path $root "frontend\node_modules\vite\bin\vite.js"
        $frontendProcess = Start-Process -FilePath $nodeCommand.Source `
            -ArgumentList "`"$viteEntrypoint`" --host 127.0.0.1 --port 5173 --strictPort" `
            -WorkingDirectory (Join-Path $root "frontend") `
            -PassThru -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrorLog
        Set-Content (Join-Path $runDir "frontend.pid") $frontendProcess.Id
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Seconds 1
            try {
                $null = Invoke-WebRequest "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 2
                $frontendReady = $true
                break
            } catch { }
        }
    }
    if (!$frontendReady) { throw "Frontend did not become ready. See .run\frontend-error.log for details." }
    Write-Output "QUARRY ONE is running."
    Write-Output "Dashboard: http://127.0.0.1:5173"
    Write-Output "API docs:  http://127.0.0.1:8000/docs"
    Write-Output "Create the first admin: .\scripts\bootstrap-admin.ps1"
} finally {
    Pop-Location
}
