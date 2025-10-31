import type { PairRecord } from "~/repositories/pairs";

/**
 * 重複プレイヤーを含まない、seed優先のペアを選択する
 * 
 * @param sortedPairs seed昇順（nullは末尾）でソート済みのペア配列
 * @param usedPlayerIds 既に使用されているプレイヤーIDのSet
 * @param existingPairIds 既に追加済みのペアIDのSet
 * @returns 追加可能なペアの配列（seed昇順）
 */
export function chooseDisjointPairs(
	sortedPairs: PairRecord[],
	usedPlayerIds: Set<string>,
	existingPairIds: Set<string>
): PairRecord[] {
	const result: PairRecord[] = [];
	const currentUsed = new Set(usedPlayerIds);

	for (const pair of sortedPairs) {
		// 既に追加済みのペアはスキップ
		if (existingPairIds.has(pair.id)) {
			continue;
		}

		// プレイヤーが既に使用されている場合はスキップ
		if (currentUsed.has(pair.player1_id) || currentUsed.has(pair.player2_id)) {
			continue;
		}

		// 追加可能なペアとして追加し、プレイヤーIDを記録
		result.push(pair);
		currentUsed.add(pair.player1_id);
		currentUsed.add(pair.player2_id);
	}

	return result;
}

