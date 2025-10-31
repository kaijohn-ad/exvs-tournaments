# Deployment Guide

## Prerequisites

- Node.js 20.19.0 or higher (see `.nvmrc`)
- Cloudflare account with Pages and Workers access
- Wrangler CLI installed (`npm install -g wrangler`)

## Cloudflare Pages 環境設定

本プロジェクトでは、Cloudflare Pages の環境別にD1データベースを分離して運用します：

- **Production環境**: 本番用D1データベース（`exvs-tournaments-db`）
- **Preview環境**: 開発/テスト用D1データベース（`exvs-tournaments-dev`）

### Production環境とPreview環境のマッピング

- **Productionブランチ**: `feature/remix-workers-migration`（移行完了後は `master`）
- **Previewブランチ**: 上記以外の全ブランチ（PRやフィーチャーブランチ）

Cloudflare Pages では、Productionブランチへのデプロイは自動的にProduction環境に、それ以外のブランチはPreview環境にデプロイされます。

### 環境ステージ識別（ENVIRONMENT_STAGE）

本プロジェクトでは、データベース接続状況を環境別にログ出力するため、`ENVIRONMENT_STAGE` 環境変数を使用して環境を識別します。

- **Production環境**: `ENVIRONMENT_STAGE = "production"`（`wrangler.toml`/`wrangler.json` の `[env.production.vars]` で設定）
- **Preview環境**: `ENVIRONMENT_STAGE = "preview"`（`wrangler.toml`/`wrangler.json` の `[env.preview.vars]` で設定）
- **開発環境**: `ENVIRONMENT_STAGE` が未設定の場合、`NODE_ENV` に基づいて自動判定（`NODE_ENV=production` なら `"production"`、それ以外は `"development"`）

この環境変数は `wrangler.toml` と `wrangler.json` の両方に設定されており、Cloudflare Pages のデプロイ時に自動的に適用されます。データベース接続時には、この環境ステージ情報がJSONログとして出力され、接続状況の監視に使用されます。

### データソース選択（Preview/開発）

- 本番環境では常に D1 を使用します（必須）。
- Preview/開発環境では、D1 バインディングが存在する場合は既定で D1 を使用します。
- メモリストアを明示的に使用したい場合は、`USE_MEMORY_STORE=true` を設定してください。
- D1 バインディングが存在しない場合は自動的にメモリストアへフォールバックします。

## Production D1 Database Setup

### 1. Create Production Database

```bash
cd remix
wrangler d1 create exvs-tournaments-db
```

This will output a database ID. Copy this ID for the next step.

### 2. Update wrangler.toml

`remix/wrangler.toml` にProduction環境用の設定を追加します：

```toml
migrations_dir = "migrations"

# Production environment (Cloudflare Pages Production)
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "exvs-tournaments-db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # Replace with the ID from step 1
```

### 3. Apply Migrations to Production

```bash
cd remix
npx wrangler d1 migrations apply exvs-tournaments-db --remote --env production
```

### 4. Configure Cloudflare Pages Environment Variables

Cloudflare Pages ダッシュボードの **Production環境** に以下の環境変数を設定：

- `BASIC_AUTH_USER`: Admin username for Basic authentication（`/admin` 配下へのアクセス保護用）
- `BASIC_AUTH_PASSWORD`: Admin password for Basic authentication（`/admin` 配下へのアクセス保護用）

**注意**: これらの環境変数は本番環境のみに設定してください。Preview環境や開発環境では未設定のままにすることで、Basic認証が無効化されます。これにより、ローカル開発やプレビュー環境でのテストが容易になります。

The D1 database binding is automatically configured through `wrangler.toml`.

## Preview D1 Database Setup

Preview環境用のD1データベースをセットアップすることで、本番環境のデータベースに影響を与えずに開発やテストを行うことができます。

### 1. Create Preview Database

```bash
cd remix
wrangler d1 create exvs-tournaments-dev
```

This will output a database ID. Copy this ID for the next step.

### 2. Update wrangler.toml with Preview Environment

`remix/wrangler.toml` にPreview環境用の設定を追加します：

```toml
migrations_dir = "migrations"

# Production environment (Cloudflare Pages Production)
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "exvs-tournaments-db"
database_id = "<PRODUCTION_DB_ID>"

# Preview environment (Cloudflare Pages Preview/開発環境)
[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "exvs-tournaments-dev"
database_id = "<PREVIEW_DB_ID>"  # Replace with the ID from step 1
```

### 3. Apply Migrations to Preview Database

```bash
cd remix
npx wrangler d1 migrations apply exvs-tournaments-dev --remote --env preview
```

### 4. Verify Migrations

Preview環境用データベースにマイグレーションが適用されたことを確認：

```bash
cd remix
npx wrangler d1 migrations list exvs-tournaments-dev --remote --env preview
```

### 5. Configure Cloudflare Pages Preview Environment Variables

Cloudflare Pages ダッシュボードの **Preview環境** に必要に応じて環境変数を設定：

- `BASIC_AUTH_USER`: Admin username for Basic authentication（オプション、未設定の場合は認証なし）
- `BASIC_AUTH_PASSWORD`: Admin password for Basic authentication（オプション、未設定の場合は認証なし）

**注意**: Preview環境では通常、これらの環境変数は設定しません。未設定の場合、Basic認証は無効化され、開発やテストが容易になります。

### マイグレーションディレクトリについて

マイグレーションファイルは `remix/migrations/` ディレクトリに配置されています。`wrangler.toml` の `migrations_dir` 設定により、このディレクトリがマイグレーションのソースとして使用されます。

## Deployment Policy

**重要**: 本プロジェクトでは手動の`wrangler deploy`は使用せず、すべてGitHub ActionsでCloudflare Pagesにデプロイします。

### GitHub Actions からのデプロイ時の環境設定

GitHub Actions (`cloudflare/pages-action`) を使用してデプロイする場合、`wrangler.toml` の環境設定は以下のように自動的に適用されます：

- **Productionブランチ** (`master`, `feature/remix-workers-migration` など): 
  - トップレベルの `d1_databases` 設定が使用されます（Production環境用）
  - `[env.production]` の設定も同様に利用可能です

- **Previewブランチ** (上記以外のブランチやPR):
  - `[env.preview]` の設定が使用されます（Preview環境用）

`wrangler.toml` のトップレベル設定は Production環境のデフォルトとして機能し、Preview環境では `[env.preview]` 設定が優先されます。これにより、Cloudflare Pagesが自動的に環境を判定して適切なD1データベースに接続します。

## Manual Deployment

### GitHub CLIを使用した手動デプロイ

```bash
# デプロイワークフローを手動実行
gh workflow run deploy.yml

# 特定の環境を指定してデプロイ
gh workflow run deploy.yml -f environment=production

# CIワークフローを手動実行
gh workflow run ci.yml

# 特定のテストタイプを指定
gh workflow run ci.yml -f test_type=typecheck
```

### ワークフロー実行状況の確認

```bash
# 実行中のワークフローを確認
gh run list

# 特定のワークフローの実行状況を確認
gh run list --workflow=deploy.yml

# 実行ログを確認
gh run view <run-id>
```

## Automated Deployment (CI/CD)

The project uses GitHub Actions for automated deployment:

- **CI Workflow** (`.github/workflows/ci.yml`): Runs on all pushes and PRs
  - Type checking with `npm run check`
  - Unit tests with `npm run test`
  - 手動実行可能（`workflow_dispatch`）

- **Deploy Workflow** (`.github/workflows/deploy.yml`): 
  - **Production deployments**: Runs on `master` branch pushes
    - Runs all CI checks (type check, tests)
    - Builds the application
    - Deploys to Cloudflare Pages Production environment
    - Uses Production D1 database (`exvs-tournaments-db`)
  - **Preview deployments**: Runs on Pull Requests (opened, synchronize, reopened)
    - Runs all CI checks (type check, tests)
    - Builds the application
    - Deploys to Cloudflare Pages Preview environment
    - Uses Preview D1 database (`exvs-tournaments-dev`)
    - Automatically comments preview URL on the PR
  - 手動実行可能（`workflow_dispatch`）

### PR Preview機能

プルリクエストが作成・更新されると、自動的にプレビュー環境がデプロイされます：

1. **自動デプロイ**: PRが作成・更新されると、ワークフローが自動実行されます
2. **プレビューURL**: デプロイ完了後、プレビューURLがPRに自動コメントされます
3. **環境分離**: プレビュー環境は開発用D1データベース（`exvs-tournaments-dev`）を使用します
4. **並列実行制御**: 同じブランチでの同時実行は最新のもののみが実行され、古い実行は自動キャンセルされます

プレビュー環境のURL形式は以下の通りです：
```
https://<branch-name>.exvs-tournaments.pages.dev
```

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

- `CLOUDFLARE_API_TOKEN`: API token with Pages and Workers permissions (プレビューURL取得のため、Pages読み取り権限が必要)
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

### Required GitHub Permissions

デプロイワークフローは以下の権限を使用します：

- `contents: read`: リポジトリの読み取り
- `deployments: write`: GitHub Deployments APIへの書き込み
- `pull-requests: write`: PRへのコメント投稿

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
   cd remix
   npm run build
   npx wrangler pages deploy build/client --project-name=exvs-tournaments
   ```

## Database Migrations

マイグレーションファイルは `remix/migrations/` ディレクトリに配置されています。

### Create a New Migration

```bash
cd remix
npx wrangler d1 migrations create exvs-tournaments-db <migration-name>
```

新しいマイグレーションファイルが `remix/migrations/` に作成されます。

### Apply Migrations Locally

ローカル開発用のD1データベースに適用：

```bash
cd remix
# Production環境用のローカルDB
npx wrangler d1 migrations apply exvs-tournaments-db --local --env production

# Preview環境用のローカルDB
npx wrangler d1 migrations apply exvs-tournaments-dev --local --env preview
```

### Apply Migrations to Production (Cloudflare Pages Production)

```bash
cd remix
npx wrangler d1 migrations apply exvs-tournaments-db --remote --env production
```

### Apply Migrations to Preview (Cloudflare Pages Preview)

```bash
cd remix
npx wrangler d1 migrations apply exvs-tournaments-dev --remote --env preview
```

### マイグレーション適用のベストプラクティス

1. **新しいマイグレーション作成時**:
   - ローカルで動作確認
   - Preview環境に適用してテスト
   - 問題なければProduction環境に適用

2. **環境別マイグレーション適用順序**:
   - ローカル開発環境 → Preview環境 → Production環境

### 最近のマイグレーション

- **0003_add_deleted_at_to_pairs.sql**: `pairs`テーブルに`deleted_at`カラムを追加し、ペアの論理削除を実装。削除済みペアは一覧に表示されず、参照も制限されます。
- **0005_add_ffa_groups.sql**: FFA 2-up形式のトーナメントをサポートするため、`ffa_groups`テーブルを追加し、`tournaments`テーブルの`format`カラムに`'ffa-2up'`オプションを追加。4人1グループで上位2名が勝ち上がる形式をサポートします。

## Monitoring and Logs

### View Production Logs

```bash
npx wrangler pages deployment tail
```

### View D1 Database Queries

Production環境：

```bash
cd remix
npx wrangler d1 execute exvs-tournaments-db --remote --env production --command="SELECT * FROM events LIMIT 10"
```

Preview環境：

```bash
cd remix
npx wrangler d1 execute exvs-tournaments-dev --remote --env preview --command="SELECT * FROM events LIMIT 10"
```

## Troubleshooting

### Build Failures

1. Ensure Node.js version matches `.nvmrc`:
   ```bash
   node --version  # Should be 20.19.0 or higher
   ```

2. Clear cache and reinstall dependencies:
   ```bash
   cd remix
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Run type check and tests locally:
   ```bash
   npm run check
   npm run test
   ```

### Database Connection Issues

1. Verify D1 binding in `remix/wrangler.toml` (or `remix/wrangler.json`)
2. Check that migrations have been applied:
   - Production: `npx wrangler d1 migrations list exvs-tournaments-db --remote --env production`
   - Preview: `npx wrangler d1 migrations list exvs-tournaments-dev --remote --env preview`
3. Verify environment variables in Cloudflare Pages dashboard (Production環境とPreview環境それぞれ確認)
4. For Preview environment, ensure `--env preview` flag is used when running wrangler commands
5. For Production environment, ensure `--env production` flag is used when running wrangler commands

### Authentication Issues

1. Verify `BASIC_AUTH_USER` and `BASIC_AUTH_PASSWORD` are set in Cloudflare Pages Production environment
2. Test locally with environment variables:
   ```bash
   cd remix
   BASIC_AUTH_USER=admin BASIC_AUTH_PASSWORD=password npm run dev
   ```
3. Basic認証は `/admin` 配下のパスにのみ適用されます。他のパス（`/events` など）には影響しません。
4. 環境変数が未設定の場合は認証が無効化されます。本番環境のみ設定してください。
