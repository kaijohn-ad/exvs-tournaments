import { generateUUID } from "~/utils/uuid";
import type { TeamData, TeamImportData, TeamRecord } from './teams';

export const createTeamsRepositoryD1 = (db: D1Database) => {
	return {
		async listTeams(eventId: string): Promise<TeamRecord[]> {
			const result = await db
				.prepare('SELECT id, name FROM teams WHERE event_id = ? ORDER BY name COLLATE NOCASE')
				.bind(eventId)
				.all<TeamRecord>();

			return result.results || [];
		},

		async createTeam(eventId: string, data: TeamData): Promise<TeamRecord> {
			const id = generateUUID();
			const name = data.name.trim();

			await db
				.prepare('INSERT INTO teams (id, event_id, name) VALUES (?, ?, ?)')
				.bind(id, eventId, name)
				.run();

			return {
				id,
				name
			};
		},

		async ensureTeam(eventId: string, teamId: string): Promise<TeamRecord> {
			const result = await db
				.prepare('SELECT id, name FROM teams WHERE id = ? AND event_id = ?')
				.bind(teamId, eventId)
				.first<TeamRecord>();

			if (!result) {
				throw new Error('Team not found');
			}

			return {
				id: result.id,
				name: result.name
			};
		},

		async updateTeam(eventId: string, teamId: string, data: TeamData): Promise<TeamRecord> {
			await this.ensureTeam(eventId, teamId);

			const name = data.name.trim();

			await db
				.prepare('UPDATE teams SET name = ? WHERE id = ? AND event_id = ?')
				.bind(name, teamId, eventId)
				.run();

			return {
				id: teamId,
				name
			};
		},

		async deleteTeam(eventId: string, teamId: string): Promise<void> {
			const result = await db
				.prepare('DELETE FROM teams WHERE id = ? AND event_id = ?')
				.bind(teamId, eventId)
				.run();

			if (result.meta.changes === 0) {
				throw new Error('Team not found');
			}
		},

		async setTeams(eventId: string, teams: TeamImportData[]): Promise<TeamRecord[]> {
			await db.prepare('DELETE FROM teams WHERE event_id = ?').bind(eventId).run();

			const records: TeamRecord[] = [];
			for (const entry of teams) {
				const name = entry.name?.trim();
				if (!name) {
					continue;
				}

				const id = entry.id?.trim() || generateUUID();

				await db
					.prepare('INSERT INTO teams (id, event_id, name) VALUES (?, ?, ?)')
					.bind(id, eventId, name)
					.run();

				records.push({
					id,
					name
				});
			}

			records.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
			return records;
		},
		async addTeamMember(teamId: string, playerId: string): Promise<void> {
			await db
				.prepare('INSERT INTO team_members (id, team_id, player_id) VALUES (?, ?, ?)')
				.bind(generateUUID(), teamId, playerId)
				.run();
		},
		async listTeamMemberIds(teamId: string): Promise<string[]> {
			const result = await db
				.prepare('SELECT player_id FROM team_members WHERE team_id = ?')
				.bind(teamId)
				.all<{ player_id: string }>();

			return (result.results || []).map((row) => row.player_id);
		}
	};
};

export type TeamsRepositoryD1 = ReturnType<typeof createTeamsRepositoryD1>;
