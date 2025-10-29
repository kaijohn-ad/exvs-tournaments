export interface PairData {
	player1_id: string;
	player2_id: string;
	seed?: number;
}

export interface PairImportData extends PairData {
	id?: string;
}

export interface PairRecord extends PairData {
	id: string;
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
	return Array.from(getEventStore(eventId).values());
};

export const createPair = (eventId: string, data: PairData): PairRecord => {
	const record: PairRecord = {
		id: crypto.randomUUID(),
		player1_id: data.player1_id.trim(),
		player2_id: data.player2_id.trim(),
		seed: data.seed
	};

	getEventStore(eventId).set(record.id, record);

	return record;
};

export const ensurePair = (eventId: string, pairId: string): PairRecord => {
	const pair = getEventStore(eventId).get(pairId);

	if (!pair) {
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
		seed: data.seed
	};

	getEventStore(eventId).set(pairId, updated);

	return updated;
};

export const deletePair = (eventId: string, pairId: string): void => {
	const didDelete = getEventStore(eventId).delete(pairId);

	if (!didDelete) {
		throw new Error('Pair not found');
	}
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
			id: entry.id?.trim() || crypto.randomUUID(),
			player1_id,
			player2_id,
			seed: entry.seed
		};

		eventStore.set(record.id, record);
	}

	return Array.from(eventStore.values()).sort((a, b) => (a.seed || 0) - (b.seed || 0));
};

export const __resetForTests = () => {
	store.clear();
};
