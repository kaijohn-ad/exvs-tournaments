# EXVS Tournaments

A web application for managing and displaying small-scale EXVS (Extreme VS) Infinite Boost tournaments.

## Quick Start

See the `web/` directory for the current SvelteKit application.

The in-progress Remix migration lives in `remix/` (Phase 1 of the framework migration plan). Refer to `remix/README.md` for its development workflow.

## Development

### Prerequisites

- Node.js 20.19.0 or higher (see `web/.nvmrc`)
- npm or compatible package manager

### Local Development

```bash
cd web
npm install
npm run dev
```

Visit http://localhost:5173/ to view the application.

### Running Tests

```bash
cd web
npm run test        # Run tests once
npm run test:watch  # Run tests in watch mode
```

### Type Checking

```bash
cd web
npm run check        # Run type check once
npm run check:watch  # Run type check in watch mode
```

## Deployment

See [docs/deployment.md](docs/deployment.md) for detailed deployment instructions including:

- Production D1 database setup
- Cloudflare Pages deployment
- Environment variable configuration
- Rollback procedures

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

- **CI Workflow** (`.github/workflows/ci.yml`): Runs on all pushes and pull requests
  - Type checking with `npm run check`
  - Unit tests with `npm run test`
  - Uses Node.js version from `web/.nvmrc`

- **Deploy Workflow** (`.github/workflows/deploy.yml`): Runs on pushes to `master` branch
  - Runs all CI checks
  - Builds the application
  - Deploys to Cloudflare Pages

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings for automated deployment:

- `CLOUDFLARE_API_TOKEN`: API token with Pages and Workers permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Project Structure

```
.
├── .github/workflows/    # CI/CD workflows
├── docs/                 # Documentation
│   ├── deployment.md     # Deployment guide
│   ├── TODO.md          # Development roadmap
│   └── ...
└── web/                 # Main application
    ├── migrations/      # D1 database migrations
    ├── src/
    │   ├── lib/server/repositories/  # Data repositories
    │   └── routes/                   # SvelteKit routes
    └── ...
```

## Features

- **Player Management**: Full CRUD operations with JSON import/export
- **Pair Management**: 2-player team management with seeding
- **Tournament Management**: Single-elimination bracket configuration
- **Admin Interface**: Basic auth protected admin routes
- **Data Persistence**: Cloudflare D1 (SQLite) database with in-memory fallback

## Documentation

- [Deployment Guide](docs/deployment.md)
- [TODO List](docs/TODO.md)
- [Requirements](docs/requirements_v0.3.md)
- [Design Document](docs/design_v0.3.md)
- [Data Model](docs/data_model_v0.3.md)
