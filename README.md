# QUARRY ONE

Local-first crusher operations and workforce management foundation. The app includes the Phase 1 authentication/API foundation plus an interactive, browser-local demo of the sidebar modules. The module demo is for workflow preview and is not a production ERP data store.

## Requirements

- Windows 10/11 with PowerShell 5.1 or later
- Python 3.11+
- Node.js 20+
- Docker Desktop with Docker Compose (default local PostgreSQL setup)

The supplied dashboard reference image was not present in the workspace or attachments when this implementation was created. The dashboard follows the visual description in the project brief; pixel-level comparison remains pending.

## Start locally

From the project root in PowerShell:

```powershell
.\scripts\start-dev.ps1
```

The script creates `.env` with generated local secrets if needed, starts PostgreSQL bound only to `127.0.0.1`, installs pinned dependencies, applies Alembic migrations, and launches the frontend and API on loopback. The script does **not** create an administrator automatically.

Create the first administrator in a separate PowerShell window:

```powershell
.\scripts\bootstrap-admin.ps1
```

The script prompts for an email, full name, and a temporary password of at least 12 characters. On first sign-in, the administrator must choose a new password. No default administrator credentials are included.

Open:

- Dashboard: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:8000>
- Swagger (development only): <http://127.0.0.1:8000/docs>
- API health: <http://127.0.0.1:8000/api/v1/health>
- API readiness/database health: <http://127.0.0.1:8000/api/v1/health/ready>

Stop the frontend and API processes:

```powershell
.\scripts\stop-dev.ps1
docker compose stop postgres
```

The PostgreSQL named volume remains intact. Use `docker compose down` to stop and remove the container, **not** the named volume. Do not use `docker compose down -v` unless you intend to permanently delete the local database.

### Native PostgreSQL alternative

If Docker Desktop is unavailable, install PostgreSQL 16 or newer locally. Create a database and least-privilege application role, bind PostgreSQL to loopback, and configure `.env` with the matching `DATABASE_URL`. Do not expose port 5432 to the internet.

The bundled native PostgreSQL setup targets PostgreSQL 17 at its default Windows install location and port 5432. For a fresh setup, run the startup script once to generate `.env`, set `DATABASE_BACKEND=native`, install PostgreSQL 17, then configure the loopback-only server and application database from an elevated PowerShell window:

```powershell
winget install --id PostgreSQL.PostgreSQL.17 --exact
Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\BYAN-TECHNOLOGY\scripts\setup-native-postgres.ps1"' -Wait
```

The setup uses a temporary localhost-only bootstrap rule, creates/updates a least-privilege `quarry_one` database role, sets a random local `postgres` administrator password in ignored `.env`, restores password authentication, and binds PostgreSQL to loopback. Keep `.env` private.

Then start the application:

```powershell
.\scripts\start-dev.ps1
```

Use these commands for manually starting the frontend while troubleshooting:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Create the admin with `.\scripts\bootstrap-admin.ps1` from the project root after the API is ready. If PowerShell blocks scripts, use an appropriately scoped execution-policy option.

## Configuration and security notes

- `.env.example` documents local settings. `.env` is ignored by Git. The startup script generates local JWT and PostgreSQL passwords when it creates `.env`.
- `DATABASE_URL`, `JWT_SECRET`, token lifetime, CORS origins, and log level are environment-configurable.
- Passwords use Argon2id hashing. Access JWTs expire after 20 minutes by default. There is no refresh-token endpoint; logout and password changes increment a token version and revoke existing access tokens.
- Roles and plant assignments are checked on the API. Plant selection is checked against the authenticated user's authorized plant assignments. Sensitive administrative actions are permission-gated and audited.
- The bootstrap password is prompted securely and passed to the one-shot process; do not put production credentials in source control or expose the development `.env`.
- Localhost is the only supported/default binding. For office-LAN access, explicitly configure the frontend/API to bind to a private LAN interface, allow only the required private subnet through the host firewall, restrict CORS, use TLS/reverse proxy controls, and keep PostgreSQL reachable only from the application host. This setup has not been hardened or tested for LAN or internet deployment.
- No external AI provider is connected. The sidebar assistant is a rule-based demo that answers a small set of questions from browser-local sample records; no AI provider key is needed to start.

## Database operations

Run migrations explicitly:

```powershell
.\scripts\migrate.ps1
```

Create a compressed PostgreSQL backup and restore one (restore replaces existing records and requires typing `RESTORE`):

```powershell
.\scripts\backup-db.ps1
.\scripts\restore-db.ps1 -BackupFile .\backups\quarry-one-YYYYMMDD-HHMMSS.dump
```

Backups are local files in the ignored `backups\` directory. Copy and protect them using your organization's backup policy. Periodically test restore procedures against a separate database before relying on backups.

## Development checks

Frontend:

```powershell
Set-Location .\frontend
npm install
npm run typecheck
npm run lint
npm run build
```

Backend (from a configured Python environment):

```powershell
Set-Location .\backend
python -m pip install -r requirements.lock
python -m pip install -e . --no-deps
python -m pytest
```

The API requires PostgreSQL for migrations and runtime health/readiness checks. Configure a separate test database before adding database integration tests. Never point destructive tests at a production database. The committed frontend `package-lock.json` and backend `requirements.lock` pin the resolved dependency sets.

## Implemented scope and limitations

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for what is implemented, partially implemented, tested, and pending. The initial migration creates only company, plant, user, role, access-assignment, and audit-log tables. The business modules described below are interactive frontend demos, not PostgreSQL-backed transaction modules.

### Browser-local module demo

After signing in, the sidebar includes sample workflows for Operations, Weighbridge, Production, Stock & Inventory, Sales & Billing, Dispatch & Transport, Accounts & Expenses, Diesel & Fuel, HR & Payroll, Maintenance, Reports, AI Assistant, and Settings. The sample pages let you add, edit, and delete module records; weighbridge net weight and stock balance are calculated, reports can be exported to CSV, and the assistant answers a small set of rule-based questions. The dashboard includes sales revenue trends and material-level production/sales quantity charts with current-week and current-month filters. Diesel & Fuel reports vehicle consumption in L/100 km and machine consumption in L/engine-hour. It shows a vehicle alert when the latest rate is more than 30% above the average of at least two earlier measured intervals. Settings can restore the original sample records.

These are demo records stored in the browser's `localStorage`; they are not sent to FastAPI/PostgreSQL, shared with other users, or included in database backups. Sample payroll amounts are not statutory calculations. The assistant is not connected to an AI provider. Do not enter real personal, payroll, customer, or financial information in the demo pages.
