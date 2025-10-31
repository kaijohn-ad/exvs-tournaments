import { generateUUID } from "~/utils/uuid";
import type {
	FfaGroupImportData,
	FfaGroupRecord,
	FfaGroupUpdateData
} from './ffa-groups';

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

const normalizeParticipantPlayerId = (
	type: 'player' | 'bye' | 'empty',
	playerId?: string | null
) => {
	if (type === 'bye' || type === 'empty') {
		return null;
	}

	return playerId?.trim() ?? null;
};

const hasKey = <T extends object>(object: T, key: keyof any): boolean => {
	return Object.prototype.hasOwnProperty.call(object, key);
};

const mapRowToRecord = (row: any): FfaGroupRecord => ({
	id: row.id,
	tournament_id: row.tournament_id,
	round: row.round,
	position: row.position,
	participant_1_type: row.participant_1_type,
	participant_1_player_id: row.participant_1_player_id ?? null,
	participant_2_type: row.participant_2_type,
	participant_2_player_id: row.participant_2_player_id ?? null,
	participant_3_type: row.participant_3_type,
	participant_3_player_id: row.participant_3_player_id ?? null,
	participant_4_type: row.participant_4_type,
	participant_4_player_id: row.participant_4_player_id ?? null,
	status: row.status,
	winner1_player_id: row.winner1_player_id ?? null,
	winner2_player_id: row.winner2_player_id ?? null,
	created_at: row.created_at
});

const validatePlayerForFfaGroup = async (
	db: D1Database,
	tournamentId: string,
	playerId: string | null
): Promise<void> => {
	if (!playerId) {
		return;
	}

	// Check that player exists
	const player = await db
		.prepare('SELECT id FROM players WHERE id = ?')
		.bind(playerId)
		.first<{ id: string }>();

	if (!player) {
		throw new Error('プレイヤーが見つかりません。');
	}

	// Check that player is registered as an active solo participant in this tournament
	const participant = await db
		.prepare(
			'SELECT id FROM tournament_participants WHERE tournament_id = ? AND player_id = ? AND participant_type = \'solo\' AND status = \'active\''
		)
		.bind(tournamentId, playerId)
		.first<{ id: string }>();

	if (!participant) {
		throw new Error('このプレイヤーはトーナメントの参加者として登録されていません。');
	}
};

export const createFfaGroupsRepositoryD1 = (db: D1Database) => {
	return {
		async createFfaGroup(
			tournamentId: string,
			data: Omit<FfaGroupRecord, 'id' | 'tournament_id' | 'created_at'>
		): Promise<FfaGroupRecord> {
			const id = generateUUID();
			const createdAt = new Date().toISOString();
			const round = sanitizeRound((data as any).round);
			const position = sanitizeRound((data as any).position);
			const status = (data as any).status ?? 'pending';

			// Validate player participants
			const participant1Type = (data as any).participant_1_type;
			const participant1PlayerId = participant1Type === 'player' ? (data as any).participant_1_player_id ?? null : null;
			const participant2Type = (data as any).participant_2_type;
			const participant2PlayerId = participant2Type === 'player' ? (data as any).participant_2_player_id ?? null : null;
			const participant3Type = (data as any).participant_3_type;
			const participant3PlayerId = participant3Type === 'player' ? (data as any).participant_3_player_id ?? null : null;
			const participant4Type = (data as any).participant_4_type;
			const participant4PlayerId = participant4Type === 'player' ? (data as any).participant_4_player_id ?? null : null;

			await validatePlayerForFfaGroup(db, tournamentId, participant1PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant2PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant3PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant4PlayerId);

			await db
				.prepare(
					`INSERT INTO ffa_groups
					(id, tournament_id, round, position,
						participant_1_type, participant_1_player_id,
						participant_2_type, participant_2_player_id,
						participant_3_type, participant_3_player_id,
						participant_4_type, participant_4_player_id,
						status, winner1_player_id, winner2_player_id, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					tournamentId,
					round,
					position,
					(data as any).participant_1_type,
					(data as any).participant_1_player_id ?? null,
					(data as any).participant_2_type,
					(data as any).participant_2_player_id ?? null,
					(data as any).participant_3_type,
					(data as any).participant_3_player_id ?? null,
					(data as any).participant_4_type,
					(data as any).participant_4_player_id ?? null,
					status,
					(data as any).winner1_player_id ?? null,
					(data as any).winner2_player_id ?? null,
					createdAt
				)
				.run();

			return {
				id,
				tournament_id: tournamentId,
				round,
				position,
				participant_1_type: (data as any).participant_1_type,
				participant_1_player_id: (data as any).participant_1_player_id ?? null,
				participant_2_type: (data as any).participant_2_type,
				participant_2_player_id: (data as any).participant_2_player_id ?? null,
				participant_3_type: (data as any).participant_3_type,
				participant_3_player_id: (data as any).participant_3_player_id ?? null,
				participant_4_type: (data as any).participant_4_type,
				participant_4_player_id: (data as any).participant_4_player_id ?? null,
				status,
				winner1_player_id: (data as any).winner1_player_id ?? null,
				winner2_player_id: (data as any).winner2_player_id ?? null,
				created_at: createdAt
			};
		},

		async listFfaGroups(tournamentId: string): Promise<FfaGroupRecord[]> {
			const result = await db
				.prepare(
					`SELECT id, tournament_id, round, position,
						participant_1_type, participant_1_player_id,
						participant_2_type, participant_2_player_id,
						participant_3_type, participant_3_player_id,
						participant_4_type, participant_4_player_id,
						status, winner1_player_id, winner2_player_id, created_at
					FROM ffa_groups
					WHERE tournament_id = ?
					ORDER BY round ASC, position ASC`
				)
				.bind(tournamentId)
				.all<any>();

			return (result.results || []).map((row) => mapRowToRecord(row));
		},

		async ensureFfaGroup(
			tournamentId: string,
			groupId: string
		): Promise<FfaGroupRecord> {
			const row = await db
				.prepare(
					`SELECT id, tournament_id, round, position,
						participant_1_type, participant_1_player_id,
						participant_2_type, participant_2_player_id,
						participant_3_type, participant_3_player_id,
						participant_4_type, participant_4_player_id,
						status, winner1_player_id, winner2_player_id, created_at
					FROM ffa_groups
					WHERE tournament_id = ? AND id = ?`
				)
				.bind(tournamentId, groupId)
				.first<any>();

			if (!row) {
				throw new Error('FFA group not found');
			}

			return mapRowToRecord(row);
		},

		async updateFfaGroup(
			tournamentId: string,
			groupId: string,
			data: FfaGroupUpdateData
		): Promise<FfaGroupRecord> {
			const existing = await this.ensureFfaGroup(tournamentId, groupId);

			const round = sanitizeWithFallback(data.round, existing.round);
			const position = sanitizeWithFallback(data.position, existing.position);

			const participant1Type = data.participant_1_type ?? existing.participant_1_type;
			const participant1PlayerIdRaw = hasKey(data, 'participant_1_player_id')
				? data.participant_1_player_id ?? null
				: existing.participant_1_player_id;
			const participant1PlayerId = normalizeParticipantPlayerId(
				participant1Type,
				participant1PlayerIdRaw
			);

			const participant2Type = data.participant_2_type ?? existing.participant_2_type;
			const participant2PlayerIdRaw = hasKey(data, 'participant_2_player_id')
				? data.participant_2_player_id ?? null
				: existing.participant_2_player_id;
			const participant2PlayerId = normalizeParticipantPlayerId(
				participant2Type,
				participant2PlayerIdRaw
			);

			const participant3Type = data.participant_3_type ?? existing.participant_3_type;
			const participant3PlayerIdRaw = hasKey(data, 'participant_3_player_id')
				? data.participant_3_player_id ?? null
				: existing.participant_3_player_id;
			const participant3PlayerId = normalizeParticipantPlayerId(
				participant3Type,
				participant3PlayerIdRaw
			);

			const participant4Type = data.participant_4_type ?? existing.participant_4_type;
			const participant4PlayerIdRaw = hasKey(data, 'participant_4_player_id')
				? data.participant_4_player_id ?? null
				: existing.participant_4_player_id;
			const participant4PlayerId = normalizeParticipantPlayerId(
				participant4Type,
				participant4PlayerIdRaw
			);

			// Validate player participants
			await validatePlayerForFfaGroup(db, tournamentId, participant1PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant2PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant3PlayerId);
			await validatePlayerForFfaGroup(db, tournamentId, participant4PlayerId);

			const status = data.status ?? existing.status ?? 'pending';
			const winner1PlayerId = hasKey(data, 'winner1_player_id')
				? data.winner1_player_id ?? null
				: existing.winner1_player_id;
			const winner2PlayerId = hasKey(data, 'winner2_player_id')
				? data.winner2_player_id ?? null
				: existing.winner2_player_id;

			await db
				.prepare(
					`UPDATE ffa_groups
					SET round = ?, position = ?,
						participant_1_type = ?, participant_1_player_id = ?,
						participant_2_type = ?, participant_2_player_id = ?,
						participant_3_type = ?, participant_3_player_id = ?,
						participant_4_type = ?, participant_4_player_id = ?,
						status = ?, winner1_player_id = ?, winner2_player_id = ?
					WHERE tournament_id = ? AND id = ?`
				)
				.bind(
					round,
					position,
					participant1Type,
					participant1PlayerId,
					participant2Type,
					participant2PlayerId,
					participant3Type,
					participant3PlayerId,
					participant4Type,
					participant4PlayerId,
					status,
					winner1PlayerId,
					winner2PlayerId,
					tournamentId,
					groupId
				)
				.run();

			return {
				...existing,
				round,
				position,
				participant_1_type: participant1Type,
				participant_1_player_id: participant1PlayerId,
				participant_2_type: participant2Type,
				participant_2_player_id: participant2PlayerId,
				participant_3_type: participant3Type,
				participant_3_player_id: participant3PlayerId,
				participant_4_type: participant4Type,
				participant_4_player_id: participant4PlayerId,
				status,
				winner1_player_id: winner1PlayerId,
				winner2_player_id: winner2PlayerId
			};
		},

		async setFfaGroups(
			tournamentId: string,
			groups: FfaGroupImportData[]
		): Promise<FfaGroupRecord[]> {
			await db
				.prepare('DELETE FROM ffa_groups WHERE tournament_id = ?')
				.bind(tournamentId)
				.run();

			const createdAtDefault = new Date().toISOString();
			const inserted: FfaGroupRecord[] = [];

			for (const group of groups) {
				const round = sanitizeRound(group.round);
				const position = sanitizeRound(group.position);
				const id = group.id ?? generateUUID();
				const createdAt = group.created_at ?? createdAtDefault;
				const status = group.status ?? 'pending';

				// Validate player participants
				const participant1PlayerId = group.participant_1_type === 'player' ? group.participant_1_player_id ?? null : null;
				const participant2PlayerId = group.participant_2_type === 'player' ? group.participant_2_player_id ?? null : null;
				const participant3PlayerId = group.participant_3_type === 'player' ? group.participant_3_player_id ?? null : null;
				const participant4PlayerId = group.participant_4_type === 'player' ? group.participant_4_player_id ?? null : null;

				await validatePlayerForFfaGroup(db, tournamentId, participant1PlayerId);
				await validatePlayerForFfaGroup(db, tournamentId, participant2PlayerId);
				await validatePlayerForFfaGroup(db, tournamentId, participant3PlayerId);
				await validatePlayerForFfaGroup(db, tournamentId, participant4PlayerId);

				await db
					.prepare(
						`INSERT INTO ffa_groups
						(id, tournament_id, round, position,
							participant_1_type, participant_1_player_id,
							participant_2_type, participant_2_player_id,
							participant_3_type, participant_3_player_id,
							participant_4_type, participant_4_player_id,
							status, winner1_player_id, winner2_player_id, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						tournamentId,
						round,
						position,
						group.participant_1_type,
						group.participant_1_player_id ?? null,
						group.participant_2_type,
						group.participant_2_player_id ?? null,
						group.participant_3_type,
						group.participant_3_player_id ?? null,
						group.participant_4_type,
						group.participant_4_player_id ?? null,
						status,
						group.winner1_player_id ?? null,
						group.winner2_player_id ?? null,
						createdAt
					)
					.run();

				inserted.push({
					id,
					tournament_id: tournamentId,
					round,
					position,
					participant_1_type: group.participant_1_type,
					participant_1_player_id: group.participant_1_player_id ?? null,
					participant_2_type: group.participant_2_type,
					participant_2_player_id: group.participant_2_player_id ?? null,
					participant_3_type: group.participant_3_type,
					participant_3_player_id: group.participant_3_player_id ?? null,
					participant_4_type: group.participant_4_type,
					participant_4_player_id: group.participant_4_player_id ?? null,
					status,
					winner1_player_id: group.winner1_player_id ?? null,
					winner2_player_id: group.winner2_player_id ?? null,
					created_at: createdAt
				});
			}

			return inserted;
		},

		async clearFfaGroups(tournamentId: string): Promise<void> {
			await db.prepare('DELETE FROM ffa_groups WHERE tournament_id = ?').bind(tournamentId).run();
		}
	};
};

export type FfaGroupsRepositoryD1 = ReturnType<typeof createFfaGroupsRepositoryD1>;

