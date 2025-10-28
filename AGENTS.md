# Repository Guidelines

## Project Structure & Module Organization
The main app lives under `web/`, a SvelteKit project built for Cloudflare Pages. Business logic sits in `web/src/lib/server/repositories`, while routed UI and actions live under `web/src/routes` (route folders use kebab-case, `__tests__` for server actions). Persistent schema changes belong in `web/migrations` (D1 SQL), static assets in `web/static`, and shared references in `docs/`. Keep environment examples in `.env.local` and update `docs/` when behavior changes.

## Build, Test, and Development Commands
Run all commands from `web/`. `npm install` installs dependencies (Node 20.19.0 per `.nvmrc`). `npm run dev` starts the Vite dev server on http://localhost:5173/. `npm run build` produces the Cloudflare-ready build; pair with `npm run preview` to smoke-test. `npm run check` runs `svelte-check` for type and markup validation. `npm run test` executes the Vitest suite headlessly; use `npm run test:watch` during iteration.

## Coding Style & Naming Conventions
Author features in TypeScript and Svelte using ES modules. Match existing formatting (tabs for indentation, single quotes, trailing commas) and keep components lean, factoring shared utilities into `web/src/lib`. Name Svelte files with route-friendly kebab-case folders, PascalCase for exported types, and camelCase for functions or stores. Prefer lightweight comments describing intent over implementation details.

## Testing Guidelines
Vitest is the unit and integration harness. Co-locate tests beside the code: use `*.test.ts` for repositories and `__tests__/page.server.test.ts` for route actions. Cover unhappy paths for Cloudflare D1 adapters by mocking repository responses, and assert returned SvelteKit `ActionResult`s. Run `npm run test` before every push; add `npm run check` when touching TypeScript definitions.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style (`feat:`, `fix:`, `chore:`) with concise, imperative subjects. Group related changes per commit and reference issue IDs in the body when applicable. Pull requests need a clear summary, screenshots or JSON samples when UI or data contracts shift, and confirmation that `npm run check` and `npm run test` pass. Link deployment notes if migrations or environment variables change.

## Environment & Deployment Notes
Cloudflare configuration lives in `web/wrangler.toml`; update it alongside any D1 migration. Use `wrangler d1 migrations apply` against test accounts before merging. Keep secrets in GitHub Actions (`CLOUDFLARE_*`) and document new variables in `docs/deployment.md`.
