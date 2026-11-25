# Module 2 — Block 2 testing

Run `pnpm db:deploy`, `pnpm db:seed`, then `pnpm client:demo` before testing.

## Implemented APIs

Events:

- `GET /public/exam-cycles/:cycleId/events`
- `GET|POST /admin/exam-cycles/:cycleId/events`
- `PATCH /admin/exam-events/:eventId`
- `POST /admin/exam-events/:eventId/revisions`
- `POST /admin/exam-events/:eventId/cancel`

Create body:

```json
{"eventType":"APPLICATION_END","title":"Last date to apply","startAt":"2027-02-15T18:29:59Z","displayTimezone":"Asia/Kolkata"}
```

Revision body: `{ "revisionReason": "Official extension", "endAt": "2027-02-20T18:29:59Z" }`.

Selection process:

- `GET /public/exam-cycles/:cycleId/selection-process`
- `GET|POST /admin/exam-cycles/:cycleId/selection-process`
- `POST /admin/selection-process/:versionId/stages`
- `PATCH /admin/selection-stages/:stageId`

Create version: `{ "publicationStatus": "DRAFT" }`.
Stage body: `{ "name":"Interview", "sequence":1, "isMandatory":true, "stageType":"INTERVIEW" }`.

Salary, analysis, cutoffs:

- `GET|POST /admin/exam-cycles/:cycleId/salary`; `GET /public/exam-cycles/:cycleId/salary`
- `GET|POST /admin/exam-cycles/:cycleId/analysis`; `GET /public/exam-cycles/:cycleId/analysis`
- `GET|POST /admin/exam-cycles/:cycleId/cutoffs`; `GET /public/exam-cycles/:cycleId/cutoffs`
- `GET /admin/exams/:examId/export.xlsx` downloads master data and cycles.

Salary: `{ "postName":"Probationary Officer", "payLevel":"Scale I", "basicPayMin":36000, "basicPayMax":63840 }`.

Analysis: `{ "analysisYear":2026, "analysisType":"PREVIOUS_YEAR", "title":"2026 analysis", "data":{"applicants":1000}, "publicationStatus":"PUBLISHED", "verificationStatus":"VERIFIED" }`.

Cutoff: `{ "cutoffYear":2026, "stageType":"PRELIMS", "categoryCode":"GENERAL", "cutoffMarks":75.5, "cutoffType":"OFFICIAL" }`.

## Explicit implementation assumptions

- Only `ACTIVE` events are public. Cancellation sets `CANCELLED`; the cancellation reason is retained in the event description.
- Event PATCH accepts create-event fields. Revisions need `revisionReason` and optional dates/source reference.
- Selection versions are numbered sequentially. `DRAFT`/`PUBLISHED` are the supported local states; stage type is text.
- Salary and cutoff records are public immediately because their documented tables have no publication-status field.
- Public analysis requires `publicationStatus=PUBLISHED`.
- The documented cutoff composite uniqueness is enforced.
- Excel contains current examination master, aliases, taxonomy mappings and cycles. It does not yet include later M2 content.
