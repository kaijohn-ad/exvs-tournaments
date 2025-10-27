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

export interface SlotResultData {
	slot_index: number;
	winner_team_id: string;
	score_a: number;
	score_b: number;
}

const store = new Map<string, TeamBattleSlotRecord>();

export const listSlotsByBattle = (battleId: string): TeamBattleSlotRecord[] => {
	return Array.from(store.values())
		.filter(slot => slot.team_battle_id === battleId)
		.sort((a, b) => {
			if (a.team_id !== b.team_id) {
				return a.team_id.localeCompare(b.team_id);
			}
			return a.slot_index - b.slot_index;
		});
};

export const createSlot = (data: TeamBattleSlotData): TeamBattleSlotRecord => {
	const id = crypto.randomUUID();
	const record: TeamBattleSlotRecord = {
		id,
		...data
	};
	store.set(id, record);
	return record;
};

export const ensureSlot = (slotId: string): TeamBattleSlotRecord => {
	const record = store.get(slotId);
	if (!record) {
		throw new Error('Team battle slot not found');
	}
	return record;
};

export const updateSlot = (slotId: string, data: TeamBattleSlotData): TeamBattleSlotRecord => {
	ensureSlot(slotId);
	const updated: TeamBattleSlotRecord = {
		id: slotId,
		...data
	};
	store.set(slotId, updated);
	return updated;
};

export const deleteSlot = (slotId: string): void => {
	ensureSlot(slotId);
	store.delete(slotId);
};

export const deleteSlotsByBattle = (battleId: string): void => {
	const slots = listSlotsByBattle(battleId);
	for (const slot of slots) {
		store.delete(slot.id);
	}
};

export const setSlots = (slots: TeamBattleSlotImportData[]): TeamBattleSlotRecord[] => {
	store.clear();
	const results: TeamBattleSlotRecord[] = [];

	for (const slot of slots) {
		if (!slot.team_battle_id || !slot.team_id) {
			continue;
		}

		const id = slot.id ?? crypto.randomUUID();
		const record: TeamBattleSlotRecord = {
			id,
			team_battle_id: slot.team_battle_id,
			team_id: slot.team_id,
			slot_index: slot.slot_index,
			assignment_type: slot.assignment_type,
			pair_id: slot.pair_id,
			player1_id: slot.player1_id,
			player2_id: slot.player2_id
		};

		store.set(id, record);
		results.push(record);
	}

	return results;
};

export const __resetForTests = () => {
	store.clear();
};
