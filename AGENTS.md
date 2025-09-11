# Repository Guidelines

## Project Structure & Module Organization
- `src/` – application code
  - `components/` React components (PascalCase, e.g., `InvitesList.jsx`)
  - `pages/` route-level views (PascalCase, e.g., `MatchPage.jsx`)
  - `services/` API and domain helpers (lowercase, e.g., `matches.js`, `api.js`)
  - entry files: `main.jsx`, `App.jsx`, styles in `App.css`, `index.css`
- `public/` – static assets served as-is
- Tooling: `vite.config.js`, `eslint.config.js`, `tailwind.config.js`
- Env: `.env` (local, untracked) and `.env.example` (template)

## Build, Test, and Development Commands
- `npm ci` – install dependencies from lockfile
- `npm run dev` – start Vite dev server
- `npm run build` – production build to `dist/`
- `npm run preview` – preview the production build locally
- `npm run lint` – run ESLint checks
- `npm run deploy` – build and publish to GitHub Pages

## Coding Style & Naming Conventions
- Language: JavaScript + JSX (React, Vite)
- Indentation: 2 spaces; use semicolons consistently
- Components: PascalCase file and component names (e.g., `TennisMatchApp.jsx`)
- Services/util modules: lowercase filenames (e.g., `auth.js`)
- Hooks and state: follow React Hooks rules (enforced by `eslint-plugin-react-hooks`)
- Linting: configured via `eslint.config.js`; run `npm run lint` before PRs

## Testing Guidelines
- No test harness is configured yet. If adding tests, prefer Vitest + React Testing Library.
- Suggested structure: `src/__tests__/*.test.jsx` or colocated `*.test.jsx` next to source.
- Keep tests fast, deterministic, and focused on behavior.

## Commit & Pull Request Guidelines
- Commits: use clear, imperative messages (e.g., "Fix match detail route"). Conventional prefixes like `feat:`, `fix:`, `refactor:` are welcome.
- PRs must include: summary, linked issue(s), screenshots/GIFs for UI changes, test/verification steps, and any env or config impacts.
- Ensure `npm run lint` passes and builds successfully. Small, focused PRs are preferred.

## Security & Configuration Tips
- Never commit secrets. Copy `.env.example` to `.env` and set `VITE_API_URL` and `VITE_GOOGLE_API_KEY` for local dev.
- CI/CD uses GitHub Pages; `vite.config.js` sets `base: '/ttp-play-dates/'` for correct asset paths.
- Target Node.js 20+ (matches CI). Use `npm ci` for reproducible installs.
