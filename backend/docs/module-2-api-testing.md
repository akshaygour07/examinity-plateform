# Module 2 API testing guide

This guide covers the currently implemented Module 2 API slice:

- Examination taxonomy: categories, groups, Indian states/UTs, and examination authorities.
- Examination master: catalogue, classifications, aliases, status lifecycle, and public catalogue/search.
- Examination cycles: independent cycle creation, update, publication visibility, and archival.

The API has **36 implemented endpoints** in this slice. The later Module 2 areas (overview, eligibility, pattern, syllabus, events, publishing, imports, and others) are not included yet.

## 1. Prerequisites

Run the following commands from the backend directory.

```powershell
pnpm db:deploy
pnpm db:seed
pnpm client:demo
```

`db:deploy` creates the `exam` PostgreSQL schema and Module 2 tables. `db:seed` creates the `exam.*` permissions and grants them to `SUPER_ADMIN`, which is required for the protected admin endpoints.

Import/select these Postman files:

- `postman/Examinity-Admin-QA.postman_collection.json`
- `postman/Examinity-Module-1.postman_environment.json`

The default API base URL is `http://localhost:4000/api/v1`.

## 2. Postman quick-start

Use the collection in this order:

1. `00 - Local mock admin authentication`
2. `01 - Local mock user authentication`
3. `03 - Sync mock admin and QA user`
4. `14 - Module 2: Taxonomy, Examination Master & Cycles`

Run the Module 2 folder from top to bottom in the Collection Runner. You can also begin testing manually with **Create category**; it creates a fresh timestamped name/slug every time. Do not start with **Create group** or **Create examination** individually: those requests require IDs captured by earlier create requests.

The folder creates and stores these environment variables:

| Variable                 | Captured by                |
| ------------------------ | -------------------------- |
| `m2CategoryId`           | Create category            |
| `m2GroupId`              | Create group               |
| `m2StateId`              | List Indian states and UTs |
| `m2BodyId`               | Create authority           |
| `m2ExamId`, `m2ExamSlug` | Create/update examination  |
| `m2AliasId`              | Add alias                  |
| `m2CycleId`              | Create cycle               |

If a request reports `must be a UUID`, its required variable is empty or unresolved. Run the preceding request first and verify the variable in the active Postman environment. Before a fresh complete run, clear `m2Suffix`; the folder generates a new unique suffix for its QA records.

## 3. Authentication and authorization

Public routes do not need a bearer token. Admin routes require a bearer token for a user with the following seeded permissions:

```text
exam.taxonomy.read
exam.taxonomy.manage
exam.authority.manage
exam.catalogue.read
exam.catalogue.create
exam.catalogue.update
exam.catalogue.archive
exam.cycle.read
exam.cycle.manage
```

The standard `SUPER_ADMIN` role receives all of these during `pnpm db:seed`. An ordinary `ADMIN` role does not receive them automatically.

## 4. Recommended manual test flow

Use the following flow if testing requests individually. Every listed URL is relative to `{{baseUrl}}`.

### 4.1 Create taxonomy records

Create a category:

```http
POST /admin/exam-categories
Content-Type: application/json
Authorization: Bearer {{mockAdminApiAccessToken}}
```

```json
{
  "name": "QA Banking",
  "slug": "qa-banking",
  "description": "Category created during API testing",
  "display_order": 10
}
```

Save `data.id` as `categoryId` and `data.version` as `categoryVersion`.

Create a group under that category:

```http
POST /admin/exam-groups
```

```json
{
  "name": "QA Probationary Officer",
  "slug": "qa-probationary-officer",
  "category_id": "{{categoryId}}",
  "display_order": 10
}
```

`category_id` must be a real UUID. Do not send the unresolved text `{{categoryId}}`.

List state master data and select a state ID, for example Uttar Pradesh:

```http
GET /admin/states
```

Create an authority:

```http
POST /admin/exam-bodies
```

```json
{
  "name": "QA Examination Authority",
  "short_name": "QAEA",
  "slug": "qa-examination-authority",
  "description": "Authority created during API testing",
  "official_website": "https://example.test"
}
```

Save `data.id` as `examBodyId`.

### 4.2 Create and activate an examination master

```http
POST /admin/exams
```

```json
{
  "name": "QA Banking Examination",
  "short_name": "QA BE",
  "slug": "qa-banking-examination",
  "description": "Permanent examination master created during testing",
  "exam_body_id": "{{examBodyId}}",
  "exam_scope": "NATIONAL",
  "exam_mode": "ONLINE",
  "official_website": "https://example.test",
  "is_featured": false,
  "display_order": 10,
  "category_ids": ["{{categoryId}}"],
  "group_ids": ["{{groupId}}"],
  "state_ids": ["{{stateId}}"],
  "primary_state_id": "{{stateId}}"
}
```

Save `data.id`, `data.slug`, and `data.version` as `examId`, `examSlug`, and `examVersion`.

Activate the examination so it becomes visible in public catalogue endpoints:

```http
POST /admin/exams/{{examId}}/activate
```

Add an alias:

```http
POST /admin/exams/{{examId}}/aliases
```

```json
{
  "alias": "QA Bank Exam",
  "language_code": "en"
}
```

### 4.3 Create a cycle

```http
POST /admin/exams/{{examId}}/cycles
```

```json
{
  "cycle_year": 2027,
  "cycle_code": "QA-2027",
  "cycle_label": "QA 2027 Recruitment Cycle",
  "vacancy_count": 10,
  "notification_reference": "QA notification reference",
  "cycle_status": "UPCOMING",
  "publication_status": "DRAFT"
}
```

Save `data.id` and `data.version` as `cycleId` and `cycleVersion`.

Update a cycle with its current version. `expected_version` is mandatory for examination and cycle updates.

```http
PATCH /admin/exam-cycles/{{cycleId}}
```

```json
{
  "cycle_year": 2027,
  "cycle_code": "QA-2027",
  "cycle_label": "QA 2027 Recruitment Cycle",
  "vacancy_count": 12,
  "notification_reference": "QA notification revision 1",
  "cycle_status": "ACTIVE",
  "publication_status": "PUBLISHED",
  "expected_version": {{cycleVersion}}
}
```

After publication, test public cycle reads:

```http
GET /public/exams/{{examId}}/cycles
GET /public/exam-cycles/{{cycleId}}
```

## 5. Endpoint catalogue

### Taxonomy and authorities (16)

| Method | Endpoint                             | Permission              |
| ------ | ------------------------------------ | ----------------------- |
| GET    | `/admin/exam-categories`             | `exam.taxonomy.read`    |
| POST   | `/admin/exam-categories`             | `exam.taxonomy.manage`  |
| PATCH  | `/admin/exam-categories/:id`         | `exam.taxonomy.manage`  |
| POST   | `/admin/exam-categories/:id/archive` | `exam.taxonomy.manage`  |
| GET    | `/admin/exam-groups`                 | `exam.taxonomy.read`    |
| POST   | `/admin/exam-groups`                 | `exam.taxonomy.manage`  |
| PATCH  | `/admin/exam-groups/:id`             | `exam.taxonomy.manage`  |
| POST   | `/admin/exam-groups/:id/archive`     | `exam.taxonomy.manage`  |
| GET    | `/admin/states`                      | `exam.taxonomy.read`    |
| GET    | `/admin/exam-bodies`                 | `exam.taxonomy.read`    |
| POST   | `/admin/exam-bodies`                 | `exam.authority.manage` |
| PATCH  | `/admin/exam-bodies/:id`             | `exam.authority.manage` |
| GET    | `/public/exam-categories`            | Public                  |
| GET    | `/public/exam-groups`                | Public                  |
| GET    | `/public/states`                     | Public                  |
| GET    | `/public/exam-bodies`                | Public                  |

### Examination master and aliases (13)

| Method | Endpoint                            | Permission               |
| ------ | ----------------------------------- | ------------------------ |
| GET    | `/admin/exams`                      | `exam.catalogue.read`    |
| POST   | `/admin/exams`                      | `exam.catalogue.create`  |
| GET    | `/admin/exams/:id`                  | `exam.catalogue.read`    |
| PATCH  | `/admin/exams/:id`                  | `exam.catalogue.update`  |
| POST   | `/admin/exams/:id/activate`         | `exam.catalogue.update`  |
| POST   | `/admin/exams/:id/deactivate`       | `exam.catalogue.update`  |
| POST   | `/admin/exams/:id/archive`          | `exam.catalogue.archive` |
| GET    | `/admin/exams/:id/aliases`          | `exam.catalogue.read`    |
| POST   | `/admin/exams/:id/aliases`          | `exam.catalogue.update`  |
| DELETE | `/admin/exams/:id/aliases/:aliasId` | `exam.catalogue.update`  |
| GET    | `/public/exams`                     | Public                   |
| GET    | `/public/exams/search`              | Public                   |
| GET    | `/public/exams/:slug`               | Public                   |

### Examination cycles (7)

| Method | Endpoint                         | Permission          |
| ------ | -------------------------------- | ------------------- |
| GET    | `/admin/exams/:id/cycles`        | `exam.cycle.read`   |
| POST   | `/admin/exams/:id/cycles`        | `exam.cycle.manage` |
| GET    | `/admin/exam-cycles/:id`         | `exam.cycle.read`   |
| PATCH  | `/admin/exam-cycles/:id`         | `exam.cycle.manage` |
| POST   | `/admin/exam-cycles/:id/archive` | `exam.cycle.manage` |
| GET    | `/public/exams/:id/cycles`       | Public              |
| GET    | `/public/exam-cycles/:id`        | Public              |

## 6. Expected responses and common errors

- `200`: successful GET, PATCH, or DELETE request.
- `201`: successful POST request.
- `400 validation_error`: invalid body field, including an unresolved Postman variable in a UUID field.
- `401`: missing or invalid bearer token.
- `403`: inactive account or missing `exam.*` permission. Run `pnpm db:seed` after the Module 2 permission change and obtain a fresh mock admin token.
- `404`: requested record does not exist, was archived, or is not public.
- `409 m2_version_or_uniqueness_conflict`: duplicate name/slug/alias/cycle code, or stale/missing `expected_version` for an update. Use a different category name and slug; they must be globally unique, including archived categories.

## 7. Cleanup

The Postman folder finishes by archiving the cycle, examination, group, and category it created. It does not hard-delete published or historical Module 2 data.

To rebuild the collection after a future change:

```powershell
pnpm postman:admin:build
```
