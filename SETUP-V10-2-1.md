# Phaseboard V10.2.1 — Auth-shell stability repair

## What changed
- Rebuilt `src/components/auth-shell.tsx` to remove duplicate nested onboarding functions and invalid React hooks from V10.2.
- Preserved V9.2 stable auth state handling and membership checks.
- Preserved V10.2 profile dropdown, Admin controls, ATLAS360 project title, contributor member picker, and mandatory name/password onboarding.
- Profile upsert now runs before marking onboarding complete.

## Database
If you already ran `supabase/003_v10_2_ui_members.sql`, DO NOT run it again. No new migration is required for V10.2.1. The existing migration is included for reference only.

## Deployment safety
1. Keep the restored working V10 Production deployment active.
2. Push V10.2.1 to a separate branch and deploy to a Vercel Preview first.
3. Confirm the Vercel build is Ready, then test Admin login, invited-user onboarding, Manage Users, phase permissions, existing tasks/comments/images, and member-based contributors.
4. Promote only after all checks pass.

## Validation performed
- Checked ZIP source and repaired invalid React hooks in the auth shell.
- Parsed the repaired auth shell with TypeScript's TSX transpiler with zero syntax diagnostics.
- A complete Next.js production build could not run here: npm dependency installation was unavailable. Vercel Preview build remains mandatory.
