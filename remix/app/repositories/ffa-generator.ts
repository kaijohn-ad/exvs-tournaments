import type { TournamentParticipantRecord } from './tournament-participants';
import type { FfaGroupData } from './ffa-groups';

type Rng = () => number;

interface GenerateFfa2UpParams {
	tournamentId: string;
	players: TournamentParticipantRecord[];
	seedingMode?: 'random' | 'manual';
	rng?: Rng;
}

interface PlayerWithSeed {
	playerId: string;
	seed: number | null;
}

const shuffle = <T>(items: T[], rng: Rng): T[] => {
	const array = items.slice();

	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}

	return array;
};

const toValidSeed = (seed: unknown): number | null => {
	const parsed = Number(seed);

	if (!Number.isFinite(parsed) || parsed < 1) {
		return null;
	}

	return Math.trunc(parsed);
};

/**
 * 4人1グループから上位2名が次ラウンドへ進出するFFA 2-up形式のブラケットを生成
 * 
 * 勝者割当規則（交差配置）:
 * - 奇数グループ(2k-1): 1位→次グループslot1, 2位→slot3
 * - 偶数グループ(2k):   1位→次グループslot2, 2位→slot4
 */
export const generateFfa2UpBracketGroups = (
	params: GenerateFfa2UpParams
): FfaGroupData[] => {
	const { players, seedingMode = 'random', rng = Math.random } = params;

	// バリデーション: 参加者数は4の倍数である必要がある
	if (players.length === 0) {
		return [];
	}

	if (players.length % 4 !== 0) {
		throw new Error(
			`FFA 2-up形式では参加者数が4の倍数である必要があります。現在の参加者数: ${players.length}`
		);
	}

	// プレイヤーをシード付きで準備
	let playersWithSeed: PlayerWithSeed[];

	if (seedingMode === 'manual') {
		// 手動シード: シード順にソート
		playersWithSeed = players
			.slice()
			.sort((a, b) => {
				const seedA = toValidSeed(a.seed) ?? Number.MAX_SAFE_INTEGER;
				const seedB = toValidSeed(b.seed) ?? Number.MAX_SAFE_INTEGER;

				if (seedA !== seedB) {
					return seedA - seedB;
				}

				const playerIdA = a.player_id ?? '';
				const playerIdB = b.player_id ?? '';
				return playerIdA.localeCompare(playerIdB);
			})
			.map((p) => ({
				playerId: p.player_id!,
				seed: toValidSeed(p.seed)
			}));
	} else {
		// ランダムシード
		playersWithSeed = shuffle(players, rng).map((p) => ({
			playerId: p.player_id!,
			seed: toValidSeed(p.seed)
		}));
	}

	const groups: FfaGroupData[] = [];
	const totalGroups = playersWithSeed.length / 4;

	// ラウンド1: 4人ずつ順にグループを作成
	for (let groupIndex = 0; groupIndex < totalGroups; groupIndex += 1) {
		const startIndex = groupIndex * 4;
		const group: FfaGroupData = {
			round: 1,
			position: groupIndex + 1,
			participant_1_type: 'player',
			participant_1_player_id: playersWithSeed[startIndex]?.playerId ?? null,
			participant_2_type: 'player',
			participant_2_player_id: playersWithSeed[startIndex + 1]?.playerId ?? null,
			participant_3_type: 'player',
			participant_3_player_id: playersWithSeed[startIndex + 2]?.playerId ?? null,
			participant_4_type: 'player',
			participant_4_player_id: playersWithSeed[startIndex + 3]?.playerId ?? null,
			status: 'pending',
			winner1_player_id: null,
			winner2_player_id: null
		};

		groups.push(group);
	}

	// ラウンド2以降: 前ラウンドの各2グループから勝者を組み合わせ
	let currentRound = 1;
	let currentRoundGroups = totalGroups;

	while (currentRoundGroups > 1) {
		const nextRound = currentRound + 1;
		const nextRoundGroups = Math.floor(currentRoundGroups / 2);

		for (let groupIndex = 0; groupIndex < nextRoundGroups; groupIndex += 1) {
			const oddGroupPosition = groupIndex * 2 + 1;
			const evenGroupPosition = groupIndex * 2 + 2;

			// 前ラウンドの2グループから勝者を取得
			const oddGroup = groups.find(
				(g) => g.round === currentRound && g.position === oddGroupPosition
			);
			const evenGroup = groups.find(
				(g) => g.round === currentRound && g.position === evenGroupPosition
			);

			// 勝者割当規則（交差配置）
			// 奇数グループ(2k-1): 1位→次グループslot1, 2位→slot3
			// 偶数グループ(2k):   1位→次グループslot2, 2位→slot4
			const group: FfaGroupData = {
				round: nextRound,
				position: groupIndex + 1,
				participant_1_type: oddGroup?.winner1_player_id ? 'player' : 'empty',
				participant_1_player_id: oddGroup?.winner1_player_id ?? null,
				participant_2_type: evenGroup?.winner1_player_id ? 'player' : 'empty',
				participant_2_player_id: evenGroup?.winner1_player_id ?? null,
				participant_3_type: oddGroup?.winner2_player_id ? 'player' : 'empty',
				participant_3_player_id: oddGroup?.winner2_player_id ?? null,
				participant_4_type: evenGroup?.winner2_player_id ? 'player' : 'empty',
				participant_4_player_id: evenGroup?.winner2_player_id ?? null,
				status: 'pending',
				winner1_player_id: null,
				winner2_player_id: null
			};

			groups.push(group);
		}

		currentRound = nextRound;
		currentRoundGroups = nextRoundGroups;
	}

	return groups;
};

export const generateAndStoreFfa2UpBracket = (
	params: GenerateFfa2UpParams & {
		setGroups: (tournamentId: string, groups: FfaGroupData[]) => Promise<unknown> | unknown;
	}
) => {
	const groups = generateFfa2UpBracketGroups(params);
	return params.setGroups(params.tournamentId, groups);
};

