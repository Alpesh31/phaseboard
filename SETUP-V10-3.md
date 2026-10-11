# ATLAS360 V10.3 — Private-by-default task access

## Deployment order (IMPORTANT)

1. **Back up** the ATLAS260 Supabase database (including auth.users, project_members, tasks, task_access, phase_access, comments, task_attachments). Record current task counts and explicit grants. Do not run any old `001_foundation.sql` migration again.
2. Create a **staging Supabase project** from a backup and validate `supabase/004_v10_3_private_by_default.sql` there first. Existing policies must match V10.2.1 (`001` + `002` + `003`).
3. Deploy this code to a **Vercel Preview branch** and point the Preview environment variables at the staging project. Do not connect this V10.3 UI to your production Supabase instance before the production migration.
4. Apply `004_v10_3_private_by_default.sql` to staging, verify all test cases below. SQL runs inside a single transaction and preserves all task rows, comments, attachments and explicit grants.
5. Schedule production rollout: backup production; apply the SQL migration; deploy V10.3 UI **immediately after**. Briefly pause user edits during the cutover. Do not roll back only the frontend to V10.2: legacy controls may be misleading. Database rollback requires backup restore and coordinated frontend rollback.

## Access rules

- Admin: sees and edits all tasks; sole role allowed to grant/revoke explicit task access.
- Editor: sees and edits tasks they created or tasks explicitly granted by Admin; can create tasks in any phase. Cannot see unrelated tasks or change sharing.
- Viewer: no tasks by default; sees/comments on explicitly shared tasks only. A Viewer sees a phase if Admin grants that phase OR if an explicitly shared task exists within it. A phase grant alone does NOT reveal tasks.
- Every newly created task is private. The old `visible_to_everyone` columns remain for schema compatibility but are forced to `false` and ignored by access functions.
- Existing explicit `task_access` grants survive the migration. Existing implicit `visible_to_everyone=true` visibility does not.
- When project membership is removed, task/phase grants for that membership are revoked, so a re-invited user starts with no grants. This does not delete tasks or their authorship.
- Contributor assignment is **not** a sharing grant. Admin must explicitly grant access.
- An Editor who loses membership and is later re-invited as Editor still sees tasks they originally created (ownership-based access); plan for this if you require ownership transfer or archival.

## Staging validation (use separate accounts)

1. Admin creates A: Admin sees A; Editor and Viewer do not.
2. Editor creates B: Editor and Admin see B; Viewer and other Editor do not.
3. Admin shares A with Editor: Editor sees and edits A. Revoke: A disappears from Editor after refresh.
4. Admin shares A with Viewer: Viewer sees A and its phase and can comment, but cannot edit. Revoke: A disappears.
5. Admin grants Viewer a phase only: Viewer sees empty phase, not its private tasks.
6. Admin shares B with a second Editor: second Editor can edit B; cannot share it onward.
7. Direct Supabase REST requests as Editor/Viewer for unauthorized tasks, comments, attachments, storage objects, and task_access INSERT/DELETE must be rejected or return no rows.
8. Check existing task counts, comment counts, attachment counts and task_access grant counts before and after migration: they must match. Legacy public flags will change to false.
9. Remove/reinvite a Viewer: old grants must not return automatically.
10. Verify the profile menu closes on outside click/Escape, and desktop Quick Add does not overlap the profile control.

## Read-only pre/post migration checks (SQL Editor)

```sql
SELECT 'tasks' AS table_name, count(*) AS rows FROM public.tasks
UNION ALL SELECT 'comments', count(*) FROM public.comments
UNION ALL SELECT 'attachments', count(*) FROM public.task_attachments
UNION ALL SELECT 'task_access', count(*) FROM public.task_access
UNION ALL SELECT 'phase_access', count(*) FROM public.phase_access;

SELECT count(*) AS legacy_public_tasks FROM public.tasks WHERE visible_to_everyone;
SELECT count(*) AS legacy_public_phases FROM public.phases WHERE visible_to_everyone;
```

**Build status:** TypeScript/TSX transpilation syntax checked; full `next build` and live Supabase integration tests have NOT been executed in this environment. Do not promote to production without the staging checks.
