import type { PairRecord } from './pairs';
import type { TournamentParticipantRecord } from './tournament-participants';

type Rng = () => number;

interface PairPlayerIds {
	player1_id: string;
	player2_id: string;
}

/**
 * 2つのplayer_idのペアを正規化（小さい順に並べ替え）
 */
const normalizePairIds = (id1: string, id2: string): PairPlayerIds => {
	if (id1.localeCompare(id2) <= 0) {
		return { player1_id: id1, player2_id: id2 };
	}
	return { player1_id: id2, player2_id: id1 };
};

/**
 * 既存ペアが指定されたplayer_idセットに含まれるかチェック
 */
const isPairInPlayerSet = (
	pair: PairRecord,
	playerSet: Set<string>
): boolean => {
	return playerSet.has(pair.player1_id) && playerSet.has(pair.player2_id);
};

/**
 * 既存ペアから同じ組み合わせを検索
 */
const findExistingPair = (
	existingPairs: PairRecord[],
	player1_id: string,
	player2_id: string
): PairRecord | null => {
	const normalized = normalizePairIds(player1_id, player2_id);
	
	for (const pair of existingPairs) {
		const pairNormalized = normalizePairIds(pair.player1_id, pair.player2_id);
		if (
			pairNormalized.player1_id === normalized.player1_id &&
			pairNormalized.player2_id === normalized.player2_id
		) {
			return pair;
		}
	}
	
	return null;
};

/**
 * 配列をシャッフル
 */
const shuffle = <T>(items: T[], rng: Rng): T[] => {
	const array = items.slice();
	
	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	
	return array;
};

export interface SoloPairingContext {
	listParticipants: (tournamentId: string) => Promise<TournamentParticipantRecord[]>;
	listPairs: (eventId: string) => Promise<PairRecord[]>;
	createPair: (eventId: string, data: { player1_id: string; player2_id: string }) => Promise<PairRecord>;
}

/**
 * solo参加者を2人1組にペアリングする
 * 
 * @param eventId イベントID
 * @param tournamentId トーナメントID
 * @param context リポジトリコンテキスト
 * @param rng ランダム数生成器（オプション、デフォルトはMath.random）
 * @returns ペアリングされたPairRecord[]（既存ペア優先、不足分は新規作成）
 * @throws 参加者が2名未満、または奇数名の場合にエラー
 */
export const pairSoloParticipants = async (
	eventId: string,
	tournamentId: string,
	context: SoloPairingContext,
	rng: Rng = Math.random
): Promise<PairRecord[]> => {
	// solo参加者を取得
	const participants = await context.listParticipants(tournamentId);
	const soloParticipants = participants.filter(p => p.participant_type === 'solo' && p.player_id);
	
	if (soloParticipants.length < 2) {
		throw new Error('ブラケットを生成するには、少なくとも2名の個別参加者が参加登録されている必要があります。');
	}
	
	if (soloParticipants.length % 2 !== 0) {
		throw new Error('個別参加者の人数が奇数です。ブラケット生成には偶数名の参加が必要です。');
	}
	
	// solo参加者のplayer_idセットを作成
	const soloPlayerIds = new Set<string>(
		soloParticipants.map(p => p.player_id!).filter((id): id is string => Boolean(id))
	);
	
	// 既存ペアを取得
	const existingPairs = await context.listPairs(eventId);
	
	// 既存ペアから、両者がsolo参加者に含まれるペアを抽出
	const usablePairs: PairRecord[] = [];
	const usedPlayerIds = new Set<string>();
	
	for (const pair of existingPairs) {
		if (isPairInPlayerSet(pair, soloPlayerIds)) {
			usablePairs.push(pair);
			usedPlayerIds.add(pair.player1_id);
			usedPlayerIds.add(pair.player2_id);
		}
	}
	
	// まだペアになっていないsolo参加者を抽出
	const unpairedPlayerIds = Array.from(soloPlayerIds).filter(id => !usedPlayerIds.has(id));
	
	if (unpairedPlayerIds.length % 2 !== 0) {
		throw new Error('ペアリング処理中にエラーが発生しました。');
	}
	
	// 残りのsolo参加者をランダムにシャッフルして2人ずつペアリング
	const shuffled = shuffle(unpairedPlayerIds, rng);
	const resultPairs: PairRecord[] = [...usablePairs];
	
	for (let i = 0; i < shuffled.length; i += 2) {
		const player1_id = shuffled[i];
		const player2_id = shuffled[i + 1];
		
		// 既存ペアに同じ組み合わせがないかチェック
		const existingPair = findExistingPair(existingPairs, player1_id, player2_id);
		
		if (existingPair) {
			// 既存ペアを再利用
			resultPairs.push(existingPair);
		} else {
			// 新規ペアを作成
			const normalized = normalizePairIds(player1_id, player2_id);
			const newPair = await context.createPair(eventId, normalized);
			resultPairs.push(newPair);
		}
	}
	
	return resultPairs;
};

