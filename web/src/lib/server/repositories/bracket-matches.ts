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

export const createBracketMatch = (
	tournamentId: string,
	data: BracketMatchData
): BracketMatchRecord => {
	const tournamentStore = getTournamentStore(tournamentId);
	const id = crypto.randomUUID();
	const createdAt = new Date().toISOString();

	const record = buildRecord(tournamentId, id, data, createdAt);
	tournamentStore.set(id, record);

	return record;
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

		const id = match.id?.trim() || crypto.randomUUID();
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
