# Phaseboard V10.2 — UI and onboarding update

## Deployment order
1. Back up your current working V10/V10.1 deployment and database before changing anything.
2. In your existing **ATLAS260** Supabase project, run `supabase/003_v10_2_ui_members.sql` in SQL Editor. This is additive; it preserves task records and old contributor names.
3. Deploy this ZIP's `phaseboard-main` contents to your existing GitHub repository and Vercel project. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SECRET_KEY` unchanged.
4. Verify Vercel build succeeds before promoting to Production.

## Changes
- Profile menu at top right: My Profile, Admin-only Manage Users, Admin-only Manage Phase Permissions, Sign Out.
- Removed the large Admin banner and repeated Phase visibility boxes from the board.
- Project display name **ATLAS360**; application remains Phaseboard.
- First-time account setup requires full name and a password (minimum eight characters). The profile menu lets existing users change both.
- Contributors are selected from current project members using a searchable multi-select. Member IDs are stored in the new nullable `task_contributors.user_id` column. Old free-text names remain available in existing tasks and can be removed, but cannot be newly added.
- Comment author and permission list names use project directory details when available.

## Important existing-user behavior
Because earlier versions did not record onboarding completion, **existing accounts will be asked to enter a full name and set a password once** after V10.2 deployment. This is expected. They can set a new password and continue; tasks and roles remain intact.

## Testing
1. Admin sign-in -> setup full name and password -> board opens without refresh loop.
2. Open top-right profile menu -> Manage Users and Manage Phase Permissions. No banner or phase-level permissions boxes.
3. Editor/Viewer profile menus omit Admin-only options; Viewer cannot edit tasks.
4. Invite new Viewer -> accept email -> full name and password required before board.
5. Create task, choose two contributors from current project members, save, refresh, and verify they remain.
6. Confirm old task contributors and existing tasks/attachments/comments still appear.
7. Remove a member, reopen task contributor picker, verify removed member is not offered.

## Rollback
Re-promote the previous working V10 deployment in Vercel. The SQL migration adds a nullable column and a trigger and is backward compatible with V10's original task contributor writes. Do not rerun foundation SQL or recreate Supabase.

## Known limitations
- Legacy free-text contributors are preserved rather than automatically matched to accounts, to avoid incorrect name-to-user mappings.
- This build has been syntax-parsed, but a complete Next.js production build was not possible in this offline workspace because npm dependency installation timed out. Validate in Vercel before promotion.
