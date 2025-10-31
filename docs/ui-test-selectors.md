# UIテスト用セレクタ（data-testid）一覧

このドキュメントでは、Cursorのブラウザー機能でUI自動化を行うための `data-testid` 属性の一覧を記載しています。

## 命名規約

- **単一要素**: `pair-select`, `add-pair-button` など、役割を表す kebab-case
- **コンテナ**: `participants-list`, `bracket` など、集合を表す kebab-case
- **動的要素**: `participant-<id>`, `match-<id>`, `round-<round>` など、IDや番号を含む形式
- **側指定**: `participant-a`, `participant-b` など、固定の側を表す形式

## 使用方法

Cursorのブラウザー機能では、以下のように `querySelector` を使用して要素を取得できます：

```javascript
// 例: ペア選択のselect要素を取得
const pairSelect = document.querySelector('[data-testid="pair-select"]');

// 例: 特定の参加者要素を取得
const participant = document.querySelector('[data-testid="participant-abc123"]');

// 例: ブラケットの最初のラウンドを取得
const round1 = document.querySelector('[data-testid="round-1"]');
```

## 画面別セレクタ一覧

### 管理: トーナメント参加者管理
**ファイル**: `remix/app/routes/admin.events.$eventId.tournaments.$tournamentId.participants.tsx`

#### フォーム要素
- `pair-select`: ペア選択のselect要素（`name="pairId"`）
- `add-pair-button`: ペア追加ボタン（`type="submit"`）

#### 参加者一覧
- `participants-list`: 参加者一覧のセクション全体
- `participant-<id>`: 各参加者項目（`participant.id` を使用）

### 管理: トーナメントブラケット
**ファイル**: `remix/app/routes/admin.events.$eventId.tournaments.$tournamentId.bracket.tsx`

#### ブラケット全体
- `bracket`: ブラケット表示のセクション全体

#### ラウンド
- `round-<round>`: 各ラウンドセクション（`round.round` を使用）
  - 例: `round-1`, `round-2`, `round-3`

#### 試合
- `match-<id>`: 各試合カード（`match.id` を使用）

#### 参加者スロット
- `participant-a`: サイドAの参加者スロット
- `participant-b`: サイドBの参加者スロット

### 公開: トーナメントブラケット
**ファイル**: `remix/app/routes/events.$eventId.tournaments.$tournamentId.bracket.tsx`

管理画面と同様のセレクタを使用：
- `bracket`: ブラケット表示のセクション全体
- `round-<round>`: 各ラウンドセクション
- `match-<id>`: 各試合カード
- `participant-a`: サイドAの参加者スロット
- `participant-b`: サイドBの参加者スロット

### 公開: イベント参加者一覧
**ファイル**: `remix/app/routes/events.$eventId.participants.tsx`

#### プレイヤー一覧
- `participants-list`: プレイヤー一覧のセクション全体
- `participant-<id>`: 各プレイヤー項目（`player.id` を使用）

#### ペア一覧
- `participants-list`: ペア一覧のセクション全体（プレイヤー一覧と同じtestid）
- `pair-<id>`: 各ペア項目（`pair.id` を使用）

### 管理: イベント参加者一覧
**ファイル**: `remix/app/routes/admin.events.$eventId.participants.tsx`

公開画面と同様のセレクタを使用：
- `participants-list`: 参加者一覧のセクション全体
- `participant-<id>`: 各プレイヤー項目
- `pair-<id>`: 各ペア項目

### 管理: ペア管理
**ファイル**: `remix/app/routes/admin.events.$eventId.entries.pairs.tsx`

#### ボタン
- `update-pair-button`: ペア更新ボタン（`type="submit"`, `_intent="update"`）
- `delete-pair-button`: ペア削除ボタン（`type="submit"`, `_intent="delete"`）

## 実装の注意点

1. **動的ID**: データベースのIDを使用しているため、テスト実行時には実際のIDを確認する必要があります
2. **複数要素**: `participants-list` などは複数のセクションで使用されるため、文脈に応じて適切な要素を選択してください
3. **存在確認**: 要素が存在しない場合（例: 参加者が0人）を考慮してください

## テスト例

```javascript
// ペアを選択して追加する例
const pairSelect = document.querySelector('[data-testid="pair-select"]');
pairSelect.value = 'pair-id-123'; // 実際のペアIDを設定

const addButton = document.querySelector('[data-testid="add-pair-button"]');
addButton.click();

// 参加者一覧から特定の参加者を取得
const participant = document.querySelector('[data-testid="participant-abc123"]');
if (participant) {
  console.log('参加者が見つかりました:', participant.textContent);
}

// ブラケットの特定の試合を取得
const match = document.querySelector('[data-testid="match-xyz789"]');
if (match) {
  const participantA = match.querySelector('[data-testid="participant-a"]');
  const participantB = match.querySelector('[data-testid="participant-b"]');
  console.log('サイドA:', participantA?.textContent);
  console.log('サイドB:', participantB?.textContent);
}
```

