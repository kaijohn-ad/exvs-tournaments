import { generateUUID } from "~/utils/uuid";
import type {
	TournamentParticipantRecord
} from './tournament-participants';

export const createTournamentParticipantsRepositoryD1 = (db: D1Database) => {
	const ensureParticipant = async (
		tournamentId: string,
		participantId: string
	): Promise<TournamentParticipantRecord> => {
		const result = await db
			.prepare(
				`SELECT id, tournament_id, participant_type, pair_id, player_id, seed, note, status, created_at
				 FROM tournament_participants
				 WHERE id = ? AND tournament_id = ? AND status = 'active'`
			)
			.bind(participantId, tournamentId)
			.first<any>();

		if (!result) {
			throw new Error('参加者が見つかりません。');
		}

		return {
			id: result.id,
			tournament_id: result.tournament_id,
			participant_type: result.participant_type as 'pair' | 'solo',
			pair_id: result.pair_id ?? null,
			player_id: result.player_id ?? null,
			seed: result.seed ?? null,
			note: result.note ?? null,
			status: result.status as 'active' | 'removed',
			created_at: result.created_at
		};
	};

	return {
		async listParticipants(tournamentId: string): Promise<TournamentParticipantRecord[]> {
			const result = await db
				.prepare(
					`SELECT id, tournament_id, participant_type, pair_id, player_id, seed, note, status, created_at
					 FROM tournament_participants
					 WHERE tournament_id = ? AND status = 'active'
					 ORDER BY (CASE WHEN seed IS NULL THEN 1 ELSE 0 END), seed ASC, created_at ASC`
				)
				.bind(tournamentId)
				.all<any>();

			return (result.results || []).map((row) => ({
				id: row.id,
				tournament_id: row.tournament_id,
				participant_type: row.participant_type as 'pair' | 'solo',
				pair_id: row.pair_id ?? null,
				player_id: row.player_id ?? null,
				seed: row.seed ?? null,
				note: row.note ?? null,
				status: row.status as 'active' | 'removed',
				created_at: row.created_at
			}));
		},

		async count(tournamentId: string): Promise<number> {
			const result = await db
				.prepare(
					'SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ? AND status = \'active\''
				)
				.bind(tournamentId)
				.first<{ count: number }>();

			return result?.count ?? 0;
		},

		async addPair(
			tournamentId: string,
			pairId: string,
			opts?: { seed?: number | null; note?: string | null }
		): Promise<TournamentParticipantRecord> {
			// Check for duplicate
			const existing = await db
				.prepare(
					'SELECT id FROM tournament_participants WHERE tournament_id = ? AND pair_id = ? AND status = \'active\''
				)
				.bind(tournamentId, pairId)
				.first();

			if (existing) {
				throw new Error('このペアは既に参加登録されています。');
			}

			// Validate that pair belongs to the same event as tournament
			const tournament = await db
				.prepare('SELECT event_id FROM tournaments WHERE id = ?')
				.bind(tournamentId)
				.first<{ event_id: string }>();

			if (!tournament) {
				throw new Error('トーナメントが見つかりません。');
			}

			const pair = await db
				.prepare('SELECT event_id FROM pairs WHERE id = ?')
				.bind(pairId)
				.first<{ event_id: string }>();

			if (!pair) {
				throw new Error('ペアが見つかりません。');
			}

			if (pair.event_id !== tournament.event_id) {
				throw new Error('ペアは同じイベントに属している必要があります。');
			}

			const id = generateUUID();
			const seed = opts?.seed ?? null;
			const note = opts?.note?.trim() ?? null;
			const createdAt = new Date().toISOString();

			await db
				.prepare(
					`INSERT INTO tournament_participants 
					 (id, tournament_id, participant_type, pair_id, player_id, seed, note, status, created_at)
					 VALUES (?, ?, 'pair', ?, NULL, ?, ?, 'active', ?)`
				)
				.bind(id, tournamentId, pairId, seed, note, createdAt)
				.run();

			return {
				id,
				tournament_id: tournamentId,
				participant_type: 'pair',
				pair_id: pairId,
				player_id: null,
				seed,
				note,
				status: 'active',
				created_at: createdAt
			};
		},

		async addSolo(
			tournamentId: string,
			playerId: string,
			opts?: { note?: string | null }
		): Promise<TournamentParticipantRecord> {
			// Check for duplicate
			const existing = await db
				.prepare(
					'SELECT id FROM tournament_participants WHERE tournament_id = ? AND player_id = ? AND status = \'active\''
				)
				.bind(tournamentId, playerId)
				.first();

			if (existing) {
				throw new Error('このプレイヤーは既に参加登録されています。');
			}

			// Validate that player belongs to the same event as tournament
			const tournament = await db
				.prepare('SELECT event_id FROM tournaments WHERE id = ?')
				.bind(tournamentId)
				.first<{ event_id: string }>();

			if (!tournament) {
				throw new Error('トーナメントが見つかりません。');
			}

			const player = await db
				.prepare('SELECT event_id FROM players WHERE id = ?')
				.bind(playerId)
				.first<{ event_id: string }>();

			if (!player) {
				throw new Error('プレイヤーが見つかりません。');
			}

			if (player.event_id !== tournament.event_id) {
				throw new Error('プレイヤーは同じイベントに属している必要があります。');
			}

			const id = generateUUID();
			const note = opts?.note?.trim() ?? null;
			const createdAt = new Date().toISOString();

			await db
				.prepare(
					`INSERT INTO tournament_participants 
					 (id, tournament_id, participant_type, pair_id, player_id, seed, note, status, created_at)
					 VALUES (?, ?, 'solo', NULL, ?, NULL, ?, 'active', ?)`
				)
				.bind(id, tournamentId, playerId, note, createdAt)
				.run();

			return {
				id,
				tournament_id: tournamentId,
				participant_type: 'solo',
				pair_id: null,
				player_id: playerId,
				seed: null,
				note,
				status: 'active',
				created_at: createdAt
			};
		},

		async removeById(tournamentId: string, participantId: string): Promise<void> {
			const result = await db
				.prepare(
					'UPDATE tournament_participants SET status = \'removed\' WHERE id = ? AND tournament_id = ? AND status = \'active\''
				)
				.bind(participantId, tournamentId)
				.run();

			if (result.meta.changes === 0) {
				throw new Error('参加者が見つかりません。');
			}
		},

		async setSeed(
			tournamentId: string,
			participantId: string,
			seed: number | null
		): Promise<TournamentParticipantRecord> {
			const existing = await ensureParticipant(tournamentId, participantId);

			await db
				.prepare('UPDATE tournament_participants SET seed = ? WHERE id = ? AND tournament_id = ?')
				.bind(seed ?? null, participantId, tournamentId)
				.run();

			return {
				...existing,
				seed: seed ?? null
			};
		},

		async setNote(
			tournamentId: string,
			participantId: string,
			note: string | null
		): Promise<TournamentParticipantRecord> {
			const existing = await ensureParticipant(tournamentId, participantId);

			await db
				.prepare('UPDATE tournament_participants SET note = ? WHERE id = ? AND tournament_id = ?')
				.bind(note?.trim() ?? null, participantId, tournamentId)
				.run();

			return {
				...existing,
				note: note?.trim() ?? null
			};
		},

		async ensureParticipant(
			tournamentId: string,
			participantId: string
		): Promise<TournamentParticipantRecord> {
			return ensureParticipant(tournamentId, participantId);
		}
	};
};

export type TournamentParticipantsRepositoryD1 = ReturnType<typeof createTournamentParticipantsRepositoryD1>;

