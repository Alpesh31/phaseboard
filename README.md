# Phaseboard V5 — mobile single-phase view

Next.js PWA with a five-column desktop board and one visible phase on mobile.

## Local run

```bash
npm install
npm run dev
```

## Mobile

On screens up to 700px, only the selected phase renders visibly. Tap a phase tab or swipe horizontally across the board to switch phases. Vertical scrolling shows tasks within that phase. Desktop layout remains multi-column.

## Deployment

Copy the *contents* of this folder into your existing GitHub repository, commit and push. Vercel will deploy automatically if connected.

Data remains in localStorage; there is no shared database yet. Back up important tasks before clearing browser data.
