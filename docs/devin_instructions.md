# Devin Handoff Instructions

## Repository
- URL: https://github.com/kaijohn-ad/exvs-tournaments
- Default branch: `master`
- Primary workspace: `web/` (SvelteKit) + `docs/`

## Local Setup
1. Ensure Node.js v20.19.0 or newer is active (`nvm use` will read `.nvmrc`).
2. Install dependencies: `npm install` (run inside `web/`).
3. Copy `.env.local` template (already present) and set:
   - `BASIC_AUTH_USER`
   - `BASIC_AUTH_PASS`
4. Start dev server: `npm run dev`
5. Access admin UI at `http://localhost:5173/admin` (Basic認証必須)。

## Current Functionality Snapshot
- Basic SvelteKit scaffold with Cloudflare adapter.
- Basic auth guard for `/admin` routes via `src/hooks.server.ts`.
- **Database Layer**: Dual-mode persistence system with automatic fallback
  - **Default**: In-memory storage (when `USE_MEMORY_STORE` is unset or D1 is unavailable)
  - **Production**: Cloudflare D1 (SQLite) for persistent storage (when D1 binding is available)
  - **Testing**: In-memory storage (explicitly set via `USE_MEMORY_STORE=true`)
  - Database abstraction layer in `$lib/server/db.ts` provides unified interface with automatic fallback
- Player repository with D1 backend (`$lib/server/repositories/players-d1.ts`) and in-memory fallback
- Tournament repository with D1 backend (`$lib/server/repositories/tournaments-d1.ts`) and in-memory fallback
- `/admin/events/[eventId]/entries/players` supports:
  - Create/Update/Delete players
  - JSON import/export + inline JSON editor
  - Success/error flash messages
  - Data persisted to D1 in production
- `/admin/events/[eventId]/tournaments` provides tournament management:
  - Create/Update/Delete tournaments
  - JSON import/export + inline editor
  - Defaults for single-elimination format and seeding options
  - Data persisted to D1 in production
- `/admin/+page` provides event ID navigation into player management.
- Documentation (`docs/`) outlines requirements, data model, design notes, and TODO list.

## D1 Database Setup

### Environment Variable Behavior
The application automatically selects the appropriate storage backend:
- **Default (no configuration)**: Uses in-memory storage for local development
- **With D1 binding**: Automatically uses D1 when deployed to Cloudflare Pages/Functions
- **Explicit override**: Set `USE_MEMORY_STORE=true` to force in-memory storage (useful for testing)

### Local Development
For local development, the application uses in-memory storage by default (no setup required). To test with D1 locally:

1. Create a local D1 database:
   ```bash
   cd web
   npx wrangler d1 create exvs-tournaments-db
   ```

2. Update `wrangler.toml` with the database ID from the output.

3. Run migrations:
   ```bash
   npx wrangler d1 migrations apply exvs-tournaments-db --local
   ```

4. Start dev server with D1:
   ```bash
   npm run dev
   ```

### Production Deployment
1. Create production D1 database:
   ```bash
   cd web
   npx wrangler d1 create exvs-tournaments-db
   ```

2. Update `wrangler.toml` with the production database ID.

3. Run migrations on production:
   ```bash
   npx wrangler d1 migrations apply exvs-tournaments-db --remote
   ```

4. Deploy to Cloudflare Pages:
   ```bash
   npm run build
   npx wrangler pages deploy
   ```

### Database Schema
The D1 schema includes tables for:
- `events`: Event metadata and public slugs
- `players`: Player information per event
- `pairs`: 2-player team combinations
- `tournaments`: Tournament configurations
- `bracket_matches`: Match data for tournament brackets
- `teams`, `team_members`: Team battle support
- `team_battles`, `team_battle_slots`: Waseda-style team competitions
- `matches`, `match_participations`: Match logs and player participation
- `player_stats`: Aggregated statistics
- `audit_logs`: Action audit trail

See `web/migrations/0001_initial_schema.sql` for complete schema definition.

### Implementation Notes
- **UUID Generation**: D1 repositories use `crypto.randomUUID()` (Cloudflare Workers compatible) instead of `node:crypto`
- **Automatic Fallback**: The system gracefully falls back to in-memory storage if D1 is unavailable, ensuring local development works without configuration

## Outstanding Work Items
1. **D1データベースの本番環境セットアップ**
   - Run `wrangler d1 create` for production database
   - Apply migrations to production database
   - Configure Cloudflare Pages environment variables
2. **Cloudflare Pages/Functionsへのデプロイ設定**
   - Set up CI/CD pipeline for automatic deployments
   - Configure production secrets (BASIC_AUTH_USER, BASIC_AUTH_PASS)

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
