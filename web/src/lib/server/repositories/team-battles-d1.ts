import type { TeamBattleData, TeamBattleImportData, TeamBattleRecord } from './team-battles';

export const createTeamBattlesRepositoryD1 = (db: D1Database) => {
	return {
		async listTeamBattles(eventId: string): Promise<TeamBattleRecord[]> {
			const result = await db
				.prepare(
					`SELECT id, event_id, team_a_id, team_b_id, slots_count, format, 
					allow_double_appearance_per_team, tiebreak, status, result 
					FROM team_battles WHERE event_id = ? ORDER BY created_at DESC`
				)
				.bind(eventId)
				.all<TeamBattleRecord>();

			return (result.results || []).map((row) => ({
				...row,
				allow_double_appearance_per_team: Boolean(row.allow_double_appearance_per_team)
			}));
		},

		async createTeamBattle(eventId: string, data: TeamBattleData): Promise<TeamBattleRecord> {
			const id = crypto.randomUUID();
			const slots_count = data.slots_count ?? 3;
			const format = data.format ?? 'waseda';
			const allow_double_appearance_per_team = data.allow_double_appearance_per_team ?? true;
			const tiebreak = data.tiebreak ?? 'off';
			const status = data.status ?? 'pending';

			await db
				.prepare(
					`INSERT INTO team_battles 
					(id, event_id, team_a_id, team_b_id, slots_count, format, 
					allow_double_appearance_per_team, tiebreak, status, result) 
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					eventId,
					data.team_a_id,
					data.team_b_id,
					slots_count,
					format,
					allow_double_appearance_per_team ? 1 : 0,
					tiebreak,
					status,
					data.result ?? null
				)
				.run();

			return {
				id,
				event_id: eventId,
				team_a_id: data.team_a_id,
				team_b_id: data.team_b_id,
				slots_count,
				format,
				allow_double_appearance_per_team,
				tiebreak,
				status,
				result: data.result
			};
		},

		async ensureTeamBattle(eventId: string, battleId: string): Promise<TeamBattleRecord> {
			const result = await db
				.prepare(
					`SELECT id, event_id, team_a_id, team_b_id, slots_count, format, 
					allow_double_appearance_per_team, tiebreak, status, result 
					FROM team_battles WHERE id = ? AND event_id = ?`
				)
				.bind(battleId, eventId)
				.first<TeamBattleRecord>();

			if (!result) {
				throw new Error('Team battle not found');
			}

			return {
				...result,
				allow_double_appearance_per_team: Boolean(result.allow_double_appearance_per_team)
			};
		},

		async updateTeamBattle(
			eventId: string,
			battleId: string,
			data: TeamBattleData
		): Promise<TeamBattleRecord> {
			const existing = await this.ensureTeamBattle(eventId, battleId);

			const slots_count = data.slots_count ?? existing.slots_count;
			const format = data.format ?? existing.format;
			const allow_double_appearance_per_team =
				data.allow_double_appearance_per_team ?? existing.allow_double_appearance_per_team;
			const tiebreak = data.tiebreak ?? existing.tiebreak;
			const status = data.status ?? existing.status;

			await db
				.prepare(
					`UPDATE team_battles 
					SET team_a_id = ?, team_b_id = ?, slots_count = ?, format = ?, 
					allow_double_appearance_per_team = ?, tiebreak = ?, status = ?, result = ? 
					WHERE id = ? AND event_id = ?`
				)
				.bind(
					data.team_a_id,
					data.team_b_id,
					slots_count,
					format,
					allow_double_appearance_per_team ? 1 : 0,
					tiebreak,
					status,
					data.result ?? null,
					battleId,
					eventId
				)
				.run();

			return {
				id: battleId,
				event_id: eventId,
				team_a_id: data.team_a_id,
				team_b_id: data.team_b_id,
				slots_count,
				format,
				allow_double_appearance_per_team,
				tiebreak,
				status,
				result: data.result
			};
		},

		async deleteTeamBattle(eventId: string, battleId: string): Promise<void> {
			await this.ensureTeamBattle(eventId, battleId);
			await db
				.prepare('DELETE FROM team_battles WHERE id = ? AND event_id = ?')
				.bind(battleId, eventId)
				.run();
		},

		async setTeamBattles(
			eventId: string,
			battles: TeamBattleImportData[]
		): Promise<TeamBattleRecord[]> {
			await db.prepare('DELETE FROM team_battles WHERE event_id = ?').bind(eventId).run();

			const results: TeamBattleRecord[] = [];

			for (const battle of battles) {
				if (!battle.team_a_id || !battle.team_b_id) {
					continue;
				}

				const id = battle.id ?? crypto.randomUUID();
				const slots_count = battle.slots_count ?? 3;
				const format = battle.format ?? 'waseda';
				const allow_double_appearance_per_team =
					battle.allow_double_appearance_per_team ?? true;
				const tiebreak = battle.tiebreak ?? 'off';
				const status = battle.status ?? 'pending';

				await db
					.prepare(
						`INSERT INTO team_battles 
						(id, event_id, team_a_id, team_b_id, slots_count, format, 
						allow_double_appearance_per_team, tiebreak, status, result) 
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						eventId,
						battle.team_a_id,
						battle.team_b_id,
						slots_count,
						format,
						allow_double_appearance_per_team ? 1 : 0,
						tiebreak,
						status,
						battle.result ?? null
					)
					.run();

				results.push({
					id,
					event_id: eventId,
					team_a_id: battle.team_a_id,
					team_b_id: battle.team_b_id,
					slots_count,
					format,
					allow_double_appearance_per_team,
					tiebreak,
					status,
					result: battle.result
				});
			}

			return results;
		}
	};
};
