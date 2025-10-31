import { generateUUID } from "~/utils/uuid";
import type { PlayerData, PlayerImportData, PlayerRecord } from './players';

export const createPlayersRepositoryD1 = (db: D1Database) => {
	return {
		async listPlayers(eventId: string): Promise<PlayerRecord[]> {
			const result = await db
				.prepare('SELECT id, event_id, name, note, created_at FROM players WHERE event_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE')
				.bind(eventId)
				.all<any>();

			return (result.results || []).map((row) => ({
				id: row.id,
				event_id: row.event_id,
				name: row.name,
				note: row.note ?? null,
				created_at: row.created_at,
				deleted_at: null
			}));
		},

		async createPlayer(eventId: string, data: PlayerData): Promise<PlayerRecord> {
			const id = generateUUID();
			const name = data.name.trim();
			const note = data.note?.trim() ?? null;
			const createdAt = new Date().toISOString();

			await db
				.prepare('INSERT INTO players (id, event_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)')
				.bind(id, eventId, name, note, createdAt)
				.run();

			return {
				id,
				event_id: eventId,
				name,
				note: note,
				created_at: createdAt,
				deleted_at: null
			};
		},

		async ensurePlayer(playerId: string): Promise<PlayerRecord> {
			const result = await db
				.prepare('SELECT id, event_id, name, note, created_at FROM players WHERE id = ? AND deleted_at IS NULL')
				.bind(playerId)
				.first<any>();

			if (!result) {
				throw new Error('Player not found');
			}

			return {
				id: result.id,
				event_id: result.event_id,
				name: result.name,
				note: result.note ?? null,
				created_at: result.created_at,
				deleted_at: null
			};
		},

		async updatePlayer(playerId: string, data: PlayerData): Promise<PlayerRecord> {
			const ensured = await this.ensurePlayer(playerId);

			const name = data.name.trim();
			const note = data.note?.trim() ?? null;

			await db
				.prepare('UPDATE players SET name = ?, note = ? WHERE id = ?')
				.bind(name, note, playerId)
				.run();

			return {
				id: playerId,
				event_id: ensured.event_id,
				name,
				note: note,
				created_at: ensured.created_at,
				deleted_at: null
			};
		},

		async deletePlayer(playerId: string): Promise<void> {
			const deletedAt = new Date().toISOString();
			const result = await db
				.prepare('UPDATE players SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
				.bind(deletedAt, playerId)
				.run();

			if (result.meta.changes === 0) {
				throw new Error('Player not found');
			}
		},

		async setPlayers(eventId: string, players: PlayerImportData[]): Promise<PlayerRecord[]> {
			await db.prepare('DELETE FROM players WHERE event_id = ?').bind(eventId).run();

			const records: PlayerRecord[] = [];
			for (const entry of players) {
				const name = entry.name?.trim();
				if (!name) {
					continue;
				}

				const id = entry.id?.trim() || generateUUID();
				const note = entry.note?.trim() || null;
			const createdAt = new Date().toISOString();

				await db
				.prepare('INSERT INTO players (id, event_id, name, note, created_at) VALUES (?, ?, ?, ?, ?)')
				.bind(id, eventId, name, note, createdAt)
					.run();

				records.push({
					id,
					name,
					note: note,
					event_id: eventId,
					created_at: createdAt,
					deleted_at: null
				});
			}

			records.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return records;
		}
	};
};

export type PlayersRepositoryD1 = ReturnType<typeof createPlayersRepositoryD1>;
