import type { TeamBattleSlotData, TeamBattleSlotImportData, TeamBattleSlotRecord } from './team-battle-slots';

export const createTeamBattleSlotsRepositoryD1 = (db: D1Database) => {
	return {
		async listSlotsByBattle(battleId: string): Promise<TeamBattleSlotRecord[]> {
			const result = await db
				.prepare(
					`SELECT id, team_battle_id, team_id, slot_index, assignment_type, 
					pair_id, player1_id, player2_id 
					FROM team_battle_slots 
					WHERE team_battle_id = ? 
					ORDER BY team_id, slot_index`
				)
				.bind(battleId)
				.all<TeamBattleSlotRecord>();

			return result.results || [];
		},

		async createSlot(data: TeamBattleSlotData): Promise<TeamBattleSlotRecord> {
			const id = crypto.randomUUID();

			await db
				.prepare(
					`INSERT INTO team_battle_slots 
					(id, team_battle_id, team_id, slot_index, assignment_type, 
					pair_id, player1_id, player2_id) 
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					id,
					data.team_battle_id,
					data.team_id,
					data.slot_index,
					data.assignment_type,
					data.pair_id ?? null,
					data.player1_id ?? null,
					data.player2_id ?? null
				)
				.run();

			return {
				id,
				...data
			};
		},

		async ensureSlot(slotId: string): Promise<TeamBattleSlotRecord> {
			const result = await db
				.prepare('SELECT * FROM team_battle_slots WHERE id = ?')
				.bind(slotId)
				.first<TeamBattleSlotRecord>();

			if (!result) {
				throw new Error('Team battle slot not found');
			}

			return result;
		},

		async updateSlot(slotId: string, data: TeamBattleSlotData): Promise<TeamBattleSlotRecord> {
			await this.ensureSlot(slotId);

			await db
				.prepare(
					`UPDATE team_battle_slots 
					SET team_battle_id = ?, team_id = ?, slot_index = ?, assignment_type = ?, 
					pair_id = ?, player1_id = ?, player2_id = ? 
					WHERE id = ?`
				)
				.bind(
					data.team_battle_id,
					data.team_id,
					data.slot_index,
					data.assignment_type,
					data.pair_id ?? null,
					data.player1_id ?? null,
					data.player2_id ?? null,
					slotId
				)
				.run();

			return {
				id: slotId,
				...data
			};
		},

		async deleteSlot(slotId: string): Promise<void> {
			await this.ensureSlot(slotId);
			await db.prepare('DELETE FROM team_battle_slots WHERE id = ?').bind(slotId).run();
		},

		async deleteSlotsByBattle(battleId: string): Promise<void> {
			await db
				.prepare('DELETE FROM team_battle_slots WHERE team_battle_id = ?')
				.bind(battleId)
				.run();
		},

		async setSlots(slots: TeamBattleSlotImportData[]): Promise<TeamBattleSlotRecord[]> {
			await db.prepare('DELETE FROM team_battle_slots').run();

			const results: TeamBattleSlotRecord[] = [];

			for (const slot of slots) {
				if (!slot.team_battle_id || !slot.team_id) {
					continue;
				}

				const id = slot.id ?? crypto.randomUUID();

				await db
					.prepare(
						`INSERT INTO team_battle_slots 
						(id, team_battle_id, team_id, slot_index, assignment_type, 
						pair_id, player1_id, player2_id) 
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						id,
						slot.team_battle_id,
						slot.team_id,
						slot.slot_index,
						slot.assignment_type,
						slot.pair_id ?? null,
						slot.player1_id ?? null,
						slot.player2_id ?? null
					)
					.run();

				results.push({
					id,
					team_battle_id: slot.team_battle_id,
					team_id: slot.team_id,
					slot_index: slot.slot_index,
					assignment_type: slot.assignment_type,
					pair_id: slot.pair_id,
					player1_id: slot.player1_id,
					player2_id: slot.player2_id
				});
			}

			return results;
		}
	};
};
