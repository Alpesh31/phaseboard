# Phaseboard V10 — Admin User Management

## Required configuration

1. In ATLAS260 Supabase, copy the **secret API key** (`sb_secret_...`) from Project Settings → API Keys.
2. In Vercel → Phaseboard → Settings → Environment Variables, add `SUPABASE_SECRET_KEY` with the secret key as a **Secret** server-side environment variable (Production, Preview as appropriate). **Never prefix this variable with `NEXT_PUBLIC_`.**
3. Keep existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values unchanged.
4. Deploy V10 using a fresh production build so server routes can read the new variable.
5. In Supabase → Authentication → URL Configuration, allow your deployed Phaseboard URL as a redirect URL. Set `NEXT_PUBLIC_SITE_URL` in Vercel if you deploy to a different domain.

No additional SQL migration is required: the existing `project_members` table and `guard_last_admin` trigger are used.

## How to use

Sign in as Admin, select **Manage Users**, enter an email, choose Editor or Viewer, and send the invitation. Once the invite is accepted, the member can sign in. The member list supports role changes and removal.

## Important limitations

- Email invitations depend on Supabase Auth email delivery and its provider limits. For production, configure custom SMTP.
- Existing Supabase users may not be eligible for a second invitation. This version reports the Supabase error rather than silently modifying another account.
- A removed member may remain logged in, but RLS prevents project access. If already viewing the page, they may need to refresh to see the Access Pending screen.
- The last Admin cannot be demoted or removed (database trigger).
- Keep the Supabase secret key private. Do not paste it into chat, source files, GitHub, or any `NEXT_PUBLIC_` variable.
- Test invitation and permission enforcement with a separate test account before inviting real collaborators.
