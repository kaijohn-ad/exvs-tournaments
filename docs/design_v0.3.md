# Boost Bracket システム設計書 v0.3

## アーキテクチャ/技術選定
- フロント/SSR: SvelteKit
- ホスティング: Cloudflare Pages（フロント/SSR）+ Cloudflare Functions（API）
- DB: Cloudflare D1（SQLite）
- 認証: Basic認証（Edge Middleware）
- 言語: 日本語
- テスト: Vitest（ユニット/統合）、Playwright（E2E、iPadビューポート）
- CI/CD: GitHub Actions → Cloudflare Pages/Functions デプロイ

## ユースケース/フロー
- 管理者
  - プレイヤー登録 → ペア作成 → トーナメント生成（or 団体戦作成） → 試合結果入力 → 表示/共有
- 観覧者
  - 乱数スラッグURLで閲覧（読み取り専用）

## ルーティング（例）
- /events （公開イベント一覧、トーナメント・団体戦リスト）
- /events/:eventId/dashboard
- /events/:eventId/tournaments/:id/bracket （公開ブラケット表示）
- /events/:eventId/team-battles/:battleId/board （公開団体戦ボード表示）
- /admin/events/:eventId/entries  （Basic認証）
- /admin/events/:eventId/settings （Basic認証）

## 認証/公開
- 管理配下(/admin/...)のみBasic認証。
- 閲覧は乱数スラッグ（例: /view/ab12cd34）で共有。権限はGETのみ。

## データ同期
- API: REST/JSON（Functions）
- 更新: 5秒ポーリング（後日SSE/WSに拡張）
- 公開ブラケットビュー: 自動更新（5秒間隔）でリアルタイム進行状況を表示
- 公開団体戦ボード: 自動更新（5秒間隔）でスコア・ラインナップ・試合結果を表示
- 入力途中はlocalStorageにドラフト保存

## トーナメント（シングルエリミ）
- 生成: ランダム/任意シード、BYE自動付与。
- 表現: BracketMatchでラウンド/位置/参加者を保持。勝者は次のノードに連結。
- 編集: D&Dで参加者入替、手動で結果修正可能。監査ログ記録。

## 団体戦（早稲田式、2チーム固定）
- スロット数: 1..5（デフォルト3）。
- ラインナップ: 固定ペア or 即席ペア（任意の2名）でスロットに割当。
- 制約: チーム内で同一プレイヤーの複数起用は「1名のみ2回まで」。
- リセット: 制約は団体戦ごとに毎回リセット。
- 代表戦: 偶数スロットで同点時、設定オンなら管理者が任意ペアを選択して代表戦を1試合実施。

## アルゴリズム（要約）
- シングルエリミ生成
  - Nを2の冪にパディング（BYE）。シード固定位置に配置、残りシャッフル。
  - BracketMatchを生成し勝ち上がりリンクを形成。
- 団体戦ラインナップ自動案
  - ロスターから重複なしで貪欲にペア組成。不足が出たら最小コストで1名を2回目に割当。
  - 制約検証に通らない場合は警告し保存不可。

## テスト戦略
- ユニット: 生成/制約検証/代表戦判定/結果集計。
- 統合: エントリー→生成→入力→集計→表示。
- E2E: iPadで主要フロー（Basic認証通過含む）。

## CI/CD
- Lint/Test/Build → Cloudflare Pages/Functions へ自動デプロイ。
- Secrets: BASIC_AUTH_USER/PASS、D1バインディング。

## セキュリティ
- Basic認証はEdgeで検証。閲覧面はGETのみ許容。
- 監査ログ（重要操作）をD1に保存。
