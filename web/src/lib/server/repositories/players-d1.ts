import { randomUUID } from 'node:crypto';
import type { PlayerData, PlayerImportData, PlayerRecord } from './players';

export const createPlayersRepositoryD1 = (db: D1Database) => {
	return {
		async listPlayers(eventId: string): Promise<PlayerRecord[]> {
			const result = await db
				.prepare('SELECT id, name, note FROM players WHERE event_id = ? ORDER BY name COLLATE NOCASE')
				.bind(eventId)
				.all<PlayerRecord>();

			return result.results || [];
		},

		async createPlayer(eventId: string, data: PlayerData): Promise<PlayerRecord> {
			const id = randomUUID();
			const name = data.name.trim();
			const note = data.note?.trim() || null;

			await db
				.prepare('INSERT INTO players (id, event_id, name, note) VALUES (?, ?, ?, ?)')
				.bind(id, eventId, name, note)
				.run();

			return {
				id,
				name,
				note: note || undefined
			};
		},

		async ensurePlayer(eventId: string, playerId: string): Promise<PlayerRecord> {
			const result = await db
				.prepare('SELECT id, name, note FROM players WHERE id = ? AND event_id = ?')
				.bind(playerId, eventId)
				.first<PlayerRecord>();

			if (!result) {
				throw new Error('Player not found');
			}

			return {
				id: result.id,
				name: result.name,
				note: result.note || undefined
			};
		},

		async updatePlayer(eventId: string, playerId: string, data: PlayerData): Promise<PlayerRecord> {
			await this.ensurePlayer(eventId, playerId);

			const name = data.name.trim();
			const note = data.note?.trim() || null;

			await db
				.prepare('UPDATE players SET name = ?, note = ? WHERE id = ? AND event_id = ?')
				.bind(name, note, playerId, eventId)
				.run();

			return {
				id: playerId,
				name,
				note: note || undefined
			};
		},

		async deletePlayer(eventId: string, playerId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM players WHERE id = ? AND event_id = ?')
				.bind(playerId, eventId)
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

				const id = entry.id?.trim() || randomUUID();
				const note = entry.note?.trim() || null;

				await db
					.prepare('INSERT INTO players (id, event_id, name, note) VALUES (?, ?, ?, ?)')
					.bind(id, eventId, name, note)
					.run();

				records.push({
					id,
					name,
					note: note || undefined
				});
			}

			records.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return records;
		}
	};
};

export type PlayersRepositoryD1 = ReturnType<typeof createPlayersRepositoryD1>;
