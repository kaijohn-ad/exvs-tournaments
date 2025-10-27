export interface MatchData {
	context: 'bracket' | 'teamBattle' | 'tiebreak';
	context_id: string;
	side_a_type: 'pair' | 'adhoc';
	side_a_pair_id?: string;
	side_a_player1_id?: string;
	side_a_player2_id?: string;
	side_b_type: 'pair' | 'adhoc';
	side_b_pair_id?: string;
	side_b_player1_id?: string;
	side_b_player2_id?: string;
	score_a: number;
	score_b: number;
	winner_side: 'a' | 'b';
	status?: string;
	played_at?: string;
}

export interface MatchImportData extends MatchData {
	id?: string;
}

export interface MatchRecord extends MatchData {
	id: string;
	status: string;
	played_at: string;
}

const store = new Map<string, MatchRecord>();

export const listMatches = (contextType?: string, contextId?: string): MatchRecord[] => {
	const all = Array.from(store.values());
	
	if (contextType && contextId) {
		return all.filter(m => m.context === contextType && m.context_id === contextId);
	}
	
	if (contextType) {
		return all.filter(m => m.context === contextType);
	}
	
	return all;
};

export const createMatch = (data: MatchData): MatchRecord => {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	const record: MatchRecord = {
		id,
		context: data.context,
		context_id: data.context_id,
		side_a_type: data.side_a_type,
		side_a_pair_id: data.side_a_pair_id,
		side_a_player1_id: data.side_a_player1_id,
		side_a_player2_id: data.side_a_player2_id,
		side_b_type: data.side_b_type,
		side_b_pair_id: data.side_b_pair_id,
		side_b_player1_id: data.side_b_player1_id,
		side_b_player2_id: data.side_b_player2_id,
		score_a: data.score_a,
		score_b: data.score_b,
		winner_side: data.winner_side,
		status: data.status ?? 'completed',
		played_at: data.played_at ?? now
	};

	store.set(id, record);
	return record;
};

export const ensureMatch = (matchId: string): MatchRecord => {
	const record = store.get(matchId);

	if (!record) {
		throw new Error('Match not found');
	}

	return record;
};

export const updateMatch = (matchId: string, data: MatchData): MatchRecord => {
	const existing = ensureMatch(matchId);

	const updated: MatchRecord = {
		...existing,
		context: data.context,
		context_id: data.context_id,
		side_a_type: data.side_a_type,
		side_a_pair_id: data.side_a_pair_id,
		side_a_player1_id: data.side_a_player1_id,
		side_a_player2_id: data.side_a_player2_id,
		side_b_type: data.side_b_type,
		side_b_pair_id: data.side_b_pair_id,
		side_b_player1_id: data.side_b_player1_id,
		side_b_player2_id: data.side_b_player2_id,
		score_a: data.score_a,
		score_b: data.score_b,
		winner_side: data.winner_side,
		status: data.status ?? existing.status,
		played_at: data.played_at ?? existing.played_at
	};

	store.set(matchId, updated);
	return updated;
};

export const deleteMatch = (matchId: string): void => {
	ensureMatch(matchId);
	store.delete(matchId);
};

export const setMatches = (matches: MatchImportData[]): MatchRecord[] => {
	store.clear();

	const results: MatchRecord[] = [];
	const now = new Date().toISOString();

	for (const match of matches) {
		if (!match.context || !match.context_id) {
			continue;
		}

		const id = match.id ?? crypto.randomUUID();
		const record: MatchRecord = {
			id,
			context: match.context,
			context_id: match.context_id,
			side_a_type: match.side_a_type,
			side_a_pair_id: match.side_a_pair_id,
			side_a_player1_id: match.side_a_player1_id,
			side_a_player2_id: match.side_a_player2_id,
			side_b_type: match.side_b_type,
			side_b_pair_id: match.side_b_pair_id,
			side_b_player1_id: match.side_b_player1_id,
			side_b_player2_id: match.side_b_player2_id,
			score_a: match.score_a,
			score_b: match.score_b,
			winner_side: match.winner_side,
			status: match.status ?? 'completed',
			played_at: match.played_at ?? now
		};

		store.set(id, record);
		results.push(record);
	}

	return results;
};

export const __resetForTests = () => {
	store.clear();
};
