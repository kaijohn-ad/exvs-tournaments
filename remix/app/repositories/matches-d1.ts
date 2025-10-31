import { generateUUID } from "~/utils/uuid";
import type { MatchData, MatchImportData, MatchRecord } from './matches';

const validatePairForMatch = async (
	db: D1Database,
	context: string,
	contextId: string,
	pairId: string | null | undefined
): Promise<void> => {
	if (!pairId) {
		return;
	}

	// Check that pair exists and is not deleted
	const pair = await db
		.prepare('SELECT event_id FROM pairs WHERE id = ? AND deleted_at IS NULL')
		.bind(pairId)
		.first<{ event_id: string }>();

	if (!pair) {
		throw new Error('ペアが見つかりません。');
	}

	if (context === 'bracket') {
		// For bracket matches, pair must be registered as an active participant
		const tournament = await db
			.prepare('SELECT id FROM tournaments WHERE id = ?')
			.bind(contextId)
			.first<{ id: string }>();

		if (!tournament) {
			throw new Error('トーナメントが見つかりません。');
		}

		const participant = await db
			.prepare(
				'SELECT id FROM tournament_participants WHERE tournament_id = ? AND pair_id = ? AND status = \'active\''
			)
			.bind(contextId, pairId)
			.first<{ id: string }>();

		if (!participant) {
			throw new Error('このペアはトーナメントの参加者として登録されていません。');
		}
	} else if (context === 'teamBattle') {
		// For team battle matches, pair must belong to the same event
		const teamBattle = await db
			.prepare('SELECT event_id FROM team_battles WHERE id = ?')
			.bind(contextId)
			.first<{ event_id: string }>();

		if (!teamBattle) {
			throw new Error('チームバトルが見つかりません。');
		}

		if (pair.event_id !== teamBattle.event_id) {
			throw new Error('ペアは同じイベントに属している必要があります。');
		}
	}
};

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
		// Validate pair participants
		if (data.side_a_type === 'pair') {
			await validatePairForMatch(db, data.context, data.context_id, data.side_a_pair_id);
		}
		if (data.side_b_type === 'pair') {
			await validatePairForMatch(db, data.context, data.context_id, data.side_b_pair_id);
		}

		const id = generateUUID();
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

		// Validate pair participants
		const sideAType = data.side_a_type ?? existing.side_a_type;
		const sideAPairId = sideAType === 'pair' ? (data.side_a_pair_id ?? existing.side_a_pair_id) : null;
		const sideBType = data.side_b_type ?? existing.side_b_type;
		const sideBPairId = sideBType === 'pair' ? (data.side_b_pair_id ?? existing.side_b_pair_id) : null;

		if (sideAType === 'pair' && sideAPairId) {
			await validatePairForMatch(db, data.context ?? existing.context, data.context_id ?? existing.context_id, sideAPairId);
		}
		if (sideBType === 'pair' && sideBPairId) {
			await validatePairForMatch(db, data.context ?? existing.context, data.context_id ?? existing.context_id, sideBPairId);
		}

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

				// Validate pair participants
				if (match.side_a_type === 'pair') {
					await validatePairForMatch(db, match.context, match.context_id, match.side_a_pair_id);
				}
				if (match.side_b_type === 'pair') {
					await validatePairForMatch(db, match.context, match.context_id, match.side_b_pair_id);
				}

			const id = match.id ?? generateUUID();
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
