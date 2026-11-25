# Module 2 API test plan

Module 2 service unit tests are in [`exam-management.spec.ts`](../src/exam-management/exam-management.spec.ts). They use the repository's Jest configuration and mock Prisma/audit dependencies. The suite covers core Module 2 behavior across taxonomy, examination catalogue and cycles, overview, eligibility, exam patterns, syllabus, events, selection process, salary, analysis, cutoffs, documents, and imports.

## Test sources and scope

- `docs/module-2-api-inventory.md` lists the 116 developer-document API routes and current backend route coverage.
- `postman/Examinity-Admin-QA.postman_collection.json` contains the Module 2 requests and sample payloads used for the workbook's endpoint cases.
- `src/exam-management/**/dto` defines request validation for DTO-backed operations.
- The QA collection also includes implementation-specific routes and archive/cleanup actions, so its 119 requests are not the same count as the 116 documented routes.

Route coverage does not prove that every end-to-end business workflow has passed. The unit tests isolate services and do not replace API-level integration or Postman workflow checks.

## Environment setup

Use an isolated QA database and a running API. The default local base URL is `http://localhost:4000/api/v1`.

1. Apply database migrations and seed the Module 2 permissions in the QA database.
2. Import `postman/Examinity-Admin-QA.postman_collection.json` and `postman/Examinity-Module-1.postman_environment.json` into Postman.
3. Complete the collection's local mock authentication and identity sync steps.
4. Use an active, verified `SUPER_ADMIN` identity for admin workflows. Admin routes also require the configured admin application token and completed MFA.
5. Use a separate active identity without Module 2 permissions for RBAC denial cases. Public routes should be called without a bearer token.

Do not run this plan against production data. Use fresh QA records and the IDs captured by the collection. The collection creates a unique `m2Suffix`; clear it before a fresh full run if you want a new set of records.

## Execution order

Run the Module 2 collection folder from top to bottom so identifiers exist before dependent requests:

1. Taxonomy and authorities: create category, group, state selection, and authority.
2. Examination master and aliases: create and activate an exam, then create its alias.
3. Examination cycles: create a cycle and retain its ID/version.
4. Run overview, eligibility, pattern, syllabus, events, selection, salary, analysis, cutoffs, and document workflows after their parent cycle/exam exists.
5. Run import and publishing cases only after their referenced media, content, or import job exists.
6. Run `99 - Archive QA data` last. It archives test records and should not be used to clean up shared fixtures.

If a request says a value must be a UUID, check that its preceding create/list request ran and that the environment variable contains the returned ID, not the unresolved `{{variable}}` text.

## Case design and expected results

The **API Test Cases** sheet has the endpoint, sample request body, prerequisites, steps, expected result, and execution fields for every QA request. The **Negative & Security** sheet covers missing/invalid credentials, permission and MFA enforcement, DTO validation, stale versions, duplicate data, public visibility, publishing, imports, filters, and auditability.

Use exact HTTP status and error codes where the API contract defines them. Nest defaults are `200` for reads and updates and `201` for creates; verify the generated API contract if an operation overrides those defaults. A public read must not expose draft, inactive, archived, or unpublished data. Versioned updates must reject stale versions without overwriting newer values.

Some business rules in the negative cases may expose gaps in an implementation that currently has route coverage only. Record those as defects instead of weakening the expected result to match the implementation.

## Recording results

For each case, record the build/commit, execution date, actual status and response, pass/fail, and defect ID in the workbook. Keep tokens and secrets out of screenshots, logs, and defect reports. Re-run failed cases after a fix and retain the original failure history in the test report.
