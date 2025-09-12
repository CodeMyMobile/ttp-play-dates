# Repository Guidelines

## Project Structure & Modules
- `src/` – application code
  - `components/` React components (PascalCase, e.g., `InvitesList.jsx`)
  - `pages/` route-level views (PascalCase, e.g., `InvitationPage.jsx`)
  - `services/` API/domain helpers (lowercase, e.g., `api.js`, `auth.js`, `matches.js`, `invites.js`)
  - Entry files: `main.jsx`, `App.jsx`; styles: `App.css`, `index.css`
- `public/` – static assets served as-is
- Tooling: `vite.config.js`, `eslint.config.js`, `tailwind.config.js`
- Env files: `.env` (local, untracked) and `.env.example` (template)

## Development & Build
- `npm ci` – install dependencies from lockfile
- `npm run dev` – start Vite dev server
- `npm run build` – production build to `dist/`
- `npm run preview` – preview the production build locally
- `npm run lint` – run ESLint checks
- `npm run deploy` – optional local deploy to `gh-pages` branch (uses `gh-pages`)

Notes
- Node.js 20+ required (matches CI). Use `npm ci` for reproducible installs.
- `vite.config.js` sets `base: '/ttp-play-dates/'` for GitHub Pages asset paths.

## Environment Variables (Vite)
- Only `VITE_*` vars are exposed to the client and are replaced at build time.
- Local: copy `.env.example` to `.env` and set:
  - `VITE_API_URL` – API base URL
  - `VITE_GOOGLE_API_KEY` – Google Places key
- Production (CI): provide these via Actions secrets/variables. Two supported patterns:
  - Repo-level secrets: `VITE_API_URL`, `VITE_GOOGLE_API_KEY` (recommended).
  - Environment-scoped secrets: add `environment: github-pages` to the build job so secrets are available.
- Optional: emit a `.env.production` during CI before build to guarantee Vite picks them up:
  - `printf "VITE_API_URL=%s\nVITE_GOOGLE_API_KEY=%s\n" "${{ secrets.VITE_API_URL }}" "${{ secrets.VITE_GOOGLE_API_KEY }}" > .env.production`

## CI/CD (GitHub Pages)
- Workflow: `.github/workflows/deploy.yml`
  - Build job: Node 20, `npm ci`, `npm run build`, then `actions/upload-pages-artifact@v3`.
  - Deploy job: `actions/deploy-pages@v4` to the `github-pages` environment.
- Ensure Pages source is set to GitHub Actions in repo Settings → Pages.
- Env var sourcing:
  - If using environment-scoped secrets under `github-pages`, add `environment: github-pages` to the build job; or
  - Keep secrets at repo level and continue using `secrets.VITE_*` in the build job env.
- GitHub Pages serves static files; env changes require a rebuild to take effect.

## Coding Style
- Language: JavaScript + JSX (React, Vite)
- Indentation: 2 spaces; use semicolons consistently
- Components: PascalCase file and component names (e.g., `TennisMatchApp.jsx`)
- Services/util modules: lowercase filenames (e.g., `auth.js`)
- Hooks/state: follow React Hooks rules (enforced by `eslint-plugin-react-hooks`)
- Linting: configured via `eslint.config.js`; run `npm run lint` before PRs

## Testing
- No test harness configured yet. If adding tests, prefer Vitest + React Testing Library.
- Suggested structure: `src/__tests__/*.test.jsx` or colocated `*.test.jsx` next to source.
- Keep tests fast, deterministic, and focused on behavior.

## Commits & PRs
- Use clear, imperative commit messages (e.g., "Fix match detail route"). `feat:`, `fix:`, `refactor:` prefixes welcome.
- PRs include: summary, linked issue(s), screenshots/GIFs for UI changes, test/verification steps, and any env/config impacts.
- Ensure lint and build pass. Prefer small, focused PRs.

## Security & Config
- Never commit secrets. Use `.env` locally and Actions secrets in CI.
- Validate that `VITE_*` vars exist at build time; missing values produce fallback behavior in code but may break features.
