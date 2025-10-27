# Devin Handoff Instructions

## Repository
- URL: https://github.com/kaijohn-ad/exvs-tournaments
- Default branch: `master`
- Primary workspace: `web/` (SvelteKit) + `docs/`

## Local Setup
1. Install dependencies: `npm install` (run inside `web/`).
2. Copy `.env.local` template (already present) and set:
   - `BASIC_AUTH_USER`
   - `BASIC_AUTH_PASS`
3. Start dev server: `npm run dev`
4. Access admin UI at `http://localhost:5173/admin` (Basic認証必須)。

## Current Functionality Snapshot
- Basic SvelteKit scaffold with Cloudflare adapter.
- Basic auth guard for `/admin` routes via `src/hooks.server.ts`.
- Player repository implemented in-memory (`$lib/server/repositories/players.ts`) with Vitest coverage.
- `/admin/events/[eventId]/entries/players` supports:
  - Create/Update/Delete players
  - JSON import/export + inline JSON editor
  - Success/error flash messages
- `/admin/events/[eventId]/tournaments` provides tournament management:
  - Create/Update/Delete tournaments
  - JSON import/export + inline editor
  - Defaults for single-elimination format and seeding options
- `/admin/+page` provides event ID navigation into player management.
- Documentation (`docs/`) outlines requirements, data model, design notes, and TODO list.

## Outstanding Work Items
1. **Cloudflare D1 への永続化層移行とシークレット設定**
   - Replace in-memory player repo with Cloudflare D1-backed persistence
   - Provide migration scripts/schema definition (SQL)
   - Update configuration (`wrangler.toml` / env) and adapt tests (mock D1 or toggle test mode)
   - Document env requirements in README/TODO

## Testing & Quality Gates
- Static analysis: `npm run check`
- Unit tests: `npm run test`
- Run both commands before submitting work and include relevant output in updates

## Operational Notes
- Keep `docs/TODO.md` up to date after each completed task (per existing update rules)。
- Follow existing commit style (e.g., `feat(admin): ...`, `docs: ...`).
- Maintain flash message UX patterns introduced in player UI.
- Prefer minimal Svelte component reactivity (use `$` stores as shown).

## Deliverables for Devin Session
- Pull request(s) targeting `master`
- Summary of completed tasks + manual test steps (per change) in PR description
- Update documentation if requirements change or new configs are introduced
