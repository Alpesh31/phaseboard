# Phaseboard MVP V2

A mobile-friendly single-project idea/to-do and phased project tracker built with Next.js + TypeScript.

## MVP features
- Ideas / To-Do inbox for quick capture
- Phase 1, Phase 2, Phase 3, Phase 4 workflow
- Desktop drag-and-drop between columns
- Mobile-friendly horizontal board and task editor
- Quick Add sends new thoughts directly to Ideas / To-Do
- One task owner plus multiple contributors
- Status, priority, due date, description
- Move-to selector (especially useful on mobile)
- Local browser persistence; no database required yet
- Automatic migration from V1 browser data

## Run locally
1. Install Node.js LTS from https://nodejs.org
2. Open Terminal in this folder
3. Run `npm install`
4. Run `npm run dev`
5. Open http://localhost:3000

## Later
When the MVP workflow is approved, local storage can be replaced with Supabase for shared multi-user data and authentication.


## V3: installable mobile web app (PWA)

This version adds a web app manifest, iOS/Android icons, standalone display metadata, and safe-area styling. The existing task UI and `phaseboard-v2` browser storage are unchanged. No backend is required.

Deploy over HTTPS (for example, on Vercel). On iPhone open the URL in Safari and use Share → Add to Home Screen. On Android use Chrome → Install app / Add to Home screen.

**Important:** data is still stored in each browser's localStorage. A home-screen install may use a separate storage container from Safari on some iOS versions; tasks are not guaranteed to transfer from the browser to the installed app. Back up important data before switching. This release does not implement offline caching or push notifications.


## V4 mobile board
On screens up to 700px wide, Phaseboard displays one full-width phase at a time. Swipe sideways to switch phases or tap the phase tabs. Scroll within the current phase to view its tasks. Desktop keeps the existing multi-column board. The task editor's **Move to** dropdown remains available on mobile.
