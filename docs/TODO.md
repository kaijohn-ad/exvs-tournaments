# Boost Bracket TODO一覧

最終更新: 2025-10-27 (Devin session update)

## ✅ 完了済み
- [x] SvelteKit プロジェクト初期化と Cloudflare アダプタ設定
- [x] Basic 認証フックの実装
- [x] 管理トップ `/admin` の導線追加（イベントIDナビゲーション）
- [x] プレイヤー管理ページ `/admin/events/{eventId}/entries/players` のCRUD + テスト整備
- [x] プレイヤー管理UIの利便性向上（ステータスメッセージ表示、エラーハンドリング強化）
- [x] プレイヤー一覧のJSONインポート/エクスポート対応
- [x] プレイヤー管理UIのJSONエディタ追加（ダウンロード/即時プレビュー対応）
- [x] トーナメント設定ページのスケルトン作成
  - トーナメントリポジトリ実装（CRUD操作、ユニットテスト）
  - トーナメント設定ページ `/admin/events/{eventId}/tournaments` の実装
  - トーナメント作成/更新/削除機能
  - JSONインポート/エクスポート対応
  - JSONエディタ機能
  - 管理トップからの導線追加
- [x] Cloudflare D1 への永続化層移行とシークレット設定
  - D1データベーススキーマ設計とマイグレーション作成
  - プレイヤー・トーナメントリポジトリのD1対応実装
  - テスト環境でのメモリストア/D1切り替え機能
  - SvelteKitサーバーハンドラのD1対応
  - 全テスト通過確認（27 tests passed）
  - wrangler.toml設定追加
  - デフォルト動作の改善（USE_MEMORY_STORE未設定時もメモリ実装へフォールバック）
  - Workers互換のcrypto.randomUUID()への置き換え（node:crypto削除）
  - ローカル開発での設定不要化（D1未設定でも動作）

- [x] Node.js 20.19 以降への移行徹底
  - [.nvmrc](../web/.nvmrc) および `package.json` の `engines` を更新済み
  - GitHub Actions CI/CD ワークフローで Node.js バージョン固定
- [x] CI/CD パイプライン整備（自動テスト、Pages デプロイ）
  - `.github/workflows/ci.yml`: PR/push時の自動テスト・型チェック
  - `.github/workflows/deploy.yml`: master へのマージで自動デプロイ
  - デプロイ前に `npm run check` と `npm run test` を実行
- [x] デプロイ手順とロールバック方針のドキュメント化
  - `docs/deployment.md` に本番D1セットアップ、デプロイ、ロールバック手順を記載
- [x] ペア管理（2人チーム）の CRUD + JSON 入出力
  - `src/lib/server/repositories/pairs.ts`: メモリ実装
  - `src/lib/server/repositories/pairs-d1.ts`: D1実装
  - `src/routes/admin/events/[eventId]/entries/pairs/`: 完全なCRUD UI
  - JSON インポート/エクスポート、JSONエディタ機能実装
  - 管理トップからの導線追加
- [x] チーム管理の CRUD + JSON 入出力
  - `src/lib/server/repositories/teams.ts`: メモリ実装
  - `src/lib/server/repositories/teams-d1.ts`: D1実装
  - `src/routes/admin/events/[eventId]/entries/teams/`: 完全なCRUD UI
  - JSON インポート/エクスポート、JSONエディタ機能実装
  - 管理トップからの導線追加
- [x] 団体戦リポジトリの実装
  - `src/lib/server/repositories/team-battles.ts`: メモリ実装
  - `src/lib/server/repositories/team-battles-d1.ts`: D1実装
  - データベースコンテキストへの統合完了
- [x] 試合ログリポジトリの実装
  - `src/lib/server/repositories/matches.ts`: メモリ実装
  - `src/lib/server/repositories/matches-d1.ts`: D1実装
  - データベースコンテキストへの統合完了
- [x] プレイヤー統計リポジトリの実装
  - `src/lib/server/repositories/player-stats.ts`: メモリ実装
  - `src/lib/server/repositories/player-stats-d1.ts`: D1実装
  - データベースコンテキストへの統合完了
- [x] 公開ビュー（観覧用）の基本ルーティング
  - `/view/[slug]` ルーティング作成
  - 基本的なUI実装（プレースホルダー）

## 🚧 進行中
- [ ] 団体戦（早稲田式）の UI 実装
  - リポジトリは完成、UI作成が必要
- [ ] 試合ログ UI の実装
  - リポジトリは完成、UI作成が必要
- [ ] プレイヤー統計ビュー UI の実装
  - リポジトリは完成、UI作成が必要
- [ ] 公開ビューの機能拡張
  - トーナメントブラケット表示の実装が必要

## 📝 着手予定
- [ ] D1データベースの本番環境セットアップ（`wrangler d1 create` 実行）
  - 手順は `docs/deployment.md` に記載済み
  - 実際の本番DB作成とマイグレーション適用が必要
- [ ] Cloudflare Pages 環境変数の設定
  - `BASIC_AUTH_USER` と `BASIC_AUTH_PASS` の設定
  - GitHub Secrets の設定（`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`）
- [ ] ブラケット管理機能の実装
  - [ ] トーナメントブラケットの生成・表示
  - [ ] 試合結果の入力と進行管理

---
更新ルール:
1. 新しいタスクを追加したらセクションに追記し日付を更新。
2. 着手したら「進行中」へ移動し、完了後は「完了済み」へチェック付きで移動。
3. ユーザーへの共有が必要な場合はコミット前に最新化しておく。
