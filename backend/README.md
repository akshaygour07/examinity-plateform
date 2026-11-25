# Examinity Module 1 Backend

NestJS modular monolith for Examinity Module 1. It provides the REST API for identity synchronization, user and role administration, API token sessions, platform configuration, feature flags, audit events, media, and the authenticated dashboard.

The Next.js frontend and Auth0 backend-for-frontend (BFF) are maintained separately. The BFF owns browser login, callback handling, the browser session cookie, and token renewal. This API validates Auth0 **API access tokens** on protected routes; it does not create browser sessions or refresh tokens.

## Stack

- Node.js 24 and TypeScript
- NestJS 12
- PostgreSQL 18 and Prisma 7
- pnpm 12.15.0
- REST API under `/api/v1`, documented with Swagger/OpenAPI
- Docker Compose and GitLab CI

## Project layout

```text
backend/
├── docs/          # API, architecture, and deployment references
├── prisma/        # Database schema, migrations, and seed data
├── scripts/       # Local demo and verification commands
├── src/
│   ├── audit/     # Audit event recording and queries
│   ├── auth/      # Token validation, identity sync, authorization
│   ├── common/    # Shared request, response, and error handling
│   ├── dashboard/ # Authenticated landing-page endpoint
│   ├── database/  # Prisma service and module
│   ├── media/     # Media upload and access services
│   ├── notifications/ # Email notification providers
│   ├── platform/  # Runtime configuration and feature flags
│   ├── roles/     # Roles, permissions, and assignments
│   ├── sessions/  # Observed API token session management
│   ├── users/     # User lifecycle and administration
│   └── verification/ # Identity verification workflows
└── test/          # Automated tests
```

## Local setup

Prerequisites: Node.js 24, Corepack, pnpm 12, and either PostgreSQL 18 or Docker with Compose.

From this `backend` directory:

```powershell
Copy-Item .env.example .env
corepack pnpm install --frozen-lockfile
corepack pnpm db:generate
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm start:dev
```

Set the local database and Auth0 values in `.env` before starting the API. Confirm `DATABASE_URL` points to the intended development database before applying migrations or seed data. Never commit `.env` or credentials.

For the bundled local stack, configure the values required by `docker-compose.yml` and run:

```powershell
docker compose up --build
```

The API listens on `http://localhost:4000` by default.

## API and health endpoints

| Purpose                  | Endpoint                         |
| ------------------------ | -------------------------------- |
| API base                 | `http://localhost:4000/api/v1`   |
| Swagger UI               | `http://localhost:4000/api/docs` |
| Liveness                 | `GET /health/live`               |
| Readiness                | `GET /health/ready`              |
| Current user's dashboard | `GET /api/v1/dashboard`          |

Readiness checks required runtime configuration and PostgreSQL connectivity. Dashboard navigation reflects effective permissions, but each API route separately enforces authorization.

## Authentication and identity

The frontend/BFF handles Auth0 Authorization Code with PKCE and maintains the browser session. For API calls, it sends an Auth0 API access token in `Authorization: Bearer <access-token>`. The backend verifies the token signature, issuer, audience, expiry, and required claims. ID tokens are not accepted as API credentials.

On first `POST /api/v1/auth/sync`, the backend resolves the verified Auth0 `sub`, creates the local profile, and records explicit Terms acceptance. Verified identities can be activated with the baseline `AUTHENTICATED_USER` role; unverified identities remain pending until verification and a later sync. Email and phone are not used to link accounts. Disabled or suspended accounts are not reactivated by login.

Access-token renewal belongs to the BFF/Auth0 integration. The backend rejects expired tokens and does not renew them. If the BFF cannot renew its credentials, it must send the user through sign-in again.

## API token sessions

The session endpoints track API bearer tokens that have successfully called this backend. They store a fingerprint of the token, not the raw token, and support listing, inspecting, and revoking a user's observed API sessions. Revocation is enforced on subsequent protected requests.

These records represent Examinity API access. They do not clear the browser's BFF cookie, terminate Auth0 SSO, or revoke an Auth0 refresh token. Logout therefore requires the frontend to clear its own session and perform the configured Auth0 logout as well.

## Verification

```powershell
corepack pnpm lint
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm db:generate
corepack pnpm exec prisma validate
corepack pnpm build
```

`corepack pnpm smoke:identity` requires a verified, isolated test database. It creates fixtures and append-only audit evidence; never point it at data that must be retained. The smoke test uses a local synthetic JWKS issuer, not a live Auth0 tenant.

## Client and deployment references

- [Admin API contract](docs/admin-api-contract.md)
- [Deployment guide](docs/hostinger-deployment.md)

Swagger at `/api/docs` is the generated API reference when the service is running.

The CI pipeline is configured for pnpm installation, database setup, lint/format/type checks, tests, build, identity smoke verification, dependency and security scans, and Docker image checks. Docker-in-Docker stages require a compatible GitLab runner.

## Scope note

The requested WhatsApp/SMS fallback authentication flow conflicts with the documented Module 1 exclusion and remains subject to client decision. Auth0 Universal Login owns passwordless email/phone and approved social sign-in; the backend does not store passwords or OTPs.
