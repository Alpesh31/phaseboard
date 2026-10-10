# Phaseboard V6

Single-project idea inbox and task tracker. Columns: Ideas / To-Do, Phase 1, Phase 2, Extras.

## Run

```bash
npm install
npm run dev
```

## Changes in V6

- Phase 4 is removed. Its tasks are **permanently excluded** from the board during migration.
- Phase 3 is renamed Extras, retaining its tasks.
- Importance is a separate Must / Maybe / Mostly Not field.
- Attach JPG/PNG/WebP/GIF images (8 MB maximum per file). Image blobs are stored in IndexedDB, metadata in localStorage.
- Mobile remains single-phase navigation; desktop retains horizontal columns.
- V5/V2 localStorage data is migrated from `phaseboard-v2`, with fallback to `phaseboard-v1`.

**Important:** Browser storage is device-specific. Images do not sync to other devices or friends. Clearing site data may delete tasks and images. Deleting Phase 4 tasks cannot be undone. Export/back up your existing data before deploying if it matters.

## Deploy

Copy project files into your existing GitHub repo and push. Vercel will build automatically.
