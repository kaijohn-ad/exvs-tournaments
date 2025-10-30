import { generateUUID } from "~/utils/uuid";

export interface TeamBattleData {
	team_a_id: string;
	team_b_id: string;
	slots_count?: number;
	format?: string;
	allow_double_appearance_per_team?: boolean;
	tiebreak?: string;
	status?: string;
	result?: string;
}

export interface TeamBattleImportData extends TeamBattleData {
	id?: string;
}

export interface TeamBattleRecord extends TeamBattleData {
	id: string;
	event_id: string;
	slots_count: number;
	format: string;
	allow_double_appearance_per_team: boolean;
	tiebreak: string;
	status: string;
}

const store = new Map<string, Map<string, TeamBattleRecord>>();

const getEventStore = (eventId: string) => {
	let eventStore = store.get(eventId);

	if (!eventStore) {
		eventStore = new Map();
		store.set(eventId, eventStore);
	}

	return eventStore;
};

export const listTeamBattles = (eventId: string): TeamBattleRecord[] => {
	const eventStore = getEventStore(eventId);
	return Array.from(eventStore.values());
};

export const createTeamBattle = (eventId: string, data: TeamBattleData): TeamBattleRecord => {
	const eventStore = getEventStore(eventId);
	const id = generateUUID();

	const record: TeamBattleRecord = {
		id,
		event_id: eventId,
		team_a_id: data.team_a_id,
		team_b_id: data.team_b_id,
		slots_count: data.slots_count ?? 3,
		format: data.format ?? 'waseda',
		allow_double_appearance_per_team: data.allow_double_appearance_per_team ?? true,
		tiebreak: data.tiebreak ?? 'off',
		status: data.status ?? 'pending',
		result: data.result
	};

	eventStore.set(id, record);
	return record;
};

export const ensureTeamBattle = (eventId: string, battleId: string): TeamBattleRecord => {
	const eventStore = getEventStore(eventId);
	const record = eventStore.get(battleId);

	if (!record) {
		throw new Error('Team battle not found');
	}

	return record;
};

export const updateTeamBattle = (
	eventId: string,
	battleId: string,
	data: TeamBattleData
): TeamBattleRecord => {
	const existing = ensureTeamBattle(eventId, battleId);
	const eventStore = getEventStore(eventId);

	const updated: TeamBattleRecord = {
		...existing,
		team_a_id: data.team_a_id,
		team_b_id: data.team_b_id,
		slots_count: data.slots_count ?? existing.slots_count,
		format: data.format ?? existing.format,
		allow_double_appearance_per_team:
			data.allow_double_appearance_per_team ?? existing.allow_double_appearance_per_team,
		tiebreak: data.tiebreak ?? existing.tiebreak,
		status: data.status ?? existing.status,
		result: data.result ?? existing.result
	};

	eventStore.set(battleId, updated);
	return updated;
};

export const deleteTeamBattle = (eventId: string, battleId: string): void => {
	ensureTeamBattle(eventId, battleId);
	const eventStore = getEventStore(eventId);
	eventStore.delete(battleId);
};

export const setTeamBattles = (
	eventId: string,
	battles: TeamBattleImportData[]
): TeamBattleRecord[] => {
	const eventStore = getEventStore(eventId);
	eventStore.clear();

	const results: TeamBattleRecord[] = [];

	for (const battle of battles) {
		if (!battle.team_a_id || !battle.team_b_id) {
			continue;
		}

		const id = battle.id ?? generateUUID();
		const record: TeamBattleRecord = {
			id,
			event_id: eventId,
			team_a_id: battle.team_a_id,
			team_b_id: battle.team_b_id,
			slots_count: battle.slots_count ?? 3,
			format: battle.format ?? 'waseda',
			allow_double_appearance_per_team: battle.allow_double_appearance_per_team ?? true,
			tiebreak: battle.tiebreak ?? 'off',
			status: battle.status ?? 'pending',
			result: battle.result
		};

		eventStore.set(id, record);
		results.push(record);
	}

	return results;
};

export const __resetForTests = () => {
	store.clear();
};
