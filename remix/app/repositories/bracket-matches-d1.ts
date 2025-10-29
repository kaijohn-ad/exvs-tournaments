import type {
	BracketMatchImportData,
	BracketMatchRecord,
	BracketMatchUpdateData
} from './bracket-matches';

const sanitizeRound = (value: number | undefined): number => {
	if (!Number.isFinite(value ?? NaN)) {
		return 1;
	}

	const parsed = Math.trunc(value as number);
	return Math.max(1, parsed);
};

const sanitizeWithFallback = (value: number | undefined, fallback: number): number => {
	if (value === undefined) {
		return fallback;
	}

	return sanitizeRound(value);
};

const normalizeParticipantPairId = (type: 'pair' | 'bye', pairId?: string | null) => {
	if (type === 'bye') {
		return null;
	}

	return pairId?.trim() ?? null;
};

const hasKey = <T extends object>(object: T, key: keyof any): boolean => {
	return Object.prototype.hasOwnProperty.call(object, key);
};

const mapRowToRecord = (row: any): BracketMatchRecord => ({
	id: row.id,
	tournament_id: row.tournament_id,
	round: row.round,
	position: row.position,
	participant_a_type: row.participant_a_type,
	participant_a_pair_id: row.participant_a_pair_id ?? null,
	participant_b_type: row.participant_b_type,
	participant_b_pair_id: row.participant_b_pair_id ?? null,
	score_a: row.score_a ?? null,
	score_b: row.score_b ?? null,
	winner_side: row.winner_side ?? null,
	status: row.status,
	created_at: row.created_at
});

export const createBracketMatchesRepositoryD1 = (db: D1Database) => {
	return {
		async listBracketMatches(tournamentId: string): Promise<BracketMatchRecord[]> {
			const result = await db
				.prepare(
					`SELECT id, tournament_id, round, position, participant_a_type, participant_a_pair_id,
						participant_b_type, participant_b_pair_id, score_a, score_b, winner_side, status, created_at
					FROM bracket_matches
					WHERE tournament_id = ?
					ORDER BY round ASC, position ASC`
				)
				.bind(tournamentId)
				.all<any>();

			return (result.results || []).map((row) => mapRowToRecord(row));
		},

		async ensureBracketMatch(
			tournamentId: string,
			matchId: string
		): Promise<BracketMatchRecord> {
			const row = await db
				.prepare(
					`SELECT id, tournament_id, round, position, participant_a_type, participant_a_pair_id,
						participant_b_type, participant_b_pair_id, score_a, score_b, winner_side, status, created_at
					FROM bracket_matches
					WHERE tournament_id = ? AND id = ?`
				)
				.bind(tournamentId, matchId)
				.first<any>();

			if (!row) {
				throw new Error('Bracket match not found');
			}

			return mapRowToRecord(row);
		},

		async updateBracketMatch(
			tournamentId: string,
			matchId: string,
			data: BracketMatchUpdateData
		): Promise<BracketMatchRecord> {
			const existing = await this.ensureBracketMatch(tournamentId, matchId);

			const round = sanitizeWithFallback(data.round, existing.round);
			const position = sanitizeWithFallback(data.position, existing.position);

			const participantAType = data.participant_a_type ?? existing.participant_a_type;
			const participantAPairIdRaw = hasKey(data, 'participant_a_pair_id')
				? data.participant_a_pair_id ?? null
				: existing.participant_a_pair_id;
			const participantAPairId = normalizeParticipantPairId(
				participantAType,
				participantAPairIdRaw
			);

			const participantBType = data.participant_b_type ?? existing.participant_b_type;
			const participantBPairIdRaw = hasKey(data, 'participant_b_pair_id')
				? data.participant_b_pair_id ?? null
				: existing.participant_b_pair_id;
			const participantBPairId = normalizeParticipantPairId(
				participantBType,
				participantBPairIdRaw
			);

			const scoreA = hasKey(data, 'score_a') ? data.score_a ?? null : existing.score_a;
			const scoreB = hasKey(data, 'score_b') ? data.score_b ?? null : existing.score_b;
			const winnerSide = hasKey(data, 'winner_side')
				? data.winner_side ?? null
				: existing.winner_side;
			const status = data.status ?? existing.status ?? 'pending';

			await db
				.prepare(
					`UPDATE bracket_matches
					SET round = ?, position = ?, participant_a_type = ?, participant_a_pair_id = ?,
						participant_b_type = ?, participant_b_pair_id = ?, score_a = ?, score_b = ?,
						winner_side = ?, status = ?
					WHERE tournament_id = ? AND id = ?`
				)
				.bind(
					round,
					position,
					participantAType,
					participantAPairId,
					participantBType,
					participantBPairId,
					scoreA,
					scoreB,
					winnerSide,
					status,
					tournamentId,
					matchId
				)
				.run();

			return {
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
		},

		async setBracketMatches(
			tournamentId: string,
			matches: BracketMatchImportData[]
		): Promise<BracketMatchRecord[]> {
			await db
				.prepare('DELETE FROM bracket_matches WHERE tournament_id = ?')
				.bind(tournamentId)
				.run();

			const createdAtDefault = new Date().toISOString();
			const inserted: BracketMatchRecord[] = [];

			for (const match of matches) {
				const round = sanitizeRound(match.round);
				const position = sanitizeRound(match.position);
				const id = match.id ?? crypto.randomUUID();
				const createdAt = match.created_at ?? createdAtDefault;
				const status = match.status ?? 'pending';
				const scoreA = match.score_a ?? null;
				const scoreB = match.score_b ?? null;
				const winnerSide = match.winner_side ?? null;

				await db
					.prepare(
						`INSERT INTO bracket_matches
						(id, tournament_id, round, position, participant_a_type, participant_a_pair_id,
							participant_b_type, participant_b_pair_id, score_a, score_b, winner_side, status, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						tournamentId,
						round,
						position,
						match.participant_a_type,
						match.participant_a_pair_id ?? null,
						match.participant_b_type,
						match.participant_b_pair_id ?? null,
						scoreA,
						scoreB,
						winnerSide,
						status,
						createdAt
					)
					.run();

				inserted.push({
					id,
					tournament_id: tournamentId,
					round,
					position,
					participant_a_type: match.participant_a_type,
					participant_a_pair_id: match.participant_a_pair_id ?? null,
					participant_b_type: match.participant_b_type,
					participant_b_pair_id: match.participant_b_pair_id ?? null,
					score_a: scoreA,
					score_b: scoreB,
					winner_side: winnerSide,
					status,
					created_at: createdAt
				});
			}

			return inserted;
		},

		async deleteBracketMatches(tournamentId: string): Promise<void> {
			await db.prepare('DELETE FROM bracket_matches WHERE tournament_id = ?').bind(tournamentId).run();
		}
	};
};

export type BracketMatchesRepositoryD1 = ReturnType<typeof createBracketMatchesRepositoryD1>;
