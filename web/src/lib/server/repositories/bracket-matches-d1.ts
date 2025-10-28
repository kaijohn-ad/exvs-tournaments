import type {
	BracketMatchImportData,
	BracketMatchRecord
} from './bracket-matches';

const sanitizeRound = (value: number | undefined): number => {
	if (!Number.isFinite(value ?? NaN)) {
		return 1;
	}

	const parsed = Math.trunc(value as number);
	return Math.max(1, parsed);
};

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

			return (result.results || []).map(
				(row): BracketMatchRecord => ({
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
				})
			);
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
