export interface TeamBattleSlotData {
	team_battle_id: string;
	team_id: string;
	slot_index: number;
	assignment_type: 'pair' | 'adhoc';
	pair_id?: string;
	player1_id?: string;
	player2_id?: string;
}

export interface TeamBattleSlotImportData extends TeamBattleSlotData {
	id?: string;
}

export interface TeamBattleSlotRecord extends TeamBattleSlotData {
	id: string;
}

const store = new Map<string, Map<string, TeamBattleSlotRecord>>();

const getBattleStore = (battleId: string) => {
	let battleStore = store.get(battleId);

	if (!battleStore) {
		battleStore = new Map();
		store.set(battleId, battleStore);
	}

	return battleStore;
};

export const listTeamBattleSlots = (battleId: string): TeamBattleSlotRecord[] => {
	const battleStore = getBattleStore(battleId);
	return Array.from(battleStore.values()).sort((a, b) => {
		if (a.team_id !== b.team_id) {
			return a.team_id.localeCompare(b.team_id);
		}
		return a.slot_index - b.slot_index;
	});
};

export const listTeamBattleSlotsByTeam = (
	battleId: string,
	teamId: string
): TeamBattleSlotRecord[] => {
	const battleStore = getBattleStore(battleId);
	return Array.from(battleStore.values())
		.filter((slot) => slot.team_id === teamId)
		.sort((a, b) => a.slot_index - b.slot_index);
};

export const createTeamBattleSlot = (data: TeamBattleSlotData): TeamBattleSlotRecord => {
	const battleStore = getBattleStore(data.team_battle_id);
	const id = crypto.randomUUID();

	const record: TeamBattleSlotRecord = {
		id,
		team_battle_id: data.team_battle_id,
		team_id: data.team_id,
		slot_index: data.slot_index,
		assignment_type: data.assignment_type,
		pair_id: data.pair_id,
		player1_id: data.player1_id,
		player2_id: data.player2_id
	};

	battleStore.set(id, record);
	return record;
};

export const ensureTeamBattleSlot = (battleId: string, slotId: string): TeamBattleSlotRecord => {
	const battleStore = getBattleStore(battleId);
	const record = battleStore.get(slotId);

	if (!record) {
		throw new Error('Team battle slot not found');
	}

	return record;
};

export const updateTeamBattleSlot = (
	battleId: string,
	slotId: string,
	data: TeamBattleSlotData
): TeamBattleSlotRecord => {
	const existing = ensureTeamBattleSlot(battleId, slotId);
	const battleStore = getBattleStore(battleId);

	const updated: TeamBattleSlotRecord = {
		...existing,
		team_id: data.team_id,
		slot_index: data.slot_index,
		assignment_type: data.assignment_type,
		pair_id: data.pair_id,
		player1_id: data.player1_id,
		player2_id: data.player2_id
	};

	battleStore.set(slotId, updated);
	return updated;
};

export const deleteTeamBattleSlot = (battleId: string, slotId: string): void => {
	ensureTeamBattleSlot(battleId, slotId);
	const battleStore = getBattleStore(battleId);
	battleStore.delete(slotId);
};

export const deleteTeamBattleSlotsByBattle = (battleId: string): void => {
	store.delete(battleId);
};

export const setTeamBattleSlots = (
	battleId: string,
	slots: TeamBattleSlotImportData[]
): TeamBattleSlotRecord[] => {
	const battleStore = getBattleStore(battleId);
	battleStore.clear();

	const results: TeamBattleSlotRecord[] = [];

	for (const slot of slots) {
		if (!slot.team_id || slot.slot_index === undefined) {
			continue;
		}

		const id = slot.id ?? crypto.randomUUID();
		const record: TeamBattleSlotRecord = {
			id,
			team_battle_id: battleId,
			team_id: slot.team_id,
			slot_index: slot.slot_index,
			assignment_type: slot.assignment_type,
			pair_id: slot.pair_id,
			player1_id: slot.player1_id,
			player2_id: slot.player2_id
		};

		battleStore.set(id, record);
		results.push(record);
	}

	return results.sort((a, b) => {
		if (a.team_id !== b.team_id) {
			return a.team_id.localeCompare(b.team_id);
		}
		return a.slot_index - b.slot_index;
	});
};

export const __resetForTests = () => {
	store.clear();
};
