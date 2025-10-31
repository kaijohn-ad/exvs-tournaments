import { generateUUID } from "~/utils/uuid";

export interface TeamData {
	name: string;
}

export interface TeamImportData extends TeamData {
	id?: string;
}

export interface TeamRecord extends TeamData {
	id: string;
}

const store = new Map<string, Map<string, TeamRecord>>();
const teamMembersStore = new Map<string, Set<string>>();

const getEventStore = (eventId: string) => {
	let eventStore = store.get(eventId);

	if (!eventStore) {
		eventStore = new Map();
		store.set(eventId, eventStore);
	}

	return eventStore;
};

const getTeamMembers = (teamId: string): Set<string> => {
	let members = teamMembersStore.get(teamId);
	if (!members) {
		members = new Set();
		teamMembersStore.set(teamId, members);
	}
	return members;
};

export const listTeams = (eventId: string): TeamRecord[] => {
	return Array.from(getEventStore(eventId).values());
};

export const createTeam = (eventId: string, data: TeamData): TeamRecord => {
	const record: TeamRecord = {
		id: generateUUID(),
		name: data.name.trim()
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensureTeam = (eventId: string, teamId: string): TeamRecord => {
	const team = getEventStore(eventId).get(teamId);

	if (!team) {
		throw new Error('Team not found');
	}

	return team;
};

export const updateTeam = (eventId: string, teamId: string, data: TeamData): TeamRecord => {
	const existing = ensureTeam(eventId, teamId);
	const updated: TeamRecord = {
		...existing,
		name: data.name.trim()
	};

	getEventStore(eventId).set(teamId, updated);

	return updated;
};

export const deleteTeam = (eventId: string, teamId: string): void => {
	const didDelete = getEventStore(eventId).delete(teamId);

	if (!didDelete) {
		throw new Error('Team not found');
	}

	// チームメンバーも削除
	teamMembersStore.delete(teamId);
};

export const setTeams = (eventId: string, teams: TeamImportData[]): TeamRecord[] => {
	const eventStore = getEventStore(eventId);
	eventStore.clear();

	for (const entry of teams) {
		const name = entry.name?.trim();
		
		if (!name) {
			continue;
		}

		const record: TeamRecord = {
			id: entry.id?.trim() || generateUUID(),
			name
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
};

export const __resetForTests = () => {
	store.clear();
	teamMembersStore.clear();
};

export const addTeamMember = (teamId: string, playerId: string): void => {
	const members = getTeamMembers(teamId);
	members.add(playerId);
};

export const listTeamMemberIds = (teamId: string): string[] => {
	const members = getTeamMembers(teamId);
	return Array.from(members);
};
