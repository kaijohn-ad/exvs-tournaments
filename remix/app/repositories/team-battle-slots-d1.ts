import type {
	TeamBattleSlotData,
	TeamBattleSlotImportData,
	TeamBattleSlotRecord
} from './team-battle-slots';

export const createTeamBattleSlotsRepositoryD1 = (db: D1Database) => {
	const listTeamBattleSlots = async (battleId: string): Promise<TeamBattleSlotRecord[]> => {
		const result = await db
			.prepare(
				`SELECT id, team_battle_id, team_id, slot_index, assignment_type,
				pair_id, player1_id, player2_id
				FROM team_battle_slots WHERE team_battle_id = ?
				ORDER BY team_id, slot_index`
			)
			.bind(battleId)
			.all<TeamBattleSlotRecord>();

		return result.results || [];
	};

	const listTeamBattleSlotsByTeam = async (
		battleId: string,
		teamId: string
	): Promise<TeamBattleSlotRecord[]> => {
		const result = await db
			.prepare(
				`SELECT id, team_battle_id, team_id, slot_index, assignment_type,
				pair_id, player1_id, player2_id
				FROM team_battle_slots WHERE team_battle_id = ? AND team_id = ?
				ORDER BY slot_index`
			)
			.bind(battleId, teamId)
			.all<TeamBattleSlotRecord>();

		return result.results || [];
	};

	const createTeamBattleSlot = async (data: TeamBattleSlotData): Promise<TeamBattleSlotRecord> => {
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
			team_battle_id: data.team_battle_id,
			team_id: data.team_id,
			slot_index: data.slot_index,
			assignment_type: data.assignment_type,
			pair_id: data.pair_id,
			player1_id: data.player1_id,
			player2_id: data.player2_id
		};
	};

	const ensureTeamBattleSlot = async (
		battleId: string,
		slotId: string
	): Promise<TeamBattleSlotRecord> => {
		const result = await db
			.prepare(
				`SELECT id, team_battle_id, team_id, slot_index, assignment_type,
				pair_id, player1_id, player2_id
				FROM team_battle_slots WHERE id = ? AND team_battle_id = ?`
			)
			.bind(slotId, battleId)
			.first<TeamBattleSlotRecord>();

		if (!result) {
			throw new Error('Team battle slot not found');
		}

		return result;
	};

	const ensureSlot = async (slotId: string): Promise<TeamBattleSlotRecord> => {
		const result = await db
			.prepare(
				`SELECT id, team_battle_id, team_id, slot_index, assignment_type,
				pair_id, player1_id, player2_id
				FROM team_battle_slots WHERE id = ?`
			)
			.bind(slotId)
			.first<TeamBattleSlotRecord>();

		if (!result) {
			throw new Error('Team battle slot not found');
		}

		return result;
	};

	const updateTeamBattleSlot = async (
		battleId: string,
		slotId: string,
		data: TeamBattleSlotData
	): Promise<TeamBattleSlotRecord> => {
		await ensureTeamBattleSlot(battleId, slotId);

		await db
			.prepare(
				`UPDATE team_battle_slots
				SET team_id = ?, slot_index = ?, assignment_type = ?,
				pair_id = ?, player1_id = ?, player2_id = ?
				WHERE id = ? AND team_battle_id = ?`
			)
			.bind(
				data.team_id,
				data.slot_index,
				data.assignment_type,
				data.pair_id ?? null,
				data.player1_id ?? null,
				data.player2_id ?? null,
				slotId,
				battleId
			)
			.run();

		return {
			id: slotId,
			team_battle_id: battleId,
			team_id: data.team_id,
			slot_index: data.slot_index,
			assignment_type: data.assignment_type,
			pair_id: data.pair_id,
			player1_id: data.player1_id,
			player2_id: data.player2_id
		};
	};

	const updateSlot = async (
		slotId: string,
		data: TeamBattleSlotData
	): Promise<TeamBattleSlotRecord> => {
		await ensureSlot(slotId);

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
			team_battle_id: data.team_battle_id,
			team_id: data.team_id,
			slot_index: data.slot_index,
			assignment_type: data.assignment_type,
			pair_id: data.pair_id,
			player1_id: data.player1_id,
			player2_id: data.player2_id
		};
	};

	const deleteTeamBattleSlot = async (battleId: string, slotId: string): Promise<void> => {
		await ensureTeamBattleSlot(battleId, slotId);
		await db
			.prepare('DELETE FROM team_battle_slots WHERE id = ? AND team_battle_id = ?')
			.bind(slotId, battleId)
			.run();
	};

	const deleteSlot = async (slotId: string): Promise<void> => {
		await ensureSlot(slotId);
		await db.prepare('DELETE FROM team_battle_slots WHERE id = ?').bind(slotId).run();
	};

	const deleteTeamBattleSlotsByBattle = async (battleId: string): Promise<void> => {
		await db.prepare('DELETE FROM team_battle_slots WHERE team_battle_id = ?').bind(battleId).run();
	};

	const setTeamBattleSlots = async (
		battleId: string,
		slots: TeamBattleSlotImportData[]
	): Promise<TeamBattleSlotRecord[]> => {
		await db
			.prepare('DELETE FROM team_battle_slots WHERE team_battle_id = ?')
			.bind(battleId)
			.run();

		const results: TeamBattleSlotRecord[] = [];

		for (const slot of slots) {
			if (!slot.team_id || slot.slot_index === undefined) {
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
					battleId,
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
				team_battle_id: battleId,
				team_id: slot.team_id,
				slot_index: slot.slot_index,
				assignment_type: slot.assignment_type,
				pair_id: slot.pair_id,
				player1_id: slot.player1_id,
				player2_id: slot.player2_id
			});
		}

		return results.sort((a, b) => {
			if (a.team_id !== b.team_id) {
				return a.team_id.localeCompare(b.team_id);
			}
			return a.slot_index - b.slot_index;
		});
	};

	const setSlots = async (
		slots: TeamBattleSlotImportData[]
	): Promise<TeamBattleSlotRecord[]> => {
		await db.prepare('DELETE FROM team_battle_slots').run();

		const grouped = new Map<string, TeamBattleSlotImportData[]>();
		for (const slot of slots) {
			if (!slot.team_battle_id || !slot.team_id) {
				continue;
			}

			const battleSlots = grouped.get(slot.team_battle_id) ?? [];
			battleSlots.push(slot);
			grouped.set(slot.team_battle_id, battleSlots);
		}

		const results: TeamBattleSlotRecord[] = [];
		for (const [battleId, battleSlots] of grouped.entries()) {
			results.push(...(await setTeamBattleSlots(battleId, battleSlots)));
		}

		return results;
	};

	return {
		listTeamBattleSlots,
		listTeamBattleSlotsByTeam,
		createTeamBattleSlot,
		ensureTeamBattleSlot,
		updateTeamBattleSlot,
		deleteTeamBattleSlot,
		deleteTeamBattleSlotsByBattle,
		setTeamBattleSlots,
		listSlotsByBattle: listTeamBattleSlots,
		createSlot: createTeamBattleSlot,
		ensureSlot,
		updateSlot,
		deleteSlot,
		deleteSlotsByBattle: deleteTeamBattleSlotsByBattle,
		setSlots
	};
};
