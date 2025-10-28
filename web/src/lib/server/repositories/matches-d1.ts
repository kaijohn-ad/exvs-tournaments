import type { MatchData, MatchImportData, MatchRecord } from './matches';

export const createMatchesRepositoryD1 = (db: D1Database) => {
	return {
	async listMatches(contextType?: string, contextId?: string): Promise<MatchRecord[]> {
		let query = 'SELECT * FROM matches';
		const bindings: string[] = [];

		if (contextType && contextId) {
			query += ' WHERE context = ? AND context_id = ?';
			bindings.push(contextType, contextId);
		} else if (contextType) {
			query += ' WHERE context = ?';
			bindings.push(contextType);
		}

		if (contextType === 'teamBattle') {
			query += ' ORDER BY CASE WHEN slot_index IS NULL THEN 1 ELSE 0 END, slot_index ASC, played_at ASC';
		} else {
			query += ' ORDER BY played_at DESC';
		}

		const stmt = db.prepare(query);
		const result = await (bindings.length > 0 ? stmt.bind(...bindings) : stmt).all<any>();

		return (result.results || []).map((row) => ({
			...row,
			slot_index: row.slot_index ?? null
		})) as MatchRecord[];
	},

	async createMatch(data: MatchData): Promise<MatchRecord> {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const status = data.status ?? 'completed';
		const played_at = data.played_at ?? now;
		const slot_index = data.slot_index ?? null;

			await db
				.prepare(
					`INSERT INTO matches 
				(id, context, context_id, slot_index, side_a_type, side_a_pair_id, side_a_player1_id, side_a_player2_id,
					side_b_type, side_b_pair_id, side_b_player1_id, side_b_player2_id,
					score_a, score_b, winner_side, status, played_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
			.bind(
				id,
				data.context,
				data.context_id,
				slot_index,
				data.side_a_type,
					data.side_a_pair_id ?? null,
					data.side_a_player1_id ?? null,
					data.side_a_player2_id ?? null,
					data.side_b_type,
					data.side_b_pair_id ?? null,
					data.side_b_player1_id ?? null,
					data.side_b_player2_id ?? null,
					data.score_a,
					data.score_b,
					data.winner_side,
					status,
					played_at
				)
				.run();

		return {
			id,
			context: data.context,
			context_id: data.context_id,
			slot_index,
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
			status,
			played_at
		};
		},

		async ensureMatch(matchId: string): Promise<MatchRecord> {
		const result = await db
			.prepare('SELECT * FROM matches WHERE id = ?')
			.bind(matchId)
			.first<any>();

			if (!result) {
				throw new Error('Match not found');
			}

		return {
			...result,
			slot_index: result.slot_index ?? null
		} as MatchRecord;
		},

	async updateMatch(matchId: string, data: MatchData): Promise<MatchRecord> {
		const existing = await this.ensureMatch(matchId);

		const status = data.status ?? existing.status;
		const played_at = data.played_at ?? existing.played_at;
		const slot_index = data.slot_index ?? existing.slot_index ?? null;

			await db
				.prepare(
					`UPDATE matches 
				SET context = ?, context_id = ?, slot_index = ?, side_a_type = ?, side_a_pair_id = ?, 
					side_a_player1_id = ?, side_a_player2_id = ?, side_b_type = ?, 
					side_b_pair_id = ?, side_b_player1_id = ?, side_b_player2_id = ?,
					score_a = ?, score_b = ?, winner_side = ?, status = ?, played_at = ?
					WHERE id = ?`
				)
			.bind(
				data.context,
				data.context_id,
				slot_index,
				data.side_a_type,
					data.side_a_pair_id ?? null,
					data.side_a_player1_id ?? null,
					data.side_a_player2_id ?? null,
					data.side_b_type,
					data.side_b_pair_id ?? null,
					data.side_b_player1_id ?? null,
					data.side_b_player2_id ?? null,
					data.score_a,
					data.score_b,
					data.winner_side,
					status,
					played_at,
					matchId
				)
				.run();

		return {
			id: matchId,
			context: data.context,
			context_id: data.context_id,
			slot_index,
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
			status,
			played_at
		};
		},

		async deleteMatch(matchId: string): Promise<void> {
			await this.ensureMatch(matchId);
			await db.prepare('DELETE FROM matches WHERE id = ?').bind(matchId).run();
		},

	async setMatches(matches: MatchImportData[]): Promise<MatchRecord[]> {
		await db.prepare('DELETE FROM matches').run();

			const results: MatchRecord[] = [];
			const now = new Date().toISOString();

			for (const match of matches) {
				if (!match.context || !match.context_id) {
					continue;
				}

			const id = match.id ?? crypto.randomUUID();
			const status = match.status ?? 'completed';
			const played_at = match.played_at ?? now;
			const slot_index = match.slot_index ?? null;

				await db
					.prepare(
						`INSERT INTO matches 
					(id, context, context_id, slot_index, side_a_type, side_a_pair_id, side_a_player1_id, side_a_player2_id,
						side_b_type, side_b_pair_id, side_b_player1_id, side_b_player2_id,
						score_a, score_b, winner_side, status, played_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
				.bind(
					id,
					match.context,
					match.context_id,
					slot_index,
					match.side_a_type,
						match.side_a_pair_id ?? null,
						match.side_a_player1_id ?? null,
						match.side_a_player2_id ?? null,
						match.side_b_type,
						match.side_b_pair_id ?? null,
						match.side_b_player1_id ?? null,
						match.side_b_player2_id ?? null,
						match.score_a,
						match.score_b,
						match.winner_side,
						status,
						played_at
					)
					.run();

		results.push({
			id,
			context: match.context,
			context_id: match.context_id,
			slot_index,
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
			status,
			played_at
		});
			}

			return results;
		}
	};
};
