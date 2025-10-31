import { generateUUID } from "~/utils/uuid";

export interface PairData {
	player1_id: string;
	player2_id: string;
	seed?: number | null;
}

export interface PairImportData extends PairData {
	id?: string;
}

export interface PairRecord {
	id: string;
	event_id: string;
	player1_id: string;
	player2_id: string;
	seed: number | null;
	created_at: string;
	deleted_at?: string | null;
}

const store = new Map<string, Map<string, PairRecord>>();

const getEventStore = (eventId: string) => {
	let eventStore = store.get(eventId);

	if (!eventStore) {
		eventStore = new Map();
		store.set(eventId, eventStore);
	}

	return eventStore;
};

export const listPairs = (eventId: string): PairRecord[] => {
	return Array.from(getEventStore(eventId).values()).filter(pair => !pair.deleted_at);
};

export const createPair = (eventId: string, data: PairData): PairRecord => {
	const now = new Date().toISOString();
	const record: PairRecord = {
		id: generateUUID(),
		event_id: eventId,
		player1_id: data.player1_id.trim(),
		player2_id: data.player2_id.trim(),
		seed: data.seed ?? null,
		created_at: now
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensurePair = (eventId: string, pairId: string): PairRecord => {
	const pair = getEventStore(eventId).get(pairId);

	if (!pair || pair.deleted_at) {
		throw new Error('Pair not found');
	}

	return pair;
};

export const updatePair = (eventId: string, pairId: string, data: PairData): PairRecord => {
	const existing = ensurePair(eventId, pairId);
	const updated: PairRecord = {
		...existing,
		player1_id: data.player1_id.trim(),
		player2_id: data.player2_id.trim(),
		seed: data.seed ?? null
	};

	getEventStore(eventId).set(pairId, updated);

	return updated;
};

export const deletePair = (eventId: string, pairId: string): void => {
	const pair = getEventStore(eventId).get(pairId);

	if (!pair || pair.deleted_at) {
		throw new Error('Pair not found');
	}

	pair.deleted_at = new Date().toISOString();
	getEventStore(eventId).set(pairId, pair);
};

export const setPairs = (eventId: string, pairs: PairImportData[]): PairRecord[] => {
	const eventStore = getEventStore(eventId);
	eventStore.clear();

	for (const entry of pairs) {
		const player1_id = entry.player1_id?.trim();
		const player2_id = entry.player2_id?.trim();
		
		if (!player1_id || !player2_id) {
			continue;
		}

		const record: PairRecord = {
			id: entry.id?.trim() || generateUUID(),
			event_id: eventId,
			player1_id,
			player2_id,
			seed: entry.seed ?? null,
			created_at: new Date().toISOString()
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => (a.seed || 0) - (b.seed || 0));
};

const findPairById = (pairId: string) => {
	for (const [eventId, eventStore] of store.entries()) {
		const record = eventStore.get(pairId);
		if (record) {
			return { eventId, record };
		}
	}
	return null;
};

export const getPairById = (pairId: string): PairRecord => {
	const found = findPairById(pairId);
	if (!found || found.record.deleted_at) {
		throw new Error('Pair not found');
	}
	return found.record;
};

export const updatePairById = (pairId: string, data: PairData): PairRecord => {
	const found = findPairById(pairId);
	if (!found) {
		throw new Error('Pair not found');
	}
	const updated: PairRecord = {
		...found.record,
		player1_id: data.player1_id.trim(),
		player2_id: data.player2_id.trim(),
		seed: data.seed ?? null,
		created_at: found.record.created_at
	};
	store.get(found.eventId)!.set(pairId, updated);
	return updated;
};

export const deletePairById = (pairId: string): void => {
	const found = findPairById(pairId);
	if (!found || found.record.deleted_at) {
		throw new Error('Pair not found');
	}
	found.record.deleted_at = new Date().toISOString();
	store.get(found.eventId)!.set(pairId, found.record);
};

export const __resetForTests = () => {
	store.clear();
};
