import { generateUUID } from "~/utils/uuid";

export interface PlayerData {
	name: string;
	note?: string | null;
}

export interface PlayerImportData extends PlayerData {
	id?: string;
}

export interface PlayerRecord {
	id: string;
	event_id: string;
	name: string;
	note: string | null;
	created_at: string;
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
	const now = new Date().toISOString();
	const record: PlayerRecord = {
		id: generateUUID(),
		event_id: eventId,
		name: data.name.trim(),
		note: data.note?.trim() ?? null,
		created_at: now
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
		note: data.note?.trim() ?? null
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
			id: entry.id?.trim() || generateUUID(),
			event_id: eventId,
			name,
			note: entry.note?.trim() ?? null,
			created_at: new Date().toISOString()
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
};

const findPlayerById = (playerId: string) => {
	for (const [eventId, eventStore] of store.entries()) {
		const record = eventStore.get(playerId);
		if (record) {
			return { eventId, record };
		}
	}
	return null;
};

export const getPlayerById = (playerId: string): PlayerRecord => {
	const found = findPlayerById(playerId);
	if (!found) {
		throw new Error('Player not found');
	}
	return found.record;
};

export const updatePlayerById = (playerId: string, data: PlayerData): PlayerRecord => {
	const found = findPlayerById(playerId);
	if (!found) {
		throw new Error('Player not found');
	}
	const updated: PlayerRecord = {
		...found.record,
		name: data.name.trim(),
		note: data.note?.trim() ?? null
	};
	store.get(found.eventId)!.set(playerId, updated);
	return updated;
};

export const deletePlayerById = (playerId: string): void => {
	const found = findPlayerById(playerId);
	if (!found) {
		throw new Error('Player not found');
	}
	store.get(found.eventId)!.delete(playerId);
};

export const __resetForTests = () => {
	store.clear();
};
