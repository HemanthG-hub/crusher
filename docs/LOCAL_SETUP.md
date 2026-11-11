# Local Windows setup

QUARRY ONE is intended to run on the same computer as the application server and PostgreSQL. The default services bind only to loopback:

- Frontend: `127.0.0.1:5173`
- API: `127.0.0.1:8000`
- PostgreSQL: `127.0.0.1:5432`

Use the scripts and prerequisites in [README.md](../README.md). Docker Compose is the supported automated database path. Native PostgreSQL works with the documented manual start procedure.

For private office-LAN access, do not expose PostgreSQL. Bind the API and frontend only to a private interface as a deliberate deployment change, configure a strict CORS allowlist and firewall scope, and place TLS/authenticated reverse-proxy controls in front of the application. This is not included in the Phase 1 setup.
