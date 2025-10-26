import { randomUUID } from 'node:crypto';

export interface PlayerData {
	name: string;
	note?: string;
}

export interface PlayerImportData extends PlayerData {
	id?: string;
}

export interface PlayerRecord extends PlayerData {
	id: string;
}

const store = new Map<string, Map<string, PlayerRecord>>();

const getEventStore = (eventId: string) => {
	let eventStore = store.get(eventId);

	if (!eventStore) {
		eventStore = new Map();
		store.set(eventId, eventStore);
	}

	return eventStore;
};

export const listPlayers = (eventId: string): PlayerRecord[] => {
	return Array.from(getEventStore(eventId).values());
};

export const createPlayer = (eventId: string, data: PlayerData): PlayerRecord => {
	const record: PlayerRecord = {
		id: randomUUID(),
		name: data.name.trim(),
		note: data.note?.trim() || undefined
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensurePlayer = (eventId: string, playerId: string): PlayerRecord => {
	const player = getEventStore(eventId).get(playerId);

	if (!player) {
		throw new Error('Player not found');
	}

	return player;
};

export const updatePlayer = (eventId: string, playerId: string, data: PlayerData): PlayerRecord => {
	const existing = ensurePlayer(eventId, playerId);
	const updated: PlayerRecord = {
		...existing,
		name: data.name.trim(),
		note: data.note?.trim() || undefined
	};

	getEventStore(eventId).set(playerId, updated);

	return updated;
};

export const deletePlayer = (eventId: string, playerId: string): void => {
	const didDelete = getEventStore(eventId).delete(playerId);

	if (!didDelete) {
		throw new Error('Player not found');
	}
};

export const setPlayers = (eventId: string, players: PlayerImportData[]): PlayerRecord[] => {
	const eventStore = getEventStore(eventId);
	eventStore.clear();

	for (const entry of players) {
		const name = entry.name?.trim();
		if (!name) {
			continue;
		}

		const record: PlayerRecord = {
			id: entry.id?.trim() || randomUUID(),
			name,
			note: entry.note?.trim() || undefined
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
};

export const __resetForTests = () => {
	store.clear();
};
