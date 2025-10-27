import { randomUUID } from 'node:crypto';

export interface TournamentData {
	name: string;
	format?: 'single-elimination';
	seedingMode?: 'random' | 'manual';
}

export interface TournamentImportData extends TournamentData {
	id?: string;
}

export interface TournamentRecord extends TournamentData {
	id: string;
	eventId: string;
	createdAt: string;
}

const store = new Map<string, Map<string, TournamentRecord>>();

const getEventStore = (eventId: string) => {
	let eventStore = store.get(eventId);

	if (!eventStore) {
		eventStore = new Map();
		store.set(eventId, eventStore);
	}

	return eventStore;
};

export const listTournaments = (eventId: string): TournamentRecord[] => {
	return Array.from(getEventStore(eventId).values());
};

export const createTournament = (eventId: string, data: TournamentData): TournamentRecord => {
	const record: TournamentRecord = {
		id: randomUUID(),
		eventId,
		name: data.name.trim(),
		format: data.format || 'single-elimination',
		seedingMode: data.seedingMode || 'random',
		createdAt: new Date().toISOString()
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensureTournament = (eventId: string, tournamentId: string): TournamentRecord => {
	const tournament = getEventStore(eventId).get(tournamentId);

	if (!tournament) {
		throw new Error('Tournament not found');
	}

	return tournament;
};

export const updateTournament = (
	eventId: string,
	tournamentId: string,
	data: TournamentData
): TournamentRecord => {
	const existing = ensureTournament(eventId, tournamentId);
	const updated: TournamentRecord = {
		...existing,
		name: data.name.trim(),
		format: data.format || existing.format,
		seedingMode: data.seedingMode || existing.seedingMode
	};

	getEventStore(eventId).set(tournamentId, updated);

	return updated;
};

export const deleteTournament = (eventId: string, tournamentId: string): void => {
	const didDelete = getEventStore(eventId).delete(tournamentId);

	if (!didDelete) {
		throw new Error('Tournament not found');
	}
};

export const setTournaments = (
	eventId: string,
	tournaments: TournamentImportData[]
): TournamentRecord[] => {
	const eventStore = getEventStore(eventId);
	eventStore.clear();

	for (const entry of tournaments) {
		const name = entry.name?.trim();
		if (!name) {
			continue;
		}

		const record: TournamentRecord = {
			id: entry.id?.trim() || randomUUID(),
			eventId,
			name,
			format: entry.format || 'single-elimination',
			seedingMode: entry.seedingMode || 'random',
			createdAt: new Date().toISOString()
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
};

export const __resetForTests = () => {
	store.clear();
};
