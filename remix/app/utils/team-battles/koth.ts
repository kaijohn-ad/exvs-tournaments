export type KothState = {
	nextMatchIndex: number;
	aCurrentIndex: number; // A側の現在出場枠 index (0-based)
	bCurrentIndex: number; // B側の現在出場枠 index (0-based)
	aLosses: number;
	bLosses: number;
	finished: boolean;
	winnerTeamId?: string;
};

/**
 * 勝ち抜き戦（KOTH）の現在の状態を計算する
 *
 * ルール:
 * - 初戦: Aの1番手（index 0） vs Bの1番手（index 0）
 * - 勝者続投、敗者は次の順番（index+1）を出す
 * - いずれかの敗戦数が `slotsCount` に到達したら相手チームの勝ち
 *
 * @param slotsCount 各チームの出場枠数（敗戦数の上限）
 * @param teamAId チームAのID
 * @param teamBId チームBのID
 * @param matches 既存の試合結果（slot_indexの昇順で並んでいることを想定）
 * @returns KOTHの現在状態
 */
export function computeKothState(
	slotsCount: number,
	teamAId: string,
	teamBId: string,
	matches: { winner_side: 'a' | 'b'; slot_index?: number | null }[],
): KothState {
	// 初期状態: 両チームとも1番手（index 0）から開始
	let aCurrentIndex = 0;
	let bCurrentIndex = 0;
	let aLosses = 0;
	let bLosses = 0;

	// 各試合を順番に処理して状態を更新
	for (const match of matches) {
		if (match.winner_side === 'a') {
			// チームAが勝った → チームBが負けた
			bLosses++;
			// チームBは次の順番を出す
			bCurrentIndex++;
			// チームAは続投（indexは変わらない）
		} else if (match.winner_side === 'b') {
			// チームBが勝った → チームAが負けた
			aLosses++;
			// チームAは次の順番を出す
			aCurrentIndex++;
			// チームBは続投（indexは変わらない）
		}

		// どちらかが敗戦数の上限に達したら終了
		if (aLosses >= slotsCount || bLosses >= slotsCount) {
			break;
		}
	}

	const finished = aLosses >= slotsCount || bLosses >= slotsCount;
	const winnerTeamId = finished
		? aLosses >= slotsCount
			? teamBId // チームAが敗戦数上限に達した → チームBの勝ち
			: teamAId // チームBが敗戦数上限に達した → チームAの勝ち
		: undefined;

	// 次の試合番号は既存の試合数
	const nextMatchIndex = matches.length;

	return {
		nextMatchIndex,
		aCurrentIndex,
		bCurrentIndex,
		aLosses,
		bLosses,
		finished,
		winnerTeamId,
	};
}

