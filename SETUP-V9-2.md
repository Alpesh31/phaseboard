# Phaseboard V9.2 — Authentication Stability

Built from V9.1. This release preserves the shared board, images, comments, and visible Admin phase/task controls.

## Fixes
- One Supabase browser client instead of creating new instances across components.
- One auth listener with no repeated membership lookups for token refresh or repeated sign-in events for the same user.
- A failed membership query now shows an explicit error and Retry, not misleading Access Pending.
- Membership query no longer depends on joining `projects` under RLS.
- No automatic page reload or redirect during access checks.

## Deploy
Copy this project's contents into the existing GitHub repo, commit, push, and deploy the latest commit in Vercel. No new SQL or environment variables are needed.

## Verify
1. Sign in; board should open directly after brief verification.
2. Leave the page open for several minutes and confirm no refresh loop.
3. Check Admin controls: Manage phase permissions, Task visibility.
4. Refresh once manually and confirm you remain signed in.
5. If Access Pending remains, verify `project_members` has a row for your actual auth user UUID. If an error appears, copy its text without credentials.

Security note: Access Pending remains for genuinely unassigned accounts; do not bypass membership checks.
