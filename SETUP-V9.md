# Phaseboard V9 — ATLAS260 shared board

## 1. Database upgrade (required BEFORE deploying V9)

In **ATLAS260 → SQL Editor**, run `supabase/002_v9_shared_board.sql` once. This creates a **private** image bucket, storage access policies, and realtime publication. Do not re-run the V8 foundation or Admin bootstrap.

Verify **Table Editor → phases** contains four phases for your Phaseboard project: Ideas / To-Do, Phase 1, Phase 2, Extras. These were created during Admin setup. V9 starts with **zero shared tasks**; it does NOT import local test tasks.

## 2. Deployment

Keep the existing two Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` = ATLAS260 Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = ATLAS260 publishable key

Deploy the `project-tracker` contents to your GitHub repository. Wait for Vercel **Ready**. Log in as your existing Admin.

## 3. Features and access

- Board tasks, contributors, comments, and image attachments use Supabase.
- Existing browser test tasks are intentionally ignored, **not deleted from localStorage**.
- Admins can change phase and task visibility. Only people with BOTH phase and task access can read content; Admins see all.
- Editors create/edit/delete tasks in accessible phases. Viewers can read and comment.
- Image objects are private; signed URLs expire after 2 minutes.
- Task and phase changes subscribe to Supabase Realtime. Other changes may require refreshing the page.

## 4. Known limits and follow-up

- User invitations and user role management UI are NOT yet implemented. Add users via a trusted admin-only workflow; do not expose a secret key in the browser.
- The visibility editor currently identifies members by a shortened user UUID rather than their display names.
- This version intentionally has no checklist editor (the uploaded V8 source had none).
- The existing Supabase `project_members` policy does not allow browser-side invites, so invitations need a server-side endpoint in the next milestone.
- This is a first integration release; test Admin, Editor, Viewer and image permissions in a staging environment before inviting real users.
- Do not store sensitive information until the security policies have been tested end to end.
