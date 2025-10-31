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
	deleted_at: string | null;
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
	return Array.from(getEventStore(eventId).values()).filter((p) => p.deleted_at == null);
};

export const createPlayer = (eventId: string, data: PlayerData): PlayerRecord => {
	const now = new Date().toISOString();
	const record: PlayerRecord = {
		id: generateUUID(),
		event_id: eventId,
		name: data.name.trim(),
		note: data.note?.trim() ?? null,
		created_at: now,
		deleted_at: null
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensurePlayer = (eventId: string, playerId: string): PlayerRecord => {
	const player = getEventStore(eventId).get(playerId);

	if (!player) {
		throw new Error('Player not found');
	}

	if (player.deleted_at != null) {
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
	const storeForEvent = getEventStore(eventId);
	const record = storeForEvent.get(playerId);
	if (!record) {
		throw new Error('Player not found');
	}
	if (record.deleted_at != null) {
		throw new Error('Player not found');
	}
	storeForEvent.set(playerId, { ...record, deleted_at: new Date().toISOString() });
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
			created_at: new Date().toISOString(),
			deleted_at: null
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
	if (found.record.deleted_at != null) {
		throw new Error('Player not found');
	}
	return found.record;
};

export const updatePlayerById = (playerId: string, data: PlayerData): PlayerRecord => {
	const found = findPlayerById(playerId);
	if (!found) {
		throw new Error('Player not found');
	}
	if (found.record.deleted_at != null) {
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
	const record = store.get(found.eventId)!.get(playerId)!;
	if (record.deleted_at != null) {
		throw new Error('Player not found');
	}
	store.get(found.eventId)!.set(playerId, { ...record, deleted_at: new Date().toISOString() });
};

export const __resetForTests = () => {
	store.clear();
};
