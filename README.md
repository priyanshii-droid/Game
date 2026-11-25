# FLICKIEGO

FLICKIEGO is a minimalist, browser-based grid puzzle built with plain HTML, CSS, and vanilla ES modules.

## Project Structure

- `index.html` — Entry page with typography (`Fraunces` and `DM Sans`) and root mount element.
- `styles.css` — Warm beige-and-brown visual design, responsive mobile-first layout, and subtle motion.
- `engine.js` — Chromatic Ripple state transitions and reverse-BFS solver.
- `levels.js` — Level progression, board evaluation, and verified puzzle selection.
- `game-state.js` — Game state store supporting multi-step Undo, Restart, win tracking, and level advancement.
- `ui.js` — Persistent DOM renderer, animation timer cleanup, and accessible interaction handling.
- `app.js` — Application entry point wiring solution tables, state store, and UI.

## Deploying to Vercel

### Option 1: Vercel CLI
1. Install the Vercel CLI if needed:
   ```bash
   npm i -g vercel
   ```
2. From the project root folder (containing `index.html`), run:
   ```bash
   vercel
   ```
3. Follow the prompts (no build step or framework preset is required for static files; accept defaults and deploy to production with `vercel --prod` when ready).

### Option 2: Git + Vercel Dashboard
1. Push the project files to a GitHub, GitLab, or Bitbucket repository.
2. In the Vercel dashboard, click **Add New → Project** and import the repository.
3. Leave **Framework Preset** as **Other** and **Build Command** empty/default for static hosting, then click **Deploy**.
