import type { PairData, PairImportData, PairRecord } from './pairs';

export const createPairsRepositoryD1 = (db: D1Database) => {
	return {
		async listPairs(eventId: string): Promise<PairRecord[]> {
			const result = await db
				.prepare('SELECT id, player1_id, player2_id, seed FROM pairs WHERE event_id = ? ORDER BY seed ASC, id ASC')
				.bind(eventId)
				.all<PairRecord>();

			return result.results || [];
		},

		async createPair(eventId: string, data: PairData): Promise<PairRecord> {
			const id = crypto.randomUUID();
			const player1_id = data.player1_id.trim();
			const player2_id = data.player2_id.trim();
			const seed = data.seed || null;

			await db
				.prepare('INSERT INTO pairs (id, event_id, player1_id, player2_id, seed) VALUES (?, ?, ?, ?, ?)')
				.bind(id, eventId, player1_id, player2_id, seed)
				.run();

			return {
				id,
				player1_id,
				player2_id,
				seed: seed || undefined
			};
		},

		async ensurePair(eventId: string, pairId: string): Promise<PairRecord> {
			const result = await db
				.prepare('SELECT id, player1_id, player2_id, seed FROM pairs WHERE id = ? AND event_id = ?')
				.bind(pairId, eventId)
				.first<PairRecord>();

			if (!result) {
				throw new Error('Pair not found');
			}

			return {
				id: result.id,
				player1_id: result.player1_id,
				player2_id: result.player2_id,
				seed: result.seed || undefined
			};
		},

		async updatePair(eventId: string, pairId: string, data: PairData): Promise<PairRecord> {
			await this.ensurePair(eventId, pairId);

			const player1_id = data.player1_id.trim();
			const player2_id = data.player2_id.trim();
			const seed = data.seed || null;

			await db
				.prepare('UPDATE pairs SET player1_id = ?, player2_id = ?, seed = ? WHERE id = ? AND event_id = ?')
				.bind(player1_id, player2_id, seed, pairId, eventId)
				.run();

			return {
				id: pairId,
				player1_id,
				player2_id,
				seed: seed || undefined
			};
		},

		async deletePair(eventId: string, pairId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM pairs WHERE id = ? AND event_id = ?')
				.bind(pairId, eventId)
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

				const id = entry.id?.trim() || crypto.randomUUID();
				const seed = entry.seed || null;

				await db
					.prepare('INSERT INTO pairs (id, event_id, player1_id, player2_id, seed) VALUES (?, ?, ?, ?, ?)')
					.bind(id, eventId, player1_id, player2_id, seed)
					.run();

				records.push({
					id,
					player1_id,
					player2_id,
					seed: seed || undefined
				});
			}

			records.sort((a, b) => (a.seed || 0) - (b.seed || 0));
			return records;
		}
	};
};

export type PairsRepositoryD1 = ReturnType<typeof createPairsRepositoryD1>;
