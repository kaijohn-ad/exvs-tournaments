import type { PairRecord } from './pairs';
import type { BracketMatchData } from './bracket-matches';

type ParticipantState =
	| { kind: 'pair'; pairId: string }
	| { kind: 'empty' }
	| { kind: 'tbd' };

type Rng = () => number;

interface GenerateBracketParams {
	tournamentId: string;
	pairs: PairRecord[];
	seedingMode?: 'random' | 'manual';
	rng?: Rng;
}

interface AdvancementResult {
	record: BracketMatchData;
	next: ParticipantState;
}

const nextPowerOfTwo = (value: number): number => {
	if (value <= 0) {
		return 0;
	}

	let power = 1;

	while (power < value) {
		power <<= 1;
	}

	return power;
};

const generateSeedOrder = (size: number): number[] => {
	if (size <= 1) {
		return [1];
	}

	const build = (n: number): number[] => {
		if (n === 1) {
			return [1];
		}

		const prev = build(n / 2);
		const result: number[] = [];

		for (const seed of prev) {
			result.push(seed);
			result.push(n + 1 - seed);
		}

		return result;
	};

	return build(size);
};

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

const assignManualSeedingSlots = (pairs: PairRecord[], size: number): (string | null)[] => {
	const slots: (string | null)[] = new Array(size).fill(null);
	const seedOrder = generateSeedOrder(size);
	const seedPositionMap = new Map<number, number>();

	seedOrder.forEach((seed, index) => {
		seedPositionMap.set(seed, index);
	});

	const sortedPairs = pairs
		.slice()
		.sort((a, b) => {
			const seedA = toValidSeed(a.seed) ?? Number.MAX_SAFE_INTEGER;
			const seedB = toValidSeed(b.seed) ?? Number.MAX_SAFE_INTEGER;

			if (seedA !== seedB) {
				return seedA - seedB;
			}

			return a.id.localeCompare(b.id);
		});

	const usedSeeds = new Set<number>();
	const unseededQueue: PairRecord[] = [];

	for (const pair of sortedPairs) {
		const seed = toValidSeed(pair.seed);

		if (seed && seed <= size) {
			const slotIndex = seedPositionMap.get(seed);

			if (slotIndex !== undefined && !slots[slotIndex]) {
				slots[slotIndex] = pair.id;
				usedSeeds.add(seed);
				continue;
			}
		}

		unseededQueue.push(pair);
	}

	const remainingSeeds: number[] = [];

	for (let seed = 1; seed <= size; seed += 1) {
		if (!usedSeeds.has(seed)) {
			remainingSeeds.push(seed);
		}
	}

	for (const pair of unseededQueue) {
		if (remainingSeeds.length === 0) {
			break;
		}

		const seed = remainingSeeds.shift();

		if (!seed) {
			break;
		}

		const slotIndex = seedPositionMap.get(seed);

		if (slotIndex !== undefined && !slots[slotIndex]) {
			slots[slotIndex] = pair.id;
		}
	}

	return slots;
};

const assignRandomSeedingSlots = (pairs: PairRecord[], size: number, rng: Rng): (string | null)[] => {
	const slots: (string | null)[] = new Array(size).fill(null);

	if (pairs.length === 0) {
		return slots;
	}

	const seedOrder = generateSeedOrder(size);
	const seedPositionMap = new Map<number, number>();
	seedOrder.forEach((seed, index) => {
		seedPositionMap.set(seed, index);
	});

	const shuffled = shuffle(pairs, rng);

	for (let i = 0; i < shuffled.length; i += 1) {
		const seedNumber = i + 1;
		const slotIndex = seedPositionMap.get(seedNumber);

		if (slotIndex === undefined) {
			continue;
		}

		slots[slotIndex] = shuffled[i].id;
	}

	return slots;
};

const stateFromSlot = (pairId: string | null): ParticipantState => {
	if (pairId) {
		return { kind: 'pair', pairId };
	}

	return { kind: 'empty' };
};

const mapStateToParticipant = (state: ParticipantState) => {
	if (state.kind === 'pair') {
		return {
			type: 'pair' as const,
			pairId: state.pairId
		};
	}

	if (state.kind === 'tbd') {
		return {
			type: 'pair' as const,
			pairId: null
		};
	}

	return {
		type: 'bye' as const,
		pairId: null
	};
};

const buildAdvancement = (
	round: number,
	position: number,
	sideA: ParticipantState,
	sideB: ParticipantState
): AdvancementResult => {
	const participantA = mapStateToParticipant(sideA);
	const participantB = mapStateToParticipant(sideB);

	let status: 'pending' | 'completed' = 'pending';
	let winner_side: 'a' | 'b' | null = null;
	let nextState: ParticipantState = { kind: 'tbd' };

	if (sideA.kind === 'pair' && sideB.kind === 'empty') {
		status = 'completed';
		winner_side = 'a';
		nextState = { kind: 'pair', pairId: sideA.pairId };
	} else if (sideA.kind === 'empty' && sideB.kind === 'pair') {
		status = 'completed';
		winner_side = 'b';
		nextState = { kind: 'pair', pairId: sideB.pairId };
	} else if (sideA.kind === 'empty' && sideB.kind === 'empty') {
		status = 'completed';
		nextState = { kind: 'empty' };
	}

	const record: BracketMatchData = {
		round,
		position,
		participant_a_type: participantA.type,
		participant_a_pair_id: participantA.pairId,
		participant_b_type: participantB.type,
		participant_b_pair_id: participantB.pairId,
		status,
		score_a: null,
		score_b: null,
		winner_side
	};

	return { record, next: nextState };
};

export const generateSingleEliminationBracketMatches = (
	params: GenerateBracketParams
): BracketMatchData[] => {
	const pairs = params.pairs ?? [];

	if (pairs.length === 0) {
		return [];
	}

	const rng: Rng = params.rng ?? Math.random;
	const seedingMode = params.seedingMode ?? 'random';
	const bracketSize = nextPowerOfTwo(pairs.length);

	if (bracketSize <= 0) {
		return [];
	}

	let slots: (string | null)[] = [];

	if (seedingMode === 'manual') {
		slots = assignManualSeedingSlots(pairs, bracketSize);
	} else {
		slots = assignRandomSeedingSlots(pairs, bracketSize, rng);
	}

	const totalRounds = Math.log2(bracketSize);
	const results: BracketMatchData[] = [];
	let participantsState = slots.map(stateFromSlot);

	for (let round = 1; round <= totalRounds; round += 1) {
		const matchesInRound = Math.floor(participantsState.length / 2);
		const nextState: ParticipantState[] = [];

		for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
			const sideA = participantsState[matchIndex * 2] ?? { kind: 'empty' };
			const sideB = participantsState[matchIndex * 2 + 1] ?? { kind: 'empty' };

			const { record, next } = buildAdvancement(round, matchIndex + 1, sideA, sideB);
			results.push(record);
			nextState.push(next);
		}

		participantsState = nextState;
	}

	return results;
};

export const generateAndStoreSingleEliminationBracket = (
	params: GenerateBracketParams & {
		setMatches: (tournamentId: string, matches: BracketMatchData[]) => Promise<unknown> | unknown;
	}
) => {
	const matches = generateSingleEliminationBracketMatches(params);
	return params.setMatches(params.tournamentId, matches);
};

interface GenerateDoubleEliminationBracketParams extends GenerateBracketParams {
	grandFinalsFormat?: 'single' | 'reset';
}

/**
 * ダブルエリミネーションブラケットを生成する
 * 
 * Winners bracket: シングルエリミと同じ構造
 * Losers bracket: Winnersの各ラウンドの敗者が落ちてくる
 * Grand Finals: Winners優勝者 vs Losers優勝者
 */
export const generateDoubleEliminationBracketMatches = (
	params: GenerateDoubleEliminationBracketParams
): BracketMatchData[] => {
	const pairs = params.pairs ?? [];

	if (pairs.length === 0) {
		return [];
	}

	const rng: Rng = params.rng ?? Math.random;
	const seedingMode = params.seedingMode ?? 'random';
	const grandFinalsFormat = params.grandFinalsFormat ?? 'single';
	const bracketSize = nextPowerOfTwo(pairs.length);

	if (bracketSize <= 0) {
		return [];
	}

	// Winners bracket用のスロットを生成
	let slots: (string | null)[] = [];
	if (seedingMode === 'manual') {
		slots = assignManualSeedingSlots(pairs, bracketSize);
	} else {
		slots = assignRandomSeedingSlots(pairs, bracketSize, rng);
	}

	const totalRounds = Math.log2(bracketSize);
	const results: BracketMatchData[] = [];

	// === Winners Bracket ===
	const winnersMatches: BracketMatchData[] = [];
	let participantsState = slots.map(stateFromSlot);

	for (let round = 1; round <= totalRounds; round += 1) {
		const matchesInRound = Math.floor(participantsState.length / 2);
		const nextState: ParticipantState[] = [];

		for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex += 1) {
			const sideA = participantsState[matchIndex * 2] ?? { kind: 'empty' };
			const sideB = participantsState[matchIndex * 2 + 1] ?? { kind: 'empty' };

			const { record, next } = buildAdvancement(round, matchIndex + 1, sideA, sideB);
			const winnersRecord: BracketMatchData = {
				...record,
				bracket: 'winners'
			};
			winnersMatches.push(winnersRecord);
			nextState.push(next);
		}

		participantsState = nextState;
	}

	results.push(...winnersMatches);

	// === Losers Bracket ===
	// Losers bracketの構造:
	// - Round 1: Winners Round 1の敗者同士が対戦（2試合ごとにグループ化）
	// - Round 2以降: 前ラウンドの勝者 vs Winners Round Nの敗者（交互に配置）
	
	const losersMatches: BracketMatchData[] = [];
	const losersRounds: ParticipantState[][] = [];

	// Losers Round 1: Winners Round 1の敗者をペアリング
	// Winners Round 1のマッチ数 = bracketSize / 2
	const winnersRound1Matches = winnersMatches.filter(m => m.round === 1);
	const losersRound1Slots: ParticipantState[] = [];
	
	// Winners Round 1の各マッチから敗者を抽出（TBDとして配置）
	for (let i = 0; i < winnersRound1Matches.length; i += 2) {
		// 2試合ごとにグループ化
		losersRound1Slots.push({ kind: 'tbd' }); // Match i の敗者
		losersRound1Slots.push({ kind: 'tbd' }); // Match i+1 の敗者
	}

	losersRounds.push(losersRound1Slots);

	// Losers Round 1のマッチを生成
	for (let matchIndex = 0; matchIndex < losersRound1Slots.length / 2; matchIndex += 1) {
		const sideA = losersRound1Slots[matchIndex * 2] ?? { kind: 'empty' };
		const sideB = losersRound1Slots[matchIndex * 2 + 1] ?? { kind: 'empty' };

		const { record } = buildAdvancement(1, matchIndex + 1, sideA, sideB);
		losersMatches.push({
			...record,
			bracket: 'losers'
		});
	}

	// Losers Round 2以降を生成
	// Losers Round 2: Losers Round 1の勝者 vs Winners Round 2の敗者
	// Losers Round N: 前ラウンドの勝者 vs Winners Round Nの敗者
	// Losers Roundの最大数は totalRounds（Winners Roundの最大数と同じ）
	// Losers Round 1の勝者数 = Losers Round 1の試合数 = losersRound1Slots.length / 2
	const losersRound1WinnerCount = losersRound1Slots.length / 2;
	let losersCurrentState: ParticipantState[] = Array.from({ length: losersRound1WinnerCount }, () => ({ kind: 'tbd' as const }));

	// Losers Round 2から totalRounds まで生成（4ペアなら2ラウンド、8ペアなら3ラウンド、16ペアなら4ラウンド）
	for (let losersRound = 2; losersRound <= totalRounds; losersRound += 1) {
		const winnersRoundForLosers = losersRound; // Losers Round N は Winners Round N の敗者と対戦
		const matchesInLosersRound = losersCurrentState.length;
		const nextLosersState: ParticipantState[] = [];

		for (let matchIndex = 0; matchIndex < matchesInLosersRound; matchIndex += 1) {
			const sideA: ParticipantState = losersCurrentState[matchIndex] ?? { kind: 'tbd' as const };
			const sideB: ParticipantState = { kind: 'tbd' as const }; // Winners Round Nの敗者

			const { record, next } = buildAdvancement(losersRound, matchIndex + 1, sideA, sideB);
			losersMatches.push({
				...record,
				bracket: 'losers'
			});
			nextLosersState.push(next);
		}

		losersCurrentState = nextLosersState;
		
		// 次のラウンドに進めない場合はループを抜ける
		if (losersCurrentState.length === 0) {
			break;
		}
	}

	results.push(...losersMatches);

	// === Grand Finals ===
	// Winners優勝者 vs Losers優勝者
	const grandFinalsMatch: BracketMatchData = {
		bracket: 'grand-finals',
		round: 1,
		position: 1,
		participant_a_type: 'pair',
		participant_a_pair_id: null, // Winners優勝者（TBD）
		participant_b_type: 'pair',
		participant_b_pair_id: null, // Losers優勝者（TBD）
		status: 'pending',
		score_a: null,
		score_b: null,
		winner_side: null
	};

	results.push(grandFinalsMatch);

	// Reset formatの場合、Grand Finals Round 2も生成
	if (grandFinalsFormat === 'reset') {
		const grandFinalsMatch2: BracketMatchData = {
			bracket: 'grand-finals',
			round: 2,
			position: 1,
			participant_a_type: 'pair',
			participant_a_pair_id: null,
			participant_b_type: 'pair',
			participant_b_pair_id: null,
			status: 'pending',
			score_a: null,
			score_b: null,
			winner_side: null
		};
		results.push(grandFinalsMatch2);
	}

	return results;
};

export const generateAndStoreDoubleEliminationBracket = (
	params: GenerateDoubleEliminationBracketParams & {
		setMatches: (tournamentId: string, matches: BracketMatchData[]) => Promise<unknown> | unknown;
	}
) => {
	const matches = generateDoubleEliminationBracketMatches(params);
	return params.setMatches(params.tournamentId, matches);
};
