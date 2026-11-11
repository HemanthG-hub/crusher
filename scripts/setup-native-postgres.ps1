$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$dataDirectory = "C:\Program Files\PostgreSQL\17\data"
$serviceName = "postgresql-x64-17"
$psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$pgIsReady = "C:\Program Files\PostgreSQL\17\bin\pg_isready.exe"
$runDirectory = Join-Path $root ".run"
$resultFile = Join-Path $runDirectory "native-postgres-setup.status"
$logFile = Join-Path $runDirectory "native-postgres-setup.log"
$temporarySql = Join-Path $runDirectory "native-postgres-setup.sql"
$postgresConfig = Join-Path $dataDirectory "postgresql.conf"
$hostAuthConfig = Join-Path $dataDirectory "pg_hba.conf"
$originalPostgresConfig = $null
$originalHostAuthConfig = $null
$configurationChanged = $false

function Write-SetupLog([string]$message) {
    $entry = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $message
    Add-Content -Path $logFile -Value $entry
    Write-Output $entry
}

function Restart-PostgresService {
    $service = Get-Service -Name $serviceName -ErrorAction Stop
    if ($service.Status -ne "Stopped") {
        Stop-Service -Name $serviceName -Force
        $stopped = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            if ((Get-Service -Name $serviceName).Status -eq "Stopped") { $stopped = $true; break }
            Start-Sleep -Seconds 1
        }
        if (!$stopped) { throw "PostgreSQL service did not stop in time." }
    }
    Start-Service -Name $serviceName
    $running = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ((Get-Service -Name $serviceName).Status -eq "Running") { $running = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$running) { throw "PostgreSQL service did not start in time." }
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & $pgIsReady -h 127.0.0.1 -p 5432 *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw "PostgreSQL did not become ready after the service restart." }
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this setup script as administrator."
    }
    if (!(Test-Path $envFile) -or !(Test-Path $psql) -or !(Test-Path $postgresConfig) -or !(Test-Path $hostAuthConfig)) {
        throw "The local environment file or PostgreSQL 17 installation is missing."
    }

    $envLines = Get-Content $envFile
    $appPasswordLine = $envLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' } | Select-Object -First 1
    $appPassword = if ($appPasswordLine) { $appPasswordLine.Substring("POSTGRES_PASSWORD=".Length) } else { "" }
    if ($appPassword -notmatch '^[a-f0-9]{32}$') {
        throw "The generated local PostgreSQL password is missing or invalid; rerun scripts\start-dev.ps1 first."
    }
    if (!(Test-Path $runDirectory)) { New-Item -ItemType Directory -Force $runDirectory | Out-Null }
    Set-Content -Path $resultFile -Value "Running"
    Write-SetupLog "Configuring PostgreSQL to accept local connections only."

    $originalPostgresConfig = Get-Content $postgresConfig -Raw
    $originalHostAuthConfig = Get-Content $hostAuthConfig -Raw
    Write-SetupLog "Applying loopback-only PostgreSQL configuration."
    $loopbackConfig = [regex]::Replace(
        $originalPostgresConfig,
        "(?m)^\s*#?\s*listen_addresses\s*=.*$",
        "listen_addresses = '127.0.0.1'",
        1
    )
    if ($loopbackConfig -ceq $originalPostgresConfig) {
        $loopbackConfig = $originalPostgresConfig.TrimEnd() + "`r`nlisten_addresses = '127.0.0.1'`r`n"
    }
    [System.IO.File]::WriteAllText($postgresConfig, $loopbackConfig, [System.Text.UTF8Encoding]::new($false))
    $temporaryTrust = "host all postgres 127.0.0.1/32 trust`r`n" + $originalHostAuthConfig
    [System.IO.File]::WriteAllText($hostAuthConfig, $temporaryTrust, [System.Text.UTF8Encoding]::new($false))
    $configurationChanged = $true
    Write-SetupLog "Restarting PostgreSQL for temporary local administrator bootstrap."
    Restart-PostgresService

    $randomBytes = New-Object byte[] 32
    $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $random.GetBytes($randomBytes)
    $adminPassword = [System.BitConverter]::ToString($randomBytes).Replace("-", "").ToLowerInvariant()
    $random.Dispose()

    $existingRole = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -w -t -A -c "SELECT 1 FROM pg_roles WHERE rolname = 'quarry_one';"
    if ($LASTEXITCODE -ne 0) { throw "Could not query local PostgreSQL roles." }
    $roleExists = (@($existingRole) -join "").Trim() -eq "1"
    $roleStatement = if ($roleExists) {
        "ALTER ROLE quarry_one WITH LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
    } else {
        "CREATE ROLE quarry_one WITH LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;"
    }

    $existingDatabase = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -w -t -A -c "SELECT 1 FROM pg_database WHERE datname = 'quarry_one';"
    if ($LASTEXITCODE -ne 0) { throw "Could not query local PostgreSQL databases." }
    $databaseExists = (@($existingDatabase) -join "").Trim() -eq "1"
    $databaseStatement = if ($databaseExists) {
        "ALTER DATABASE quarry_one OWNER TO quarry_one;"
    } else {
        "CREATE DATABASE quarry_one OWNER quarry_one;"
    }
    $sql = "ALTER ROLE postgres WITH PASSWORD '$adminPassword';`r`n$roleStatement`r`n$databaseStatement`r`n"
    [System.IO.File]::WriteAllText($temporarySql, $sql, [System.Text.UTF8Encoding]::new($false))
    & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -w -v ON_ERROR_STOP=1 -f $temporarySql
    if ($LASTEXITCODE -ne 0) { throw "Could not securely initialize the local application database." }
    Remove-Item $temporarySql -Force

    [System.IO.File]::WriteAllText($hostAuthConfig, $originalHostAuthConfig, [System.Text.UTF8Encoding]::new($false))
    $configurationChanged = $false
    Restart-PostgresService

    $envLines = @($envLines | Where-Object { $_ -notmatch '^POSTGRES_ADMIN_PASSWORD=' })
    $envLines += "POSTGRES_ADMIN_PASSWORD=$adminPassword"
    $envLines = @($envLines | Where-Object { $_ -notmatch '^DATABASE_BACKEND=' })
    $envLines += "DATABASE_BACKEND=native"
    [System.IO.File]::WriteAllLines($envFile, $envLines, [System.Text.UTF8Encoding]::new($false))

    $env:PGPASSWORD = $appPassword
    & $psql -h 127.0.0.1 -p 5432 -U quarry_one -d quarry_one -w -v ON_ERROR_STOP=1 -t -A -c "SELECT current_user, current_database();"
    if ($LASTEXITCODE -ne 0) { throw "The application database login did not verify." }
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Write-SetupLog "Local application database and least-privilege app role verified; server listens on loopback only."
    Set-Content -Path $resultFile -Value "Completed"
} catch {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    if (Test-Path $temporarySql) { Remove-Item $temporarySql -Force -ErrorAction SilentlyContinue }
    if ($configurationChanged -and $originalPostgresConfig -and $originalHostAuthConfig) {
        [System.IO.File]::WriteAllText($postgresConfig, $originalPostgresConfig, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($hostAuthConfig, $originalHostAuthConfig, [System.Text.UTF8Encoding]::new($false))
        try { Restart-PostgresService } catch { }
    }
    Write-SetupLog "Setup failed on line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)"
    Set-Content -Path $resultFile -Value "Failed"
    throw
} finally {
    $appPassword = $null
    $adminPassword = $null
    $sql = $null
}
