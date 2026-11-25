# Module 3: first 20 CMS APIs

This delivery implements the first 20 endpoints in the order used by the developer implementation guide. All routes are below `/api/v1`, require an authenticated administrator application token and MFA, and use the established success/error envelopes.

| #   | Method and route                                                | Permission              | Behaviour                                                                                                                    |
| --- | --------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `POST /admin/cms/content`                                       | `cms.content.create`    | Validates an active content type and structured document, then creates the stable item and revision 1 as `DRAFT` atomically. |
| 2   | `GET /admin/cms/content`                                        | `cms.content.read`      | Pages non-deleted content and returns lightweight current-revision metadata.                                                 |
| 3   | `GET /admin/cms/content/:contentId`                             | `cms.content.read`      | Returns identity, type, current revision and published-revision pointer.                                                     |
| 4   | `PATCH /admin/cms/content/:contentId`                           | `cms.content.update`    | Updates an owned editable revision using `expectedVersion`; stale writes return 409.                                         |
| 5   | `DELETE /admin/cms/content/:contentId`                          | `cms.content.delete`    | Soft-deletes content only when every revision remains a draft and nothing was published.                                     |
| 6   | `POST /admin/cms/content/:contentId/archive`                    | `cms.content.archive`   | Marks content `ARCHIVED`, retaining its revisions.                                                                           |
| 7   | `POST /admin/cms/content/:contentId/restore`                    | `cms.content.restore`   | Clears the archive marker and returns the item to `DRAFT`; it never republishes.                                             |
| 8   | `GET /admin/cms/content/:contentId/revisions`                   | `cms.revision.read`     | Lists the content item's revision history.                                                                                   |
| 9   | `GET /admin/cms/revisions/:revisionId`                          | `cms.revision.read`     | Reads one versioned content payload.                                                                                         |
| 10  | `POST /admin/cms/content/:contentId/revisions`                  | `cms.revision.create`   | Copies an existing revision's payload into the next `DRAFT` revision and makes it current.                                   |
| 11  | `GET /admin/cms/revisions/:revisionId/compare/:otherRevisionId` | `cms.revision.read`     | Returns both revisions and an equality indicator for their bodies.                                                           |
| 12  | `POST /admin/cms/revisions/:revisionId/submit`                  | `cms.content.submit`    | Moves an editable revision to `IN_REVIEW`, creates its workflow instance and open review task.                               |
| 13  | `GET /admin/cms/workflow/tasks`                                 | `cms.workflow.read`     | Lists open/unassigned workflow tasks visible to the caller.                                                                  |
| 14  | `GET /admin/cms/workflow/tasks/:taskId`                         | `cms.workflow.read`     | Returns a task, its revision, and recorded review decisions.                                                                 |
| 15  | `POST /admin/cms/workflow/tasks/:taskId/assign`                 | `cms.assignment.manage` | Assigns a task to a user.                                                                                                    |
| 16  | `POST /admin/cms/workflow/tasks/:taskId/reassign`               | `cms.assignment.manage` | Replaces the task's assignee.                                                                                                |
| 17  | `GET /admin/cms/reviews/queue`                                  | `cms.review.read`       | Lists open review tasks with revision context.                                                                               |
| 18  | `GET /admin/cms/reviews/:taskId`                                | `cms.review.read`       | Retrieves a specific review task.                                                                                            |
| 19  | `POST /admin/cms/reviews/:taskId/approve`                       | `cms.review.manage`     | Records approval, completes the task, and moves the revision/workflow to `REVIEWED`.                                         |
| 20  | `POST /admin/cms/reviews/:taskId/request-changes`               | `cms.review.manage`     | Requires comments, completes the task, and returns the revision/workflow to `CHANGES_REQUESTED`.                             |

## Current persistence scope

The accompanying migration adds only `cms_content_types`, `cms_content_items`, `cms_content_revisions`, `cms_workflow_instances`, `cms_workflow_tasks`, and `cms_content_reviews`. Content taxonomy, media, M2 associations, sources, translations, verification, approval, and publishing tables are intentionally deferred because their endpoints are after this first-20 slice.

Seed content types before creating content. The next migration should add the content-type administration APIs and seed the predefined types from the requirements.
