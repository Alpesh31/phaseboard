# Phaseboard V9.1 — Admin visibility interface

This update makes the existing Supabase visibility controls prominent:

- Admin controls banner near the top of the board with a **Manage phase permissions** button.
- Visible-to-everyone toggles and permitted-user selection for each phase.
- Task visibility section always shown to Admin in the task details panel.
- Existing per-column Phase visibility expander retained.

No new SQL or environment variables are needed. The existing database access policies remain unchanged. The update does not implement user invitations or role management yet; that is planned for V10. Only Admins see these controls.

Deploy the contents of this folder to the existing GitHub repository, then create a new Production deployment from the latest commit if the Git integration does not trigger automatically.

**Validation:** A full Next.js build could not be completed in this environment because dependency installation timed out. Verify the Vercel build and test visibility controls as Admin before inviting users. Do not treat visual UI testing as a security audit.
