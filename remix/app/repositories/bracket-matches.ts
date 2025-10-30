import { generateUUID } from "~/utils/uuid";

export interface BracketMatchData {
	round: number;
	position: number;
	participant_a_type: 'pair' | 'bye';
	participant_a_pair_id?: string | null;
	participant_b_type: 'pair' | 'bye';
	participant_b_pair_id?: string | null;
	score_a?: number | null;
	score_b?: number | null;
	winner_side?: 'a' | 'b' | null;
	status?: string;
}

export interface BracketMatchImportData extends BracketMatchData {
	id?: string;
	created_at?: string;
}

export interface BracketMatchRecord extends BracketMatchData {
	id: string;
	tournament_id: string;
	participant_a_pair_id: string | null;
	participant_b_pair_id: string | null;
	score_a: number | null;
	score_b: number | null;
	winner_side: 'a' | 'b' | null;
	status: string;
	created_at: string;
}

export interface BracketMatchUpdateData {
	round?: number;
	position?: number;
	participant_a_type?: 'pair' | 'bye';
	participant_a_pair_id?: string | null;
	participant_b_type?: 'pair' | 'bye';
	participant_b_pair_id?: string | null;
	score_a?: number | null;
	score_b?: number | null;
	winner_side?: 'a' | 'b' | null;
	status?: string;
}

const store = new Map<string, Map<string, BracketMatchRecord>>();

const getTournamentStore = (tournamentId: string) => {
	let tournamentStore = store.get(tournamentId);

	if (!tournamentStore) {
		tournamentStore = new Map();
		store.set(tournamentId, tournamentStore);
	}

	return tournamentStore;
};

const normalizeParticipantPairId = (type: 'pair' | 'bye', pairId?: string | null) => {
	if (type === 'bye') {
		return null;
	}

	return pairId?.trim() ?? null;
};

const buildRecord = (
	tournamentId: string,
	id: string,
	data: BracketMatchData,
	createdAt: string
): BracketMatchRecord => {
	const round = Math.max(1, Math.trunc(data.round));
	const position = Math.max(1, Math.trunc(data.position));

	return {
		id,
		tournament_id: tournamentId,
		round,
		position,
		participant_a_type: data.participant_a_type,
		participant_a_pair_id: normalizeParticipantPairId(
			data.participant_a_type,
			data.participant_a_pair_id
		),
		participant_b_type: data.participant_b_type,
		participant_b_pair_id: normalizeParticipantPairId(
			data.participant_b_type,
			data.participant_b_pair_id
		),
		score_a: data.score_a ?? null,
		score_b: data.score_b ?? null,
		winner_side: data.winner_side ?? null,
		status: data.status ?? 'pending',
		created_at: createdAt
	};
};

const sortMatches = (matches: BracketMatchRecord[]) => {
	return matches.slice().sort((a, b) => {
		if (a.round !== b.round) {
			return a.round - b.round;
		}

		return a.position - b.position;
	});
};

export const listBracketMatches = (tournamentId: string): BracketMatchRecord[] => {
	const tournamentStore = getTournamentStore(tournamentId);
	return sortMatches(Array.from(tournamentStore.values()));
};

export const ensureBracketMatch = (
	tournamentId: string,
	matchId: string
): BracketMatchRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const record = tournamentStore.get(matchId);

	if (!record) {
		throw new Error('Bracket match not found');
	}

	return record;
};

export const createBracketMatch = (
	tournamentId: string,
	data: BracketMatchData
): BracketMatchRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const id = generateUUID();
	const createdAt = new Date().toISOString();

	const record = buildRecord(tournamentId, id, data, createdAt);
	tournamentStore.set(id, record);

	return record;
};

const sanitizeUpdateRoundOrPosition = (
	value: number | undefined,
	fallback: number
) => {
	if (value === undefined) {
		return fallback;
	}

	if (!Number.isFinite(value)) {
		return fallback;
	}

	const parsed = Math.trunc(value);
	return Math.max(1, parsed);
};

const hasKey = <T extends object>(object: T, key: keyof any): boolean => {
	return Object.prototype.hasOwnProperty.call(object, key);
};

export const updateBracketMatch = (
	tournamentId: string,
	matchId: string,
	data: BracketMatchUpdateData
): BracketMatchRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const existing = tournamentStore.get(matchId);

	if (!existing) {
		throw new Error('Bracket match not found');
	}

	const round = sanitizeUpdateRoundOrPosition(data.round, existing.round);
	const position = sanitizeUpdateRoundOrPosition(data.position, existing.position);
	const participantAType = data.participant_a_type ?? existing.participant_a_type;
	const participantAPairIdRaw = hasKey(data, 'participant_a_pair_id')
		? data.participant_a_pair_id ?? null
		: existing.participant_a_pair_id;
	const participantAPairId = normalizeParticipantPairId(participantAType, participantAPairIdRaw);

	const participantBType = data.participant_b_type ?? existing.participant_b_type;
	const participantBPairIdRaw = hasKey(data, 'participant_b_pair_id')
		? data.participant_b_pair_id ?? null
		: existing.participant_b_pair_id;
	const participantBPairId = normalizeParticipantPairId(participantBType, participantBPairIdRaw);

	const scoreA =
		hasKey(data, 'score_a') && data.score_a !== undefined ? data.score_a ?? null : existing.score_a;
	const scoreB =
		hasKey(data, 'score_b') && data.score_b !== undefined ? data.score_b ?? null : existing.score_b;
	const winnerSide =
		hasKey(data, 'winner_side') && data.winner_side !== undefined
			? data.winner_side ?? null
			: existing.winner_side;
	const status =
		data.status !== undefined ? data.status ?? existing.status : existing.status ?? 'pending';

	const updated: BracketMatchRecord = {
		...existing,
		round,
		position,
		participant_a_type: participantAType,
		participant_a_pair_id: participantAPairId,
		participant_b_type: participantBType,
		participant_b_pair_id: participantBPairId,
		score_a: scoreA,
		score_b: scoreB,
		winner_side: winnerSide,
		status
	};

	tournamentStore.set(matchId, updated);
	return updated;
};

export const setBracketMatches = (
	tournamentId: string,
	matches: BracketMatchImportData[]
): BracketMatchRecord[] => {
	const tournamentStore = getTournamentStore(tournamentId);
	tournamentStore.clear();

	const createdAtDefault = new Date().toISOString();

	for (const match of matches) {
		if (!match.round || !match.position) {
			continue;
		}

		const id = match.id?.trim() || generateUUID();
		const createdAt = match.created_at ?? createdAtDefault;
		const record = buildRecord(tournamentId, id, match, createdAt);

		tournamentStore.set(id, record);
	}

	return listBracketMatches(tournamentId);
};

export const deleteBracketMatches = (tournamentId: string): void => {
	const tournamentStore = store.get(tournamentId);

	if (tournamentStore) {
		tournamentStore.clear();
		store.delete(tournamentId);
	}
};

export const __resetForTests = () => {
	store.clear();
};
