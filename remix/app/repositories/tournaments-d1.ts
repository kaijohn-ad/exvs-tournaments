import type { TournamentData, TournamentImportData, TournamentRecord } from './tournaments';

export const createTournamentsRepositoryD1 = (db: D1Database) => {
	return {
		async listTournaments(eventId: string): Promise<TournamentRecord[]> {
			const result = await db
				.prepare(
					'SELECT id, event_id, name, format, seeding_mode, created_at FROM tournaments WHERE event_id = ? ORDER BY name COLLATE NOCASE'
				)
				.bind(eventId)
				.all<{
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					created_at: string;
				}>();

			return (
				result.results?.map((row: {
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					created_at: string;
				}) => ({
					id: row.id,
					eventId: row.event_id,
					name: row.name,
					format: row.format as 'single-elimination',
					seedingMode: row.seeding_mode as 'random' | 'manual',
					createdAt: row.created_at
				})) || []
			);
		},

		async createTournament(eventId: string, data: TournamentData): Promise<TournamentRecord> {
			const id = crypto.randomUUID();
			const name = data.name.trim();
			const format = data.format || 'single-elimination';
			const seedingMode = data.seedingMode || 'random';
			const createdAt = new Date().toISOString();

			await db
				.prepare(
					'INSERT INTO tournaments (id, event_id, name, format, seeding_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)'
				)
				.bind(id, eventId, name, format, seedingMode, createdAt)
				.run();

			return {
				id,
				eventId,
				name,
				format,
				seedingMode,
				createdAt
			};
		},

		async ensureTournament(eventId: string, tournamentId: string): Promise<TournamentRecord> {
			const result = await db
				.prepare(
					'SELECT id, event_id, name, format, seeding_mode, created_at FROM tournaments WHERE id = ? AND event_id = ?'
				)
				.bind(tournamentId, eventId)
				.first<{
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					created_at: string;
				}>();

			if (!result) {
				throw new Error('Tournament not found');
			}

			return {
				id: result.id,
				eventId: result.event_id,
				name: result.name,
				format: result.format as 'single-elimination',
				seedingMode: result.seeding_mode as 'random' | 'manual',
				createdAt: result.created_at
			};
		},

		async updateTournament(
			eventId: string,
			tournamentId: string,
			data: TournamentData
		): Promise<TournamentRecord> {
			const existing = await this.ensureTournament(eventId, tournamentId);

			const name = data.name.trim();
			const format = data.format || existing.format;
			const seedingMode = data.seedingMode || existing.seedingMode;

			await db
				.prepare(
					'UPDATE tournaments SET name = ?, format = ?, seeding_mode = ? WHERE id = ? AND event_id = ?'
				)
				.bind(name, format, seedingMode, tournamentId, eventId)
				.run();

			return {
				id: tournamentId,
				eventId,
				name,
				format,
				seedingMode,
				createdAt: existing.createdAt
			};
		},

		async deleteTournament(eventId: string, tournamentId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM tournaments WHERE id = ? AND event_id = ?')
				.bind(tournamentId, eventId)
				.run();

			if (result.meta.changes === 0) {
				throw new Error('Tournament not found');
			}
		},

		async setTournaments(
			eventId: string,
			tournaments: TournamentImportData[]
		): Promise<TournamentRecord[]> {
			await db.prepare('DELETE FROM tournaments WHERE event_id = ?').bind(eventId).run();

			const records: TournamentRecord[] = [];
			for (const entry of tournaments) {
				const name = entry.name?.trim();
				if (!name) {
					continue;
				}

				const id = entry.id?.trim() || crypto.randomUUID();
				const format = entry.format || 'single-elimination';
				const seedingMode = entry.seedingMode || 'random';
				const createdAt = new Date().toISOString();

				await db
					.prepare(
						'INSERT INTO tournaments (id, event_id, name, format, seeding_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)'
					)
					.bind(id, eventId, name, format, seedingMode, createdAt)
					.run();

				records.push({
					id,
					eventId,
					name,
					format,
					seedingMode,
					createdAt
				});
			}

			records.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return records;
		}
	};
};

export type TournamentsRepositoryD1 = ReturnType<typeof createTournamentsRepositoryD1>;
