# Phaseboard V8 — Authentication milestone

## Already completed
- Supabase project: ATLAS260
- `supabase/001_foundation.sql` executed
- First Auth user and Admin membership created
- Vercel environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL` = SUPABASE_URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = SUPABASE_PUBLISHABLE_KEY

## Deploy
1. Copy the **contents** of this `project-tracker` folder into the existing Phaseboard GitHub repository. Do not nest the folder.
2. Commit and push with GitHub Desktop.
3. In Vercel, confirm the two environment variables exist for Production and redeploy (new commit normally triggers this).
4. Open the Phaseboard URL and sign in using the Auth account created in ATLAS260.
5. Confirm the email and Admin role appear in the small session bar, and Sign out works.

## Scope and limitations
This milestone **gates the existing local board behind Supabase authentication** and checks `project_members` membership. It does NOT yet load/save tasks from Supabase, enforce Editor/Viewer permissions in the local board, implement invitations, or synchronize images/comments. The board is still saved to the current browser's localStorage/IndexedDB. **Do not invite Editors/Viewers yet**: a logged-in Viewer could modify their own local board until the database-backed board and role-aware UI are implemented. Database RLS policies apply to Supabase tables, not browser-local data.

The app intentionally has no public sign-up form. Admins will invite users in a later milestone.

Do not delete browser data or clear site storage. Back up existing tasks before the future migration.

## Test checklist
- Logged out: login form, not the board.
- Invalid password: readable error.
- Admin login: board appears, session bar shows admin.
- Sign out: login form reappears.
- No membership: access pending, no board.
- Desktop and mobile: existing board renders unchanged after sign-in.
