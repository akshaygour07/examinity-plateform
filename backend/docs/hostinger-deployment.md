# Examinity Backend: Hostinger VPS Deployment Guide

**Audience:** Integration developers, DevOps, backend and production support  
**Repository:** `backend/` in the Examinity repository  
**Last reviewed:** 29 October 2026  
**Status:** Deployment handover; production values and external account details must be supplied by the project owner.

## 1. Purpose and deployment flow

This guide describes how to deploy the NestJS API and PostgreSQL database to a Hostinger VPS, expose the API safely over HTTPS, and operate future releases. It is based on the checked-in backend configuration. The frontend is a separate application and is not included in this deployment.

```text
GitLab repository
    -> CI verification and Docker image build
    -> release on Hostinger VPS
    -> PostgreSQL migrations and catalogue seed
    -> API container on 127.0.0.1:4000
    -> Nginx reverse proxy + TLS
    -> API DNS name (for example api.<your-domain>)
```

The checked-in `.gitlab-ci.yml` verifies, builds, and scans the API image. It does **not** deploy to Hostinger. A deployment job, image registry/release transfer method, and protected production variables still need to be agreed and implemented. Until then, use the manual release procedure in section 8.

## 2. Verified application details

| Item                | Repository configuration                                   |
| ------------------- | ---------------------------------------------------------- |
| Runtime             | Node.js 24 (`>=24 <25`)                                    |
| Package manager     | pnpm 12.15.0                                               |
| Framework           | NestJS 12, Express                                         |
| Database            | PostgreSQL 18, Prisma 7                                    |
| API container port  | 4000 (configurable as `API_PORT`)                          |
| API prefix          | `/api/v1`                                                  |
| Liveness            | `GET /health/live`                                         |
| Readiness           | `GET /health/ready` (checks Auth0 settings and database)   |
| OpenAPI UI          | `/api/docs`                                                |
| Container           | `backend/Dockerfile`; non-root Node runtime user           |
| Local compose       | `backend/docker-compose.yml`                               |
| Database migrations | `pnpm db:deploy` (`prisma migrate deploy`)                 |
| Catalogue seed      | `pnpm db:seed` (idempotent upserts; creates no admin user) |

No Redis or BullMQ service is required by this backend. Do not treat the checked-in Compose file as a finished production topology without applying the production-specific settings below: it publishes ports on loopback for local use, and its API defaults include development/example Auth0 and CORS values.

## 3. Inputs the project owner must provide

Record and approve these before the production change window:

- Hostinger VPS plan, Ubuntu version, public IP, SSH access method and named operator/deployment account.
- API DNS name and DNS administrator; frontend production origin(s) for CORS.
- Auth0 production tenant issuer URL (with trailing slash), API audience, and confirmation that the API is registered/configured for production.
- PostgreSQL placement (same VPS or managed service), approved backup/restore owner and retention period.
- Email provider account, verified sender and reply-to address. The current code supports Resend when configured.
- S3-compatible object storage account, bucket, endpoint/region, and credentials if media upload/download is in production scope. The sample uses Cloudflare R2 values; choose the actual approved provider.
- GitLab production branch, protected environment approvers, image registry or release transfer, and deployment owner.
- Support contact, maintenance window, monitoring/log retention and incident escalation route.

Do not put production credentials in this document, Git, the Docker image, or unmasked pipeline output. Store them in the VPS secret environment file and/or protected GitLab variables.

## 4. Hostinger VPS and network setup

Use a Hostinger **VPS** with a supported Ubuntu LTS image. Shared hosting is not the target: this deployment needs containers (or a continuously supervised Node process), PostgreSQL connectivity, and Nginx control. Size CPU/RAM/disk from load and database estimates; the repository does not establish a sizing requirement.

1. Create a restricted operator account and a separate deployment account if CI will deploy. Use SSH keys; disable password SSH after verifying key access and recovery access.
2. Patch the OS. Install Docker Engine and the Docker Compose plugin from Docker's official Ubuntu repository, or install a compatible maintained distribution package. Verify `docker version` and `docker compose version`.
3. Configure the Hostinger/network firewall and Ubuntu firewall to allow inbound TCP 22 from approved operator addresses, TCP 80, and TCP 443. Do not expose TCP 5432 or 4000 publicly.
4. Create an API DNS `A` record pointing to the VPS IPv4 address (and `AAAA` only if IPv6 is correctly configured). Wait for DNS propagation before certificate issuance.
5. Install Nginx on the host. Keep the API container bound to `127.0.0.1:4000`, then proxy the API DNS name to it. Obtain and renew TLS using Certbot or the approved certificate method.
6. Configure unattended security updates or an agreed patch schedule, disk monitoring, time synchronization and log rotation.

## 5. Production configuration and secrets

Use `backend/.env.example` as the variable inventory, not as a production file. The Compose file reads `.env` from its project directory. Create `/opt/examinity/backend/.env` (or the approved deployment directory) on the VPS, restrict it to the deployment/runtime administrator (`chmod 600`), and never copy it into a public artifact. Keep a separately secured backup of the configuration without exposing it to developers who do not need secrets.

### Required API configuration

| Variable                      | Production value / handling                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                    | `production`                                                                                                                                            |
| `API_PORT`                    | `4000` inside the Compose network/container                                                                                                             |
| `DATABASE_URL`                | PostgreSQL URL reachable by the API/migration container; encode reserved password characters; use TLS options for a managed DB as its provider requires |
| `AUTH0_ISSUER_BASE_URL`       | Exact HTTPS Auth0 issuer URL, normally ending in `/`                                                                                                    |
| `API_AUDIENCE`                | Exact audience configured for the Auth0 API and clients                                                                                                 |
| `AUTH0_ADMIN_CLIENT_ID`       | Client ID of the separate admin Auth0 application; permission-protected routes reject tokens from other applications                                    |
| `CORS_ORIGINS`                | Comma-separated exact HTTPS browser origins, no wildcard; set to the production frontend origin(s)                                                      |
| `JWT_CLOCK_TOLERANCE_SECONDS` | Optional; defaults to 60; must be integer 0–300                                                                                                         |
| `AUTH0_CLAIM_NAMESPACE`       | Set to the namespace configured in the Auth0 token actions; admin access requires namespaced `admin_client_id` and `mfa` access-token claims            |
| `TERMS_VERSION`               | Optional; defaults to `v1`; coordinate with the currently published terms                                                                               |

The readiness route returns 503 until issuer, audience, clock tolerance, and PostgreSQL are valid. Production issuer and CORS origins must use HTTPS.

### Optional integrations

| Variables                                                                                                    | When needed                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`                                            | Set `EMAIL_PROVIDER=resend`, a valid Resend API key, verified sender and reply-to when transactional email is enabled. Without a valid provider, email sending requests fail. |
| `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Configure together for the approved S3-compatible media storage. Keep the bucket private; media access is mediated by the API/presigned URLs.                                 |

The phone-provider/Twilio and OTP encryption variables present in `.env.example` are explicitly marked legacy/out of scope for the Auth0-only Module 1 flow. Do not enable them for this deployment unless the product scope and security design are separately approved. `BOOTSTRAP_AUTH0_SUB` is a one-time administrative command input, not a permanent API setting.

### PostgreSQL

Prefer a managed PostgreSQL service when its network access, TLS and backup features meet project requirements. Otherwise run PostgreSQL on the VPS with a persistent Docker volume and loopback-only port binding as in Compose. Create a dedicated database and least-privilege application role. Restrict inbound DB traffic to the API host/private network. Never use the CI sample password or publicly expose port 5432.

Ensure the URL host matches where each command runs: for Compose services on one network, use the database service name (for example `postgres`); for a host process, use `127.0.0.1` or the managed provider hostname. Validate the final URL without printing its password.

## 6. One-time production preparation

1. Confirm the production branch contains the reviewed backend release and lockfile.
2. Confirm Hostinger OS, Docker/Compose, Nginx, firewall, DNS, SSH and TLS prerequisites.
3. Provision PostgreSQL and a dedicated database role; configure automated backups and perform a restore rehearsal before launch.
4. Configure Auth0 production API issuer/audience, allowed callback/logout settings for the separate frontend, and any token custom-claim action. The backend validates API access tokens; the frontend owns browser login/session. Never use an ID token as the API bearer token.
5. Set the API's production `.env` values and optional integration credentials. Review values with the application owner without pasting secrets into tickets or chat.
6. Configure the GitLab protected production environment and variables. Pin/verify the VPS SSH host key out of band. Use a deploy-only SSH key and least-privilege account. Do not run an unreviewed `ssh-keyscan` as the trust decision.
7. Confirm that the CI pipeline succeeds and image scanning passes. Note: the current pipeline's database password is a disposable CI-only value and must never be reused in production.
8. Review migrations for destructive changes and agree the backup/rollback decision before the first release.

## 7. First deployment (Docker Compose manual procedure)

The commands below are run by an authorized operator on the VPS. Replace the repository URL and release ref with the approved values. This procedure assumes the backend repository is checked out at `/opt/examinity/backend`; adjust paths consistently if the repository layout differs.

```bash
sudo mkdir -p /opt/examinity
sudo chown "$USER":"$USER" /opt/examinity
cd /opt/examinity
git clone <approved-gitlab-backend-repository> backend
cd backend
git checkout <approved-release-tag-or-commit>
```

Create and secure `.env` as described in section 5. Set production `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_PORT` only if using the bundled Postgres service; set `DATABASE_URL` to the matching service URL. For managed PostgreSQL, set its connection URL and omit or disable the bundled database service using an approved production Compose override. Do not assume `docker-compose.yml` is already a production override.

Build and start the database, apply migrations, seed the catalogue, then start the API. Running these commands explicitly gives the operator a checkpoint before API traffic is exposed:

```bash
docker compose build api migrate
docker compose up -d postgres
docker compose run --rm migrate
docker compose run --rm seed
docker compose up -d api
docker compose ps
```

The migration and seed services use the Compose environment. `pnpm db:deploy` applies committed Prisma migrations; it does not create a new migration. `pnpm db:seed` idempotently creates/updates baseline configuration, roles, permissions, feature flags and email templates. It does not create a user or grant `SUPER_ADMIN`.

### Admin schema handoff

The Admin API uses the shared Module 1 identity/RBAC and audit tables plus the existing platform configuration and feature-flag tables. The migration history under `prisma/migrations/` is the complete server schema plan; DevOps must run `pnpm db:deploy` against the intended database and must not create a parallel `admin_users`, `admin_roles`, `admin_permissions`, `admin_sessions`, or `admin_audit_logs` schema by hand. The client architecture decision makes dedicated role-history tables conditional on a demonstrated gap in the centralized audit log. This release stores assignment state in `identity.user_role_assignments` and privileged before/after events in `audit.audit_logs`; review [the Admin API contract](./admin-api-contract.md) before approving any additional history-table migration.

The checked-in Compose definition has `api` dependencies on migration and seed services with `service_completed_successfully`; after the explicit one-shot commands, Compose may rerun/require completion of those service containers when starting `api`. Confirm with `docker compose ps` and logs. For a clean repeatable production release, DevOps should maintain a production Compose override or release script that defines this one-shot lifecycle deliberately. Do not let an automatic migration/seed restart loop run on application restart. Preserve the Postgres volume between releases.

Before switching DNS/announcing service, verify from the VPS:

```bash
curl --fail http://127.0.0.1:4000/health/live
curl --fail http://127.0.0.1:4000/health/ready
```

Expected responses are JSON with `{"status":"ok"}` and `{"status":"ready"}` respectively. Check logs if readiness fails; it requires PostgreSQL plus valid Auth0 issuer and audience configuration.

## 8. Nginx, DNS and HTTPS

Create an Nginx server block for the API hostname. Proxy to `http://127.0.0.1:4000`, preserve the `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers, allow the request sizes required by the product, and configure appropriate read/send timeouts. Do not add permissive CORS rules in Nginx; CORS is controlled by `CORS_ORIGINS` in the API. Enable the site and validate with `nginx -t`, then reload Nginx.

Issue the certificate only after DNS resolves to the VPS and ports 80/443 are reachable. Verify automatic renewal. Confirm externally:

- `https://<api-host>/health/live` returns 200.
- `https://<api-host>/health/ready` returns 200.
- `https://<api-host>/api/docs` shows the API documentation if public Swagger is accepted for production. If not, restrict or disable it through an approved code/configuration change; the current code enables it unconditionally.
- Authenticated requests use `Authorization: Bearer <Auth0 API access token>` for the configured audience.

## 9. Repeatable release and GitLab deployment

### Current CI behavior

`backend/.gitlab-ci.yml` currently has verify, build, and test stages. It runs migrations/seed and checks against a disposable PostgreSQL service, builds a Docker image named with the commit SHA, saves it as a short-lived job artifact, and scans it. There is no production deploy stage or image push in the checked-in file.

### Required production delivery design

Before enabling unattended deployment, the integration/DevOps owner should implement and review a protected production job. Preferred flow:

1. CI verifies and builds once; tag the image with the immutable commit SHA and push it to an approved GitLab Container Registry.
2. A protected/manual production job deploys that exact image to the VPS over pinned SSH or a restricted runner. Do not rebuild different source on the production host.
3. On the VPS, pull the approved image, validate required configuration, take/confirm the pre-migration backup, run the one-shot migration, run the idempotent seed if required by the release procedure, replace the API container, then verify readiness over HTTPS.
4. Record commit SHA, migration outcome, deployment operator and health-check result. Retain the prior image for application rollback.
5. Protect production variables/environment and restrict job permissions to the production branch and approved deployers. Avoid printing `.env`, `DATABASE_URL`, SSH keys or tokens.

Suggested protected variables are a file-type deploy SSH key, `VPS_HOST`, `VPS_USER`, `DEPLOY_PATH`, and a pinned host-key value or known-hosts file. Registry credentials should use GitLab's scoped registry credentials where possible. Variable names are a proposed interface; they are not currently consumed by the checked-in pipeline.

Do not roll back a database by restoring an old application image alone if the new migration is incompatible. Use backward-compatible expand/contract migrations where possible. A database restore is a separately approved recovery operation because it can discard writes made after the backup.

## 10. Post-deployment verification and operations

For every release, record and check:

- Git commit/image SHA and pipeline status.
- `docker compose ps` shows the database healthy and API running; inspect `docker compose logs --tail=200 api` and migration logs.
- Public liveness and readiness both return HTTP 200 over HTTPS.
- DNS resolves to the intended VPS; certificate is valid and renewal is scheduled.
- Auth0 API access-token validation succeeds for an approved test user and rejects missing/invalid tokens on protected endpoints.
- Frontend browser origin passes CORS; unrelated origins are rejected.
- Database migration status is current; no test/smoke fixtures or CI database are used in production.
- Email and object storage work if those integrations are enabled; verify with an approved test account/object.
- No secrets or bearer tokens appear in application, Nginx or CI logs.

Liveness only checks that the process responds. Readiness checks core runtime configuration and PostgreSQL. Configure monitoring to alert on repeated readiness failures, container exits, disk exhaustion, certificate expiry, backup failures and excessive 5xx responses. The app logs to stdout/stderr; configure Docker log rotation and central retention.

Back up PostgreSQL on a documented schedule and retain encrypted copies outside the VPS. Test restore to an isolated database periodically. Back up deployment configuration and document secret recovery/rotation. Hostinger snapshots are useful but do not replace database-aware backups.

## 11. Rollback and incident response

1. Stop further deployment and record the failed commit, time and error evidence without exposing secrets.
2. If only the application is faulty and migrations are backward-compatible, redeploy the previously retained image and check readiness.
3. If migration/data damage is suspected, stop writes as appropriate and follow the database owner’s approved restore procedure. Confirm recovery point and business approval before restoring because newer data may be lost.
4. Do not run `prisma migrate reset`, development migrations, or seed/test fixtures against production.
5. Rotate any credential that may have been exposed; update the server secret source and restart only affected services.
6. Record incident, recovery point, actions and follow-up owner.

## 12. Security and release checklist

### Before first production traffic

- [ ] Hostinger VPS OS access, SSH key access, firewall, patching and disk alerts are set.
- [ ] API DNS points to the server and HTTPS certificate plus renewal are verified.
- [ ] Port 4000 and PostgreSQL are not public; API binds only to loopback at the host boundary.
- [ ] Production Auth0 issuer/audience and frontend HTTPS CORS origins are confirmed.
- [ ] Production database credentials are unique, least-privileged and stored securely.
- [ ] Automated database backup exists and a restore has been rehearsed.
- [ ] Email/storage are either configured and verified or explicitly out of launch scope.
- [ ] Prisma migrations reviewed; production migration and seed procedure approved.
- [ ] CI passes; container and dependency scans reviewed.
- [ ] Swagger exposure decision recorded; current code enables `/api/docs` publicly.
- [ ] Deployment and rollback owners are named; deploy job is protected if enabled.

### Per release

- [ ] Approved commit/image SHA and pipeline recorded.
- [ ] Migration impact and backup checkpoint reviewed.
- [ ] One-shot migration and seed lifecycle completed without restart loops.
- [ ] API container is healthy and both external health URLs return 200.
- [ ] Auth0, CORS, and enabled integrations are smoke-checked.
- [ ] Logs contain no secrets; prior image and release record retained.

## 13. Repository references

- `backend/README.md` — local setup, API routes, identity boundary and CI overview.
- `backend/Dockerfile` — image build and runtime process.
- `backend/docker-compose.yml` — local multi-service wiring; production override required.
- `backend/.gitlab-ci.yml` — current verification/build/scanning pipeline.
- `backend/.env.example` — variable names and development placeholders.
- `backend/prisma.config.ts`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/` — Prisma datasource and migration sources.
- `backend/src/main.ts`, `backend/src/health.controller.ts` — listener, CORS, routes and readiness behavior.
- `backend/scripts/bootstrap-super-admin.ts` — guarded one-time SUPER_ADMIN assignment procedure.

## Appendix A. Initial administrative account

Catalogue seeding intentionally does not grant an administrative role. First, an authorized test/production user must sign in through the frontend and complete Auth0-backed account sync so an active, email-verified local user exists. Then an authorized operator can run the guarded one-time bootstrap with `BOOTSTRAP_AUTH0_SUB` set to that user’s exact Auth0 `sub`:

The runtime image prunes development dependencies and therefore does not include `tsx`; do not try to run the bootstrap script inside the production API image. Run `pnpm bootstrap:super-admin` from a controlled one-shot admin/release image that includes the repository's dev dependencies, inject `DATABASE_URL` and `BOOTSTRAP_AUTH0_SUB` securely, and verify both target the intended production database/user before execution. The script refuses if an active SUPER_ADMIN exists, requires an active email-verified user and seeded role, and writes an audit record. Never commit the subject or database credentials.
