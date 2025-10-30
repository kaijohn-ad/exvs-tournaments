import { generateUUID } from "~/utils/uuid";
import type { TournamentData, TournamentImportData, TournamentRecord } from './tournaments';

export const createTournamentsRepositoryD1 = (db: D1Database) => {
	return {
		async listTournaments(eventId: string): Promise<TournamentRecord[]> {
			const result = await db
				.prepare(
					'SELECT id, event_id, name, format, seeding_mode, entry_mode, created_at FROM tournaments WHERE event_id = ? ORDER BY name COLLATE NOCASE'
				)
				.bind(eventId)
				.all<{
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					entry_mode: string;
					created_at: string;
				}>();

			return (
				result.results?.map((row: {
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					entry_mode: string;
					created_at: string;
				}) => ({
					id: row.id,
					eventId: row.event_id,
					name: row.name,
					format: row.format as 'single-elimination',
					seedingMode: row.seeding_mode as 'random' | 'manual',
					entryMode: (row.entry_mode || 'pair') as 'pair' | 'solo',
					createdAt: row.created_at
				})) || []
			);
		},

		async createTournament(eventId: string, data: TournamentData): Promise<TournamentRecord> {
			const id = generateUUID();
			const name = data.name.trim();
			const format = data.format || 'single-elimination';
			const seedingMode = data.seedingMode || 'random';
			const entryMode = data.entryMode || 'pair';
			const createdAt = new Date().toISOString();

			await db
				.prepare(
					'INSERT INTO tournaments (id, event_id, name, format, seeding_mode, entry_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
				)
				.bind(id, eventId, name, format, seedingMode, entryMode, createdAt)
				.run();

			return {
				id,
				eventId,
				name,
				format,
				seedingMode,
				entryMode,
				createdAt
			};
		},

		async ensureTournament(tournamentId: string): Promise<TournamentRecord> {
			const result = await db
				.prepare(
					'SELECT id, event_id, name, format, seeding_mode, entry_mode, created_at FROM tournaments WHERE id = ?'
				)
				.bind(tournamentId)
				.first<{
					id: string;
					event_id: string;
					name: string;
					format: string;
					seeding_mode: string;
					entry_mode: string;
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
				entryMode: (result.entry_mode || 'pair') as 'pair' | 'solo',
				createdAt: result.created_at
			};
		},

		async updateTournament(
			tournamentId: string,
			data: TournamentData
		): Promise<TournamentRecord> {
			const existing = await this.ensureTournament(tournamentId);

			const name = data.name.trim();
			const format = data.format || existing.format;
			const seedingMode = data.seedingMode || existing.seedingMode;
			const entryMode = data.entryMode ?? existing.entryMode;

			await db
				.prepare(
					'UPDATE tournaments SET name = ?, format = ?, seeding_mode = ?, entry_mode = ? WHERE id = ?'
				)
				.bind(name, format, seedingMode, entryMode, tournamentId)
				.run();

			return {
				id: tournamentId,
				eventId: existing.eventId,
				name,
				format,
				seedingMode,
				entryMode,
				createdAt: existing.createdAt
			};
		},

		async deleteTournament(tournamentId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM tournaments WHERE id = ?')
				.bind(tournamentId)
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

				const id = entry.id?.trim() || generateUUID();
				const format = entry.format || 'single-elimination';
				const seedingMode = entry.seedingMode || 'random';
				const entryMode = entry.entryMode || 'pair';
				const createdAt = new Date().toISOString();

				await db
					.prepare(
						'INSERT INTO tournaments (id, event_id, name, format, seeding_mode, entry_mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
					)
					.bind(id, eventId, name, format, seedingMode, entryMode, createdAt)
					.run();

				records.push({
					id,
					eventId,
					name,
					format,
					seedingMode,
					entryMode,
					createdAt
				});
			}

			records.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return records;
		}
	};
};

export type TournamentsRepositoryD1 = ReturnType<typeof createTournamentsRepositoryD1>;
