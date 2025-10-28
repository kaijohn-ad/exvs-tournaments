# Boost Bracket TODO一覧

最終更新: 2025-10-28 (Kai session - update 3)

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

- [x] 試合ログ UI の実装
  - `src/routes/admin/events/[eventId]/matches/`: 試合履歴表示UI
  - side_a/side_b 構造に対応した表示ロジック
  - スコア表示、勝敗バッジ、削除機能
  - 管理トップからの導線追加
- [x] プレイヤー統計ビュー UI の実装
  - `src/routes/admin/events/[eventId]/stats/`: 統計表示UI
  - 勝率計算、ランキング表示
  - 視覚的な勝率バー表示
  - 管理トップからの導線追加
- [x] 団体戦（早稲田式）の基本 UI 実装
  - `src/routes/admin/events/[eventId]/team-battles/`: 団体戦一覧UI
  - 団体戦表示（チーム名、スロット数、形式、ステータス、結果）
  - 削除機能
  - 管理トップからの導線追加
- [x] 団体戦作成・編集・ラインナップ管理機能の実装
  - 団体戦作成フォーム（チーム選択、スロット設定、形式選択、バリデーション）
  - 団体戦編集UI（既存カードからの更新操作）
  - ラインナップ編集UI（team_battle_slots 操作、ペア/個別割当、並び替え・追加・削除）
  - 団体戦詳細ページの進行管理（スロット結果入力、削除、勝敗判定、自動集計）
  - タイブレーク入力（代表戦）と最終確定処理
  - 試合ログ・プレイヤー統計連携
  - 包括的なサーバーアクションテスト
- [x] 団体戦作成フォームの500エラー修正
  - SSR環境で `invalidate` が呼び出されないようブラウザ判定をヘルパー化
  - 判定ロジックのユニットテスト追加（`invalidation-helpers.test.ts`）
  - Vitest 実行フローを見直し、再発防止テストをCI経由でも実行可能に整備
- [x] ブラケット生成ロジックの実装
  - シングルエリミネーション生成アルゴリズム
  - ランダム/手動シード対応とBYE自動反映
  - メモリ/D1リポジトリでの bracket_matches 保存処理
- [x] ブラケット表示UIの実装
  - 管理画面でのトーナメント表視覚化（ラウンド別カラム表示、ステータスバッジ、進行状況カード）
  - 試合結果と自動進出状況の表示（スコア・勝敗ハイライト、BYE表示）
  - トーナメント設定ページからの導線追加とサーバーロードテスト整備
- [x] 試合結果入力UIの実装
  - 各マッチの勝者選択とスコア入力フォーム
  - 次ラウンドへの自動進出およびステータスリセット制御
  - 結果ログ保存とプレイヤー統計反映、サーバーテスト整備

## 🚧 進行中
なし

## 📝 着手予定

### 優先度高：トーナメントブラケット機能
### 優先度中：公開ビューの完成
- [ ] トーナメントブラケット公開表示
  - 観覧者向けの読み取り専用ビュー
  - リアルタイム更新（オプション）
  - モバイル対応レイアウト
- [ ] イベント情報の表示改善
  - 参加者一覧
  - スケジュール表示
  - 結果サマリー

### 優先度低：本番環境セットアップ（手動作業）
- [ ] D1データベースの本番環境セットアップ
  - `wrangler d1 create exvs-tournaments-db` 実行
  - `wrangler d1 migrations apply --remote` 実行
  - 手順は `docs/deployment.md` に記載済み
- [ ] Cloudflare Pages 環境変数の設定
  - `BASIC_AUTH_USER` と `BASIC_AUTH_PASS` の設定
  - D1 バインディングの確認
- [ ] GitHub Secrets の設定
  - `CLOUDFLARE_API_TOKEN` の登録
  - `CLOUDFLARE_ACCOUNT_ID` の登録

---

## 📊 セッション成果サマリー (2025-10-27)

**PR**: https://github.com/kaijohn-ad/exvs-tournaments/pull/3
**セッションID**: 5e0c0da4c6134692bfdaaed6b10862ef
**CI ステータス**: ✅ All checks passed

### 実装完了機能
1. **ペア管理**: 完全なCRUD + JSON入出力
2. **チーム管理**: 完全なCRUD + JSON入出力
3. **リポジトリ層**: 6つの新規リポジトリ（pairs, teams, team-battles, matches, player-stats）
4. **統計・ログUI**: プレイヤー統計表示、試合ログ表示
5. **団体戦UI**: 作成・編集・ラインナップ管理・進行管理まで実装
6. **公開ビュー**: 基本ルーティング（ブラケット表示は未実装）
7. **CI/CD**: GitHub Actions による自動テスト・デプロイ

### テスト結果
- ✅ 型チェック: 0 errors (CSS warnings のみ)
- ✅ ユニットテスト: 27/27 passed
- ✅ CI/CD: All checks passed

### 次回セッションへの引き継ぎ
- 団体戦機能は作成〜進行管理まで実装済み。UX改善（ドラッグ&ドロップ等）が必要なら後続で検討。
- 団体戦フォームの500エラーは解消済み。新規タスクはブラケット機能に集中できる状態。
- 公開ビューの完成は優先度中

---
更新ルール:
1. 新しいタスクを追加したらセクションに追記し日付を更新。
2. 着手したら「進行中」へ移動し、完了後は「完了済み」へチェック付きで移動。
3. ユーザーへの共有が必要な場合はコミット前に最新化しておく。
