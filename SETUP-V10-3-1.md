# ATLAS360 V10.3.1 — Granular Task Permissions

## Do not deploy the superseded V10.3 SQL
This ZIP replaces V10.3. **Run only `supabase/004_v10_3_1_granular_permissions.sql`** after your already-applied 001, 002, 003 migrations. If you have already run the older V10.3 SQL, STOP and request a tailored reconciliation migration before continuing.

## Before migration (important)
1. Take a Supabase database backup and export `tasks`, `task_access`, `project_members`, `comments`, and `task_attachments`.
2. Audit creator roles. Existing tasks are classified as Admin-created if their creator is currently an Admin OR the project's original creator. If someone changed roles after creating tasks, **correct the classification on a staging copy before production**. Query:
```sql
SELECT t.id,t.title,t.created_by,m.role AS current_creator_role,p.created_by=t.created_by AS project_founder
FROM public.tasks t LEFT JOIN public.project_members m ON m.project_id=t.project_id AND m.user_id=t.created_by
JOIN public.projects p ON p.id=t.project_id ORDER BY t.created_at;
```
3. Set up a Supabase staging project from a sanitized copy, with existing migrations applied. Do not test new RLS against live production.

## Deployment
1. Extract this ZIP, copy files into a **new Git branch** `v10-3-1-granular-permissions` (do not overwrite working production branch).
2. In staging Supabase SQL Editor, run `supabase/004_v10_3_1_granular_permissions.sql` **once**. It adds `tasks.created_by_admin` and `task_access.permission`, converts prior grants to `view`, and replaces security helper functions. No task/comment/attachment rows are deleted. Legacy `visible_to_everyone` values are ignored but retained for audit.
3. Configure Vercel Preview branch with staging Supabase URL and anon key, plus server-only secret key. **Never expose the secret key in NEXT_PUBLIC_ variables.**
4. Build and test the Preview. Then coordinate production DB migration and app deployment in a maintenance window; database and UI versions are coupled.

## Expected behavior
- Admin-created task: all current members can **view** by default. Only Admin can give an Editor `edit` permission; Viewers stay read-only.
- Editor-created task: creator can edit; Admin can edit; other members see nothing until Admin grants `view` or (Editor only) `edit`.
- An Editor's role is not enough to edit another person's task.
- Comments remain available on readable tasks; task metadata and images are governed by Supabase RLS.
- Phase columns are visible to members; this does not reveal other people's private tasks.
- Admin can grant/revoke permissions from the task detail dialog.

## Validation matrix (use separate real accounts)
1. Admin creates task; Editor A and Viewer A can read, neither can edit.
2. Admin grants Editor A `edit`; Editor A can update, move, attach and delete. Editor B still reads only.
3. Admin changes Editor A back to `view`; all edit attempts fail through UI and direct Supabase requests.
4. Editor A creates task; Editor B and Viewer A cannot query it; Admin can read and edit.
5. Admin grants Editor B `view` then `edit`; Editor B can only edit after `edit` grant.
6. Admin grants Viewer A `view` on Editor A's task; Viewer A can view/comment but not edit.
7. Viewer cannot create tasks, upload/delete images, or write task fields by direct API.
8. Revoke membership; user loses access. Re-add membership; old explicit grants do not return.
9. Verify task counts, comments, contributors, and attachment download permissions.
10. Test mobile, desktop, profile dropdown, Quick Add, and invited-user onboarding.

## Limitations / production readiness
This is a source-level patch; **no live Supabase test or full Next.js production build was completed here**. Run the matrix above before merging. Admin-created classification for historical tasks depends on current role/founder metadata and must be audited. If you already applied old V10.3 SQL, this migration must be adapted first.
