# UI統合テスト レポート

## テスト実行方法

### develop環境での実行

```bash
cd remix
BASE_URL="https://develop.exvs-tournaments.pages.dev" \
BASIC_AUTH_USER=local \
BASIC_AUTH_PASS=local \
npm run test:e2e
```

### UIモードでの実行（推奨）

```bash
cd remix
BASE_URL="https://develop.exvs-tournaments.pages.dev" \
BASIC_AUTH_USER=local \
BASIC_AUTH_PASS=local \
npm run test:e2e:ui
```

### デバッグモードでの実行

```bash
cd remix
BASE_URL="https://develop.exvs-tournaments.pages.dev" \
BASIC_AUTH_USER=local \
BASIC_AUTH_PASS=local \
npm run test:e2e:debug
```

## テスト範囲

### シングルエリミネーション
- ✅ 10名（固定シード）- 全試合完了まで
- ✅ 10名（シャッフルシード）- 全試合完了まで
- ✅ 20名（固定シード）- 全試合完了まで + 公開ブラケット確認
- ✅ 20名（シャッフルシード）- 全試合完了まで + 公開ブラケット確認

### ダブルエリミネーション
- ✅ 10名（固定シード、GF single）- 全試合完了まで
- ✅ 10名（シャッフルシード、GF single）- 全試合完了まで
- ✅ 20名（固定シード、GF reset）- reset条件発火 + 全試合完了まで + 公開ブラケット確認
- ✅ 20名（シャッフルシード、GF reset）- reset条件発火 + 全試合完了まで + 公開ブラケット確認

### 団体戦 勝ち抜き戦（KOTH）
- ✅ 10名（自動チーム分け、スロット数3）- 自動終了 + 削除復元
- ✅ 20名（自動チーム分け、スロット数5）- ラインナップ未設定エラー確認

### 団体戦 早稲田式
- ✅ タイブレークあり（代表戦）- 作成確認
- ✅ タイブレークなし - 作成確認

## テストファイル

- `remix/e2e/tournaments.single.spec.ts` - シングルエリミネーション
- `remix/e2e/tournaments.double.spec.ts` - ダブルエリミネーション
- `remix/e2e/team-battle.koth.spec.ts` - 勝ち抜き戦
- `remix/e2e/team-battle.waseda.spec.ts` - 早稲田式
- `remix/e2e/_helpers.ts` - 共通ヘルパー関数

## レポート出力

テスト実行後、以下のディレクトリにレポートが出力されます：

- `remix/e2e-report/` - HTMLレポート
- スクリーンショット（失敗時）
- 動画（失敗時）

## 注意事項

- develop環境のBasic認証は `local / local` です
- テスト実行時は、`E2E-` で始まるイベントが作成されます
- テストデータのクリーンアップは手動で行ってください（現在は自動削除機能は実装されていません）

