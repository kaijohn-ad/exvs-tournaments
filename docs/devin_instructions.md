# Devin Task Brief (2025-10-27)

## 1. Node.js 20.19+ Adoption Enforcement
- Confirm `.nvmrc` and `package.json#engines` are aligned on Node.js 20.19+.
- Update developer onboarding docs / CI workflows so every environment uses the pinned version.
- Surface any blockers that prevent universal adoption.

## 2. D1 本番データベースのセットアップ
- `wrangler d1 create` で本番DBを発行し、`wrangler.toml` のバインディングを更新。
- 本番DBへ `npx wrangler d1 migrations apply --remote` を実行。
- Cloudflare Pages 側に必要な環境変数（特に BASIC 認証情報、D1 バインディング）を登録。
- 作業結果と手順を docs/TODO.md に反映。

## 3. Cloudflare Pages/Functions へのデプロイ整備
- CI/CD パイプラインを整備し、`master` へのマージで自動デプロイされるよう構成。
- デプロイ前後に `npm run check` / `npm run test` を実行するジョブを追加。
- 手動デプロイ手順とロールバック方針を docs/ 配下に追記。

## 4. 追加エンティティ設計と UI/UX 実装
### 4.1 ペア管理（2人チーム）
- CRUD UI + JSON インポート/エクスポート実装。
- Player/Tournament と同水準のバリデーション・エラーハンドリングを実装。

### 4.2 団体戦（早稲田式）ラインナップ
- 団体戦用エンティティ（teams, team_members, team_battles, team_battle_slots）の操作UIを作成。
- ラインナップ編集、メンバーアサイン、試合進行管理の基本機能を提供。

### 4.3 試合ログと統計ビュー
- 試合結果保存用UI（matches, match_participations）。
- シンプルな統計ビュー（player_stats）を提供。

## 5. 公開ビュー（観覧用）の初期実装
- イベント slug を利用した公開ルーティングを作成。
- トーナメント進行状況を閲覧できるUI（基本的なブラケットビュー）。

## 6. CI/CD パイプラインの拡張
- Pages デプロイに合わせた自動テスト・リンティングの実行フローを整備。
- 成果を README / docs/TODO.md に反映し、実行ログを共有。
