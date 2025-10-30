import { generateUUID } from "~/utils/uuid";

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
	const id = generateUUID();

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

export const ensureTeamBattleSlot = (
	battleId: string,
	slotId: string
): TeamBattleSlotRecord => {
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

	if (battleStore.size === 0) {
		store.delete(battleId);
	}
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

		const id = slot.id ?? generateUUID();
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

const findSlotEntry = (slotId: string) => {
	for (const [battleId, battleStore] of store.entries()) {
		const record = battleStore.get(slotId);
		if (record) {
			return { battleId, record };
		}
	}
	return null;
};

export const listSlotsByBattle = (battleId: string): TeamBattleSlotRecord[] => {
	return listTeamBattleSlots(battleId);
};

export const createSlot = (data: TeamBattleSlotData): TeamBattleSlotRecord => {
	return createTeamBattleSlot(data);
};

export const ensureSlot = (slotId: string): TeamBattleSlotRecord => {
	const entry = findSlotEntry(slotId);
	if (!entry) {
		throw new Error('Team battle slot not found');
	}
	return entry.record;
};

export const updateSlot = (slotId: string, data: TeamBattleSlotData): TeamBattleSlotRecord => {
	const current = findSlotEntry(slotId);
	if (!current) {
		throw new Error('Team battle slot not found');
	}

	if (current.battleId !== data.team_battle_id) {
		const oldStore = getBattleStore(current.battleId);
		oldStore.delete(slotId);
	}

	const battleStore = getBattleStore(data.team_battle_id);
	const updated: TeamBattleSlotRecord = {
		id: slotId,
		team_battle_id: data.team_battle_id,
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

export const deleteSlot = (slotId: string): void => {
	const entry = findSlotEntry(slotId);
	if (!entry) {
		throw new Error('Team battle slot not found');
	}

	const battleStore = getBattleStore(entry.battleId);
	battleStore.delete(slotId);

	if (battleStore.size === 0) {
		store.delete(entry.battleId);
	}
};

export const deleteSlotsByBattle = (battleId: string): void => {
	deleteTeamBattleSlotsByBattle(battleId);
};

export const setSlots = (slots: TeamBattleSlotImportData[]): TeamBattleSlotRecord[] => {
	store.clear();
	const results: TeamBattleSlotRecord[] = [];

	const grouped = new Map<string, TeamBattleSlotImportData[]>();

	for (const slot of slots) {
		if (!slot.team_battle_id || !slot.team_id) {
			continue;
		}

		const battleSlots = grouped.get(slot.team_battle_id) ?? [];
		battleSlots.push(slot);
		grouped.set(slot.team_battle_id, battleSlots);
	}

	for (const [battleId, battleSlots] of grouped.entries()) {
		results.push(...setTeamBattleSlots(battleId, battleSlots));
	}

	return results;
};

export const __resetForTests = () => {
	store.clear();
};
