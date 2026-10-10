# Phaseboard V8 — Supabase foundation (milestone 1 of 5)

This package retains the working V7 local board. It adds a **database schema, Row Level Security policies, and Supabase client helper**, but **does not yet enable sign-in, sync, migration, invitations, or permission UI**. Do not assume the board is shared or secure until later milestones.

## 1. Back up V7 data before deployment
In the current Phaseboard browser, open DevTools → Console and run:

```js
copy(localStorage.getItem('phaseboard-v2') || localStorage.getItem('phaseboard-v1'))
```

Paste the clipboard contents into a private text file. It contains your tasks; don't post it publicly. Image blobs stored in IndexedDB are **not included** in this backup. Keep your original browser data and images intact for now.

## 2. Create Supabase project
At https://supabase.com/dashboard create a project. In **SQL Editor**, run `supabase/001_foundation.sql` once. Verify tables appear in Table Editor. Enable email sign-in in Authentication settings, but don't invite others yet.

## 3. Configure Vercel and local environment
Copy `.env.example` to `.env.local`, fill in Supabase project URL and publishable/anon key (Project Settings → API Keys). In Vercel → Project → Settings → Environment Variables add both `NEXT_PUBLIC_...` values. Redeploy after saving. **Never** put a service-role/secret key in `NEXT_PUBLIC_...` variables or commit it to Git.

## 4. Bootstrap first Admin and project
After you have created your own Supabase Auth user in the dashboard, copy their UUID. In SQL Editor run this as the project owner (replace the placeholder UUID):

```sql
begin;
insert into public.profiles(id, display_name) values ('YOUR_AUTH_USER_UUID', 'Admin') on conflict(id) do nothing;
with p as (
  insert into public.projects(name, created_by) values ('My Phaseboard', 'YOUR_AUTH_USER_UUID') returning id
), m as (
  insert into public.project_members(project_id,user_id,role)
  select id,'YOUR_AUTH_USER_UUID','admin' from p returning project_id
)
insert into public.phases(project_id,name,position)
select m.project_id, v.name, v.position from m
cross join (values ('Ideas / To-Do',0),('Phase 1',1),('Phase 2',2),('Extras',3)) as v(name,position);
commit;
```

Do not run this bootstrap more than once, or it creates a second project. Future project creation and invitations will use a protected server endpoint.

## 5. Deploy
Replace your repository files with this ZIP's `project-tracker` contents, commit, push, and wait for Vercel to report Ready. The existing board **continues to use browser localStorage/IndexedDB** until the next milestone; database credentials do not automatically sync it.

## Next milestones
1. Authentication UI and protected session; read board from Supabase.
2. Explicit preview/import of existing local tasks and images (do not auto-overwrite).
3. Admin user invitations and role assignment.
4. Phase/task visibility UI, storage access policies, and comments.
5. Real-time updates, mobile testing, and permission/security tests.

## Security notes
- Browser UI hiding is not authorization; enforce access using RLS.
- Editors cannot change `tasks.visible_to_everyone`; trigger enforces this even via API.
- A restricted task requires **both** phase and task access.
- Supabase SQL Editor runs with privileged access. Keep the project and API credentials private.
- The initial SQL is a foundation, not a security audit. Test cross-user access and attachment policies before inviting real collaborators.
