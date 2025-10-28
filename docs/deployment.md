# Deployment Guide

## Prerequisites

- Node.js 20.19.0 or higher (see `.nvmrc`)
- Cloudflare account with Pages and Workers access
- Wrangler CLI installed (`npm install -g wrangler`)

## Production D1 Database Setup

### 1. Create Production Database

```bash
cd web
wrangler d1 create exvs-tournaments-db
```

This will output a database ID. Copy this ID for the next step.

### 2. Update wrangler.toml

Replace the `database_id` in `web/wrangler.toml` with the actual production database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "exvs-tournaments-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # Replace with the ID from step 1
```

### 3. Apply Migrations to Production

```bash
cd web
npx wrangler d1 migrations apply exvs-tournaments-db --remote
```

### 4. Configure Cloudflare Pages Environment Variables

In the Cloudflare Pages dashboard, add the following environment variables:

- `BASIC_AUTH_USER`: Admin username for Basic authentication
- `BASIC_AUTH_PASS`: Admin password for Basic authentication

The D1 database binding is automatically configured through `wrangler.toml`.

## Manual Deployment

### Build and Deploy

```bash
cd web
npm run build
npx wrangler pages deploy remix/build/client --project-name=exvs-tournaments
```

## Automated Deployment (CI/CD)

The project uses GitHub Actions for automated deployment:

- **CI Workflow** (`.github/workflows/ci.yml`): Runs on all pushes and PRs
  - Type checking with `npm run check`
  - Unit tests with `npm run test`

- **Deploy Workflow** (`.github/workflows/deploy.yml`): Runs on master branch pushes
  - Runs all CI checks
  - Builds the application
  - Deploys to Cloudflare Pages

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

- `CLOUDFLARE_API_TOKEN`: API token with Pages and Workers permissions
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

## Rollback Procedure

### Option 1: Rollback via Cloudflare Dashboard

1. Go to Cloudflare Pages dashboard
2. Select the `exvs-tournaments` project
3. Navigate to the "Deployments" tab
4. Find the previous successful deployment
5. Click "Rollback to this deployment"

### Option 2: Rollback via Git

1. Identify the commit to rollback to:
   ```bash
   git log --oneline
   ```

2. Create a revert commit:
   ```bash
   git revert <commit-hash>
   git push origin master
   ```

3. The CI/CD pipeline will automatically deploy the reverted version

### Option 3: Manual Rollback

1. Checkout the previous working commit:
   ```bash
   git checkout <commit-hash>
   ```

2. Deploy manually:
   ```bash
   cd web
   npm run build
  npx wrangler pages deploy remix/build/client --project-name=exvs-tournaments
   ```

## Database Migrations

### Create a New Migration

```bash
cd web
npx wrangler d1 migrations create exvs-tournaments-db <migration-name>
```

### Apply Migrations Locally

```bash
cd web
npx wrangler d1 migrations apply exvs-tournaments-db --local
```

### Apply Migrations to Production

```bash
cd web
npx wrangler d1 migrations apply exvs-tournaments-db --remote
```

## Monitoring and Logs

### View Production Logs

```bash
npx wrangler pages deployment tail
```

### View D1 Database Queries

```bash
cd web
npx wrangler d1 execute exvs-tournaments-db --remote --command="SELECT * FROM events LIMIT 10"
```

## Troubleshooting

### Build Failures

1. Ensure Node.js version matches `.nvmrc`:
   ```bash
   node --version  # Should be 20.19.0 or higher
   ```

2. Clear cache and reinstall dependencies:
   ```bash
   cd web
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Run type check and tests locally:
   ```bash
   npm run check
   npm run test
   ```

### Database Connection Issues

1. Verify D1 binding in `wrangler.toml`
2. Check that migrations have been applied
3. Verify environment variables in Cloudflare Pages dashboard

### Authentication Issues

1. Verify `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` are set in Cloudflare Pages
2. Test locally with environment variables:
   ```bash
   cd web
   BASIC_AUTH_USER=admin BASIC_AUTH_PASS=password npm run dev
   ```
