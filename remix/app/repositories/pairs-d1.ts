import { generateUUID } from "~/utils/uuid";
import type { PairData, PairImportData, PairRecord } from './pairs';

export const createPairsRepositoryD1 = (db: D1Database) => {
	return {
		async listPairs(eventId: string): Promise<PairRecord[]> {
			const result = await db
				.prepare('SELECT id, event_id, player1_id, player2_id, seed, created_at FROM pairs WHERE event_id = ? ORDER BY seed ASC, id ASC')
				.bind(eventId)
				.all<any>();

			return (result.results || []).map((row) => ({
				id: row.id,
				event_id: row.event_id,
				player1_id: row.player1_id,
				player2_id: row.player2_id,
				seed: row.seed ?? null,
				created_at: row.created_at
			}));
		},

		async createPair(eventId: string, data: PairData): Promise<PairRecord> {
			const id = generateUUID();
			const player1_id = data.player1_id.trim();
			const player2_id = data.player2_id.trim();
			const seed = data.seed ?? null;
			const createdAt = new Date().toISOString();

			await db
				.prepare('INSERT INTO pairs (id, event_id, player1_id, player2_id, seed, created_at) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(id, eventId, player1_id, player2_id, seed, createdAt)
				.run();

			return {
				id,
				event_id: eventId,
				player1_id,
				player2_id,
				seed,
				created_at: createdAt
			};
		},

	async ensurePair(pairId: string): Promise<PairRecord> {
			const result = await db
				.prepare('SELECT id, event_id, player1_id, player2_id, seed, created_at FROM pairs WHERE id = ?')
				.bind(pairId)
				.first<any>();

			if (!result) {
				throw new Error('Pair not found');
			}

			return {
				id: result.id,
				event_id: result.event_id,
				player1_id: result.player1_id,
				player2_id: result.player2_id,
				seed: result.seed ?? null,
				created_at: result.created_at
			};
		},

	async updatePair(pairId: string, data: PairData): Promise<PairRecord> {
		const ensured = await this.ensurePair(pairId);

			const player1_id = data.player1_id.trim();
			const player2_id = data.player2_id.trim();
			const seed = data.seed ?? null;

			await db
				.prepare('UPDATE pairs SET player1_id = ?, player2_id = ?, seed = ? WHERE id = ?')
				.bind(player1_id, player2_id, seed, pairId)
				.run();

			return {
				id: pairId,
				event_id: ensured.event_id,
				player1_id,
				player2_id,
				seed,
				created_at: ensured.created_at
			};
		},

	async deletePair(pairId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM pairs WHERE id = ?')
				.bind(pairId)
				.run();

			if (result.meta.changes === 0) {
				throw new Error('Pair not found');
			}
		},

		async setPairs(eventId: string, pairs: PairImportData[]): Promise<PairRecord[]> {
			await db.prepare('DELETE FROM pairs WHERE event_id = ?').bind(eventId).run();

			const records: PairRecord[] = [];
			for (const entry of pairs) {
				const player1_id = entry.player1_id?.trim();
				const player2_id = entry.player2_id?.trim();
				
				if (!player1_id || !player2_id) {
					continue;
				}

			const id = entry.id?.trim() || generateUUID();
			const seed = entry.seed ?? null;
			const createdAt = new Date().toISOString();

			await db
				.prepare('INSERT INTO pairs (id, event_id, player1_id, player2_id, seed, created_at) VALUES (?, ?, ?, ?, ?, ?)')
				.bind(id, eventId, player1_id, player2_id, seed, createdAt)
				.run();

				records.push({
					id,
					player1_id,
					player2_id,
				seed,
				event_id: eventId,
				created_at: createdAt
				});
			}

			records.sort((a, b) => (a.seed || 0) - (b.seed || 0));
			return records;
		}
	};
};

export type PairsRepositoryD1 = ReturnType<typeof createPairsRepositoryD1>;
