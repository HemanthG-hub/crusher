# Implementation status

Last updated: 2026-10-28

## Implemented in Phase 1

- Responsive React + TypeScript dashboard shell, login, plant selector, navigation, five KPI cards, quick actions, production/plant status panels, and explicit demo-data labels.
- FastAPI `/api/v1` application with development Swagger, CORS allowlist, JSON-formatted logs, liveness and PostgreSQL readiness routes.
- PostgreSQL/SQLAlchemy 2.x schema and initial Alembic migration for companies, plants, users, roles, user-role assignments, plant access, and audit events.
- Argon2id password hashing, short-lived JWT access tokens, active-user checks, token-version invalidation on logout/password change, required first-login password change, and generic invalid-credential responses.
- Permission checks for role, user, plant-creation, and audit-log operations; plant-scoped plant listing and explicit plant authorization for dashboard scope.
- Idempotent administrator bootstrap by configured email and prompted credentials; seeded role names; no universal account password.
- Local Docker Compose PostgreSQL service bound to loopback, Windows startup/stop/migration/bootstrap/backup/restore scripts, and installation/security notes.
- Dashboard KPI API returns explicit zero/no-data values; operational figures are not fabricated.
- Interactive browser-local demo pages for Operations, Weighbridge, Production, Stock & Inventory, Sales & Billing, Dispatch & Transport, Accounts & Expenses, Diesel & Fuel, HR & Payroll, Maintenance, Reports, AI Assistant, and Settings.
- Demo pages include seeded sample records, add/edit/delete forms, calculated weighbridge net weights and stock balances, summary totals, CSV export, local rule-based assistant responses, and a sample-data reset control.
- Dashboard charts show sales invoice revenue over this week / this month and material-level production versus sales tonnes for the selected period. Sales records include sample quantities to support material comparisons.
- Diesel & Fuel shows per-vehicle totals and L/100 km rates, machine totals and L/engine-hour rates, and a visible vehicle alert when the latest measured rate exceeds its prior measured-rate average by more than 30% (minimum two prior measured intervals).

## Partially implemented

- The sidebar modules are frontend demonstrations only. Their records persist in the current browser's `localStorage`; they are not sent to FastAPI/PostgreSQL, shared between users, audited by the backend, or included in database backups.
- Diesel consumption and unusual-consumption alerts are estimates from manually entered browser-local fuel and odometer / engine-hour readings; they are not connected to fuel sensors, vehicle telematics, or backend notifications.
- Roles are seeded as names with a small initial permission set. Role editing, role CRUD, fine-grained permission administration, account activation/reset workflows, and user-management UI remain pending.
- Plant records can be created through the API. Plant/company settings UI, full audit-log UI, operational plant status, and company administration are pending.
- Audit events cover login, login failure for known accounts, denied permissions, user/plant creation, and password change. Additional business event classes depend on future modules.
- Dashboard visual layout follows the supplied text description only. The referenced PNG was not found in the repository or attachment set, so visual comparison is not yet possible.
- The AI Assistant page is a small rule-based demo over browser sample records, not an LLM integration. No AI provider is connected. Payroll values are examples and are not statutory calculations.
- The initial automated test suite covers password hashing, plant-scope authorization helpers, forced password-change access control, mocked login/logout behavior, API liveness/auth responses, and explicit empty-dashboard values. PostgreSQL-backed API, migration, and end-to-end cross-plant integration tests remain pending.
- Frontend production build, TypeScript checks, and lint pass. A browser check verified that module pages render and that adding, reloading, and deleting a sample record persists correctly.

## Pending implementation phases

- Phase 2: PostgreSQL-backed products, vehicles, production records, weighbridge simulator/connector, auditable stock ledger, dispatch, and billing; replace the browser-local demos with authorized APIs.
- Phase 3: PostgreSQL-backed employee master, attendance sources and calculations, shifts, leave, versioned salary rules, payroll preparation/approval separation, and payslips.
- Phase 4: AI provider abstraction and permission-checked typed business tools with audited, minimized context.
- Phase 5: maintenance, diesel/fuel, operational reports, notifications, and analytics.
- Phase 6: deployment hardening, broader backup/restore validation, compliance review, complete tests, and operational documentation.

## Production-readiness gaps

This is a development foundation, not a production-ready ERP or payroll system. It has no operational ledger transactions, refresh-token/revocation service, rate limiting, CSRF/session-cookie design, biometric or weighbridge hardware integration, statutory payroll rules, tax/e-invoice integration, or external AI service. Validate legal/accounting rules and security controls before production use.
