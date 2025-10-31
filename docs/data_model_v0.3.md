# Boost Bracket データモデル v0.3

D1(SQLite)前提の論理モデル。型は概念表記。

## エンティティ

- Event（大会単位）
  - id, name, slug(publicViewerSlug), createdAt
  - 用途: 大会単位でデータを分離。公開用乱数スラッグで共有。

- Player
  - id, name, note?

- Pair
  - id, player1Id, player2Id, seed?

- Tournament（2on2シングルエリミ）
  - id, eventId, name, createdAt
  - entryMode: 'pair'|'solo'（参加モード: ペア参加/個別参加）

- BracketMatch
  - id, tournamentId, round, position
  - participantA: { type: 'pair'|'bye', pairId? }
  - participantB: { type: 'pair'|'bye', pairId? }
  - scoreA?, scoreB?, winnerSide?, status

- Team
  - id, eventId, name

- TeamMember
  - id, teamId, playerId

- TeamBattle（早稲田式、常に2チーム）
  - id, eventId, teamAId, teamBId
  - slotsCount(1..5), format='waseda'
  - allowDoubleAppearancePerTeam=true
  - tiebreak: 'off'|'representative'  （同点時のみ有効）
  - status, result?

- TeamBattleSlot（チーム別のスロット割当）
  - id, teamBattleId, teamId, slotIndex(0..n-1)
  - assignment:
    - 固定ペア: { type:'pair', pairId }
    - 即席: { type:'adhoc', player1Id, player2Id }

- Match（実試合の共通ログ）
  - id, context:'bracket'|'teamBattle'|'tiebreak', contextId
  - sideA: { type:'pair'|'adhoc', pairId? , playerIds? }
  - sideB: { type:'pair'|'adhoc', pairId? , playerIds? }
  - scoreA, scoreB, winnerSide, status, playedAt

- MatchParticipation（個人紐付け）
  - id, matchId, playerId, teamId?, pairId?, role?('slot0'..)
  - won:boolean

- TournamentParticipant（トーナメント参加者）
  - id, tournamentId, participantType: 'pair'|'solo'
  - pairId?（participantType='pair'の場合のみ）
  - playerId?（participantType='solo'の場合のみ）
  - seed?（ペア参加時のみ）
  - note?, status: 'active'|'removed', createdAt
  - 制約: (tournamentId, pairId) ユニーク、(tournamentId, playerId) ユニーク

- PlayerStats（集計スナップショット）
  - id, scope:'event'|'tournament'|'teamBattle'|'global', scopeId?, playerId
  - wins, losses, lastUpdatedAt

- RatingSnapshot（将来）
  - id, playerId, before, after, matchId, algo('elo'|'trueskill'), at

- AuditLog
  - id, action, by, at, payload

## 主な制約
- TeamBattleごとに、同一teamId内で同一playerIdの複数起用は「1名のみ2枠目まで」。
- TeamBattleSlotは、teamBattleId×teamId×slotIndexでユニーク。
- BracketMatchはtournamentId×round×positionでユニーク。
- MatchParticipationは(matchId, playerId)でユニーク。
- TournamentParticipantは(tournamentId, pairId)と(tournamentId, playerId)でそれぞれユニーク。
- TournamentのentryMode変更は、参加者が0件でないと不可。
- BracketMatch生成はentryMode='pair'のトーナメントでのみ可能（soloモードでは不可）。

## インデックス例
- Player(name)
- Pair(player1Id, player2Id)
- Tournament(eventId)
- BracketMatch(tournamentId, round)
- Team(eventId), TeamMember(teamId)
- TeamBattle(eventId)
- TeamBattleSlot(teamBattleId, teamId)
- Match(context, contextId, playedAt)
- MatchParticipation(playerId)

## JSON例: 代表戦の指定
```json
{
  "teamBattleId": "tb_12",
  "tiebreak": "representative",
  "tiebreakMatch": {
    "sideA": { "type": "adhoc", "playerIds": ["u1","u3"] },
    "sideB": { "type": "pair", "pairId": "p77" }
  }
}
```

## マイグレーション方針
- D1向けに.sqlで定義。開発ではDrizzle/Prisma等の軽量ORMも検討。
- 初期投入: 管理画面からCSV/JSONインポート。
